import { NextRequest, NextResponse } from "next/server";

// Returns the Meta publishing credentials (page token, IG user id, page id) to
// trusted tooling (Bearer CRON_SECRET — same trust level as the other admin
// routes). Lets long-running publishes (reel video processing) be driven from
// outside the serverless timeout, mirroring /api/etsy/token.
export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const SB = process.env.SUPABASE_URL?.replace(/\s/g, "").replace(/\/$/, "");
const KEY = process.env.SUPABASE_SERVICE_KEY?.replace(/\s/g, "");
const CRON_SECRET = process.env.CRON_SECRET?.trim();

export async function GET(req: NextRequest) {
  const auth = (req.headers.get("authorization") || "").trim();
  if (!CRON_SECRET || auth !== `Bearer ${CRON_SECRET}`) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }
  const r = await fetch(`${SB}/rest/v1/social_config?id=eq.1&select=meta_page_token,meta_ig_id,meta_page_id`, {
    headers: { Authorization: `Bearer ${KEY}`, apikey: KEY as string },
    cache: "no-store",
  });
  const rows = (await r.json()) as { meta_page_token?: string; meta_ig_id?: string; meta_page_id?: string }[];
  const cfg = rows?.[0];
  if (!cfg?.meta_page_token) return NextResponse.json({ error: "not seeded" }, { status: 502 });
  return NextResponse.json({
    page_token: cfg.meta_page_token,
    ig_id: cfg.meta_ig_id || null,
    page_id: cfg.meta_page_id || null,
  });
}
