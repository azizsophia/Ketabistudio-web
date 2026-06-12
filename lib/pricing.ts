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
