import { NextRequest, NextResponse } from "next/server";

/* TEMPORARY Printify check (browser, no shell): finds the folded greeting-card
   blueprint, its print providers, and the REAL US shipping cost for each, plus
   a variant's print dimensions. Uses PRINTIFY_API_TOKEN (Bearer). No order is
   placed. Delete once we've decided.
     /api/cards/printify-setup
     /api/cards/printify-setup?blueprint=962   (inspect a specific blueprint)
*/
export const runtime = "nodejs";

const BASE = "https://api.printify.com/v1";

function token() {
  return (process.env.PRINTIFY_API_TOKEN || "").replace(/\s/g, "");
}

async function px(path: string) {
  const r = await fetch(`${BASE}${path}`, {
    headers: { Authorization: `Bearer ${token()}`, "Content-Type": "application/json" },
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

function usCost(shippingJson: Record<string, unknown>) {
  // shipping.json -> { handling_time, profiles: [{ countries, first_item:{cost,currency}, ... }] }
  const profiles = (shippingJson?.profiles as Record<string, unknown>[]) || [];
  for (const p of profiles) {
    const countries = (p.countries as string[]) || [];
    if (countries.includes("US") || countries.includes("REST_OF_THE_WORLD")) {
      const fi = (p.first_item as Record<string, number>) || {};
      return { cost: fi.cost, currency: fi.currency, countries };
    }
  }
  return null;
}

export async function GET(req: NextRequest) {
  if (!token()) {
    return NextResponse.json(
      { error: "PRINTIFY_API_TOKEN is not set (add it in Vercel, then redeploy)" },
      { status: 500 }
    );
  }

  // 1) find the folded greeting-card blueprint
  const bpReq = await px("/catalog/blueprints.json");
  if (!bpReq.ok) {
    return NextResponse.json({ step: "blueprints", status: bpReq.status, body: bpReq.json });
  }
  const blueprints = (bpReq.json as Record<string, unknown>[]) || [];
  const wantId = req.nextUrl.searchParams.get("blueprint");
  const card = wantId
    ? blueprints.find((b) => String(b.id) === wantId)
    : blueprints.find((b) =>
        /fold/i.test(String(b.title)) && /card|greeting/i.test(String(b.title))
      ) || blueprints.find((b) => /greeting card/i.test(String(b.title)));
  if (!card) {
    const cards = blueprints
      .filter((b) => /card|greeting/i.test(String(b.title)))
      .map((b) => ({ id: b.id, title: b.title }));
    return NextResponse.json({ note: "no folded card auto-found; pick one with ?blueprint=", cardCandidates: cards });
  }

  // 2) print providers + 3) US shipping for each
  const id = card.id;
  const ppReq = await px(`/catalog/blueprints/${id}/print_providers.json`);
  const providers = (ppReq.json as Record<string, unknown>[]) || [];
  const out: Record<string, unknown>[] = [];
  let placeholders: unknown = null;
  for (const pp of providers) {
    const ship = await px(`/catalog/blueprints/${id}/print_providers/${pp.id}/shipping.json`);
    const us = ship.ok ? usCost(ship.json as Record<string, unknown>) : null;
    out.push({
      provider: pp.title,
      providerId: pp.id,
      usShippingCost: us ? `${(Number(us.cost) / 100).toFixed(2)} ${us.currency}` : "n/a",
      handlingTime: (ship.json as Record<string, unknown>)?.handling_time ?? null,
    });
    if (placeholders === null) {
      const v = await px(`/catalog/blueprints/${id}/print_providers/${pp.id}/variants.json`);
      const variants = ((v.json as Record<string, unknown>)?.variants as Record<string, unknown>[]) || [];
      placeholders = variants[0]?.placeholders ?? null;
    }
  }

  return NextResponse.json({
    blueprint: { id: card.id, title: card.title },
    providers: out,
    samplePlaceholders: placeholders,
  });
}
