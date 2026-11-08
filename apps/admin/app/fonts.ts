import { Plus_Jakarta_Sans } from "next/font/google";

// Nazwa zmiennej musi zgadzać się z packages/design-system (--font-body-loaded).
// Kierunek „Laguna”: jeden krój na nagłówki i tekst, więc display korzysta z tej samej zmiennej.
export const body = Plus_Jakarta_Sans({
  subsets: ["latin", "latin-ext"],
  weight: ["400", "500", "600", "700", "800"],
  variable: "--font-body-loaded",
});
