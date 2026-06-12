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


class LuluError(Exception):
    pass


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
                         pod_package_id=DEFAULT_POD_PACKAGE, quantity=1,
                         shipping_level="MAIL", external_id=None):
        """Create a print job. Builds Lulu's required nested line-item
        structure (cover/interior as objects with source_url)."""
        line_item = {
            "title": title,
            "cover": {"source_url": cover_url},
            "interior": {"source_url": interior_url},
            "pod_package_id": pod_package_id,
            "quantity": quantity,
        }
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
