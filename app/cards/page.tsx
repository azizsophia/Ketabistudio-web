import type { Metadata } from "next";
import CardMaker from "@/components/cards/CardMaker";
import { cardsFontVars } from "@/lib/cardsFonts";

export const metadata: Metadata = {
  title: "Card Studio — Personalised Islamic greeting cards",
  description:
    "Design a personalised, luxury Islamic greeting card. Choose a collection, personalise the wording, colour and message, and we post it directly to your recipient.",
};

export default function CardsPage() {
  // The card-maker fonts (Cormorant Garamond, Reem Kufi, Jost) are exposed as
  // CSS variables on this wrapper only, so the rest of the site's typography is
  // untouched. Amiri arrives via --font-arabic from the root layout.
  return (
    <div className={cardsFontVars}>
      <CardMaker />
    </div>
  );
}
