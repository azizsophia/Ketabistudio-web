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

# Books that may be ordered in hardcover (personalized books + every photo-book
# keepsake). Fixed books keep pre-made softcover cover art and are never
# offered in hardcover.
HARDCOVER_SLUGS = {"her-beautiful-hijab", "my-beautiful-duas"} | PHOTOBOOK_SLUGS

SKIN_TO_PSD = {"light": "Blonde light", "medium": "Blonde dark", "dark": "Dark"}
HAIR_TO_PSD = {"black": "Black", "brown": "Brown", "blonde": "Blonde", "red": "Red"}
STYLE_TO_PSD = {"long-straight": "Long straight", "long-curly": "Long curly",
                "short-straight": "Short straight", "short-curly": "Short curly"}

FIXED_ASSETS = {
    "juha-and-the-enormous-pumpkin": ("juha/Juha_interior.pdf", "juha/Juha_cover.pdf"),
    "maryam-is-kind-to-her-parents": ("maryam/Maryam_interior.pdf", "maryam/Maryam_cover.pdf"),
}

# Per-book print spec. All three current books are 32-page 8.75" square
# softcover (POD 0850X0850...PB), verified against the production PDFs on
# 2026-06-11. page_count and pod must match what is sent to Lulu; a new
# book with a different length needs its own entry here.
DEFAULT_SPEC = {"page_count": 32, "pod": POD}
BOOK_SPECS = {
    "her-beautiful-hijab": {"page_count": 32, "pod": POD},
    "my-beautiful-duas": {"page_count": 32, "pod": POD},
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


def storage_upload(bucket, path, data: bytes, ctype):
    r = requests.post(f"{SB}/storage/v1/object/{bucket}/{path}",
                      headers={"Authorization": f"Bearer {KEY}",
                               "Content-Type": ctype,
                               "x-upsert": "true"},
                      data=data, timeout=300)
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


# ── per-order processing ────────────────────────────────────────────
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
    elif slug in PHOTOBOOK_SLUGS:
        # Customer photo-book keepsake — built from uploaded photos + captions.
        interior, cover = generate_photobook(order, workdir,
                                             cover_type=cover_type,
                                             client=client)
        ref_report = {"photo_book": True, "template": slug,
                      "cover_type": cover_type}
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

    spec_report = qc.gate_spec(interior, cover, expected_pages=spec["page_count"],
                               cover_type=cover_type)
    set_status(oid, "qc_passed",
               qc_report={"spec": spec_report, "reference": ref_report})

    # upload artifacts
    ikey = storage_upload("orders", f"{oid}/interior.pdf",
                          Path(interior).read_bytes(), "application/pdf")
    ckey = storage_upload("orders", f"{oid}/cover.pdf",
                          Path(cover).read_bytes(), "application/pdf")
    digest = qc.build_digest(interior, cover, order)
    storage_upload("orders", f"{oid}/digest.jpg", digest, "image/jpeg")

    # Lulu validation on signed URLs — validates the cover against THIS order's
    # POD (softcover or hardcover), so a wrong hardcover cover fails QC and the
    # order halts before printing.
    lulu_report = qc.gate_lulu(client, signed_url("orders", ikey),
                               signed_url("orders", ckey), spec["pod"])
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
        approve_url = f"{site}/api/approve?order={oid}&token={tok}&action=approve"
        reject_url = f"{site}/api/approve?order={oid}&token={tok}&action=reject"
        dashboard_url = f"{site}/admin"
        emailer.send_admin_review(order, digest_url, approve_url, reject_url,
                                  dashboard_url)
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
        shipping_address=ship, shipping_level="MAIL",
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
        # Pull tracking if Lulu exposes it on the status payload
        tracking_url = ""
        carrier = ""
        msg = (info or {}).get("messages") or {}
        if isinstance(msg, dict):
            tracking_url = msg.get("tracking_url") or msg.get("tracking_id") or ""
            carrier = msg.get("carrier_name", "") or ""
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
                    print(f"[{order['id']}] QC FAIL: {e}")
                except Exception:
                    set_status(order["id"], "failed",
                               qc_report={"failure": traceback.format_exc()[-800:]})
                    traceback.print_exc()
            for order in db("GET", "orders?status=eq.approved&order=created_at"):
                try:
                    submit_approved(order)
                except Exception:
                    set_status(order["id"], "failed",
                               qc_report={"failure": traceback.format_exc()[-800:]})
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
