import { ImageResponse } from "next/og";
import { schemeOg } from "@/lib/digitalCard";

/* Per-card share preview (the picture that unfurls in iMessage, WhatsApp,
   Telegram, etc. when the link is pasted). Rendered on the server so every
   card link looks like a wrapped gift before it's even opened. */

export const runtime = "nodejs";
export const alt = "A card is waiting for you · Ketabi Studio";
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

const SB = process.env.SUPABASE_URL?.replace(/\s/g, "").replace(/\/$/, "");
const KEY = process.env.SUPABASE_SERVICE_KEY?.replace(/\s/g, "");

async function meta(
  token: string
): Promise<{ recipient: string; scheme: string }> {
  if (token === "demo") return { recipient: "Friend", scheme: "midnight" };
  if (!SB || !KEY) return { recipient: "", scheme: "midnight" };
  try {
    const safe = encodeURIComponent(token);
    const r = await fetch(
      `${SB}/rest/v1/digital_card_orders?token=eq.${safe}&status=eq.paid&select=recipient_name,scheme&limit=1`,
      { headers: { Authorization: `Bearer ${KEY}`, apikey: KEY }, cache: "no-store" }
    );
    if (!r.ok) return { recipient: "", scheme: "midnight" };
    const rows = await r.json().catch(() => []);
    const row = Array.isArray(rows) ? rows[0] : null;
    return {
      recipient: row?.recipient_name ? String(row.recipient_name) : "",
      scheme: row?.scheme ? String(row.scheme) : "midnight",
    };
  } catch {
    return { recipient: "", scheme: "midnight" };
  }
}

export default async function Image({
  params,
}: {
  params: Promise<{ token: string }>;
}) {
  const { token } = await params;
  const { recipient, scheme } = await meta(token);
  const s = schemeOg(scheme);
  const to = recipient.trim();

  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          justifyContent: "center",
          background: s.bg,
          fontFamily: "Georgia, serif",
          position: "relative",
        }}
      >
        {/* thin keyline frame */}
        <div
          style={{
            position: "absolute",
            top: 40,
            left: 40,
            right: 40,
            bottom: 40,
            border: `2px solid ${s.gold}`,
            borderRadius: 24,
            opacity: 0.5,
          }}
        />

        {/* crescent mark */}
        <div
          style={{
            display: "flex",
            position: "relative",
            width: 96,
            height: 96,
            marginBottom: 30,
          }}
        >
          <div
            style={{
              position: "absolute",
              width: 96,
              height: 96,
              borderRadius: "50%",
              background: s.gold,
            }}
          />
          <div
            style={{
              position: "absolute",
              left: 26,
              width: 96,
              height: 96,
              borderRadius: "50%",
              background: "transparent",
              boxShadow: `-26px 0 0 0 ${s.bg.includes("#fcf8ef") ? "#f3e9d6" : "#16202f"}`,
            }}
          />
        </div>

        <div
          style={{
            display: "flex",
            fontSize: 26,
            letterSpacing: 6,
            textTransform: "uppercase",
            color: s.eyebrow,
            marginBottom: 18,
          }}
        >
          A gift for you
        </div>

        <div
          style={{
            display: "flex",
            fontSize: to ? 104 : 76,
            fontWeight: 700,
            color: s.name,
            textAlign: "center",
            padding: "0 80px",
            lineHeight: 1.05,
          }}
        >
          {to || "Open your card"}
        </div>

        <div
          style={{
            display: "flex",
            alignItems: "center",
            gap: 14,
            marginTop: 34,
            fontSize: 30,
            color: s.hint,
          }}
        >
          <div
            style={{
              display: "flex",
              width: 10,
              height: 10,
              borderRadius: "50%",
              background: s.gold,
            }}
          />
          Tap to open · Ketabi Studio
        </div>
      </div>
    ),
    { ...size }
  );
}
