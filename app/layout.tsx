import type { Metadata } from "next";
import {
  Plus_Jakarta_Sans,
  Amiri,
  Cormorant,
  Playfair_Display,
  Baloo_Bhaijaan_2,
} from "next/font/google";
import "./globals.css";
import { Analytics } from "@vercel/analytics/next";
import { SiteHeader, SiteFooter } from "@/components/SiteChrome";

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

/* The one display serif for the whole site. Powers both --font-playfair (new
   pages) and --font-display (legacy pages, aliased in globals.css) so there is
   a single serif voice everywhere. Also matches the keepsake print pipeline. */
const playfair = Playfair_Display({
  subsets: ["latin"],
  style: ["normal", "italic"],
  weight: ["400", "500", "600", "700"],
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
    default: "Ketabi Studio, made to be kept",
    template: "%s | Ketabi Studio",
  },
  description:
    "Personalized Islamic storybooks, a 30-day Qur'an journal, digital cards and photo keepsakes. Every one carries a name you love. We ship worldwide.",
  openGraph: {
    title: "Ketabi Studio, made to be kept",
    description:
      "Personalized Islamic storybooks, a 30-day Qur'an journal, digital cards and photo keepsakes.",
    url: "https://www.ketabistudio.com",
    siteName: "Ketabi Studio",
    type: "website",
  },
  twitter: {
    card: "summary_large_image",
    title: "Ketabi Studio, made to be kept",
    description:
      "Personalized Islamic storybooks, a 30-day Qur'an journal, digital cards and photo keepsakes.",
  },
};

export default function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en">
      <body
        className={`${jakarta.variable} ${amiri.variable} ${cormorant.variable} ${playfair.variable} ${baloo.variable}`}
      >
        <SiteHeader />
        <main>{children}</main>
        <SiteFooter />
        <Analytics />
      </body>
    </html>
  );
}
