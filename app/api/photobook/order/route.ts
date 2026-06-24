import { NextRequest, NextResponse } from "next/server";
import { randomUUID } from "crypto";
import {
  getPhotobookTemplate,
  photobookSpreadCount,
  isPhotobookSlug,
  CAPTION_MAX,
} from "@/lib/photobook";
import { type Crop, isValidCrop } from "@/lib/photoCrop";

const cropOrNull = (c: unknown): Crop | null =>
  isValidCrop(c) ? { x: c.x, y: c.y, w: c.w, h: c.h } : null;

const SB = process.env.SUPABASE_URL?.replace(/\s/g, "").replace(/\/$/, "");
const KEY = process.env.SUPABASE_SERVICE_KEY?.replace(/\s/g, "");

/* Countries the Lulu print network ships to (kept in sync with /api/orders). */
// Lulu MAIL-shippable only. Excluded: AE, KW, QA, OM, JO (EXPRESS-only ~$56)
// and BH (no Lulu shipping). Saudi (SA) ships fine on MAIL (~$17). Confirmed
// against Lulu production, 2026-06-24.
const VALID_COUNTRIES = new Set([
  "US", "AU", "AT", "BE", "CA", "DK", "EG", "FI", "FR", "DE", "IE", "IT",
  "MY", "NL", "NZ", "NO", "SA", "SG", "ZA", "ES", "SE",
  "CH", "TR", "GB",
]);

/* Only accept photos already stored in our public card-assets bucket under the
   photobook/ prefix (the /api/photobook/photo route returns exactly this). */
function isAcceptablePhotoUrl(url: unknown): url is string {
  if (typeof url !== "string" || !url) return false;
  if (!SB) return false;
  return url.startsWith(`${SB}/storage/v1/object/public/card-assets/photobook/`);
}

export async function POST(req: NextRequest) {
  if (!SB || !KEY) {
    return NextResponse.json({ error: "not configured" }, { status: 500 });
  }

  let body: Record<string, unknown>;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "invalid json" }, { status: 400 });
  }

  /* template */
  const slug = String(body.template || "");
  if (!isPhotobookSlug(slug)) {
    return NextResponse.json({ error: "invalid template" }, { status: 400 });
  }
  const template = getPhotobookTemplate(slug)!;
  const expectedPages = photobookSpreadCount(slug);

  /* names */
  const recipientName = String(body.recipient_name || "").trim();
  const authorName = String(body.author_name || "").trim();
  if (!recipientName || recipientName.length > 30) {
    return NextResponse.json(
      { error: `${template.recipientLabel} is required.` },
      { status: 400 }
    );
  }
  if (!authorName || authorName.length > 30) {
    return NextResponse.json(
      { error: `${template.authorLabel} is required.` },
      { status: 400 }
    );
  }

  /* cover photo */
  const coverPhotoUrl = body.cover_photo_url;
  if (!isAcceptablePhotoUrl(coverPhotoUrl)) {
    return NextResponse.json(
      { error: "A cover photo is required." },
      { status: 400 }
    );
  }

  /* pages */
  const rawPages = body.pages;
  if (!Array.isArray(rawPages) || rawPages.length !== expectedPages) {
    return NextResponse.json(
      { error: `Please complete all ${expectedPages} pages.` },
      { status: 400 }
    );
  }
  const pages: { photo_url: string; caption: string; crop: Crop | null }[] = [];
  for (let i = 0; i < rawPages.length; i++) {
    const p = rawPages[i] as Record<string, unknown> | null;
    const caption = String(p?.caption || "").trim();
    const photoUrl = p?.photo_url;
    if (!caption) {
      return NextResponse.json(
        { error: `Page ${i + 1}: a caption is required.` },
        { status: 400 }
      );
    }
    if (caption.length > CAPTION_MAX) {
      return NextResponse.json(
        { error: `Page ${i + 1}: caption must be ${CAPTION_MAX} characters or fewer.` },
        { status: 400 }
      );
    }
    if (!isAcceptablePhotoUrl(photoUrl)) {
      return NextResponse.json(
        { error: `Page ${i + 1}: a photo is required.` },
        { status: 400 }
      );
    }
    pages.push({ photo_url: photoUrl, caption, crop: cropOrNull(p?.crop) });
  }

  /* email */
  const email = String(body.email || "").trim().toLowerCase();
  if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    return NextResponse.json({ error: "valid email required" }, { status: 400 });
  }

  /* Photo-book keepsakes are hardcover-only (24pp casewrap). Pin it server-side
     so price + print spec are always the hardcover keepsake regardless of input. */
  const coverType = "hardcover";

  /* shipping */
  const ship = body.shipping as Record<string, string> | undefined;
  const country = (ship?.country_code || "US").toUpperCase();
  if (!VALID_COUNTRIES.has(country)) {
    return NextResponse.json({ error: "country not supported" }, { status: 400 });
  }
  const stateRequired = ["US", "CA", "AU"].includes(country);
  if (
    !ship ||
    !ship.name?.trim() ||
    !ship.street1?.trim() ||
    !ship.city?.trim() ||
    !ship.postcode?.trim() ||
    (stateRequired && !ship.state_code?.trim())
  ) {
    return NextResponse.json(
      { error: "complete shipping address required" },
      { status: 400 }
    );
  }
  // Lulu requires a phone number on every print job's shipping address.
  if (!ship.phone?.trim() || ship.phone.replace(/[^\d]/g, "").length < 7) {
    return NextResponse.json(
      { error: "A valid phone number is required for delivery." },
      { status: 400 }
    );
  }

  const shipping = {
    name: ship.name.trim(),
    street1: ship.street1.trim(),
    street2: (ship.street2 || "").trim() || undefined,
    city: ship.city.trim(),
    state_code: (ship.state_code || "").trim().toUpperCase() || undefined,
    postcode: ship.postcode.trim(),
    country_code: country,
    phone_number: (ship.phone || "").replace(/[^\d+]/g, "") || undefined,
  };

  const approvalToken = randomUUID();

  const row = {
    book_slug: slug,
    cover_type: coverType,
    customer_email: email,
    shipping,
    photo_data: {
      recipient_name: recipientName,
      author_name: authorName,
      cover_photo_url: coverPhotoUrl,
      cover_crop: cropOrNull(body.cover_crop),
      pages,
    },
    status: "awaiting_payment",
    approval_token: approvalToken,
  };

  const r = await fetch(`${SB}/rest/v1/orders`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${KEY}`,
      apikey: KEY!,
      "Content-Type": "application/json",
      Prefer: "return=representation",
    },
    body: JSON.stringify(row),
  });

  if (!r.ok) {
    const err = await r.text();
    console.error("photobook order insert fail:", err);
    return NextResponse.json({ error: "order failed" }, { status: 500 });
  }

  const [created] = await r.json();

  await fetch(`${SB}/rest/v1/order_events`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${KEY}`,
      apikey: KEY!,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ order_id: created.id, event: "awaiting_payment" }),
  });

  return NextResponse.json({
    ok: true,
    orderId: created.id,
    message: "Order created. Continue to payment.",
  });
}
