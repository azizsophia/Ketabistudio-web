import { NextRequest, NextResponse } from "next/server";
import { COMING_SOON, PREVIEW_KEY } from "@/lib/flags";

/* ── Coming-soon gate ──────────────────────────────────────────────
   When COMING_SOON (lib/flags.ts) is true, the public sees ONLY the
   coming-soon page and the privacy policy — every other page is redirected
   to /coming-soon. The owner browses + places test orders by visiting any
   page with ?preview=<PREVIEW_KEY> once — that sets a bypass cookie. Flip
   COMING_SOON to false in lib/flags.ts to go live. */

const COOKIE = "ketabi_preview";

/* Always reachable, even behind the gate. Pre-launch the public sees ONLY the
   coming-soon page and the privacy policy (the one legal page the App Store /
   Play listings link to). Everything else here is a functional endpoint, not a
   browsable marketing page — gating it would break a live feature, so it stays
   open:
     /cards/print — the chrome-free render the worker screenshots for print
     /c           — delivered digital-card links must open for recipients
     /admin       — password-protected (ADMIN_KEY); the owner's own tooling
   Terms, the refund policy and the whole shop stay gated until launch. */
const ALLOW = [
  "/coming-soon",
  "/privacy-policy",
  "/cards/print",
  "/c",
  "/admin",
];

export function middleware(req: NextRequest) {
  if (!COMING_SOON) return NextResponse.next();

  const { pathname, searchParams } = req.nextUrl;

  /* Owner bypass: ?preview=KEY lets THIS request straight through and drops a
     30-day cookie for later navigation (no redirect round-trip to depend on). */
  const preview = searchParams.get("preview");
  if (preview && preview === PREVIEW_KEY) {
    const res = NextResponse.next();
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
