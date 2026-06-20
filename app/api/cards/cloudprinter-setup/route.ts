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

  // ?compare=US — price several paper/finish upgrades at once (with envelope),
  // and reveal which are available at the US facility.
  const compareCC = req.nextUrl.searchParams.get("compare");
  if (compareCC) {
    const product = "card_folded_us_500x700_p_double_fc_tnr";
    const state = req.nextUrl.searchParams.get("state") || "NY";
    const combos: { label: string; refs: string[] }[] = [
      { label: "250gsm gloss board (current default)", refs: [] },
      { label: "270gsm smooth white + no finish", refs: ["paper_smooth_white_270", "product_finish_none"] },
      { label: "300gsm silk + matte", refs: ["paper_300mcs", "product_finish_matte"] },
      { label: "330gsm silk + matte", refs: ["paper_330mcs", "product_finish_matte"] },
      { label: "350gsm silk + matte", refs: ["paper_350scb", "product_finish_matte"] },
      { label: "350gsm silk + soft touch", refs: ["paper_350scb", "product_finish_soft_touch_front"] },
      { label: "400gsm silk + matte", refs: ["paper_400scb", "product_finish_matte"] },
    ];
    const results: Record<string, unknown>[] = [];
    for (const c of combos) {
      const options = [
        { option_reference: "envelope_standard", count: "1" },
        ...c.refs.map((r) => ({ option_reference: r, count: "1" })),
      ];
      const q = await cp("/orders/quote/", {
        country: compareCC, state,
        items: [{ reference: "card", product, count: "1", options }],
      });
      const j = (q.json || {}) as Record<string, unknown>;
      if (!q.ok) {
        const err = (j.error as Record<string, string>) || {};
        results.push({ label: c.label, available: false, reason: err.info || err.type || `HTTP ${q.status}` });
        continue;
      }
      const prod = parseFloat(String(j.price || "0"));
      let ship = Infinity;
      for (const s of ((j.shipments as Record<string, unknown>[]) || [])) {
        for (const qq of ((s.quotes as Record<string, string>[]) || [])) {
          ship = Math.min(ship, parseFloat(String(qq.price || "0")));
        }
      }
      if (!isFinite(ship)) ship = 0;
      const total = prod + ship;
      results.push({
        label: c.label, available: true,
        currency: j.currency || "EUR",
        card: prod.toFixed(2), shipping: ship.toFixed(2),
        total: total.toFixed(2), approxUSD: (total * 1.1).toFixed(2),
      });
    }
    return NextResponse.json({ destination: compareCC, results });
  }

  // ?info=<product> — product detail (dimensions, file/template requirements)
  const infoRef = req.nextUrl.searchParams.get("info");
  if (infoRef) {
    const info = await cp("/products/info/", { reference: infoRef });
    return NextResponse.json({ product: infoRef, status: info.status, info: info.json });
  }

  // ?quote=US&product=<ref>&state=NY — live single-card delivered price
  const quoteCC = req.nextUrl.searchParams.get("quote");
  if (quoteCC) {
    const product = req.nextUrl.searchParams.get("product") || "";
    const state =
      req.nextUrl.searchParams.get("state") || (quoteCC === "US" ? "NY" : "");
    // include the envelope add-on by default so the price matches real orders
    const env = req.nextUrl.searchParams.get("envelope");
    const options =
      env === "0" || env === "none"
        ? []
        : [{ option_reference: env || "envelope_standard", count: "1" }];
    const body: Record<string, unknown> = {
      country: quoteCC,
      items: [{ reference: "card", product, count: "1", options }],
    };
    if (state) body.state = state;
    const q = await cp("/orders/quote/", body);
    return NextResponse.json({ quotedProduct: product, state, options, status: q.status, quote: q.json });
  }

  // default: list products, then recursively pull every {reference,name} no
  // matter how Cloudprinter nests them, and keep only the card/folded ones.
  const list = await cp("/products/");
  const found: { reference?: string; name?: string }[] = [];
  const walk = (node: unknown) => {
    if (Array.isArray(node)) {
      node.forEach(walk);
      return;
    }
    if (node && typeof node === "object") {
      const o = node as Record<string, unknown>;
      const reference = (o.reference ?? o.product ?? o.code ?? o.sku) as string | undefined;
      const name = (o.name ?? o.title ?? o.label) as string | undefined;
      if (reference || name) found.push({ reference, name });
      Object.values(o).forEach(walk);
    }
  };
  walk(list.json);

  const seen = new Set<string>();
  const all = found.filter((p) => {
    const k = p.reference || p.name || "";
    if (!k || seen.has(k)) return false;
    seen.add(k);
    return true;
  });
  const cards = all.filter((p) =>
    /card|fold|greet/i.test(`${p.reference ?? ""} ${p.name ?? ""}`)
  );
  const folded = cards.filter((p) =>
    /fold/i.test(`${p.reference ?? ""} ${p.name ?? ""}`)
  );

  return NextResponse.json({
    keyTail: key().slice(-4),
    productsStatus: list.status,
    totalProducts: all.length,
    foldedCardCandidates: folded,
    allCardCandidates: cards,
  });
}
