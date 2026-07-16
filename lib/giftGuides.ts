/* ── Gift-guide landing pages (SEO) ─────────────────────────────────
   Nine focused pages matching how people actually search for Islamic
   gifts: by occasion, by recipient, and by category intent. Each guide
   is REAL content — unique copy, honest product fit, verified prices
   pulled from the pricing module — not doorway pages. Rendered by
   app/gifts/[slug]/page.tsx with ItemList + Product structured data. */

import {
  bookPriceDisplay,
  HARDCOVER_PRICE_DISPLAY,
  STORYBOOK_PRICE_DISPLAY,
  DIGITAL_CARD_PRICE_CENTS,
} from "@/lib/pricing";

export type GuideProduct = {
  name: string;
  href: string;
  image: string;
  price: string;      // display, e.g. "$49.99"
  priceNumber: number; // for schema.org offers
  blurb: string;
};

export type GiftGuide = {
  slug: string;
  metaTitle: string;
  metaDescription: string;
  eyebrow: string;
  h1: string;
  intro: string[];     // 2 short paragraphs
  products: GuideProduct[];
  closing: string;     // one warm line under the grid
};

const P = {
  hijab: {
    name: "Your Daughter & Her Beautiful Hijab (personalized)",
    href: "/books/her-beautiful-hijab",
    image: "/images/book-amira.jpg",
    price: bookPriceDisplay("her-beautiful-hijab"),
    priceNumber: 34.99,
    blurb:
      "Type her name and she becomes the star, on the cover and woven through a gentle story about loving the hijab.",
  },
  iam: {
    name: "I Am [Your Child] (personalized photo book)",
    href: "/books/i-am",
    image: "/images/iam/cover-sample.jpg",
    price: bookPriceDisplay(),
    priceNumber: 34.99,
    blurb:
      "Twelve beautiful traits in English and Arabic, your own photos, their name on the cover, sealed with a dua.",
  },
  juha: {
    name: "Juha and the Enormous Pumpkin",
    href: "/books/juha-and-the-enormous-pumpkin",
    image: "/images/book-juha.jpg",
    price: STORYBOOK_PRICE_DISPLAY,
    priceNumber: 24.99,
    blurb:
      "The beloved folktale retold with gratitude and giving, plus a printed gift dedication with their name.",
  },
  maryam: {
    name: "Maryam is Kind to Her Parents",
    href: "/books/maryam-is-kind-to-her-parents",
    image: "/images/book-maryam.jpg",
    price: STORYBOOK_PRICE_DISPLAY,
    priceNumber: 24.99,
    blurb:
      "Little hands can do big things — a warm story of kindness to Mama and Baba, ending with the Qur'anic dua for parents.",
  },
  mama: {
    name: "Everything I Love About Mama (photo keepsake)",
    href: "/keepsakes/about-mama",
    image: "/images/keepsake/about-mama/cover.jpg",
    price: HARDCOVER_PRICE_DISPLAY,
    priceNumber: 49.99,
    blurb:
      "A hardcover book of your photos, twenty heartfelt reasons, sealed with the dua for parents.",
  },
  baba: {
    name: "Everything I Love About Baba (photo keepsake)",
    href: "/keepsakes/about-baba",
    image: "/images/keepsake/about-baba/cover.jpg",
    price: HARDCOVER_PRICE_DISPLAY,
    priceNumber: 49.99,
    blurb:
      "Twenty little reasons they love him, printed around your own photos, sealed with a dua.",
  },
  grandma: {
    name: "Everything I Love About Grandma (photo keepsake)",
    href: "/keepsakes/about-grandma",
    image: "/images/keepsake/about-grandma/cover.jpg",
    price: HARDCOVER_PRICE_DISPLAY,
    priceNumber: 49.99,
    blurb:
      "Her dua have followed you all your life — a hardcover thank-you in photos and words.",
  },
  grandpa: {
    name: "Everything I Love About Grandpa (photo keepsake)",
    href: "/keepsakes/about-grandpa",
    image: "/images/keepsake/about-grandpa/cover.jpg",
    price: HARDCOVER_PRICE_DISPLAY,
    priceNumber: 49.99,
    blurb:
      "Stories, patience and faith, honoured in a keepsake he will keep on the shelf forever.",
  },
  baby: {
    name: "Welcome, Little One (new baby keepsake)",
    href: "/keepsakes/about-baby",
    image: "/images/keepsake/about-baby/cover.jpg",
    price: HARDCOVER_PRICE_DISPLAY,
    priceNumber: 49.99,
    blurb:
      "An answered dua: the first photos, the whispered adhan, kept in hardcover for an aqiqah or first Eid.",
  },
  spouse: {
    name: "The Coolness of My Eyes (spouse keepsake)",
    href: "/keepsakes/about-spouse",
    image: "/images/keepsake/about-spouse/cover.jpg",
    price: HARDCOVER_PRICE_DISPLAY,
    priceNumber: 49.99,
    blurb:
      "Twenty things you love about the one Allah chose for you, sealed with the dua for spouses.",
  },
  ramadanBook: {
    name: "Thirty Beautiful Nights (Ramadan keepsake)",
    href: "/keepsakes/our-ramadan",
    image: "/images/keepsake/our-ramadan/cover.jpg",
    price: HARDCOVER_PRICE_DISPLAY,
    priceNumber: 49.99,
    blurb:
      "Your family's Ramadan — suhoor, taraweeh, Eid morning — kept in a hardcover the whole family signs off on.",
  },
  journal: {
    name: "From One Root — 30-day Qur'an journal",
    href: "/journal",
    image: "/images/worlds/journal.jpg",
    price: "$12.99",
    priceNumber: 12.99,
    blurb:
      "One Arabic root a day, traced to the ayah it lives in, every source cited. Instant download.",
  },
  cards: {
    name: "Digital greeting cards with a voice note",
    href: "/digital-cards",
    image: "/images/cards/eid.jpg",
    price: `$${(DIGITAL_CARD_PRICE_CENTS / 100).toFixed(2)}`,
    priceNumber: DIGITAL_CARD_PRICE_CENTS / 100,
    blurb:
      "A beautiful animated card carrying your real voice, delivered anywhere on earth in minutes.",
  },
};

