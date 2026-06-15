// Service-role writes to public.hifz_subscriptions.
//
// RLS only allows users to SELECT their own row; all WRITES go through the
// service role (this module). Used by the subscription checkout (to attach a
// Stripe customer) and the Stripe webhook (to sync subscription state).

const SB = process.env.SUPABASE_URL?.replace(/\s/g, "").replace(/\/$/, "");
const KEY = process.env.SUPABASE_SERVICE_KEY?.replace(/\s/g, "");

export type HifzSubscriptionRow = {
  user_id: string;
  status?: string;
  plan?: string | null;
  stripe_customer_id?: string | null;
  stripe_subscription_id?: string | null;
  current_period_end?: string | null;
};

function headers() {
  return {
    Authorization: `Bearer ${KEY}`,
    apikey: KEY!,
    "Content-Type": "application/json",
  };
}

/** Insert-or-update a hifz_subscriptions row keyed on user_id (PK). */
export async function upsertHifzSubscription(
  fields: Record<string, unknown> & { user_id: string }
): Promise<boolean> {
  if (!SB || !KEY) {
    console.error("[hifz subs] missing SUPABASE_URL / SUPABASE_SERVICE_KEY");
    return false;
  }
  const res = await fetch(`${SB}/rest/v1/hifz_subscriptions?on_conflict=user_id`, {
    method: "POST",
    headers: {
      ...headers(),
      Prefer: "resolution=merge-duplicates,return=minimal",
    },
    body: JSON.stringify({ ...fields, updated_at: new Date().toISOString() }),
  });
  if (!res.ok) {
    console.error(
      "[hifz subs] upsert failed",
      res.status,
      await res.text().catch(() => "")
    );
    return false;
  }
  return true;
}

/** Read a single hifz_subscriptions row by user_id (service role). */
export async function getHifzSubscriptionByUser(userId: string) {
  if (!SB || !KEY) return null;
  const res = await fetch(
    `${SB}/rest/v1/hifz_subscriptions?user_id=eq.${userId}&select=*`,
    { headers: headers(), cache: "no-store" }
  );
  if (!res.ok) return null;
  const rows = await res.json();
  return Array.isArray(rows) ? rows[0] ?? null : null;
}

/** Look up a row by Stripe subscription id (webhook reconciliation). */
export async function getHifzSubscriptionByStripeId(stripeSubscriptionId: string) {
  if (!SB || !KEY) return null;
  const res = await fetch(
    `${SB}/rest/v1/hifz_subscriptions?stripe_subscription_id=eq.${stripeSubscriptionId}&select=*`,
    { headers: headers(), cache: "no-store" }
  );
  if (!res.ok) return null;
  const rows = await res.json();
  return Array.isArray(rows) ? rows[0] ?? null : null;
}
