#!/usr/bin/env python3
"""
Ketabi Studio — Lulu Print API client
======================================
Environment-configurable (sandbox vs production). Handles:
  - OpenID Connect authentication (client-credentials, token caching)
  - Print-job cost calculation (price + shipping quote, no order placed)
  - File validation (interior + cover)
  - Print-job creation + status tracking

Credentials are read from environment variables by default:
    LULU_CLIENT_KEY, LULU_CLIENT_SECRET, LULU_ENV ('sandbox' | 'production')
or passed explicitly to LuluClient(...).
"""
import os
import time
import base64
import requests

SANDBOX_BASE = "https://api.sandbox.lulu.com"
PRODUCTION_BASE = "https://api.lulu.com"

# Our book's POD package (8.5x8.5, full color, premium, perfect bound,
# 80# coated white, matte) — already in Lulu's new dotted format.
DEFAULT_POD_PACKAGE = "0850X0850.FC.PRE.PB.080CW444.MXX"

# ⚠️ CANDIDATE HARDCOVER POD — casewrap (CW) binding, same 8.5x8.5 trim,
# full color, premium, 80# coated white. This swaps the perfect-bound code
# (PB) for casewrap (CW). It MUST be confirmed by Lulu's validate-cover gate
# on the first real hardcover order — if Lulu rejects it, correct this single
# constant (and HARDCOVER_POD in worker.py / lib/pricing.ts to match).
HARDCOVER_POD = "0850X0850.FC.PRE.CW.080CW444.MXX"


class LuluError(Exception):
    pass


def pt_to_px(pt, dpi=300):
    """Convert PDF points to pixels at the given DPI (Lulu cover dims are pt)."""
    return int(round(float(pt) / 72.0 * dpi))


def cover_dims_to_px(dims, dpi=300):
    """Pull (width_px, height_px) out of a calculate_cover_dimensions() result.

    Lulu's /print-job-cover-dimensions/ response reports the required wrap
    width + height. Field names have varied across API versions, so accept the
    common spellings. Raises LuluError if neither pair is present.
    """
    w = dims.get("width") or dims.get("cover_width") or \
        (dims.get("dimensions") or {}).get("width")
    h = dims.get("height") or dims.get("cover_height") or \
        (dims.get("dimensions") or {}).get("height")
    if w is None or h is None:
        raise LuluError(f"cover dimensions missing width/height: {dims}")
    return pt_to_px(w, dpi), pt_to_px(h, dpi)


