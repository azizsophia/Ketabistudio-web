// Hifz progress save (Phase 1: just the memorized toggle).
//
// POST { verse_key: "2:255", action: 'memorize' | 'unmemorize' }
// Writes the signed-in user's row in public.hifz_progress under their session,
// so RLS (auth.uid() = user_id) authorizes the write. The full spaced-
// repetition scheduler is a later phase; here we seed sane SR defaults.

import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

export const runtime = "nodejs";

export async function POST(req: NextRequest) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: "not signed in" }, { status: 401 });
  }

  let body: { verse_key?: string; action?: string };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "invalid json" }, { status: 400 });
  }

  const verseKey = String(body.verse_key || "").trim();
  if (!/^\d+:\d+$/.test(verseKey)) {
    return NextResponse.json({ error: "invalid verse_key" }, { status: 400 });
  }
  const action = body.action === "unmemorize" ? "unmemorize" : "memorize";

  const now = new Date();
  const row: Record<string, unknown> =
    action === "memorize"
      ? {
          user_id: user.id,
          verse_key: verseKey,
          status: "memorized",
          reps: 1,
          due_at: new Date(now.getTime() + 24 * 60 * 60 * 1000).toISOString(),
          last_reviewed_at: now.toISOString(),
        }
      : {
          user_id: user.id,
          verse_key: verseKey,
          status: "learning",
          last_reviewed_at: now.toISOString(),
        };

  const { error } = await supabase
    .from("hifz_progress")
    .upsert(row, { onConflict: "user_id,verse_key" });

  if (error) {
    console.error("[hifz progress] upsert failed", error.message);
    return NextResponse.json({ error: "could not save" }, { status: 500 });
  }

  return NextResponse.json({
    ok: true,
    status: action === "memorize" ? "memorized" : "learning",
  });
}
