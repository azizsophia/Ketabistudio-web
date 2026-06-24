// Typed data for the Ketabi greeting-card maker.
// All values (ids, titles, colours, Arabic words, transliterations, duas,
// default messages, prices) are ported verbatim from the high-fidelity
// prototype (src/Ketabi Card Maker.dc.html). Do not auto-translate the
// Arabic: every word here is vetted.

export type CollectionId =
  | "arch"
  | "field"
  | "wash"
  | "statement"
  | "textile"
  | "image";

export interface Collection {
  id: CollectionId;
  name: string;
  tag: string;
}

export interface ArabicWord {
  ar: string;
  translit: string;
}

export interface OccasionCard {
  id: string;
  group: "occasion";
  title: string;
  color: string;
  eyebrow: string;
  en: string;
  words: ArabicWord[];
  dua: string;
  msg: string;
}

export interface RelationshipCard {
  id: string;
  group: "relationship";
  title: string;
  color: string;
  eyebrow: string;
  headlineEn: string;
  word: ArabicWord;
  sub: string;
  dua: string;
  msg: string;
}

export type CardItem = OccasionCard | RelationshipCard;

export interface Paper {
  id: string;
  name: string;
  desc: string;
  short: string;
  price: string;
}

export interface Swatch {
  name: string;
  hex: string;
}

export const COLLECTIONS: Collection[] = [
  {
    id: "arch",
    name: "The Arch",
    tag: "A mihrab arch with a fine keyline and crescent. Serene and architectural.",
  },
  {
    id: "field",
    name: "Colour Field",
    tag: "Solid colour, type reversed in cream. Confident and modern.",
  },
  {
    id: "wash",
    name: "Watercolour",
    tag: "Soft painted washes behind the type. Artful and gentle.",
  },
  {
    id: "statement",
    name: "Statement",
    tag: "Bold colour-blocked typography. Editorial and striking.",
  },
  {
    id: "textile",
    name: "Textile",
    tag: "All-over pattern with a centred cartouche. Rich and layered.",
  },
  {
    id: "image",
    name: "Imagery",
    tag: "A luminous ground with a type panel. Warm and atmospheric.",
  },
];

export const OCCASIONS: OccasionCard[] = [
  {
    id: "eid",
    group: "occasion",
    title: "Eid Mubarak",
    color: "#1f6b5a",
    eyebrow: "Eid Mubarak",
    en: "Blessed Eid",
    words: [
      { ar: "عيد مبارك", translit: "Eid Mubarak" },
      { ar: "عيد سعيد", translit: "Eid Saeed" },
    ],
    dua: "May Allah accept from us and from you.",
    msg: "Wishing you and your family a joyful and blessed Eid. May your home be filled with light, laughter and barakah.",
  },
  {
    id: "nikah",
    group: "occasion",
    title: "Nikah",
    color: "#a85c63",
    eyebrow: "On your Nikah",
    en: "A blessed union",
    words: [{ ar: "مبارك", translit: "Mabrook" }],
    dua: "May Allah bless you both and unite you in goodness.",
    msg: "Congratulations on your Nikah. May Allah fill your marriage with love, mercy and tranquillity, and bless every year ahead.",
  },
  {
    id: "baby",
    group: "occasion",
    title: "New Baby",
    color: "#5a86a8",
    eyebrow: "A new blessing",
    en: "Congratulations",
    words: [{ ar: "مبارك", translit: "Mabrook" }],
    dua: "May Allah make them among the righteous and a coolness to your eyes.",
    msg: "Mabrook on your beautiful new arrival! May Allah make them righteous, healthy and a coolness to your eyes.",
  },
  {
    id: "ramadan",
    group: "occasion",
    title: "Ramadan",
    color: "#1f3a54",
    eyebrow: "Ramadan Kareem",
    en: "A generous Ramadan",
    words: [
      { ar: "رمضان كريم", translit: "Ramadan Kareem" },
      { ar: "رمضان مبارك", translit: "Ramadan Mubarak" },
    ],
    dua: "May this month bring you peace, mercy and barakah.",
    msg: "Ramadan Kareem. May this blessed month bring you closer to Allah, and fill your days with peace and your heart with barakah.",
  },
  {
    id: "birthday",
    group: "occasion",
    title: "Birthday",
    color: "#b35c3c",
    eyebrow: "Birthday wishes",
    en: "Happy Birthday",
    words: [{ ar: "كل عام وأنتم بخير", translit: "Kullu ʿām wa antum bi-khayr" }],
    dua: "May Allah bless your years with health and iman.",
    msg: "Happy Birthday! May Allah bless you with many more years of health, happiness and strong iman.",
  },
  {
    id: "thanks",
    group: "occasion",
    title: "Thank You",
    color: "#a07f4a",
    eyebrow: "Thank you",
    en: "With gratitude",
    words: [{ ar: "شكراً", translit: "Shukran" }],
    dua: "May Allah reward you with all goodness.",
    msg: "Thank you, truly. Your kindness did not go unnoticed. May Allah reward you with all goodness.",
  },
  {
    id: "getwell",
    group: "occasion",
    title: "Get Well",
    color: "#6f8a5c",
    eyebrow: "Shifa",
    en: "Wishing you healing",
    words: [{ ar: "شفاء", translit: "Shifa" }],
    dua: "May Allah grant you a swift and complete recovery.",
    msg: "Thinking of you and making dua for you. May Allah grant you a swift and complete recovery, ameen.",
  },
];

