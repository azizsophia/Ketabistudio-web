import { NextRequest, NextResponse } from "next/server";
import { loadThreadsCreds, refreshedThreadsCreds, recentReplies, postReply } from "@/lib/threads";

// Read + answer Threads comments (needs threads_manage_replies on the stored
// token). GET returns recent replies on our posts (so Claude can read them and
// draft answers); POST publishes one approved reply. Gated by CRON_SECRET.
// Human-in-the-loop by design: nothing auto-replies. Claude drafts, owner
// approves, this posts.

const CRON_SECRET = process.env.CRON_SECRET?.trim();

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function authorized(req: NextRequest): boolean {
  const auth = (req.headers.get("authorization") || "").trim();
  return !!CRON_SECRET && auth === `Bearer ${CRON_SECRET}`;
}

export async function GET(req: NextRequest) {
  if (!authorized(req)) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  let creds = await loadThreadsCreds();
  if (!creds) return NextResponse.json({ error: "threads not connected" }, { status: 400 });
  creds = await refreshedThreadsCreds(creds);
  try {
    const replies = (await recentReplies(creds)).filter((r) => !r.is_reply_to_us);
    return NextResponse.json({ ok: true, count: replies.length, replies });
  } catch (e) {
    return NextResponse.json(
      { error: "read failed", detail: e instanceof Error ? e.message : "unknown" },
      { status: 500 }
    );
  }
}

// Body: { replies: [{ reply_to_id, text }] } — post one or many approved replies.
export async function POST(req: NextRequest) {
  if (!authorized(req)) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  let creds = await loadThreadsCreds();
  if (!creds) return NextResponse.json({ error: "threads not connected" }, { status: 400 });
  creds = await refreshedThreadsCreds(creds);

  let body: { replies?: { reply_to_id?: string; text?: string }[] };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "invalid json" }, { status: 400 });
  }
  const items = (body.replies || []).filter((r) => r.reply_to_id && r.text);
  if (!items.length) return NextResponse.json({ error: "no replies" }, { status: 400 });

  const results: Array<Record<string, unknown>> = [];
  for (const it of items) {
    try {
      const id = await postReply(creds, it.reply_to_id as string, it.text as string);
      results.push({ reply_to_id: it.reply_to_id, posted_id: id });
    } catch (e) {
      results.push({ reply_to_id: it.reply_to_id, error: e instanceof Error ? e.message : "unknown" });
    }
  }
  return NextResponse.json({ ok: true, results });
}
