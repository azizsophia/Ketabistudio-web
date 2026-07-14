import { NextRequest, NextResponse } from "next/server";

const SB = process.env.SUPABASE_URL?.replace(/\s/g, "").replace(/\/$/, "");
const KEY = process.env.SUPABASE_SERVICE_KEY?.replace(/\s/g, "");
const CRON_SECRET = process.env.CRON_SECRET?.trim();

export const runtime = "nodejs";

// GET (owner-only, Bearer CRON_SECRET): total signups, a breakdown by source,
// and the most recent handful (local-part masked) so the owner can see real
// traction without exposing the full list.
export async function GET(req: NextRequest) {
  const auth = (req.headers.get("authorization") || "").trim();
  if (!CRON_SECRET || auth !== `Bearer ${CRON_SECRET}`) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }
  if (!SB || !KEY) {
    return NextResponse.json({ error: "not configured" }, { status: 500 });
  }
  // exact count via the Content-Range header
  const cr = await fetch(`${SB}/rest/v1/waitlist?select=email`, {
    headers: { Authorization: `Bearer ${KEY}`, apikey: KEY, Prefer: "count=exact", Range: "0-0" },
    cache: "no-store",
  });
  const total = Number((cr.headers.get("content-range") || "0-0/0").split("/")[1] || 0);
  const rowsR = await fetch(
    `${SB}/rest/v1/waitlist?select=email,source,created_at&order=created_at.desc&limit=15`,
    { headers: { Authorization: `Bearer ${KEY}`, apikey: KEY }, cache: "no-store" }
  );
  const rows = (await rowsR.json().catch(() => [])) as Array<{
    email: string; source?: string; created_at?: string;
  }>;
  const bySource: Record<string, number> = {};
  for (const r of Array.isArray(rows) ? rows : []) {
    const s = r.source || "unknown";
    bySource[s] = (bySource[s] || 0) + 1;
  }
  const mask = (e: string) => {
    const [u, d] = String(e).split("@");
    if (!d) return "***";
    return `${u.slice(0, 2)}***@${d}`;
  };
  return NextResponse.json({
    ok: true,
    total,
    recent: (Array.isArray(rows) ? rows : []).map((r) => ({
      email: mask(r.email), source: r.source, at: r.created_at,
    })),
    recentBySource: bySource,
  });
}

export async function POST(req: NextRequest) {
  if (!SB || !KEY) {
    return NextResponse.json({ error: "not configured" }, { status: 500 });
  }

  let body: { email?: string; source?: string };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "invalid json" }, { status: 400 });
  }

  const email = String(body.email || "").trim().toLowerCase();
  if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    return NextResponse.json({ error: "Please enter a valid email." }, { status: 400 });
  }
  const source = String(body.source || "coming-soon").slice(0, 40);

  const r = await fetch(`${SB}/rest/v1/waitlist`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${KEY}`,
      apikey: KEY,
      "Content-Type": "application/json",
      /* If they already signed up, treat it as success rather than an error. */
      Prefer: "resolution=ignore-duplicates",
    },
    body: JSON.stringify({ email, source }),
  });

  if (!r.ok && r.status !== 409) {
    const err = await r.text().catch(() => "");
    console.error("waitlist insert fail:", r.status, err);
    return NextResponse.json({ error: "Could not save your email." }, { status: 500 });
  }

  return NextResponse.json({ ok: true });
}
