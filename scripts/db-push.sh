#!/usr/bin/env bash
# Ręczne wgranie migracji z supabase/migrations na staging lub prod.
# Zwykle niepotrzebne: po merge do gałęzi dev staging aktualizuje GitHub Actions
# (.github/workflows/db-migrations.yml). Skrypt zostaje na awarie i do sprawdzania (--dry-run).
#
#   pnpm db:push:staging
#   pnpm db:push:prod
#   scripts/db-push.sh staging --dry-run   # tylko pokaż, co zostałoby wgrane

set -euo pipefail

target="${1:-}"
shift || true
case "$target" in
  staging | prod) ;;
  *) echo "Użycie: scripts/db-push.sh staging|prod [--dry-run]" >&2; exit 1 ;;
esac

root="$(cd "$(dirname "$0")/.." && pwd)"
# shellcheck source=lib/vercel-db-url.sh
. "$root/scripts/lib/vercel-db-url.sh"

echo "→ Pobieram adres bazy (${target}) z Vercel…"
vercel_db_url "$target"

if [ "$target" = prod ] && [[ " $* " != *" --dry-run "* ]]; then
  read -r -p "Wgrać migracje na PRODUKCJĘ? [t/N] " answer
  [[ "$answer" =~ ^[tTyY]$ ]] || { echo "Przerwano."; exit 1; }
fi

echo "→ Wgrywam migracje na ${target}…"
cd "$root"
npx supabase db push --remote="$db_url" "$@"
echo "✓ Gotowe (${target})."
