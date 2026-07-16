import { NextRequest, NextResponse } from "next/server";
import {
  authorizeUrl,
  createBoard,
  createPin,
  exchangeCode,
  listBoards,
  loadPinterestCreds,
  pinterestConfigured,
  refreshedPinterestCreds,
  savePinterestCreds,
} from "@/lib/pinterest";

/* Owner tooling for the Pinterest auto-poster (Bearer CRON_SECRET).
   GET            → status: configured? connected? boards, chosen board, auth URL
   POST {code}    → exchange the OAuth code from /pinterest/callback and save
   POST {board:{name}}     → create a public board and select it for posting
   POST {select_board:{id}}→ point the poster at an existing board
   POST {test_pin:{image_url, caption, link?}} → post one pin now (on a Trial
   app the pin is visible only to the connected account — test-only). */

const CRON_SECRET = process.env.CRON_SECRET?.trim();

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function authorized(req: NextRequest): boolean {
  const auth = (req.headers.get("authorization") || "").trim();
  return Boolean(CRON_SECRET && auth === `Bearer ${CRON_SECRET}`);
}

export async function GET(req: NextRequest) {
  if (!authorized(req)) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  if (!pinterestConfigured()) {
    return NextResponse.json({
      configured: false,
      hint: "Set PINTEREST_APP_ID and PINTEREST_APP_SECRET in Vercel env, then redeploy.",
    });
  }
  const creds = await loadPinterestCreds();
  if (!creds) {
    return NextResponse.json({ configured: true, connected: false, authorize_url: authorizeUrl() });
  }
  const fresh = await refreshedPinterestCreds(creds);
  let boards: { id: string; name: string }[] = [];
  let boards_error: string | undefined;
  try {
    boards = await listBoards(fresh);
  } catch (e) {
    boards_error = e instanceof Error ? e.message : "unknown";
  }
  return NextResponse.json({
    configured: true,
    connected: true,
    token_expires_at: new Date(fresh.expires_at).toISOString(),
    posting_board: fresh.board_id || null,
    boards,
    ...(boards_error ? { boards_error } : {}),
  });
}

export async function POST(req: NextRequest) {
  if (!authorized(req)) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  if (!pinterestConfigured()) {
    return NextResponse.json({ error: "PINTEREST_APP_ID / PINTEREST_APP_SECRET not set" }, { status: 500 });
  }
  let body: {
    code?: string;
    board?: { name: string; description?: string };
    select_board?: { id: string };
    test_pin?: { image_url: string; caption: string; link?: string };
  };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "invalid json" }, { status: 400 });
  }

  if (body.code) {
    const creds = await exchangeCode(body.code.trim());
    return NextResponse.json({ ok: true, connected: true, expires_at: new Date(creds.expires_at).toISOString() });
  }

  const creds = await loadPinterestCreds();
  if (!creds) return NextResponse.json({ error: "not connected — visit the authorize_url first" }, { status: 400 });
  const fresh = await refreshedPinterestCreds(creds);

  if (body.board?.name) {
    const b = await createBoard(fresh, body.board.name, body.board.description);
    await savePinterestCreds({ ...fresh, board_id: b.id });
    return NextResponse.json({ ok: true, board: b, posting_board: b.id });
  }

  if (body.select_board?.id) {
    await savePinterestCreds({ ...fresh, board_id: body.select_board.id });
    return NextResponse.json({ ok: true, posting_board: body.select_board.id });
  }

  if (body.test_pin?.image_url && body.test_pin.caption) {
    if (!fresh.board_id) return NextResponse.json({ error: "no posting board selected" }, { status: 400 });
    const { pinTextFromCaption } = await import("@/lib/pinterest");
    const { title, description } = pinTextFromCaption(body.test_pin.caption);
    const id = await createPin(
      fresh,
      fresh.board_id,
      body.test_pin.image_url,
      title,
      description,
      body.test_pin.link || "https://www.ketabistudio.com/?r=pinterest"
    );
    return NextResponse.json({ ok: true, pin_id: id });
  }

  return NextResponse.json({ error: "no action" }, { status: 400 });
}
