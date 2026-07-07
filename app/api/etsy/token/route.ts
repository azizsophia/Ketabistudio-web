import { NextRequest, NextResponse } from "next/server";
import { getValidToken } from "@/lib/etsy";

// Returns a live Etsy access token + api key so trusted tooling (Bearer
// CRON_SECRET, same trust level as every other admin route) can call
// openapi.etsy.com directly — needed for uploads bigger than the serverless
// body limit (e.g. the 16MB journal PDF as a listing file).
export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const CRON_SECRET = process.env.CRON_SECRET?.trim();

export async function GET(req: NextRequest) {
  const auth = (req.headers.get("authorization") || "").trim();
  if (!CRON_SECRET || auth !== `Bearer ${CRON_SECRET}`) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }
  const t = await getValidToken();
  if (!t) return NextResponse.json({ error: "not connected" }, { status: 502 });
  const apiKey = t.cfg.shared_secret
    ? `${t.cfg.keystring}:${t.cfg.shared_secret}`
    : (t.cfg.keystring as string);
  return NextResponse.json({ token: t.token, api_key: apiKey, shop_id: t.cfg.shop_id || null });
}
