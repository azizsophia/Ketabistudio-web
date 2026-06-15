import { NextRequest, NextResponse } from "next/server";
import { randomUUID } from "crypto";

const SB = process.env.SUPABASE_URL?.replace(/\s/g, "").replace(/\/$/, "");
const KEY = process.env.SUPABASE_SERVICE_KEY?.replace(/\s/g, "");

export const runtime = "nodejs";

const MAX_BYTES = 10 * 1024 * 1024; // 10MB

const EXT_FOR_MIME: Record<string, string> = {
  "image/jpeg": "jpg",
  "image/jpg": "jpg",
  "image/png": "png",
  "image/webp": "webp",
  "image/gif": "gif",
  "image/heic": "heic",
  "image/heif": "heif",
  "image/avif": "avif",
};

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
  if (!mime.startsWith("image/")) {
    return NextResponse.json({ error: "file must be an image" }, { status: 400 });
  }
  if (file.size > MAX_BYTES) {
    return NextResponse.json(
      { error: "image too large (max 10MB)" },
      { status: 400 }
    );
  }

  const bytes = Buffer.from(await file.arrayBuffer());
  const ext = EXT_FOR_MIME[mime] || mime.split("/")[1] || "jpg";
  const path = `photos/${randomUUID()}.${ext}`;

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
    const err = await r.text();
    console.error("card photo upload fail:", err);
    return NextResponse.json({ error: "upload failed" }, { status: 500 });
  }

  const url = `${SB}/storage/v1/object/public/card-assets/${path}`;
  return NextResponse.json({ url });
}
