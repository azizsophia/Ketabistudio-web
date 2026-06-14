#!/usr/bin/env python3
"""
Render engine for the personalized "My Beautiful Duas" book.

Given (name, character, look, eye_color) it pulls the text-free art from
Supabase (book-assets/duas-assets/<pack>/), overlays the new story text in the
original text positions, builds the front matter + Dua Treasure Chest + Star
Chart, and assembles a 32-page interior PDF (+ a front cover) at 8.5" square.

Structure (32 pp): title, belongs-to, 25 story pages, chest opener,
chest A (6 duas), chest B (6 duas), star chart, the end.

Env: SUPABASE_URL, SUPABASE_SERVICE_KEY
"""
import io
import math
import os
from pathlib import Path
from urllib.parse import quote

import requests
import arabic_reshaper
from bidi.algorithm import get_display
from PIL import Image, ImageDraw, ImageFont

ROOT = Path(__file__).resolve().parent
import json
BOOK = json.loads((ROOT / "duas_book.json").read_text(encoding="utf-8"))
FD = ROOT.parent / "fonts"
BJOLA, AMIRI, BODY = str(FD / "bjola.otf"), str(FD / "Amiri-Regular.ttf"), str(FD / "DejaVuSans.ttf")

SB = "".join(os.environ.get("SUPABASE_URL", "").split()).rstrip("/")
KEY = "".join(os.environ.get("SUPABASE_SERVICE_KEY", "").split())

TRIM = BOOK["trim_px"]                       # 2550
SPREAD_W, SPREAD_H = BOOK["spread_px"]
HALF = BOOK["half_split_x"]
CREAM = (250, 245, 236); CARD = (255, 252, 245); GOLD = (196, 142, 46)
DARK = (58, 50, 38); GRAY = (122, 112, 97); BORD = (231, 214, 182); ACCENT = (173, 120, 55)


def F(p, s):
    return ImageFont.truetype(p, s)


def reshape(t):
    return get_display(arabic_reshaper.reshape(t))


_art = {}
def fetch_art(pack, page, look):
    k = (pack, page, look)
    if k not in _art:
        path = quote(f"duas-assets/{pack}/{page} {look}.png")
        r = requests.get(f"{SB}/storage/v1/object/book-assets/{path}",
                         headers={"Authorization": f"Bearer {KEY}"}, timeout=300)
        r.raise_for_status()
        _art[k] = Image.open(io.BytesIO(r.content)).convert("RGB")
    return _art[k]


def subst(text, char, name, eye):
    for token, val in BOOK["pronouns"][char].items():
        text = text.replace(f"[{token}]", val)
    text = text.replace("[Child’s Name]", name).replace("[Child's Name]", name)
    return text.replace("[eye color]", eye)


def wrap(d, text, fo, mw):
    out, cur = [], ""
    for w in text.split():
        t = (cur + " " + w).strip()
        if d.textlength(t, font=fo) <= mw:
            cur = t
        else:
            if cur:
                out.append(cur)
            cur = w
    if cur:
        out.append(cur)
    return out


def fit(d, text, fontpath, bw, bh, start=78, minsz=26):
    s = start
    while s >= minsz:
        fo = F(fontpath, s); lines = wrap(d, text, fo, bw); lh = int(s * 1.42)
        if len(lines) * lh <= bh:
            return fo, lines, lh
        s -= 2
    fo = F(fontpath, minsz)
    return fo, wrap(d, text, fo, bw), int(minsz * 1.42)


def ctext(d, t, fo, cx, y, fill):
    d.text((cx - d.textlength(t, font=fo) / 2, y), t, font=fo, fill=fill)


def star(d, cx, cy, r, fill=None, outline=None, wd=3):
    pts = [(cx + (r if i % 2 == 0 else r * 0.42) * math.cos(math.pi / 2 + i * math.pi / 5),
            cy - (r if i % 2 == 0 else r * 0.42) * math.sin(math.pi / 2 + i * math.pi / 5)) for i in range(10)]
    if fill:
        d.polygon(pts, fill=fill)
    if outline:
        d.line(pts + [pts[0]], fill=outline, width=wd)


def lerp(a, b, t):
    return tuple(int(a[i] + (b[i] - a[i]) * t) for i in range(3))


