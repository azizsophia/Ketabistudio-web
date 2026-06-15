// Hifz subscription checkout.
//
// POST { plan: 'monthly' | 'annual' } → a Stripe Checkout Session in
// 'subscription' mode for the signed-in user. Find-or-create a Stripe customer
// and store it on hifz_subscriptions (service role) so the billing portal +
// webhook can reconcile later.

import { NextRequest, NextResponse } from "next/server";
import Stripe from "stripe";
import { CURRENCY, HIFZ_MONTHLY_CENTS, HIFZ_ANNUAL_CENTS } from "@/lib/pricing";
import { createClient } from "@/lib/supabase/server";
import {
  getHifzSubscriptionByUser,
  upsertHifzSubscription,
} from "@/lib/hifz/subscriptions";

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

  let body: { plan?: string };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "invalid json" }, { status: 400 });
  }

  const plan = body.plan === "annual" ? "annual" : "monthly";
  const unitAmount = plan === "annual" ? HIFZ_ANNUAL_CENTS : HIFZ_MONTHLY_CENTS;
  const interval = plan === "annual" ? "year" : "month";

  const stripe = new Stripe(STRIPE_KEY);

  const origin =
    req.headers.get("origin") ||
    process.env.NEXT_PUBLIC_SITE_URL ||
    "https://ketabistudio-web.vercel.app";

  try {
    // Find-or-create the Stripe customer for this user.
    const existing = await getHifzSubscriptionByUser(user.id);
    let customerId: string | undefined = existing?.stripe_customer_id || undefined;

    if (!customerId) {
      const customer = await stripe.customers.create({
        email: user.email ?? undefined,
        metadata: { user_id: user.id },
      });
      customerId = customer.id;
      await upsertHifzSubscription({
        user_id: user.id,
        stripe_customer_id: customerId,
        status: existing?.status ?? "free",
      });
    }

    const session = await stripe.checkout.sessions.create({
      mode: "subscription",
      customer: customerId,
      line_items: [
        {
          quantity: 1,
          price_data: {
            currency: CURRENCY,
            unit_amount: unitAmount,
            recurring: { interval },
            product_data: {
              name: `Ketabi Hifz — ${plan === "annual" ? "Annual" : "Monthly"}`,
            },
          },
        },
      ],
      metadata: { user_id: user.id, plan },
      subscription_data: { metadata: { user_id: user.id, plan } },
      success_url: `${origin}/hifz?welcome=1`,
      cancel_url: `${origin}/hifz`,
    });

    return NextResponse.json({ url: session.url });
  } catch (e) {
    console.error("hifz checkout error:", e);
    return NextResponse.json(
      { error: "could not start checkout" },
      { status: 502 }
    );
  }
}
