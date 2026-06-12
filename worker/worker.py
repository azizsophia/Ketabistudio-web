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

SB = "".join(os.environ["SUPABASE_URL"].split()).rstrip("/")
KEY = "".join(os.environ["SUPABASE_SERVICE_KEY"].split())
HDRS = {"Authorization": f"Bearer {KEY}", "apikey": KEY,
        "Content-Type": "application/json"}
POD = "0850X0850.FC.PRE.PB.080CW444.MXX"

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
    "juha-and-the-enormous-pumpkin": {"page_count": 32, "pod": POD},
    "maryam-is-kind-to-her-parents": {"page_count": 32, "pod": POD},
}


def spec_for(slug):
    return BOOK_SPECS.get(slug, DEFAULT_SPEC)


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
def generate_amira(order, workdir: Path):
    """Runs the exact validated pipeline. Returns (interior_pdf, cover_pdf)."""
    from generate_from_bases import build_from_bases

    name = order["child_name"].strip()
    qc.gate_name(name)

    return build_from_bases(
        name, order["skin"], order["hair"], order["hair_style"], workdir)


# ── per-order processing ────────────────────────────────────────────
def process(order):
    import lulu_client
    oid = order["id"]
    slug = order["book_slug"]
    workdir = Path(f"/tmp/order-{oid}")
    workdir.mkdir(exist_ok=True)
    set_status(oid, "generating")

    if slug in FIXED_ASSETS:
        ipath, cpath = FIXED_ASSETS[slug]
        interior = workdir / "interior.pdf"
        cover = workdir / "cover.pdf"
        interior.write_bytes(storage_download("book-assets", ipath))
        cover.write_bytes(storage_download("book-assets", cpath))
        interior, cover = str(interior), str(cover)
        ref_report = {"fixed_book": True}
    else:
        interior, cover = generate_amira(order, workdir)
        ref_report = qc.gate_reference(
            interior, order["skin"], order["hair"], order["hair_style"])

    spec = spec_for(slug)
    spec_report = qc.gate_spec(interior, cover, expected_pages=spec["page_count"])
    set_status(oid, "qc_passed",
               qc_report={"spec": spec_report, "reference": ref_report})

    # upload artifacts
    ikey = storage_upload("orders", f"{oid}/interior.pdf",
                          Path(interior).read_bytes(), "application/pdf")
    ckey = storage_upload("orders", f"{oid}/cover.pdf",
                          Path(cover).read_bytes(), "application/pdf")
    digest = qc.build_digest(interior, cover, order)
    storage_upload("orders", f"{oid}/digest.jpg", digest, "image/jpeg")

    # Lulu validation on signed URLs
    client = lulu_client.LuluClient(
        client_key="".join(os.environ["LULU_CLIENT_KEY"].split()),
        client_secret="".join(os.environ["LULU_CLIENT_SECRET"].split()),
        env=os.environ.get("LULU_ENV", "sandbox").strip())
    lulu_report = qc.gate_lulu(client, signed_url("orders", ikey),
                               signed_url("orders", ckey), spec["pod"])
    set_status(oid, "validated",
               interior_path=ikey, cover_path=ckey,
               qc_report={"spec": spec_report, "reference": ref_report,
                          "lulu": lulu_report})

    set_status(oid, "awaiting_approval")
    print(f"[{oid}] awaiting approval — digest at orders/{oid}/digest.jpg")


def submit_approved(order):
    import lulu_client
    oid = order["id"]
    client = lulu_client.LuluClient(
        client_key="".join(os.environ["LULU_CLIENT_KEY"].split()),
        client_secret="".join(os.environ["LULU_CLIENT_SECRET"].split()),
        env=os.environ.get("LULU_ENV", "sandbox").strip())
    ship = order["shipping"]
    spec = spec_for(order["book_slug"])
    job = client.create_print_job(
        title=f"Ketabi {order['book_slug']} {order.get('child_name') or ''}".strip(),
        interior_url=signed_url("orders", order["interior_path"]),
        cover_url=signed_url("orders", order["cover_path"]),
        pod_package_id=spec["pod"], page_count=spec["page_count"],
        shipping_address=ship, shipping_level="MAIL",
        contact_email=order["customer_email"])
    set_status(oid, "submitted", lulu_print_job_id=str(job.get("id")))
    print(f"[{oid}] submitted to Lulu as job {job.get('id')}")


def main():
    poll = int(os.environ.get("POLL_SECONDS", "30"))
    print("ketabi worker up;", os.environ.get("LULU_ENV", "sandbox"))
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
        except Exception:
            traceback.print_exc()
        time.sleep(poll)


if __name__ == "__main__":
    main()
