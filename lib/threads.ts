// Threads (Meta) auto-posting support. Threads mirrors the Instagram queue so
// every published post also lands on the brand's Threads profile for free
// extra reach. Credentials are stored as a JSON object in a PRIVATE Supabase
// storage bucket (social-config/threads.json) rather than a table column —
// schema changes need the SQL editor, but storage is writable with the
// service key the server already holds, so the connect flow + token refresh
// can persist state without any owner-run SQL.

const SB = process.env.SUPABASE_URL?.replace(/\s/g, "").replace(/\/$/, "");
const KEY = process.env.SUPABASE_SERVICE_KEY?.replace(/\s/g, "");
const TH_GRAPH = "https://graph.threads.net/v1.0";

const BUCKET = "social-config";
const OBJECT = "threads.json";

export type ThreadsCreds = {
  user_id: string;
  token: string;
  updated_at: string; // last time the token was issued/refreshed
};

function authHeaders() {
  return { Authorization: `Bearer ${KEY}`, apikey: KEY as string };
}

// Bucket is created lazily on first save; private (public:false) so the token
// is never web-readable.
async function ensureBucket(): Promise<void> {
  await fetch(`${SB}/storage/v1/bucket`, {
    method: "POST",
    headers: { ...authHeaders(), "Content-Type": "application/json" },
    body: JSON.stringify({ id: BUCKET, name: BUCKET, public: false }),
  }).catch(() => undefined); // 409 already-exists is fine
}

export async function loadThreadsCreds(): Promise<ThreadsCreds | null> {
  try {
    const r = await fetch(`${SB}/storage/v1/object/${BUCKET}/${OBJECT}`, {
      headers: authHeaders(),
      cache: "no-store",
    });
    if (!r.ok) return null;
    const d = (await r.json()) as ThreadsCreds;
    return d?.user_id && d?.token ? d : null;
  } catch {
    return null;
  }
}

export async function saveThreadsCreds(c: ThreadsCreds): Promise<void> {
  await ensureBucket();
  await fetch(`${SB}/storage/v1/object/${BUCKET}/${OBJECT}`, {
    method: "POST",
    headers: {
      ...authHeaders(),
      "Content-Type": "application/json",
      "x-upsert": "true",
    },
    body: JSON.stringify(c),
  });
}

// Long-lived Threads tokens last 60 days and can be refreshed after 24h.
// Refresh once a week (on the daily cron) so it never expires.
export async function refreshedThreadsCreds(c: ThreadsCreds): Promise<ThreadsCreds> {
  const ageDays = (Date.now() - new Date(c.updated_at).getTime()) / 86400000;
  if (ageDays < 7) return c;
  try {
    const r = await fetch(
      `https://graph.threads.net/refresh_access_token?grant_type=th_refresh_token&access_token=${c.token}`
    );
    const d = (await r.json()) as { access_token?: string };
    if (!d.access_token) return c;
    const next = { ...c, token: d.access_token, updated_at: new Date().toISOString() };
    await saveThreadsCreds(next);
    return next;
  } catch {
    return c;
  }
}

