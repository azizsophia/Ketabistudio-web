/* ── Ketabi Studio pricing (single source of truth) ──
   All amounts in USD cents. Pay-at-checkout model.
   Book price + flat shipping by zone. Reviewed 2026-06-11. */

/* ⚠️ TEMPORARY TEST PRICING — set false before public launch to restore
   the real $34.99 book price. While true, books cost $1 so the owner can
   place real test orders cheaply. */
export const TEST_DOLLAR_PRICING = true;

export const BOOK_PRICE_CENTS = TEST_DOLLAR_PRICING ? 100 : 3499; // $1 test / $34.99 live (softcover, free US shipping baked in)

/* Hardcover — personalized books (her-beautiful-hijab, my-beautiful-duas,
   i-am) as an upsell, and the ONLY binding for keepsake photobooks.
   Softcover stays the default for storybooks. See HARDCOVER_SLUGS below. */
export const HARDCOVER_PRICE_CENTS = TEST_DOLLAR_PRICING ? 100 : 4999; // $1 test / $49.99 live
export const HARDCOVER_PRICE_DISPLAY = TEST_DOLLAR_PRICING ? "$1.00" : "$49.99";

export type CoverType = "softcover" | "hardcover";

/* Non-personalized storybooks sell below the personalized tier. They carry the
   same Lulu cost (~$15.47 delivered US: $9.03 print + $0.75 fulfillment + $5.69
   MAIL) but have no personalization, so they're priced at $24.99 softcover
   (~$8.50 US / ~$16 intl profit). SOFTCOVER-ONLY: their cover art is a flattened
   PDF sized for the perfect-bound wrap (1252x630pt). A casewrap hardcover needs
   a different, larger cover (1368x738pt, confirmed live with Lulu) that does not
   exist for these titles, so they are never offered in hardcover. */
export const STORYBOOK_PRICE_CENTS = TEST_DOLLAR_PRICING ? 100 : 2499; // $1 test / $24.99
export const STORYBOOK_PRICE_DISPLAY = TEST_DOLLAR_PRICING ? "$1.00" : "$24.99";

const SOFTCOVER_PRICE_OVERRIDES: Record<string, number> = {
  "juha-and-the-enormous-pumpkin": STORYBOOK_PRICE_CENTS,
  "maryam-is-kind-to-her-parents": STORYBOOK_PRICE_CENTS,
};

/** Book price in cents for a cover type, optionally for a specific slug.
 *  Hardcover uses the personalized hardcover price; otherwise a slug may carry
 *  its own softcover price (non-personalized storybooks) before the default. */
export function bookPriceCents(coverType?: string, slug?: string): number {
  if (coverType === "hardcover") return HARDCOVER_PRICE_CENTS;
  if (slug && slug in SOFTCOVER_PRICE_OVERRIDES) {
    return SOFTCOVER_PRICE_OVERRIDES[slug];
  }
  return BOOK_PRICE_CENTS;
}

/** Storefront display price (softcover) for a book — slug-aware. */
export function bookPriceDisplay(slug?: string): string {
  if (slug && slug in SOFTCOVER_PRICE_OVERRIDES) return STORYBOOK_PRICE_DISPLAY;
  return BOOK_PRICE_DISPLAY;
}

/* Shipping model: FREE for US (baked into the book price); real-time Lulu
   shipping for international (so intl orders never lose money). */
export function isFreeShippingCountry(countryCode: string): boolean {
  return countryCode.toUpperCase() === "US";
}

