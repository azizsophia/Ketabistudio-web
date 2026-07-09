import { NextRequest, NextResponse } from "next/server";
import { randomUUID } from "crypto";
import { etsyFetch, getShopId } from "@/lib/etsy";

// Etsy order watcher. Reads paid, unshipped Etsy receipts and drops each one
// for a mapped book into the EXISTING orders pipeline as status="pending" —
// exactly like a paid website order — so the worker generates it and parks it
// at awaiting_approval for the owner to approve before it prints. Idempotent on
// the Etsy receipt id (stored in orders.options.etsy_receipt), so re-runs never
// duplicate a print job.
//
// Etsy privacy means receipts carry NO buyer email or phone, so we use the shop
// email for internal notices and a fallback phone Lulu accepts. Etsy itself
// notifies the buyer once the order is marked shipped.
//
// GET/POST with Bearer CRON_SECRET or ?key=CRON_SECRET. Add ?dry=1 to preview
// without inserting anything.

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const SB = process.env.SUPABASE_URL?.replace(/\s/g, "").replace(/\/$/, "");
const KEY = process.env.SUPABASE_SERVICE_KEY?.replace(/\s/g, "");
const CRON_SECRET = process.env.CRON_SECRET?.trim();
const FALLBACK_PHONE = (process.env.ETSY_FALLBACK_PHONE || "8005550100").replace(/[^\d+]/g, "");
const NOTIFY_EMAIL = process.env.ETSY_NOTIFY_EMAIL || "ketabistudio@gmail.com";

// Which Etsy listing fulfils which book. Fixed (non-personalized) books only,
// for now — those need no buyer personalization step.
const LISTING_TO_SLUG: Record<string, string> = {
  "4535335357": "maryam-is-kind-to-her-parents",
  "4535351858": "juha-and-the-enormous-pumpkin",
};

// Lulu MAIL-serviceable countries (mirrors app/api/orders). US-only listing for
// the pilot, but we guard anyway.
const VALID_COUNTRIES = new Set([
  "US","AU","AT","BE","CA","DK","EG","FI","FR","DE","IE","IT",
  "MY","NL","NZ","NO","SA","SG","ZA","ES","SE","CH","TR","GB",
]);

type Receipt = {
  receipt_id: number;
  name?: string;
  first_line?: string;
  second_line?: string;
  city?: string;
  state?: string;
  zip?: string;
  country_iso?: string;
  transactions?: { listing_id?: number }[];
};

function authorized(req: NextRequest): boolean {
  const auth = (req.headers.get("authorization") || "").trim();
  if (CRON_SECRET && auth === `Bearer ${CRON_SECRET}`) return true;
  const k = req.nextUrl.searchParams.get("key");
  return !!CRON_SECRET && k === CRON_SECRET;
}

async function alreadyImported(receiptId: number): Promise<boolean> {
  const r = await fetch(
    `${SB}/rest/v1/orders?options->>etsy_receipt=eq.${receiptId}&select=id&limit=1`,
    { headers: { Authorization: `Bearer ${KEY}`, apikey: KEY! }, cache: "no-store" }
  );
  const rows = await r.json().catch(() => []);
  return Array.isArray(rows) && rows.length > 0;
}

async function handle(req: NextRequest) {
  if (!authorized(req)) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  if (!SB || !KEY) return NextResponse.json({ error: "not configured" }, { status: 500 });

  const dry = req.nextUrl.searchParams.get("dry") === "1";
  const shop = await getShopId();
  if (!shop) return NextResponse.json({ error: "no shop id" }, { status: 500 });

  const rr = await etsyFetch(
    `/shops/${shop}/receipts?was_paid=true&was_shipped=false&limit=25`
  );
  if (!rr.ok) {
    return NextResponse.json({ error: "receipts fetch failed", detail: (await rr.text()).slice(0, 300) }, { status: 502 });
  }
  const data = (await rr.json()) as { results?: Receipt[] };
  const receipts = data.results || [];

  const out: { inserted: string[]; skipped: string[]; ignored: number } = {
    inserted: [], skipped: [], ignored: 0,
  };

  for (const rc of receipts) {
    const slug = (rc.transactions || [])
      .map((t) => LISTING_TO_SLUG[String(t.listing_id)])
      .find(Boolean);
    if (!slug) { out.ignored++; continue; }

    if (await alreadyImported(rc.receipt_id)) { out.skipped.push(`${rc.receipt_id} (dup)`); continue; }

    const country = (rc.country_iso || "US").toUpperCase();
    if (!VALID_COUNTRIES.has(country)) { out.skipped.push(`${rc.receipt_id} (country ${country})`); continue; }

    const shipping = {
      name: (rc.name || "").trim() || "Etsy Buyer",
      street1: (rc.first_line || "").trim(),
      street2: (rc.second_line || "").trim() || undefined,
      city: (rc.city || "").trim(),
      state_code: (rc.state || "").trim().toUpperCase() || undefined,
      postcode: (rc.zip || "").trim(),
      country_code: country,
      phone_number: FALLBACK_PHONE,
    };

    if (dry) { out.inserted.push(`${rc.receipt_id} -> ${slug} (DRY, ${shipping.city} ${shipping.state_code})`); continue; }

    const row = {
      book_slug: slug,
      child_name: null, skin: null, hair: null, hair_style: null,
      options: { etsy_receipt: String(rc.receipt_id), source: "etsy", buyer_name: shipping.name },
      cover_type: "softcover",
      customer_email: NOTIFY_EMAIL,
      shipping,
      status: "pending",
      approval_token: randomUUID(),
    };
    const ins = await fetch(`${SB}/rest/v1/orders`, {
      method: "POST",
      headers: { Authorization: `Bearer ${KEY}`, apikey: KEY!, "Content-Type": "application/json", Prefer: "return=representation" },
      body: JSON.stringify(row),
    });
    if (!ins.ok) { out.skipped.push(`${rc.receipt_id} (insert failed: ${(await ins.text()).slice(0, 120)})`); continue; }
    const [created] = await ins.json();
    await fetch(`${SB}/rest/v1/order_events`, {
      method: "POST",
      headers: { Authorization: `Bearer ${KEY}`, apikey: KEY!, "Content-Type": "application/json" },
      body: JSON.stringify({ order_id: created.id, event: "etsy_import", detail: { receipt_id: rc.receipt_id } }),
    });
    out.inserted.push(`${rc.receipt_id} -> ${slug} (order ${created.id})`);
  }

  return NextResponse.json({ ok: true, dry, scanned: receipts.length, ...out });
}

export async function GET(req: NextRequest) { return handle(req); }
export async function POST(req: NextRequest) { return handle(req); }
