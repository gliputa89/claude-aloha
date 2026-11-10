import type { AuthError } from '@supabase/supabase-js';
import type { TranslationKey } from '@aloha/i18n';
import * as AppleAuthentication from 'expo-apple-authentication';
import * as Crypto from 'expo-crypto';
import * as Linking from 'expo-linking';
import { Platform } from 'react-native';

import { isSupabaseConfigured, supabase } from './supabase';

/** Wersja treści regulaminu i polityki prywatności akceptowanej przy rejestracji (zapisywana w public.consents). */
export const TERMS_VERSION = '2026-11';

export const MIN_PASSWORD_LENGTH = 8;

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;

export function isValidEmail(email: string) {
  return EMAIL_RE.test(email.trim());
}

/** Adres, na który wraca link z e-maila (aloha://auth/callback w development buildzie). */
export function authRedirectUrl(next?: 'reset-password') {
  return Linking.createURL('/auth/callback', next ? { queryParams: { next } } : undefined);
}

export type AuthResult<T = undefined> = { ok: true; data: T } | { ok: false; error: TranslationKey };

function mapError(error: AuthError | Error): TranslationKey {
  const code = 'code' in error ? error.code : undefined;
  switch (code) {
    case 'invalid_credentials':
      return 'authErrors.invalidCredentials';
    case 'email_not_confirmed':
      return 'authErrors.emailNotConfirmed';
    case 'user_already_exists':
    case 'email_exists':
      return 'authErrors.userExists';
    case 'weak_password':
      return 'authErrors.weakPassword';
    case 'same_password':
      return 'authErrors.samePassword';
    case 'email_address_invalid':
      return 'authErrors.emailInvalid';
    case 'over_request_rate_limit':
    case 'over_email_send_rate_limit':
      return 'authErrors.rateLimit';
  }
  if (error.name === 'AuthRetryableFetchError' || /network|fetch/i.test(error.message)) {
    return 'authErrors.network';
  }
  return 'authErrors.generic';
}

async function run<T>(fn: () => Promise<AuthResult<T>>): Promise<AuthResult<T>> {
  if (!isSupabaseConfigured) return { ok: false, error: 'authErrors.notConfigured' };
  try {
    return await fn();
  } catch (e) {
    return { ok: false, error: mapError(e instanceof Error ? e : new Error(String(e))) };
  }
}

export type SignUpInput = {
  name: string;
  email: string;
  password: string;
  locale: 'pl' | 'en';
};

/** `needsConfirmation: true` → konto założone, ale trzeba kliknąć link z e-maila. */
export function signUp({ name, email, password, locale }: SignUpInput) {
  return run<{ needsConfirmation: boolean }>(async () => {
    const { data, error } = await supabase.auth.signUp({
      email: email.trim(),
      password,
      options: {
        emailRedirectTo: authRedirectUrl(),
        // Trigger public.handle_new_user zakłada profil i zapisuje zgody z tych danych.
        data: {
          display_name: name.trim(),
          locale,
          terms_version: TERMS_VERSION,
        },
      },
    });
    if (error) return { ok: false, error: mapError(error) };
    // Przy włączonym potwierdzaniu e-maili Supabase nie zdradza, że konto istnieje – zwraca użytkownika bez tożsamości.
    if (data.user && data.user.identities?.length === 0) {
      return { ok: false, error: 'authErrors.userExists' };
    }
    return { ok: true, data: { needsConfirmation: !data.session } };
  });
}

export function signIn(email: string, password: string) {
  return run(async () => {
    const { error } = await supabase.auth.signInWithPassword({ email: email.trim(), password });
    if (error) return { ok: false, error: mapError(error) };
    return { ok: true, data: undefined };
  });
}

export function sendPasswordReset(email: string) {
  return run(async () => {
    const { error } = await supabase.auth.resetPasswordForEmail(email.trim(), {
      redirectTo: authRedirectUrl('reset-password'),
    });
    if (error) return { ok: false, error: mapError(error) };
    return { ok: true, data: undefined };
  });
}

