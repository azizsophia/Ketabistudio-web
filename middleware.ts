import { NextRequest, NextResponse } from "next/server";
import { COMING_SOON, PREVIEW_KEY } from "@/lib/flags";

/* ── Coming-soon gate ──────────────────────────────────────────────
   When COMING_SOON (lib/flags.ts) is true, the public is redirected to
   /coming-soon (which promotes the app + keeps the legal pages reachable
   for the App Store / Play listings). The owner browses + places test
   orders by visiting any page with ?preview=<PREVIEW_KEY> once — that sets
   a bypass cookie. Flip COMING_SOON to false in lib/flags.ts to go live. */

const COOKIE = "ketabi_preview";

/* Always reachable, even behind the gate. The legal pages are linked from
   the App Store / Play listings; /cards/print is the chrome-free render the
   worker screenshots for Prodigi print assets. */
const ALLOW = [
  "/coming-soon",
  "/privacy-policy",
  "/terms",
  "/refund-policy",
  "/cards/print",
];

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
