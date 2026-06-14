/* ── Ketabi Studio pricing (single source of truth) ──
   All amounts in USD cents. Pay-at-checkout model.
   Book price + flat shipping by zone. Reviewed 2026-06-11. */

export const BOOK_PRICE_CENTS = 2799; // $27.99 per book

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
export const BOOK_PRICE_DISPLAY = "$27.99";
export const SHIPPING_US_DISPLAY = "$4.99";
export const SHIPPING_INTL_DISPLAY = "$14.99";

/* ── Real-time Lulu shipping (Option B) ──
   Print spec per book, used to ask Lulu for a live shipping quote at checkout.
   All current titles are 8.5in square, 32pp, same POD package. */
export const POD_PACKAGE = "0850X0850.FC.PRE.PB.080CW444.MXX";

export const BOOK_SHIP_SPEC: Record<string, { pageCount: number; pod: string }> = {
  "her-beautiful-hijab": { pageCount: 32, pod: POD_PACKAGE },
  "my-beautiful-duas": { pageCount: 32, pod: POD_PACKAGE },
  "juha-and-the-enormous-pumpkin": { pageCount: 32, pod: POD_PACKAGE },
  "maryam-is-kind-to-her-parents": { pageCount: 32, pod: POD_PACKAGE },
};
export const DEFAULT_SHIP_SPEC = { pageCount: 32, pod: POD_PACKAGE };

/* Charge = Lulu's shipping cost + modest handling, rounded up to the next
   $0.50, with a sensible floor so micro-quotes still cover packaging. */
export function shipChargeFromLulu(luluCents: number): number {
  const withHandling = luluCents + 150; // $1.50 handling buffer
  return Math.max(SHIPPING_US_CENTS, Math.ceil(withHandling / 50) * 50);
}
