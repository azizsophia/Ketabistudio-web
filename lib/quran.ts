// Quran Foundation Content API (v4) client.
//
// Powers the Hifz app's Quran text, translations, and recitation audio.
// Credentials are read from environment variables ONLY — never hardcoded:
//   QURAN_CLIENT_ID, QURAN_CLIENT_SECRET, QURAN_ENV ("prelive" | "production")
//
// Auth is OAuth2 client-credentials: we exchange the id/secret for a short-lived
// access token (cached in memory), then call the content API with the
// x-auth-token + x-client-id headers. Docs: https://api-docs.quran.foundation

const ENV = (process.env.QURAN_ENV || "prelive").trim();
const CLIENT_ID = process.env.QURAN_CLIENT_ID?.trim();
const CLIENT_SECRET = process.env.QURAN_CLIENT_SECRET?.trim();

const AUTH_BASE =
  ENV === "production"
    ? "https://oauth2.quran.foundation"
    : "https://prelive-oauth2.quran.foundation";

const API_BASE =
  ENV === "production"
    ? "https://apis.quran.foundation/content/api/v4"
    : "https://apis-prelive.quran.foundation/content/api/v4";

let cached: { token: string; exp: number } | null = null;

async function getToken(): Promise<string | null> {
  if (!CLIENT_ID || !CLIENT_SECRET) {
    console.error("[quran] missing QURAN_CLIENT_ID / QURAN_CLIENT_SECRET");
    return null;
  }
  // reuse the cached token until ~30s before it expires
  if (cached && cached.exp > Date.now() + 30_000) return cached.token;

  const basic = Buffer.from(`${CLIENT_ID}:${CLIENT_SECRET}`).toString("base64");
  const res = await fetch(`${AUTH_BASE}/oauth2/token`, {
    method: "POST",
    headers: {
      Authorization: `Basic ${basic}`,
      "Content-Type": "application/x-www-form-urlencoded",
    },
    body: "grant_type=client_credentials&scope=content",
    cache: "no-store",
  });
  if (!res.ok) {
    console.error("[quran] token error", res.status, await res.text().catch(() => ""));
    return null;
  }
  const j = (await res.json()) as { access_token: string; expires_in?: number };
  cached = { token: j.access_token, exp: Date.now() + (j.expires_in ?? 3600) * 1000 };
  return cached.token;
}

type Params = Record<string, string | number | boolean | undefined>;

async function qf<T>(path: string, params?: Params): Promise<T | null> {
  const token = await getToken();
  if (!token || !CLIENT_ID) return null;
  const url = new URL(`${API_BASE}${path}`);
  if (params) {
    for (const [k, v] of Object.entries(params)) {
      if (v !== undefined) url.searchParams.set(k, String(v));
    }
  }
  const res = await fetch(url, {
    headers: {
      "x-auth-token": token,
      "x-client-id": CLIENT_ID,
      Accept: "application/json",
    },
    // content is stable; let Next cache it briefly
    next: { revalidate: 3600 },
  });
  if (!res.ok) {
    console.error(`[quran] ${path} ->`, res.status, await res.text().catch(() => ""));
    return null;
  }
  return res.json() as Promise<T>;
}

/** Read-only Quran content helpers (chapters, verses, audio, resources). */
export const quran = {
  /** All 114 chapters (surahs) with names + metadata. */
  chapters: () => qf("/chapters", { language: "en" }),

  /** Verses of one chapter: Uthmani Arabic + optional translation + audio. */
  versesByChapter: (
    chapter: number,
    opts?: {
      translations?: string; // comma-separated translation resource id(s)
      audio?: number; // recitation resource id → includes per-ayah audio url
      fields?: string;
      perPage?: number;
      page?: number;
    }
  ) =>
    qf(`/verses/by_chapter/${chapter}`, {
      fields: opts?.fields ?? "text_uthmani",
      translations: opts?.translations,
      audio: opts?.audio,
      per_page: opts?.perPage ?? 50,
      page: opts?.page,
      language: "en",
    }),

  /** Ayah-by-ayah recitations (reciters) we can offer — pick premium ids. */
  recitations: () => qf("/resources/recitations", { language: "en" }),

  /** Available translations (each has its own QF-licensed resource id). */
  translations: () => qf("/resources/translations", { language: "en" }),
};

export const QURAN_ENV = ENV;
