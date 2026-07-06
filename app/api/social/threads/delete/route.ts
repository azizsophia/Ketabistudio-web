import { NextRequest, NextResponse } from "next/server";
import { loadThreadsCreds, refreshedThreadsCreds, deleteThreadsPost } from "@/lib/threads";

// Delete a published Threads post by id. Gated by CRON_SECRET. Used to pull a
// post we want to re-publish (e.g. a carousel that only mirrored one slide).

const CRON_SECRET = process.env.CRON_SECRET?.trim();

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function authorized(req: NextRequest): boolean {
  const auth = (req.headers.get("authorization") || "").trim();
  return !!CRON_SECRET && auth === `Bearer ${CRON_SECRET}`;
}

export async function POST(req: NextRequest) {
  if (!authorized(req)) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  let creds = await loadThreadsCreds();
  if (!creds) return NextResponse.json({ error: "no threads creds" }, { status: 500 });
  creds = await refreshedThreadsCreds(creds);
  let body: { post_id?: string };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "invalid json" }, { status: 400 });
  }
  if (!body.post_id) return NextResponse.json({ error: "post_id required" }, { status: 400 });
  const res = await deleteThreadsPost(creds, body.post_id);
  return NextResponse.json(res, { status: res.ok ? 200 : 500 });
}
