import { NextRequest, NextResponse } from "next/server";

// Redo the Gumroad journal listing (name + description) via the v2 API.
// Auth: ?key=CRON_SECRET. Gumroad token comes from GUMROAD_TOKEN env, or can be
// passed once as &token=... (then regenerate it in Gumroad settings afterward).
//   GET /api/gumroad?key=CRON_SECRET            -> update the journal listing
//   GET /api/gumroad?key=CRON_SECRET&list=1     -> just list products (ids/names)
export const dynamic = "force-dynamic";
const CRON_SECRET = process.env.CRON_SECRET?.trim();
const API = "https://api.gumroad.com/v2";

const JOURNAL_NAME =
  "From One Root: a 30-Day Journey Through the Language of the Qur'an";

const JOURNAL_DESC = `You say these Arabic words every day. Rahma. Sabr. Shukr. Most of us were never taught what they actually mean, or where they come from. This journal changes that, one word at a time.

Thirty days. Thirty Arabic roots. Each one traced back to its true, classical meaning and the ayah or hadith it lives in, with room for you to sit with it and write.

WHAT'S INSIDE (63 pages)
- A title page and a short how-to-use guide
- 30 daily spreads, two pages each: a story page for the root, then a page that is yours, with three gentle prompts and space to write
- A full sources page listing every citation, day by day

WHY I MADE IT THIS WAY
I worked on this for months. Every root was checked against the classical Arabic dictionaries, and every source is named so you can look it up yourself. Where a meaning is a scholar's insight rather than settled fact, the page tells you so. I just wanted to make something honest and gentle about words we say every day but rarely stop to understand.

WHO IT IS FOR
Anyone who prays in Arabic and wants to finally understand the words. New Muslims building a gentle daily habit. Anyone who loves the Qur'an and loves to journal. A meaningful gift for Ramadan, Eid, a revert, or someone you love.

WHAT YOU GET
One instant-download PDF, 63 pages, US Letter size, ready to print at home or at any print shop. For personal use only, please do not resell or redistribute.

May it bring you closer to the words you already carry.
Ketabi Studio`;

type GProduct = { id: string; name: string; short_url?: string; custom_permalink?: string };

export async function GET(req: NextRequest) {
  if (!CRON_SECRET || req.nextUrl.searchParams.get("key") !== CRON_SECRET) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }
  const token = req.nextUrl.searchParams.get("token") || process.env.GUMROAD_TOKEN;
  if (!token) {
    return NextResponse.json(
      {
        error:
          "No Gumroad token. Add GUMROAD_TOKEN in Vercel env, or pass ?token=... once. " +
          "Generate it at Gumroad > Settings > Advanced > Applications > Generate access token.",
      },
      { status: 400 }
    );
  }

  const lr = await fetch(`${API}/products?access_token=${encodeURIComponent(token)}`);
  const ld = (await lr.json()) as { success?: boolean; products?: GProduct[]; message?: string };
  if (!ld.success) {
    return NextResponse.json({ error: "list failed", detail: ld.message || "check token" }, { status: 502 });
  }
  if (req.nextUrl.searchParams.get("list")) {
    return NextResponse.json({
      ok: true,
      products: (ld.products || []).map((p) => ({ id: p.id, name: p.name, url: p.short_url })),
    });
  }

  const journal = (ld.products || []).find(
    (p) =>
      /bzwxm/i.test(p.short_url || "") ||
      /bzwxm/i.test(p.custom_permalink || "") ||
      /from one root/i.test(p.name || "")
  );
  if (!journal) {
    return NextResponse.json({ error: "journal product not found", have: (ld.products || []).map((p) => p.name) }, { status: 404 });
  }

  const body = new URLSearchParams({
    access_token: token,
    name: JOURNAL_NAME,
    description: JOURNAL_DESC,
  });
  const ur = await fetch(`${API}/products/${journal.id}`, {
    method: "PUT",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body,
  });
  const ud = (await ur.json()) as { success?: boolean; message?: string };
  return NextResponse.json({
    ok: !!ud.success,
    updated: journal.name,
    id: journal.id,
    detail: ud.success ? "name + description updated" : ud.message || "update failed",
  });
}
