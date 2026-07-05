import { NextRequest, NextResponse } from "next/server";
import { recentIgComments, replyToIgComment } from "@/lib/igComments";

// Read + answer Instagram comments (scope instagram_manage_comments, already
// granted). GET lists recent comments on our media; POST publishes approved
// replies. Gated by CRON_SECRET. Human-in-the-loop: Claude drafts, owner
// approves, this posts. Reuses the same Meta token flow as the poster.

const SB = process.env.SUPABASE_URL?.replace(/\s/g, "").replace(/\/$/, "");
const KEY = process.env.SUPABASE_SERVICE_KEY?.replace(/\s/g, "");
const CRON_SECRET = process.env.CRON_SECRET?.trim();
const GRAPH = "https://graph.facebook.com/v21.0";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type Config = {
  meta_user_token: string;
  meta_page_token: string;
  meta_page_id: string;
  meta_ig_id: string;
  meta_app_id: string;
  meta_app_secret: string;
};

function authorized(req: NextRequest): boolean {
  const auth = (req.headers.get("authorization") || "").trim();
  return !!CRON_SECRET && auth === `Bearer ${CRON_SECRET}`;
}

async function loadCfg(): Promise<Config | null> {
  const r = await fetch(`${SB}/rest/v1/social_config?id=eq.1&select=*`, {
    headers: { Authorization: `Bearer ${KEY}`, apikey: KEY as string },
    cache: "no-store",
  });
  const rows = (await r.json()) as Config[];
  return Array.isArray(rows) ? rows[0] ?? null : null;
}

// Fresh long-lived page token (same exchange the poster uses).
async function pageToken(cfg: Config): Promise<string> {
  try {
    const ex = await fetch(
      `${GRAPH}/oauth/access_token?grant_type=fb_exchange_token&client_id=${cfg.meta_app_id}&client_secret=${cfg.meta_app_secret}&fb_exchange_token=${cfg.meta_user_token}`
    );
    const exd = (await ex.json()) as { access_token?: string };
    if (!exd.access_token) return cfg.meta_page_token;
    const pr = await fetch(
      `${GRAPH}/${cfg.meta_page_id}?fields=access_token&access_token=${exd.access_token}`
    );
    const prd = (await pr.json()) as { access_token?: string };
    return prd.access_token || cfg.meta_page_token;
  } catch {
    return cfg.meta_page_token;
  }
}

export async function GET(req: NextRequest) {
  if (!authorized(req)) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  if (!SB || !KEY) return NextResponse.json({ error: "not configured" }, { status: 500 });
  const cfg = await loadCfg();
  if (!cfg?.meta_ig_id) return NextResponse.json({ error: "no config" }, { status: 500 });
  const token = await pageToken(cfg);
  const onlyOpen = req.nextUrl.searchParams.get("all") !== "1";
  try {
    let comments = await recentIgComments(cfg, token);
    if (onlyOpen) comments = comments.filter((c) => !c.replied_by_us);
    return NextResponse.json({ ok: true, count: comments.length, comments });
  } catch (e) {
    return NextResponse.json(
      { error: "read failed", detail: e instanceof Error ? e.message : "unknown" },
      { status: 500 }
    );
  }
}

// Body: { replies: [{ comment_id, text }] }
export async function POST(req: NextRequest) {
  if (!authorized(req)) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  if (!SB || !KEY) return NextResponse.json({ error: "not configured" }, { status: 500 });
  const cfg = await loadCfg();
  if (!cfg?.meta_ig_id) return NextResponse.json({ error: "no config" }, { status: 500 });
  const token = await pageToken(cfg);

  let body: { replies?: { comment_id?: string; text?: string }[] };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "invalid json" }, { status: 400 });
  }
  const items = (body.replies || []).filter((r) => r.comment_id && r.text);
  if (!items.length) return NextResponse.json({ error: "no replies" }, { status: 400 });

  const results: Array<Record<string, unknown>> = [];
  for (const it of items) {
    try {
      const id = await replyToIgComment(it.comment_id as string, token, it.text as string);
      results.push({ comment_id: it.comment_id, posted_id: id });
    } catch (e) {
      results.push({ comment_id: it.comment_id, error: e instanceof Error ? e.message : "unknown" });
    }
  }
  return NextResponse.json({ ok: true, results });
}
