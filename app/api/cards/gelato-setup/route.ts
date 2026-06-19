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
const ORDER = "https://order.gelatoapis.com";

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
  // No token gate — this temporary route only READS Gelato catalog/prices (no
  // orders, no secrets returned beyond the key's last 4 chars). Delete the
  // route once setup is done.
  if (!key()) {
    return NextResponse.json(
      { error: "GELATO_API_KEY is not set in this environment" },
      { status: 500 }
    );
  }

  // ?quote=US&uid=<productUid>&qty=1 — live single-card delivered price (no
  // order created). Confirms qty 1 is allowed and the real US shipping cost.
  const quoteCC = req.nextUrl.searchParams.get("quote");
  if (quoteCC) {
    const uid =
      req.nextUrl.searchParams.get("uid") ||
      "cards_pf_5r_pt_350-gsm-coated-silk_cl_4-4_ver";
    const qty = Number(req.nextUrl.searchParams.get("qty") || "1") || 1;
    const recipients: Record<string, Record<string, string>> = {
      US: {
        country: "US", firstName: "Test", lastName: "Order",
        addressLine1: "108 Patina Run", city: "Starkville",
        state: "MS", postCode: "39759", email: "test@example.com",
      },
    };
    const body = {
      orderReferenceId: "quote-test",
      customerReferenceId: "ketabi",
      currency: "USD",
      recipient: recipients[quoteCC] || recipients.US,
      products: [
        {
          itemReferenceId: "card",
          productUid: uid,
          fileUrl: "https://ketabistudio.com/images/cards/eid.jpg",
          quantity: qty,
        },
      ],
    };
    const q = await gx("POST", `${ORDER}/v4/orders:quote`, body);
    return NextResponse.json({ quotedProduct: uid, qty, status: q.status, quote: q.json });
  }

  // 1) catalogs
  const cats = await gx("GET", `${PRODUCT}/v3/catalogs`);
  // Gelato may return a bare array or { data: [...] }.
  const catJson = cats.json as Record<string, unknown> | unknown[];
  const catList: Record<string, unknown>[] = Array.isArray(catJson)
    ? (catJson as Record<string, unknown>[])
    : Array.isArray((catJson as Record<string, unknown>)?.data)
    ? ((catJson as Record<string, unknown>).data as Record<string, unknown>[])
    : [];
  const override = req.nextUrl.searchParams.get("catalog");
  // Greeting cards live in the cards-us / cards-eu / cards catalogs.
  // (folded-cards = brochures; business-cards = business cards — both wrong.)
  const preferred = ["cards-us", "cards", "cards-eu"];
  const cardCat =
    override ||
    preferred.find((p) => catList.some((c) => c.catalogUid === p)) ||
    "folded-cards";

  // 2) products in that catalog
  const prods = await gx("POST", `${PRODUCT}/v3/catalogs/${cardCat}/products:search`, {
    limit: 100,
  });
  const prodJson = prods.json as Record<string, unknown>;
  const products =
    (prodJson?.products as Record<string, unknown>[]) ||
    (prodJson?.data as Record<string, unknown>[]) ||
    [];
  const uids = products.map((p) => String(p.productUid || ""));
  // 5x7" tokens Gelato uses can be 5r7 / 5x7 / 130x180mm etc.
  const folded = uids.filter((u) => /5r7|5x7|7r5|7x5|130x180|180x130/i.test(u));

  // 3) inspect a target product (query uid, else first 5x7, else first)
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
    keyTail: key().slice(-4),
    catalogsStatus: cats.status,
    productsStatus: prods.status,
    cardCatalog: cardCat,
    productCount: uids.length,
    fiveBySeven: folded,
    allProductUids: uids,
    inspected: target,
    detail,
    prices,
  });
}
