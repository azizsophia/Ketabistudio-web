import { NextRequest, NextResponse } from "next/server";
import { randomUUID } from "crypto";

const SB = process.env.SUPABASE_URL?.replace(/\s/g, "").replace(/\/$/, "");
const KEY = process.env.SUPABASE_SERVICE_KEY?.replace(/\s/g, "");

export const runtime = "nodejs";

const MAX_BYTES = 25 * 1024 * 1024; // 25MB — print photos can be large

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

/** Read pixel dimensions from raw image bytes for the common print formats,
 *  with no external dependency. Returns null if the format isn't parsable
 *  (e.g. HEIC) — the caller then can't run the DPI guard and should warn. */
function readDimensions(buf: Buffer): { width: number; height: number } | null {
  // PNG: 8-byte sig, then IHDR with width/height as 32-bit BE at offsets 16/20.
  if (
    buf.length >= 24 &&
    buf[0] === 0x89 &&
    buf[1] === 0x50 &&
    buf[2] === 0x4e &&
    buf[3] === 0x47
  ) {
    return { width: buf.readUInt32BE(16), height: buf.readUInt32BE(20) };
  }

  // GIF: "GIF87a"/"GIF89a", width/height 16-bit LE at offsets 6/8.
  if (
    buf.length >= 10 &&
    buf[0] === 0x47 &&
    buf[1] === 0x49 &&
    buf[2] === 0x46
  ) {
    return { width: buf.readUInt16LE(6), height: buf.readUInt16LE(8) };
  }

  // WebP: RIFF....WEBP
  if (
    buf.length >= 30 &&
    buf.toString("ascii", 0, 4) === "RIFF" &&
    buf.toString("ascii", 8, 12) === "WEBP"
  ) {
    const fmt = buf.toString("ascii", 12, 16);
    if (fmt === "VP8 ") {
      // lossy: dimensions are 14-bit at offset 26/28 (LE)
      const w = (buf.readUInt16LE(26) & 0x3fff) + 1;
      const h = (buf.readUInt16LE(28) & 0x3fff) + 1;
      return { width: w, height: h };
    }
    if (fmt === "VP8L") {
      const b = buf.readUInt32LE(21);
      const w = (b & 0x3fff) + 1;
      const h = ((b >> 14) & 0x3fff) + 1;
      return { width: w, height: h };
    }
    if (fmt === "VP8X") {
      const w = 1 + (buf[24] | (buf[25] << 8) | (buf[26] << 16));
      const h = 1 + (buf[27] | (buf[28] << 8) | (buf[29] << 16));
      return { width: w, height: h };
    }
  }

  // JPEG: scan SOFn markers for the frame dimensions.
  if (buf.length >= 4 && buf[0] === 0xff && buf[1] === 0xd8) {
    let off = 2;
    while (off + 9 < buf.length) {
      if (buf[off] !== 0xff) {
        off++;
        continue;
      }
      const marker = buf[off + 1];
      // SOF0..SOF15 carry dimensions, except DHT(c4)/DRI(dd)/JPG(c8).
      if (
        marker >= 0xc0 &&
        marker <= 0xcf &&
        marker !== 0xc4 &&
        marker !== 0xc8 &&
        marker !== 0xcc
      ) {
        const height = buf.readUInt16BE(off + 5);
        const width = buf.readUInt16BE(off + 7);
        return { width, height };
      }
      const segLen = buf.readUInt16BE(off + 2);
      if (segLen < 2) break;
      off += 2 + segLen;
    }
  }

  return null;
}

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
      { error: "image too large (max 25MB)" },
      { status: 400 }
    );
  }

  const bytes = Buffer.from(await file.arrayBuffer());
  const dims = readDimensions(bytes);

  const ext = EXT_FOR_MIME[mime] || mime.split("/")[1] || "jpg";
  const path = `photobook/${randomUUID()}.${ext}`;

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
    console.error("photobook photo upload fail:", err);
    return NextResponse.json({ error: "upload failed" }, { status: 500 });
  }

  const url = `${SB}/storage/v1/object/public/card-assets/${path}`;
  return NextResponse.json({
    url,
    width: dims?.width ?? null,
    height: dims?.height ?? null,
  });
}
