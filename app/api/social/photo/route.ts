import { NextRequest, NextResponse } from "next/server";
import { randomUUID } from "crypto";

// Hosts social post images publicly (card-assets) so the poster/Meta/Threads
// can fetch them by URL. Mirrors the video route but for images and gated
// behind CRON_SECRET (or admin key) — only the content pipeline uses it.
// Returns a public card-assets URL for use as social_queue.image_url.

const SB = process.env.SUPABASE_URL?.replace(/\s/g, "").replace(/\/$/, "");
const KEY = process.env.SUPABASE_SERVICE_KEY?.replace(/\s/g, "");
const CRON_SECRET = process.env.CRON_SECRET?.trim();
const ADMIN = process.env.ADMIN_KEY;

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 30;

const MAX_BYTES = 12 * 1024 * 1024; // 12MB — a 1080x1350 JPEG/PNG is well under

function authorized(req: NextRequest): boolean {
  const auth = (req.headers.get("authorization") || "").trim();
  if (CRON_SECRET && auth === `Bearer ${CRON_SECRET}`) return true;
  const k = req.headers.get("x-admin-key");
  if (ADMIN && k && k === ADMIN) return true;
  return false;
}

export async function POST(req: NextRequest) {
  if (!authorized(req)) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }
  if (!SB || !KEY) {
    return NextResponse.json({ error: "not configured" }, { status: 500 });
  }

  let form: FormData;
  try {
    form = await req.formData();
  } catch {
    return NextResponse.json({ error: "invalid form data" }, { status: 400 });
  }

  const file = form.get("file");
  if (!file || typeof file === "string") {
    return NextResponse.json({ error: "file required" }, { status: 400 });
  }
  const mime = file.type || "image/jpeg";
  if (!mime.startsWith("image/")) {
    return NextResponse.json({ error: "file must be an image" }, { status: 400 });
  }
  if (file.size > MAX_BYTES) {
    return NextResponse.json({ error: "image too large (max 12MB)" }, { status: 400 });
  }

  const ext = mime.includes("png") ? "png" : "jpg";
  const bytes = Buffer.from(await file.arrayBuffer());
  const path = `social/${randomUUID()}.${ext}`;

  const r = await fetch(`${SB}/storage/v1/object/card-assets/${path}`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${KEY}`,
      "x-upsert": "true",
      "Content-Type": mime,
    },
    body: bytes,
  });
  if (!r.ok) {
    const err = await r.text().catch(() => "");
    return NextResponse.json({ error: "upload failed", detail: err.slice(0, 300) }, { status: 500 });
  }

  const url = `${SB}/storage/v1/object/public/card-assets/${path}`;
  return NextResponse.json({ url });
}
