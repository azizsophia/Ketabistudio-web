import { NextRequest, NextResponse } from "next/server";
import { randomUUID } from "crypto";
import { BOOKS } from "@/lib/books";

/* Books not orderable: teased (comingSoon) or fully parked (hidden). */
const COMING_SOON_SLUGS = new Set(
  BOOKS.filter((b) => b.comingSoon || b.hidden).map((b) => b.slug)
);

const SB = process.env.SUPABASE_URL?.replace(/\s/g, "").replace(/\/$/, "");
const KEY = process.env.SUPABASE_SERVICE_KEY?.replace(/\s/g, "");

const VALID_SLUGS = [
  "her-beautiful-hijab",
  "my-beautiful-duas",
  "juha-and-the-enormous-pumpkin",
  "maryam-is-kind-to-her-parents",
  // Printed coil journal (owner, 2026-07-19: sold on-site alongside the PDF).
  // Non-personalized; the worker fulfills it via JOURNAL_SLUG / COIL_POD —
  // the same pipeline that printed the owner's proof copy.
  "from-one-root-journal",
];
const PERSONALIZED_SLUGS = ["her-beautiful-hijab", "my-beautiful-duas"];
const DUAS_SLUGS = ["my-beautiful-duas"];
const VALID_SKIN = ["light", "medium", "dark"];
const VALID_HAIR = ["black", "brown", "blonde", "red"];
const VALID_STYLE = ["long-straight", "long-curly", "short-straight", "short-curly"];
const VALID_CHARACTER = ["boy", "girl", "hijab"];
const VALID_LOOK = ["afro", "indian", "white"];

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

  const slug = String(body.book_slug || "");
  if (!VALID_SLUGS.includes(slug)) {
    return NextResponse.json({ error: "invalid book" }, { status: 400 });
  }
  if (COMING_SOON_SLUGS.has(slug)) {
    return NextResponse.json(
      { error: "This book isn't available to order yet." },
      { status: 400 }
    );
  }

  const personalized = PERSONALIZED_SLUGS.includes(slug);
  const isDuas = DUAS_SLUGS.includes(slug);

  /* cover type — default softcover. Hardcover is ALLOWED ONLY for the two
     personalized books; reject it for any other slug so fixed books stay
     softcover-only. */
  const coverTypeRaw = String(body.cover_type || "softcover").toLowerCase();
  if (coverTypeRaw !== "softcover" && coverTypeRaw !== "hardcover") {
    return NextResponse.json({ error: "invalid cover type" }, { status: 400 });
  }
  if (coverTypeRaw === "hardcover" && !PERSONALIZED_SLUGS.includes(slug)) {
    return NextResponse.json(
      { error: "hardcover not available for this book" },
      { status: 400 }
    );
  }
  const coverType = coverTypeRaw;

  /* validate personalization fields */
  let childName: string | null = null;
  let skin: string | null = null;
  let hair: string | null = null;
  let hairStyle: string | null = null;
  let options: Record<string, string> | null = null;

  if (personalized) {
    childName = String(body.child_name || "").trim();
    if (!childName || childName.length > 14) {
      return NextResponse.json(
        { error: "Name required (1 to 14 characters)" },
        { status: 400 }
      );
    }
    if (isDuas) {
      const character = String(body.character || "");
      const look = String(body.look || "");
      if (!VALID_CHARACTER.includes(character))
        return NextResponse.json({ error: "invalid character" }, { status: 400 });
      if (!VALID_LOOK.includes(look))
        return NextResponse.json({ error: "invalid look" }, { status: 400 });
      // Eye colour is no longer named in the book (it clashed with the fixed
      // artwork), so it is no longer collected or required.
      options = { character, look };
    } else {
      skin = String(body.skin || "");
      hair = String(body.hair || "");
      hairStyle = String(body.hair_style || "");
      if (!VALID_SKIN.includes(skin))
        return NextResponse.json({ error: "invalid skin" }, { status: 400 });
      if (!VALID_HAIR.includes(hair))
        return NextResponse.json({ error: "invalid hair" }, { status: 400 });
      if (!VALID_STYLE.includes(hairStyle))
        return NextResponse.json({ error: "invalid hair style" }, { status: 400 });
    }
  } else if (slug === "juha-and-the-enormous-pumpkin") {
    /* Fixed book with a gift dedication: an optional name printed on the
       "Made especially for ___" page. Blank means the generic "you" copy. */
    const gift = String(body.child_name || "").trim();
    if (gift) {
      if (gift.length > 14 || !/^[\p{L}][\p{L} '\-]*$/u.test(gift)) {
        return NextResponse.json(
          { error: "Gift name: letters only, up to 14 characters" },
          { status: 400 }
        );
      }
      childName = gift;
    }
  }

  /* validate email */
  const email = String(body.email || "").trim().toLowerCase();
  if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    return NextResponse.json({ error: "valid email required" }, { status: 400 });
  }

  /* validate shipping */
  // Lulu ships these on its cheap MAIL service. Excluded: AE, KW, QA, OM, JO
  // (EXPRESS-only, ~$56 shipping — unprofitable) and BH (no Lulu shipping at
  // all). Saudi (SA) stays — it ships fine on MAIL (~$17). Confirmed against
  // Lulu production, 2026-06-24.
  const VALID_COUNTRIES = new Set([
    "US","AU","AT","BE","CA","DK","EG","FI","FR","DE","IE","IT",
    "MY","NL","NZ","NO","SA","SG","ZA","ES","SE","CH","TR","GB",
  ]);
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
  // Lulu requires a phone number on the shipping address for every print job.
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
    child_name: childName,
    skin,
    hair,
    hair_style: hairStyle,
    options,
    cover_type: coverType,
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
    console.error("order insert fail:", err);
    return NextResponse.json({ error: "order failed" }, { status: 500 });
  }

  const [created] = await r.json();

  /* log event */
  await fetch(`${SB}/rest/v1/order_events`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${KEY}`,
      apikey: KEY!,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      order_id: created.id,
      event: "awaiting_payment",
    }),
  });

  return NextResponse.json({
    ok: true,
    orderId: created.id,
    message: "Order created. Continue to payment.",
  });
}
