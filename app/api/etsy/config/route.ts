import { NextRequest, NextResponse } from "next/server";
import { saveEtsyConfig, loadEtsyConfig } from "@/lib/etsy";

// One-time: store the Etsy app keystring + shared secret server-side (private
// Supabase bucket, never git). Bearer CRON_SECRET. Call once, then never again.
export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const CRON_SECRET = process.env.CRON_SECRET?.trim();

export async function POST(req: NextRequest) {
  const auth = (req.headers.get("authorization") || "").trim();
  if (!CRON_SECRET || auth !== `Bearer ${CRON_SECRET}`) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }
  let body: { keystring?: string; shared_secret?: string; shop_id?: number };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "invalid json" }, { status: 400 });
  }
  const patch: { keystring?: string; shared_secret?: string; shop_id?: number } = {};
  if (body.keystring?.trim()) patch.keystring = body.keystring.trim();
  if (body.shared_secret?.trim()) patch.shared_secret = body.shared_secret.trim();
  if (body.shop_id) patch.shop_id = Number(body.shop_id);
  if (!Object.keys(patch).length) {
    return NextResponse.json({ error: "nothing to store" }, { status: 400 });
  }
  await saveEtsyConfig(patch);
  return NextResponse.json({ ok: true, stored: Object.keys(patch).join("+") });
}

// GET (Bearer) reports connection status without leaking secrets.
export async function GET(req: NextRequest) {
  const auth = (req.headers.get("authorization") || "").trim();
  if (!CRON_SECRET || auth !== `Bearer ${CRON_SECRET}`) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }
  const cfg = await loadEtsyConfig();
  return NextResponse.json({
    has_keystring: !!cfg?.keystring,
    has_secret: !!cfg?.shared_secret,
    connected: !!cfg?.refresh_token,
    shop_id: cfg?.shop_id || null,
    token_expires_at: cfg?.expires_at || null,
  });
}
