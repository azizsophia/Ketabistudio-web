import { NextRequest, NextResponse } from "next/server";
import { randomUUID } from "crypto";

// Hosts reel MP4s publicly so the Meta Graph API can fetch them (IG Reels +
// FB video both need a public video_url, not an upload). Mirrors the photo
// route but for video and gated behind CRON_SECRET, since video upload is
// heavier and only the content pipeline should use it. Returns a public
// card-assets URL ending in .mp4 — the poster keys "this is a reel" off that
// extension, so no schema change is needed.

const SB = process.env.SUPABASE_URL?.replace(/\s/g, "").replace(/\/$/, "");
const KEY = process.env.SUPABASE_SERVICE_KEY?.replace(/\s/g, "");
const CRON_SECRET = process.env.CRON_SECRET?.trim();
const ADMIN = process.env.ADMIN_KEY;

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 60;

const MAX_BYTES = 100 * 1024 * 1024; // 100MB — a 15s 1080p reel is ~10MB

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
  const mime = file.type || "video/mp4";
  if (!mime.startsWith("video/")) {
    return NextResponse.json({ error: "file must be a video" }, { status: 400 });
  }
  if (file.size > MAX_BYTES) {
    return NextResponse.json({ error: "video too large (max 100MB)" }, { status: 400 });
  }

  const bytes = Buffer.from(await file.arrayBuffer());
  const path = `reels/${randomUUID()}.mp4`;

  const r = await fetch(`${SB}/storage/v1/object/card-assets/${path}`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${KEY}`,
      "x-upsert": "true",
      "Content-Type": "video/mp4",
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
