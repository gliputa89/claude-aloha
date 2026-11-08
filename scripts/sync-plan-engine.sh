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
find "$src" -maxdepth 1 -name '*.ts' ! -name '*.test.ts' -exec cp {} "$dest/" \;
echo "✓ plan-engine → supabase/functions/_shared/plan-engine ($(ls "$dest" | wc -l | tr -d ' ') plików)"
