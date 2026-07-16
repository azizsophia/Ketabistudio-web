/* ── Pinterest auto-poster (API v5) ─────────────────────────────────
   Same shape as lib/threads.ts: owner connects once via OAuth, the token
   lives as JSON in the private social-config bucket, the daily cron
   refreshes it, and the poster writes image pins.

   ACCESS TIERS: on a TRIAL-tier Pinterest app, created pins are visible
   ONLY to the connected account — perfect for end-to-end testing, zero
   public reach. Once the app is granted STANDARD access the same pipeline
   posts public pins. Env: PINTEREST_APP_ID, PINTEREST_APP_SECRET. */

const SB = process.env.SUPABASE_URL?.replace(/\s/g, "").replace(/\/$/, "");
const KEY = process.env.SUPABASE_SERVICE_KEY?.replace(/\s/g, "");
const PIN_API = "https://api.pinterest.com/v5";
const BUCKET = "social-config";
const OBJECT = "pinterest.json";

const APP_ID = process.env.PINTEREST_APP_ID?.trim();
const APP_SECRET = process.env.PINTEREST_APP_SECRET?.trim();

export const PINTEREST_REDIRECT = "https://www.ketabistudio.com/pinterest/callback";
export const PINTEREST_SCOPES = "boards:read,boards:write,pins:read,pins:write,user_accounts:read";

export type PinterestCreds = {
  access_token: string;
  refresh_token: string;
  /** epoch ms when access_token expires */
  expires_at: number;
  /** the board the cron posts to */
  board_id?: string;
  updated_at: string;
};

function authHeaders() {
  return { Authorization: `Bearer ${KEY}`, apikey: KEY as string };
}

function basicAuth(): string {
  return "Basic " + Buffer.from(`${APP_ID}:${APP_SECRET}`).toString("base64");
}

export function pinterestConfigured(): boolean {
  return Boolean(APP_ID && APP_SECRET);
}

export function authorizeUrl(): string {
  const q = new URLSearchParams({
    client_id: APP_ID || "",
    redirect_uri: PINTEREST_REDIRECT,
    response_type: "code",
    scope: PINTEREST_SCOPES,
    state: "ketabi",
  });
  return `https://www.pinterest.com/oauth/?${q}`;
}

export async function loadPinterestCreds(): Promise<PinterestCreds | null> {
  try {
    const r = await fetch(`${SB}/storage/v1/object/${BUCKET}/${OBJECT}`, {
      headers: authHeaders(),
      cache: "no-store",
    });
    if (!r.ok) return null;
    const d = (await r.json()) as PinterestCreds;
    return d?.access_token && d?.refresh_token ? d : null;
  } catch {
    return null;
  }
}

export async function savePinterestCreds(c: PinterestCreds): Promise<void> {
  await fetch(`${SB}/storage/v1/bucket`, {
    method: "POST",
    headers: { ...authHeaders(), "Content-Type": "application/json" },
    body: JSON.stringify({ id: BUCKET, name: BUCKET, public: false }),
  }).catch(() => undefined); // 409 already-exists is fine
  await fetch(`${SB}/storage/v1/object/${BUCKET}/${OBJECT}`, {
    method: "POST",
    headers: { ...authHeaders(), "Content-Type": "application/json", "x-upsert": "true" },
    body: JSON.stringify(c),
  });
}

type TokenResponse = {
  access_token?: string;
  refresh_token?: string;
  expires_in?: number;
  error?: string;
  error_description?: string;
  message?: string;
};

export async function exchangeCode(code: string): Promise<PinterestCreds> {
  const r = await fetch(`${PIN_API}/oauth/token`, {
    method: "POST",
    headers: {
      Authorization: basicAuth(),
      "Content-Type": "application/x-www-form-urlencoded",
    },
    body: new URLSearchParams({
      grant_type: "authorization_code",
      code,
      redirect_uri: PINTEREST_REDIRECT,
    }),
  });
  const d = (await r.json()) as TokenResponse;
  if (!r.ok || !d.access_token || !d.refresh_token) {
    throw new Error(`pinterest token exchange failed: ${JSON.stringify(d).slice(0, 300)}`);
  }
  const creds: PinterestCreds = {
    access_token: d.access_token,
    refresh_token: d.refresh_token,
    expires_at: Date.now() + (d.expires_in || 30 * 24 * 3600) * 1000,
    updated_at: new Date().toISOString(),
  };
  await savePinterestCreds(creds);
  return creds;
}

