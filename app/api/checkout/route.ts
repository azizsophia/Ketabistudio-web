import { NextRequest, NextResponse } from "next/server";
import Stripe from "stripe";
import {
  bookPriceCents,
  shippingCents,
  shippingLabel,
  shipChargeFromLulu,
  shipSpecFor,
  isFreeShippingCountry,
  CURRENCY,
} from "@/lib/pricing";
import { luluShippingCents } from "@/lib/lulu";

const SB = process.env.SUPABASE_URL?.replace(/\s/g, "").replace(/\/$/, "");
const KEY = process.env.SUPABASE_SERVICE_KEY?.replace(/\s/g, "");
const STRIPE_KEY = process.env.STRIPE_SECRET_KEY?.replace(/\s/g, "");

const SLUG_TITLES: Record<string, string> = {
  "her-beautiful-hijab": "and Her Beautiful Hijab",
  "my-beautiful-duas": "Beautiful Duas",
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
    `${SB}/rest/v1/orders?id=eq.${orderId}&select=id,status,book_slug,child_name,customer_email,shipping,cover_type`,
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
  const coverType = order.cover_type === "hardcover" ? "hardcover" : "softcover";

  /* Shipping: FREE for the US (baked into the book price). International is
     charged real-time Lulu shipping (Option B), with a flat fallback if Lulu
     is unavailable so checkout never breaks. */
  let ship = 0;
  let shipName = "Free shipping";
  const addr = order.shipping;
  if (!isFreeShippingCountry(country)) {
    ship = shippingCents(country); // intl flat fallback
    shipName = shippingLabel(country);
    if (addr?.street1 && addr?.city && addr?.postcode) {
      const spec = shipSpecFor(order.book_slug, coverType);
      const quote = await luluShippingCents(
        {
          name: addr.name,
          street1: addr.street1,
          street2: addr.street2,
          city: addr.city,
          state_code: addr.state_code,
          postcode: addr.postcode,
          country_code: country,
          phone_number: addr.phone_number,
        },
        { pageCount: spec.pageCount, pod: spec.pod }
      );
      if (quote != null) {
        ship = shipChargeFromLulu(quote);
        shipName = "Shipping (International)";
      }
      console.log(
        `[checkout] order=${order.id} country=${country} ship=${
          quote != null ? "lulu" : "flat"
        } luluQuote=${quote ?? "null"} charge=${ship}`
      );
    }
  }

  /* Product name shown on the Stripe page and the receipt */
  const childName = order.child_name?.trim();
  let bookName: string;
  if (order.book_slug === "her-beautiful-hijab" && childName) {
    bookName = `${childName} and Her Beautiful Hijab`;
  } else if (order.book_slug === "my-beautiful-duas" && childName) {
    bookName = `${childName}'s Beautiful Duas`;
  } else {
    bookName = SLUG_TITLES[order.book_slug] || "Ketabi Studio Book";
  }
  /* Reflect the chosen cover in the product name shown on Stripe + receipt */
  bookName += coverType === "hardcover" ? " (Hardcover)" : " (Softcover)";

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
            unit_amount: bookPriceCents(coverType),
            product_data: {
              name: bookName,
              description:
                coverType === "hardcover"
                  ? "Personalized hardcover keepsake, printed to order"
                  : "Personalized softcover keepsake, printed to order",
            },
          },
        },
        // Shipping line only for non-free (international) orders.
        ...(ship > 0
          ? [
              {
                quantity: 1,
                price_data: {
                  currency: CURRENCY,
                  unit_amount: ship,
                  product_data: { name: shipName },
                },
              },
            ]
          : []),
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