export const GIFT_GUIDES: GiftGuide[] = [
  {
    slug: "eid-gifts",
    metaTitle: "Eid Gifts for Kids & Family | Ketabi Studio",
    metaDescription:
      "Meaningful Eid gifts: personalized Islamic storybooks, hardcover photo keepsakes, and digital Eid cards with your own voice note. Printed to order, shipped worldwide.",
    eyebrow: "Gift guide",
    h1: "Eid gifts they will still have next Eid",
    intro: [
      "The sweetest Eid gifts are not the ones finished by Maghrib. A book with your child's name on the cover, a keepsake of the year's photos, a card that carries your actual voice — these stay on the shelf and come back out year after year, inshaAllah.",
      "Everything below is made to order and checked by hand, with every Arabic word and dua verified before it prints. US shipping is free on storybooks; we ship worldwide.",
    ],
    products: [P.hijab, P.iam, P.juha, P.cards],
    closing: "Order about two weeks before Eid for printed gifts; digital cards arrive in minutes.",
  },
  {
    slug: "ramadan-gifts",
    metaTitle: "Ramadan Gifts for Family | Ketabi Studio",
    metaDescription:
      "Ramadan gifts with meaning: a 30-day Qur'an journal, a family Ramadan photo keepsake, and Islamic storybooks for kids. Verified sources, printed to order.",
    eyebrow: "Gift guide",
    h1: "Ramadan gifts that make the month deeper",
    intro: [
      "Ramadan gifts work best when they point back to the month itself: a journal that opens the Qur'an one Arabic root a day, a keepsake that holds your family's thirty nights, a story that gets little ones excited for iftar.",
      "The journal is an instant download, so it works even if Ramadan starts tomorrow. Printed keepsakes are made to order — allow about two weeks.",
    ],
    products: [P.journal, P.ramadanBook, P.maryam, P.cards],
    closing: "May your month be full of light — Ramadan Mubarak from our family to yours.",
  },
  {
    slug: "new-baby-gifts",
    metaTitle: "Islamic New Baby & Aqiqah Gifts | Ketabi Studio",
    metaDescription:
      "New baby and aqiqah gifts for Muslim families: a hardcover keepsake of the first photos and duas, plus personalized books they will grow into. Shipped worldwide.",
    eyebrow: "Gift guide",
    h1: "For the newest member of the ummah",
    intro: [
      "A Muslim baby arrives to a whispered adhan and a house full of dua. The best aqiqah gifts hold on to exactly that: the first photos, the first prayers, the names chosen with so much care.",
      "Welcome, Little One is our keepsake for this moment — and a personalized book with the baby's name becomes the gift they grow into reading themselves.",
    ],
    products: [P.baby, P.iam, P.maryam, P.cards],
    closing: "May Allah make this little one a coolness of their parents' eyes. Ameen.",
  },
  {
    slug: "nikah-gifts",
    metaTitle: "Nikah & Islamic Wedding Gifts | Ketabi Studio",
    metaDescription:
      "Nikah gifts with heart: a hardcover keepsake of the couple's story sealed with the dua for spouses, and digital nikah cards with your own voice note.",
    eyebrow: "Gift guide",
    h1: "Nikah gifts for a marriage built on dua",
    intro: [
      "A nikah begins with a dua the whole room says Ameen to. The Coolness of My Eyes keeps that spirit — a hardcover of the couple's photos and twenty reasons, sealed with the dua for spouses.",
      "Give it at the walima, or gift it to your own spouse on an anniversary; it is written to work both ways. A digital nikah card with your voice reaches the couple the same day.",
    ],
    products: [P.spouse, P.cards, P.mama],
    closing: "Barakallahu lakuma — may Allah bless the union and join the two in good.",
  },
  {
    slug: "gifts-for-muslim-mom",
    metaTitle: "Islamic Gifts for Mom | Ketabi Studio",
    metaDescription:
      "Gifts for a Muslim mother: a hardcover keepsake of twenty reasons you love her, sealed with the dua for parents, filled with your own photos.",
    eyebrow: "Gift guide",
    h1: "For the one whose dua carried you",
    intro: [
      "Jannah lies at her feet, and she still says you shouldn't have. Everything I Love About Mama is a hardcover keepsake your child (or you) fills with photos, each page carrying one of twenty heartfelt reasons — sealed with the Qur'anic dua for parents.",
      "It works for Mother's Day, her birthday, Eid, or an ordinary Tuesday, because none of the words inside are tied to a date.",
    ],
    products: [P.mama, P.grandma, P.cards, P.journal],
    closing: "Rabbi irhamhuma kama rabbayani saghira — the dua that closes the book, and every day since.",
  },
  {
    slug: "gifts-for-baba",
    metaTitle: "Islamic Gifts for Dad | Ketabi Studio",
    metaDescription:
      "Gifts for a Muslim father: a hardcover keepsake of twenty reasons his kids love him, in their words and your photos, sealed with the dua for parents.",
    eyebrow: "Gift guide",
    h1: "He never asks for anything. Give him this.",
    intro: [
      "Baba will say he doesn't need a gift, then keep this one on the shelf where guests can see it. Everything I Love About Baba is a hardcover of your photos and twenty reasons in his kids' voice — the safest shoulders, the biggest questions about Allah, the dua he makes quietly.",
      "It is made to order, so every copy is one of one — like him.",
    ],
    products: [P.baba, P.grandpa, P.cards, P.juha],
    closing: "For Father's Day, Eid, his birthday, or just because he would never buy it for himself.",
  },
  {
    slug: "gifts-for-grandparents",
    metaTitle: "Islamic Gifts for Grandparents | Ketabi Studio",
    metaDescription:
      "Gifts for Muslim grandparents: hardcover photo keepsakes honouring a lifetime of dua, stories and patience — filled with your photos and their grandchildren's words.",
    eyebrow: "Gift guide",
    h1: "For the ones who prayed for you before you existed",
    intro: [
      "Grandparents' dua reach further back than our memories do. These keepsakes put that lifetime into hardcover: her thousand meals made with love, his stories nobody else remembers, the faith passed quietly down through both of them.",
      "Fill one with photos from your phone in about ten minutes; we print and ship it anywhere in the world.",
    ],
    products: [P.grandma, P.grandpa, P.mama, P.baba],
    closing: "May Allah grant them long life, good health, and the reward of every good they planted in us.",
  },
  {
    slug: "personalized-muslim-childrens-books",
    metaTitle: "Personalized Muslim Children's Books | Ketabi Studio",
    metaDescription:
      "Personalized Islamic books where your child is the star: their name on the cover and through the story, hand-illustrated, every dua verified. Printed to order.",
    eyebrow: "The bookshelf",
    h1: "Books where your child is the star",
    intro: [
      "Children read differently when the hero has their name. Our personalized books put your child on the cover and inside the story — hand-illustrated, human-written, and checked so every Arabic word and dua is exactly right.",
      "You see a live preview of the real book before you order; what you see is what we print.",
    ],
    products: [P.hijab, P.iam, P.juha, P.maryam],
    closing: "Printed to order in 1–3 business days. Free US shipping on storybooks; we ship worldwide.",
  },
  {
    slug: "islamic-keepsake-photo-book",
    metaTitle: "Islamic Keepsake Photo Books | Ketabi Studio",
    metaDescription:
      "Hardcover Islamic photo keepsakes: your photos, twenty heartfelt lines, sealed with a verified dua. For Mama, Baba, grandparents, a spouse, a new baby, and Ramadan.",
    eyebrow: "The keepsake line",
    h1: "The photos on your phone deserve to be kept",
    intro: [
      "Somewhere in your camera roll is the makings of the best gift you will ever give. Our keepsakes turn twenty of those photos into a hardcover book, each page carrying a heartfelt line you can keep or rewrite, and the whole book sealed with a dua verified against its source.",
      "Choose your person, add photos from your phone, and we print a one-of-one hardcover and ship it worldwide.",
    ],
    products: [P.mama, P.baba, P.baby, P.spouse],
    closing: "Seven keepsakes, one for almost everyone you love. Choose your person and begin.",
  },
];

export const getGiftGuide = (slug: string) =>
  GIFT_GUIDES.find((g) => g.slug === slug);
