import type { Metadata } from "next";
import {
  Fraunces,
  Plus_Jakarta_Sans,
  Amiri,
  Cormorant,
  Playfair_Display,
  Baloo_Bhaijaan_2,
} from "next/font/google";
import "./globals.css";
import { Analytics } from "@vercel/analytics/next";
import { SiteHeader, SiteFooter } from "@/components/SiteChrome";

const fraunces = Fraunces({
  subsets: ["latin"],
  variable: "--font-display",
  axes: ["opsz", "SOFT"],
});

const jakarta = Plus_Jakarta_Sans({
  subsets: ["latin"],
  variable: "--font-body",
});

const amiri = Amiri({
  weight: ["400", "700"],
  subsets: ["arabic"],
  variable: "--font-arabic",
});

/* Matches the keepsake PRINT typography (the worker renders pages in
   Cormorant) so the on-screen live preview reads like the printed book. */
const cormorant = Cormorant({
  subsets: ["latin"],
  style: ["normal", "italic"],
  weight: ["400", "500", "600"],
  variable: "--font-cormorant",
});

/* Premium display face for keepsake titles/cover — matches the print pipeline
   (Playfair Display). */
const playfair = Playfair_Display({
  subsets: ["latin"],
  style: ["normal", "italic"],
  weight: ["400", "500", "600"],
  variable: "--font-playfair",
});

const baloo = Baloo_Bhaijaan_2({
  subsets: ["arabic", "latin"],
  weight: ["600", "700", "800"],
  variable: "--font-baloo",
});

export const metadata: Metadata = {
  metadataBase: new URL("https://www.ketabistudio.com"),
  title: {
    default: "Ketabi Studio — Stories that help little hearts grow",
    template: "%s — Ketabi Studio",
  },
  description:
    "Personalized Islamic storybooks, a mindful dhikr app, and a kids corner full of wonder. Made with intention by Ketabi Studio.",
  openGraph: {
    title: "Ketabi Studio",
    description:
      "Personalized Islamic storybooks, a mindful dhikr app, and a kids corner full of wonder.",
    url: "https://www.ketabistudio.com",
    siteName: "Ketabi Studio",
    type: "website",
  },
};

export default function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en">
      <body
        className={`${fraunces.variable} ${jakarta.variable} ${amiri.variable} ${cormorant.variable} ${playfair.variable} ${baloo.variable}`}
      >
        <SiteHeader />
        <main>{children}</main>
        <SiteFooter />
        <Analytics />
      </body>
    </html>
  );
}
