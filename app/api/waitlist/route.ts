import { NextRequest, NextResponse } from "next/server";

const SB = process.env.SUPABASE_URL?.replace(/\s/g, "").replace(/\/$/, "");
const KEY = process.env.SUPABASE_SERVICE_KEY?.replace(/\s/g, "");

export const runtime = "nodejs";

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
