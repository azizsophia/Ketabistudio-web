import { NextRequest, NextResponse } from "next/server";

/* TEMPORARY: does ANY Prodigi card ship from the US (cheap), or only the UK?
   Visit on your phone:
     /api/cards/prodigi-quote
     /api/cards/prodigi-quote?sku=CLASSIC-GRE-FEDR-7X5
   Quotes each card SKU to a US address (no order placed) and shows the print +
   shipping cost AND the fulfilmentLocation (which lab/country makes it). Uses
   PRODIGI_API_KEY + PRODIGI_ENV. Delete once we've decided. */
export const runtime = "nodejs";

function base() {
  const env = (process.env.PRODIGI_ENV || "").replace(/\s/g, "").toLowerCase();
  return ["live", "production", "prod"].includes(env)
    ? "https://api.prodigi.com/v4.0"
    : "https://api.sandbox.prodigi.com/v4.0";
}
function key() {
  return (process.env.PRODIGI_API_KEY || "").replace(/\s/g, "");
}

async function px(method: string, path: string, body?: unknown) {
  const r = await fetch(`${base()}${path}`, {
    method,
    headers: { "Content-Type": "application/json", "X-API-Key": key() },
    body: body ? JSON.stringify(body) : undefined,
    cache: "no-store",
  });
  const text = await r.text();
  let json: unknown = null;
  try {
    json = text ? JSON.parse(text) : null;
  } catch {
    json = { raw: text.slice(0, 300) };
  }
  return { ok: r.ok, status: r.status, json };
}

async function quoteSku(sku: string) {
  // try a couple of print-area shapes so a quote isn't rejected outright
  const attempts = [
    [{ printArea: "default" }],
    [{ printArea: "outside" }, { printArea: "inside" }],
  ];
  for (const assets of attempts) {
    const q = await px("POST", "/quotes", {
      shippingMethod: "Budget",
      destinationCountryCode: "US",
      items: [{ sku, copies: 1, attributes: {}, assets }],
    });
    const quotes = (q.json as Record<string, unknown>)?.quotes as
      | Record<string, unknown>[]
      | undefined;
    if (q.ok && quotes && quotes.length) {
      const cs = (quotes[0].costSummary as Record<string, Record<string, string>>) || {};
      const shipments = (quotes[0].shipments as Record<string, unknown>[]) || [];
      const loc =
        (shipments[0]?.fulfillmentLocation as Record<string, string>) || null;
      return {
        sku,
        items: cs.items?.amount,
        shipping: cs.shipping?.amount,
        currency: cs.items?.currency || cs.shipping?.currency,
        madeIn: loc?.countryCode || loc?.labCode || "unknown",
      };
    }
    if (q.status !== 400) {
      return { sku, error: `${q.status}`, detail: q.json };
    }
  }
  return { sku, error: "could not quote (400 on both asset shapes)" };
}

export async function GET(req: NextRequest) {
  if (!key()) {
    return NextResponse.json(
      { error: "PRODIGI_API_KEY is not set here (add it + PRODIGI_ENV=live in Vercel)" },
      { status: 500 }
    );
  }
  const override = req.nextUrl.searchParams.get("sku");
  const skus = override
    ? [override]
    : [
        "GLOBAL-GRE-MOH-7X5-DIR",
        "GLOBAL-GRE-MOH-7X5-BLA",
        "CLASSIC-GRE-FEDR-7X5",
        "CLASSIC-GRE-FEDR-6X8.5",
        "GLOBAL-GRE-FEDR-7X5",
      ];
  const results = [];
  for (const s of skus) results.push(await quoteSku(s));
  return NextResponse.json({ env: process.env.PRODIGI_ENV || "sandbox", destination: "US", results });
}
