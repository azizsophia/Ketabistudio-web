// Fonts for the card maker only. Each is exposed as a CSS variable and applied
// via a wrapper class on the /cards route so the rest of the site's typography
// is untouched. Amiri (--font-arabic) is already provided by the root layout.
import { Cormorant_Garamond, Reem_Kufi, Jost } from "next/font/google";

export const cormorant = Cormorant_Garamond({
  subsets: ["latin"],
  weight: ["400", "500", "600"],
  style: ["normal", "italic"],
  variable: "--cards-serif",
});

export const reemKufi = Reem_Kufi({
  subsets: ["arabic"],
  weight: ["400", "500", "600", "700"],
  variable: "--cards-arabic-display",
});

export const jost = Jost({
  subsets: ["latin"],
  weight: ["300", "400", "500", "600"],
  variable: "--cards-ui",
});

// Combined class string for the page wrapper.
export const cardsFontVars = `${cormorant.variable} ${reemKufi.variable} ${jost.variable}`;
