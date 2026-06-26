import { NextRequest, NextResponse } from "next/server";
import { randomBytes } from "crypto";
import { CARD_ITEMS, CARD_MESSAGE_MAX, cardColors, findCard } from "@/lib/cards";
import { MOTIF_KEYS, SCHEME_KEYS, defaultMotif } from "@/lib/digitalCard";

export const runtime = "nodejs";

const SB = process.env.SUPABASE_URL?.replace(/\s/g, "").replace(/\/$/, "");
const KEY = process.env.SUPABASE_SERVICE_KEY?.replace(/\s/g, "");

const ITEM_IDS = new Set(CARD_ITEMS.map((c) => c.id));
const MOTIF_SET = new Set(MOTIF_KEYS);
const SCHEME_SET = new Set(SCHEME_KEYS);
const NAME_MAX = 40;

export async function POST(req: NextRequest) {
  if (!SB || !KEY) {
    return NextResponse.json({ error: "not configured" }, { status: 500 });
  }

  let body: Record<string, unknown>;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "invalid json" }, { status: 400 });
  }

  /* card */
  const itemId = String(body.item_id || "");
  if (!ITEM_IDS.has(itemId)) {
    return NextResponse.json({ error: "invalid card" }, { status: 400 });
  }

  /* inside message */
  const message = String(body.message || "").trim();
  if (message.length > CARD_MESSAGE_MAX) {
    return NextResponse.json(
      { error: `Message must be ${CARD_MESSAGE_MAX} characters or fewer.` },
      { status: 400 }
    );
  }

  /* sign-off + recipient name */
  const sender = String(body.sender || "").trim();
  const recipientName = String(body.recipient_name || "").trim();
  if (sender.length > NAME_MAX || recipientName.length > NAME_MAX) {
    return NextResponse.json(
      { error: `Names and sign-off must be ${NAME_MAX} characters or fewer.` },
      { status: 400 }
    );
  }

  /* buyer email (receipt + their copy of the link) */
  const email = String(body.email || "").trim().toLowerCase();
  if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    return NextResponse.json({ error: "valid email required" }, { status: 400 });
  }

  /* optional: also email the recipient */
  const deliverEmail = !!body.deliver_email;
  const recipientEmail = String(body.recipient_email || "").trim().toLowerCase();
  if (deliverEmail && (!recipientEmail || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(recipientEmail))) {
    return NextResponse.json(
      { error: "a valid recipient email is required to email the card" },
      { status: 400 }
    );
  }

  /* accent must be one of the card's vetted colours (never an arbitrary hex) */
  const accentRaw = String(body.accent || "").trim().toLowerCase();
  const allowed = new Set(cardColors(itemId).map((c) => c.hex.toLowerCase()));
  const accent = allowed.has(accentRaw) ? accentRaw : findCard(itemId).color;

  /* design: motif + colour scheme (validated against the allowed sets) */
  const themeRaw = String(body.theme || "").trim();
  const theme = MOTIF_SET.has(themeRaw) ? themeRaw : defaultMotif(itemId);
  const schemeRaw = String(body.scheme || "").trim();
  const scheme = SCHEME_SET.has(schemeRaw) ? schemeRaw : "midnight";

  /* optional scheduled delivery: only meaningful when we're emailing the
     recipient. The builder sends an absolute UTC instant (it converts the
     buyer's chosen local date/time + timezone). We accept it only if it's a
     real instant, at least a minute out, and within the 30-day window the
     email service can honour — otherwise we fall back to sending immediately
     (better early than never). */
  const MAX_SCHEDULE_MS = 30 * 24 * 60 * 60 * 1000;
  let scheduledAt: string | null = null;
  const schedRaw = String(body.scheduled_at || "").trim();
  if (deliverEmail && schedRaw) {
    const t = Date.parse(schedRaw);
    if (!Number.isNaN(t)) {
      const now = Date.now();
      if (t > now + 60_000 && t <= now + MAX_SCHEDULE_MS) {
        scheduledAt = new Date(t).toISOString();
      }
    }
  }

  /* optional voice note — only accept a URL we actually issued (our public
     storage bucket), so the field can't be pointed at an arbitrary host. */
  const voiceRaw = String(body.voice_url || "").trim();
  const voicePrefix = `${SB}/storage/v1/object/public/card-assets/voice/`;
  const voiceUrl = voiceRaw.startsWith(voicePrefix) ? voiceRaw : null;
  const hasVoice = !!voiceUrl;

  /* unique, hard-to-guess public link slug */
  const token = randomBytes(16).toString("base64url");

  const row = {
    token,
    item_id: itemId,
    accent,
    theme,
    scheme,
    message: message || null,
    sender: sender || null,
    recipient_name: recipientName || null,
    photo_url: String(body.photo_url || "").trim() || null,
    voice_url: voiceUrl,
    has_voice: hasVoice,
    customer_email: email,
    deliver_email: deliverEmail,
    recipient_email: deliverEmail ? recipientEmail : null,
    scheduled_at: scheduledAt,
    status: "awaiting_payment",
  };

  const r = await fetch(`${SB}/rest/v1/digital_card_orders`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${KEY}`,
      apikey: KEY!,
      "Content-Type": "application/json",
      Prefer: "return=representation",
    },
    body: JSON.stringify(row),
  });

  if (!r.ok) {
    const err = await r.text();
    console.error("digital card order insert fail:", err);
    return NextResponse.json({ error: "order failed" }, { status: 500 });
  }

  const [created] = await r.json();
  return NextResponse.json({ ok: true, orderId: created.id, token: created.token });
}
