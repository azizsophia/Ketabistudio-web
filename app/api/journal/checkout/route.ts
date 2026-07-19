import { NextRequest, NextResponse } from "next/server";
import Stripe from "stripe";
import { CURRENCY, JOURNAL_PRICE_CENTS } from "@/lib/pricing";

/* On-site checkout for the From One Root journal (digital PDF; owner call
   2026-07-19: no Etsy reroute). No DB order needed — the product is the same
   file for every buyer, so the paid Stripe session itself is the receipt AND
   the download key (/api/journal/download?sid=...). The webhook emails the
   buyer their download link as a backup to the success page. */

export const runtime = "nodejs";

const STRIPE_KEY = process.env.STRIPE_SECRET_KEY?.replace(/\s/g, "");

export async function POST(req: NextRequest) {
  if (!STRIPE_KEY) {
    return NextResponse.json({ error: "not configured" }, { status: 500 });
  }
  const stripe = new Stripe(STRIPE_KEY);

  const origin =
    req.headers.get("origin") ||
    process.env.NEXT_PUBLIC_SITE_URL ||
    "https://www.ketabistudio.com";

  const session = await stripe.checkout.sessions.create({
    mode: "payment",
    allow_promotion_codes: true,
    line_items: [
      {
        quantity: 1,
        price_data: {
          currency: CURRENCY,
          unit_amount: JOURNAL_PRICE_CENTS,
          product_data: {
            name: "From One Root, the 30-day Qur'an journal (PDF)",
            description:
              "68 pages: thirty roots, a guide, glossary, tracker, sources and certificate. Instant digital download.",
          },
        },
      },
    ],
    metadata: { kind: "journal" },
    success_url: `${origin}/journal/success?sid={CHECKOUT_SESSION_ID}`,
    cancel_url: `${origin}/journal`,
  });

  return NextResponse.json({ url: session.url });
}
