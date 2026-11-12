import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { LegalPage } from "@/components/legal/legal-page";
import { legalPath } from "@/lib/content";
import { privacyEn } from "@/lib/legal/privacy-en";

export const metadata: Metadata = {
  title: `${privacyEn.title} – Aloha App`,
  alternates: {
    canonical: legalPath.privacy.en,
    languages: { pl: legalPath.privacy.pl, en: legalPath.privacy.en },
  },
};

export default async function Page({ params }: PageProps<"/[lang]/privacy">) {
  const { lang } = await params;
  // Ten adres istnieje tylko w jednym języku; drugi ma własną ścieżkę (legalPath).
  if (lang !== "en") notFound();
  return <LegalPage lang="en" doc="privacy" document={privacyEn} />;
}
