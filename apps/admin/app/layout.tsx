import type { Metadata } from "next";
import { body, display } from "./fonts";
import "./globals.css";

export const metadata: Metadata = {
  title: "Aloha – panel",
  robots: { index: false, follow: false },
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="pl" className={`${display.variable} ${body.variable} h-full antialiased`}>
      <body className="min-h-full flex flex-col">{children}</body>
    </html>
  );
}
