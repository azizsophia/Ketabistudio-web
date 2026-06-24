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

export type HairStyle =
  | "long-straight"
  | "long-curly"
  | "short-straight"
  | "short-curly";

export const STYLE_TO_PSD: Record<HairStyle, string> = {
  "long-straight": "Long straight",
  "long-curly": "Long curly",
  "short-straight": "Short straight",
  "short-curly": "Short curly",
};

/** Duas book personalization (pick-by-picture). Internal keys only; the
 * storefront shows pictures + the respectful labels below, never these words. */
export type DuasCharacter = "boy" | "girl" | "hijab";
export type DuasLook = "afro" | "indian" | "white";

export const DUAS_CHARACTER_LABEL: Record<DuasCharacter, string> = {
  boy: "Boy",
  girl: "Girl",
  hijab: "Girl with hijab",
};
export const DUAS_LOOK_LABEL: Record<DuasLook, string> = {
  afro: "Deep skin, curly hair",
  indian: "Medium skin, straight hair",
  white: "Light skin, blonde hair",
};

/** Shared Lulu print spec — identical for all titles (validated). */
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
        fields: {
          name: { min: 1; max: 14 };
          skin: Skin[];
          hair: Hair[];
          hairStyle: HairStyle[];
        };
        appearsOn: string[];
      }
    | {
        type: "personalized";
        pipeline: "duas_pipeline";
        fields: {
          name: { min: 1; max: 14 };
          character: DuasCharacter[];
          look: DuasLook[];
          eyeColor: boolean;
        };
        appearsOn: string[];
      }
    | {
        type: "fixed";
        pipeline: "juha_pipeline" | "kind_pipeline";
        appearsOn: string[];
      };
  /** When true, the book is teased but not yet orderable (storefront + API). */
  comingSoon?: boolean;
  /** When true, the book is fully hidden: not listed anywhere, its detail page
   * 404s, and it cannot be ordered. Reversible — flip back to reveal it. */
  hidden?: boolean;
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
        hairStyle: [
          "long-straight",
          "long-curly",
          "short-straight",
          "short-curly",
        ],
      },
      appearsOn: ["Front cover", "Title page", "Dedication", "Bookplate"],
    },
  },
  {
    slug: "my-beautiful-duas",
    title: "Your Child & Their Beautiful Duas",
    printTitle: "{name}'s Beautiful Duas",
    tag: "Personalized",
    value: "Daily duas, gratitude, and remembrance of Allah",
    blurb:
      "A premium personalized keepsake — your child saying a beautiful dua for every part of their day.",
    description:
      "Choose your child — a boy, a girl, or a girl with hijab — and their look, type their name, and we print a one-of-a-kind book where they are the star. A gentle day of authentic daily duas (Arabic, easy pronunciation, and English), with a Dua Treasure Chest reference and a keepsake star chart.",
    cover: "/images/book-duas.jpg",
    spine: "#c48e34",
    previews: [
      { src: "/images/duas-preview-1.jpg", caption: "A dua for every moment" },
      { src: "/images/duas-preview-2.jpg", caption: "Arabic, pronunciation & meaning" },
      { src: "/images/duas-preview-3.jpg", caption: "A keepsake star chart" },
    ],
    personalization: {
      type: "personalized",
      pipeline: "duas_pipeline",
      fields: {
        name: { min: 1, max: 14 },
        character: ["boy", "girl", "hijab"],
        look: ["afro", "indian", "white"],
        eyeColor: true,
      },
      appearsOn: ["Front cover", "Title page", "Belongs-to page", "Every story page"],
    },
    comingSoon: true,
    hidden: true, // parked: art under review — fully hidden until ready
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
      { src: "/images/preview-juha-5.jpg", caption: "Too special to keep" },
      { src: "/images/preview-juha-8.jpg", caption: "The ruler's reward" },
      { src: "/images/preview-juha-12.jpg", caption: "Riding home grateful" },
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
      { src: "/images/preview-maryam-5.jpg", caption: "Praying as a family" },
      { src: "/images/preview-maryam-8.jpg", caption: "Tidying every toy" },
      { src: "/images/preview-maryam-12.jpg", caption: "Mama's proud smile" },
    ],
    personalization: {
      type: "fixed",
      pipeline: "kind_pipeline",
      appearsOn: ["Bookplate (write-in line)"],
    },
  },
];

export const getBook = (slug: string) => BOOKS.find((b) => b.slug === slug);

/** Books shown in the storefront (hidden ones are parked and excluded). */
export const VISIBLE_BOOKS = BOOKS.filter((b) => !b.hidden);
