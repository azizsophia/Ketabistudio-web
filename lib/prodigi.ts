// Prodigi Print API client scaffold for Card Studio fulfillment.
//
// Cards are fulfilled as A6 folded greeting cards via Prodigi
// (SKU GLOBAL-GRE-FAP-A6). Each card needs two print assets:
//   - "outside" print area: back panel | front face
//   - "inside"  print area: blank panel | inside face
// Those assets are produced by the headless render of /cards/print.
//
// This is a SCAFFOLD: typed helpers around the Prodigi v4.0 REST API. It is not
// yet called by checkout. Every helper returns parsed JSON on success or null on
// failure (network / non-2xx / parse errors are caught and logged).
//
// Auth: X-API-Key header, read from process.env.PRODIGI_API_KEY. The key is
// never hardcoded. Base URL is selected by PRODIGI_ENV ("live" vs sandbox).
//
// TODO (phase 2b): wire to checkout webhook + the headless render — generate the
// outside/inside print assets from /cards/print, upload them to public URLs, then
// call createOrder() from the (paid) Stripe checkout webhook.

// ---- config ----

const PRODIGI_BASE_URL =
  process.env.PRODIGI_ENV === "live"
    ? "https://api.prodigi.com/v4.0"
    : "https://api.sandbox.prodigi.com/v4.0";

export const CARD_SKU = "GLOBAL-GRE-FAP-A6";

// ---- shared types ----

export interface ProdigiRecipient {
  name: string;
  email?: string;
  phoneNumber?: string;
  address: {
    line1: string;
    line2?: string;
    postalOrZipCode: string;
    countryCode: string;
    townOrCity: string;
    stateOrCounty?: string;
  };
}

/** A single print asset: which print area it covers + a publicly-fetchable URL. */
export interface ProdigiAsset {
  printArea: "outside" | "inside";
  url: string;
}

/** Sizing strategy Prodigi applies when placing the asset into the print area. */
export type ProdigiSizing = "fillPrintArea" | "fitPrintArea" | "stretchToPrintArea";

/** Quote line item (no assets needed — quotes are for price/shipping only). */
export interface ProdigiQuoteItem {
  sku: string;
  copies: number;
  attributes?: Record<string, string>;
  assets?: Array<{ printArea: string }>;
}

export interface GetQuoteParams {
  sku: string;
  copies: number;
  destinationCountryCode: string;
  items?: ProdigiQuoteItem[];
  shippingMethod?: ProdigiShippingMethod;
}

export type ProdigiShippingMethod = "Budget" | "Standard" | "Express" | "Overnight";

export interface CreateOrderParams {
  merchantReference: string;
  recipient: ProdigiRecipient;
  copies: number;
  assets: ProdigiAsset[];
  shippingMethod?: ProdigiShippingMethod;
  sizing?: ProdigiSizing;
}

// Responses are typed loosely as Prodigi returns large payloads; callers can
// narrow what they need. These aliases document intent at the call sites.
export type ProdigiQuoteResponse = Record<string, unknown>;
export type ProdigiOrderResponse = Record<string, unknown>;

// ---- internal request helper ----

async function prodigiFetch<T>(
  path: string,
  init: RequestInit = {},
): Promise<T | null> {
  const apiKey = process.env.PRODIGI_API_KEY;
  if (!apiKey) {
    console.error("[prodigi] PRODIGI_API_KEY is not set");
    return null;
  }
  try {
    const res = await fetch(`${PRODIGI_BASE_URL}${path}`, {
      ...init,
      headers: {
        "Content-Type": "application/json",
        "X-API-Key": apiKey,
        ...(init.headers || {}),
      },
    });
    if (!res.ok) {
      const body = await res.text().catch(() => "");
      console.error(
        `[prodigi] ${init.method || "GET"} ${path} -> ${res.status} ${res.statusText} ${body}`,
      );
      return null;
    }
    return (await res.json()) as T;
  } catch (err) {
    console.error(`[prodigi] request to ${path} failed`, err);
    return null;
  }
}

// ---- public API ----

/**
 * POST /quotes — get price + shipping options for a SKU to a destination.
 * Used before checkout to surface shipping cost; needs no print assets.
 */
export async function getQuote(
  params: GetQuoteParams,
): Promise<ProdigiQuoteResponse | null> {
  const items: ProdigiQuoteItem[] = params.items ?? [
    { sku: params.sku, copies: params.copies },
  ];
  const body = {
    shippingMethod: params.shippingMethod ?? "Standard",
    destinationCountryCode: params.destinationCountryCode,
    items,
  };
  return prodigiFetch<ProdigiQuoteResponse>("/quotes", {
    method: "POST",
    body: JSON.stringify(body),
  });
}

/**
 * POST /orders — place a fulfillment order for one personalised card.
 * The line item carries the outside + inside print assets and a white-label
 * (no branding) packing slip so the parcel arrives blind, from the sender.
 */
export async function createOrder(
  params: CreateOrderParams,
): Promise<ProdigiOrderResponse | null> {
  const body = {
    merchantReference: params.merchantReference,
    shippingMethod: params.shippingMethod ?? "Standard",
    recipient: params.recipient,
    // Branded packing slip PDF hosted on the site (falls back to white-label).
    packingSlip: {
      url:
        process.env.PACKING_SLIP_URL ||
        (process.env.NEXT_PUBLIC_SITE_URL
          ? `${process.env.NEXT_PUBLIC_SITE_URL.replace(/\/$/, "")}/packing-slip.pdf`
          : null),
    },
    items: [
      {
        merchantReference: params.merchantReference,
        sku: CARD_SKU,
        copies: params.copies,
        sizing: params.sizing ?? "fillPrintArea",
        assets: params.assets.map((a) => ({
          printArea: a.printArea,
          url: a.url,
        })),
      },
    ],
  };
  return prodigiFetch<ProdigiOrderResponse>("/orders", {
    method: "POST",
    body: JSON.stringify(body),
  });
}

/** GET /orders/{id} — fetch fulfillment status for a placed order. */
export async function getOrderStatus(
  id: string,
): Promise<ProdigiOrderResponse | null> {
  return prodigiFetch<ProdigiOrderResponse>(
    `/orders/${encodeURIComponent(id)}`,
    { method: "GET" },
  );
}
