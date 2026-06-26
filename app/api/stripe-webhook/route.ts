import { NextRequest, NextResponse } from "next/server";
import Stripe from "stripe";
import { findCard } from "@/lib/cards";
import { cardHeadline, occasionPhrase } from "@/lib/digitalCard";

const SB = process.env.SUPABASE_URL?.replace(/\s/g, "").replace(/\/$/, "");
const KEY = process.env.SUPABASE_SERVICE_KEY?.replace(/\s/g, "");
const STRIPE_KEY = process.env.STRIPE_SECRET_KEY?.replace(/\s/g, "");
const WEBHOOK_SECRET = process.env.STRIPE_WEBHOOK_SECRET?.replace(/\s/g, "");
const RESEND_API_KEY = process.env.RESEND_API_KEY?.replace(/\s/g, "");
const EMAIL_FROM =
  process.env.EMAIL_FROM?.trim() ||
  "Ketabi Studio <orders@ketabistudio.com>";
const SITE_URL = (
  process.env.NEXT_PUBLIC_SITE_URL || "https://ketabistudio-web.vercel.app"
).replace(/\/$/, "");

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

type DigitalCardOrder = {
  id: string;
  token: string;
  item_id: string;
  sender: string | null;
  recipient_name: string | null;
  deliver_email: boolean;
  recipient_email: string | null;
  customer_email: string | null;
  scheduled_at: string | null;
  email_sent: boolean;
};

/* PATCH a digital card order, returning the updated rows (representation), so
   the single delivery that flips awaiting_payment → paid is the one that
   sends the recipient email — keeping it idempotent across Stripe retries. */
async function patchDigitalCardOrder(
  id: string,
  fields: Record<string, unknown>,
  onlyIfStatus?: string
): Promise<DigitalCardOrder[]> {
  const guard = onlyIfStatus ? `&status=eq.${onlyIfStatus}` : "";
  const r = await fetch(
    `${SB}/rest/v1/digital_card_orders?id=eq.${id}${guard}`,
    {
      method: "PATCH",
      headers: {
        Authorization: `Bearer ${KEY}`,
        apikey: KEY!,
        "Content-Type": "application/json",
        Prefer: "return=representation",
      },
      body: JSON.stringify({ ...fields, updated_at: new Date().toISOString() }),
    }
  );
  const rows = await r.json().catch(() => []);
  return Array.isArray(rows) ? rows : [];
}

