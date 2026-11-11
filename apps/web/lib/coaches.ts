import { cacheLife } from "next/cache";
import type { Locale } from "./content";

export type Coach = {
  id: string;
  name: string;
  title: string | null;
  headline: string;
  specialties: string[];
  years: number | null;
  city: string | null;
  photo: string | null;
  isDemo: boolean;
};

type Row = {
  id: string;
  display_name: string;
  title: string | null;
  title_en: string | null;
  headline: string | null;
  headline_en: string | null;
  specialties: string[];
  specialties_en: string[];
  experience_years: number | null;
  city: string | null;
  avatar_url: string | null;
  is_demo: boolean;
};

/**
 * Profile trenerów-ludzi z bazy (publiczny odczyt kluczem anon).
 * Pokazujemy tylko uzupełnione profile (z jednym zdaniem o trenerze) – konta testowe go nie mają.
 * Profile przykładowe (is_demo: zmyślone dane, zdjęcia ze stocku) nie trafiają na produkcję:
 * widać je tylko lokalnie albo z SHOW_DEMO_COACHES=1, zawsze z etykietą.
 */
export async function getCoaches(locale: Locale): Promise<Coach[]> {
  "use cache";
  cacheLife("hours");

  const url = process.env.NEXT_PUBLIC_SUPABASE_URL ?? process.env.SUPABASE_URL;
  const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ?? process.env.SUPABASE_ANON_KEY;
  if (!url || !key) return [];

  const showDemo = process.env.NODE_ENV !== "production" || process.env.SHOW_DEMO_COACHES === "1";
  const query = new URLSearchParams({
    select:
      "id,display_name,title,title_en,headline,headline_en,specialties,specialties_en,experience_years,city,avatar_url,is_demo",
    kind: "eq.human",
    active: "eq.true",
    headline: "not.is.null",
    order: "sort_order",
  });
  if (!showDemo) query.set("is_demo", "eq.false");

  try {
    const response = await fetch(`${url}/rest/v1/coaches?${query}`, {
      headers: { apikey: key, Authorization: `Bearer ${key}` },
    });
    if (!response.ok) return [];
    const rows = (await response.json()) as Row[];
    const en = locale === "en";
    return rows.map((row) => ({
      id: row.id,
      name: row.display_name,
      title: (en && row.title_en) || row.title,
      headline: (en && row.headline_en) || row.headline || "",
      specialties: en && row.specialties_en.length ? row.specialties_en : row.specialties,
      years: row.experience_years,
      city: row.city,
      photo: row.avatar_url,
      isDemo: row.is_demo,
    }));
  } catch {
    return [];
  }
}
