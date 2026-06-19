import { NextRequest, NextResponse } from "next/server";

/* TEMPORARY setup helper for Cloudprinter (browser, no shell needed).
   Visit on your phone:
     /api/cards/cloudprinter-setup            -> list folded-card products
     /api/cards/cloudprinter-setup?quote=US&product=<ref>  -> live US price
   Uses CLOUDPRINTER_API_KEY (apikey in the JSON body). No order is placed.
   Delete this route once setup is done. */
export const runtime = "nodejs";

const BASE = "https://api.cloudprinter.com/cloudcore/1.0";

function key() {
  return (process.env.CLOUDPRINTER_API_KEY || "").replace(/\s/g, "");
}

async function cp(path: string, body: Record<string, unknown> = {}) {
  const r = await fetch(`${BASE}${path}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ apikey: key(), ...body }),
    cache: "no-store",
  });
  const text = await r.text();
  let json: unknown = null;
  try {
    json = text ? JSON.parse(text) : null;
  } catch {
    json = { raw: text.slice(0, 400) };
  }
  return { ok: r.ok, status: r.status, json };
}

export async function GET(req: NextRequest) {
  if (!key()) {
    return NextResponse.json(
      { error: "CLOUDPRINTER_API_KEY is not set in this environment" },
      { status: 500 }
    );
  }

  // ?quote=US&product=<ref> — live single-card delivered price (no order)
  const quoteCC = req.nextUrl.searchParams.get("quote");
  if (quoteCC) {
    const product = req.nextUrl.searchParams.get("product") || "";
    const q = await cp("/orders/quote/", {
      country: quoteCC,
      items: [{ reference: "card", product, count: "1", options: [] }],
    });
    return NextResponse.json({ quotedProduct: product, status: q.status, quote: q.json });
  }

  // default: list products, surface folded greeting-card candidates
  const list = await cp("/products/");
  const j = list.json as Record<string, unknown>;
  const products =
    (j?.products as Record<string, unknown>[]) ||
    (j?.data as Record<string, unknown>[]) ||
    [];
  const simplified = products.map((p) => ({
    reference: p.reference ?? p.product ?? p.code,
    name: p.name ?? p.title,
  }));
  const cards = simplified.filter((p) =>
    /card|fold|greet|5x7|5r7|a5/i.test(`${p.reference ?? ""} ${p.name ?? ""}`)
  );

  return NextResponse.json({
    keyTail: key().slice(-4),
    productsStatus: list.status,
    productCount: simplified.length,
    cardCandidates: cards,
    allProducts: simplified,
  });
}
