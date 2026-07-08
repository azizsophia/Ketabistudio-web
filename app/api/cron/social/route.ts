import { NextRequest, NextResponse } from "next/server";
import { runSocialQc } from "@/lib/socialQc";
import {
  loadThreadsCreds,
  refreshedThreadsCreds,
  publishThreads,
  type ThreadsCreds,
} from "@/lib/threads";

// Auto-poster. A daily Vercel cron hits this. It pulls EVERY already-reviewed
// post that is due today from social_queue, runs the QC gate once more, then
// publishes each to Instagram + Facebook and refreshes its own Meta token.
// Cadence is controlled purely by scheduled_for: enqueue 1 reel + 1 static for
// the same day and the single daily run ships both.
//
// Post type is inferred from the media URL, so no schema columns are needed:
//   image_url ends in .mp4                  -> Reel  (IG Reels + FB video)
//   image_url has multiple whitespace URLs  -> Carousel (IG carousel; FB 1st)
//   otherwise                               -> single image

const SB = process.env.SUPABASE_URL?.replace(/\s/g, "").replace(/\/$/, "");
const KEY = process.env.SUPABASE_SERVICE_KEY?.replace(/\s/g, "");
const CRON_SECRET = process.env.CRON_SECRET?.trim();
const ADMIN = process.env.ADMIN_KEY;
const GRAPH = "https://graph.facebook.com/v21.0";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 300;

// Safety cap: never fire more than this many posts in one run, even if more are
// somehow due (guards against a bad enqueue flooding the feed).
const MAX_PER_RUN = 4;

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
  const auth = (req.headers.get("authorization") || "").trim();
  if (CRON_SECRET && auth === `Bearer ${CRON_SECRET}`) return true;
  // Also accept ?key=CRON_SECRET so a plain URL works in an external cron
  // service (no custom header needed), e.g. cron-job.org from a phone.
  const k = req.nextUrl.searchParams.get("key");
  if (CRON_SECRET && k === CRON_SECRET) return true;
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
  await sb(`social_queue?id=eq.${id}`, { method: "PATCH", body: JSON.stringify(patch) });
}

// Atomically claim a queued post: flip status queued -> publishing only if it is
// still queued. If another concurrent run already claimed it, the conditional
// filter matches nothing and we get an empty array back, so we skip it. This is
// what makes it safe to poll from several triggers every couple of minutes
// without ever posting the same item twice.
async function claimPost(id: string): Promise<boolean> {
  const r = await sb(`social_queue?id=eq.${id}&status=eq.queued`, {
    method: "PATCH",
    headers: { Prefer: "return=representation" },
    body: JSON.stringify({ status: "publishing", claimed_at: new Date().toISOString() }),
  });
  const rows = (await r.json().catch(() => [])) as unknown[];
  return Array.isArray(rows) && rows.length > 0;
}

// Reclaim posts that were claimed but never finished (a run that timed out mid
// publish), so they are not stuck in "publishing" forever.
async function resetStaleClaims() {
  const cutoff = new Date(Date.now() - 10 * 60 * 1000).toISOString();
  await sb(`social_queue?status=eq.publishing&claimed_at=lt.${cutoff}`, {
    method: "PATCH",
    body: JSON.stringify({ status: "queued" }),
  });
}

// media-type helpers ────────────────────────────────────────────────
function mediaUrls(imageUrl: string): string[] {
  return imageUrl.trim().split(/\s+/).filter(Boolean);
}
function isReel(imageUrl: string): boolean {
  // A reel may carry a cover image as a second, space-separated URL
  // ("video.mp4 cover.jpg"), so test the FIRST media URL, not the whole string
  // (otherwise the trailing cover hides the .mp4 and the reel posts as a photo).
  const first = mediaUrls(imageUrl)[0] || "";
  return /\.mp4(\?|$)/i.test(first);
}
function isCarousel(imageUrl: string): boolean {
  return !isReel(imageUrl) && mediaUrls(imageUrl).length > 1;
}

// Extend the long-lived user token, derive a fresh page token, persist both.
// Falls back to the stored page token on any hiccup.
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