/* Greeting cards: ONE flat card price AND ONE flat shipping price worldwide
   (so the storefront never shows two different prices — avoids confusion).
   International still earns the fatter margin automatically, because Prodigi
   (~$7 delivered) is far cheaper to fulfil than US Cloudprinter (~$11.62) —
   the margin difference comes from print cost, not from a higher shipping
   charge, so intl shipping doesn't need to be steep.

   Worked economics (live printer quotes, June 2026; Stripe ~2.9% + $0.30):
     • US   : $12.99 card + $4.99 ship = $17.98; cost ~$11.62; fee ~$0.82
              → profit ≈ $5.5
     • Intl : $12.99 card + $4.99 ship = $17.98; cost ~$7 typical (worst
              ~$13.71 Malaysia); fee ~$0.82
              → profit ≈ $10.2 typical / ≈ $3.4 worst case
   Intl nets ~2x the US at the SAME shipping price — no need to charge more. */
export const CARD_PRICE_CENTS = TEST_DOLLAR_PRICING ? 100 : 1299; // $1 test / $12.99 card (same worldwide)
export const CARD_PRICE_DISPLAY = TEST_DOLLAR_PRICING ? "$1.00" : "$12.99";

/* Flat card shipping, same worldwide. In test mode shipping is $0 so a test
   order totals exactly $1 (the card price). Restore with TEST_DOLLAR_PRICING. */
export const CARD_SHIP_US_CENTS = TEST_DOLLAR_PRICING ? 0 : 499; // $4.99 domestic
export const CARD_SHIP_INTL_CENTS = TEST_DOLLAR_PRICING ? 0 : 499; // $4.99 international (same)
export const CARD_SHIP_US_DISPLAY = "$4.99";
export const CARD_SHIP_INTL_DISPLAY = "$4.99";

/** Card shipping charge in cents for a destination country. */
export function cardShippingCents(countryCode: string): number {
  return countryCode.toUpperCase() === "US"
    ? CARD_SHIP_US_CENTS
    : CARD_SHIP_INTL_CENTS;
}

export function cardShippingLabel(countryCode: string): string {
  return countryCode.toUpperCase() === "US"
    ? "Shipping (US)"
    : "Shipping (International)";
}

/* ── Digital greeting cards ──
   A hosted, animated card delivered by a shareable link (and optionally
   emailed to the recipient). Nothing is printed or posted, so there is no
   print cost, no shipping, and no country gating — it sells worldwide,
   including the Gulf where physical card shipping is unavailable. Priced as
   an impulse buy, well below the physical card. ~100% margin minus the Stripe
   fee. In test mode it is $1 like everything else. */
export const DIGITAL_CARD_PRICE_CENTS = TEST_DOLLAR_PRICING ? 100 : 200; // $1 test / $2.00 flat
export const DIGITAL_CARD_PRICE_DISPLAY = TEST_DOLLAR_PRICING ? "$1.00" : "$2.00";

/* Voice note: a short recorded message that plays inside the opened card. It is
   INCLUDED in the flat price (no extra charge), so it adds no Stripe line item.
   Kept as its own constant so the flat price can be split out again later. */
export const VOICE_ADDON_CENTS = 0; // included free in the flat card price
export const VOICE_ADDON_DISPLAY = "Included";
/* Total shown when a voice note is included: same flat price. */
export const DIGITAL_CARD_WITH_VOICE_DISPLAY = TEST_DOLLAR_PRICING
  ? "$1.00"
  : "$2.00";

export const SHIPPING_US_CENTS = 499; // $4.99 domestic
export const SHIPPING_INTL_CENTS = 1499; // $14.99 international

export function shippingCents(countryCode: string): number {
  return countryCode.toUpperCase() === "US"
    ? SHIPPING_US_CENTS
    : SHIPPING_INTL_CENTS;
}

export function shippingLabel(countryCode: string): string {
  return countryCode.toUpperCase() === "US"
    ? "Shipping (US)"
    : "Shipping (International)";
}

export const CURRENCY = "usd";

/* Human-readable for the storefront */
export const BOOK_PRICE_DISPLAY = TEST_DOLLAR_PRICING ? "$1.00" : "$34.99";
export const SOFTCOVER_PRICE_DISPLAY = BOOK_PRICE_DISPLAY;
export const SHIPPING_US_DISPLAY = "$4.99";
export const SHIPPING_INTL_DISPLAY = "$14.99";

