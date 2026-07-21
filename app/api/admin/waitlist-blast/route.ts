import { NextRequest, NextResponse } from "next/server";

/* Owner-only launch announcement to the waitlist (Bearer CRON_SECRET).
   GET  -> preview: recipient count + the exact HTML that will be sent.
   POST {confirm:true} -> sends via Resend, one email per subscriber, and
   reports how many went out. Kept deliberately simple: this list is tiny and
   opted in ("join the waitlist for early access"), and the owner triggers it
   manually from chat, no laptop needed. */

const SB = process.env.SUPABASE_URL?.replace(/\s/g, "").replace(/\/$/, "");
const KEY = process.env.SUPABASE_SERVICE_KEY?.replace(/\s/g, "");
const CRON_SECRET = process.env.CRON_SECRET?.trim();
const RESEND_API_KEY = process.env.RESEND_API_KEY?.replace(/\s/g, "");
const EMAIL_FROM = process.env.EMAIL_FROM?.trim() || "Ketabi Studio <orders@ketabistudio.com>";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 60;

const SUBJECT = "Ketabi Studio is open, alhamdulillah";

const HTML = `
<div style="background:#F6F4EF;padding:32px 16px;font-family:Georgia,serif;color:#2a2b22">
  <div style="max-width:520px;margin:0 auto;background:#fff;border-radius:12px;padding:38px 30px;text-align:center">
    <p style="letter-spacing:.18em;font-size:12px;color:#2E4A3A;text-transform:uppercase;margin:0 0 16px">Ketabi Studio</p>
    <h1 style="font-weight:400;font-size:27px;margin:0 0 6px">As-salamu alaykum.</h1>
    <h2 style="font-weight:400;font-style:italic;font-size:20px;color:#47624c;margin:0 0 20px">The doors are open.</h2>
    <p style="line-height:1.7;color:#5d564d;margin:0 0 18px">
      You joined our waitlist before there was anything to see, and that meant
      the world. Today the store is live: keepsakes and books made to hold the
      names and words of the people you love.
    </p>
    <div style="text-align:left;background:#F6F4EF;border-radius:10px;padding:20px 22px;margin:0 0 22px;line-height:1.8;color:#4c463d;font-size:15px">
      <b style="color:#2E4A3A">Photo keepsakes</b> · Everything I Love About Mama, Baba, grandparents, a new baby. Your photos, heartfelt words, sealed with a dua.<br/>
      <b style="color:#2E4A3A">Storybooks</b> · hand-illustrated Islamic stories, one starring your child by name.<br/>
      <b style="color:#2E4A3A">From One Root</b> · the 30-day Qur'an journal, as an instant PDF or coil-bound print.<br/>
      <b style="color:#2E4A3A">Digital cards</b> · animated, with your real voice inside, sent in minutes.
    </div>
    <a href="https://www.ketabistudio.com/?r=waitlist" style="display:inline-block;background:#2E4A3A;color:#fff;text-decoration:none;border-radius:999px;padding:14px 28px;font-size:14px;letter-spacing:.06em">Come see the store</a>
    <p style="line-height:1.7;color:#857f70;margin:24px 0 0;font-size:14px">
      Everything is printed to order with care. Free US shipping on books and
      keepsakes, and we ship worldwide.
    </p>
    <p style="margin:26px 0 0;font-style:italic;color:#857f70;font-size:14px">
      Thank you for being here from the very beginning.<br/>With love, Ketabi Studio
    </p>
  </div>
</div>`;

function authorized(req: NextRequest): boolean {
  const auth = (req.headers.get("authorization") || "").trim();
  return !!CRON_SECRET && auth === `Bearer ${CRON_SECRET}`;
}

async function recipients(): Promise<string[]> {
  const r = await fetch(`${SB}/rest/v1/waitlist?select=email`, {
    headers: { Authorization: `Bearer ${KEY}`, apikey: KEY! },
    cache: "no-store",
  });
  const rows = (await r.json().catch(() => [])) as { email: string }[];
  return [...new Set(rows.map((x) => x.email.trim().toLowerCase()).filter(Boolean))];
}

export async function GET(req: NextRequest) {
  if (!authorized(req)) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  if (!SB || !KEY) return NextResponse.json({ error: "not configured" }, { status: 500 });
  const to = await recipients();
  return NextResponse.json({ ok: true, recipients: to.length, subject: SUBJECT, html: HTML });
}

export async function POST(req: NextRequest) {
  if (!authorized(req)) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  if (!SB || !KEY || !RESEND_API_KEY) {
    return NextResponse.json({ error: "not configured" }, { status: 500 });
  }
  let body: { confirm?: boolean };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "invalid json" }, { status: 400 });
  }
  if (!body.confirm) return NextResponse.json({ error: "confirm required" }, { status: 400 });

  const to = await recipients();
  let sent = 0;
  const failed: string[] = [];
  for (const email of to) {
    try {
      const r = await fetch("https://api.resend.com/emails", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${RESEND_API_KEY}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ from: EMAIL_FROM, to: [email], subject: SUBJECT, html: HTML }),
      });
      if (r.ok) sent += 1;
      else failed.push(email);
    } catch {
      failed.push(email);
    }
  }
  return NextResponse.json({ ok: true, sent, failed: failed.length });
}
