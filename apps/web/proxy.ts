import { NextResponse, type NextRequest } from "next/server";

// Polska wersja jest pod adresem głównym, angielska pod /en (tak linkuje aplikacja mobilna).
// Strony leżą w app/[lang], więc adresy bez prefiksu przepisujemy wewnętrznie na /pl.
export function proxy(request: NextRequest) {
  const url = request.nextUrl.clone();
  const { pathname } = url;

  if (pathname === "/en" || pathname.startsWith("/en/")) return;

  if (pathname === "/pl" || pathname.startsWith("/pl/")) {
    url.pathname = pathname.slice(3) || "/";
    return NextResponse.redirect(url);
  }

  url.pathname = pathname === "/" ? "/pl" : `/pl${pathname}`;
  return NextResponse.rewrite(url);
}

export const config = {
  // Pomijamy pliki Next.js i wszystko z rozszerzeniem (media, ikony).
  matcher: ["/((?!_next|.*\\..*).*)"],
};
