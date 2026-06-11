import { NextRequest, NextResponse } from "next/server";

const SB = process.env.SUPABASE_URL?.replace(/\s/g, "").replace(/\/$/, "");
const KEY = process.env.SUPABASE_SERVICE_KEY?.replace(/\s/g, "");
const ADMIN = process.env.ADMIN_KEY;

export async function POST(req: NextRequest) {
  const k = req.headers.get("x-admin-key");
  if (!ADMIN || !k || k !== ADMIN) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }
  if (!SB || !KEY) {
    return NextResponse.json({ error: "not configured" }, { status: 500 });
  }

  const body = await req.json();
  const { orderId, action } = body as { orderId?: string; action?: string };

  if (!orderId || !action || !["approve", "reject"].includes(action)) {
    return NextResponse.json({ error: "bad request" }, { status: 400 });
  }

  const newStatus = action === "approve" ? "approved" : "rejected";

  const r = await fetch(
    `${SB}/rest/v1/orders?id=eq.${orderId}&status=eq.awaiting_approval`,
    {
      method: "PATCH",
      headers: {
        Authorization: `Bearer ${KEY}`,
        apikey: KEY!,
        "Content-Type": "application/json",
        Prefer: "return=representation",
      },
      body: JSON.stringify({ status: newStatus }),
    }
  );

  const rows = await r.json();
  if (!Array.isArray(rows) || rows.length === 0) {
    return NextResponse.json(
      { error: "no matching order awaiting approval" },
      { status: 404 }
    );
  }

  // Log the event
  await fetch(`${SB}/rest/v1/order_events`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${KEY}`,
      apikey: KEY!,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      order_id: orderId,
      event: newStatus,
      detail: { by: "admin" },
    }),
  });

  return NextResponse.json({ status: newStatus, orderId });
}
