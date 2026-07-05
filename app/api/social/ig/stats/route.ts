import { NextRequest, NextResponse } from "next/server";

// Read-only Instagram post metrics (reach, saves, shares, likes, comments) so
// we can actually diagnose how a post is doing. Gated by CRON_SECRET. Uses the
// existing Meta token flow.

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

  // account-level: follower count
  let followers = 0;
  try {
    const a = await fetch(
      `${GRAPH}/${cfg.meta_ig_id}?fields=followers_count,media_count&access_token=${token}`
    );
    followers = ((await a.json()) as { followers_count?: number }).followers_count || 0;
  } catch {
    /* best effort */
  }

  const m = await fetch(
    `${GRAPH}/${cfg.meta_ig_id}/media?fields=id,caption,media_type,media_product_type,permalink,timestamp,like_count,comments_count&limit=12&access_token=${token}`
  );
  const md = (await m.json()) as {
    data?: {
      id: string;
      caption?: string;
      media_type?: string;
      media_product_type?: string;
      permalink?: string;
      timestamp?: string;
      like_count?: number;
      comments_count?: number;
    }[];
    error?: { message?: string };
  };
  if (!md.data) return NextResponse.json({ error: "media list", detail: md.error }, { status: 500 });

  const posts = [];
  for (const p of md.data) {
    const isReel = p.media_product_type === "REELS";
    const metrics = isReel
      ? "reach,saved,shares,likes,comments,views,total_interactions"
      : "reach,saved,shares,total_interactions";
    let ins: Record<string, number> = {};
    try {
      const r = await fetch(`${GRAPH}/${p.id}/insights?metric=${metrics}&access_token=${token}`);
      const rd = (await r.json()) as { data?: { name: string; values: { value: number }[] }[] };
      for (const row of rd.data || []) ins[row.name] = row.values?.[0]?.value ?? 0;
    } catch {
      /* insights can lag right after posting */
    }
    posts.push({
      type: isReel ? "reel" : p.media_type,
      caption: (p.caption || "").split("\n")[0].slice(0, 60),
      permalink: p.permalink,
      timestamp: p.timestamp,
      likes: p.like_count ?? 0,
      comments: p.comments_count ?? 0,
      reach: ins.reach ?? null,
      saved: ins.saved ?? null,
      shares: ins.shares ?? null,
      views: ins.views ?? null,
      interactions: ins.total_interactions ?? null,
    });
  }

  return NextResponse.json({ ok: true, followers, posts });
}
