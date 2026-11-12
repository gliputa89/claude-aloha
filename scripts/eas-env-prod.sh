#!/usr/bin/env bash
# Ustawia zmienne EXPO_PUBLIC_* w EAS (środowisko „production”) dla buildów do sklepów.
# Adres i klucz anon Supabase bierze z Vercel (projekt aloha-web, środowisko production) – tak jak db-push i review-user.
# Google Web Client ID bierze z apps/mobile/.env.local (ten sam projekt Google Cloud dla stagingu i produkcji).
# Wartości nie są wypisywane. Klucz anon jest publiczny (i tak trafia do aplikacji), więc zapisujemy go jako „plaintext”.
#
#   scripts/eas-env-prod.sh
#
# Wymaga: `vercel login` oraz `npx eas-cli login` (konto z dostępem do projektu @posadzimy/aloha-training).

set -euo pipefail

root="$(cd "$(dirname "$0")/.." && pwd)"
mobile="$root/apps/mobile"
tmp="$(mktemp -d)"
trap 'rm -rf "$tmp"' EXIT

echo "→ Pobieram zmienne production z Vercel…"
(cd "$tmp" && vercel link --yes --project aloha-web >/dev/null 2>&1 \
  && vercel env pull "$tmp/.env" --environment=production --yes >/dev/null 2>&1) \
  || { echo "Nie udało się pobrać zmiennych z Vercel. Zaloguj się: vercel login" >&2; exit 1; }

get() { grep -E "^$1=" "$2" | head -1 | cut -d= -f2- | sed 's/^"//; s/"$//'; }

supabase_url="$(get NEXT_PUBLIC_SUPABASE_URL "$tmp/.env")"
supabase_anon="$(get NEXT_PUBLIC_SUPABASE_ANON_KEY "$tmp/.env")"
google_web="$(get EXPO_PUBLIC_GOOGLE_WEB_CLIENT_ID "$mobile/.env.local" || true)"
google_ios="$(get EXPO_PUBLIC_GOOGLE_IOS_CLIENT_ID "$mobile/.env.local" || true)"
site_url="https://www.alohatraining.app"

[ -n "$supabase_url" ] && [ -n "$supabase_anon" ] || { echo "Brak NEXT_PUBLIC_SUPABASE_URL / _ANON_KEY w Vercel (production)." >&2; exit 1; }
echo "  Supabase (prod): ${supabase_url%%.supabase.co*}.supabase.co"

read -r -p "Ustawić te zmienne w EAS (production)? [t/N] " answer
[[ "$answer" =~ ^[tTyY]$ ]] || { echo "Przerwano."; exit 1; }

set_var() {
  local name="$1" value="$2"
  [ -n "$value" ] || { echo "  – pomijam $name (brak wartości)"; return; }
  (cd "$mobile" && npx --yes eas-cli@latest env:set production \
    --name "$name" --value "$value" --visibility plaintext --non-interactive >/dev/null)
  echo "  ✓ $name"
}

set_var EXPO_PUBLIC_SUPABASE_URL "$supabase_url"
set_var EXPO_PUBLIC_SUPABASE_ANON_KEY "$supabase_anon"
set_var EXPO_PUBLIC_GOOGLE_WEB_CLIENT_ID "$google_web"
set_var EXPO_PUBLIC_GOOGLE_IOS_CLIENT_ID "$google_ios"
set_var EXPO_PUBLIC_SITE_URL "$site_url"

echo "✓ Gotowe. Sprawdź: (cd apps/mobile && npx eas-cli env:list production --format short)"
