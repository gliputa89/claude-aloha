import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { LegalPage } from "@/components/legal/legal-page";
import { legalPath } from "@/lib/content";
import { termsEn } from "@/lib/legal/terms-en";

export const metadata: Metadata = {
  title: `${termsEn.title} – Aloha App`,
  alternates: {
    canonical: legalPath.terms.en,
    languages: { pl: legalPath.terms.pl, en: legalPath.terms.en },
  },
};

export default async function Page({ params }: PageProps<"/[lang]/terms">) {
  const { lang } = await params;
  // Ten adres istnieje tylko w jednym języku; drugi ma własną ścieżkę (legalPath).
  if (lang !== "en") notFound();
  return <LegalPage lang="en" doc="terms" document={termsEn} />;
}
