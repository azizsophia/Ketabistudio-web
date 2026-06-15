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
    if slug == "her-beautiful-hijab" and child:
        return f"{child} and Her Beautiful Hijab"
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
  Every book is checked by hand before it goes to print, so each page is
  exactly right. We will email you again the moment it ships.
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
