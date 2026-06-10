/**
 * KETABI BOOKS — single source of truth.
 *
 * Each entry mirrors the real production pipeline for that title.
 * The order orchestrator consumes exactly these fields, so web and
 * print can never drift apart.
 */

export type Skin = "light" | "medium" | "dark";
export type Hair = "black" | "brown" | "blonde" | "red";

/**
 * Web choices → PSD variant groups (modesty_pipeline.set_variant args).
 * set_variant(psd, SKIN_TO_PSD[skin], HAIR_TO_PSD[hair], HAIR_STYLE_DEFAULT)
 */
export const SKIN_TO_PSD: Record<Skin, string> = {
  light: "Blonde light",
  medium: "Blonde dark",
  dark: "Dark",
};

export const HAIR_TO_PSD: Record<Hair, string> = {
  black: "Black",
  brown: "Brown",
  blonde: "Blonde",
  red: "Red",
};

/** Hair styles exist in the PSDs (Short/Long x Curly/Straight); v1 fixes this. */
export const HAIR_STYLE_DEFAULT = "Long straight";

/** Shared Lulu print spec — identical for all three titles (validated). */
export const PRINT_SPEC = {
  podPackageId: "0850X0850.FC.PRE.PB.080CW444.MXX",
  pages: 32,
  trim: '8.5" × 8.5"',
  binding: "Perfect bound",
  paper: "Premium color, 80# coated white",
  cover: "Matte softcover",
  shipsFrom: "Printed to order in the USA",
} as const;

export type Book = {
  slug: string;
  title: string;
  /** Cover-title template; {name} is replaced at order time (personalized only). */
  printTitle: string;
  tag: string;
  value: string;
  blurb: string;
  description: string;
  cover: string;
  spine: string;
  previews: { src: string; caption: string }[];
  personalization:
    | {
        type: "personalized";
        pipeline: "modesty_pipeline";
        fields: { name: { min: 1; max: 14 }; skin: Skin[]; hair: Hair[] };
        appearsOn: string[];
      }
    | {
        type: "fixed";
        pipeline: "juha_pipeline" | "kind_pipeline";
        appearsOn: string[];
      };
};

export const BOOKS: Book[] = [
  {
    slug: "her-beautiful-hijab",
    title: "Your Daughter & Her Beautiful Hijab",
    printTitle: "{name} and Her Beautiful Hijab",
    tag: "Personalized",
    value: "Modesty, confidence, and loving the hijab",
    blurb:
      "A personalized keepsake — her name on the cover and woven through every page.",
    description:
      "Type her name and choose her look, and we print a one-of-a-kind book where she is the star: on the cover, the dedication, and her very own bookplate. A gentle story about wearing the hijab with joy.",
    cover: "/images/book-amira.jpg",
    spine: "#e8b4a6",
    previews: [
      { src: "/images/preview-amira-5.jpg", caption: "Her story begins" },
      { src: "/images/preview-amira-8.jpg", caption: "Inside the book" },
      { src: "/images/preview-amira-12.jpg", caption: "Every page, hers" },
    ],
    personalization: {
      type: "personalized",
      pipeline: "modesty_pipeline",
      fields: {
        name: { min: 1, max: 14 },
        skin: ["light", "medium", "dark"],
        hair: ["black", "brown", "blonde", "red"],
      },
      appearsOn: ["Front cover", "Title page", "Dedication", "Bookplate"],
    },
  },
  {
    slug: "juha-and-the-enormous-pumpkin",
    title: "Juha and the Enormous Pumpkin",
    printTitle: "Juha and the Enormous Pumpkin",
    tag: "Folktale",
    value: "Gratitude, humility, and giving",
    blurb: "The beloved folktale retold: giving, humility, and gratitude.",
    description:
      "Juha grows the most enormous pumpkin anyone has ever seen — and gives it away. A warm retelling of the classic folktale, with discussion questions, a glossary of Islamic phrases, and a dua to share.",
    cover: "/images/book-juha.jpg",
    spine: "#d88a2b",
    previews: [
      { src: "/images/preview-juha-5.jpg", caption: "Juha's farm" },
      { src: "/images/preview-juha-8.jpg", caption: "At the palace" },
      { src: "/images/preview-juha-12.jpg", caption: "A lesson in giving" },
    ],
    personalization: {
      type: "fixed",
      pipeline: "juha_pipeline",
      appearsOn: ["Dedication (gift name)", "Bookplate"],
    },
  },
  {
    slug: "maryam-is-kind-to-her-parents",
    title: "Maryam is Kind to Her Parents",
    printTitle: "Maryam is Kind to Her Parents",
    tag: "Values",
    value: "Kindness to parents (birr al-walidayn)",
    blurb: "Little hands can do big things — kindness to Mama and Baba.",
    description:
      "Maryam discovers that little hands can do big things: tidying her toys, helping with the dishes, folding wobbly laundry. A story of kindness to parents, ending with the Quranic dua for Mama and Baba (17:24).",
    cover: "/images/book-maryam.jpg",
    spine: "#78bab2",
    previews: [
      { src: "/images/preview-maryam-5.jpg", caption: "Maryam helps" },
      { src: "/images/preview-maryam-8.jpg", caption: "Splash, splash!" },
      { src: "/images/preview-maryam-12.jpg", caption: "Folding with Baba" },
    ],
    personalization: {
      type: "fixed",
      pipeline: "kind_pipeline",
      appearsOn: ["Bookplate (write-in line)"],
    },
  },
];

export const getBook = (slug: string) => BOOKS.find((b) => b.slug === slug);
