import { NextRequest, NextResponse } from "next/server";
import {
  createDraftListing,
  updateListing,
  uploadListingImage,
  uploadListingFile,
  publishListing,
  listListingImages,
  deleteListingImage,
  type DraftListing,
} from "@/lib/etsy";

// Create a listing end-to-end (Bearer CRON_SECRET). Assets are sent inline as
// base64 so nothing needs separate hosting. The listing is created as a DRAFT;
// it only goes public if `publish: true` is passed (never do that without the
// owner's explicit go — see the show-owner-first standing rule).
//
// Body: {
//   listing: { title, description, price, tags[], when_made?, is_personalizable?,
//              personalization_instructions? },
//   images: [{ b64, rank }],           // JPEG/PNG bytes, base64 (no data: prefix)
//   file?:  { b64, name },             // the digital download (e.g. PDF)
//   publish?: boolean                  // default false = draft
// }
export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 60;

const CRON_SECRET = process.env.CRON_SECRET?.trim();

function b64ToBlob(b64: string, type: string): Blob {
  const clean = b64.includes(",") ? b64.slice(b64.indexOf(",") + 1) : b64;
  return new Blob([Buffer.from(clean, "base64")], { type });
}

export async function POST(req: NextRequest) {
  const auth = (req.headers.get("authorization") || "").trim();
  if (!CRON_SECRET || auth !== `Bearer ${CRON_SECRET}`) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }
  let body: {
    listing_id?: number; // if set, EDIT this existing listing instead of creating
    listing?: DraftListing;
    update_fields?: Record<string, string>; // PATCH these fields on an existing listing
    replace_images?: boolean; // edit mode: delete existing images before uploading new
    images?: { b64: string; rank?: number }[];
    file?: { b64: string; name: string };
    publish?: boolean;
  };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "invalid json" }, { status: 400 });
  }

  let id: number;
  const steps: Record<string, string> = {};
  if (body.listing_id) {
    // EDIT mode: operate on the existing listing.
    id = body.listing_id;
    steps.mode = "edit";
    if (body.update_fields && Object.keys(body.update_fields).length) {
      const u = await updateListing(id, body.update_fields);
      steps.update = u.ok ? "ok" : `fail: ${u.detail}`;
    }
    if (body.replace_images) {
      const existing = await listListingImages(id);
      let del = 0;
      for (const imgId of existing) if (await deleteListingImage(id, imgId)) del++;
      steps.deleted_images = String(del);
    }
  } else {
    // CREATE mode.
    if (!body.listing?.title) return NextResponse.json({ error: "listing.title or listing_id required" }, { status: 400 });
    const created = await createDraftListing(body.listing);
    if (!created.ok || !created.listing_id) {
      return NextResponse.json({ error: "create failed", detail: created.detail }, { status: 502 });
    }
    id = created.listing_id;
    steps.create = "ok";
  }

  // images (first = thumbnail)
  const imgs = body.images || [];
  for (let i = 0; i < imgs.length; i++) {
    const type = imgs[i].b64.startsWith("iVBOR") ? "image/png" : "image/jpeg";
    const r = await uploadListingImage(id, b64ToBlob(imgs[i].b64, type), imgs[i].rank ?? i + 1);
    steps[`image_${i + 1}`] = r.ok ? "ok" : `fail: ${r.detail}`;
  }

  // digital file
  if (body.file?.b64) {
    const type = body.file.name.toLowerCase().endsWith(".pdf") ? "application/pdf" : "application/octet-stream";
    const r = await uploadListingFile(id, b64ToBlob(body.file.b64, type), body.file.name);
    steps.file = r.ok ? "ok" : `fail: ${r.detail}`;
  }

  if (body.publish) {
    const r = await publishListing(id);
    steps.publish = r.ok ? "ok" : `fail: ${r.detail}`;
  }

  return NextResponse.json({
    ok: true,
    listing_id: id,
    state: body.publish ? "active(attempted)" : "draft",
    edit_url: `https://www.etsy.com/your/shops/me/listings/${id}`,
    steps,
  });
}