function esc(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

/* The "From" header: the email goes from our verified sending address (so SPF/
   DKIM/DMARC pass), but the display name is the sender's own name — so in the
   inbox it reads "Layla via Ketabi Studio", which feels personal and warm
   while staying deliverable. Header-unsafe characters are stripped. */
function senderFrom(sender: string): string {
  const m = EMAIL_FROM.match(/<([^>]+)>/);
  const addr = m ? m[1] : EMAIL_FROM;
  const clean = sender.replace(/["\r\n<>]/g, "").trim();
  const name = clean ? `${clean} via Ketabi Studio` : "Ketabi Studio";
  return `${name} <${addr}>`;
}

/* Branded email that delivers the card link to the recipient. Mirrors the
   worker's Resend shell (forest / cream / gold). No-op if Resend is unset. */
async function sendDigitalCardEmail(o: DigitalCardOrder): Promise<boolean> {
  if (!RESEND_API_KEY || !o.recipient_email) return false;
  const FOREST = "#2E4A3A", CREAM = "#F6F4EF";
  const title = findCard(o.item_id).title;
  const from = (o.sender || "").trim();
  const to = (o.recipient_name || "").trim();
  const link = `${SITE_URL}/c/${o.token}`;
  const greeting = to ? `Dear ${esc(to)},` : "You've received a card";
  const fromLine = from
    ? `<p style="margin:0 0 16px;font-size:15px;line-height:1.6;">Someone is thinking of you — ${esc(
        from
      )} has sent you a ${esc(title)} card.</p>`
    : `<p style="margin:0 0 16px;font-size:15px;line-height:1.6;">Someone is thinking of you and has sent you a ${esc(
        title
      )} card.</p>`;
  const inner = `\
<h1 style="margin:0 0 12px;font-size:22px;color:${FOREST};">${greeting}</h1>
${fromLine}
<table role="presentation" cellpadding="0" cellspacing="0" style="margin:8px 0 18px;">
  <tr><td style="border-radius:12px;background:${FOREST};">
    <a href="${esc(link)}" style="display:inline-block;padding:14px 30px;
       color:${CREAM};text-decoration:none;font-weight:700;font-size:15px;">
       Open your card &rarr;</a>
  </td></tr>
</table>
<p style="margin:0;font-size:13px;color:#8a847a;line-height:1.6;">
  Or paste this link into your browser:<br>${esc(link)}
</p>`;
  const shell = `<!doctype html><html><head><meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1"></head>
<body style="margin:0;padding:0;background:${CREAM};font-family:-apple-system,Segoe UI,Roboto,Helvetica,Arial,sans-serif;color:#2b2723;">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:${CREAM};padding:32px 16px;">
<tr><td align="center"><table role="presentation" width="100%" cellpadding="0" cellspacing="0"
style="max-width:520px;background:#ffffff;border-radius:18px;overflow:hidden;border:1px solid #e7e2d8;">
<tr><td style="background:${FOREST};padding:24px 28px;">
<span style="color:${CREAM};font-size:20px;font-weight:700;letter-spacing:0.02em;">Ketabi Studio</span>
</td></tr>
<tr><td style="padding:32px 28px;">${inner}</td></tr>
<tr><td style="padding:20px 28px;border-top:1px solid #efeae0;color:#8a847a;font-size:12px;line-height:1.6;">
Ketabi Studio · A little something, sent with love.
</td></tr></table></td></tr></table></body></html>`;

  const subject = from
    ? `${from} sent you ${occasionPhrase(o.item_id)} 🌙`
    : cardHeadline(o.item_id, to);
  const replyTo = (o.customer_email || "").trim();

  /* Scheduled delivery: if the buyer asked us to hold the card until, say,
     Eid morning, hand Resend the future instant (ISO). Resend only honours a
     schedule up to 30 days out, so we pass scheduled_at only when it's still
     in the future AND inside that window; anything past it sends immediately
     (better early than silently never). */
  const MAX_SCHEDULE_MS = 30 * 24 * 60 * 60 * 1000;
  let scheduledAt: string | null = null;
  if (o.scheduled_at) {
    const t = Date.parse(o.scheduled_at);
    const now = Date.now();
    if (!Number.isNaN(t) && t > now + 60_000 && t <= now + MAX_SCHEDULE_MS) {
      scheduledAt = new Date(t).toISOString();
    }
  }

  try {
    const r = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${RESEND_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        from: senderFrom(from),
        ...(replyTo ? { reply_to: replyTo } : {}),
        to: [o.recipient_email],
        subject,
        html: shell,
        ...(scheduledAt ? { scheduled_at: scheduledAt } : {}),
      }),
    });
    return r.status === 200 || r.status === 201;
  } catch (e) {
    console.error("digital card email error:", e);
    return false;
  }
}

/* Receipt + confirmation to the BUYER, with their own copy of the card link
   so they always have it (even if they closed the success page). Mirrors the
   branded shell. No-op if Resend is unset. */
