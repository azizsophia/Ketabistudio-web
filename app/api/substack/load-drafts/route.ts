import { NextRequest, NextResponse } from "next/server";
import drafts from "@/lib/substackDrafts.json";

// One-shot loader: creates the month of posts as DRAFTS in your Substack via the
// private API. It NEVER publishes and NEVER emails your list; you open each draft
// and hit Substack's own Publish/Schedule. Safe to call more than once (it just
// makes more drafts).
//
// Setup (in Vercel project env, NOT in code or chat):
//   SUBSTACK_SID        = your connect.sid cookie value
//   SUBSTACK_SUBDOMAIN  = your publication subdomain (e.g. "ketabi")
//   CRON_SECRET         = already set; used to authorise this call
//
// Trigger once:  GET /api/substack/load-drafts?key=YOUR_CRON_SECRET
//
// The endpoint is unofficial. If Substack has changed it, calls return the error
// body below and nothing is created; capture the real request from your browser
// (F12 > Network, create a draft, copy the URL + payload) and we point this at it.

export const dynamic = "force-dynamic";

type Draft = { title: string; subtitle: string; body: unknown };

async function createDraft(sid: string, subdomain: string, d: Draft) {
  const res = await fetch(`https://${subdomain}.substack.com/api/v1/drafts`, {
    method: "POST",
    headers: {
      Cookie: `connect.sid=${sid}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      draft_title: d.title,
      draft_subtitle: d.subtitle,
      draft_body: JSON.stringify(d.body),
      type: "newsletter",
      audience: "everyone",
    }),
  });
  const text = await res.text();
  return { status: res.status, ok: res.ok, body: text.slice(0, 160) };
}

export async function GET(req: NextRequest) {
  const key = req.nextUrl.searchParams.get("key");
  const secret = process.env.CRON_SECRET;
  if (!secret || key !== secret) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }
  const sid = process.env.SUBSTACK_SID;
  const subdomain = process.env.SUBSTACK_SUBDOMAIN;
  if (!sid || !subdomain) {
    return NextResponse.json(
      { error: "Set SUBSTACK_SID and SUBSTACK_SUBDOMAIN in Vercel env first. Nothing was sent." },
      { status: 400 }
    );
  }

  const results: Array<Record<string, unknown>> = [];
  for (const d of drafts as Draft[]) {
    try {
      const r = await createDraft(sid, subdomain, d);
      results.push({ title: d.title, ...r });
    } catch (e) {
      results.push({ title: d.title, error: e instanceof Error ? e.message : "unknown" });
    }
    await new Promise((r) => setTimeout(r, 1200)); // stay under 1 req/sec
  }
  const created = results.filter((r) => r.ok).length;
  return NextResponse.json({
    ok: true,
    created,
    total: results.length,
    note: "Drafts only. Nothing published or emailed. Open Substack > Drafts to review.",
    results,
  });
}
