import { NextRequest, NextResponse } from "next/server";
import Stripe from "stripe";
import {
  BOOK_PRICE_CENTS,
  shippingCents,
  shippingLabel,
  CURRENCY,
} from "@/lib/pricing";

const SB = process.env.SUPABASE_URL?.replace(/\s/g, "").replace(/\/$/, "");
const KEY = process.env.SUPABASE_SERVICE_KEY?.replace(/\s/g, "");
const STRIPE_KEY = process.env.STRIPE_SECRET_KEY?.replace(/\s/g, "");

const SLUG_TITLES: Record<string, string> = {
  "her-beautiful-hijab": "and Her Beautiful Hijab",
  "juha-and-the-enormous-pumpkin": "Juha and the Enormous Pumpkin",
  "maryam-is-kind-to-her-parents": "Maryam is Kind to Her Parents",
};

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

  /* fetch the order — must exist and still be awaiting payment */
  const r = await fetch(
    `${SB}/rest/v1/orders?id=eq.${orderId}&select=id,status,book_slug,child_name,customer_email,shipping`,
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

  const country = (order.shipping?.country_code || "US").toUpperCase();
  const ship = shippingCents(country);

  /* Product name shown on the Stripe page and the receipt */
  const childName = order.child_name?.trim();
  const bookName =
    order.book_slug === "her-beautiful-hijab" && childName
      ? `${childName} and Her Beautiful Hijab`
      : SLUG_TITLES[order.book_slug] || "Ketabi Studio Book";

  const origin =
    req.headers.get("origin") ||
    process.env.NEXT_PUBLIC_SITE_URL ||
    "https://ketabistudio-web.vercel.app";

  try {
    const session = await stripe.checkout.sessions.create({
      mode: "payment",
      customer_email: order.customer_email,
      line_items: [
        {
          quantity: 1,
          price_data: {
            currency: CURRENCY,
            unit_amount: BOOK_PRICE_CENTS,
            product_data: {
              name: bookName,
              description: "Personalized hardcover-quality keepsake, printed to order",
            },
          },
        },
        {
          quantity: 1,
          price_data: {
            currency: CURRENCY,
            unit_amount: ship,
            product_data: { name: shippingLabel(country) },
          },
        },
      ],
      metadata: { orderId: order.id },
      payment_intent_data: { metadata: { orderId: order.id } },
      success_url: `${origin}/order/success?id=${order.id}`,
      cancel_url: `${origin}/order/cancelled?id=${order.id}`,
    });

    /* store the session id on the order for reconciliation (in notes,
       to avoid a schema migration) */
    await fetch(`${SB}/rest/v1/orders?id=eq.${order.id}`, {
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
    console.error("stripe session error:", e);
    return NextResponse.json(
      { error: "could not start checkout" },
      { status: 502 }
    );
  }
}
