#!/usr/bin/env bash
# Kopiuje packages/plan-engine/src do supabase/functions/_shared/plan-engine,
# żeby Edge Functions (Deno) używały tych samych reguł co aplikacja i testy.
# Kopia jest generowana (w .gitignore) – źródłem prawdy zostaje packages/plan-engine.
#
# Uruchamia ją workflow „Edge Functions” przed deployem; lokalnie przed `supabase functions serve`.

set -euo pipefail

root="$(cd "$(dirname "$0")/.." && pwd)"
src="$root/packages/plan-engine/src"
dest="$root/supabase/functions/_shared/plan-engine"

rm -rf "$dest"
mkdir -p "$dest"
# Źródła leżą w folderach modułów (core, plan, ai, weather, strava, review, coach) – kopiujemy z zachowaniem układu.
(cd "$src" && find . -name '*.ts' ! -name '*.test.ts' -print0 | while IFS= read -r -d '' file; do
  mkdir -p "$dest/$(dirname "$file")"
  cp "$file" "$dest/$file"
done)
echo "✓ plan-engine → supabase/functions/_shared/plan-engine ($(find "$dest" -name '*.ts' | wc -l | tr -d ' ') plików)"
