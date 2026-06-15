// Supabase server client (Next 15, app router).
//
// Uses @supabase/ssr with async cookies() so the Hifz area can read the
// signed-in user on the server (RSC + route handlers + server actions).
// Auth keys are the public anon pair — RLS does the gating.

import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";

const URL = process.env.NEXT_PUBLIC_SUPABASE_URL?.replace(/\s/g, "");
const ANON = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY?.replace(/\s/g, "");

export async function createClient() {
  const cookieStore = await cookies();

  return createServerClient(URL!, ANON!, {
    cookies: {
      getAll() {
        return cookieStore.getAll();
      },
      setAll(cookiesToSet) {
        // In a Server Component the cookie store is read-only; the auth
        // callback route + middleware refresh handle writes, so we swallow
        // the error here rather than crash the render.
        try {
          cookiesToSet.forEach(({ name, value, options }) =>
            cookieStore.set(name, value, options)
          );
        } catch {
          /* called from a Server Component — safe to ignore */
        }
      },
    },
  });
}