class LuluClient:
    def __init__(self, client_key=None, client_secret=None, env=None):
        self.client_key = client_key or os.environ.get("LULU_CLIENT_KEY")
        self.client_secret = client_secret or os.environ.get("LULU_CLIENT_SECRET")
        self.env = (env or os.environ.get("LULU_ENV", "sandbox")).lower()
        if not self.client_key or not self.client_secret:
            raise LuluError("Missing Lulu credentials.")
        self.base = SANDBOX_BASE if self.env == "sandbox" else PRODUCTION_BASE
        self.auth_url = (
            f"{self.base}/auth/realms/glasstree/protocol/openid-connect/token"
        )
        self._token = None
        self._token_expiry = 0

    # ── Authentication ──────────────────────────────────────────────
    def _get_token(self):
        if self._token and time.time() < self._token_expiry - 60:
            return self._token
        basic = base64.b64encode(
            f"{self.client_key}:{self.client_secret}".encode()
        ).decode()
        resp = requests.post(
            self.auth_url,
            headers={"Authorization": f"Basic {basic}",
                     "Content-Type": "application/x-www-form-urlencoded"},
            data={"grant_type": "client_credentials"},
            timeout=30,
        )
        if resp.status_code != 200:
            raise LuluError(f"Auth failed ({resp.status_code}): {resp.text[:300]}")
        tok = resp.json()
        self._token = tok["access_token"]
        self._token_expiry = time.time() + tok.get("expires_in", 3600)
        return self._token

    def _headers(self):
        return {
            "Authorization": f"Bearer {self._get_token()}",
            "Content-Type": "application/json",
            "Cache-Control": "no-cache",
        }

    # ── Cost calculation (no order placed) ──────────────────────────
    def calculate_cost(self, page_count, shipping_address, quantity=1,
                       pod_package_id=DEFAULT_POD_PACKAGE,
                       shipping_level="MAIL"):
        """Return Lulu's price breakdown (print + shipping + tax) for a job."""
        payload = {
            "line_items": [{
                "page_count": page_count,
                "pod_package_id": pod_package_id,
                "quantity": quantity,
            }],
            "shipping_address": shipping_address,
            "shipping_option": shipping_level,
        }
        resp = requests.post(
            f"{self.base}/print-job-cost-calculations/",
            headers=self._headers(), json=payload, timeout=60,
        )
        if resp.status_code not in (200, 201):
            raise LuluError(
                f"Cost calc failed ({resp.status_code}): {resp.text[:500]}"
            )
        return resp.json()

    # ── Cover dimensions (required wrap size for a given binding) ────
    def calculate_cover_dimensions(self, pod_package_id, page_count, unit="pt"):
        """Ask Lulu for the exact cover-wrap dimensions a given binding +
        page count requires. Casewrap (hardcover) wraps are physically larger
        than a perfect-bound paperback cover (extra wrap/turn-in + a real
        spine), so the cover MUST be generated at exactly these dimensions —
        never hardcoded.

        POSTs to /cover-dimensions/ with the package id and the
        interior page count. Returns Lulu's response, which contains the
        required width and height (Lulu reports these in points by default).
        Callers convert pt→px at 300 DPI: px = round(pt / 72 * 300).
        """
        payload = {
            "pod_package_id": pod_package_id,
            "interior_page_count": page_count,
            "unit": unit,
        }
        resp = requests.post(
            f"{self.base}/cover-dimensions/",
            headers=self._headers(), json=payload, timeout=60,
        )
        if resp.status_code not in (200, 201):
            raise LuluError(
                f"Cover dimensions failed ({resp.status_code}): {resp.text[:500]}"
            )
        return resp.json()

    # ── File validation ─────────────────────────────────────────────
    def validate_interior(self, interior_url, pod_package_id=DEFAULT_POD_PACKAGE):
        resp = requests.post(
            f"{self.base}/validate-interior/",
            headers=self._headers(),
            json={"source_url": interior_url, "pod_package_id": pod_package_id},
            timeout=60,
        )
        return resp.json(), resp.status_code

    def validate_cover(self, cover_url, interior_page_count,
                       pod_package_id=DEFAULT_POD_PACKAGE):
        resp = requests.post(
            f"{self.base}/validate-cover/",
            headers=self._headers(),
            json={"source_url": cover_url,
                  "pod_package_id": pod_package_id,
                  "interior_page_count": interior_page_count},
            timeout=60,
        )
        return resp.json(), resp.status_code

    # ── Print-job creation + status ─────────────────────────────────
    def create_print_job(self, title, cover_url, interior_url,
                         shipping_address, contact_email,
                         pod_package_id=DEFAULT_POD_PACKAGE, page_count=None,
                         quantity=1, shipping_level="MAIL", external_id=None):
        """Create a print job. Builds Lulu's required nested line-item
        structure (cover/interior as objects with source_url). page_count is
        required by Lulu for the line item."""
        line_item = {
            "title": title,
            "cover": {"source_url": cover_url},
            "interior": {"source_url": interior_url},
            "pod_package_id": pod_package_id,
            "quantity": quantity,
        }
        if page_count is not None:
            line_item["page_count"] = page_count
        payload = {
            "contact_email": contact_email,
            "line_items": [line_item],
            "shipping_address": shipping_address,
            "shipping_level": shipping_level,
        }
        if external_id:
            payload["external_id"] = external_id
        resp = requests.post(
            f"{self.base}/print-jobs/",
            headers=self._headers(), json=payload, timeout=60,
        )
        if resp.status_code not in (200, 201):
            raise LuluError(
                f"Print job failed ({resp.status_code}): {resp.text[:500]}"
            )
        return resp.json()

    def get_print_job(self, job_id):
        resp = requests.get(
            f"{self.base}/print-jobs/{job_id}/",
            headers=self._headers(), timeout=30,
        )
        return resp.json()

    def get_print_job_status(self, job_id):
        resp = requests.get(
            f"{self.base}/print-jobs/{job_id}/status/",
            headers=self._headers(), timeout=30,
        )
        return resp.json()


if __name__ == "__main__":
    # Smoke test: provide creds via env vars, never hardcode.
    import json
    client = LuluClient(
        client_key="".join(os.environ.get("LULU_CLIENT_KEY", "").split()),
        client_secret="".join(os.environ.get("LULU_CLIENT_SECRET", "").split()),
        env=os.environ.get("LULU_ENV", "sandbox").strip(),
    )
    print("Token acquired:", bool(client._get_token()))
