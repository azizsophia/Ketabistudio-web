// Stripe billing portal — lets a subscriber manage / cancel their plan.
// POST → { url } to the hosted portal, returning to /hifz/account.

import { NextRequest, NextResponse } from "next/server";
import Stripe from "stripe";
import { createClient } from "@/lib/supabase/server";
import { getHifzSubscriptionByUser } from "@/lib/hifz/subscriptions";

const STRIPE_KEY = process.env.STRIPE_SECRET_KEY?.replace(/\s/g, "");

export const runtime = "nodejs";

export async function POST(req: NextRequest) {
  if (!STRIPE_KEY) {
    return NextResponse.json({ error: "not configured" }, { status: 500 });
  }

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: "not signed in" }, { status: 401 });
  }

  const sub = await getHifzSubscriptionByUser(user.id);
  const customerId = sub?.stripe_customer_id;
  if (!customerId) {
    return NextResponse.json(
      { error: "no subscription to manage" },
      { status: 404 }
    );
  }

  const origin =
    req.headers.get("origin") ||
    process.env.NEXT_PUBLIC_SITE_URL ||
    "https://ketabistudio-web.vercel.app";

  try {
    const stripe = new Stripe(STRIPE_KEY);
    const portal = await stripe.billingPortal.sessions.create({
      customer: customerId,
      return_url: `${origin}/hifz/account`,
    });
    return NextResponse.json({ url: portal.url });
  } catch (e) {
    console.error("hifz portal error:", e);
    return NextResponse.json(
      { error: "could not open billing portal" },
      { status: 502 }
    );
  }
}
