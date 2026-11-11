import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { body } from "../fonts";
import { content, isLocale, localePath, locales } from "@/lib/content";
import "../globals.css";

export function generateStaticParams() {
  return locales.map((lang) => ({ lang }));
}

export async function generateMetadata({ params }: LayoutProps<"/[lang]">): Promise<Metadata> {
  const { lang } = await params;
  if (!isLocale(lang)) return {};
  const { meta } = content[lang];
  return {
    metadataBase: new URL(process.env.NEXT_PUBLIC_SITE_URL ?? "http://localhost:3000"),
    title: meta.title,
    description: meta.description,
    alternates: {
      canonical: localePath(lang),
      languages: { pl: localePath("pl"), en: localePath("en") },
    },
    openGraph: {
      title: meta.title,
      description: meta.description,
      locale: lang === "pl" ? "pl_PL" : "en_GB",
      type: "website",
      images: ["/media/run-park-poster.jpg"],
    },
  };
}

export default async function RootLayout({ children, params }: LayoutProps<"/[lang]">) {
  const { lang } = await params;
  if (!isLocale(lang)) notFound();
  return (
    <html lang={lang} data-theme="light" className={`${body.variable} antialiased`}>
      <body>{children}</body>
    </html>
  );
}
