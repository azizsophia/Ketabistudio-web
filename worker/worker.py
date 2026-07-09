#!/usr/bin/env python3
"""
KETABI ORDER WORKER
pending → generating → qc_passed → validated → awaiting_approval
       → approved → submitted (Lulu) → printing → shipped | failed | rejected

Env:
  SUPABASE_URL, SUPABASE_SERVICE_KEY
  LULU_CLIENT_KEY, LULU_CLIENT_SECRET, LULU_ENV (sandbox|production)
  ASSETS_DIR   local dir containing the Modesty PSDs (Cover.psd + pages)
  POLL_SECONDS (default 30)
"""
import json
import os
import sys
import time
import traceback
from pathlib import Path

import requests

sys.path.insert(0, str(Path(__file__).parent / "pipeline"))

import qc  # noqa: E402
import emailer  # noqa: E402
import cards_worker  # noqa: E402

SB = "".join(os.environ["SUPABASE_URL"].split()).rstrip("/")
KEY = "".join(os.environ["SUPABASE_SERVICE_KEY"].split())
HDRS = {"Authorization": f"Bearer {KEY}", "apikey": KEY,
        "Content-Type": "application/json"}
POD = "0850X0850.FC.PRE.PB.080CW444.MXX"
# ⚠️ CANDIDATE HARDCOVER POD — casewrap (CW) binding, same trim/paper as the
# softcover above. Must be confirmed by Lulu's validate-cover gate on the first
# real hardcover order; keep in sync with lulu_client.HARDCOVER_POD and the
# Next.js HARDCOVER_POD in lib/pricing.ts.
HARDCOVER_POD = "0850X0850.FC.PRE.CW.080CW444.MXX"

# Photo-book keepsake templates (orders with book_slug = template slug). Built
# from the customer's uploaded photos + captions via photobook_pipeline. These
# are HARDCOVER-ONLY 8.5x8.5 keepsakes, 24pp casewrap (every interior page is a
# customer photo).
PHOTOBOOK_SLUGS = {"about-mama", "about-baba", "about-grandma", "about-grandpa",
                   "about-spouse", "about-baby", "our-ramadan"}

# The "I Am [Child]" personalized book (HTML-rendered, 32pp 8.5x8.5). Offered in
# BOTH bindings, so it lives in HARDCOVER_SLUGS but is not photo-book-only.
IAM_SLUG = "i-am"

# Books that may be ordered in hardcover (personalized books + every photo-book
# keepsake). Fixed books keep pre-made softcover cover art and are never
# offered in hardcover.
HARDCOVER_SLUGS = {"her-beautiful-hijab", "my-beautiful-duas", IAM_SLUG} | PHOTOBOOK_SLUGS

SKIN_TO_PSD = {"light": "Blonde light", "medium": "Blonde dark", "dark": "Dark"}
HAIR_TO_PSD = {"black": "Black", "brown": "Brown", "blonde": "Blonde", "red": "Red"}
STYLE_TO_PSD = {"long-straight": "Long straight", "long-curly": "Long curly",
                "short-straight": "Short straight", "short-curly": "Short curly"}

FIXED_ASSETS = {
    "juha-and-the-enormous-pumpkin": ("juha/Juha_interior.pdf", "juha/Juha_cover.pdf"),
    "maryam-is-kind-to-her-parents": ("maryam/Maryam_interior.pdf", "maryam/Maryam_cover.pdf"),
}

# "From One Root" 30-day journal: a fixed 70-page US Letter COIL-BOUND book.
# The interior ships in the repo (print-ready 8.75x11.25in with bleed, 300dpi);
# the cover is assembled AT RUN TIME to the exact dimensions Lulu's
# /cover-dimensions/ endpoint demands for this POD + page count, so the cover
# spec can never drift from what Lulu actually requires.
JOURNAL_SLUG = "from-one-root-journal"
JOURNAL_PAGES = 70
# 8.5x11 · full color · standard quality · coil · 60# uncoated white (uncoated
# takes pen ink well, which matters for a writing journal) · matte cover.
COIL_POD = "0850X1100.FC.STD.CO.060UW444.MXX"
JOURNAL_DIR = Path(__file__).resolve().parent / "assets" / "journal"

