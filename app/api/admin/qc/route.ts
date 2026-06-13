import { NextRequest, NextResponse } from "next/server";

const SB = process.env.SUPABASE_URL?.replace(/\s/g, "").replace(/\/$/, "");
const KEY = process.env.SUPABASE_SERVICE_KEY?.replace(/\s/g, "");
const ADMIN = process.env.ADMIN_KEY;

async function sign(path: string) {
  const r = await fetch(`${SB}/storage/v1/object/sign/book-assets/${path}`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${KEY}`,
      apikey: KEY!,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ expiresIn: 3600 }),
  });
  if (!r.ok) return null;
  const { signedURL } = await r.json();
  return `${SB}/storage/v1${signedURL}`;
}

export async function GET(req: NextRequest) {
  const k = req.headers.get("x-admin-key");
  if (!ADMIN || !k || k !== ADMIN) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }
  if (!SB || !KEY) {
    return NextResponse.json({ error: "not configured" }, { status: 500 });
  }

  const rr = await fetch(
    `${SB}/storage/v1/object/book-assets/qc/report.json`,
    { headers: { Authorization: `Bearer ${KEY}` } }
  );
  if (!rr.ok) {
    return NextResponse.json(
      { error: "No QC report yet. Run the 'QC All Books' action first." },
      { status: 404 }
    );
  }
  const report = await rr.json();

  const sheets: { name: string; url: string }[] = [];
  for (const fn of report.sheets || []) {
    const url = await sign(`qc/${fn}`);
    if (url) sheets.push({ name: fn, url });
  }

  return NextResponse.json({ report, sheets });
}