async function igPermalink(id: string, token: string): Promise<string> {
  try {
    const pl = await fetch(`${GRAPH}/${id}?fields=permalink&access_token=${token}`);
    return ((await pl.json()) as { permalink?: string }).permalink || "";
  } catch {
    return "";
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
  return { mediaId: pd.id, permalink: await igPermalink(pd.id, token) };
}

// Wait for an IG container to finish server-side processing (reels/video).
async function waitForContainer(containerId: string, token: string, budgetMs: number) {
  const started = Date.now();
  while (Date.now() - started < budgetMs) {
    await new Promise((r) => setTimeout(r, 6000));
    const s = await fetch(
      `${GRAPH}/${containerId}?fields=status_code&access_token=${token}`
    );
    const sd = (await s.json()) as { status_code?: string };
    if (sd.status_code === "FINISHED") return;
    if (sd.status_code === "ERROR" || sd.status_code === "EXPIRED") {
      throw new Error("ig container status: " + sd.status_code);
    }
  }
  throw new Error("ig container not ready in time");
}

async function publishReelIg(
  ig: string,
  token: string,
  videoUrl: string,
  caption: string,
  coverUrl?: string
): Promise<{ mediaId: string; permalink: string }> {
  const params: Record<string, string> = {
    media_type: "REELS",
    video_url: videoUrl,
    caption,
    share_to_feed: "true",
    access_token: token,
  };
  // A second URL on the post (space-separated in image_url) is the reel's cover
  // image — set it so the thumbnail is our gold-letter cover, not a random frame.
  if (coverUrl && /\.(jpe?g|png)(\?|$)/i.test(coverUrl)) params.cover_url = coverUrl;
  const c = await fetch(`${GRAPH}/${ig}/media`, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams(params),
  });
  const cd = (await c.json()) as { id?: string; error?: unknown };
  if (!cd.id) throw new Error("ig reel container: " + JSON.stringify(cd.error || cd));
  await waitForContainer(cd.id, token, 210000);
  const p = await fetch(`${GRAPH}/${ig}/media_publish`, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({ creation_id: cd.id, access_token: token }),
  });
  const pd = (await p.json()) as { id?: string; error?: unknown };
  if (!pd.id) throw new Error("ig reel publish: " + JSON.stringify(pd.error || pd));
  return { mediaId: pd.id, permalink: await igPermalink(pd.id, token) };
}

async function publishCarouselIg(
  ig: string,
  token: string,
  urls: string[],
  caption: string
): Promise<{ mediaId: string; permalink: string }> {
  const children: string[] = [];
  for (const u of urls.slice(0, 10)) {
    const c = await fetch(`${GRAPH}/${ig}/media`, {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({ image_url: u, is_carousel_item: "true", access_token: token }),
    });
    const cd = (await c.json()) as { id?: string; error?: unknown };
    if (!cd.id) throw new Error("ig carousel child: " + JSON.stringify(cd.error || cd));
    children.push(cd.id);
  }
  const parent = await fetch(`${GRAPH}/${ig}/media`, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      media_type: "CAROUSEL",
      children: children.join(","),
      caption,
      access_token: token,
    }),
  });
  const pd = (await parent.json()) as { id?: string; error?: unknown };
  if (!pd.id) throw new Error("ig carousel parent: " + JSON.stringify(pd.error || pd));
  await new Promise((r) => setTimeout(r, 5000));
  const pub = await fetch(`${GRAPH}/${ig}/media_publish`, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({ creation_id: pd.id, access_token: token }),
  });
  const pubd = (await pub.json()) as { id?: string; error?: unknown };
  if (!pubd.id) throw new Error("ig carousel publish: " + JSON.stringify(pubd.error || pubd));
  return { mediaId: pubd.id, permalink: await igPermalink(pubd.id, token) };
}

async function publishFbPhoto(
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
  if (!d.id && !d.post_id) throw new Error("fb photo: " + JSON.stringify(d.error || d));
  return d.post_id || (d.id as string);
}

async function publishFbVideo(
  page: string,
  token: string,
  videoUrl: string,
  caption: string
): Promise<string> {
  const r = await fetch(`${GRAPH}/${page}/videos`, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({ file_url: videoUrl, description: caption, access_token: token }),
  });
  const d = (await r.json()) as { id?: string; error?: unknown };
  if (!d.id) throw new Error("fb video: " + JSON.stringify(d.error || d));
  return d.id;
}