export const RELATIONSHIPS: RelationshipCard[] = [
  {
    id: "wife",
    group: "relationship",
    title: "For My Wife",
    color: "#a85c63",
    eyebrow: "To my wife",
    headlineEn: "You are my sakīnah",
    word: { ar: "سكينة", translit: "Sakeenah" },
    sub: "the calm Allah placed in my heart",
    dua: "May Allah preserve our home in love and mercy.",
    msg: "To the calm in my every storm, thank you for the home and peace you bring. I love you, today and always.",
  },
  {
    id: "husband",
    group: "relationship",
    title: "For My Husband",
    color: "#1f4f54",
    eyebrow: "To my husband",
    headlineEn: "My answered dua",
    word: { ar: "الحمد لله", translit: "Alhamdulillah" },
    sub: "grateful for you, always",
    dua: "May Allah protect you and bless our years together.",
    msg: "Thank you for your patience, your strength and your kindness. Alhamdulillah for you, I am grateful every single day.",
  },
  {
    id: "mum",
    group: "relationship",
    title: "For My Mum",
    color: "#6e4257",
    eyebrow: "To my mother",
    headlineEn: "Heaven beneath her feet",
    word: { ar: "أمي", translit: "Ummī · my mother" },
    sub: "with love and endless dua",
    dua: "May Allah grant you the highest gardens of Jannah.",
    msg: "Thank you for every dua, every sacrifice and every kindness. May Allah reward you with Jannah, I love you, Mum.",
  },
  {
    id: "dad",
    group: "relationship",
    title: "For My Dad",
    color: "#2f5a40",
    eyebrow: "To my father",
    headlineEn: "My first hero",
    word: { ar: "أبي", translit: "Abī · my father" },
    sub: "with love and gratitude",
    dua: "May Allah preserve you and reward your every effort.",
    msg: "Thank you for your strength, your guidance and your quiet sacrifices. May Allah preserve you, I love you, Dad.",
  },
  {
    id: "friend",
    group: "relationship",
    title: "For My Friend",
    color: "#a87a3c",
    eyebrow: "To my friend",
    headlineEn: "A friend for the sake of Allah",
    word: { ar: "محبة في الله", translit: "Maḥabbah fillāh" },
    sub: "grateful for you",
    dua: "May Allah keep us together in this life and the next.",
    msg: "Grateful for a friendship built on something lasting. May Allah keep us close in this life and reunite us in Jannah.",
  },
];

export const CARD_ITEMS: CardItem[] = [...OCCASIONS, ...RELATIONSHIPS];

// Per-card colour options. The FIRST hex of each list is the card's default
// (matches `color` above and the rendered gallery preview). Every value is a
// muted, print-safe sRGB tone that holds in CMYK, so it always prints true and
// keeps the ivory + gold type legible. Baby offers Sky / Rose / Sage so it
// suits a boy, a girl, or neither.
export interface ColorOption {
  name: string;
  hex: string;
}
export const CARD_COLORS: Record<string, ColorOption[]> = {
  eid: [{ name: "Emerald", hex: "#1f6b5a" }, { name: "Midnight", hex: "#1f3a54" }],
  nikah: [{ name: "Rose", hex: "#a85c63" }, { name: "Plum", hex: "#6e4257" }],
  baby: [
    { name: "Sky", hex: "#5a86a8" },
    { name: "Rose", hex: "#b07084" },
    { name: "Sage", hex: "#6f8a5c" },
  ],
  ramadan: [{ name: "Midnight", hex: "#1f3a54" }, { name: "Amethyst", hex: "#3c3461" }],
  birthday: [{ name: "Terracotta", hex: "#b35c3c" }, { name: "Teal", hex: "#2f6f63" }],
  thanks: [{ name: "Brass", hex: "#a07f4a" }, { name: "Eucalyptus", hex: "#4f6b5e" }],
  getwell: [{ name: "Sage", hex: "#6f8a5c" }, { name: "Teal", hex: "#3f6e74" }],
  wife: [{ name: "Rose", hex: "#a85c63" }, { name: "Plum", hex: "#6e4257" }],
  husband: [{ name: "Teal", hex: "#1f4f54" }, { name: "Forest", hex: "#2f4a3a" }],
  mum: [{ name: "Plum", hex: "#6e4257" }, { name: "Chestnut", hex: "#7a4a3a" }],
  dad: [{ name: "Forest", hex: "#2f5a40" }, { name: "Slate", hex: "#2f4a5a" }],
  friend: [{ name: "Amber", hex: "#a87a3c" }, { name: "Eucalyptus", hex: "#4f6b5e" }],
};
export function cardColors(id: string): ColorOption[] {
  return CARD_COLORS[id] || [{ name: "Default", hex: findCard(id).color }];
}

