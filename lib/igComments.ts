// Instagram comment read + reply. Uses the same Meta page/IG token the poster
// already refreshes (scope instagram_manage_comments, already granted). Human
// in the loop: Claude drafts, owner approves, this posts. Mirrors the Threads
// reply flow.

const GRAPH = "https://graph.facebook.com/v21.0";

export type IgComment = {
  media_id: string;
  media_caption: string;
  media_permalink: string;
  comment_id: string;
  username: string;
  text: string;
  timestamp: string;
  like_count: number;
  replied_by_us: boolean;
};

type Cfg = { meta_ig_id: string };

// Pull comments across our recent IG media. For each comment we also look at
// its replies to see if we've already answered (so the owner only sees the
// open ones). The IG username of the account is used to detect our own replies.
export async function recentIgComments(
  cfg: Cfg,
  token: string,
  limitMedia = 12
): Promise<IgComment[]> {
  // who are we (to detect our own replies)
  let meUser = "";
  try {
    const u = await fetch(`${GRAPH}/${cfg.meta_ig_id}?fields=username&access_token=${token}`);
    meUser = ((await u.json()) as { username?: string }).username || "";
  } catch {
    /* best effort */
  }

  const m = await fetch(
    `${GRAPH}/${cfg.meta_ig_id}/media?fields=id,caption,permalink&limit=${limitMedia}&access_token=${token}`
  );
  const md = (await m.json()) as {
    data?: { id: string; caption?: string; permalink?: string }[];
    error?: { message?: string };
  };
  if (!md.data) throw new Error("ig media list: " + JSON.stringify(md.error || md));

  const out: IgComment[] = [];
  for (const media of md.data) {
    const c = await fetch(
      `${GRAPH}/${media.id}/comments?fields=id,text,username,timestamp,like_count,replies{username}&limit=50&access_token=${token}`
    );
    const cd = (await c.json()) as {
      data?: {
        id: string;
        text?: string;
        username?: string;
        timestamp?: string;
        like_count?: number;
        replies?: { data?: { username?: string }[] };
      }[];
    };
    for (const cm of cd.data || []) {
      if ((cm.username || "") === meUser) continue; // our own top-level comment
      const repliedByUs = !!cm.replies?.data?.some((r) => (r.username || "") === meUser);
      out.push({
        media_id: media.id,
        media_caption: (media.caption || "").slice(0, 90),
        media_permalink: media.permalink || "",
        comment_id: cm.id,
        username: cm.username || "",
        text: cm.text || "",
        timestamp: cm.timestamp || "",
        like_count: cm.like_count || 0,
        replied_by_us: repliedByUs,
      });
    }
  }
  return out;
}

// Reply to a specific comment. IG replies are a direct POST (no container step,
// unlike Threads/feed publishing).
export async function replyToIgComment(
  commentId: string,
  token: string,
  message: string
): Promise<string> {
  const r = await fetch(`${GRAPH}/${commentId}/replies`, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({ message, access_token: token }),
  });
  const d = (await r.json()) as { id?: string; error?: { message?: string } };
  if (!d.id) throw new Error("ig reply: " + JSON.stringify(d.error || d));
  return d.id;
}