// Publish one post to whichever platforms it targets. Throws on failure of a
// core platform (IG/FB); the Threads mirror is best-effort and never blocks.
async function publishOne(cfg: Config, token: string, post: Post, th: ThreadsCreds | null) {
  // Normalize aliases so "instagram"/"facebook" behave like "ig"/"fb" — the
  // long names used to silently match nothing and the post shipped to Threads only.
  const ALIAS: Record<string, string> = { instagram: "ig", facebook: "fb", threads: "th" };
  const platforms = String(post.platforms || "ig,fb")
    .split(",")
    .map((s) => s.trim().toLowerCase())
    .map((s) => ALIAS[s] || s);
  const out: {
    ig_media_id?: string;
    ig_permalink?: string;
    fb_post_id?: string;
    th_post_id?: string;
    th_error?: string;
  } = {};
  const urls = mediaUrls(post.image_url);

  if (platforms.includes("ig")) {
    let ig: { mediaId: string; permalink: string };
    if (isReel(post.image_url)) {
      // urls[0] = video, optional urls[1] = cover image
      ig = await publishReelIg(cfg.meta_ig_id, token, urls[0], post.caption, urls[1]);
    } else if (isCarousel(post.image_url)) {
      ig = await publishCarouselIg(cfg.meta_ig_id, token, urls, post.caption);
    } else {
      ig = await publishIg(cfg.meta_ig_id, token, urls[0], post.caption);
    }
    out.ig_media_id = ig.mediaId;
    out.ig_permalink = ig.permalink;
  }
  if (platforms.includes("fb") && cfg.meta_page_id) {
    if (isReel(post.image_url)) {
      out.fb_post_id = await publishFbVideo(cfg.meta_page_id, token, urls[0], post.caption);
    } else {
      out.fb_post_id = await publishFbPhoto(cfg.meta_page_id, token, urls[0], post.caption);
    }
  }
  // Threads: only when the post explicitly targets "th". This keeps the
  // Threads schedule and the IG/FB schedule independent (an ig,fb post must
  // NOT also appear on Threads). Best-effort — a Threads hiccup must never
  // fail (and re-run) a post that already went out on IG/FB.
  if (th && platforms.includes("th")) {
    try {
      out.th_post_id = await publishThreads(
        th,
        isCarousel(post.image_url) ? urls : urls[0],
        post.caption,
        isReel(post.image_url)
      );
    } catch (e) {
      out.th_error = (e instanceof Error ? e.message : "unknown").slice(0, 200);
    }
  }
  return out;
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

  await resetStaleClaims();

  const nowIso = new Date().toISOString();
  const dueRows = (await (
    await sb(
      `social_queue?status=eq.queued&scheduled_for=lte.${nowIso}&order=scheduled_for.asc&limit=${MAX_PER_RUN}&select=*`
    )
  ).json()) as Post[];
  if (!Array.isArray(dueRows) || dueRows.length === 0) {
    return NextResponse.json({ ok: true, message: "nothing due" });
  }

  // Publish quick posts (images/carousels) first so they always land; reels go
  // last since their server-side processing eats the remaining time budget. If
  // the platform caps the function mid-reel, the reel stays queued and retries
  // on the next run — a safe, self-healing failure mode.
  dueRows.sort((a, b) => Number(isReel(a.image_url)) - Number(isReel(b.image_url)));

  const token = await currentPageToken(cfg);
  // Threads is optional: null until the owner completes the one-time connect
  // at /api/social/threads/connect, after which every post mirrors there.
  let th = await loadThreadsCreds();
  if (th) th = await refreshedThreadsCreds(th);
  const results: Array<Record<string, unknown>> = [];

  for (const post of dueRows) {
    // Gate 0: atomically claim it. If a concurrent run already grabbed it, skip
    // silently so it is never posted twice.
    if (!(await claimPost(post.id))) {
      results.push({ id: post.id, skipped: "claimed by another run" });
      continue;
    }
    // Gate 1: must have been reviewed when it was queued.
    if (!post.qc_reviewed) {
      await patchPost(post.id, { status: "blocked", error: "not qc_reviewed" });
      results.push({ id: post.id, blocked: "not reviewed" });
      continue;
    }
    // Gate 2: automated QC (deterministic + optional Claude proofread). The QC
    // media checks work for both images and reel videos, so pass the first
    // media URL as-is (a reel's .mp4 is https + reachable just like an image).
    const verdict = await runSocialQc(post.caption, mediaUrls(post.image_url)[0]);
    if (!verdict.pass) {
      await patchPost(post.id, { status: "blocked", qc: verdict, error: "qc failed" });
      results.push({ id: post.id, blocked: verdict });
      continue;
    }

    try {
      const out = await publishOne(cfg, token, post, th);
      await patchPost(post.id, {
        status: "published",
        qc: verdict,
        ig_media_id: out.ig_media_id ?? null,
        ig_permalink: out.ig_permalink ?? null,
        fb_post_id: out.fb_post_id ?? null,
        published_at: new Date().toISOString(),
      });
      results.push({ id: post.id, published: out });
    } catch (e) {
      const msg = e instanceof Error ? e.message : "unknown";
      await patchPost(post.id, { status: "failed", error: msg });
      results.push({ id: post.id, failed: msg });
    }
  }

  return NextResponse.json({ ok: true, count: results.length, results });
}
