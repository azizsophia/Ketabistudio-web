import { NextRequest, NextResponse } from "next/server";
import { findCard } from "@/lib/cards";
import { cardHeadline, occasionPhrase } from "@/lib/digitalCard";

// Owner-only test tool (Bearer CRON_SECRET): send a REAL digital-card email to
// an address without a Stripe payment, so we can verify the recipient
// experience for free. Given an order token, it loads that order and sends the
// same branded recipient email the paid webhook sends. It never touches the
// payment webhook or an order's paid state, so real orders are unaffected.
//
// Body: { token: string, to?: string }  ("to" overrides recipient_email)

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const SB = process.env.SUPABASE_URL?.replace(/\s/g, "").replace(/\/$/, "");
const KEY = process.env.SUPABASE_SERVICE_KEY?.replace(/\s/g, "");
const CRON_SECRET = process.env.CRON_SECRET?.trim();
const RESEND_API_KEY = process.env.RESEND_API_KEY?.replace(/\s/g, "");
const EMAIL_FROM =
  process.env.EMAIL_FROM?.trim() || "Ketabi Studio <orders@ketabistudio.com>";
const SITE_URL = (
  process.env.NEXT_PUBLIC_SITE_URL || "https://ketabistudio-web.vercel.app"
).replace(/\/$/, "");

function esc(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function senderFrom(sender: string): string {
  const m = EMAIL_FROM.match(/<([^>]+)>/);
  const addr = m ? m[1] : EMAIL_FROM;
  const clean = sender.replace(/["\r\n<>]/g, "").trim();
  const name = clean ? `${clean} via Ketabi Studio` : "Ketabi Studio";
  return `${name} <${addr}>`;
}

export async function POST(req: NextRequest) {
  const auth = (req.headers.get("authorization") || "").trim();
  if (!CRON_SECRET || auth !== `Bearer ${CRON_SECRET}`) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }
  if (!SB || !KEY) return NextResponse.json({ error: "not configured" }, { status: 500 });
  if (!RESEND_API_KEY) return NextResponse.json({ error: "resend not configured" }, { status: 500 });

  let body: { token?: string; to?: string };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "invalid json" }, { status: 400 });
  }
  const token = String(body.token || "").trim();
  if (!token) return NextResponse.json({ error: "token required" }, { status: 400 });

  const r = await fetch(
    `${SB}/rest/v1/digital_card_orders?token=eq.${encodeURIComponent(token)}&select=*`,
    { headers: { Authorization: `Bearer ${KEY}`, apikey: KEY } }
  );
  const rows = (await r.json().catch(() => [])) as Array<Record<string, unknown>>;
  const o = Array.isArray(rows) ? rows[0] : null;
  if (!o) return NextResponse.json({ error: "order not found" }, { status: 404 });

  const to = String(body.to || o.recipient_email || "").trim();
  if (!to) return NextResponse.json({ error: "no recipient email" }, { status: 400 });

  // The public viewer only renders paid cards, so flip THIS test order to paid
  // (owner-only, single token) so the emailed link actually opens the card.
  await fetch(`${SB}/rest/v1/digital_card_orders?token=eq.${encodeURIComponent(token)}`, {
    method: "PATCH",
    headers: {
      Authorization: `Bearer ${KEY}`,
      apikey: KEY,
      "Content-Type": "application/json",
      Prefer: "return=minimal",
    },
    body: JSON.stringify({ status: "paid" }),
  });

  const FOREST = "#2E4A3A", CREAM = "#F6F4EF";
  const itemId = String(o.item_id);
  const title = findCard(itemId).title;
  const from = String(o.sender || "").trim();
  const recipName = String(o.recipient_name || "").trim();
  const link = `${SITE_URL}/c/${o.token}`;
  const greeting = recipName ? `Dear ${esc(recipName)},` : "You've received a card";
  const fromLine = from
    ? `<p style="margin:0 0 16px;font-size:15px;line-height:1.6;">Someone is thinking of you. ${esc(
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
    ? `${from} sent you ${occasionPhrase(itemId)} 🌙`
    : cardHeadline(itemId, recipName);

  const send = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: { Authorization: `Bearer ${RESEND_API_KEY}`, "Content-Type": "application/json" },
    body: JSON.stringify({ from: senderFrom(from), to: [to], subject, html: shell }),
  });
  const detail = await send.text().catch(() => "");
  if (send.status !== 200 && send.status !== 201) {
    return NextResponse.json({ error: "send failed", status: send.status, detail: detail.slice(0, 300) }, { status: 502 });
  }
  return NextResponse.json({ ok: true, sent_to: to, card_url: link });
}
