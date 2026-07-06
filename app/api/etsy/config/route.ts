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
  let body: { keystring?: string; shared_secret?: string };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "invalid json" }, { status: 400 });
  }
  const keystring = body.keystring?.trim();
  const shared_secret = body.shared_secret?.trim();
  if (!keystring) return NextResponse.json({ error: "keystring required" }, { status: 400 });
  await saveEtsyConfig({ keystring, shared_secret });
  return NextResponse.json({ ok: true, stored: "keystring" + (shared_secret ? "+secret" : "") });
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
