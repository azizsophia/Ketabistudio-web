import { NextRequest, NextResponse } from "next/server";
import { luluCostCalc, type LuluAddress } from "@/lib/lulu";
import { BOOK_SHIP_SPEC, HARDCOVER_POD, HARDCOVER_SLUGS } from "@/lib/pricing";

/* Owner pricing tool (Bearer CRON_SECRET): real Lulu print + shipping cost for
   any catalog book to any address, at MAIL and EXPRESS. No order is created.
   Body: { book_slug: string, cover_type?: "softcover"|"hardcover",
           shipping: { street1, city, postcode, country_code, ... } } */

const CRON_SECRET = process.env.CRON_SECRET?.trim();

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(req: NextRequest) {
  const auth = (req.headers.get("authorization") || "").trim();
  if (!CRON_SECRET || auth !== `Bearer ${CRON_SECRET}`) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  let body: {
    book_slug?: string;
    cover_type?: string;
    shipping?: LuluAddress;
    levels?: string[];
  };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "invalid json" }, { status: 400 });
  }

  const slug = String(body.book_slug || "");
  const spec = BOOK_SHIP_SPEC[slug];
  if (!spec) {
    return NextResponse.json(
      { error: "unknown book_slug", known: Object.keys(BOOK_SHIP_SPEC) },
      { status: 400 }
    );
  }
  const pod =
    body.cover_type === "hardcover" && HARDCOVER_SLUGS.includes(slug)
      ? HARDCOVER_POD
      : spec.pod;

  const addr = body.shipping;
  if (!addr?.street1 || !addr?.city || !addr?.postcode || !addr?.country_code) {
    return NextResponse.json(
      { error: "shipping needs street1, city, postcode, country_code" },
      { status: 400 }
    );
  }

  const levels = Array.isArray(body.levels) && body.levels.length
    ? body.levels.map(String)
    : ["MAIL", "EXPRESS"];

  const out: Record<string, unknown> = {};
  for (const level of levels) {
    const c = await luluCostCalc(addr, {
      pageCount: spec.pageCount,
      pod,
      level,
    });
    out[level] = c ?? { error: "unavailable for this destination/level" };
  }

  return NextResponse.json({
    ok: true,
    book_slug: slug,
    pod,
    page_count: spec.pageCount,
    destination: `${addr.city}, ${addr.country_code}`,
    cost: out,
  });
}
