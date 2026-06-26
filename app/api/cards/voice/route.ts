import { NextRequest, NextResponse } from "next/server";
import { randomUUID } from "crypto";

/* Stores a short recorded voice note (already encoded to MP3 in the browser,
   so it plays on every device including iPhones) in the same public bucket as
   card photos. Returns the public URL, which the order then references. */

const SB = process.env.SUPABASE_URL?.replace(/\s/g, "").replace(/\/$/, "");
const KEY = process.env.SUPABASE_SERVICE_KEY?.replace(/\s/g, "");

export const runtime = "nodejs";

const MAX_BYTES = 3 * 1024 * 1024; // ~3MB — comfortably covers 90s of 128kbps mp3

export async function POST(req: NextRequest) {
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

  const mime = file.type || "";
  if (mime !== "audio/mpeg" && mime !== "audio/mp3") {
    return NextResponse.json(
      { error: "voice note must be an mp3" },
      { status: 400 }
    );
  }
  if (file.size > MAX_BYTES) {
    return NextResponse.json(
      { error: "voice note too long (max ~90 seconds)" },
      { status: 400 }
    );
  }

  const bytes = Buffer.from(await file.arrayBuffer());
  const path = `voice/${randomUUID()}.mp3`;

  const r = await fetch(`${SB}/storage/v1/object/card-assets/${path}`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${KEY}`,
      "x-upsert": "true",
      "Content-Type": "audio/mpeg",
    },
    body: bytes,
  });

  if (!r.ok) {
    const err = await r.text();
    console.error("voice note upload fail:", err);
    return NextResponse.json({ error: "upload failed" }, { status: 500 });
  }

  const url = `${SB}/storage/v1/object/public/card-assets/${path}`;
  return NextResponse.json({ url });
}