async function sendBuyerReceipt(o: DigitalCardOrder): Promise<void> {
  if (!RESEND_API_KEY || !o.customer_email) return;
  const FOREST = "#2E4A3A", CREAM = "#F6F4EF";
  const title = findCard(o.item_id).title;
  const to = (o.recipient_name || "").trim();
  const link = `${SITE_URL}/c/${o.token}`;

  let deliveryLine: string;
  if (o.deliver_email && o.recipient_email) {
    const sched = o.scheduled_at && Date.parse(o.scheduled_at) > Date.now();
    deliveryLine = sched
      ? `We'll email it to <strong>${esc(o.recipient_email)}</strong> at the time you scheduled. You can also share your link any time before then.`
      : `We've emailed it to <strong>${esc(o.recipient_email)}</strong>. You can share your link too, anywhere you like.`;
  } else {
    deliveryLine = `Share your private link by text, WhatsApp, or anywhere you like — it opens to your animated card.`;
  }

  const inner = `\
<h1 style="margin:0 0 12px;font-size:22px;color:${FOREST};">Your card is ready 🌙</h1>
<p style="margin:0 0 16px;font-size:15px;line-height:1.6;">
  Thank you! Your ${esc(title)} card${to ? ` for ${esc(to)}` : ""} is paid and live.
  ${deliveryLine}
</p>
<table role="presentation" cellpadding="0" cellspacing="0" style="margin:8px 0 18px;">
  <tr><td style="border-radius:12px;background:${FOREST};">
    <a href="${esc(link)}" style="display:inline-block;padding:14px 30px;
       color:${CREAM};text-decoration:none;font-weight:700;font-size:15px;">
       View your card &rarr;</a>
  </td></tr>
</table>
<p style="margin:0;font-size:13px;color:#8a847a;line-height:1.6;">
  Your private link — keep it safe:<br>${esc(link)}
</p>`;
  const shell = `<!doctype html><html><head><meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1"></head>
<body style="margin:0;padding:0;background:${CREAM};font-family:-apple-system,Segoe UI,Roboto,Helvetica,Arial,sans-serif;color:#2b2723;">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:${CREAM};padding:32px 16px;">
<tr><td align="center"><table role="presentation" width="100%" cellpadding="0" cellspacing="0"
style="max-width:520px;background:#ffffff;border-radius:18px;overflow:hidden;border:1px solid #e7e2d8;">
<tr><td style="background:${FOREST};padding:24px 28px;">
<span style="color:${CREAM};font-size:20px;font-weight:700;letter-spacing:0.02em;">Ketabi Studio</span>
</td></tr>
<tr><td style="padding:32px 28px;">${inner}</td></tr>
<tr><td style="padding:20px 28px;border-top:1px solid #efeae0;color:#8a847a;font-size:12px;line-height:1.6;">
Ketabi Studio · A little something, sent with love.
</td></tr></table></td></tr></table></body></html>`;

  try {
    await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${RESEND_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        from: EMAIL_FROM,
        to: [o.customer_email],
        subject: "Your card is ready 🌙",
        html: shell,
      }),
    });
  } catch (e) {
    console.error("buyer receipt email error:", e);
  }
}

/* Flip a paid digital card to `paid`, send the buyer their receipt + link,
   and (if they opted in) email the recipient. Runs exactly once — the
   awaiting_payment → paid transition guards against Stripe retries. */
async function releaseDigitalCard(session: Stripe.Checkout.Session) {
  const id = session.metadata?.digitalCardOrderId;
  if (!id || session.payment_status !== "paid") return;
  const rows = await patchDigitalCardOrder(
    id,
    {
      status: "paid",
      notes: JSON.stringify({
        paid: true,
        stripe_session_id: session.id,
        stripe_payment_intent: String(session.payment_intent || ""),
        amount_paid_cents: session.amount_total ?? null,
      }),
    },
    "awaiting_payment"
  );
  if (!rows.length) {
    console.log(`[digital ${id}] duplicate paid event ignored`);
    return;
  }
  const o = rows[0];
  console.log(`[digital ${id}] paid → card live at /c/${o.token}`);
  // Buyer always gets a receipt with their own copy of the link.
  await sendBuyerReceipt(o);
  // Recipient gets the card only if the buyer opted in.
  if (o.deliver_email && o.recipient_email && !o.email_sent) {
    const ok = await sendDigitalCardEmail(o);
    if (ok) await patchDigitalCardOrder(o.id, { email_sent: true });
  }
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

    await releaseDigitalCard(session);

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
    await releaseDigitalCard(session);
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

  return NextResponse.json({ received: true });
}
