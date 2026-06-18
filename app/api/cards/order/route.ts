import { NextRequest, NextResponse } from "next/server";
import { COLLECTIONS, PAPERS, CARD_ITEMS, CARD_MESSAGE_MAX } from "@/lib/cards";

const SB = process.env.SUPABASE_URL?.replace(/\s/g, "").replace(/\/$/, "");
const KEY = process.env.SUPABASE_SERVICE_KEY?.replace(/\s/g, "");

const COLLECTION_IDS = new Set(COLLECTIONS.map((c) => c.id));
const PAPER_IDS = new Set(PAPERS.map((p) => p.id));
const ITEM_IDS = new Set(CARD_ITEMS.map((c) => c.id));

const VALID_COUNTRIES = new Set([
  "US","AU","AT","BH","BE","CA","DK","EG","FI","FR","DE","IE","IT","JO",
  "KW","MY","NL","NZ","NO","OM","QA","SA","SG","ZA","ES","SE","CH","TR",
  "AE","GB",
]);

export async function POST(req: NextRequest) {
  if (!SB || !KEY) {
    return NextResponse.json({ error: "not configured" }, { status: 500 });
  }

  let body: Record<string, unknown>;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "invalid json" }, { status: 400 });
  }

  /* validate design selections */
  const itemId = String(body.item_id || "");
  if (!ITEM_IDS.has(itemId)) {
    return NextResponse.json({ error: "invalid card" }, { status: 400 });
  }

  // Collection + paper are no longer customer-facing (one premium style, one
  // premium stock). Accept defaults; the renderer ignores collection.
  const collectionRaw = String(body.collection || "");
  const collection = COLLECTION_IDS.has(collectionRaw as never)
    ? collectionRaw
    : "arch";
  const paperRaw = String(body.paper || "");
  const paper = PAPER_IDS.has(paperRaw) ? paperRaw : "mohawk";

  // Inside message must fit the printed spread.
  const message = String(body.message || "").trim();
  if (message.length > CARD_MESSAGE_MAX) {
    return NextResponse.json(
      { error: `Message must be ${CARD_MESSAGE_MAX} characters or fewer.` },
      { status: 400 }
    );
  }

  /* validate email */
  const email = String(body.email || "").trim().toLowerCase();
  if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    return NextResponse.json({ error: "valid email required" }, { status: 400 });
  }

  /* validate shipping */
  const ship = body.shipping as Record<string, string> | undefined;
  const country = (ship?.country_code || "").toUpperCase();
  if (!/^[A-Z]{2}$/.test(country) || !VALID_COUNTRIES.has(country)) {
    return NextResponse.json({ error: "country not supported" }, { status: 400 });
  }
  if (
    !ship ||
    !ship.name?.trim() ||
    !ship.line1?.trim() ||
    !ship.city?.trim() ||
    !ship.postcode?.trim()
  ) {
    return NextResponse.json(
      { error: "complete shipping address required" },
      { status: 400 }
    );
  }

  const shipping = {
    name: ship.name.trim(),
    line1: ship.line1.trim(),
    line2: (ship.line2 || "").trim() || undefined,
    city: ship.city.trim(),
    postcode: ship.postcode.trim(),
    country_code: country,
    state: (ship.state || "").trim().toUpperCase() || undefined,
  };

  /* design fields */
  const row = {
    collection,
    item_id: itemId,
    accent: String(body.accent || "").trim() || null,
    recipient_name: String(body.recipient_name || "").trim() || null,
    show_name: !!body.show_name,
    custom_front: String(body.custom_front || "").trim() || null,
    arabic_index: Number.isFinite(Number(body.arabic_index))
      ? Number(body.arabic_index)
      : 0,
    arabic_off: !!body.arabic_off,
    message: message || null,
    sender: String(body.sender || "").trim() || null,
    photo_url: String(body.photo_url || "").trim() || null,
    paper,
    customer_email: email,
    shipping,
    status: "awaiting_payment",
  };

  const r = await fetch(`${SB}/rest/v1/card_orders`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${KEY}`,
      apikey: KEY!,
      "Content-Type": "application/json",
      Prefer: "return=representation",
    },
    body: JSON.stringify(row),
  });

  if (!r.ok) {
    const err = await r.text();
    console.error("card order insert fail:", err);
    return NextResponse.json({ error: "order failed" }, { status: 500 });
  }

  const [created] = await r.json();

  /* log event */
  await fetch(`${SB}/rest/v1/card_order_events`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${KEY}`,
      apikey: KEY!,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      card_order_id: created.id,
      event: "awaiting_payment",
    }),
  });

  return NextResponse.json({ ok: true, orderId: created.id });
}
