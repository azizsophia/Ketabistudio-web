/**
 * KETABI PHOTO-BOOK KEEPSAKES — template registry (single source of truth).
 *
 * Photo books are ordinary `orders` rows with `book_slug` = a template slug
 * (e.g. "about-mama") plus `photo_data` jsonb. They reuse the existing
 * orders / worker / approval / checkout / email rails — this file only adds
 * the per-template content (title, labels, default captions, the verified
 * dua) shared by the UI and the print worker's intent.
 */

export const PHOTOBOOK_SLUGS = ["about-mama"] as const;
export type PhotobookSlug = (typeof PHOTOBOOK_SLUGS)[number];

export function isPhotobookSlug(slug: string): slug is PhotobookSlug {
  return (PHOTOBOOK_SLUGS as readonly string[]).includes(slug);
}

/** The verified dua printed on the dua page. Render EXACTLY — do not alter a
 *  glyph. Source: Qur'an 17:24. */
export type PhotobookDua = {
  arabic: string;
  translit: string;
  english: string;
  ref: string;
};

export type PhotobookTemplate = {
  slug: PhotobookSlug;
  /** Storefront/product title. */
  title: string;
  /** Field labels shown in the builder. */
  recipientLabel: string;
  authorLabel: string;
  /** Whether the cover has a small framed photo window. */
  coverPhoto: boolean;
  /** Editable default captions — one per photo page (20). */
  defaultCaptions: string[];
  /** Verified dua for the dua page. */
  dua: PhotobookDua;
  /** Short storefront copy. */
  blurb: string;
};

const ABOUT_MAMA: PhotobookTemplate = {
  slug: "about-mama",
  title: "Everything I Love About Mama",
  recipientLabel: "Mama's name",
  authorLabel: "Your name",
  coverPhoto: true,
  defaultCaptions: [
    "Mama, Allah blessed me with you.",
    "You are the first dua Allah answered for me.",
    "You teach me to love Allah.",
    "I love praying right beside you.",
    "Thank you for every duʿā you make for me.",
    "You fill our home with barakah.",
    "Your hugs make everything better.",
    "You read to me until my eyes grow sleepy.",
    "When I'm scared, you remind me Allah is near.",
    "I love the way you say bismillah before everything.",
    "You wipe my tears and make a dua over me.",
    "You're the first to make duʿā when I'm sick.",
    "You celebrate every little thing I learn.",
    "Your kitchen smells like love and good things.",
    "You forgive me before I even finish saying sorry.",
    "You are gentle with me on my hardest days.",
    "Being your child is a gift from Allah.",
    "I want to make you proud, in this life and the next.",
    "I pray we're together in Jannah, always.",
    "I love you more than all the stars, Mama.",
  ],
  // VERIFIED — Qur'an 17:24. Render exactly; the Arabic is shaped RTL by the
  // worker (Amiri, same approach as duas_pipeline).
  dua: {
    arabic: "رَّبِّ ٱرْحَمْهُمَا كَمَا رَبَّيَانِى صَغِيرًا",
    translit: "Rabbi-rḥamhumā kamā rabbayānī ṣaghīrā",
    english:
      "My Lord, have mercy upon them as they raised me when I was small.",
    ref: "Qur'an 17:24",
  },
  blurb:
    "A hardcover keepsake your child fills with their own photos and words — twenty things they love about Mama, sealed with the dua for parents.",
};

export const PHOTOBOOK_TEMPLATES: Record<PhotobookSlug, PhotobookTemplate> = {
  "about-mama": ABOUT_MAMA,
};

export function getPhotobookTemplate(
  slug: string
): PhotobookTemplate | undefined {
  return isPhotobookSlug(slug) ? PHOTOBOOK_TEMPLATES[slug] : undefined;
}

/** Number of customer photo pages (caption + photo) per template. */
export function photobookSpreadCount(slug: PhotobookSlug): number {
  return PHOTOBOOK_TEMPLATES[slug].defaultCaptions.length;
}

/** Shape of orders.photo_data. */
export type PhotobookPage = { photo_url: string; caption: string };
export type PhotobookData = {
  recipient_name: string;
  author_name: string;
  cover_photo_url: string;
  pages: PhotobookPage[];
};

/** The Stripe/receipt product title for a photo-book order. */
export function photobookOrderTitle(
  slug: string,
  recipientName?: string | null
): string {
  if (slug === "about-mama") {
    const r = (recipientName || "").trim();
    return r ? `Everything I Love About ${r}` : "Everything I Love About Mama";
  }
  return getPhotobookTemplate(slug)?.title || "Ketabi Studio Keepsake";
}