# Per-book print spec. All three current books are 32-page 8.75" square
# softcover (POD 0850X0850...PB), verified against the production PDFs on
# 2026-06-11. page_count and pod must match what is sent to Lulu; a new
# book with a different length needs its own entry here.
DEFAULT_SPEC = {"page_count": 32, "pod": POD}
BOOK_SPECS = {
    "her-beautiful-hijab": {"page_count": 32, "pod": POD},
    "my-beautiful-duas": {"page_count": 32, "pod": POD},
    # "I Am [Child]" — 32pp 8.5x8.5, softcover POD by default; spec_for swaps to
    # the casewrap HARDCOVER_POD when a hardcover order is placed.
    "i-am": {"page_count": 32, "pod": POD},
    "juha-and-the-enormous-pumpkin": {"page_count": 32, "pod": POD},
    "maryam-is-kind-to-her-parents": {"page_count": 32, "pod": POD},
    # Photo-book keepsakes — hardcover-only, 24-page casewrap.
    "about-mama": {"page_count": 24, "pod": HARDCOVER_POD},
    "about-baba": {"page_count": 24, "pod": HARDCOVER_POD},
    "about-grandma": {"page_count": 24, "pod": HARDCOVER_POD},
    "about-grandpa": {"page_count": 24, "pod": HARDCOVER_POD},
    "about-spouse": {"page_count": 24, "pod": HARDCOVER_POD},
    "about-baby": {"page_count": 24, "pod": HARDCOVER_POD},
    "our-ramadan": {"page_count": 24, "pod": HARDCOVER_POD},
    # From One Root journal — 70pp US Letter, coil-bound, standard color.
    JOURNAL_SLUG: {"page_count": JOURNAL_PAGES, "pod": COIL_POD},
}


def spec_for(slug, cover_type="softcover"):
    """Per-book print spec. Returns the hardcover POD only when a hardcover
    order is placed for a personalized book; everything else (including fixed
    books, and any unexpected cover_type) falls back to the softcover POD so
    existing behavior is unchanged. Photo-book keepsakes are hardcover-only and
    already carry the casewrap POD in BOOK_SPECS."""
    spec = dict(BOOK_SPECS.get(slug, DEFAULT_SPEC))
    if cover_type == "hardcover" and slug in HARDCOVER_SLUGS:
        spec["pod"] = HARDCOVER_POD
    return spec


# ── supabase helpers ────────────────────────────────────────────────
def db(method, path, **kw):
    r = requests.request(method, f"{SB}/rest/v1/{path}", headers=HDRS,
                         timeout=30, **kw)
    r.raise_for_status()
    return r.json() if r.text else None


def set_status(oid, status, **fields):
    db("PATCH", f"orders?id=eq.{oid}",
       json={"status": status, **fields})
    db("POST", "order_events",
       json={"order_id": oid, "event": status,
             "detail": fields.get("qc_report")})


def storage_upload(bucket, path, data: bytes, ctype, cache_control="3600"):
    # cache_control: seconds string (default) OR directives like "no-cache".
    # The approval digest is re-uploaded to a FIXED path on every re-render, so
    # it must be served no-cache — otherwise the owner reviews a stale preview
    # (browser/CDN serve the old image for up to an hour) and could approve the
    # wrong render. The print PDFs are downloaded, not previewed, so they keep
    # the default TTL.
    r = requests.post(f"{SB}/storage/v1/object/{bucket}/{path}",
                      headers={"Authorization": f"Bearer {KEY}",
                               "Content-Type": ctype,
                               "Cache-Control": cache_control,
                               "x-upsert": "true"},
                      data=data, timeout=300)
    if r.status_code >= 400:
        # surface the real reason (e.g. file-size limit) in the logs
        print(f"[storage] upload failed {r.status_code} for {bucket}/{path} "
              f"({len(data)} bytes): {r.text[:300]}", flush=True)
    r.raise_for_status()
    return path


def signed_url(bucket, path, expires=86400):
    r = requests.post(f"{SB}/storage/v1/object/sign/{bucket}/{path}",
                      headers=HDRS, json={"expiresIn": expires}, timeout=30)
    r.raise_for_status()
    return f"{SB}/storage/v1{r.json()['signedURL']}"


