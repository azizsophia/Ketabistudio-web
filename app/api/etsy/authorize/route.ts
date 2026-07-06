import { NextRequest, NextResponse } from "next/server";
import { loadEtsyConfig, saveEtsyConfig, makePkce, authorizeUrl } from "@/lib/etsy";

// Owner opens this in a browser (…/api/etsy/authorize?key=CRON_SECRET). It mints
// a PKCE verifier + state, stashes them, and bounces to the Etsy consent screen.
// Etsy redirects back to /api/etsy/callback with ?code, which finishes the flow.
export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const CRON_SECRET = process.env.CRON_SECRET?.trim();

export async function GET(req: NextRequest) {
  const key = req.nextUrl.searchParams.get("key")?.trim();
  if (!CRON_SECRET || key !== CRON_SECRET) {
    return NextResponse.json({ error: "unauthorized (append ?key=CRON_SECRET)" }, { status: 401 });
  }
  const cfg = await loadEtsyConfig();
  if (!cfg?.keystring) {
    return NextResponse.json(
      { error: "not configured — POST /api/etsy/config with the keystring first" },
      { status: 400 }
    );
  }
  const { verifier, challenge, state } = makePkce();
  await saveEtsyConfig({ pending_verifier: verifier, pending_state: state });
  return NextResponse.redirect(authorizeUrl(cfg.keystring, challenge, state));
}
