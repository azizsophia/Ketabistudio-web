"use server";

import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";

/** Sign the current user out and return to the Hifz login. */
export async function signOut() {
  const supabase = await createClient();
  await supabase.auth.signOut();
  redirect("/hifz/login");
}
