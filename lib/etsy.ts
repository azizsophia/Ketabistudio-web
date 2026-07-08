// Etsy Open API v3 integration. Lets the server create and manage the shop's
// digital-download listings programmatically. Etsy uses OAuth2 + PKCE and short-
// lived (1h) access tokens with a 90-day refresh token, so we persist the whole
// credential set (keystring, shared secret, tokens, shop id) as a JSON object in
// the PRIVATE Supabase storage bucket `social-config/etsy.json` — same pattern as
// Threads: no schema change, no secret in git, writable with the service key the
// server already holds. getValidToken() transparently refreshes when expired.
//
// One-time setup (owner):
//   1. Register  https://www.ketabistudio.com/api/etsy/callback  as an app
//      callback URL in the Etsy app settings.
//   2. POST /api/etsy/config (Bearer CRON_SECRET) {keystring, shared_secret} once.
//   3. Visit /api/etsy/authorize?key=CRON_SECRET and approve. Done forever.

import crypto from "crypto";

const SB = process.env.SUPABASE_URL?.replace(/\s/g, "").replace(/\/$/, "");
const KEY = process.env.SUPABASE_SERVICE_KEY?.replace(/\s/g, "");
const BUCKET = "social-config";
const OBJECT = "etsy.json";

const OAUTH_TOKEN = "https://api.etsy.com/v3/public/oauth/token";
const API = "https://openapi.etsy.com/v3/application";
export const ETSY_REDIRECT = "https://www.ketabistudio.com/api/etsy/callback";
// Scopes: read/write listings (create, update, upload files+images, publish) and
// read shop (to resolve shop_id + user). transactions_r left out until needed.
// transactions_r lets us read paid orders + the buyer's personalization (the
// typed name) so personalized orders can be pulled programmatically.
export const ETSY_SCOPES = "listings_r listings_w shops_r transactions_r";

export type EtsyConfig = {
  keystring?: string;
  shared_secret?: string;
  access_token?: string;
  refresh_token?: string;
  expires_at?: string; // ISO; when the access_token dies
  shop_id?: number;
  user_id?: string;
  // transient PKCE state between /authorize and /callback:
  pending_verifier?: string;
  pending_state?: string;
  updated_at?: string;
};

function authHeaders() {
  return { Authorization: `Bearer ${KEY}`, apikey: KEY as string };
}

async function ensureBucket(): Promise<void> {
  await fetch(`${SB}/storage/v1/bucket`, {
    method: "POST",
    headers: { ...authHeaders(), "Content-Type": "application/json" },
    body: JSON.stringify({ id: BUCKET, name: BUCKET, public: false }),
  }).catch(() => undefined); // 409 already-exists is fine
}

export async function loadEtsyConfig(): Promise<EtsyConfig | null> {
  try {
    const r = await fetch(`${SB}/storage/v1/object/${BUCKET}/${OBJECT}`, {
      headers: authHeaders(),
      cache: "no-store",
    });
    if (!r.ok) return null;
    return (await r.json()) as EtsyConfig;
  } catch {
    return null;
  }
}

// Merge-and-save so partial updates (e.g. just tokens) never drop the keystring.
export async function saveEtsyConfig(patch: Partial<EtsyConfig>): Promise<EtsyConfig> {
  await ensureBucket();
  const cur = (await loadEtsyConfig()) || {};
  const next: EtsyConfig = { ...cur, ...patch, updated_at: new Date().toISOString() };
  await fetch(`${SB}/storage/v1/object/${BUCKET}/${OBJECT}`, {
    method: "POST",
    headers: { ...authHeaders(), "Content-Type": "application/json", "x-upsert": "true" },
    body: JSON.stringify(next),
  });
  return next;
}

// ---------------------------------------------------------------- PKCE helpers
export function makePkce() {
  const verifier = crypto.randomBytes(48).toString("base64url");
  const challenge = crypto.createHash("sha256").update(verifier).digest("base64url");
  const state = crypto.randomBytes(16).toString("base64url");
  return { verifier, challenge, state };
}

export function authorizeUrl(keystring: string, challenge: string, state: string) {
  const p = new URLSearchParams({
    response_type: "code",
    client_id: keystring,
    redirect_uri: ETSY_REDIRECT,
    scope: ETSY_SCOPES,
    state,
    code_challenge: challenge,
    code_challenge_method: "S256",
  });
  return `https://www.etsy.com/oauth/connect?${p.toString()}`;
}

