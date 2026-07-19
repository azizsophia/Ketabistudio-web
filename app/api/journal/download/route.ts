import { NextRequest, NextResponse } from "next/server";
import Stripe from "stripe";
import { readFile } from "fs/promises";
import path from "path";

/* Streams the journal PDF to a verified buyer. The download key is the buyer's
   own Stripe checkout session id (unguessable, retrievable forever), so the
   emailed link keeps working with no expiry and no DB. Verification is strict:
   the session must exist, be PAID, and carry our kind=journal metadata. */

export const runtime = "nodejs";

const STRIPE_KEY = process.env.STRIPE_SECRET_KEY?.replace(/\s/g, "");
const PDF_PATH = path.join(
  process.cwd(),
  "assets",
  "downloads",
  "Ketabi-From-One-Root-Journal-2E.pdf"
);

export async function GET(req: NextRequest) {
  if (!STRIPE_KEY) {
    return NextResponse.json({ error: "not configured" }, { status: 500 });
  }
  const sid = req.nextUrl.searchParams.get("sid") || "";
  if (!/^cs_[a-zA-Z0-9_]+$/.test(sid)) {
    return NextResponse.json({ error: "invalid link" }, { status: 400 });
  }

  const stripe = new Stripe(STRIPE_KEY);
  let session: Stripe.Checkout.Session;
  try {
    session = await stripe.checkout.sessions.retrieve(sid);
  } catch {
    return NextResponse.json({ error: "unknown purchase" }, { status: 404 });
  }
  if (session.payment_status !== "paid" || session.metadata?.kind !== "journal") {
    return NextResponse.json({ error: "purchase not verified" }, { status: 403 });
  }

  const pdf = await readFile(PDF_PATH);
  return new NextResponse(new Uint8Array(pdf), {
    headers: {
      "Content-Type": "application/pdf",
      "Content-Disposition":
        'attachment; filename="Ketabi-From-One-Root-Journal.pdf"',
      "Content-Length": String(pdf.length),
      "Cache-Control": "private, no-store",
    },
  });
}
