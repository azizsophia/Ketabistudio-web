/* ── Lulu Print API — real-time shipping quotes for checkout ──
   Reads LULU_CLIENT_KEY, LULU_CLIENT_SECRET, LULU_ENV ('sandbox'|'production').
   All amounts returned in USD cents. Returns null on any failure so the
   caller can fall back to flat shipping (checkout must never break). */

const ENV = (process.env.LULU_ENV || "sandbox").trim().toLowerCase();
const BASE = ENV === "production" ? "https://api.lulu.com" : "https://api.sandbox.lulu.com";
const KEY = process.env.LULU_CLIENT_KEY?.replace(/\s/g, "");
const SECRET = process.env.LULU_CLIENT_SECRET?.replace(/\s/g, "");

let cachedToken: { value: string; exp: number } | null = null;

async function getToken(): Promise<string | null> {
  if (!KEY || !SECRET) return null;
  if (cachedToken && Date.now() < cachedToken.exp - 60_000) return cachedToken.value;
  try {
    const basic = Buffer.from(`${KEY}:${SECRET}`).toString("base64");
    const r = await fetch(`${BASE}/auth/realms/glasstree/protocol/openid-connect/token`, {
      method: "POST",
      headers: {
        Authorization: `Basic ${basic}`,
        "Content-Type": "application/x-www-form-urlencoded",
      },
      body: "grant_type=client_credentials",
      cache: "no-store",
    });
    if (!r.ok) return null;
    const j = await r.json();
    cachedToken = { value: j.access_token, exp: Date.now() + (j.expires_in ?? 3600) * 1000 };
    return cachedToken.value;
  } catch {
    return null;
  }
}

export type LuluAddress = {
  name?: string;
  street1: string;
  street2?: string;
  city: string;
  state_code?: string;
  postcode: string;
  country_code: string;
  phone_number?: string;
};

/** Cheapest available Lulu shipping cost for the destination, in USD cents.
 *  Returns null if Lulu is unavailable / no option found. */
export async function luluShippingCents(
  addr: LuluAddress,
  opts: { pageCount: number; pod: string; quantity?: number }
): Promise<number | null> {
  const token = await getToken();
  if (!token) return null;
  try {
    const body = {
      currency: "USD",
      line_items: [
        { page_count: opts.pageCount, pod_package_id: opts.pod, quantity: opts.quantity ?? 1 },
      ],
      shipping_address: {
        name: addr.name || "Customer",
        street1: addr.street1,
        ...(addr.street2 ? { street2: addr.street2 } : {}),
        city: addr.city,
        ...(addr.state_code ? { state_code: addr.state_code } : {}),
        postcode: addr.postcode,
        country_code: addr.country_code,
        ...(addr.phone_number ? { phone_number: addr.phone_number } : {}),
      },
    };
    const r = await fetch(`${BASE}/shipping-options/`, {
      method: "POST",
      headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
      body: JSON.stringify(body),
      cache: "no-store",
    });
    if (!r.ok) return null;
    const data = await r.json();
    const list: Array<Record<string, unknown>> = Array.isArray(data)
      ? data
      : ((data.results as Array<Record<string, unknown>>) || []);
    const costs = list
      .map((o) => parseFloat(String(o.cost_excl_tax ?? o.total_cost_excl_tax ?? "")))
      .filter((n) => Number.isFinite(n) && n > 0);
    if (!costs.length) return null;
    return Math.round(Math.min(...costs) * 100);
  } catch {
    return null;
  }
}

/** Full print + shipping cost calculation for one book spec to one address at
 *  one shipping level (owner pricing tool). Returns Lulu's USD figures as
 *  strings, or null on failure. */
export async function luluCostCalc(
  addr: LuluAddress,
  opts: { pageCount: number; pod: string; quantity?: number; level: string }
): Promise<
  | { print: string; shipping: string; total: string }
  | { error: string }
  | null
> {
  const token = await getToken();
  if (!token) return { error: `no lulu token (env=${ENV}, key=${KEY ? "set" : "MISSING"})` };
  try {
    const r = await fetch(`${BASE}/print-job-cost-calculations/`, {
      method: "POST",
      headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        line_items: [
          {
            page_count: opts.pageCount,
            pod_package_id: opts.pod,
            quantity: opts.quantity ?? 1,
          },
        ],
        shipping_address: {
          name: addr.name || "Customer",
          street1: addr.street1,
          ...(addr.street2 ? { street2: addr.street2 } : {}),
          city: addr.city,
          ...(addr.state_code ? { state_code: addr.state_code } : {}),
          postcode: addr.postcode,
          country_code: addr.country_code,
          ...(addr.phone_number ? { phone_number: addr.phone_number } : {}),
        },
        shipping_option: opts.level,
      }),
      cache: "no-store",
    });
    if (!r.ok) {
      const text = await r.text().catch(() => "");
      return { error: `lulu ${r.status} (env=${ENV}): ${text.slice(0, 300)}` };
    }
    const j = await r.json();
    return {
      print: String(j?.line_item_costs?.[0]?.total_cost_incl_tax ?? ""),
      shipping: String(j?.shipping_cost?.total_cost_incl_tax ?? ""),
      total: String(j?.total_cost_incl_tax ?? ""),
    };
  } catch (e) {
    return { error: `exception: ${e instanceof Error ? e.message : "unknown"}` };
  }
}
