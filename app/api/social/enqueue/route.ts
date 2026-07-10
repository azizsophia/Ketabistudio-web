import { NextRequest, NextResponse } from "next/server";

// Lets the content pipeline add already-reviewed posts to social_queue without
// hand-writing SQL. Secured with CRON_SECRET (same shared secret the poster
// uses) or the admin key. Posts land as qc_reviewed=true because they are only
// enqueued after review; the poster still runs the automated QC gate at
// publish time as a second line of defence.

const SB = process.env.SUPABASE_URL?.replace(/\s/g, "").replace(/\/$/, "");
const KEY = process.env.SUPABASE_SERVICE_KEY?.replace(/\s/g, "");
const CRON_SECRET = process.env.CRON_SECRET?.trim();
const ADMIN = process.env.ADMIN_KEY;

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type IncomingPost = {
  image_url?: string;
  caption?: string;
  platforms?: string;
  scheduled_for?: string; // ISO timestamp
};

function authorized(req: NextRequest): boolean {
  const auth = (req.headers.get("authorization") || "").trim();
  if (CRON_SECRET && auth === `Bearer ${CRON_SECRET}`) return true;
  const k = req.headers.get("x-admin-key");
  if (ADMIN && k && k === ADMIN) return true;
  return false;
}

export async function POST(req: NextRequest) {
  if (!authorized(req)) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }
  if (!SB || !KEY) {
    return NextResponse.json({ error: "not configured" }, { status: 500 });
  }

  let body: {
    posts?: IncomingPost[];
    replace?: boolean;
    clear?: boolean;
    promote?: { image_url: string; scheduled_for?: string };
  };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "invalid json" }, { status: 400 });
  }

  // {promote:{image_url, scheduled_for?}}: reschedule a still-queued post so it
  // fires now (or at a given time). Matches the exact media URL — reel URLs
  // carry a unique id, so this targets one post without a schema change. Used
  // when the owner wants to publish something ahead of its slot.
  if (body.promote?.image_url) {
    const when = body.promote.scheduled_for || new Date(Date.now() - 60_000).toISOString();
    const q = `${SB}/rest/v1/social_queue?status=eq.queued&image_url=eq.${encodeURIComponent(body.promote.image_url)}`;
    const r = await fetch(q, {
      method: "PATCH",
      headers: {
        Authorization: `Bearer ${KEY}`,
        apikey: KEY!,
        "Content-Type": "application/json",
        Prefer: "return=representation",
      },
      body: JSON.stringify({ scheduled_for: when }),
    });
    const rows = await r.json().catch(() => []);
    return NextResponse.json({ ok: true, promoted: Array.isArray(rows) ? rows.length : 0, scheduled_for: when });
  }

  // {clear:true}: cancel the entire not-yet-published queue (published rows
  // stay as history). Used when the owner retires a content strategy.
  if (body.clear) {
    const r = await fetch(`${SB}/rest/v1/social_queue?status=eq.queued`, {
      method: "DELETE",
      headers: { Authorization: `Bearer ${KEY}`, apikey: KEY!, Prefer: "return=representation" },
    });
    const rows = await r.json().catch(() => []);
    return NextResponse.json({ ok: true, cleared: Array.isArray(rows) ? rows.length : 0 });
  }

  const posts = Array.isArray(body.posts) ? body.posts : [];
  if (posts.length === 0) {
    return NextResponse.json({ error: "no posts" }, { status: 400 });
  }

  // replace mode: clear the not-yet-published queue before inserting the new
  // batch (published rows are kept as history).
  if (body.replace) {
    await fetch(`${SB}/rest/v1/social_queue?status=eq.queued`, {
      method: "DELETE",
      headers: { Authorization: `Bearer ${KEY}`, apikey: KEY, Prefer: "return=minimal" },
    });
  }

  // A post needs a caption plus EITHER an image, or a Threads-only target (text
  // post). Text-only posts are Threads-native and store an empty image_url.
  const isThreadsOnly = (p: IncomingPost) =>
    (p.platforms || "").split(",").map((s) => s.trim()).filter(Boolean).join(",") === "th";
  const rows = posts
    .filter((p) => p.caption && (p.image_url || isThreadsOnly(p)))
    .map((p) => ({
      image_url: p.image_url || "",
      caption: p.caption,
      platforms: p.platforms || "ig,fb",
      scheduled_for: p.scheduled_for || new Date().toISOString(),
      status: "queued",
      qc_reviewed: true,
    }));
  if (rows.length === 0) {
    return NextResponse.json({ error: "each post needs a caption plus an image (or platforms=th for text)" }, { status: 400 });
  }

  const r = await fetch(`${SB}/rest/v1/social_queue`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${KEY}`,
      apikey: KEY,
      "Content-Type": "application/json",
      Prefer: "return=representation",
    },
    body: JSON.stringify(rows),
  });
  if (!r.ok) {
    const err = await r.text().catch(() => "");
    return NextResponse.json({ error: "insert failed", detail: err.slice(0, 300) }, { status: 500 });
  }
  const inserted = (await r.json()) as { id: string }[];
  return NextResponse.json({ ok: true, inserted: inserted.length, ids: inserted.map((x) => x.id) });
}
