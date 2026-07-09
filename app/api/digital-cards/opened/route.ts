import { NextRequest, NextResponse } from "next/server";
import { findCard } from "@/lib/cards";

/* "Your card was opened 🌙" — a soft notification to the buyer the first time
   the recipient actually opens their card. It's marked once (guarded on
   opened_at IS NULL) so resends and re-opens never re-notify, and it's only
   ever called from the viewer's client beacon on a real reveal — never from a
   link-preview crawler. */

export const runtime = "nodejs";

const SB = process.env.SUPABASE_URL?.replace(/\s/g, "").replace(/\/$/, "");
const KEY = process.env.SUPABASE_SERVICE_KEY?.replace(/\s/g, "");
const RESEND_API_KEY = process.env.RESEND_API_KEY?.replace(/\s/g, "");
const EMAIL_FROM =
  process.env.EMAIL_FROM?.trim() || "Ketabi Studio <orders@ketabistudio.com>";

function esc(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

type OpenedRow = {
  item_id: string;
  recipient_name: string | null;
  customer_email: string | null;
};

async function sendOpenedEmail(o: OpenedRow): Promise<void> {
  if (!RESEND_API_KEY || !o.customer_email) return;
  const FOREST = "#2E4A3A", CREAM = "#F6F4EF";
  const title = findCard(o.item_id).title;
  const to = (o.recipient_name || "").trim();
  const headline = to
    ? `${esc(to)} just opened your card 🌙`
    : "Your card was just opened 🌙";
  const body = to
    ? `Lovely news. ${esc(
        to
      )} has opened the ${esc(title)} card you sent. We hope it brought a smile.`
    : `Lovely news. The ${esc(
        title
      )} card you sent has just been opened. We hope it brought a smile.`;
  const inner = `\
<h1 style="margin:0 0 12px;font-size:22px;color:${FOREST};">${headline}</h1>
<p style="margin:0 0 18px;font-size:15px;line-height:1.6;">${body}</p>
<p style="margin:0;font-size:13px;color:#8a847a;line-height:1.6;">
  Want to send another? It takes just a minute.
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
        subject: headline,
        html: shell,
      }),
    });
  } catch (e) {
    console.error("opened email error:", e);
  }
}

export async function POST(req: NextRequest) {
  // Fire-and-forget beacon: always answer 200 so the viewer never sees an
  // error, even if the backend isn't configured.
  if (!SB || !KEY) return NextResponse.json({ ok: true });

  let token = "";
  try {
    const body = await req.json();
    token = String(body?.token || "").trim();
  } catch {
    /* sendBeacon Blob still parses as JSON; ignore malformed */
  }
  if (!token || token === "demo") {
    return NextResponse.json({ ok: true });
  }

  const safe = encodeURIComponent(token);
  // Flip opened_at exactly once (guarded on null + paid), returning the row so
  // the single transition that "wins" is the one that emails the buyer.
  const r = await fetch(
    `${SB}/rest/v1/digital_card_orders?token=eq.${safe}&status=eq.paid&opened_at=is.null&select=item_id,recipient_name,customer_email`,
    {
      method: "PATCH",
      headers: {
        Authorization: `Bearer ${KEY}`,
        apikey: KEY,
        "Content-Type": "application/json",
        Prefer: "return=representation",
      },
      body: JSON.stringify({ opened_at: new Date().toISOString() }),
    }
  );
  if (r.ok) {
    const rows = await r.json().catch(() => []);
    if (Array.isArray(rows) && rows.length) {
      await sendOpenedEmail(rows[0] as OpenedRow);
    }
  }
  return NextResponse.json({ ok: true });
}
