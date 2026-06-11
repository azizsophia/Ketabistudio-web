import { NextRequest, NextResponse } from "next/server";

const SB = process.env.SUPABASE_URL?.replace(/\s/g, "").replace(/\/$/, "");
const KEY = process.env.SUPABASE_SERVICE_KEY?.replace(/\s/g, "");
const ADMIN = process.env.ADMIN_KEY;

function auth(req: NextRequest) {
  const k = req.headers.get("x-admin-key");
  if (!ADMIN || !k || k !== ADMIN) return false;
  return true;
}

export async function GET(req: NextRequest) {
  if (!auth(req)) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }
  if (!SB || !KEY) {
    return NextResponse.json({ error: "not configured" }, { status: 500 });
  }

  const r = await fetch(
    `${SB}/rest/v1/orders?select=id,status,book_slug,child_name,skin,hair,hair_style,customer_email,shipping,interior_path,cover_path,qc_report,lulu_print_job_id,created_at,updated_at,notes&order=created_at.desc`,
    {
      headers: {
        Authorization: `Bearer ${KEY}`,
        apikey: KEY!,
      },
      cache: "no-store",
    }
  );

  const data = await r.json();
  return NextResponse.json(data);
}