export const PAPERS: Paper[] = [
  {
    id: "mohawk",
    name: "324gsm Mohawk Fine Paper",
    desc: "Uncoated · soft tactile finish",
    short: "324gsm Mohawk",
    price: "$9.00",
  },
  {
    id: "gloss",
    name: "330gsm Fedrigoni Gloss",
    desc: "Pressed · subtle UV varnish",
    short: "330gsm Fedrigoni",
    price: "$9.00",
  },
];

export const SWATCHES: Swatch[] = [
  { name: "Terracotta", hex: "#b35c3c" },
  { name: "Emerald", hex: "#1f6b5a" },
  { name: "Deep Teal", hex: "#1f4f54" },
  { name: "Aubergine", hex: "#5e3a4a" },
  { name: "Brass", hex: "#a07f4a" },
];

// Step order + display names for the progress bar.
export const STEP_ORDER = [
  "styles",
  "gallery",
  "maker",
  "checkout",
  "handoff",
] as const;
export type StepId = (typeof STEP_ORDER)[number];
export const STEP_NAMES: Record<StepId, string> = {
  styles: "Collection",
  gallery: "Card",
  maker: "Personalise",
  checkout: "Deliver",
  handoff: "Print",
};

// Max characters for the inside message (fits the printed inside spread).
export const CARD_MESSAGE_MAX = 300;

// Arabic detection (Arabic Unicode block U+0600..U+06FF).
export const ARABIC_RE = /[؀-ۿ]/;

export function isArabic(text: string): boolean {
  return ARABIC_RE.test(text);
}

// hex -> rgba(...) with alpha, ported from the prototype's hexA helper.
export function hexA(hex: string, alpha: number): string {
  const m = hex.replace("#", "");
  const r = parseInt(m.substring(0, 2), 16);
  const g = parseInt(m.substring(2, 4), 16);
  const b = parseInt(m.substring(4, 6), 16);
  return `rgba(${r},${g},${b},${alpha})`;
}

// The front slots derived from a card + the user's choices.
export interface FrontSlots {
  eyebrow: string;
  bigText: string;
  bigArabic: boolean;
  translit: string;
  line2: string;
  line2Arabic: boolean;
  foot: string;
}

export interface FrontOpts {
  showName?: boolean;
  recipient?: string;
  arabicIndex?: number;
  arabicOff?: boolean;
}

// Build the {eyebrow, bigText, ...} slots for a card (ported from frontSlots()).
export function frontSlots(item: CardItem, opts: FrontOpts = {}): FrontSlots {
  const showName = !!opts.showName;
  const recipient = opts.recipient || "you";
  if (item.group === "occasion") {
    const idx = opts.arabicIndex || 0;
    const arWord =
      !opts.arabicOff && item.words.length && item.words[idx]
        ? item.words[idx]
        : null;
    return {
      eyebrow: item.eyebrow,
      bigText: arWord ? arWord.ar : item.en,
      bigArabic: !!arWord,
      translit: arWord ? arWord.translit : "",
      line2: "",
      line2Arabic: false,
      foot: showName ? `For ${recipient}` : arWord ? item.en : "",
    };
  }
  return {
    eyebrow: item.eyebrow,
    bigText: item.word ? item.word.ar : item.headlineEn,
    bigArabic: !!item.word,
    translit: item.word ? item.word.translit : "",
    line2: item.headlineEn,
    line2Arabic: false,
    foot: showName ? `For ${recipient}` : item.sub,
  };
}

export function findCard(id: string): CardItem {
  return CARD_ITEMS.find((c) => c.id === id) || CARD_ITEMS[0];
}

export function findPaper(id: string): Paper {
  return PAPERS.find((p) => p.id === id) || PAPERS[0];
}

export function findCollection(id: string): Collection {
  return COLLECTIONS.find((c) => c.id === id) || COLLECTIONS[0];
}
