import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { LegalPage } from "@/components/legal/legal-page";
import { legalPath } from "@/lib/content";
import { privacyPl } from "@/lib/legal/privacy-pl";

export const metadata: Metadata = {
  title: `${privacyPl.title} – Aloha App`,
  alternates: {
    canonical: legalPath.privacy.pl,
    languages: { pl: legalPath.privacy.pl, en: legalPath.privacy.en },
  },
};

export default async function Page({ params }: PageProps<"/[lang]/polityka-prywatnosci">) {
  const { lang } = await params;
  // Ten adres istnieje tylko w jednym języku; drugi ma własną ścieżkę (legalPath).
  if (lang !== "pl") notFound();
  return <LegalPage lang="pl" doc="privacy" document={privacyPl} />;
}
