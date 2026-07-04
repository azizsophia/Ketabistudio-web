import { NextRequest, NextResponse } from "next/server";
import { saveThreadsCreds } from "@/lib/threads";

// One-time Threads OAuth connect. Visiting this route with no params bounces
// to the Threads authorize dialog; Threads redirects back here with ?code,
// which is exchanged for a long-lived token and persisted. After this single
// visit by the owner, the daily poster mirrors every post to Threads forever
// (the cron refreshes the token weekly).
//
// Requires two Vercel env vars from the Threads app in the Meta dev dashboard:
//   THREADS_APP_ID, THREADS_APP_SECRET
// and this exact URL registered as the app's Redirect Callback URL.

const APP_ID = process.env.THREADS_APP_ID?.trim();
const APP_SECRET = process.env.THREADS_APP_SECRET?.trim();
const CRON_SECRET = process.env.CRON_SECRET?.trim();
const REDIRECT = "https://www.ketabistudio.com/api/social/threads/connect";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// Shortcut path: the Meta dashboard's "User Token Generator" hands out a
// long-lived Threads token directly (no OAuth redirect, which sidesteps the
// redirect-URI whitelist headache). Paste that token here (Bearer CRON_SECRET)
// and we validate it, derive the user id, and persist it — same end state as
// the OAuth flow.
export async function POST(req: NextRequest) {
  const auth = (req.headers.get("authorization") || "").trim();
  if (!CRON_SECRET || auth !== `Bearer ${CRON_SECRET}`) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }
  let body: { token?: string };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "invalid json" }, { status: 400 });
  }
  const token = body.token?.trim();
  if (!token) return NextResponse.json({ error: "token required" }, { status: 400 });

  // Validate + get the Threads user id.
  const me = await fetch(
    `https://graph.threads.net/v1.0/me?fields=id,username&access_token=${token}`
  );
  const med = (await me.json()) as { id?: string; username?: string; error?: { message?: string } };
  if (!med.id) {
    return NextResponse.json(
      { error: "token rejected by Threads", detail: med.error?.message },
      { status: 400 }
    );
  }

  // Exchange for a long-lived token if this one is short-lived (harmless if
  // already long-lived — Threads returns a fresh 60-day token either way).
  let finalToken = token;
  try {
    const ll = await fetch(
      `https://graph.threads.net/access_token?grant_type=th_exchange_token&client_secret=${APP_SECRET}&access_token=${token}`
    );
    const lld = (await ll.json()) as { access_token?: string };
    if (lld.access_token) finalToken = lld.access_token;
  } catch {
    /* keep the provided token */
  }

  await saveThreadsCreds({
    user_id: String(med.id),
    token: finalToken,
    updated_at: new Date().toISOString(),
  });
  return NextResponse.json({ ok: true, username: med.username || null, user_id: med.id });
}

function page(title: string, body: string, ok: boolean) {
  return new NextResponse(
    `<!DOCTYPE html><html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>${title}</title>
<style>body{font-family:Georgia,serif;background:#f3eee2;color:#2f3b32;display:flex;min-height:100vh;align-items:center;justify-content:center;margin:0}
.card{max-width:420px;padding:48px;text-align:center}.mark{letter-spacing:6px;font-size:14px;color:#96804a;margin-bottom:24px}
h1{font-size:26px;margin:0 0 12px}p{color:#6b6a5e;line-height:1.5}</style></head>
<body><div class="card"><div class="mark">KETABI STUDIO</div><h1>${ok ? "✓ " : ""}${title}</h1><p>${body}</p></div></body></html>`,
    { status: ok ? 200 : 400, headers: { "Content-Type": "text/html; charset=utf-8" } }
  );
}

export async function GET(req: NextRequest) {
  if (!APP_ID || !APP_SECRET) {
    return page(
      "Not configured",
      "Add THREADS_APP_ID and THREADS_APP_SECRET to the Vercel environment first.",
      false
    );
  }

  // Threads appends #_ to the redirect; the fragment never reaches the server,
  // but trim defensively in case the code is pasted by hand.
  const code = req.nextUrl.searchParams.get("code")?.replace(/#_$/, "");

  if (!code) {
    const auth =
      `https://threads.net/oauth/authorize?client_id=${APP_ID}` +
      `&redirect_uri=${encodeURIComponent(REDIRECT)}` +
      `&scope=threads_basic,threads_content_publish&response_type=code`;
    return NextResponse.redirect(auth);
  }

  // code -> short-lived token (+ user id)
  const ex = await fetch("https://graph.threads.net/oauth/access_token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      client_id: APP_ID,
      client_secret: APP_SECRET,
      grant_type: "authorization_code",
      redirect_uri: REDIRECT,
      code,
    }),
  });
  const exd = (await ex.json()) as {
    access_token?: string;
    user_id?: number | string;
    error_message?: string;
  };
  if (!exd.access_token || !exd.user_id) {
    return page(
      "Connection failed",
      "Threads said: " + (exd.error_message || JSON.stringify(exd)).slice(0, 200),
      false
    );
  }

  // short-lived -> long-lived (60 days, cron refreshes weekly)
  const ll = await fetch(
    `https://graph.threads.net/access_token?grant_type=th_exchange_token&client_secret=${APP_SECRET}&access_token=${exd.access_token}`
  );
  const lld = (await ll.json()) as { access_token?: string };
  const token = lld.access_token || exd.access_token;

  await saveThreadsCreds({
    user_id: String(exd.user_id),
    token,
    updated_at: new Date().toISOString(),
  });

  return page(
    "Threads connected",
    "You can close this page. Every future post now mirrors to Threads automatically.",
    true
  );
}
