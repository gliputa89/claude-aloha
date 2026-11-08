import type { Metadata } from "next";
import { body } from "./fonts";
import "./globals.css";

export const metadata: Metadata = {
  title: "Aloha Training – plan biegowy, który pyta, jak się czujesz",
  description:
    "Plan biegowy, który dopasowuje się do Twojego życia – a nie odwrotnie. Dla zapracowanych amatorów.",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="pl" className={`${body.variable} h-full antialiased`}>
      <body className="min-h-full flex flex-col">{children}</body>
    </html>
  );
}
