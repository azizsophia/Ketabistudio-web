import { NextRequest, NextResponse } from "next/server";
import { loadEtsyConfig, exchangeCode, getShopId } from "@/lib/etsy";

// Etsy redirects here after the owner approves. We validate state (CSRF), swap
// the code + PKCE verifier for tokens, cache the shop id, and show a branded
// success page. This is the URL that must be registered as the app callback:
//   https://www.ketabistudio.com/api/etsy/callback
export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function page(title: string, body: string, ok: boolean) {
  return new NextResponse(
    `<!DOCTYPE html><html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>${title}</title>
<style>body{font-family:Georgia,serif;background:#f3eee2;color:#2f3b32;display:flex;min-height:100vh;align-items:center;justify-content:center;margin:0}
.card{max-width:420px;padding:48px;text-align:center}.mark{letter-spacing:6px;font-size:14px;color:#96804a;margin-bottom:24px}
h1{font-size:26px;margin:0 0 12px}p{color:#6b6a5e;line-height:1.5}</style></head>
<body><div class="card"><div class="mark">KETABI STUDIO</div><h1>${ok ? "✓ " : ""}${title}</h1><p>${body}</p></div></body></html>`,
    { status: ok ? 200 : 400, headers: { "Content-Type": "text/html; charset=utf-8" } }
  );
}

export async function GET(req: NextRequest) {
  const code = req.nextUrl.searchParams.get("code")?.trim();
  const state = req.nextUrl.searchParams.get("state")?.trim();
  const err = req.nextUrl.searchParams.get("error");
  if (err) return page("Connection declined", "Etsy said: " + err, false);
  if (!code) return page("Missing code", "No authorization code returned by Etsy.", false);

  const cfg = await loadEtsyConfig();
  if (!cfg?.pending_state || cfg.pending_state !== state) {
    return page("State mismatch", "Security check failed. Start again from /api/etsy/authorize.", false);
  }
  const ex = await exchangeCode(cfg, code);
  if (!ex.ok) return page("Token exchange failed", "Etsy said: " + (ex.detail || "unknown"), false);

  await getShopId().catch(() => null); // cache shop id (non-fatal)
  return page(
    "Etsy connected",
    "You can close this page. Ketabi can now create and manage your Etsy listings.",
    true
  );
}