// ---------------------------------------------------------------- token flow
type TokenResp = {
  access_token?: string;
  refresh_token?: string;
  expires_in?: number;
  error?: string;
  error_description?: string;
};

export async function exchangeCode(
  cfg: EtsyConfig,
  code: string
): Promise<{ ok: boolean; detail?: string }> {
  if (!cfg.keystring || !cfg.pending_verifier) return { ok: false, detail: "missing keystring/verifier" };
  const r = await fetch(OAUTH_TOKEN, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      grant_type: "authorization_code",
      client_id: cfg.keystring,
      redirect_uri: ETSY_REDIRECT,
      code,
      code_verifier: cfg.pending_verifier,
    }),
  });
  const d = (await r.json()) as TokenResp;
  if (!d.access_token || !d.refresh_token) {
    return { ok: false, detail: d.error_description || d.error || JSON.stringify(d).slice(0, 200) };
  }
  // Etsy user id is the prefix of the access token ("<userid>.xxxx").
  const uid = d.access_token.split(".")[0];
  await saveEtsyConfig({
    access_token: d.access_token,
    refresh_token: d.refresh_token,
    expires_at: new Date(Date.now() + (d.expires_in || 3600) * 1000 - 60_000).toISOString(),
    user_id: uid,
    pending_verifier: undefined,
    pending_state: undefined,
  });
  return { ok: true };
}

async function refresh(cfg: EtsyConfig): Promise<string | null> {
  if (!cfg.keystring || !cfg.refresh_token) return null;
  const r = await fetch(OAUTH_TOKEN, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      grant_type: "refresh_token",
      client_id: cfg.keystring,
      refresh_token: cfg.refresh_token,
    }),
  });
  const d = (await r.json()) as TokenResp;
  if (!d.access_token) return null;
  await saveEtsyConfig({
    access_token: d.access_token,
    refresh_token: d.refresh_token || cfg.refresh_token,
    expires_at: new Date(Date.now() + (d.expires_in || 3600) * 1000 - 60_000).toISOString(),
  });
  return d.access_token;
}

// Returns a live access token, refreshing if the stored one has expired.
export async function getValidToken(): Promise<{ token: string; cfg: EtsyConfig } | null> {
  const cfg = await loadEtsyConfig();
  if (!cfg?.access_token || !cfg.keystring) return null;
  const dead = !cfg.expires_at || new Date(cfg.expires_at).getTime() < Date.now();
  if (dead) {
    const t = await refresh(cfg);
    if (!t) return null;
    return { token: t, cfg: { ...cfg, access_token: t } };
  }
  return { token: cfg.access_token, cfg };
}

// Authenticated Etsy API fetch (adds x-api-key + Bearer). `path` starts with "/".
export async function etsyFetch(
  path: string,
  init: RequestInit = {}
): Promise<Response> {
  const auth = await getValidToken();
  if (!auth) throw new Error("etsy not connected");
  const headers = new Headers(init.headers);
  // Etsy requires the x-api-key header to be "keystring:shared_secret" (colon-
  // separated) — the keystring alone returns "Shared secret is required in
  // x-api-key header". The secret still never leaves the server.
  const apiKey = auth.cfg.shared_secret
    ? `${auth.cfg.keystring}:${auth.cfg.shared_secret}`
    : (auth.cfg.keystring as string);
  headers.set("x-api-key", apiKey);
  headers.set("Authorization", `Bearer ${auth.token}`);
  return fetch(`${API}${path}`, { ...init, headers });
}