/* ── Real-time Lulu shipping (Option B) ──
   Print spec per book, used to ask Lulu for a live shipping quote at checkout.
   All current titles are 8.5in square, 32pp, same POD package. */
export const POD_PACKAGE = "0850X0850.FC.PRE.PB.080CW444.MXX";

/* ⚠️ CANDIDATE HARDCOVER POD — casewrap (CW). Keep in sync with the worker's
   HARDCOVER_POD (worker.py / lulu_client.py). Used only to quote shipping for
   hardcover orders; must be confirmed by Lulu on the first real order. */
export const HARDCOVER_POD = "0850X0850.FC.PRE.CW.080CW444.MXX";

/* Photo-book keepsake templates (orders with book_slug = template slug). They
   are 8.5x8.5 HARDCOVER-ONLY keepsakes, 24pp casewrap (every interior page is a
   customer photo). Kept here (not imported) to avoid a server/client import
   cycle. */
export const PHOTOBOOK_SLUGS = [
  "about-mama",
  "about-baba",
  "about-grandma",
  "about-grandpa",
  "about-spouse",
  "about-baby",
  "our-ramadan",
];

export const BOOK_SHIP_SPEC: Record<string, { pageCount: number; pod: string }> = {
  "her-beautiful-hijab": { pageCount: 32, pod: POD_PACKAGE },
  "my-beautiful-duas": { pageCount: 32, pod: POD_PACKAGE },
  "i-am": { pageCount: 32, pod: POD_PACKAGE },
  "juha-and-the-enormous-pumpkin": { pageCount: 32, pod: POD_PACKAGE },
  "maryam-is-kind-to-her-parents": { pageCount: 32, pod: POD_PACKAGE },
  // Photo-book keepsakes — hardcover-only, 24pp casewrap (see PHOTOBOOK note).
  "about-mama": { pageCount: 24, pod: HARDCOVER_POD },
  "about-baba": { pageCount: 24, pod: HARDCOVER_POD },
  "about-grandma": { pageCount: 24, pod: HARDCOVER_POD },
  "about-grandpa": { pageCount: 24, pod: HARDCOVER_POD },
  "about-spouse": { pageCount: 24, pod: HARDCOVER_POD },
  "about-baby": { pageCount: 24, pod: HARDCOVER_POD },
  "our-ramadan": { pageCount: 24, pod: HARDCOVER_POD },
};
export const DEFAULT_SHIP_SPEC = { pageCount: 32, pod: POD_PACKAGE };

/* Books that may be ordered in hardcover (personalized books + all photo-book
   keepsakes). The casewrap POD is selected by shipSpecFor below. */
export const HARDCOVER_SLUGS = [
  "her-beautiful-hijab",
  "my-beautiful-duas",
  "i-am",
  ...PHOTOBOOK_SLUGS,
];

/** Shipping spec for a book + cover type. Hardcover (personalized books only)
 *  quotes shipping with the casewrap POD; everything else uses the softcover
 *  POD, so existing behavior is unchanged. */
export function shipSpecFor(
  slug: string,
  coverType?: string
): { pageCount: number; pod: string } {
  const base = BOOK_SHIP_SPEC[slug] || DEFAULT_SHIP_SPEC;
  if (coverType === "hardcover" && HARDCOVER_SLUGS.includes(slug)) {
    return { pageCount: base.pageCount, pod: HARDCOVER_POD };
  }
  return base;
}

/* Charge = Lulu's shipping cost + modest handling, rounded up to the next
   $0.50, with a sensible floor so micro-quotes still cover packaging. */
export function shipChargeFromLulu(luluCents: number): number {
  const withHandling = luluCents + 150; // $1.50 handling buffer
  return Math.max(SHIPPING_US_CENTS, Math.ceil(withHandling / 50) * 50);
}
