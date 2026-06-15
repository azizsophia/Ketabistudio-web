import { NextRequest, NextResponse } from "next/server";

/* ── Coming-soon gate ──────────────────────────────────────────────
   When COMING_SOON=1, the public is redirected to /coming-soon (which
   promotes the app + keeps the legal pages reachable for the App Store /
   Play listings). The owner can browse and place test orders by visiting
   any page with ?preview=<PREVIEW_KEY> once — that sets a bypass cookie.

   With COMING_SOON unset the site behaves normally, so dev and Vercel
   previews are untouched until the flag is switched on for the domain. */

const COMING_SOON = process.env.COMING_SOON === "1";
const PREVIEW_KEY = process.env.PREVIEW_KEY || "";
const COOKIE = "ketabi_preview";

/* Always reachable, even behind the gate (App Store / Play link to these). */
const ALLOW = ["/coming-soon", "/privacy-policy", "/terms", "/refund-policy"];

export function middleware(req: NextRequest) {
  if (!COMING_SOON) return NextResponse.next();

  const { pathname, searchParams } = req.nextUrl;

  /* Owner bypass: ?preview=KEY sets a 30-day cookie, then clean the URL. */
  const preview = searchParams.get("preview");
  if (preview && PREVIEW_KEY && preview === PREVIEW_KEY) {
    const clean = req.nextUrl.clone();
    clean.searchParams.delete("preview");
    const res = NextResponse.redirect(clean);
    res.cookies.set(COOKIE, PREVIEW_KEY, {
      httpOnly: true,
      sameSite: "lax",
      maxAge: 60 * 60 * 24 * 30,
      path: "/",
    });
    return res;
  }

  /* Bypass cookie present → full site. */
  if (PREVIEW_KEY && req.cookies.get(COOKIE)?.value === PREVIEW_KEY) {
    return NextResponse.next();
  }

  /* Allowlisted paths stay reachable. */
  if (ALLOW.some((p) => pathname === p || pathname.startsWith(p + "/"))) {
    return NextResponse.next();
  }

  /* Everyone else → the coming-soon page. */
  const url = req.nextUrl.clone();
  url.pathname = "/coming-soon";
  url.search = "";
  return NextResponse.redirect(url);
}

/* Skip API routes and static assets (Stripe webhook + checkout must work). */
export const config = {
  matcher: ["/((?!api|_next/static|_next/image|favicon.ico|icon.png|images|.*\\.).*)"],
};