def storage_download(bucket, path) -> bytes:
    r = requests.get(f"{SB}/storage/v1/object/{bucket}/{path}",
                     headers={"Authorization": f"Bearer {KEY}"}, timeout=300)
    r.raise_for_status()
    return r.content


# ── generation (personalized book) ──────────────────────────────────
def generate_amira(order, workdir: Path, cover_type="softcover", client=None):
    """Runs the exact validated pipeline. Returns (interior_pdf, cover_pdf).

    The interior PDF is identical for both cover types — only the cover wrap
    geometry changes for hardcover (see generate_from_bases.build_from_bases).
    """
    from generate_from_bases import build_from_bases

    name = order["child_name"].strip()
    qc.gate_name(name)

    spec = spec_for(order["book_slug"], cover_type)
    return build_from_bases(
        name, order["skin"], order["hair"], order["hair_style"], workdir,
        cover_type=cover_type, client=client,
        page_count=spec["page_count"], pod=spec["pod"])


def generate_duas(order, workdir: Path, cover_type="softcover", client=None):
    """Personalized 'My Beautiful Duas' interior + cover. Interior is identical
    for both cover types; only the cover wrap geometry changes for hardcover."""
    import duas_pipeline

    name = order["child_name"].strip()
    qc.gate_name(name)
    opt = order.get("options") or {}
    spec = spec_for(order["book_slug"], cover_type)
    interior, cover, _ = duas_pipeline.build(
        name, opt.get("character"), opt.get("look"), opt.get("eye_color"),
        workdir, cover_type=cover_type, client=client,
        page_count=spec["page_count"], pod=spec["pod"])
    return interior, cover


def generate_photobook(order, workdir: Path, cover_type="hardcover", client=None):
    """Customer photo-book keepsake. Builds a 24pp casewrap interior + cover
    wrap from the order's photo_data (uploaded photos + captions). Keepsakes are
    hardcover-only, so the casewrap cover geometry is queried from Lulu."""
    import photobook_pipeline

    photo_data = order.get("photo_data") or {}
    pages = photo_data.get("pages") or []
    if not pages:
        raise qc.QCFailure("photo book has no pages")
    spec = spec_for(order["book_slug"], cover_type)

    # ── content QC (defensive; the order API already enforces these) ──
    # Guarantees a malformed book is caught here and routed for review rather
    # than printed broken. Photo count must exactly fill the 24pp spec, every
    # page needs a photo, and captions must fit the layout (verified ≤140 chars).
    expected_photos = spec["page_count"] - 4  # title+dedication+dua+closing
    if len(pages) != expected_photos:
        raise qc.QCFailure(
            f"photo book has {len(pages)} photo pages, expected "
            f"{expected_photos}")
    if not photo_data.get("cover_photo_url"):
        raise qc.QCFailure("photo book is missing its cover photo")
    CAPTION_HARD_MAX = 140  # render-safe ceiling (UI caps lower, at 110)
    for idx, pg in enumerate(pages, start=1):
        if not (pg or {}).get("photo_url"):
            raise qc.QCFailure(f"photo book page {idx} is missing its photo")
        if len((pg.get("caption") or "")) > CAPTION_HARD_MAX:
            raise qc.QCFailure(
                f"photo book page {idx} caption is too long to print cleanly")

    interior, cover, _ = photobook_pipeline.build(
        photo_data, workdir, cover_type=cover_type, client=client,
        page_count=spec["page_count"], pod=spec["pod"],
        template=order["book_slug"])
    return interior, cover