/** Refresh when the access token is within 3 days of expiry. Best-effort:
 *  a refresh hiccup returns the current creds so posting can still try. */
export async function refreshedPinterestCreds(c: PinterestCreds): Promise<PinterestCreds> {
  if (c.expires_at - Date.now() > 3 * 24 * 3600 * 1000) return c;
  try {
    const r = await fetch(`${PIN_API}/oauth/token`, {
      method: "POST",
      headers: {
        Authorization: basicAuth(),
        "Content-Type": "application/x-www-form-urlencoded",
      },
      body: new URLSearchParams({
        grant_type: "refresh_token",
        refresh_token: c.refresh_token,
      }),
    });
    const d = (await r.json()) as TokenResponse;
    if (!r.ok || !d.access_token) return c;
    const next: PinterestCreds = {
      ...c,
      access_token: d.access_token,
      refresh_token: d.refresh_token || c.refresh_token,
      expires_at: Date.now() + (d.expires_in || 30 * 24 * 3600) * 1000,
      updated_at: new Date().toISOString(),
    };
    await savePinterestCreds(next);
    return next;
  } catch {
    return c;
  }
}

export async function listBoards(c: PinterestCreds): Promise<{ id: string; name: string }[]> {
  const r = await fetch(`${PIN_API}/boards?page_size=25`, {
    headers: { Authorization: `Bearer ${c.access_token}` },
  });
  const d = (await r.json().catch(() => ({}))) as {
    items?: { id: string; name: string }[];
  };
  return d.items || [];
}

export async function createBoard(c: PinterestCreds, name: string, description?: string) {
  const r = await fetch(`${PIN_API}/boards`, {
    method: "POST",
    headers: { Authorization: `Bearer ${c.access_token}`, "Content-Type": "application/json" },
    body: JSON.stringify({ name, description: description || "", privacy: "PUBLIC" }),
  });
  const d = (await r.json()) as { id?: string; name?: string; message?: string };
  if (!r.ok || !d.id) throw new Error(`create board failed: ${JSON.stringify(d).slice(0, 200)}`);
  return { id: d.id, name: d.name || name };
}

/** Create an image pin. Pinterest fetches the image from a public URL.
 *  title ≤100 chars, description ≤800; link is where a click lands. */
export async function createPin(
  c: PinterestCreds,
  board_id: string,
  imageUrl: string,
  title: string,
  description: string,
  link: string
): Promise<string> {
  const r = await fetch(`${PIN_API}/pins`, {
    method: "POST",
    headers: { Authorization: `Bearer ${c.access_token}`, "Content-Type": "application/json" },
    body: JSON.stringify({
      board_id,
      title: title.slice(0, 100),
      description: description.slice(0, 800),
      link,
      media_source: { source_type: "image_url", url: imageUrl },
    }),
  });
  const d = (await r.json()) as { id?: string; message?: string; code?: number };
  if (!r.ok || !d.id) {
    throw new Error(`create pin failed: ${JSON.stringify(d).slice(0, 300)}`);
  }
  return d.id;
}

/** Caption → pin title/description. Title = first sentence-ish line; the
 *  description keeps the caption minus our platform footers. */
export function pinTextFromCaption(caption: string): { title: string; description: string } {
  const clean = caption.replace(/\s+/g, " ").trim();
  const firstStop = clean.search(/[.!?،]/);
  const title = (firstStop > 8 ? clean.slice(0, firstStop + 1) : clean).slice(0, 95);
  return { title, description: clean.slice(0, 780) };
}
