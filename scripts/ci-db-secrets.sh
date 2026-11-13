#!/usr/bin/env bash
# Jednorazowa konfiguracja automatycznych migracji w GitHub Actions.
# Zakłada w repo środowiska GitHub `staging` i `production` i zapisuje w każdym sekret DB_URL
# (adres bazy z Vercel). Wartości nie są nigdzie wypisywane.
# Uruchom ponownie tylko wtedy, gdy zmieni się hasło do bazy.
#
#   pnpm db:ci-setup

set -euo pipefail

root="$(cd "$(dirname "$0")/.." && pwd)"
# shellcheck source=lib/vercel-db-url.sh
. "$root/scripts/lib/vercel-db-url.sh"

command -v gh >/dev/null || { echo "Brak GitHub CLI (gh). Zainstaluj: brew install gh" >&2; exit 1; }
repo="$(cd "$root" && gh repo view --json nameWithOwner -q .nameWithOwner)"

for pair in staging:staging prod:production; do
  target="${pair%%:*}"
  gh_env="${pair##*:}"

  echo "→ ${gh_env}: pobieram adres bazy z Vercel…"
  vercel_db_url "$target"

  gh api --method PUT "repos/${repo}/environments/${gh_env}" >/dev/null
  printf '%s' "$db_url" | gh secret set DB_URL --env "$gh_env" --repo "$repo"
  unset db_url
  echo "✓ ${gh_env}: sekret DB_URL zapisany."
done

echo
echo "Gotowe. Staging aktualizuje się sam po merge migracji do gałęzi dev."
echo "Produkcję wgrywasz ręcznie: GitHub → Actions → „Migracje bazy” → Run workflow → production."
