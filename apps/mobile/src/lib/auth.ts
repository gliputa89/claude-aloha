import type { TranslationKey } from '@aloha/i18n';
import {
  GoogleSignin,
  isErrorWithCode,
  isSuccessResponse,
  statusCodes,
} from '@react-native-google-signin/google-signin';
import * as AppleAuthentication from 'expo-apple-authentication';
import * as Crypto from 'expo-crypto';
import * as Linking from 'expo-linking';
import { FunctionsHttpError, type AuthError, type User } from '@supabase/supabase-js';
import { Platform } from 'react-native';

import { clearSavedPlaces } from '@/features/weather/api';

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
 * Pierwsze logowanie uzupełnia konto (zgody, język, imię) – patrz `completeSocialAccount`.
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
    await completeSocialAccount(data.user.id, locale, credential.fullName?.givenName ?? null).catch(() => {});
    // Refresh token Apple na serwer (w tle): przy usunięciu konta – też z panelu – unieważnimy dostęp w Apple.
    if (credential.authorizationCode) {
      supabase.functions
        .invoke('apple-token', { method: 'POST', body: { authorizationCode: credential.authorizationCode } })
        .catch(() => {});
    }
    return { ok: true, data: { canceled: false } };
  });
}

/**
 * Identyfikatory klientów OAuth z Google Cloud (publiczne, nie sekrety).
 * Web client ID jest odbiorcą tokenu na Androidzie i musi być też w Supabase (Providers → Google → Client IDs),
 * iOS client ID wymaga dodatkowo schematu URL w buildzie – dopisuje go `app.config.ts`.
 */
const GOOGLE_WEB_CLIENT_ID = process.env.EXPO_PUBLIC_GOOGLE_WEB_CLIENT_ID ?? '';
const GOOGLE_IOS_CLIENT_ID = process.env.EXPO_PUBLIC_GOOGLE_IOS_CLIENT_ID ?? '';

/** Logowanie przez Google jest natywne (iOS i Android, development build) i pojawia się dopiero po ustawieniu client ID. */
export const googleSignInAvailable =
  !!GOOGLE_WEB_CLIENT_ID && (Platform.OS === 'android' || (Platform.OS === 'ios' && !!GOOGLE_IOS_CLIENT_ID));

let googleConfigured = false;

/**
 * Logowanie / rejestracja przez Google: natywny wybór konta → idToken → sesja Supabase.
 * Biblioteka nie przekazuje nonce, a SDK na iOS dokłada własny – dlatego w Supabase
 * dostawca Google ma włączone „Skip nonce checks”.
 * Pierwsze logowanie uzupełnia konto tak samo jak przy Apple.
 */
export function signInWithGoogle(locale: 'pl' | 'en') {
  return run<{ canceled: boolean }>(async () => {
    if (!googleConfigured) {
      GoogleSignin.configure({
        webClientId: GOOGLE_WEB_CLIENT_ID,
        iosClientId: GOOGLE_IOS_CLIENT_ID || undefined,
      });
      googleConfigured = true;
    }

    let idToken: string | null;
    let givenName: string | null;
    try {
      if (Platform.OS === 'android') {
        await GoogleSignin.hasPlayServices({ showPlayServicesUpdateDialog: true });
      }
      const response = await GoogleSignin.signIn();
      if (!isSuccessResponse(response)) return { ok: true, data: { canceled: true } };
      idToken = response.data.idToken;
      givenName = response.data.user.givenName;
    } catch (e) {
      if (isErrorWithCode(e)) {
        if (e.code === statusCodes.SIGN_IN_CANCELLED || e.code === statusCodes.IN_PROGRESS) {
          return { ok: true, data: { canceled: true } };
        }
        if (e.code === statusCodes.PLAY_SERVICES_NOT_AVAILABLE) {
          return { ok: false, error: 'authErrors.googlePlayServices' };
        }
      }
      return { ok: false, error: 'authErrors.googleFailed' };
    }
    if (!idToken) return { ok: false, error: 'authErrors.googleFailed' };

    const { data, error } = await supabase.auth.signInWithIdToken({ provider: 'google', token: idToken });
    if (error || !data.user) {
      const key = error ? mapError(error) : 'authErrors.generic';
      return { ok: false, error: key === 'authErrors.generic' ? 'authErrors.googleFailed' : key };
    }

    await completeSocialAccount(data.user.id, locale, givenName).catch(() => {});
    return { ok: true, data: { canceled: false } };
  });
}

