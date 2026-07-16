import { NextRequest, NextResponse } from "next/server";
import { loadThreadsCreds } from "@/lib/threads";

/* Owner analytics (Bearer CRON_SECRET): recent IG media + Threads posts with
   their performance metrics, so content decisions run on real numbers instead
   of vibes. Read-only; uses the same stored tokens as the poster. */

const SB = process.env.SUPABASE_URL?.replace(/\s/g, "").replace(/\/$/, "");
const KEY = process.env.SUPABASE_SERVICE_KEY?.replace(/\s/g, "");
const CRON_SECRET = process.env.CRON_SECRET?.trim();
const GRAPH = "https://graph.facebook.com/v21.0";
const TH_GRAPH = "https://graph.threads.net/v1.0";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 60;

type Cfg = { meta_page_token?: string; meta_ig_id?: string };

export async function GET(req: NextRequest) {
  const auth = (req.headers.get("authorization") || "").trim();
  if (!CRON_SECRET || auth !== `Bearer ${CRON_SECRET}`) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }
  if (!SB || !KEY) return NextResponse.json({ error: "not configured" }, { status: 500 });

  const cfgR = await fetch(`${SB}/rest/v1/social_config?id=eq.1&select=meta_page_token,meta_ig_id`, {
    headers: { Authorization: `Bearer ${KEY}`, apikey: KEY }, cache: "no-store",
  });
  const cfg = ((await cfgR.json().catch(() => [])) as Cfg[])[0];
  if (!cfg?.meta_page_token || !cfg?.meta_ig_id) {
    return NextResponse.json({ error: "social_config not readable" }, { status: 500 });
  }

  // ── Instagram: recent media + per-media insights ──
  const mediaR = await fetch(
    `${GRAPH}/${cfg.meta_ig_id}/media?fields=id,caption,media_type,media_product_type,permalink,timestamp,like_count,comments_count&limit=25&access_token=${cfg.meta_page_token}`
  );
  const media = ((await mediaR.json().catch(() => ({}))) as {
    data?: {
      id: string; caption?: string; media_type?: string; media_product_type?: string;
      permalink?: string; timestamp?: string; like_count?: number; comments_count?: number;
    }[];
  }).data || [];

  const ig = [];
  for (const m of media) {
    const isReel = m.media_product_type === "REELS";
    const metrics = isReel ? "views,reach,likes,comments,saved,shares,total_interactions"
                           : "views,reach,likes,comments,saved,shares";
    const insR = await fetch(`${GRAPH}/${m.id}/insights?metric=${metrics}&access_token=${cfg.meta_page_token}`);
    const ins = ((await insR.json().catch(() => ({}))) as {
      data?: { name: string; values?: { value?: number }[] }[];
    }).data || [];
    const kv: Record<string, number> = {};
    for (const d of ins) kv[d.name] = d.values?.[0]?.value ?? 0;
    ig.push({
      type: isReel ? "reel" : (m.media_type || "").toLowerCase(),
      posted: m.timestamp,
      caption: (m.caption || "").slice(0, 70),
      permalink: m.permalink,
      likes: m.like_count ?? kv.likes ?? 0,
      comments: m.comments_count ?? kv.comments ?? 0,
      ...kv,
    });
  }

  // ── Threads: recent posts + insights ──
  const th: unknown[] = [];
  const creds = await loadThreadsCreds();
  if (creds) {
    const postsR = await fetch(
      `${TH_GRAPH}/${creds.user_id}/threads?fields=id,text,media_type,timestamp,permalink&limit=25&access_token=${creds.token}`
    );
    const posts = ((await postsR.json().catch(() => ({}))) as {
      data?: { id: string; text?: string; media_type?: string; timestamp?: string; permalink?: string }[];
    }).data || [];
    for (const p of posts) {
      const insR = await fetch(
        `${TH_GRAPH}/${p.id}/insights?metric=views,likes,replies,reposts,quotes&access_token=${creds.token}`
      );
      const ins = ((await insR.json().catch(() => ({}))) as {
        data?: { name: string; values?: { value?: number }[]; total_value?: { value?: number } }[];
      }).data || [];
      const kv: Record<string, number> = {};
      for (const d of ins) kv[d.name] = d.total_value?.value ?? d.values?.[0]?.value ?? 0;
      th.push({
        type: (p.media_type || "").toLowerCase(),
        posted: p.timestamp,
        text: (p.text || "").slice(0, 70),
        ...kv,
      });
    }
  }

  return NextResponse.json({ ok: true, instagram: ig, threads: th });
}