// Threads caps posts at 500 chars and its culture is hashtag-light, so mirror
// the caption without the hashtag block and close with the plain domain.
export function threadsText(caption: string): string {
  const noTags = caption
    .split("\n")
    .filter((line) => !/^\s*(#[\p{L}\p{N}_]+\s*)+$/u.test(line))
    .join("\n")
    .trim();
  const footer = "\n\nketabistudio.com";
  const max = 500 - footer.length;
  const body = noTags.length <= max ? noTags : noTags.slice(0, max - 1).trimEnd() + "…";
  return body + footer;
}

async function waitForThreadsContainer(
  containerId: string,
  token: string,
  budgetMs: number
): Promise<void> {
  const started = Date.now();
  for (;;) {
    const r = await fetch(
      `${TH_GRAPH}/${containerId}?fields=status,error_message&access_token=${token}`
    );
    const d = (await r.json()) as { status?: string; error_message?: string };
    if (d.status === "FINISHED") return;
    if (d.status === "ERROR" || d.status === "EXPIRED") {
      throw new Error("threads container: " + (d.error_message || d.status));
    }
    if (Date.now() - started > budgetMs) throw new Error("threads container not ready in time");
    await new Promise((res) => setTimeout(res, 5000));
  }
}

// Publish one image or video post. Returns the published Threads media id.
export async function publishThreads(
  creds: ThreadsCreds,
  mediaUrl: string,
  caption: string,
  isVideo: boolean
): Promise<string> {
  const params = new URLSearchParams({
    media_type: isVideo ? "VIDEO" : "IMAGE",
    text: threadsText(caption),
    access_token: creds.token,
  });
  params.set(isVideo ? "video_url" : "image_url", mediaUrl);
  const c = await fetch(`${TH_GRAPH}/${creds.user_id}/threads`, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: params,
  });
  const cd = (await c.json()) as { id?: string; error?: { message?: string } };
  if (!cd.id) throw new Error("threads container: " + JSON.stringify(cd.error || cd));

  // Videos process server-side; images are usually instant but poll anyway.
  await waitForThreadsContainer(cd.id, creds.token, isVideo ? 90000 : 30000);

  const p = await fetch(`${TH_GRAPH}/${creds.user_id}/threads_publish`, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({ creation_id: cd.id, access_token: creds.token }),
  });
  const pd = (await p.json()) as { id?: string; error?: { message?: string } };
  if (!pd.id) throw new Error("threads publish: " + JSON.stringify(pd.error || pd));
  return pd.id;
}

// ── Replies (needs threads_manage_replies on the token) ──────────────
export type ThreadReply = {
  post_id: string;
  post_text: string;
  post_permalink: string;
  reply_id: string;
  username: string;
  text: string;
  timestamp: string;
  is_reply_to_us: boolean;
};

// Pull replies on our recent posts so we can read + answer them. Skips our own
// replies (username === our own) and anything we've already hidden.
export async function recentReplies(
  creds: ThreadsCreds,
  limitPosts = 10
): Promise<ThreadReply[]> {
  const t = await fetch(
    `${TH_GRAPH}/${creds.user_id}/threads?fields=id,text,permalink,timestamp,username&limit=${limitPosts}&access_token=${creds.token}`
  );
  const td = (await t.json()) as {
    data?: { id: string; text?: string; permalink?: string; username?: string }[];
    error?: { message?: string };
  };
  if (!td.data) throw new Error("threads list: " + JSON.stringify(td.error || td));
  const me = td.data[0]?.username || "";
  const out: ThreadReply[] = [];
  for (const p of td.data) {
    const r = await fetch(
      `${TH_GRAPH}/${p.id}/replies?fields=id,text,username,timestamp,hide_status&access_token=${creds.token}`
    );
    const rd = (await r.json()) as {
      data?: { id: string; text?: string; username?: string; timestamp?: string; hide_status?: string }[];
    };
    for (const rep of rd.data || []) {
      if (rep.hide_status === "HIDDEN") continue;
      out.push({
        post_id: p.id,
        post_text: (p.text || "").slice(0, 90),
        post_permalink: p.permalink || "",
        reply_id: rep.id,
        username: rep.username || "",
        text: rep.text || "",
        timestamp: rep.timestamp || "",
        is_reply_to_us: (rep.username || "") === me,
      });
    }
  }
  return out;
}

// Post a reply to a specific comment (reply_to_id). Text-only.
export async function postReply(
  creds: ThreadsCreds,
  replyToId: string,
  text: string
): Promise<string> {
  const c = await fetch(`${TH_GRAPH}/${creds.user_id}/threads`, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      media_type: "TEXT",
      text,
      reply_to_id: replyToId,
      access_token: creds.token,
    }),
  });
  const cd = (await c.json()) as { id?: string; error?: { message?: string } };
  if (!cd.id) throw new Error("threads reply container: " + JSON.stringify(cd.error || cd));
  const p = await fetch(`${TH_GRAPH}/${creds.user_id}/threads_publish`, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({ creation_id: cd.id, access_token: creds.token }),
  });
  const pd = (await p.json()) as { id?: string; error?: { message?: string } };
  if (!pd.id) throw new Error("threads reply publish: " + JSON.stringify(pd.error || pd));
  return pd.id;
}
