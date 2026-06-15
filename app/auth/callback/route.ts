// Magic-link callback: exchange the one-time code for a session cookie, then
// send the user on to ?next (defaults to /hifz).

import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  const { searchParams, origin } = req.nextUrl;
  const code = searchParams.get("code");
  const next = searchParams.get("next") || "/hifz";

  if (code) {
    const supabase = await createClient();
    const { error } = await supabase.auth.exchangeCodeForSession(code);
    if (!error) {
      return NextResponse.redirect(`${origin}${next}`);
    }
    console.error("[auth callback] exchange failed", error.message);
  }

  return NextResponse.redirect(`${origin}/hifz/login?error=auth`);
}
