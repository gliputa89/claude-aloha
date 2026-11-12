import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { LegalPage } from "@/components/legal/legal-page";
import { legalPath } from "@/lib/content";
import { termsPl } from "@/lib/legal/terms-pl";

export const metadata: Metadata = {
  title: `${termsPl.title} – Aloha App`,
  alternates: {
    canonical: legalPath.terms.pl,
    languages: { pl: legalPath.terms.pl, en: legalPath.terms.en },
  },
};

export default async function Page({ params }: PageProps<"/[lang]/regulamin">) {
  const { lang } = await params;
  // Ten adres istnieje tylko w jednym języku; drugi ma własną ścieżkę (legalPath).
  if (lang !== "pl") notFound();
  return <LegalPage lang="pl" doc="terms" document={termsPl} />;
}
