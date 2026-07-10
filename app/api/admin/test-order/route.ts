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

// GET ?id=<orderId> — read back an order's status + QC/cost report (owner).
export async function GET(req: NextRequest) {
  const auth = (req.headers.get("authorization") || "").trim();
  if (!CRON_SECRET || auth !== `Bearer ${CRON_SECRET}`) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }
  if (!SB || !KEY) return NextResponse.json({ error: "not configured" }, { status: 500 });
  const id = req.nextUrl.searchParams.get("id") || "";
  const slug = req.nextUrl.searchParams.get("slug") || "";
  if (!id && !slug) return NextResponse.json({ error: "id or slug required" }, { status: 400 });
  const filter = id
    ? `id=eq.${encodeURIComponent(id)}`
    : `book_slug=eq.${encodeURIComponent(slug)}&options->>source=eq.owner_test&order=created_at.desc&limit=3`;
  const r = await fetch(
    `${SB}/rest/v1/orders?${filter}&select=id,status,book_slug,qc_report,created_at`,
    { headers: { Authorization: `Bearer ${KEY}`, apikey: KEY }, cache: "no-store" }
  );
  const rows = await r.json().catch(() => []);
  return NextResponse.json({
    ok: true,
    order: Array.isArray(rows) ? rows[0] || null : null,
    orders: Array.isArray(rows) ? rows : [],
  });
}

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
  // owner actions on an existing order: cancel (reject) or reset (reprocess)
  const action = String((body as Record<string, unknown>).action || "");
  const targetId = String((body as Record<string, unknown>).orderId || "");
  if (action === "files") {
    // Signed download URLs for the EXACT files the worker submitted to Lulu,
    // so print output can be verified against the real bytes (not the
    // portal's thumbnail card, which pads every preview).
    if (!targetId) return NextResponse.json({ error: "orderId required" }, { status: 400 });
    const or_ = await fetch(
      `${SB}/rest/v1/orders?id=eq.${encodeURIComponent(targetId)}&select=interior_path,cover_path`,
      { headers: { Authorization: `Bearer ${KEY}`, apikey: KEY } }
    );
    const rows_ = (await or_.json().catch(() => [])) as { interior_path?: string; cover_path?: string }[];
    if (!rows_[0]) return NextResponse.json({ error: "order not found" }, { status: 404 });
    const sign = async (path?: string) => {
      if (!path) return null;
      const s = await fetch(`${SB}/storage/v1/object/sign/orders/${path}`, {
        method: "POST",
        headers: { Authorization: `Bearer ${KEY}`, apikey: KEY, "Content-Type": "application/json" },
        body: JSON.stringify({ expiresIn: 3600 }),
      });
      const d = (await s.json().catch(() => ({}))) as { signedURL?: string };
      return d.signedURL ? `${SB}/storage/v1${d.signedURL}` : null;
    };
    return NextResponse.json({
      ok: true,
      interior_url: await sign(rows_[0].interior_path),
      cover_url: await sign(rows_[0].cover_path),
    });
  }
  if (action) {
    if (!targetId) return NextResponse.json({ error: "orderId required" }, { status: 400 });
    const status =
      action === "cancel" ? "rejected"
      : action === "reset" ? "pending"
      : action === "approve" ? "approved"   // owner go-ahead: worker submits to Lulu
      : "";
    if (!status) return NextResponse.json({ error: "unknown action" }, { status: 400 });
    // approve is only valid from awaiting_approval; others from any in-flight state
    const guard = action === "approve"
      ? "&status=eq.awaiting_approval"
      : "&status=in.(pending,generating,qc_passed,validated,awaiting_approval,failed)";
    const pr = await fetch(`${SB}/rest/v1/orders?id=eq.${encodeURIComponent(targetId)}${guard}`, {
      method: "PATCH",
      headers: { Authorization: `Bearer ${KEY}`, apikey: KEY, "Content-Type": "application/json", Prefer: "return=representation" },
      body: JSON.stringify({ status }),
    });
    const rows = await pr.json().catch(() => []);
    return NextResponse.json({ ok: true, action, changed: Array.isArray(rows) ? rows.length : 0 });
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