# ── page renderers ──────────────────────────────────────────────────
def blank():
    img = Image.new("RGB", (TRIM, TRIM), CREAM)
    return img, ImageDraw.Draw(img)


def story_page(entry, ctx):
    page, half = entry
    char = ctx["char"]; pack = BOOK["asset_packs"][char]
    fpage = BOOK.get("page_aliases", {}).get(char, {}).get(page, page)
    art = fetch_art(pack, fpage, ctx["look"])
    single = page in BOOK.get("single_pages", [])
    if single:
        crop, off = art, 0
    elif half == "L":
        crop, off = art.crop((0, 0, HALF, SPREAD_H)), 0
    else:
        crop, off = art.crop((HALF, 0, art.width, SPREAD_H)), HALF
    scale = TRIM / crop.width
    newh = int(crop.height * scale)
    crop = crop.resize((TRIM, newh), Image.LANCZOS)
    img, d = blank()
    ytop = (TRIM - newh) // 2
    img.paste(crop, (0, ytop))
    for bx in BOOK["pages"][page]:
        x0, y0, x1, y1 = bx["bbox"]
        inhalf = single or ((x0 < HALF) if half == "L" else (x0 >= HALF))
        if not inhalf:
            continue
        lx0, ly0 = (x0 - off) * scale, y0 * scale + ytop
        bw, bh = (x1 - x0) * scale, (y1 - y0) * scale
        text = subst(bx["text"], char, ctx["name"], ctx["eye"])
        fo, lines, lh = fit(d, text, BODY, bw, bh)
        ty = ly0 + (bh - len(lines) * lh) / 2
        for ln in lines:
            ctext(d, ln, fo, lx0 + bw / 2, ty, DARK)
            ty += lh
    return img


