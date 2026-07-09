import { NextRequest, NextResponse } from "next/server";
import { randomUUID } from "crypto";

// Owner-only (Bearer CRON_SECRET): create a fulfillment order that BYPASSES
// site payment entirely — it enters the pipeline at status "pending", exactly
// where the Stripe webhook would have put it, so the worker generates it and
// parks it at awaiting_approval. On approval, Lulu prints and bills the
// owner's Lulu account directly. Used for owner test copies (e.g. the From One
// Root coil journal proof).
//
// Body: { book_slug: string, shipping?: {...} }
// If shipping is omitted, it is copied from the owner's most recent order that
// carries a complete address (their earlier test-book orders).

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const SB = process.env.SUPABASE_URL?.replace(/\s/g, "").replace(/\/$/, "");
const KEY = process.env.SUPABASE_SERVICE_KEY?.replace(/\s/g, "");
const CRON_SECRET = process.env.CRON_SECRET?.trim();
const OWNER_EMAIL = process.env.ETSY_NOTIFY_EMAIL || "ketabistudio@gmail.com";

const ALLOWED_SLUGS = new Set([
  "from-one-root-journal",
  "maryam-is-kind-to-her-parents",
  "juha-and-the-enormous-pumpkin",
]);

export async function POST(req: NextRequest) {
  const auth = (req.headers.get("authorization") || "").trim();
  if (!CRON_SECRET || auth !== `Bearer ${CRON_SECRET}`) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }
  if (!SB || !KEY) return NextResponse.json({ error: "not configured" }, { status: 500 });

  let body: { book_slug?: string; shipping?: Record<string, string> };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "invalid json" }, { status: 400 });
  }
  const slug = String(body.book_slug || "");
  if (!ALLOWED_SLUGS.has(slug)) {
    return NextResponse.json({ error: "unknown book_slug" }, { status: 400 });
  }

  let shipping = body.shipping || null;
  if (!shipping) {
    // Reuse the owner's most recent complete shipping address.
    const r = await fetch(
      `${SB}/rest/v1/orders?select=shipping,customer_email&order=created_at.desc&limit=20`,
      { headers: { Authorization: `Bearer ${KEY}`, apikey: KEY }, cache: "no-store" }
    );
    const rows = (await r.json().catch(() => [])) as Array<{
      shipping?: Record<string, string>;
    }>;
    shipping =
      rows.map((x) => x.shipping).find(
        (s) => s && s.street1 && s.city && s.postcode && s.phone_number
      ) || null;
  }
  if (!shipping) {
    return NextResponse.json(
      { error: "no shipping address found; pass one in the body" },
      { status: 400 }
    );
  }

  const row = {
    book_slug: slug,
    child_name: null, skin: null, hair: null, hair_style: null,
    options: { source: "owner_test" },
    cover_type: "softcover",
    customer_email: OWNER_EMAIL,
    shipping,
    status: "pending",
    approval_token: randomUUID(),
  };
  const ins = await fetch(`${SB}/rest/v1/orders`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${KEY}`, apikey: KEY,
      "Content-Type": "application/json", Prefer: "return=representation",
    },
    body: JSON.stringify(row),
  });
  if (!ins.ok) {
    return NextResponse.json(
      { error: "insert failed", detail: (await ins.text()).slice(0, 300) },
      { status: 500 }
    );
  }
  const [created] = (await ins.json()) as Array<{ id: string }>;
  await fetch(`${SB}/rest/v1/order_events`, {
    method: "POST",
    headers: { Authorization: `Bearer ${KEY}`, apikey: KEY, "Content-Type": "application/json" },
    body: JSON.stringify({ order_id: created.id, event: "owner_test_order" }),
  });
  return NextResponse.json({
    ok: true, orderId: created.id,
    shipTo: `${shipping.city}, ${shipping.state_code || ""} ${shipping.country_code || ""}`,
  });
}
