// Hifz entitlement helpers (server only).
//
// getUser()   → the current Supabase auth user, or null.
// getAccess() → reads public.hifz_subscriptions and decides whether the user
//               is entitled to the full Quran (vs the free preview surahs).

import { createClient } from "@/lib/supabase/server";

export type HifzPlan = "monthly" | "annual" | "lifetime" | null;
export type HifzStatus =
  | "free"
  | "active"
  | "trialing"
  | "past_due"
  | "canceled"
  | null;

export type Access = {
  subscribed: boolean;
  plan: HifzPlan;
  status: HifzStatus;
};

/** Surahs anyone can open without a subscription. */
export const FREE_SURAHS = new Set<number>([1, 112, 113, 114]);

/** Current signed-in Supabase user, or null. */
export async function getUser() {
  try {
    const supabase = await createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();
    return user;
  } catch {
    return null;
  }
}

/**
 * Entitlement for a user. Reads the user's own hifz_subscriptions row via the
 * server client (RLS allows SELECT of own row).
 */
export async function getAccess(userId: string): Promise<Access> {
  try {
    const supabase = await createClient();
    const { data } = await supabase
      .from("hifz_subscriptions")
      .select("status, plan, current_period_end")
      .eq("user_id", userId)
      .maybeSingle();

    if (!data) return { subscribed: false, plan: null, status: "free" };

    const status = (data.status ?? null) as HifzStatus;
    const plan = (data.plan ?? null) as HifzPlan;
    const periodOk = data.current_period_end
      ? new Date(data.current_period_end).getTime() > Date.now()
      : false;

    const subscribed =
      plan === "lifetime" ||
      ((status === "active" || status === "trialing") && periodOk);

    return { subscribed, plan, status };
  } catch {
    return { subscribed: false, plan: null, status: "free" };
  }
}
