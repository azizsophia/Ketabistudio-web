import { NextRequest, NextResponse } from "next/server";

/* Owner-only cleanup for the RETIRED physical greeting-card line (Bearer
   CRON_SECRET). Physical cards are discontinued and checkout is 410-gated, but
   a leftover card_orders row left "pending" (e.g. an old test) can still be
   swept up and billed by the fulfillment worker. This endpoint neutralises that
   risk from the data side:
     GET             -> count card_orders by status (see what's queued)
     POST {cancel:true} -> mark every not-yet-submitted card order (pending /
                           rendering) as cancelled so nothing can be printed or
                           charged. Already-submitted/shipped rows are left as
                           history and never re-touched. */

const SB = process.env.SUPABASE_URL?.replace(/\s/g, "").replace(/\/$/, "");
const KEY = process.env.SUPABASE_SERVICE_KEY?.replace(/\s/g, "");
const CRON_SECRET = process.env.CRON_SECRET?.trim();

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const CANCELABLE = ["pending", "rendering"];

function authorized(req: NextRequest): boolean {
  const auth = (req.headers.get("authorization") || "").trim();
  return !!CRON_SECRET && auth === `Bearer ${CRON_SECRET}`;
}

async function counts(): Promise<Record<string, number>> {
  const r = await fetch(`${SB}/rest/v1/card_orders?select=status`, {
    headers: { Authorization: `Bearer ${KEY}`, apikey: KEY! },
    cache: "no-store",
  });
  const rows = (await r.json().catch(() => [])) as { status: string }[];
  const out: Record<string, number> = {};
  if (Array.isArray(rows)) {
    for (const x of rows) out[x.status] = (out[x.status] || 0) + 1;
  }
  return out;
}

export async function GET(req: NextRequest) {
  if (!authorized(req)) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  if (!SB || !KEY) return NextResponse.json({ error: "not configured" }, { status: 500 });
  return NextResponse.json({ ok: true, by_status: await counts() });
}

export async function POST(req: NextRequest) {
  if (!authorized(req)) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  if (!SB || !KEY) return NextResponse.json({ error: "not configured" }, { status: 500 });

  let body: { cancel?: boolean };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "invalid json" }, { status: 400 });
  }
  if (!body.cancel) return NextResponse.json({ error: "cancel required" }, { status: 400 });

  const before = await counts();
  const r = await fetch(
    `${SB}/rest/v1/card_orders?status=in.(${CANCELABLE.join(",")})`,
    {
      method: "PATCH",
      headers: {
        Authorization: `Bearer ${KEY}`,
        apikey: KEY!,
        "Content-Type": "application/json",
        Prefer: "return=representation",
      },
      body: JSON.stringify({ status: "cancelled" }),
    }
  );
  const rows = await r.json().catch(() => []);
  return NextResponse.json({
    ok: true,
    cancelled: Array.isArray(rows) ? rows.length : 0,
    before,
    after: await counts(),
  });
}
