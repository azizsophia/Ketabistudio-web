"""
Transactional email for Ketabi Studio via Resend.

Env:
  RESEND_API_KEY   Resend API key (re_...)
  EMAIL_FROM       verified sender, e.g. "Ketabi Studio <orders@ketabistudio.com>"

If RESEND_API_KEY is unset, send_email is a no-op that logs and returns
False, so the worker never crashes for a missing email config.
"""
import os
import html
import requests

RESEND_API_KEY = "".join(os.environ.get("RESEND_API_KEY", "").split())
EMAIL_FROM = os.environ.get(
    "EMAIL_FROM", "Ketabi Studio <orders@ketabistudio.com>"
).strip()
# Where owner approval requests go. Falls back to the studio inbox.
ADMIN_EMAIL = os.environ.get("ADMIN_EMAIL", "ketabistudio@gmail.com").strip()

FOREST = "#2E4A3A"
CREAM = "#F6F4EF"
GOLD = "#C9A84C"


def _shell(inner_html: str) -> str:
    """Wrap content in the branded email shell."""
    return f"""\
<!doctype html>
<html>
  <head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"></head>
  <body style="margin:0;padding:0;background:{CREAM};
               font-family:-apple-system,Segoe UI,Roboto,Helvetica,Arial,sans-serif;
               color:#2b2723;">
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0"
           style="background:{CREAM};padding:32px 16px;">
      <tr><td align="center">
        <table role="presentation" width="100%" cellpadding="0" cellspacing="0"
               style="max-width:520px;background:#ffffff;border-radius:18px;
                      overflow:hidden;border:1px solid #e7e2d8;">
          <tr><td style="background:{FOREST};padding:24px 28px;">
            <span style="color:{CREAM};font-size:20px;font-weight:700;
                         letter-spacing:0.02em;">Ketabi Studio</span>
          </td></tr>
          <tr><td style="padding:32px 28px;">
            {inner_html}
          </td></tr>
          <tr><td style="padding:20px 28px;border-top:1px solid #efeae0;
                         color:#8a847a;font-size:12px;line-height:1.6;">
            Ketabi Studio · Stories that help little hearts grow<br>
            Questions? Just reply to this email.
          </td></tr>
        </table>
      </td></tr>
    </table>
  </body>
</html>"""


def send_email(to: str, subject: str, html_body: str) -> bool:
    if not RESEND_API_KEY:
        print(f"[email] RESEND_API_KEY unset; skipping email to {to}")
        return False
    try:
        r = requests.post(
            "https://api.resend.com/emails",
            headers={
                "Authorization": f"Bearer {RESEND_API_KEY}",
                "Content-Type": "application/json",
            },
            json={
                "from": EMAIL_FROM,
                "to": [to],
                "subject": subject,
                "html": html_body,
            },
            timeout=20,
        )
        if r.status_code in (200, 201):
            return True
        print(f"[email] send failed {r.status_code}: {r.text[:300]}")
        return False
    except Exception as e:  # noqa: BLE001
        print(f"[email] send error: {e}")
        return False


def _book_label(order: dict) -> str:
    slug = order.get("book_slug", "")
    child = (order.get("child_name") or "").strip()
    if slug == "her-beautiful-hijab":
        return f"{child} and Her Beautiful Hijab" if child else "Her Beautiful Hijab"
    if slug == "my-beautiful-duas":
        return f"{child}'s Beautiful Duas" if child else "My Beautiful Duas"
    return {
        "juha-and-the-enormous-pumpkin": "Juha and the Enormous Pumpkin",
        "maryam-is-kind-to-her-parents": "Maryam is Kind to Her Parents",
    }.get(slug, "your Ketabi Studio book")


def send_order_confirmation(order: dict) -> bool:
    """Sent once payment is confirmed and the book enters production."""
    book = html.escape(_book_label(order))
    short = str(order.get("id", ""))[:8]
    inner = f"""\
<h1 style="margin:0 0 12px;font-size:22px;color:{FOREST};">Thank you for your order</h1>
<p style="margin:0 0 16px;font-size:15px;line-height:1.6;">
  We have received your order for <strong>{book}</strong> and payment is
  confirmed. Your book is being made now.
</p>
<p style="margin:0 0 16px;font-size:15px;line-height:1.6;">
  Every order is carefully reviewed and quality-checked before it goes to
  print, so your child&rsquo;s name, the artwork, and each page are just
  right. We will email you again the moment it ships.
</p>
<p style="margin:0;font-size:13px;color:#8a847a;">Order {short}</p>
"""
    return send_email(
        order["customer_email"],
        f"Your order is confirmed — {book}",
        _shell(inner),
    )


