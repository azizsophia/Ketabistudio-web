import { NextRequest, NextResponse } from "next/server";

/* TEMPORARY setup helper (replaces the Render shell, which is off on this plan).
   Visit on your phone:
     /api/cards/gelato-setup?token=YOUR_TOKEN
   It uses GELATO_API_KEY to list the greeting-card products, the chosen
   product's print-file/template spec, and US/UK/DE prices — NO order is placed.
   Protected by GELATO_SETUP_TOKEN. Delete this route once setup is done.

   Optional query params:
     uid=<productUid>     inspect a specific product
     catalog=<catalogUid> override the catalog to search (default: a "cards" one)
*/
export const runtime = "nodejs";

const PRODUCT = "https://product.gelatoapis.com";

function key() {
  return (process.env.GELATO_API_KEY || "").replace(/\s/g, "");
}

async function gx(method: string, url: string, body?: unknown) {
  const r = await fetch(url, {
    method,
    headers: { "Content-Type": "application/json", "X-API-KEY": key() },
    body: body ? JSON.stringify(body) : undefined,
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
  const token = req.nextUrl.searchParams.get("token") || "";
  const expected = process.env.GELATO_SETUP_TOKEN || "";
  if (!expected || token !== expected) {
    return NextResponse.json({ error: "not found" }, { status: 404 });
  }
  if (!key()) {
    return NextResponse.json(
      { error: "GELATO_API_KEY is not set in this environment" },
      { status: 500 }
    );
  }

  // 1) catalogs
  const cats = await gx("GET", `${PRODUCT}/v3/catalogs`);
  const catList = Array.isArray(cats.json) ? (cats.json as Record<string, unknown>[]) : [];
  const override = req.nextUrl.searchParams.get("catalog");
  const cardCat =
    override ||
    (catList.find((c) =>
      `${c.catalogUid ?? ""}${c.title ?? ""}`.toLowerCase().includes("card")
    )?.catalogUid as string) ||
    "cards";

  // 2) products in that catalog
  const prods = await gx("POST", `${PRODUCT}/v3/catalogs/${cardCat}/products:search`, {
    limit: 100,
  });
  const products =
    ((prods.json as Record<string, unknown>)?.products as Record<string, unknown>[]) || [];
  const uids = products.map((p) => String(p.productUid || ""));
  const folded = uids.filter((u) => /5x7|5r7|7x5|7r5|fold/i.test(u));

  // 3) inspect a target product (query uid, else first folded, else first)
  const target =
    req.nextUrl.searchParams.get("uid") || folded[0] || uids[0] || null;

  let detail: unknown = null;
  const prices: Record<string, unknown> = {};
  if (target) {
    detail = (await gx("GET", `${PRODUCT}/v3/products/${target}`)).json;
    for (const cc of ["US", "GB", "DE"]) {
      const pr = await gx(
        "GET",
        `${PRODUCT}/v3/products/${target}/prices?country=${cc}&currency=USD`
      );
      prices[cc] = pr.json;
    }
  }

  return NextResponse.json({
    catalogs: catList.map((c) => ({ uid: c.catalogUid, title: c.title })),
    cardCatalog: cardCat,
    productCount: uids.length,
    foldedCandidates: folded,
    allProductUids: uids,
    inspected: target,
    detail,
    prices,
  });
}
