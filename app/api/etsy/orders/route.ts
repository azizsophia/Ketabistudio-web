import { NextRequest, NextResponse } from "next/server";
import { getShopOrders } from "@/lib/etsy";

// Read recent paid Etsy orders + the buyer's personalization (the typed name),
// so personalized orders can be pulled programmatically instead of eyeballing
// the Shop Manager. Bearer CRON_SECRET. Needs the token to carry transactions_r
// (re-authorize once after this deploys).
export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const CRON_SECRET = process.env.CRON_SECRET?.trim();

export async function GET(req: NextRequest) {
  const auth = (req.headers.get("authorization") || "").trim();
  if (!CRON_SECRET || auth !== `Bearer ${CRON_SECRET}`) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }
  const limit = Math.min(100, Number(req.nextUrl.searchParams.get("limit")) || 25);
  const r = await getShopOrders(limit);
  if (!r.ok) return NextResponse.json({ error: r.detail }, { status: 502 });
  return NextResponse.json({ ok: true, count: r.orders?.length || 0, orders: r.orders });
}