def title_page(ctx):
    img, d = blank()
    d.rounded_rectangle([50, 50, TRIM - 50, TRIM - 50], radius=40, outline=GOLD, width=6)
    for cx, cy in [(130, 130), (TRIM - 130, 130), (130, TRIM - 130), (TRIM - 130, TRIM - 130)]:
        star(d, cx, cy, 24, GOLD)
    ctext(d, ctx["name"] + "'s", F(BJOLA, 190), TRIM // 2, 470, GOLD)
    ctext(d, "Beautiful Duas", F(BJOLA, 150), TRIM // 2, 690, GOLD)
    chest(d, TRIM // 2, 1120, 520)
    ctext(d, "Duas for every part of my day", F(BODY, 60), TRIM // 2, 1760, DARK)
    ctext(d, "by Ketabi Studio", F(BJOLA, 56), TRIM // 2, 2330, GRAY)
    return img


def belongs_page(ctx):
    img, d = blank()
    d.rounded_rectangle([50, 50, TRIM - 50, TRIM - 50], radius=40, outline=BORD, width=5)
    ctext(d, "This book belongs to", F(BODY, 70), TRIM // 2, 900, GRAY)
    ctext(d, ctx["name"], F(BJOLA, 170), TRIM // 2, 1050, GOLD)
    d.line([TRIM // 2 - 500, 1330, TRIM // 2 + 500, 1330], fill=BORD, width=3)
    ctext(d, "May your days always be filled", F(BODY, 50), TRIM // 2, 1560, DARK)
    ctext(d, "with the remembrance of Allah.", F(BODY, 50), TRIM // 2, 1630, DARK)
    return img


def end_page():
    img, d = blank()
    chest(d, TRIM // 2, 360, 380)
    ctext(d, "The End", F(BJOLA, 150), TRIM // 2, 1050, GOLD)
    ctext(d, "Grown-ups: scan the codes in the Treasure", F(BODY, 40), TRIM // 2, 1500, GRAY)
    ctext(d, "Chest to hear each dua read aloud together.", F(BODY, 40), TRIM // 2, 1560, GRAY)
    return img


def chest(d, cx, top, w):
    h = int(w * 0.5); x0, x1 = cx - w // 2, cx + w // 2; bt = top + int(h * 0.40)
    for k in range(6, 0, -1):
        rr = int(w * 0.52 * k / 6)
        d.ellipse([cx - rr, top + h // 2 - int(rr * 0.95), cx + rr, top + h // 2 + int(rr * 0.95)],
                  fill=lerp(CREAM, (252, 238, 200), 0.5 * k / 6))
    for sx, sy, r in [(cx - w * 0.46, top + 10, 16), (cx, top - 46, 22), (cx + w * 0.46, top + 6, 18)]:
        star(d, sx, sy, r, GOLD)
    for yy in range(bt, top + h):
        d.line([x0 + 8, yy, x1 - 8, yy], fill=lerp((150, 96, 50), (110, 66, 32), (yy - bt) / max(1, top + h - bt)))
    d.rounded_rectangle([x0, bt, x1, top + h], radius=24, outline=(92, 56, 28), width=6)
    lidtop = bt - int(h * 0.5)
    for yy in range(lidtop, bt):
        frac = (yy - lidtop) / max(1, bt - lidtop); half = int((1 - (1 - frac) ** 2) ** 0.5 * (w / 2 - 8))
        d.line([cx - half, yy, cx + half, yy], fill=lerp((150, 96, 50), (128, 80, 40), frac))
    d.rectangle([x0, bt - 6, x1, bt + 12], fill=GOLD)
    for bx in (x0 + int(w * 0.2), x1 - int(w * 0.2)):
        d.rectangle([bx - 9, lidtop + int(h * 0.12), bx + 9, top + h - 4], fill=GOLD)
    d.rounded_rectangle([cx - 28, bt + int(h * 0.16), cx + 28, bt + int(h * 0.16) + 76], radius=12, fill=GOLD)
    d.ellipse([cx - 12, bt + int(h * 0.16) + 22, cx + 12, bt + int(h * 0.16) + 46], fill=(92, 56, 28))


def chest_opener():
    img, d = blank()
    d.rounded_rectangle([50, 50, TRIM - 50, TRIM - 50], radius=40, outline=GOLD, width=6)
    ctext(d, "My Dua", F(BJOLA, 150), TRIM // 2, 250, GOLD)
    ctext(d, "Treasure Chest", F(BJOLA, 150), TRIM // 2, 420, GOLD)
    chest(d, TRIM // 2, 850, 560)
    ctext(d, "Every dua is a treasure.", F(BODY, 56), TRIM // 2, 1640, DARK)
    ctext(d, "Collect a star each time you say one!", F(BODY, 56), TRIM // 2, 1730, DARK)
    ctext(d, "Tip: scan a code to hear the dua read aloud.", F(BODY, 40), TRIM // 2, 1950, GRAY)
    return img


def _qr(data, size):
    import qrcode
    q = qrcode.QRCode(box_size=10, border=1); q.add_data(data); q.make()
    return q.make_image(fill_color=(80, 66, 46), back_color=CARD).convert("RGB").resize((size, size))


def chest_page(duas, title):
    img, d = blank()
    ctext(d, title, F(BJOLA, 70), TRIM // 2, 60, GOLD)
    M, gapx, gapy, top = 70, 40, 36, 220
    cw = (TRIM - 2 * M - gapx) // 2
    chh = (TRIM - top - M - 2 * gapy) // 3
    for i, (lab, ar, tr, en, src) in enumerate(duas):
        r, c = divmod(i, 2); x = M + c * (cw + gapx); y = top + r * (chh + gapy)
        d.rounded_rectangle([x, y, x + cw, y + chh], radius=22, fill=CARD, outline=BORD, width=3)
        cx = x + cw // 2; iw = cw - 230
        star(d, x + 44, y + 44, 18, GOLD)
        ctext(d, lab, F(BJOLA, 36), cx, y + 24, ACCENT)
        # arabic auto-fit
        s = 64; rsh = reshape(ar)
        while s > 30 and d.textlength(rsh, font=F(AMIRI, s)) > iw:
            s -= 2
        afo = F(AMIRI, s)
        ctext(d, rsh, afo, cx, y + 96, DARK)
        ctext(d, tr, F(BODY, 26), cx, y + 110 + afo.size + 18, GRAY)
        ey = y + 110 + afo.size + 58
        for ln in wrap(d, en, F(BODY, 27), iw):
            ctext(d, ln, F(BODY, 27), cx, ey, DARK); ey += 36
        ctext(d, f"({src})", F(BODY, 20), cx, y + chh - 38, (188, 178, 162))
        try:
            img.paste(_qr(f"https://ketabi.studio/duas/audio/{i}", 92), (x + cw - 118, y + chh - 118))
        except Exception:
            pass
    return img


def star_chart():
    img, d = blank()
    ctext(d, "My Dua Star Chart", F(BJOLA, 80), TRIM // 2, 70, GOLD)
    ctext(d, "Colour a star each time you remember your dua!", F(BODY, 38), TRIM // 2, 180, GRAY)
    labels = BOOK["star_chart_labels"]; days = ["S", "M", "T", "W", "T", "F", "S"]
    gridL, gridR = 760, TRIM - 90; colw = (gridR - gridL) // 7
    hdr, top = 300, 380; rh = (TRIM - top - 70) // len(labels)
    for j, dn in enumerate(days):
        ctext(d, dn, F(BJOLA, 38), gridL + j * colw + colw // 2, hdr, ACCENT)
    d.line([90, hdr + 60, TRIM - 70, hdr + 60], fill=BORD, width=2)
    for i, lab in enumerate(labels):
        y = top + i * rh
        d.text((100, y + rh // 2 - 22), lab, font=F(BODY, 32), fill=DARK)
        for j in range(7):
            star(d, gridL + j * colw + colw // 2, y + rh // 2, 26, fill=(245, 238, 222), outline=GOLD, wd=3)
        if i < len(labels) - 1:
            d.line([90, y + rh - 4, TRIM - 70, y + rh - 4], fill=BORD, width=2)
    return img


def front_cover(ctx):
    img, d = blank()
    ctext(d, ctx["name"] + "'s", F(BJOLA, 200), TRIM // 2, 230, GOLD)
    ctext(d, "Beautiful Duas", F(BJOLA, 150), TRIM // 2, 470, GOLD)
    # hero: the "good morning" child from page 1 right half
    try:
        art = fetch_art(BOOK["asset_packs"][ctx["char"]],
                        BOOK.get("page_aliases", {}).get(ctx["char"], {}).get("page0001", "page0001"),
                        ctx["look"])
        hero = art.crop((HALF, 0, art.width, SPREAD_H))
        sc = 1700 / hero.width; hero = hero.resize((1700, int(hero.height * sc)), Image.LANCZOS)
        img.paste(hero, ((TRIM - hero.width) // 2, 760))
    except Exception:
        chest(d, TRIM // 2, 1100, 560)
    ctext(d, "by Ketabi Studio", F(BJOLA, 56), TRIM // 2, TRIM - 230, GRAY)
    return img


def build(name, char, look, eye, out_dir):
    out = Path(out_dir); out.mkdir(parents=True, exist_ok=True)
    ctx = {"name": name, "char": char, "look": look, "eye": eye}
    tc = BOOK["treasure_chest"]
    pages = [title_page(ctx), belongs_page(ctx)]
    pages += [story_page(e, ctx) for e in BOOK["reading_order"]]
    pages += [chest_opener(), chest_page(tc[:6], "My Daily Duas"),
              chest_page(tc[6:], "My Daily Duas"), star_chart(), end_page()]
    # previews + interior pdf
    for i, p in enumerate(pages):
        p.save(out / f"page{i+1:02d}.jpg", "JPEG", quality=88)
    interior = out / "interior.pdf"
    pages[0].save(interior, "PDF", save_all=True, append_images=pages[1:], resolution=300.0)
    cover = front_cover(ctx)
    cover.save(out / "cover.jpg", "JPEG", quality=90)
    cover.save(out / "cover.pdf", "PDF", resolution=300.0)
    print(f"built {len(pages)} interior pages", flush=True)
    return str(interior), str(out / "cover.pdf"), len(pages)


if __name__ == "__main__":
    import sys
    name = sys.argv[1] if len(sys.argv) > 1 else "Yusuf"
    char = sys.argv[2] if len(sys.argv) > 2 else "boy"
    look = sys.argv[3] if len(sys.argv) > 3 else "afro"
    eye = sys.argv[4] if len(sys.argv) > 4 else "brown"
    build(name, char, look, eye, "/tmp/duas_sample")