// Read recent paid orders + the buyer's personalization (needs transactions_r).
// Returns a compact list: what to make, for whom, and the typed name.
export async function getShopOrders(limit = 25): Promise<{ ok: boolean; orders?: unknown[]; detail?: string }> {
  const shop = await getShopId();
  if (!shop) return { ok: false, detail: "no shop id" };
  const r = await etsyFetch(`/shops/${shop}/receipts?limit=${limit}&was_paid=true`);
  if (!r.ok) return { ok: false, detail: (await r.text()).slice(0, 200) };
  const d = (await r.json()) as {
    results?: {
      receipt_id: number; name?: string; buyer_email?: string; is_shipped?: boolean;
      status?: string; grandtotal?: { amount: number; divisor: number };
      created_timestamp?: number;
      transactions?: { title?: string; variations?: { formatted_name?: string; formatted_value?: string }[] }[];
    }[];
  };
  const orders = (d.results || []).map((rc) => ({
    receipt_id: rc.receipt_id,
    buyer: rc.name || null,
    email: rc.buyer_email || null,
    created: rc.created_timestamp || null,
    total: rc.grandtotal ? rc.grandtotal.amount / rc.grandtotal.divisor : null,
    items: (rc.transactions || []).map((t) => ({
      product: t.title || null,
      // personalization comes through as a transaction variation
      personalization: (t.variations || [])
        .map((v) => `${v.formatted_name || ""}: ${v.formatted_value || ""}`)
        .join(" | ") || null,
    })),
  }));
  return { ok: true, orders };
}

// Resolve + cache the shop id for the connected user.
export async function getShopId(): Promise<number | null> {
  const cfg = await loadEtsyConfig();
  if (cfg?.shop_id) return cfg.shop_id;
  const r = await etsyFetch(`/users/me`);
  if (!r.ok) return null;
  const me = (await r.json()) as { shop_id?: number; user_id?: number };
  if (me.shop_id) {
    await saveEtsyConfig({ shop_id: me.shop_id });
    return me.shop_id;
  }
  return null;
}

// ---------------------------------------------------------------- listing ops
// A draft digital listing. Prices are in the shop currency major units (USD).
export type DraftListing = {
  title: string;
  description: string;
  price: number;
  tags: string[];
  who_made?: "i_did" | "someone_else" | "collective";
  is_supply?: boolean;
  when_made?: string; // e.g. "made_to_order" | "2020_2025"
  taxonomy_id?: number; // 68887887 = Digital Prints (verify via getTaxonomy)
  is_personalizable?: boolean;
  personalization_is_required?: boolean;
  personalization_instructions?: string;
};

// Creates the listing in DRAFT state (Etsy's createDraftListing default) — it is
// never public until publishListing() is called. Honors the show-owner-first rule.
export async function createDraftListing(d: DraftListing): Promise<{ ok: boolean; listing_id?: number; detail?: string }> {
  const shop = await getShopId();
  if (!shop) return { ok: false, detail: "no shop id" };
  const body = new URLSearchParams({
    quantity: "999",
    title: d.title,
    description: d.description,
    price: d.price.toFixed(2),
    who_made: d.who_made || "i_did",
    when_made: d.when_made || "made_to_order",
    taxonomy_id: String(d.taxonomy_id || 68887887),
    is_supply: String(d.is_supply ?? false),
    type: "download", // digital listing
  });
  if (d.is_personalizable) {
    body.set("is_personalizable", "true");
    body.set("personalization_is_required", String(d.personalization_is_required ?? true));
    body.set("personalization_char_count_max", "256");
    if (d.personalization_instructions)
      body.set("personalization_instructions", d.personalization_instructions);
  }
  for (const t of d.tags.slice(0, 13)) body.append("tags", t);
  const r = await etsyFetch(`/shops/${shop}/listings`, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body,
  });
  const j = (await r.json().catch(() => ({}))) as { listing_id?: number; error?: string };
  if (!r.ok || !j.listing_id) return { ok: false, detail: (j.error || JSON.stringify(j)).slice(0, 300) };
  return { ok: true, listing_id: j.listing_id };
}

// Multipart upload of a listing image (from a Buffer). rank = display order.
export async function uploadListingImage(
  listingId: number,
  file: Blob,
  rank = 1
): Promise<{ ok: boolean; detail?: string }> {
  const shop = await getShopId();
  if (!shop) return { ok: false, detail: "no shop id" };
  const fd = new FormData();
  fd.append("image", file, `image-${rank}.jpg`);
  fd.append("rank", String(rank));
  const r = await etsyFetch(`/shops/${shop}/listings/${listingId}/images`, { method: "POST", body: fd });
  if (!r.ok) return { ok: false, detail: (await r.text()).slice(0, 200) };
  return { ok: true };
}

