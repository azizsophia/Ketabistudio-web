import { NextRequest, NextResponse } from "next/server";
import { getValidToken, etsyFetch, getShopId } from "@/lib/etsy";

// Health check (Bearer CRON_SECRET): confirms the token is live and returns the
// connected shop's name — proof the whole chain (config -> authorize -> refresh)
// works before we start creating listings.
export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const CRON_SECRET = process.env.CRON_SECRET?.trim();

export async function GET(req: NextRequest) {
  const auth = (req.headers.get("authorization") || "").trim();
  if (!CRON_SECRET || auth !== `Bearer ${CRON_SECRET}`) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }
  const t = await getValidToken();
  if (!t) return NextResponse.json({ connected: false, reason: "no valid token" });
  const shop = await getShopId();
  let shopName: string | null = null;
  if (shop) {
    const r = await etsyFetch(`/shops/${shop}`);
    if (r.ok) shopName = ((await r.json()) as { shop_name?: string }).shop_name || null;
  }
  return NextResponse.json({ connected: true, shop_id: shop, shop_name: shopName });
}