/** Na tym urządzeniu da się zalogować co najmniej jednym kontem zewnętrznym (Apple / Google). */
export const socialSignInAvailable = appleSignInAvailable || googleSignInAvailable;

/**
 * Konto z Apple lub Google nie przechodzi przez formularz rejestracji, więc przy pierwszym
 * logowaniu dopisujemy to, co formularz przekazuje triggerowi handle_new_user:
 * zgody (regulamin, prywatność – tekst pod przyciskami), język i imię.
 */
async function completeSocialAccount(userId: string, locale: 'pl' | 'en', givenName: string | null) {
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
  // Google podaje je zawsze, ale też nie nadpisujemy imienia, które użytkownik już ma.
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

export async function signOut({ local = false }: { local?: boolean } = {}) {
  // `local` – tylko ten telefon (np. po usunięciu konta, gdy sesji na serwerze już nie ma).
  await supabase.auth.signOut(local ? { scope: 'local' } : undefined);
  // Bez tego Google przy następnym logowaniu od razu wybrałby to samo konto.
  if (googleSignInAvailable) await GoogleSignin.signOut().catch(() => {});
}

/** Konto ma logowanie przez Apple – przy usuwaniu trzeba też unieważnić token Apple. */
export function usesAppleSignIn(user: User | null | undefined) {
  if (!user) return false;
  const providers = (user.app_metadata?.providers as string[] | undefined) ?? [user.app_metadata?.provider];
  return providers.includes('apple') || !!user.identities?.some((i) => i.provider === 'apple');
}

export type DeleteAccountResult =
  | { status: 'deleted' }
  | { status: 'cancelled' }
  | { status: 'error'; error: TranslationKey };

/**
 * Usunięcie własnego konta (Profil → Usuń konto): funkcja delete-account – ta sama, której używa panel admina –
 * usuwa konto i wszystkie dane, po czym wylogowujemy telefon. Konto z Apple na iOS najpierw potwierdza się
 * w arkuszu Apple: świeży kod pozwala unieważnić token Apple (wymóg App Store) także wtedy, gdy serwer nie ma
 * zapisanego tokenu z logowania (np. konto sprzed tej zmiany). Zamknięcie arkusza = rezygnacja.
 */
export async function deleteAccount(user: User): Promise<DeleteAccountResult> {
  if (!isSupabaseConfigured) return { status: 'error', error: 'authErrors.notConfigured' };

  let appleAuthorizationCode: string | null = null;
  if (appleSignInAvailable && usesAppleSignIn(user)) {
    try {
      const credential = await AppleAuthentication.signInAsync({ requestedScopes: [] });
      appleAuthorizationCode = credential.authorizationCode;
    } catch (e) {
      if (e instanceof Error && 'code' in e && e.code === 'ERR_REQUEST_CANCELED') return { status: 'cancelled' };
      // Inny błąd arkusza nie blokuje usunięcia – konto i dane i tak znikną, token Apple wygaśnie sam.
    }
  }

  try {
    const { error } = await supabase.functions.invoke('delete-account', {
      method: 'POST',
      body: { appleAuthorizationCode },
    });
    if (error) {
      const body = error instanceof FunctionsHttpError ? await error.context.json().catch(() => null) : null;
      if (body?.error === 'admin_account') return { status: 'error', error: 'deleteAccount.errorAdmin' };
      return { status: 'error', error: error instanceof FunctionsHttpError ? 'deleteAccount.errorFailed' : 'authErrors.network' };
    }
  } catch {
    return { status: 'error', error: 'authErrors.network' };
  }

  // Konto już nie istnieje – czyścimy tylko ten telefon (sesja, wybór konta Google, zapamiętane miejsca).
  clearSavedPlaces();
  if (googleSignInAvailable && user.identities?.some((i) => i.provider === 'google')) {
    await GoogleSignin.revokeAccess().catch(() => {});
  }
  await signOut({ local: true });
  return { status: 'deleted' };
}
