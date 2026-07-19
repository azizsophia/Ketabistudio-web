import { NextRequest, NextResponse } from "next/server";
import Stripe from "stripe";
import {
  CARD_PRICE_CENTS,
  CURRENCY,
  cardShippingCents,
  cardShippingLabel,
} from "@/lib/pricing";
import { findCard } from "@/lib/cards";

const SB = process.env.SUPABASE_URL?.replace(/\s/g, "").replace(/\/$/, "");
const KEY = process.env.SUPABASE_SERVICE_KEY?.replace(/\s/g, "");
const STRIPE_KEY = process.env.STRIPE_SECRET_KEY?.replace(/\s/g, "");

/* Physical greeting cards are RETIRED (owner call, 2026-07-18: print quality
   did not meet the bar). Guard mirrors /api/cards/order so no payment session
   can be created for a product we no longer fulfill. */
const PHYSICAL_CARDS_RETIRED = true;

export async function POST(req: NextRequest) {
  if (PHYSICAL_CARDS_RETIRED) {
    return NextResponse.json(
      { error: "Printed cards have been retired. Our digital cards live at /digital-cards." },
      { status: 410 }
    );
  }
  if (!SB || !KEY || !STRIPE_KEY) {
    return NextResponse.json({ error: "not configured" }, { status: 500 });
  }

  const stripe = new Stripe(STRIPE_KEY);

  let body: { orderId?: string };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "invalid json" }, { status: 400 });
  }

  const orderId = String(body.orderId || "");
  if (!orderId) {
    return NextResponse.json({ error: "orderId required" }, { status: 400 });
  }

  /* fetch the card order — must exist and still be awaiting payment */
  const r = await fetch(
    `${SB}/rest/v1/card_orders?id=eq.${orderId}&select=id,status,item_id,customer_email,shipping`,
    { headers: { Authorization: `Bearer ${KEY}`, apikey: KEY! }, cache: "no-store" }
  );
  const rows = await r.json();
  const order = Array.isArray(rows) ? rows[0] : null;
  if (!order) {
    return NextResponse.json({ error: "order not found" }, { status: 404 });
  }
  if (order.status !== "awaiting_payment") {
    return NextResponse.json(
      { error: "order is not awaiting payment" },
      { status: 409 }
    );
  }

  const cardTitle = findCard(order.item_id).title;

  /* Shipping is charged separately by zone (card price is the same worldwide).
     The country was captured + validated when the order was created. */
  const country = String(order.shipping?.country_code || "").toUpperCase();
  const shipCents = cardShippingCents(country);

  const origin =
    req.headers.get("origin") ||
    process.env.NEXT_PUBLIC_SITE_URL ||
    "https://ketabistudio-web.vercel.app";

  try {
    const session = await stripe.checkout.sessions.create({
      mode: "payment",
      allow_promotion_codes: true,
      customer_email: order.customer_email,
      line_items: [
        {
          quantity: 1,
          price_data: {
            currency: CURRENCY,
            unit_amount: CARD_PRICE_CENTS,
            product_data: {
              name: `Personalised greeting card, ${cardTitle}`,
              description:
                "Printed to order and posted directly to your recipient.",
            },
          },
        },
        ...(shipCents > 0
          ? [
              {
                quantity: 1,
                price_data: {
                  currency: CURRENCY,
                  unit_amount: shipCents,
                  product_data: { name: cardShippingLabel(country) },
                },
              },
            ]
          : []),
      ],
      metadata: { cardOrderId: order.id },
      payment_intent_data: { metadata: { cardOrderId: order.id } },
      success_url: `${origin}/cards/success?id=${order.id}`,
      cancel_url: `${origin}/cards/cancelled?id=${order.id}`,
    });

    /* store the session id on the card order for reconciliation (in notes,
       to avoid a schema migration) */
    await fetch(`${SB}/rest/v1/card_orders?id=eq.${order.id}`, {
      method: "PATCH",
      headers: {
        Authorization: `Bearer ${KEY}`,
        apikey: KEY!,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        notes: JSON.stringify({ stripe_session_id: session.id }),
      }),
    });

    return NextResponse.json({ url: session.url });
  } catch (e) {
    console.error("stripe card session error:", e);
    return NextResponse.json(
      { error: "could not start checkout" },
      { status: 502 }
    );
  }
}