// Multipart upload of the actual digital file buyers download.
export async function uploadListingFile(
  listingId: number,
  file: Blob,
  name: string,
  rank = 1
): Promise<{ ok: boolean; detail?: string }> {
  const shop = await getShopId();
  if (!shop) return { ok: false, detail: "no shop id" };
  const fd = new FormData();
  fd.append("file", file, name);
  fd.append("name", name);
  fd.append("rank", String(rank));
  const r = await etsyFetch(`/shops/${shop}/listings/${listingId}/files`, { method: "POST", body: fd });
  if (!r.ok) return { ok: false, detail: (await r.text()).slice(0, 200) };
  return { ok: true };
}

// Patch fields on an existing listing (price, personalization flags, tags, etc.).
export async function updateListing(
  listingId: number,
  fields: Record<string, string>
): Promise<{ ok: boolean; detail?: string }> {
  const shop = await getShopId();
  if (!shop) return { ok: false, detail: "no shop id" };
  const body = new URLSearchParams(fields);
  const r = await etsyFetch(`/shops/${shop}/listings/${listingId}`, {
    method: "PATCH",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body,
  });
  if (!r.ok) return { ok: false, detail: (await r.text()).slice(0, 300) };
  return { ok: true };
}

// Set a listing's price. Etsy stores price in the listing INVENTORY, not on the
// listing itself, so updateListing() silently ignores a "price" field. We read
// the current inventory, change only the offering price (preserving quantity,
// enabled state, and any variations), and PUT it back. The PUT is all-or-nothing:
// a malformed body 400s and leaves the listing untouched, so this is safe.
type EtsyOffering = { price: number | { amount: number; divisor: number }; quantity: number; is_enabled: boolean };
type EtsyPropValue = { property_id: number; value_ids?: number[]; values?: string[]; scale_id?: number | null };
type EtsyProduct = { sku?: string; property_values?: EtsyPropValue[]; offerings?: EtsyOffering[] };
type EtsyInventory = {
  products?: EtsyProduct[];
  price_on_property?: number[];
  quantity_on_property?: number[];
  sku_on_property?: number[];
};

export async function setListingPrice(
  listingId: number,
  price: number
): Promise<{ ok: boolean; detail?: string }> {
  const gr = await etsyFetch(`/listings/${listingId}/inventory`);
  if (!gr.ok) return { ok: false, detail: "get inventory: " + (await gr.text()).slice(0, 200) };
  const inv = (await gr.json()) as EtsyInventory;
  const products = (inv.products || []).map((p) => ({
    sku: p.sku || "",
    property_values: (p.property_values || []).map((pv) => ({
      property_id: pv.property_id,
      value_ids: pv.value_ids || [],
      values: pv.values || [],
      ...(pv.scale_id != null ? { scale_id: pv.scale_id } : {}),
    })),
    offerings: (p.offerings || []).map((o) => ({
      price, // Etsy accepts a plain float here on PUT
      quantity: o.quantity,
      is_enabled: o.is_enabled,
    })),
  }));
  const body = {
    products,
    price_on_property: inv.price_on_property || [],
    quantity_on_property: inv.quantity_on_property || [],
    sku_on_property: inv.sku_on_property || [],
  };
  const pr = await etsyFetch(`/listings/${listingId}/inventory`, {
    method: "PUT",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  if (!pr.ok) return { ok: false, detail: "put inventory: " + (await pr.text()).slice(0, 300) };
  return { ok: true };
}

// List the image ids currently on a listing.
export async function listListingImages(listingId: number): Promise<number[]> {
  // NOTE: get-images is NOT shop-scoped in Etsy v3 (delete IS). Wrong path 404s.
  const r = await etsyFetch(`/listings/${listingId}/images`);
  if (!r.ok) return [];
  const d = (await r.json()) as { results?: { listing_image_id: number }[] };
  return (d.results || []).map((x) => x.listing_image_id);
}

export async function deleteListingImage(listingId: number, imageId: number): Promise<boolean> {
  const shop = await getShopId();
  if (!shop) return false;
  const r = await etsyFetch(`/shops/${shop}/listings/${listingId}/images/${imageId}`, { method: "DELETE" });
  return r.ok;
}

export async function publishListing(listingId: number): Promise<{ ok: boolean; detail?: string }> {
  const shop = await getShopId();
  if (!shop) return { ok: false, detail: "no shop id" };
  const r = await etsyFetch(`/shops/${shop}/listings/${listingId}`, {
    method: "PATCH",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({ state: "active" }),
  });
  if (!r.ok) return { ok: false, detail: (await r.text()).slice(0, 200) };
  return { ok: true };
}
