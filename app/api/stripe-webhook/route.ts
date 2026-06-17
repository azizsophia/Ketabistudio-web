import { NextRequest, NextResponse } from "next/server";
import Stripe from "stripe";
import {
  upsertHifzSubscription,
  getHifzSubscriptionByStripeId,
} from "@/lib/hifz/subscriptions";

const SB = process.env.SUPABASE_URL?.replace(/\s/g, "").replace(/\/$/, "");
const KEY = process.env.SUPABASE_SERVICE_KEY?.replace(/\s/g, "");
const STRIPE_KEY = process.env.STRIPE_SECRET_KEY?.replace(/\s/g, "");
const WEBHOOK_SECRET = process.env.STRIPE_WEBHOOK_SECRET?.replace(/\s/g, "");

/* Stripe needs the raw body to verify the signature, so disable parsing. */
export const runtime = "nodejs";

/* PATCH an order, optionally only when it is still in `onlyIfStatus`.
   Returns the number of rows actually changed — so repeat Stripe deliveries
   (auto-retries / manual resends) are idempotent and never re-trigger the
   worker, duplicate emails, or duplicate print jobs. */
async function patchOrder(
  orderId: string,
  fields: Record<string, unknown>,
  onlyIfStatus?: string
): Promise<number> {
  const guard = onlyIfStatus ? `&status=eq.${onlyIfStatus}` : "";
  const r = await fetch(`${SB}/rest/v1/orders?id=eq.${orderId}${guard}`, {
    method: "PATCH",
    headers: {
      Authorization: `Bearer ${KEY}`,
      apikey: KEY!,
      "Content-Type": "application/json",
      Prefer: "return=representation",
    },
    body: JSON.stringify(fields),
  });
  const rows = await r.json().catch(() => []);
  return Array.isArray(rows) ? rows.length : 0;
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

async function patchCardOrder(
  cardOrderId: string,
  fields: Record<string, unknown>,
  onlyIfStatus?: string
): Promise<number> {
  const guard = onlyIfStatus ? `&status=eq.${onlyIfStatus}` : "";
  const r = await fetch(
    `${SB}/rest/v1/card_orders?id=eq.${cardOrderId}${guard}`,
    {
      method: "PATCH",
      headers: {
        Authorization: `Bearer ${KEY}`,
        apikey: KEY!,
        "Content-Type": "application/json",
        Prefer: "return=representation",
      },
      body: JSON.stringify(fields),
    }
  );
  const rows = await r.json().catch(() => []);
  return Array.isArray(rows) ? rows.length : 0;
}

async function logCardEvent(
  cardOrderId: string,
  event: string,
  detail?: unknown
) {
  await fetch(`${SB}/rest/v1/card_order_events`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${KEY}`,
      apikey: KEY!,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ card_order_id: cardOrderId, event, detail }),
  });
}

/* ── Hifz subscription sync ──────────────────────────────────────────
   Maps a Stripe subscription to a hifz_subscriptions row and upserts it via
   the service role. Additive: never touches book/card one-time orders. */

function planFromSubscription(sub: Stripe.Subscription): string | null {
  const meta = sub.metadata?.plan;
  if (meta === "monthly" || meta === "annual" || meta === "lifetime") {
    return meta;
  }
  const interval = sub.items.data[0]?.price?.recurring?.interval;
  if (interval === "year") return "annual";
  if (interval === "month") return "monthly";
  return null;
}

function periodEndIso(sub: Stripe.Subscription): string | null {
  // current_period_end lives on the subscription item in newer API versions.
  const itemEnd = sub.items.data[0]?.current_period_end;
  const end =
    itemEnd ??
    (sub as unknown as { current_period_end?: number }).current_period_end;
  return end ? new Date(end * 1000).toISOString() : null;
}

async function syncSubscription(
  sub: Stripe.Subscription,
  userIdHint?: string
) {
  const userId =
    sub.metadata?.user_id ||
    userIdHint ||
    (await getHifzSubscriptionByStripeId(sub.id))?.user_id;

  if (!userId) {
    console.error("[hifz webhook] no user_id for subscription", sub.id);
    return;
  }

  await upsertHifzSubscription({
    user_id: userId,
    status: sub.status,
    plan: planFromSubscription(sub),
    stripe_customer_id:
      typeof sub.customer === "string" ? sub.customer : sub.customer.id,
    stripe_subscription_id: sub.id,
    current_period_end: periodEndIso(sub),
  });
  console.log(`[hifz ${userId}] subscription ${sub.id} → ${sub.status}`);
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

    /* Hifz subscription checkout — only for subscription-mode sessions, so
       one-time book/card payments below are never affected. */
    if (session.mode === "subscription" && session.subscription) {
      const userId = session.metadata?.user_id;
      const subId =
        typeof session.subscription === "string"
          ? session.subscription
          : session.subscription.id;
      try {
        const sub = await stripe.subscriptions.retrieve(subId);
        await syncSubscription(sub, userId);
      } catch (e) {
        console.error("[hifz webhook] retrieve subscription failed", e);
      }
      return NextResponse.json({ received: true });
    }

    const cardOrderId = session.metadata?.cardOrderId;
    if (cardOrderId && session.payment_status === "paid") {
      const changed = await patchCardOrder(
        cardOrderId,
        {
          status: "pending",
          notes: JSON.stringify({
            paid: true,
            stripe_session_id: session.id,
            stripe_payment_intent: String(session.payment_intent || ""),
            amount_paid_cents: session.amount_total ?? null,
          }),
        },
        "awaiting_payment"
      );
      if (changed) {
        await logCardEvent(cardOrderId, "paid", {
          amount: session.amount_total,
          currency: session.currency,
        });
        console.log(`[card ${cardOrderId}] paid → released to worker`);
      } else {
        console.log(`[card ${cardOrderId}] duplicate paid event ignored`);
      }
    }
    const orderId = session.metadata?.orderId;
    if (orderId && session.payment_status === "paid") {
      const changed = await patchOrder(
        orderId,
        {
          status: "pending",
          notes: JSON.stringify({
            paid: true,
            stripe_session_id: session.id,
            stripe_payment_intent: String(session.payment_intent || ""),
            amount_paid_cents: session.amount_total ?? null,
          }),
        },
        "awaiting_payment"
      );
      if (changed) {
        await logEvent(orderId, "paid", {
          amount: session.amount_total,
          currency: session.currency,
        });
        console.log(`[${orderId}] paid → released to worker`);
      } else {
        console.log(`[${orderId}] duplicate paid event ignored`);
      }
    }
  }

  /* Async payment success (e.g. some intl methods settle later) */
  if (event.type === "checkout.session.async_payment_succeeded") {
    const session = event.data.object as Stripe.Checkout.Session;
    const cardOrderId = session.metadata?.cardOrderId;
    if (cardOrderId) {
      const changed = await patchCardOrder(
        cardOrderId,
        {
          status: "pending",
          notes: JSON.stringify({ paid: true, stripe_session_id: session.id }),
        },
        "awaiting_payment"
      );
      if (changed) await logCardEvent(cardOrderId, "paid_async");
    }
    const orderId = session.metadata?.orderId;
    if (orderId) {
      const changed = await patchOrder(
        orderId,
        {
          status: "pending",
          notes: JSON.stringify({ paid: true, stripe_session_id: session.id }),
        },
        "awaiting_payment"
      );
      if (changed) await logEvent(orderId, "paid_async");
    }
  }

  /* Async payment failed → mark so it is not generated (only if still awaiting) */
  if (event.type === "checkout.session.async_payment_failed") {
    const session = event.data.object as Stripe.Checkout.Session;
    const cardOrderId = session.metadata?.cardOrderId;
    if (cardOrderId) {
      const changed = await patchCardOrder(
        cardOrderId,
        { status: "payment_failed" },
        "awaiting_payment"
      );
      if (changed) await logCardEvent(cardOrderId, "payment_failed");
    }
    const orderId = session.metadata?.orderId;
    if (orderId) {
      const changed = await patchOrder(
        orderId,
        { status: "payment_failed" },
        "awaiting_payment"
      );
      if (changed) await logEvent(orderId, "payment_failed");
    }
  }

  /* Subscription lifecycle (renewals, plan changes, cancellations) */
  if (event.type === "customer.subscription.updated") {
    const sub = event.data.object as Stripe.Subscription;
    await syncSubscription(sub);
  }

  if (event.type === "customer.subscription.deleted") {
    const sub = event.data.object as Stripe.Subscription;
    const userId =
      sub.metadata?.user_id ||
      (await getHifzSubscriptionByStripeId(sub.id))?.user_id;
    if (userId) {
      await upsertHifzSubscription({
        user_id: userId,
        status: "canceled",
        stripe_subscription_id: sub.id,
        current_period_end: periodEndIso(sub),
      });
      console.log(`[hifz ${userId}] subscription ${sub.id} → canceled`);
    }
  }

  return NextResponse.json({ received: true });
}