def generate_iam(order, workdir: Path, cover_type="hardcover", client=None):
    """"I Am [Child]" book. Renders the HTML template to print PDFs with headless
    Chromium (see pipeline/iam_book.py). The interior is identical for both
    bindings; only the cover geometry differs. The cover spine (and casewrap
    turn-in) is taken from Lulu's exact cover dimensions for THIS order's POD, so
    the wrap is never hardcoded."""
    import iam_book
    from lulu_client import cover_dims_to_px

    opt = order.get("options") or {}
    photos = order.get("photo_data") or {}
    name = (order.get("child_name") or "").strip()
    qc.gate_name(name)
    name_ar = (opt.get("name_arabic") or "").strip()
    if not name_ar:
        raise qc.QCFailure("I Am book is missing the Arabic name")

    spec = spec_for(order["book_slug"], cover_type)

    # photos may be a list of {"url","crop"} (current) or bare url strings
    # (legacy); build url + crop maps the renderer consumes. Photos are embedded
    # at print resolution (downscaled) so the rendered PDF stays a sane size.
    photos_map = {"cover": iam_book.photo_data_uri(photos.get("cover_photo_url") or "")}
    crops_map = {"cover": photos.get("cover_crop")}
    for i, item in enumerate(photos.get("photos") or []):
        if not item:
            continue
        if isinstance(item, str):
            url, crop = item, None
        else:
            url, crop = item.get("url"), item.get("crop")
        if url:
            photos_map[str(i + 1)] = iam_book.photo_data_uri(url)
            crops_map[str(i + 1)] = crop

    book_order = {
        "name": name,
        "name_arabic": name_ar,
        "gender": opt.get("gender") or "boy",
        "colorway": opt.get("colorway") or "teal",
        "binding": "hardcover" if cover_type == "hardcover" else "paperback",
        "dedication": opt.get("dedication") or "",
        "photos": photos_map,
        "crops": crops_map,
    }

    # Cover wrap geometry from Lulu's exact dimensions (px @ 300 DPI → inches).
    dims = client.calculate_cover_dimensions(spec["pod"], spec["page_count"])
    total_w_in = cover_dims_to_px(dims)[0] / 300.0
    total_h_in = cover_dims_to_px(dims)[1] / 300.0
    if cover_type == "hardcover":
        wrap_in = max(0.0, (total_h_in - 8.5) / 2.0)
        spine_in = max(0.0, total_w_in - 17.0 - 2 * wrap_in)
        cover = iam_book.render_cover(book_order, spine_in=spine_in, wrap_in=wrap_in)
    else:
        spine_in = max(0.0, total_w_in - 17.25)  # (8.5+0.125)*2
        cover = iam_book.render_cover(book_order, spine_in=spine_in)

    interior = iam_book.render_interior(book_order)
    ipath = workdir / "interior.pdf"
    cpath = workdir / "cover.pdf"
    ipath.write_bytes(interior)
    cpath.write_bytes(cover)
    return str(ipath), str(cpath)


