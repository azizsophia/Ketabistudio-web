import { NextRequest, NextResponse } from "next/server";
import Stripe from "stripe";
import {
  DIGITAL_CARD_PRICE_CENTS,
  VOICE_ADDON_CENTS,
  CURRENCY,
} from "@/lib/pricing";
import { findCard } from "@/lib/cards";

export const runtime = "nodejs";

const SB = process.env.SUPABASE_URL?.replace(/\s/g, "").replace(/\/$/, "");
const KEY = process.env.SUPABASE_SERVICE_KEY?.replace(/\s/g, "");
const STRIPE_KEY = process.env.STRIPE_SECRET_KEY?.replace(/\s/g, "");

export async function POST(req: NextRequest) {
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

  /* fetch the digital card order — must exist and still be awaiting payment */
  const r = await fetch(
    `${SB}/rest/v1/digital_card_orders?id=eq.${orderId}&select=id,status,item_id,customer_email,token,has_voice`,
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

  const origin =
    req.headers.get("origin") ||
    process.env.NEXT_PUBLIC_SITE_URL ||
    "https://ketabistudio-web.vercel.app";

  const lineItems: Stripe.Checkout.SessionCreateParams.LineItem[] = [
    {
      quantity: 1,
      price_data: {
        currency: CURRENCY,
        unit_amount: DIGITAL_CARD_PRICE_CENTS,
        product_data: {
          name: `Digital greeting card, ${cardTitle}`,
          description:
            "A beautiful animated card delivered by a private link, ready to share instantly.",
        },
      },
    },
  ];
  if (order.has_voice && VOICE_ADDON_CENTS > 0) {
    lineItems.push({
      quantity: 1,
      price_data: {
        currency: CURRENCY,
        unit_amount: VOICE_ADDON_CENTS,
        product_data: {
          name: "Voice note add-on",
          description: "A personal recorded message that plays inside the card.",
        },
      },
    });
  }

  try {
    const session = await stripe.checkout.sessions.create({
      mode: "payment",
      customer_email: order.customer_email,
      line_items: lineItems,
      metadata: { digitalCardOrderId: order.id },
      payment_intent_data: { metadata: { digitalCardOrderId: order.id } },
      success_url: `${origin}/digital-cards/success?id=${order.id}`,
      cancel_url: `${origin}/digital-cards/cancelled?id=${order.id}`,
    });

    await fetch(`${SB}/rest/v1/digital_card_orders?id=eq.${order.id}`, {
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
    console.error("stripe digital card session error:", e);
    return NextResponse.json(
      { error: "could not start checkout" },
      { status: 502 }
    );
  }
}
