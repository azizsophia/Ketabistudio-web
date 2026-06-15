// Supabase browser client (used by the login form + progress toggles).
"use client";

import { createBrowserClient } from "@supabase/ssr";

const URL = process.env.NEXT_PUBLIC_SUPABASE_URL?.replace(/\s/g, "");
const ANON = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY?.replace(/\s/g, "");

export function createClient() {
  return createBrowserClient(URL!, ANON!);
}