# ── per-order processing ────────────────────────────────────────────
def generate_journal(order, workdir: Path, client):
    """From One Root journal: repo-shipped interior + a cover built at run time
    to Lulu's own /cover-dimensions/ answer for the coil POD. Also fetches the
    real print+shipping cost so the owner sees it on the order BEFORE approving.
    Returns (interior_path, cover_path, report)."""
    from PIL import Image

    interior_src = JOURNAL_DIR / "Journal_interior.pdf"
    front_src = JOURNAL_DIR / "journal_cover_front.png"
    back_src = JOURNAL_DIR / "journal_cover_back.png"
    for f in (interior_src, front_src, back_src):
        if not f.exists():
            raise RuntimeError(f"journal asset missing: {f}")
    interior = workdir / "interior.pdf"
    interior.write_bytes(interior_src.read_bytes())

    # Lulu's required cover size for THIS binding + page count (points).
    dims = client.calculate_cover_dimensions(COIL_POD, JOURNAL_PAGES, unit="pt")
    w_pt, h_pt = float(dims["width"]), float(dims["height"])
    W, H = round(w_pt / 72 * 300), round(h_pt / 72 * 300)
    IVORY = (242, 237, 227)
    front = Image.open(front_src).convert("RGB")
    back = Image.open(back_src).convert("RGB")

    def sheet(art, w, h, bind):
        """Art centered on an ivory canvas, nudged away from the coil edge."""
        cv = Image.new("RGB", (w, h), IVORY)
        s = min((w * 0.92) / art.width, (h * 0.94) / art.height)
        aw, ah = int(art.width * s), int(art.height * s)
        a = art.resize((aw, ah), Image.LANCZOS)
        shift = max(40, int(w * 0.02))
        x = (w - aw) // 2 + (shift if bind == "left" else -shift)
        cv.paste(a, (x, (h - ah) // 2))
        return cv

    cover = workdir / "cover.pdf"
    if W > int(1.5 * H):
        # One-piece wrap: back on the left half, front on the right.
        cv = Image.new("RGB", (W, H), IVORY)
        half = W // 2
        cv.paste(sheet(back, half, H, bind="right"), (0, 0))
        cv.paste(sheet(front, W - half, H, bind="left"), (half, 0))
        cv.save(cover, "PDF", resolution=300.0)
        layout = "one-piece"
    else:
        # Separate sheets: front (binds left), back (binds right).
        pg_front = sheet(front, W, H, bind="left")
        pg_back = sheet(back, W, H, bind="right")
        pg_front.save(cover, "PDF", resolution=300.0, save_all=True,
                      append_images=[pg_back])
        layout = "two-page"

    report = {"journal": True, "pod": COIL_POD,
              "lulu_cover_dims_pt": [w_pt, h_pt], "cover_layout": layout}
    # Real cost at EVERY shipping level, so the owner can choose speed with
    # actual prices in view before approving.
    report["lulu_cost"] = {}
    for level in ("MAIL", "GROUND", "EXPEDITED", "EXPRESS"):
        try:
            cost = client.calculate_cost(JOURNAL_PAGES, order["shipping"],
                                         pod_package_id=COIL_POD,
                                         shipping_level=level)
            report["lulu_cost"][level] = {
                "print": (cost.get("line_item_costs") or [{}])[0].get(
                    "total_cost_incl_tax"),
                "shipping": (cost.get("shipping_cost") or {}).get(
                    "total_cost_incl_tax"),
                "total": cost.get("total_cost_incl_tax"),
                "currency": cost.get("currency"),
            }
        except Exception as e:  # noqa: BLE001 — cost view is a bonus, not a gate
            report["lulu_cost"][level] = {"error": str(e)[:160]}
    return str(interior), str(cover), report


def process(order):
    import lulu_client
    oid = order["id"]
    slug = order["book_slug"]
    cover_type = order.get("cover_type", "softcover") or "softcover"
    # Hardcover is only valid for personalized books; force softcover otherwise
    # so a stray value can never change a fixed book's binding.
    if cover_type == "hardcover" and slug not in HARDCOVER_SLUGS:
        cover_type = "softcover"
    # Photo-book keepsakes are hardcover-only (24pp casewrap); pin it so a stray
    # value can never select a binding/spec the keepsake doesn't print in.
    if slug in PHOTOBOOK_SLUGS:
        cover_type = "hardcover"
    workdir = Path(f"/tmp/order-{oid}")
    workdir.mkdir(exist_ok=True)
    set_status(oid, "generating")

    # Payment is confirmed by the time an order reaches 'pending' (the
    # Stripe webhook sets it). Send the confirmation ONCE per order — a
    # re-run (retry after a failure) must not re-email the customer.
    try:
        already = db("GET", f"order_events?order_id=eq.{oid}"
                            "&event=eq.confirmation_sent&select=order_id")
        if not already:
            emailer.send_order_confirmation(order)
            db("POST", "order_events",
               json={"order_id": oid, "event": "confirmation_sent"})
    except Exception as e:  # noqa: BLE001
        print(f"[{oid}] confirmation email error (non-fatal): {e}")

    # Heads-up to the OWNER that a paid order came in (once per order), so they
    # know to watch for the approval email and nothing is silently lost.
    try:
        seen = db("GET", f"order_events?order_id=eq.{oid}"
                          "&event=eq.admin_new_order&select=order_id")
        if not seen:
            emailer.send_admin_new_order(order)
            db("POST", "order_events",
               json={"order_id": oid, "event": "admin_new_order"})
    except Exception as e:  # noqa: BLE001
        print(f"[{oid}] admin new-order email error (non-fatal): {e}")

    # Lulu client — created up front because hardcover cover generation must
    # query Lulu for the required casewrap cover dimensions before rendering.
    client = lulu_client.LuluClient(
        client_key="".join(os.environ["LULU_CLIENT_KEY"].split()),
        client_secret="".join(os.environ["LULU_CLIENT_SECRET"].split()),
        env=os.environ.get("LULU_ENV", "sandbox").strip())

    # Per-order print spec (POD differs for personalized hardcover orders).
    spec = spec_for(slug, cover_type)

    if slug in FIXED_ASSETS:
        # Fixed books are always softcover with pre-made cover art — untouched.
        ipath, cpath = FIXED_ASSETS[slug]
        interior = workdir / "interior.pdf"
        cover = workdir / "cover.pdf"
        interior.write_bytes(storage_download("book-assets", ipath))
        cover.write_bytes(storage_download("book-assets", cpath))
        interior, cover = str(interior), str(cover)
        ref_report = {"fixed_book": True}
    elif slug == JOURNAL_SLUG:
        # Coil-bound journal — repo interior + cover sized to Lulu's answer.
        interior, cover, ref_report = generate_journal(order, workdir, client)
    elif slug in PHOTOBOOK_SLUGS:
        # Customer photo-book keepsake — built from uploaded photos + captions.
        interior, cover = generate_photobook(order, workdir,
                                             cover_type=cover_type,
                                             client=client)
        ref_report = {"photo_book": True, "template": slug,
                      "cover_type": cover_type}
    elif slug == IAM_SLUG:
        # "I Am [Child]" — HTML book rendered with headless Chromium.
        interior, cover = generate_iam(order, workdir, cover_type=cover_type,
                                       client=client)
        ref_report = {"iam_book": True, "cover_type": cover_type,
                      "colorway": (order.get("options") or {}).get("colorway")}
    elif slug == "my-beautiful-duas":
        interior, cover = generate_duas(order, workdir, cover_type=cover_type,
                                        client=client)
        ref_report = {"duas_book": True, "options": order.get("options"),
                      "cover_type": cover_type}
    else:
        interior, cover = generate_amira(order, workdir, cover_type=cover_type,
                                         client=client)
        ref_report = qc.gate_reference(
            interior, order["skin"], order["hair"], order["hair_style"])
        ref_report["cover_type"] = cover_type

    spec_report = qc.gate_spec(
        interior, cover, expected_pages=spec["page_count"],
        cover_type=cover_type,
        # The journal is US Letter coil (8.75x11.25 with bleed), not the 8.75in
        # square PB default; its cover is Lulu-dimension-driven so the fixed
        # PB cover assert does not apply (Lulu's validate-cover is the gate).
        trim_in=(8.75, 11.25) if slug == JOURNAL_SLUG else None,
        cover_mode="lulu" if slug == JOURNAL_SLUG else None)
    set_status(oid, "qc_passed",
               qc_report={"spec": spec_report, "reference": ref_report})

    # upload artifacts
    ikey = storage_upload("orders", f"{oid}/interior.pdf",
                          Path(interior).read_bytes(), "application/pdf")
    ckey = storage_upload("orders", f"{oid}/cover.pdf",
                          Path(cover).read_bytes(), "application/pdf")
    digest = qc.build_digest(interior, cover, order)
    storage_upload("orders", f"{oid}/digest.jpg", digest, "image/jpeg",
                   cache_control="no-cache, max-age=0, must-revalidate")

    # Lulu validation on signed URLs — validates the cover against THIS order's
    # POD (softcover or hardcover), so a wrong hardcover cover fails QC and the
    # order halts before printing.
    # page_count must be THIS order's spec (24pp keepsakes vs 32pp books) —
    # gate_lulu's default is 32, which would validate a keepsake cover against
    # the wrong spine geometry.
    lulu_report = qc.gate_lulu(client, signed_url("orders", ikey),
                               signed_url("orders", ckey), spec["pod"],
                               page_count=spec["page_count"])
    set_status(oid, "validated",
               interior_path=ikey, cover_path=ckey,
               qc_report={"spec": spec_report, "reference": ref_report,
                          "lulu": lulu_report})

    set_status(oid, "awaiting_approval")
    print(f"[{oid}] awaiting approval — digest at orders/{oid}/digest.jpg")

    # Ping the owner with the preview + one-tap approve/reject links.
    try:
        site = (os.environ.get("SITE_URL", "").strip().rstrip("/")
                or "https://www.ketabistudio.com")
        tok = order.get("approval_token", "")
        digest_url = signed_url("orders", f"{oid}/digest.jpg")
        # Signed links to the actual print files so the owner can open the
        # interior + cover PDFs straight from the email (no Supabase needed).
        # 7-day expiry so the links stay valid while the order waits.
        interior_url = signed_url("orders", ikey, expires=604800)
        cover_url = signed_url("orders", ckey, expires=604800)
        approve_url = f"{site}/api/approve?order={oid}&token={tok}&action=approve"
        reject_url = f"{site}/api/approve?order={oid}&token={tok}&action=reject"
        dashboard_url = f"{site}/admin"
        emailer.send_admin_review(order, digest_url, approve_url, reject_url,
                                  dashboard_url, interior_url=interior_url,
                                  cover_url=cover_url)
    except Exception as e:  # noqa: BLE001
        print(f"[{oid}] admin review email error (non-fatal): {e}")


def submit_approved(order):
    import lulu_client
    oid = order["id"]
    client = lulu_client.LuluClient(
        client_key="".join(os.environ["LULU_CLIENT_KEY"].split()),
        client_secret="".join(os.environ["LULU_CLIENT_SECRET"].split()),
        env=os.environ.get("LULU_ENV", "sandbox").strip())
    ship = order["shipping"]
    # Use the SAME per-order POD that QC validated (softcover or hardcover) —
    # read the order's cover_type, never a global default.
    cover_type = order.get("cover_type", "softcover") or "softcover"
    spec = spec_for(order["book_slug"], cover_type)
    # Title shown to Lulu — recipient name for photo books, child name otherwise.
    if order["book_slug"] in PHOTOBOOK_SLUGS:
        pd = order.get("photo_data") or {}
        who = (pd.get("recipient_name") or "").strip()
    else:
        who = order.get("child_name") or ""
    job = client.create_print_job(
        title=f"Ketabi {order['book_slug']} {who}".strip(),
        interior_url=signed_url("orders", order["interior_path"]),
        cover_url=signed_url("orders", order["cover_path"]),
        pod_package_id=spec["pod"], page_count=spec["page_count"],
        shipping_address=ship,
        # Owner may pin a faster level on the order (options.shipping_level);
        # anything unrecognized falls back to MAIL.
        shipping_level=((order.get("options") or {}).get("shipping_level")
                        if (order.get("options") or {}).get("shipping_level")
                        in ("MAIL", "GROUND", "EXPEDITED", "EXPRESS")
                        else "MAIL"),
        contact_email=order["customer_email"])
    set_status(oid, "submitted", lulu_print_job_id=str(job.get("id")))
    print(f"[{oid}] submitted to Lulu as job {job.get('id')}")


def poll_shipping(order):
    """Check a submitted print job's status with Lulu. When it reports
    shipped, advance the order and email the customer with tracking."""
    import lulu_client
    oid = order["id"]
    job_id = order.get("lulu_print_job_id")
    if not job_id:
        return
    client = lulu_client.LuluClient(
        client_key="".join(os.environ["LULU_CLIENT_KEY"].split()),
        client_secret="".join(os.environ["LULU_CLIENT_SECRET"].split()),
        env=os.environ.get("LULU_ENV", "sandbox").strip())
    info = client.get_print_job_status(job_id)
    # Lulu returns {"name": "<STATUS>", ...}; statuses include
    # CREATED, ACCEPTED, IN_PRODUCTION, SHIPPED, REJECTED, CANCELED.
    name = (info or {}).get("name", "")
    if name == "IN_PRODUCTION" and order["status"] != "printing":
        set_status(oid, "printing")
        print(f"[{oid}] in production")
    elif name == "SHIPPED":
        # Tracking lives on the full print-job's line items (not the status
        # payload), so fetch the job and pull the first tracking URL/carrier.
        tracking_url = ""
        carrier = ""
        try:
            job = client.get_print_job(job_id)
            for li in (job or {}).get("line_items", []) or []:
                urls = li.get("tracking_urls") or []
                if urls and not tracking_url:
                    tracking_url = urls[0]
                if not tracking_url and li.get("tracking_id"):
                    tracking_url = str(li["tracking_id"])
                carrier = carrier or li.get("carrier_name", "") or ""
                if tracking_url:
                    break
        except Exception as e:  # noqa: BLE001
            print(f"[{oid}] tracking lookup error (non-fatal): {e}")
        set_status(oid, "shipped")
        try:
            emailer.send_shipped(order, tracking_url=tracking_url, carrier=carrier)
        except Exception as e:  # noqa: BLE001
            print(f"[{oid}] shipped email error (non-fatal): {e}")
        print(f"[{oid}] shipped")
    elif name in ("REJECTED", "CANCELED"):
        set_status(oid, "failed",
                   qc_report={"failure": f"Lulu job {name}"})
        print(f"[{oid}] Lulu job {name}")


def main():
    poll = int(os.environ.get("POLL_SECONDS", "30"))
    print("ketabi worker up;", os.environ.get("LULU_ENV", "sandbox"))
    # Email config check on boot — surfaces 'no emails' problems immediately.
    try:
        cfg = emailer.config_status()
        if cfg["resend_key_set"]:
            print(f"[email] OK — RESEND_API_KEY set; from={cfg['from']}; "
                  f"admin={cfg['admin']}")
        else:
            print("[email] DISABLED — RESEND_API_KEY is NOT set; no order "
                  "confirmation, approval, or shipping emails will send. "
                  f"(from={cfg['from']}, admin={cfg['admin']})")
        # Opt-in one-off test email at boot: set EMAIL_BOOT_TEST=1 once to
        # verify Resend + the verified sender, then remove it.
        if os.environ.get("EMAIL_BOOT_TEST", "").strip() in ("1", "true", "yes"):
            ok = emailer.send_test_email()
            print(f"[email] boot test email -> {'sent' if ok else 'FAILED'} "
                  f"(to {cfg['admin']})")
    except Exception as e:  # noqa: BLE001
        print(f"[email] startup check error: {e}")
    # One-time Prodigi connectivity check on boot (a quote — no order placed).
    try:
        from pipeline import prodigi_client
        pc = prodigi_client.check_connection()
        if pc.get("ok"):
            print(f"[prodigi] OK — key accepted (env={pc.get('env')})")
        else:
            print(f"[prodigi] NOT connected — {pc.get('reason')} "
                  f"(env={pc.get('env')})")
    except Exception as e:  # noqa: BLE001
        print(f"[prodigi] startup check error: {e}")
    while True:
        try:
            for order in db("GET", "orders?status=eq.pending&order=created_at"):
                try:
                    process(order)
                except qc.QCFailure as e:
                    set_status(order["id"], "failed",
                               qc_report={"failure": str(e)})
                    try:
                        emailer.send_admin_failed(order, str(e))
                    except Exception:  # noqa: BLE001
                        pass
                    print(f"[{order['id']}] QC FAIL: {e}")
                except Exception:
                    tb = traceback.format_exc()
                    set_status(order["id"], "failed",
                               qc_report={"failure": tb[-800:]})
                    try:
                        emailer.send_admin_failed(order, tb[-400:])
                    except Exception:  # noqa: BLE001
                        pass
                    traceback.print_exc()
            for order in db("GET", "orders?status=eq.approved&order=created_at"):
                try:
                    submit_approved(order)
                except Exception:
                    tb = traceback.format_exc()
                    set_status(order["id"], "failed",
                               qc_report={"failure": tb[-800:]})
                    try:
                        emailer.send_admin_failed(order, tb[-400:])
                    except Exception:  # noqa: BLE001
                        pass
                    traceback.print_exc()
            # Advance submitted/printing jobs toward shipped (+ email)
            for order in db(
                "GET",
                "orders?status=in.(submitted,printing)&order=created_at",
            ):
                try:
                    poll_shipping(order)
                except Exception:
                    traceback.print_exc()
            # ── greeting-card fulfillment (Prodigi) ──
            # Runs AFTER all book processing; each call is isolated so a card
            # error never breaks book fulfillment.
            try:
                cards_worker.tick_cards()
            except Exception:
                traceback.print_exc()
            try:
                cards_worker.poll_card_shipping()
            except Exception:
                traceback.print_exc()
        except Exception:
            traceback.print_exc()
        time.sleep(poll)


if __name__ == "__main__":
    main()