def send_shipped(order: dict, tracking_url: str = "", carrier: str = "") -> bool:
    """Sent when the print job reports shipped."""
    book = html.escape(_book_label(order))
    short = str(order.get("id", ""))[:8]
    track_block = ""
    if tracking_url:
        safe_url = html.escape(tracking_url, quote=True)
        carrier_txt = f" with {html.escape(carrier)}" if carrier else ""
        track_block = f"""\
<table role="presentation" cellpadding="0" cellspacing="0" style="margin:8px 0 20px;">
  <tr><td style="border-radius:12px;background:{FOREST};">
    <a href="{safe_url}" style="display:inline-block;padding:13px 26px;
       color:{CREAM};text-decoration:none;font-weight:700;font-size:14px;">
       Track your package{carrier_txt}</a>
  </td></tr>
</table>"""
    inner = f"""\
<h1 style="margin:0 0 12px;font-size:22px;color:{FOREST};">Your book is on its way</h1>
<p style="margin:0 0 16px;font-size:15px;line-height:1.6;">
  Good news — <strong>{book}</strong> has been printed and shipped.
</p>
{track_block}
<p style="margin:0 0 16px;font-size:15px;line-height:1.6;">
  We hope it brings joy to your family, insha&rsquo;Allah. If anything is
  not right when it arrives, just reply to this email and we will make it
  right.
</p>
<p style="margin:0;font-size:13px;color:#8a847a;">Order {short}</p>
"""
    return send_email(
        order["customer_email"],
        f"Your book has shipped — {book}",
        _shell(inner),
    )


def send_card_shipped(order: dict) -> bool:
    """Sent when a greeting-card order reports shipped from Prodigi."""
    ship = order.get("shipping") or {}
    recipient = html.escape((ship.get("name") or "your recipient").strip())
    short = str(order.get("id", ""))[:8]
    inner = f"""\
<h1 style="margin:0 0 12px;font-size:22px;color:{FOREST};">Your card is on its way</h1>
<p style="margin:0 0 16px;font-size:15px;line-height:1.6;">
  Good news — your personalised greeting card has been printed and posted
  directly to <strong>{recipient}</strong>, blind and white-label, with no
  Ketabi or printer branding. It simply arrives, beautifully, from you.
</p>
<p style="margin:0 0 16px;font-size:15px;line-height:1.6;">
  If anything is not right when it arrives, just reply to this email and we
  will make it right.
</p>
<p style="margin:0;font-size:13px;color:#8a847a;">Order {short}</p>
"""
    return send_email(
        order["customer_email"],
        "Your card has shipped",
        _shell(inner),
    )


def send_admin_review(order: dict, digest_url: str = "",
                      approve_url: str = "", reject_url: str = "",
                      dashboard_url: str = "") -> bool:
    """Notify the owner that an order is generated and awaiting approval, with
    the preview digest + one-tap approve/reject links + a dashboard link."""
    book = html.escape(_book_label(order))
    oid = str(order.get("id", ""))[:8]
    ship = order.get("shipping") or {}
    where = html.escape(
        ", ".join(p for p in [ship.get("city"), ship.get("country_code")] if p))
    cover = "hardcover" if order.get("cover_type") == "hardcover" else "softcover"
    digest_img = (
        f'<img src="{html.escape(digest_url, quote=True)}" alt="preview" '
        f'style="width:100%;border-radius:12px;border:1px solid #e7e2d8;margin:14px 0;">'
        if digest_url else "")
    dash_block = (
        f'<p style="margin:0 0 16px;font-size:14px;line-height:1.6;">'
        f'<a href="{html.escape(dashboard_url, quote=True)}" '
        f'style="color:{FOREST};font-weight:700;">Review &amp; manage in the admin dashboard &rarr;</a></p>'
        if dashboard_url else "")
    inner = f"""\
<h1 style="margin:0 0 6px;font-size:20px;color:{FOREST};">A book is ready to approve</h1>
<p style="margin:0 0 4px;font-size:15px;line-height:1.6;"><strong>{book}</strong> ({cover})</p>
<p style="margin:0 0 6px;font-size:13px;color:#8a847a;">Order {oid}{(' &middot; ' + where) if where else ''}</p>
{digest_img}
<p style="margin:0 0 16px;font-size:14px;line-height:1.6;color:#6f6a5f;">
  Check the name, look and pages above. Approve to send it to print, or reject to cancel.
</p>
<table role="presentation" cellpadding="0" cellspacing="0"><tr>
  <td style="padding-right:10px;">
    <a href="{html.escape(approve_url, quote=True)}"
       style="display:inline-block;background:{FOREST};color:{CREAM};text-decoration:none;
              padding:12px 26px;border-radius:10px;font-weight:700;">Approve &amp; print</a>
  </td>
  <td>
    <a href="{html.escape(reject_url, quote=True)}"
       style="display:inline-block;background:#ffffff;color:#b3503c;text-decoration:none;
              padding:12px 22px;border-radius:10px;font-weight:700;border:1px solid #e7c4bb;">Reject</a>
  </td>
</tr></table>
<p style="margin:16px 0 0;"></p>
{dash_block}
"""
    return send_email(ADMIN_EMAIL, f"Approve: {book} (order {oid})", _shell(inner))
