import { NextRequest, NextResponse } from "next/server";
import { randomUUID } from "crypto";

const SB = process.env.SUPABASE_URL?.replace(/\s/g, "").replace(/\/$/, "");
const KEY = process.env.SUPABASE_SERVICE_KEY?.replace(/\s/g, "");

const VALID_SLUGS = [
  "her-beautiful-hijab",
  "juha-and-the-enormous-pumpkin",
  "maryam-is-kind-to-her-parents",
];
const PERSONALIZED_SLUGS = ["her-beautiful-hijab"];
const VALID_SKIN = ["light", "medium", "dark"];
const VALID_HAIR = ["black", "brown", "blonde", "red"];
const VALID_STYLE = ["long-straight", "long-curly", "short-straight", "short-curly"];

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

  const slug = String(body.book_slug || "");
  if (!VALID_SLUGS.includes(slug)) {
    return NextResponse.json({ error: "invalid book" }, { status: 400 });
  }

  const personalized = PERSONALIZED_SLUGS.includes(slug);

  /* validate personalization fields */
  let childName: string | null = null;
  let skin: string | null = null;
  let hair: string | null = null;
  let hairStyle: string | null = null;

  if (personalized) {
    childName = String(body.child_name || "").trim();
    if (!childName || childName.length > 14) {
      return NextResponse.json(
        { error: "Name required (1 to 14 characters)" },
        { status: 400 }
      );
    }
    skin = String(body.skin || "");
    hair = String(body.hair || "");
    hairStyle = String(body.hair_style || "");
    if (!VALID_SKIN.includes(skin))
      return NextResponse.json({ error: "invalid skin" }, { status: 400 });
    if (!VALID_HAIR.includes(hair))
      return NextResponse.json({ error: "invalid hair" }, { status: 400 });
    if (!VALID_STYLE.includes(hairStyle))
      return NextResponse.json({ error: "invalid hair style" }, { status: 400 });
  }

  /* validate email */
  const email = String(body.email || "").trim().toLowerCase();
  if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    return NextResponse.json({ error: "valid email required" }, { status: 400 });
  }

  /* validate shipping */
  const ship = body.shipping as Record<string, string> | undefined;
  if (
    !ship ||
    !ship.name?.trim() ||
    !ship.street1?.trim() ||
    !ship.city?.trim() ||
    !ship.state_code?.trim() ||
    !ship.postcode?.trim()
  ) {
    return NextResponse.json(
      { error: "complete shipping address required" },
      { status: 400 }
    );
  }

  const shipping = {
    name: ship.name.trim(),
    street1: ship.street1.trim(),
    street2: (ship.street2 || "").trim() || undefined,
    city: ship.city.trim(),
    state_code: ship.state_code.trim().toUpperCase(),
    postcode: ship.postcode.trim(),
    country_code: "US",
    phone_number: (ship.phone || "").replace(/\D/g, "") || undefined,
  };

  const approvalToken = randomUUID();

  const row = {
    book_slug: slug,
    child_name: childName,
    skin,
    hair,
    hair_style: hairStyle,
    customer_email: email,
    shipping,
    status: "pending",
    approval_token: approvalToken,
  };

  const r = await fetch(`${SB}/rest/v1/orders`, {
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
    console.error("order insert fail:", err);
    return NextResponse.json({ error: "order failed" }, { status: 500 });
  }

  const [created] = await r.json();

  /* log event */
  await fetch(`${SB}/rest/v1/order_events`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${KEY}`,
      apikey: KEY!,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      order_id: created.id,
      event: "placed",
    }),
  });

  return NextResponse.json({
    ok: true,
    orderId: created.id,
    message: "Order received! We will generate your book and review it before printing.",
  });
}
