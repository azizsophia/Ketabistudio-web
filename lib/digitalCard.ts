/* Shared metadata for the digital card's design options (motif + colour
   scheme), used by the builder, the order API, and the viewer so everything
   stays in sync. */

export const MOTIFS = [
  { key: "crescent", label: "Moon" },
  { key: "arch", label: "Arch" },
  { key: "rings", label: "Rings" },
  { key: "lantern", label: "Lantern" },
  { key: "rose", label: "Rose" },
] as const;

export const MOTIF_KEYS: string[] = MOTIFS.map((m) => m.key);

export const SCHEMES = [
  { key: "midnight", label: "Midnight", dot: "#1f3550" },
  { key: "plum", label: "Plum", dot: "#3a2350" },
  { key: "forest", label: "Forest", dot: "#1d4030" },
  { key: "light", label: "Light", dot: "#e7dcc4" },
] as const;

export const SCHEME_KEYS: string[] = SCHEMES.map((s) => s.key);

/* A sensible default motif per card, so the buyer starts from something
   fitting and can change it. */
export const DEFAULT_MOTIF: Record<string, string> = {
  eid: "crescent",
  ramadan: "lantern",
  nikah: "rings",
  baby: "crescent",
  birthday: "crescent",
  thanks: "rose",
  getwell: "rose",
  wife: "rings",
  husband: "rings",
  mum: "rose",
  dad: "crescent",
  friend: "rose",
};

export function defaultMotif(cardId: string): string {
  return DEFAULT_MOTIF[cardId] || "crescent";
}

/* Cover-card colours per scheme — kept in sync with the viewer's CSS so the
   builder preview matches the delivered card. */
export type SchemeStyle = {
  coverBg: string;
  border: string;
  name: string;
  eyebrow: string;
  gold: string;
  rule: string;
  hint: string;
};

export const SCHEME_STYLE: Record<string, SchemeStyle> = {
  midnight: {
    coverBg:
      "radial-gradient(120% 80% at 50% 12%, #234455 0%, #182a3e 46%, #111c2c 100%)",
    border: "rgba(201,168,106,0.34)",
    name: "#f4eddd",
    eyebrow: "rgba(214,180,110,0.92)",
    gold: "#d6b46e",
    rule: "rgba(214,180,110,0.55)",
    hint: "rgba(239,231,216,0.7)",
  },
  plum: {
    coverBg:
      "radial-gradient(120% 80% at 50% 12%, #4a3357 0%, #2c1d3c 46%, #180f24 100%)",
    border: "rgba(201,168,106,0.34)",
    name: "#f4eddd",
    eyebrow: "rgba(214,180,110,0.92)",
    gold: "#d6b46e",
    rule: "rgba(214,180,110,0.55)",
    hint: "rgba(239,231,216,0.7)",
  },
  forest: {
    coverBg:
      "radial-gradient(120% 80% at 50% 12%, #2d4d3b 0%, #1b3327 46%, #0e1c14 100%)",
    border: "rgba(201,168,106,0.34)",
    name: "#f4eddd",
    eyebrow: "rgba(214,180,110,0.92)",
    gold: "#d6b46e",
    rule: "rgba(214,180,110,0.55)",
    hint: "rgba(239,231,216,0.7)",
  },
  light: {
    coverBg: "linear-gradient(165deg, #fcf8ef 0%, #efe5d2 100%)",
    border: "rgba(176,142,66,0.42)",
    name: "#2a2a32",
    eyebrow: "rgba(150,118,52,0.95)",
    gold: "#b08e42",
    rule: "rgba(176,142,66,0.5)",
    hint: "rgba(70,64,54,0.66)",
  },
};

export function schemeStyle(scheme: string): SchemeStyle {
  return SCHEME_STYLE[scheme] || SCHEME_STYLE.midnight;
}

/* Flat gradients for the share-preview (OG) image. Satori — which renders the
   1200×630 card — supports linear-gradient but not the radial cover gradients
   above, so these are a deliberately simple, legible equivalent per scheme. */
export const SCHEME_OG: Record<
  string,
  { bg: string; name: string; eyebrow: string; gold: string; hint: string }
> = {
  midnight: {
    bg: "linear-gradient(150deg, #234455 0%, #182a3e 52%, #101a29 100%)",
    name: "#f4eddd",
    eyebrow: "#d6b46e",
    gold: "#d6b46e",
    hint: "rgba(239,231,216,0.72)",
  },
  plum: {
    bg: "linear-gradient(150deg, #4a3357 0%, #2c1d3c 52%, #160e22 100%)",
    name: "#f4eddd",
    eyebrow: "#d6b46e",
    gold: "#d6b46e",
    hint: "rgba(239,231,216,0.72)",
  },
  forest: {
    bg: "linear-gradient(150deg, #2d4d3b 0%, #1b3327 52%, #0d1a13 100%)",
    name: "#f4eddd",
    eyebrow: "#d6b46e",
    gold: "#d6b46e",
    hint: "rgba(239,231,216,0.72)",
  },
  light: {
    bg: "linear-gradient(150deg, #fcf8ef 0%, #efe5d2 100%)",
    name: "#2a2a32",
    eyebrow: "#b08e42",
    gold: "#b08e42",
    hint: "rgba(70,64,54,0.7)",
  },
};

export function schemeOg(scheme: string) {
  return SCHEME_OG[scheme] || SCHEME_OG.midnight;
}

/* The occasion phrased as a noun for the link-preview + email titles, e.g.
   "an Eid card". Relationship cards stay simply "a card". */
const OCCASION_PHRASE: Record<string, string> = {
  eid: "an Eid card",
  nikah: "a Nikah card",
  baby: "a New Baby card",
  ramadan: "a Ramadan card",
  birthday: "a Birthday card",
  thanks: "a Thank You card",
  getwell: "a Get Well card",
};

export function occasionPhrase(itemId: string): string {
  return OCCASION_PHRASE[itemId] || "a card";
}

/* The line that headlines the share preview + notification email. */
export function cardHeadline(itemId: string, recipientName?: string): string {
  const phrase = occasionPhrase(itemId);
  const to = recipientName?.trim();
  return to
    ? `${to}, you've received ${phrase} 🌙`
    : `You've received ${phrase} 🌙`;
}
