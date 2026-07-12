import { NextRequest, NextResponse } from "next/server";

const SB = process.env.SUPABASE_URL?.replace(/\s/g, "").replace(/\/$/, "");
const KEY = process.env.SUPABASE_SERVICE_KEY?.replace(/\s/g, "");
const ADMIN = process.env.ADMIN_KEY;
const CRON_SECRET = process.env.CRON_SECRET?.trim();

export async function GET(req: NextRequest) {
  const k = req.headers.get("x-admin-key");
  const auth = (req.headers.get("authorization") || "").trim();
  const ok =
    (ADMIN && k === ADMIN) ||
    (CRON_SECRET && auth === `Bearer ${CRON_SECRET}`);
  if (!ok) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }
  if (!SB || !KEY) {
    return NextResponse.json({ error: "not configured" }, { status: 500 });
  }

  // ?asset=juha/Juha_interior.pdf — sign a master file from the book-assets
  // bucket (owner QC of the fixed-book source PDFs).
  const asset = req.nextUrl.searchParams.get("asset");
  let bucket = "orders";
  let path: string;
  if (asset) {
    if (!/^[\w\-/. ]{1,200}$/.test(asset) || asset.includes("..")) {
      return NextResponse.json({ error: "bad asset path" }, { status: 400 });
    }
    bucket = "book-assets";
    path = asset;
  } else {
    const orderId = req.nextUrl.searchParams.get("order");
    const type = req.nextUrl.searchParams.get("type"); // interior | cover | digest
    if (!orderId || !type || !["interior", "cover", "digest"].includes(type)) {
      return NextResponse.json({ error: "bad request" }, { status: 400 });
    }
    const ext = type === "digest" ? "jpg" : "pdf";
    path = `${orderId}/${type}.${ext === "jpg" ? "jpg" : "pdf"}`;
  }

  const r = await fetch(`${SB}/storage/v1/object/sign/${bucket}/${path}`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${KEY}`,
      apikey: KEY!,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ expiresIn: 3600 }),
  });

  if (!r.ok) {
    return NextResponse.json(
      { error: "failed to sign", detail: await r.text() },
      { status: 502 }
    );
  }

  const { signedURL } = await r.json();
  return NextResponse.json({ url: `${SB}/storage/v1${signedURL}` });
}
