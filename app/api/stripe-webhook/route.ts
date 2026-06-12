import { NextRequest, NextResponse } from "next/server";
import Stripe from "stripe";

const SB = process.env.SUPABASE_URL?.replace(/\s/g, "").replace(/\/$/, "");
const KEY = process.env.SUPABASE_SERVICE_KEY?.replace(/\s/g, "");
const STRIPE_KEY = process.env.STRIPE_SECRET_KEY?.replace(/\s/g, "");
const WEBHOOK_SECRET = process.env.STRIPE_WEBHOOK_SECRET?.replace(/\s/g, "");

/* Stripe needs the raw body to verify the signature, so disable parsing. */
export const runtime = "nodejs";

async function patchOrder(orderId: string, fields: Record<string, unknown>) {
  await fetch(`${SB}/rest/v1/orders?id=eq.${orderId}`, {
    method: "PATCH",
    headers: {
      Authorization: `Bearer ${KEY}`,
      apikey: KEY!,
      "Content-Type": "application/json",
    },
    body: JSON.stringify(fields),
  });
}

async function logEvent(orderId: string, event: string, detail?: unknown) {
  await fetch(`${SB}/rest/v1/order_events`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${KEY}`,
      apikey: KEY!,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ order_id: orderId, event, detail }),
  });
}

export async function POST(req: NextRequest) {
  if (!SB || !KEY || !STRIPE_KEY || !WEBHOOK_SECRET) {
    return NextResponse.json({ error: "not configured" }, { status: 500 });
  }

  const stripe = new Stripe(STRIPE_KEY);
  const sig = req.headers.get("stripe-signature");
  if (!sig) {
    return NextResponse.json({ error: "no signature" }, { status: 400 });
  }

  const raw = await req.text();
  let event: Stripe.Event;
  try {
    event = stripe.webhooks.constructEvent(raw, sig, WEBHOOK_SECRET);
  } catch (e) {
    console.error("webhook signature verification failed:", e);
    return NextResponse.json({ error: "bad signature" }, { status: 400 });
  }

  /* Payment confirmed → release the order to the worker (status=pending).
     The worker only generates + prints from pending/approved, so this is
     the single gate that turns money into production. */
  if (event.type === "checkout.session.completed") {
    const session = event.data.object as Stripe.Checkout.Session;
    const orderId = session.metadata?.orderId;
    if (orderId && session.payment_status === "paid") {
      await patchOrder(orderId, {
        status: "pending",
        notes: JSON.stringify({
          paid: true,
          stripe_session_id: session.id,
          stripe_payment_intent: String(session.payment_intent || ""),
          amount_paid_cents: session.amount_total ?? null,
        }),
      });
      await logEvent(orderId, "paid", {
        amount: session.amount_total,
        currency: session.currency,
      });
      console.log(`[${orderId}] paid → released to worker`);
    }
  }

  /* Async payment success (e.g. some intl methods settle later) */
  if (event.type === "checkout.session.async_payment_succeeded") {
    const session = event.data.object as Stripe.Checkout.Session;
    const orderId = session.metadata?.orderId;
    if (orderId) {
      await patchOrder(orderId, {
        status: "pending",
        notes: JSON.stringify({ paid: true, stripe_session_id: session.id }),
      });
      await logEvent(orderId, "paid_async");
    }
  }

  /* Async payment failed → mark so it is not generated */
  if (event.type === "checkout.session.async_payment_failed") {
    const session = event.data.object as Stripe.Checkout.Session;
    const orderId = session.metadata?.orderId;
    if (orderId) {
      await patchOrder(orderId, { status: "payment_failed" });
      await logEvent(orderId, "payment_failed");
    }
  }

  return NextResponse.json({ received: true });
}
