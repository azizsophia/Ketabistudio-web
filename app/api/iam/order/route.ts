import { NextRequest, NextResponse } from "next/server";
import { randomUUID } from "crypto";
import {
  IAM_SLUG,
  NAME_MAX,
  DEDICATION_MAX,
  PHOTO_SLOTS,
  hasArabic,
} from "@/lib/iamBook";
import { type Crop, isValidCrop } from "@/lib/photoCrop";

const SB = process.env.SUPABASE_URL?.replace(/\s/g, "").replace(/\/$/, "");
const KEY = process.env.SUPABASE_SERVICE_KEY?.replace(/\s/g, "");

/* Countries the Lulu print network ships to (kept in sync with /api/orders). */
const VALID_COUNTRIES = new Set([
  "US", "AU", "AT", "BH", "BE", "CA", "DK", "EG", "FI", "FR", "DE", "IE", "IT",
  "JO", "KW", "MY", "NL", "NZ", "NO", "OM", "QA", "SA", "SG", "ZA", "ES", "SE",
  "CH", "TR", "AE", "GB",
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

  /* name (English + Arabic) */
  const name = String(body.name || "").trim();
  if (!name || name.length > NAME_MAX) {
    return NextResponse.json(
      { error: `Please enter the child's name (1 to ${NAME_MAX} characters).` },
      { status: 400 }
    );
  }
  const nameArabic = String(body.name_arabic || "").trim();
  if (!nameArabic || !hasArabic(nameArabic) || nameArabic.length > NAME_MAX) {
    return NextResponse.json(
      { error: "Please enter the child's name in Arabic." },
      { status: 400 }
    );
  }

  /* gender / colorway / binding */
  const gender = String(body.gender || "").toLowerCase();
  if (gender !== "boy" && gender !== "girl") {
    return NextResponse.json({ error: "invalid gender" }, { status: 400 });
  }
  const colorway = String(body.colorway || "").toLowerCase();
  if (colorway !== "teal" && colorway !== "rose") {
    return NextResponse.json({ error: "invalid colour" }, { status: 400 });
  }
  const binding = String(body.binding || "").toLowerCase();
  if (binding !== "hardcover" && binding !== "paperback") {
    return NextResponse.json({ error: "invalid binding" }, { status: 400 });
  }
  const coverType = binding === "hardcover" ? "hardcover" : "softcover";

  /* dedication (optional) */
  const dedication = String(body.dedication || "").trim();
  if (dedication.length > DEDICATION_MAX) {
    return NextResponse.json(
      { error: `Dedication must be ${DEDICATION_MAX} characters or fewer.` },
      { status: 400 }
    );
  }

  /* photos — all optional, but any provided must be ours and in-range. Each
     photo may carry a crop {x,y,w,h} (the customer's drag/zoom positioning). */
  const cropOrNull = (c: unknown): Crop | null =>
    isValidCrop(c) ? { x: c.x, y: c.y, w: c.w, h: c.h } : null;

  const coverPhoto = body.cover_photo_url;
  if (coverPhoto != null && coverPhoto !== "" && !isAcceptablePhotoUrl(coverPhoto)) {
    return NextResponse.json({ error: "invalid cover photo" }, { status: 400 });
  }
  const coverCrop = coverPhoto ? cropOrNull(body.cover_crop) : null;

  const rawPhotos = Array.isArray(body.photos) ? body.photos : [];
  if (rawPhotos.length > PHOTO_SLOTS) {
    return NextResponse.json({ error: "too many photos" }, { status: 400 });
  }
  const photos: ({ url: string; crop: Crop | null } | null)[] = [];
  for (const p of rawPhotos) {
    if (p == null || p === "") {
      photos.push(null);
      continue;
    }
    // accept either a bare url (legacy) or { url, crop }
    const url = typeof p === "string" ? p : (p as { url?: unknown }).url;
    if (!isAcceptablePhotoUrl(url)) {
      return NextResponse.json({ error: "invalid photo" }, { status: 400 });
    }
    const crop = typeof p === "string" ? null : cropOrNull((p as { crop?: unknown }).crop);
    photos.push({ url, crop });
  }

  /* email */
  const email = String(body.email || "").trim().toLowerCase();
  if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    return NextResponse.json({ error: "valid email required" }, { status: 400 });
  }

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
    !ship.line1?.trim() ||
    !ship.city?.trim() ||
    !ship.postcode?.trim() ||
    (stateRequired && !ship.state?.trim())
  ) {
    return NextResponse.json(
      { error: "complete shipping address required" },
      { status: 400 }
    );
  }
  // Lulu requires a phone number on the shipping address for every print job.
  if (!ship.phone?.trim() || ship.phone.replace(/[^\d]/g, "").length < 7) {
    return NextResponse.json(
      { error: "A valid phone number is required for delivery." },
      { status: 400 }
    );
  }

  const shipping = {
    name: ship.name.trim(),
    street1: ship.line1.trim(),
    street2: (ship.line2 || "").trim() || undefined,
    city: ship.city.trim(),
    state_code: (ship.state || "").trim().toUpperCase() || undefined,
    postcode: ship.postcode.trim(),
    country_code: country,
    phone_number: (ship.phone || "").replace(/[^\d+]/g, "") || undefined,
  };

  const approvalToken = randomUUID();

  const row = {
    book_slug: IAM_SLUG,
    child_name: name,
    cover_type: coverType,
    options: { name_arabic: nameArabic, gender, colorway, dedication },
    photo_data: {
      cover_photo_url: (typeof coverPhoto === "string" && coverPhoto) || null,
      cover_crop: coverCrop,
      photos,
    },
    customer_email: email,
    shipping,
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
    console.error("iam order insert fail:", err);
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
