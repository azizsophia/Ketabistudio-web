import type { Metadata } from "next";
import CardMaker from "@/components/cards/CardMaker";
import { cardsFontVars } from "@/lib/cardsFonts";

export const metadata: Metadata = {
  title: "Card Studio — Personalised Islamic greeting cards",
  description:
    "Design a personalised, beautifully crafted Islamic greeting card. Choose a collection, personalise the wording, colour and message, and we post it directly to your recipient.",
};

export default function CardsPage() {
  // The card-maker fonts (Cormorant Garamond, Reem Kufi, Jost) are exposed as
  // CSS variables on this wrapper only, so the rest of the site's typography is
  // untouched. Amiri arrives via --font-arabic from the root layout.
  return (
    <div className={cardsFontVars}>
      <div
        style={{
          background: "#262320",
          color: "#f4f0e7",
          textAlign: "center",
          font: "500 0.82rem/1.5 var(--cards-ui, system-ui), sans-serif",
          letterSpacing: "0.02em",
          padding: "10px 16px",
        }}
      >
        Sneak peek — the Card Studio is still in the works. Have a play; ordering
        opens soon, in shaa Allah.
      </div>
      <CardMaker />
    </div>
  );
}