export function updatePassword(password: string) {
  return run(async () => {
    const { error } = await supabase.auth.updateUser({ password });
    if (error) return { ok: false, error: mapError(error) };
    return { ok: true, data: undefined };
  });
}

/** Logowanie przez Apple jest natywne i dostępne tylko na iOS (wymaga development builda, nie Expo Go). */
export const appleSignInAvailable = Platform.OS === 'ios';

/**
 * Logowanie / rejestracja przez Apple: systemowy arkusz → identityToken → sesja Supabase.
 * `canceled: true` → użytkownik zamknął arkusz, nie pokazujemy błędu.
 *
 * Konto założone tą drogą nie przechodzi przez formularz rejestracji, więc przy pierwszym
 * logowaniu dopisujemy tu to, co formularz przekazuje triggerowi handle_new_user:
 * zgody (regulamin, prywatność – tekst pod przyciskiem Apple), język i imię.
 */
export function signInWithApple(locale: 'pl' | 'en') {
  return run<{ canceled: boolean }>(async () => {
    // Apple dostaje skrót nonce, Supabase – wartość jawną i sam porównuje ją z tokenem.
    const rawNonce = Crypto.randomUUID();
    const hashedNonce = await Crypto.digestStringAsync(Crypto.CryptoDigestAlgorithm.SHA256, rawNonce);

    let credential: AppleAuthentication.AppleAuthenticationCredential;
    try {
      credential = await AppleAuthentication.signInAsync({
        requestedScopes: [
          AppleAuthentication.AppleAuthenticationScope.FULL_NAME,
          AppleAuthentication.AppleAuthenticationScope.EMAIL,
        ],
        nonce: hashedNonce,
      });
    } catch (e) {
      if (e instanceof Error && 'code' in e && e.code === 'ERR_REQUEST_CANCELED') {
        return { ok: true, data: { canceled: true } };
      }
      return { ok: false, error: 'authErrors.appleFailed' };
    }
    if (!credential.identityToken) return { ok: false, error: 'authErrors.appleFailed' };

    const { data, error } = await supabase.auth.signInWithIdToken({
      provider: 'apple',
      token: credential.identityToken,
      nonce: rawNonce,
    });
    if (error || !data.user) {
      const key = error ? mapError(error) : 'authErrors.generic';
      return { ok: false, error: key === 'authErrors.generic' ? 'authErrors.appleFailed' : key };
    }

    // Uzupełnienie konta nie może zablokować logowania – przy błędzie ponowimy przy następnym.
    await completeAppleAccount(data.user.id, locale, credential.fullName?.givenName ?? null).catch(() => {});
    return { ok: true, data: { canceled: false } };
  });
}

async function completeAppleAccount(userId: string, locale: 'pl' | 'en', givenName: string | null) {
  const { data: accepted, error } = await supabase
    .from('consents')
    .select('id')
    .eq('user_id', userId)
    .eq('kind', 'terms')
    .limit(1);
  if (error) return;

  if (accepted.length === 0) {
    await supabase.from('consents').insert([
      { user_id: userId, kind: 'terms', granted: true, version: TERMS_VERSION },
      { user_id: userId, kind: 'privacy', granted: true, version: TERMS_VERSION },
    ]);
    await supabase.from('profiles').update({ locale }).eq('id', userId);
  }

  // Apple podaje imię tylko przy pierwszej autoryzacji – zapisujemy je, jeśli profil go nie ma.
  const name = givenName?.trim().slice(0, 80);
  if (name) {
    await supabase.from('profiles').update({ display_name: name }).eq('id', userId).is('display_name', null);
  }
}

/** Wymienia `code` z linku e-mailowego (PKCE) na sesję. */
export function exchangeCode(code: string) {
  return run(async () => {
    const { error } = await supabase.auth.exchangeCodeForSession(code);
    if (error) return { ok: false, error: mapError(error) };
    return { ok: true, data: undefined };
  });
}

export async function signOut() {
  await supabase.auth.signOut();
}
