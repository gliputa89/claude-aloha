import Link from "next/link";
import type { ReactNode } from "react";
import { Wordmark } from "@/components/brand";
import { SiteFooter } from "@/components/site-footer";
import { legalPath, localePath, locales, type LegalDoc, type Locale } from "@/lib/content";
import { legalEffective } from "@/lib/legal/operator";

export type LegalSection = { id: string; title: string; body: ReactNode };
export type LegalDocument = { title: string; lead: ReactNode; sections: LegalSection[] };

const labels = {
  pl: { effective: "Obowiązuje od", toc: "Spis treści", switchLabel: "Język", top: "Do góry" },
  en: { effective: "Effective from", toc: "Contents", switchLabel: "Language", top: "Back to top" },
} as const;

/** Układ strony prawnej: nagłówek, spis treści, numerowane sekcje, stopka. */
export function LegalPage({ lang, doc, document }: { lang: Locale; doc: LegalDoc; document: LegalDocument }) {
  const t = labels[lang];
  return (
    <>
      <header className="border-b border-border">
        <div className="mx-auto flex w-full max-w-6xl items-center justify-between gap-4 px-5 py-5 sm:px-8">
          <Link href={localePath(lang)} aria-label="Aloha App">
            <Wordmark />
          </Link>
          <nav aria-label={t.switchLabel} className="flex gap-1 text-sm font-bold">
            {locales.map((code) => (
              <Link
                key={code}
                href={legalPath[doc][code]}
                hrefLang={code}
                aria-current={code === lang ? "page" : undefined}
                className={`rounded-button px-2.5 py-1.5 uppercase ${
                  code === lang ? "bg-surface-brand text-white" : "text-text-muted hover:text-text"
                }`}
              >
                {code}
              </Link>
            ))}
          </nav>
        </div>
      </header>

      <main id="top" className="mx-auto w-full max-w-6xl px-5 py-12 sm:px-8 sm:py-20">
        <div className="max-w-3xl">
          <h1 className="text-4xl font-extrabold tracking-tight text-balance sm:text-6xl sm:leading-[1.02]">
            {document.title}
          </h1>
          <p className="mt-4 text-sm font-semibold text-text-muted">
            {t.effective}: {legalEffective[lang]}
          </p>
          <div className="legal mt-8 text-lg">{document.lead}</div>
        </div>

        <div className="mt-12 grid gap-10 lg:grid-cols-[16rem_minmax(0,1fr)] lg:gap-16">
          <nav aria-label={t.toc} className="lg:sticky lg:top-8 lg:max-h-[calc(100vh-4rem)] lg:self-start lg:overflow-y-auto">
            <p className="text-sm font-bold">{t.toc}</p>
            <ol className="mt-3 space-y-2 text-sm text-text-muted">
              {document.sections.map((section, index) => (
                <li key={section.id} className="flex gap-2">
                  <span className="w-5 shrink-0 tabular-nums">{index + 1}.</span>
                  <a href={`#${section.id}`} className="underline-offset-4 hover:text-text hover:underline">
                    {section.title}
                  </a>
                </li>
              ))}
            </ol>
          </nav>

          <article className="legal max-w-3xl min-w-0">
            {document.sections.map((section, index) => (
              <section key={section.id} id={section.id} aria-labelledby={`${section.id}-title`}>
                <h2 id={`${section.id}-title`}>
                  <span className="tabular-nums text-text-brand">{index + 1}.</span> {section.title}
                </h2>
                {section.body}
              </section>
            ))}
            <p className="mt-12 text-sm">
              <a href="#top">{t.top}</a>
            </p>
          </article>
        </div>
      </main>

      <SiteFooter lang={lang} />
    </>
  );
}
