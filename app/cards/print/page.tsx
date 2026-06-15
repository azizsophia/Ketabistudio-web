import CardFace from "@/components/cards/CardFace";
import {
  CollectionId,
  findCard,
  frontSlots,
  isArabic,
} from "@/lib/cards";
import { cardsFontVars } from "@/lib/cardsFonts";
import styles from "./print.module.css";

// Standalone, chrome-free print spread for headless capture (Prodigi
// GLOBAL-GRE-FAP-A6 fulfillment). It renders ONE spread at an EXACT pixel size:
// the Prodigi artboard 216 x 154 mm @ 300 DPI = 2551 x 1819 px.
//
// Although the root layout wraps every page in Header / Footer / Splash, this
// page paints a fixed, full-viewport, full-bleed box on top of all of it (paper
// ground, z-index above the chrome), so a headless browser sized to 2551 x 1819
// captures only the spread — no site header/footer is visible.
//
// All card config arrives via URL search params (so the render is fully driven
// by the query string); hence force-dynamic.
//
// TODO (phase 2b): a headless renderer (Playwright/Chromium) will hit this route
// twice per card (face=outside, face=inside), screenshot at 2551 x 1819, and
// feed the two PNGs to lib/prodigi.ts createOrder as the outside/inside assets.

export const dynamic = "force-dynamic";

// We size CardFace so its A6 art fills the panel (incl. bleed) at high res.
// 1290 * 327 / 232 = 1818px tall -> fills the 1819px artboard height; width
// overfills the 1240px trim so the face bleeds to the panel edges.
const FACE_PX = 1290;

const COLLECTION_IDS: CollectionId[] = [
  "arch",
  "field",
  "wash",
  "statement",
  "textile",
  "image",
];

type SearchParams = Record<string, string | string[] | undefined>;

function first(v: string | string[] | undefined): string {
  return Array.isArray(v) ? (v[0] ?? "") : (v ?? "");
}

function asCollectionId(v: string): CollectionId {
  return COLLECTION_IDS.includes(v as CollectionId)
    ? (v as CollectionId)
    : "arch";
}

export default async function CardPrintPage({
  searchParams,
}: {
  searchParams: Promise<SearchParams>;
}) {
  const sp = await searchParams;

  const styleId = asCollectionId(first(sp.style));
  const itemId = first(sp.item) || "eid";
  const name = first(sp.name);
  const showName = first(sp.showName) === "1";
  const customFront = first(sp.customFront);
  const arabicIndex = Number(first(sp.arabicIndex)) || 0;
  const arabicOff = first(sp.arabicOff) === "1";
  const accent = first(sp.accent) || "#b35c3c";
  const message = first(sp.message);
  const sender = first(sp.sender);
  const photo = first(sp.photo) || null;
  const face = first(sp.face) === "inside" ? "inside" : "outside";

  const item = findCard(itemId);

  // Rebuild the front slots exactly as CardMaker does: frontSlots() seeded from
  // the card + choices, then overridden by an optional custom front string.
  const slots = frontSlots(item, {
    showName,
    recipient: name || "you",
    arabicIndex,
    arabicOff,
  });
  const custom = customFront.trim();
  if (custom) {
    slots.bigText = custom;
    slots.bigArabic = isArabic(custom);
    slots.translit = "";
  }

  // Right-hand panel is the live face; left-hand panel is back (outside) or
  // blank (inside).
  const rightFace =
    face === "outside" ? (
      <CardFace
        styleId={styleId}
        accent={accent}
        px={FACE_PX}
        face="front"
        slots={slots}
        photoUrl={photo}
      />
    ) : (
      <CardFace
        styleId={styleId}
        accent={accent}
        px={FACE_PX}
        face="inside"
        message={message}
        sender={sender}
        eyebrow={item.eyebrow}
      />
    );

  const leftPanel =
    face === "outside" ? (
      <div className={styles.backPanel}>
        <div className={styles.wordmark}>Ketabi Studio</div>
        <div className={styles.wordmarkSub}>Made with intention</div>
        <div className={styles.goldRule} />
      </div>
    ) : (
      <div className={styles.blankPanel} />
    );

  return (
    <div
      className={cardsFontVars}
      style={{
        position: "fixed",
        inset: 0,
        zIndex: 99999,
        margin: 0,
        padding: 0,
        background: "#f7efe2",
        overflow: "hidden",
      }}
    >
      <div className={styles.board}>
        <div className={styles.panel}>{leftPanel}</div>
        <div className={styles.panel}>
          <div className={styles.faceFill}>{rightFace}</div>
        </div>
      </div>
    </div>
  );
}
