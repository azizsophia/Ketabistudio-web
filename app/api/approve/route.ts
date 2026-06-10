import { NextRequest, NextResponse } from "next/server";

/**
 * Owner approval gate. The worker writes orders with a random approval_token;
 * only a link containing the matching token can flip the status.
 * GET /api/approve?order={uuid}&token={uuid}&action=approve|reject
 */
export async function GET(req: NextRequest) {
  const url = new URL(req.url);
  const order = url.searchParams.get("order");
  const token = url.searchParams.get("token");
  const action = url.searchParams.get("action") ?? "approve";

  if (!order || !token || !["approve", "reject"].includes(action)) {
    return NextResponse.json({ error: "bad request" }, { status: 400 });
  }

  const SB = process.env.SUPABASE_URL;
  const KEY = process.env.SUPABASE_SERVICE_KEY;
  if (!SB || !KEY) {
    return NextResponse.json({ error: "not configured" }, { status: 500 });
  }

  const newStatus = action === "approve" ? "approved" : "rejected";

  // token-gated update: PATCH matches only if order id AND token AND
  // status=awaiting_approval all line up — otherwise zero rows change.
  const r = await fetch(
    `${SB}/rest/v1/orders?id=eq.${order}&approval_token=eq.${token}&status=eq.awaiting_approval`,
    {
      method: "PATCH",
      headers: {
        Authorization: `Bearer ${KEY}`,
        apikey: KEY,
        "Content-Type": "application/json",
        Prefer: "return=representation",
      },
      body: JSON.stringify({ status: newStatus }),
    }
  );

  const rows = await r.json();
  if (!Array.isArray(rows) || rows.length === 0) {
    return NextResponse.json(
      { error: "no matching order awaiting approval (bad token or wrong state)" },
      { status: 404 }
    );
  }

  return new NextResponse(
    `<!doctype html><meta name="viewport" content="width=device-width">
     <body style="font-family:system-ui;background:#F6F4EF;color:#2E4A3A;
       display:flex;align-items:center;justify-content:center;height:100vh;margin:0">
       <div style="text-align:center">
         <h1 style="margin:0 0 8px">${action === "approve" ? "✓ Approved" : "✗ Rejected"}</h1>
         <p style="color:#6f6a5f">Order ${order!.slice(0, 8)}… is now <b>${newStatus}</b>.</p>
       </div>
     </body>`,
    { headers: { "Content-Type": "text/html" } }
  );
}
