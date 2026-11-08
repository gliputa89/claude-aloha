# Wspólna funkcja dla skryptów bazy (source, nie uruchamiać).
# Pobiera adres bazy z Vercel (projekt aloha-web, zmienne integracji Supabase) do zmiennej `db_url`,
# niczego nie wypisując. Plik z pobranymi zmiennymi trafia do katalogu tymczasowego i od razu znika.
#
#   vercel_db_url staging|prod

vercel_db_url() {
  local target="$1" vercel_env tmp
  case "$target" in
    staging) vercel_env=development ;;
    prod) vercel_env=production ;;
    *) echo "Nieznane środowisko: ${target} (staging|prod)" >&2; return 1 ;;
  esac

  tmp="$(mktemp -d)"
  if ! (cd "$tmp" && vercel link --yes --project aloha-web >/dev/null 2>&1 \
    && vercel env pull "$tmp/.env" --environment="$vercel_env" --yes >/dev/null 2>&1); then
    rm -rf "$tmp"
    echo "Nie udało się pobrać zmiennych z Vercel. Zaloguj się: vercel login" >&2
    return 1
  fi

  db_url="$(grep -E '^POSTGRES_URL_NON_POOLING=' "$tmp/.env" | head -1 | cut -d= -f2- | sed 's/^"//; s/"$//')"
  rm -rf "$tmp"

  if [ -z "$db_url" ]; then
    echo "Brak POSTGRES_URL_NON_POOLING w zmiennych Vercel (${vercel_env})." >&2
    return 1
  fi
}
