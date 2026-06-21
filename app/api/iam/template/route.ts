import { NextRequest, NextResponse } from "next/server";
import { readFileSync } from "fs";
import { join } from "path";
import { COMING_SOON, PREVIEW_KEY } from "@/lib/flags";

/* Serves the I Am print template to the website's live preview. The template is
   our design + content IP, so it is NOT a public static file:
     - while the site is in coming-soon, only the owner (preview cookie) can load it;
     - once live, it is served (the builder preview needs it) but never as a
       guessable static asset, with no-store + noindex to deter scraping.
   The worker reads the SAME file from disk for the actual print. */
export const runtime = "nodejs";

const COOKIE = "ketabi_preview";
let _cache: string | null = null;

function templateHtml(): string {
  if (_cache == null) {
    _cache = readFileSync(
      join(process.cwd(), "iam-templates", "book-template.html"),
      "utf8"
    );
  }
  return _cache;
}

export async function GET(req: NextRequest) {
  const hasPreview = req.cookies.get(COOKIE)?.value === PREVIEW_KEY;
  if (COMING_SOON && !hasPreview) {
    return NextResponse.json({ error: "not found" }, { status: 404 });
  }
  try {
    return new NextResponse(templateHtml(), {
      headers: {
        "Content-Type": "text/html; charset=utf-8",
        "Cache-Control": "private, no-store",
        "X-Robots-Tag": "noindex",
      },
    });
  } catch {
    return NextResponse.json({ error: "unavailable" }, { status: 500 });
  }
}
