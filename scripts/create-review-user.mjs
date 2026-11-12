#!/usr/bin/env node
// Konto testowe dla recenzentów Google Play / App Store (i do własnych testów).
// Zakłada użytkownika z potwierdzonym e-mailem i losowym hasłem, z tymi samymi metadanymi co rejestracja w aplikacji
// (imię, język, akceptacja regulaminu – trigger handle_new_user tworzy profil i zgody).
// Dane logowania zapisuje w .env.review.local w katalogu głównym (plik jest w .gitignore, nie trafia do repo).
//
//   node scripts/create-review-user.mjs prod            # załóż konto na produkcji
//   node scripts/create-review-user.mjs staging         # to samo na stagingu
//   node scripts/create-review-user.mjs prod --reset    # konto już jest – ustaw nowe hasło
//
// Adres bazy i klucz administracyjny pobiera z Vercel (projekt aloha-web), jak scripts/db-push.sh. Wymaga `vercel login`.

import { execFileSync } from 'node:child_process';
import { randomInt } from 'node:crypto';
import { existsSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import { createInterface } from 'node:readline/promises';
import { fileURLToPath } from 'node:url';

const EMAIL = 'review@alohatraining.app';
const DISPLAY_NAME = 'App Review';
const LOCALE = 'en'; // recenzenci Google i Apple czytają po angielsku
const TERMS_VERSION = '2026-11'; // = TERMS_VERSION w apps/mobile/src/lib/auth.ts

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const credentialsFile = join(root, '.env.review.local');

const [target, ...flags] = process.argv.slice(2);
const reset = flags.includes('--reset');
const vercelEnv = { staging: 'development', prod: 'production' }[target];
if (!vercelEnv) {
  console.error('Użycie: node scripts/create-review-user.mjs staging|prod [--reset]');
  process.exit(1);
}

function parseEnv(text) {
  const env = {};
  for (const line of text.split('\n')) {
    const m = line.match(/^([A-Z0-9_]+)=(.*)$/);
    if (m) env[m[1]] = m[2].replace(/^"|"$/g, '');
  }
  return env;
}

function pullSupabaseEnv() {
  const tmp = mkdtempSync(join(tmpdir(), 'aloha-review-'));
  try {
    const opts = { cwd: tmp, stdio: 'ignore' };
    execFileSync('vercel', ['link', '--yes', '--project', 'aloha-web'], opts);
    execFileSync('vercel', ['env', 'pull', join(tmp, '.env'), `--environment=${vercelEnv}`, '--yes'], opts);
    const env = parseEnv(readFileSync(join(tmp, '.env'), 'utf8'));
    if (!env.SUPABASE_URL || !env.SUPABASE_SERVICE_ROLE_KEY) {
      throw new Error(`Brak SUPABASE_URL lub SUPABASE_SERVICE_ROLE_KEY w zmiennych Vercel (${vercelEnv}).`);
    }
    return { url: env.SUPABASE_URL.replace(/\/$/, ''), key: env.SUPABASE_SERVICE_ROLE_KEY };
  } catch (e) {
    throw new Error(e.message?.startsWith('Brak') ? e.message : 'Nie udało się pobrać zmiennych z Vercel. Zaloguj się: vercel login');
  } finally {
    rmSync(tmp, { recursive: true, force: true });
  }
}

/** 20 znaków, bez mylących znaków (0/O, 1/l/I), z co najmniej jedną małą, wielką literą i cyfrą. */
function generatePassword() {
  const sets = ['abcdefghijkmnopqrstuvwxyz', 'ABCDEFGHJKLMNPQRSTUVWXYZ', '23456789'];
  const all = sets.join('');
  const chars = sets.map((s) => s[randomInt(s.length)]);
  while (chars.length < 20) chars.push(all[randomInt(all.length)]);
  for (let i = chars.length - 1; i > 0; i--) {
    const j = randomInt(i + 1);
    [chars[i], chars[j]] = [chars[j], chars[i]];
  }
  return chars.join('');
}

async function admin({ url, key }, path, init = {}) {
  const res = await fetch(`${url}/auth/v1/admin${path}`, {
    ...init,
    headers: { apikey: key, Authorization: `Bearer ${key}`, 'Content-Type': 'application/json' },
  });
  const body = await res.json().catch(() => ({}));
  return { ok: res.ok, status: res.status, body };
}

async function findUserId(supabase) {
  for (let page = 1; page < 50; page++) {
    const { ok, body } = await admin(supabase, `/users?page=${page}&per_page=200`);
    if (!ok) throw new Error(`Nie udało się pobrać listy kont: ${JSON.stringify(body)}`);
    const user = body.users?.find((u) => u.email?.toLowerCase() === EMAIL);
    if (user) return user.id;
    if (!body.users?.length || body.users.length < 200) return null;
  }
  return null;
}

/** Zapisuje dane dla danego środowiska, zostawiając wpisy drugiego. */
function saveCredentials(password) {
  const prefix = target.toUpperCase();
  const current = existsSync(credentialsFile) ? readFileSync(credentialsFile, 'utf8') : '';
  const kept = current
    .split('\n')
    .filter((l) => l.trim() && !l.startsWith(`${prefix}_REVIEW_`) && !l.startsWith('#'));
  const lines = [
    '# Konto testowe dla recenzentów sklepów i własnych testów. Tworzy: node scripts/create-review-user.mjs staging|prod',
    '# NIE commitować (plik jest w .gitignore).',
    ...kept,
    `${prefix}_REVIEW_EMAIL=${EMAIL}`,
    `${prefix}_REVIEW_PASSWORD=${password}`,
    `${prefix}_REVIEW_UPDATED=${new Date().toISOString().slice(0, 10)}`,
  ];
  writeFileSync(credentialsFile, `${lines.join('\n')}\n`, { mode: 0o600 });
}

async function main() {
  if (target === 'prod') {
    const rl = createInterface({ input: process.stdin, output: process.stdout });
    const answer = await rl.question(`${reset ? 'Zmienić hasło konta' : 'Założyć konto'} ${EMAIL} na PRODUKCJI? [t/N] `);
    rl.close();
    if (!/^[tTyY]$/.test(answer.trim())) {
      console.log('Przerwano.');
      return;
    }
  }

  console.log(`→ Pobieram dane Supabase (${target}) z Vercel…`);
  const supabase = pullSupabaseEnv();
  const password = generatePassword();

  if (reset) {
    const id = await findUserId(supabase);
    if (!id) throw new Error(`Nie ma konta ${EMAIL} na ${target}. Uruchom bez --reset.`);
    const { ok, body } = await admin(supabase, `/users/${id}`, {
      method: 'PUT',
      body: JSON.stringify({ password, email_confirm: true }),
    });
    if (!ok) throw new Error(`Nie udało się zmienić hasła: ${JSON.stringify(body)}`);
  } else {
    const { ok, status, body } = await admin(supabase, '/users', {
      method: 'POST',
      body: JSON.stringify({
        email: EMAIL,
        password,
        email_confirm: true,
        user_metadata: { display_name: DISPLAY_NAME, locale: LOCALE, terms_version: TERMS_VERSION },
      }),
    });
    if (!ok) {
      if (status === 422 || body?.error_code === 'email_exists') {
        throw new Error(`Konto ${EMAIL} już istnieje na ${target}. Nowe hasło: dodaj --reset.`);
      }
      throw new Error(`Nie udało się założyć konta (${status}): ${JSON.stringify(body)}`);
    }
  }

  saveCredentials(password);
  console.log(`✓ Gotowe (${target}).`);
  console.log(`  E-mail: ${EMAIL}`);
  console.log(`  Hasło:  ${password}`);
  console.log(`  Zapisane w ${credentialsFile}`);
}

main().catch((e) => {
  console.error(`✗ ${e.message}`);
  process.exit(1);
});
