import { NextRequest, NextResponse } from "next/server";
import { runSocialQc } from "@/lib/socialQc";

// Auto-poster. A daily Vercel cron hits this. It pulls the next due, already
// human/AI-reviewed post from social_queue, runs the QC gate one more time,
// then publishes to Instagram + Facebook and refreshes its own Meta token.

const SB = process.env.SUPABASE_URL?.replace(/\s/g, "").replace(/\/$/, "");
const KEY = process.env.SUPABASE_SERVICE_KEY?.replace(/\s/g, "");
const CRON_SECRET = process.env.CRON_SECRET;
const ADMIN = process.env.ADMIN_KEY;
const GRAPH = "https://graph.facebook.com/v21.0";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 60;

type Config = {
  meta_user_token: string;
  meta_page_token: string;
  meta_page_id: string;
  meta_ig_id: string;
  meta_app_id: string;
  meta_app_secret: string;
};

type Post = {
  id: string;
  image_url: string;
  caption: string;
  platforms: string | null;
  qc_reviewed: boolean;
};

function authorized(req: NextRequest): boolean {
  const auth = req.headers.get("authorization") || "";
  if (CRON_SECRET && auth === `Bearer ${CRON_SECRET}`) return true;
  const k = req.nextUrl.searchParams.get("key");
  if (ADMIN && k && k === ADMIN) return true;
  return false;
}

function sb(path: string, init?: RequestInit) {
  return fetch(`${SB}/rest/v1/${path}`, {
    ...init,
    headers: {
      Authorization: `Bearer ${KEY}`,
      apikey: KEY as string,
      "Content-Type": "application/json",
      ...(init?.headers || {}),
    },
  });
}

async function patchPost(id: string, patch: Record<string, unknown>) {
  await sb(`social_queue?id=eq.${id}`, {
    method: "PATCH",
    body: JSON.stringify(patch),
  });
}

// Extend the long-lived user token (keeps the login alive), derive a fresh
// page token, and persist both. Falls back to the stored page token on any
// hiccup so a transient error never blocks a post.
async function currentPageToken(cfg: Config): Promise<string> {
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
    const newPage = prd.access_token || cfg.meta_page_token;
    await sb("social_config?id=eq.1", {
      method: "PATCH",
      body: JSON.stringify({
        meta_user_token: exd.access_token,
        meta_page_token: newPage,
        updated_at: new Date().toISOString(),
      }),
    });
    return newPage;
  } catch {
    return cfg.meta_page_token;
  }
}

async function publishIg(
  ig: string,
  token: string,
  imageUrl: string,
  caption: string
): Promise<{ mediaId: string; permalink: string }> {
  const c = await fetch(`${GRAPH}/${ig}/media`, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({ image_url: imageUrl, caption, access_token: token }),
  });
  const cd = (await c.json()) as { id?: string; error?: unknown };
  if (!cd.id) throw new Error("ig container: " + JSON.stringify(cd.error || cd));
  await new Promise((r) => setTimeout(r, 5000));
  const p = await fetch(`${GRAPH}/${ig}/media_publish`, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({ creation_id: cd.id, access_token: token }),
  });
  const pd = (await p.json()) as { id?: string; error?: unknown };
  if (!pd.id) throw new Error("ig publish: " + JSON.stringify(pd.error || pd));
  let permalink = "";
  try {
    const pl = await fetch(`${GRAPH}/${pd.id}?fields=permalink&access_token=${token}`);
    permalink = ((await pl.json()) as { permalink?: string }).permalink || "";
  } catch {
    /* permalink is best-effort */
  }
  return { mediaId: pd.id, permalink };
}

async function publishFb(
  page: string,
  token: string,
  imageUrl: string,
  caption: string
): Promise<string> {
  const r = await fetch(`${GRAPH}/${page}/photos`, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({ url: imageUrl, caption, access_token: token }),
  });
  const d = (await r.json()) as { id?: string; post_id?: string; error?: unknown };
  if (!d.id && !d.post_id) throw new Error("fb: " + JSON.stringify(d.error || d));
  return d.post_id || (d.id as string);
}

export async function GET(req: NextRequest) {
  if (!authorized(req)) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }
  if (!SB || !KEY) {
    return NextResponse.json({ error: "not configured" }, { status: 500 });
  }

  const cfgRows = (await (await sb("social_config?id=eq.1&select=*")).json()) as Config[];
  const cfg = Array.isArray(cfgRows) ? cfgRows[0] : undefined;
  if (!cfg?.meta_page_token || !cfg?.meta_ig_id) {
    return NextResponse.json({ error: "social_config not seeded" }, { status: 500 });
  }

  const nowIso = new Date().toISOString();
  const dueRows = (await (
    await sb(
      `social_queue?status=eq.queued&scheduled_for=lte.${nowIso}&order=scheduled_for.asc&limit=1&select=*`
    )
  ).json()) as Post[];
  if (!Array.isArray(dueRows) || dueRows.length === 0) {
    return NextResponse.json({ ok: true, message: "nothing due" });
  }
  const post = dueRows[0];

  // Gate 1: must have been reviewed (by me/Claude) when it was queued.
  if (!post.qc_reviewed) {
    await patchPost(post.id, { status: "blocked", error: "not qc_reviewed" });
    return NextResponse.json({ ok: false, blocked: post.id, reason: "not reviewed" });
  }

  // Gate 2: automated QC (deterministic + optional Claude proofread).
  const verdict = await runSocialQc(post.caption, post.image_url);
  if (!verdict.pass) {
    await patchPost(post.id, { status: "blocked", qc: verdict, error: "qc failed" });
    return NextResponse.json({ ok: false, blocked: post.id, verdict });
  }

  const token = await currentPageToken(cfg);
  const platforms = String(post.platforms || "ig,fb")
    .split(",")
    .map((s) => s.trim());
  const out: {
    id: string;
    ig_media_id?: string;
    ig_permalink?: string;
    fb_post_id?: string;
  } = { id: post.id };

  try {
    if (platforms.includes("ig")) {
      const ig = await publishIg(cfg.meta_ig_id, token, post.image_url, post.caption);
      out.ig_media_id = ig.mediaId;
      out.ig_permalink = ig.permalink;
    }
    if (platforms.includes("fb") && cfg.meta_page_id) {
      out.fb_post_id = await publishFb(cfg.meta_page_id, token, post.image_url, post.caption);
    }
    await patchPost(post.id, {
      status: "published",
      qc: verdict,
      ig_media_id: out.ig_media_id ?? null,
      ig_permalink: out.ig_permalink ?? null,
      fb_post_id: out.fb_post_id ?? null,
      published_at: new Date().toISOString(),
    });
    return NextResponse.json({ ok: true, published: out, qc: verdict });
  } catch (e) {
    const msg = e instanceof Error ? e.message : "unknown";
    await patchPost(post.id, { status: "failed", error: msg });
    return NextResponse.json({ ok: false, failed: post.id, error: msg }, { status: 500 });
  }
}
