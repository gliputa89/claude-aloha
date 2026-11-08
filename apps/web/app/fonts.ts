import { Inter, Space_Grotesk } from "next/font/google";

// Nazwy zmiennych muszą zgadzać się z packages/design-system (--font-*-loaded)
export const display = Space_Grotesk({
  subsets: ["latin", "latin-ext"],
  variable: "--font-display-loaded",
});

export const body = Inter({
  subsets: ["latin", "latin-ext"],
  variable: "--font-body-loaded",
});
