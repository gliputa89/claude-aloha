import Link from "next/link";
import { Wordmark } from "@/components/brand";
import { content, legalPath, localePath, type Locale } from "@/lib/content";
import { operator } from "@/lib/legal/operator";

/** Stopka wspólna dla strony głównej i stron prawnych. */
export function SiteFooter({ lang }: { lang: Locale }) {
  const t = content[lang].footer;
  return (
    <footer className="border-t border-border">
      <div className={"mx-auto w-full max-w-6xl px-5 py-10 text-sm text-text-muted sm:px-8"}>
        <div className="flex flex-col gap-6 sm:flex-row sm:items-start sm:justify-between">
          <div>
            <Link href={localePath(lang)} aria-label="Aloha App" className="inline-block text-text">
              <Wordmark />
            </Link>
            <p className="mt-3 max-w-md">{t.tagline}</p>
          </div>
          <nav aria-label={t.legalLabel}>
            <ul className="flex flex-col gap-2 font-semibold text-text sm:items-end">
              <li>
                <Link href={legalPath.privacy[lang]} className="underline-offset-4 hover:underline">
                  {t.privacy}
                </Link>
              </li>
              <li>
                <Link href={legalPath.terms[lang]} className="underline-offset-4 hover:underline">
                  {t.terms}
                </Link>
              </li>
            </ul>
          </nav>
        </div>
        <p className="mt-8 border-t border-border pt-6">
          © {2026} {operator.name}, {operator.street}, {operator.city}
        </p>
      </div>
    </footer>
  );
}
