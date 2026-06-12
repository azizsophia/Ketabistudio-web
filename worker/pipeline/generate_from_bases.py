"""
PSD-FREE BOOK GENERATION (production path)

Consumes the pre-rendered art bases in Supabase book-assets/bases/ and adds
only the customer's text, using the exact same text-rendering, recoloring,
bleed, and assembly functions as the certified PSD pipeline. No PSDs needed.

Inputs use site keys: skin light|medium|dark, hair black|brown|blonde|red,
style long-straight|long-curly|short-straight|short-curly.
"""
import io
import json
import os
import time
from pathlib import Path

import requests
from PIL import Image, ImageDraw, ImageFont

import modesty_pipeline as m

SB = "".join(os.environ["SUPABASE_URL"].split()).rstrip("/")
KEY = "".join(os.environ["SUPABASE_SERVICE_KEY"].split())

LAYOUTS = json.load(open(Path(__file__).parent.parent / "text_layout.json"))

FULL_PAGES = set(range(1, 12))


def _retry(fn, tries=4):
    last = None
    for i in range(tries):
        try:
            r = fn()
            if getattr(r, "status_code", 200) >= 500:
                raise RuntimeError(f"HTTP {r.status_code}")
            return r
        except Exception as e:
            last = e
            time.sleep(5 * (i + 1))
    raise last


def fetch_base(name: str) -> Image.Image:
    r = _retry(lambda: requests.get(
        f"{SB}/storage/v1/object/book-assets/bases/{name}",
        headers={"Authorization": f"Bearer {KEY}"}, timeout=120))
    if r.status_code != 200:
        raise FileNotFoundError(f"base missing in storage: {name}")
    return Image.open(io.BytesIO(r.content)).convert("RGB")


def base_name(pg: int, skin: str, hair: str, style: str) -> str:
    if pg == 17:
        return "page17.jpg"
    if pg in FULL_PAGES:
        return f"page{pg:02d}__{skin}-{hair}-{style}.jpg"
    return f"page{pg:02d}__{skin}.jpg"


def generate_page_from_base(pg, child_name, skin, hair, style):
    """Mirror of m.generate_page, with the composite step replaced by the
    pre-rendered base. Same recolor -> text -> bleed chain, same functions."""
    child_name = m.clean_child_name(child_name)
    img = fetch_base(base_name(pg, skin, hair, style))

    if pg in m.MOM_PAGES and skin != "light":
        img = m.recolor_mom(img, skin)

    lay = LAYOUTS.get(str(pg))
    if lay and pg in m.STORY:
        new_text = m.STORY[pg]
        text_color = (m.BODY_LIGHT if pg in m.LIGHT_TEXT_PAGES else m.BODY_DARK)
        new_info = {
            "bbox": tuple(lay["bbox"]),
            "text": new_text,
            "runs": [{
                "text": new_text,
                "font_name": lay["font_name"].strip("'\""),
                "font_size": lay["font_size"],
                "color": text_color,
            }],
            "justification": lay["justification"],
        }
        m.substitute_names(new_info, child_name)
        m.validate_no_placeholders(new_info["text"], page_label=f"page {pg}")
        m.render_text_on_image(img, new_info, page_num=pg)

    return m.add_bleed(img)


def generate_cover_from_base(child_name, skin, hair, style):
    """Mirror of m.generate_cover's text + wrap assembly, art from base."""
    import numpy as np
    child_name = m.clean_child_name(child_name)
    img = fetch_base(f"cover__{skin}-{hair}-{style}.jpg")
    w, h = img.size  # 5100 x 2550

    # ── Character presence guard ─────────────────────────────────────
    # The girl holds a forest-green book on every cover variant. If the
    # green-book pixels are missing, the base was rendered without the
    # character (e.g. a failed hairstyle layer toggle) — abort loudly
    # rather than ship a cover without the girl.
    guard = np.array(img)[1390:2435, 3590:4750, :].astype(np.int16)
    book_green = (
        (guard[:, :, 1] > guard[:, :, 0] + 20) &
        (guard[:, :, 1] > guard[:, :, 2] + 10) &
        (guard[:, :, 1] > 80) & (guard[:, :, 1] < 180)
    ).sum()
    if book_green < 20000:
        raise RuntimeError(
            f"cover base cover__{skin}-{hair}-{style}.jpg appears to be "
            f"missing the character (book pixels={book_green}); base must "
            f"be re-rendered before this look can be ordered"
        )
    # ── End guard ────────────────────────────────────────────────────

    # ── Blank baked-in PSD text (ADAPTIVE) ───────────────────────────
    # Older cover bases were rendered with text layers visible (a bug in
    # render_bases_ci that missed nested type layers), baking the template
    # title "(Child's Name)", "Embracing Modesty", and author credits into
    # the art. Newer bases (rendered after the fix) are clean.
    #
    # Blank ONLY if baked text is actually detected, so this never paints
    # flat rectangles over clean art on a correct base.
    arr = np.array(img)

    def _detect_baked_text(a):
        # Gold title text in the title band
        t = a[100:620, 2550 + 350:2550 + 2200, :].astype(np.int16)
        gold = (
            (np.abs(t[:, :, 0] - 216) < 40) &
            (np.abs(t[:, :, 1] - 138) < 40) &
            (np.abs(t[:, :, 2] - 43) < 40)
        ).sum()
        white = (
            (t[:, :, 0] > 245) & (t[:, :, 1] > 240) & (t[:, :, 2] > 240)
        ).sum()
        return gold > 1500 or white > 2500

    if _detect_baked_text(arr):
        # Title band: smooth gradient fill (white "Embracing Modesty"
        # y≈110-190 plus gold title y≈220-590)
        title_y1, title_y2 = 100, 620
        title_x1, title_x2 = 2550 + 350, 2550 + 2200
        for y in range(title_y1, title_y2):
            left_bg = arr[y, title_x1 - 50:title_x1 - 10, :].mean(axis=0)
            right_bg = arr[y, title_x2 + 10:title_x2 + 50, :].mean(axis=0)
            t = np.linspace(0, 1, title_x2 - title_x1).reshape(-1, 1)
            gradient = ((1 - t) * left_bg + t * right_bg).astype(np.uint8)
            arr[y, title_x1:title_x2, :] = gradient

        # Credits: two text blocks flanking the dress at bottom of front panel
        lx1, lx2 = 2550 + 180, 2550 + 860
        rx1, rx2 = 2550 + 2020, 2550 + 2535
        for y in range(2250, 2515):
            arr[y, lx1:lx2, :] = arr[y, lx1 - 35:lx1 - 5, :].mean(axis=0).astype(np.uint8)
            arr[y, rx1:rx2, :] = arr[y, rx2 + 5:min(rx2 + 35, w), :].mean(axis=0).astype(np.uint8)

        img = Image.fromarray(arr)
    # ── End text blanking ────────────────────────────────────────────

    COVER_GOLD = (216, 138, 43, 255)
    bjola_byline = ImageFont.truetype(m.FONT_BJOLA, 64)

    def centered_text(base_img, y, text, font, fill, x_left, x_right):
        d = ImageDraw.Draw(base_img)
        bb = d.textbbox((0, 0), text, font=font)
        tw = bb[2] - bb[0]
        x = x_left + (x_right - x_left - tw) // 2
        d.text((x, y), text, fill=fill, font=font)
        return base_img

    def fit_font(text, base_size, max_width, min_size=72, path=m.FONT_BJOLA):
        d = ImageDraw.Draw(img)
        size = base_size
        while size > min_size:
            f = ImageFont.truetype(path, size)
            bb = d.textbbox((0, 0), text, font=f)
            if (bb[2] - bb[0]) <= max_width:
                return f
            size -= 4
        return ImageFont.truetype(path, min_size)

    front_left, front_right = 2550, 5100
    panel_max_w = (front_right - front_left) - 220

    title_text = f"{child_name} and Her Beautiful Hijab"
    name_font = fit_font(child_name, 215, panel_max_w, min_size=120)
    desc_font = fit_font("and Her Beautiful Hijab", 108, panel_max_w, min_size=80)
    centered_text(img, 70, child_name, name_font,
                  COVER_GOLD, front_left, front_right)
    centered_text(img, 312, "and Her Beautiful Hijab", desc_font,
                  COVER_GOLD, front_left, front_right)
    centered_text(img, 452, "by Ketabi Studio", bjola_byline,
                  COVER_GOLD, front_left, front_right)

    draw = ImageDraw.Draw(img)
    blurb_text = (
        f"Some things make us feel brave. Some things make us "
        f"feel kind. For {child_name}, that something is her very "
        f"own hijab.\n\n"
        f"When Mama wraps it around her for the first time, "
        f"{child_name} discovers that a hijab is like a hug she "
        f"carries all day long, and a little crown that reminds her "
        f"to shine from the inside out.\n\n"
        f"A warm, joyful celebration of faith, family, and the "
        f"magic of being proudly, beautifully you."
    )
    m.validate_no_placeholders(blurb_text, page_label="back cover blurb")
    m.validate_no_placeholders(title_text, page_label="cover title")
    blurb_font = ImageFont.truetype(m.FONT_CROC, 58)
    blurb_box = (560, 600, 2080, 1950)
    m._draw_wrapped(draw, blurb_text, blurb_font, m.BODY_DARK, blurb_box,
                    line_spacing=1.35, align="center")

    BLEED_PX = 38
    SPINE_PX = 42
    trim_w = w // 2
    total_w = BLEED_PX + trim_w + SPINE_PX + trim_w + BLEED_PX
    total_h = BLEED_PX + h + BLEED_PX

    back = img.crop((0, 0, trim_w, h))
    front = img.crop((trim_w, 0, w, h))
    spine_color = img.getpixel((trim_w - 1, h // 2))

    cover = Image.new("RGB", (total_w, total_h), spine_color)
    x_spine = BLEED_PX + trim_w
    x_front = BLEED_PX + trim_w + SPINE_PX
    cover.paste(back, (BLEED_PX, BLEED_PX))
    cover.paste(Image.new("RGB", (SPINE_PX, h), spine_color),
                (x_spine, BLEED_PX))
    cover.paste(front, (x_front, BLEED_PX))

    top = cover.crop((0, BLEED_PX, total_w, BLEED_PX + 1)).resize((total_w, BLEED_PX))
    cover.paste(top, (0, 0))
    bot = cover.crop((0, BLEED_PX + h - 1, total_w, BLEED_PX + h)).resize((total_w, BLEED_PX))
    cover.paste(bot, (0, BLEED_PX + h))
    left = cover.crop((BLEED_PX, 0, BLEED_PX + 1, total_h)).resize((BLEED_PX, total_h))
    cover.paste(left, (0, 0))
    right = cover.crop((x_front + trim_w - 1, 0, x_front + trim_w, total_h)).resize((BLEED_PX, total_h))
    cover.paste(right, (x_front + trim_w, 0))
    return cover


def build_from_bases(child_name, skin, hair, style, out_dir):
    """Full book from bases, memory-lean: each page streamed to disk,
    PDF assembled from files. Identical output to the certified build."""
    import gc
    import title_page as tp
    import matter_pages as mp
    from reportlab.lib.units import inch
    from reportlab.pdfgen import canvas as rl_canvas

    out = Path(out_dir)
    out.mkdir(parents=True, exist_ok=True)
    name = m.clean_child_name(child_name)

    for pg in range(1, 26):
        img = generate_page_from_base(pg, name, skin, hair, style)
        img.save(out / f"page_{pg:02d}.jpg", "JPEG", quality=95, dpi=(300, 300))
        del img
        gc.collect()
        print(f"  page {pg:02d} ok", flush=True)

    tp.build_title_page(name, save_img_path=str(out / "m01.jpg"))
    mp.copyright_page(name).save(out / "m02.jpg", "JPEG", quality=95)
    mp.dedication_page(name).save(out / "m03.jpg", "JPEG", quality=95)
    mp.the_end_page().save(out / "m29.jpg", "JPEG", quality=95)
    mp.blessing_page().save(out / "m30.jpg", "JPEG", quality=95)
    mp.bookplate_page(name).save(out / "m31.jpg", "JPEG", quality=95)
    mp.studio_page().save(out / "m32.jpg", "JPEG", quality=95)
    gc.collect()

    def bleed(path, target=2625):
        img = Image.open(path).convert("RGB")
        if img.size == (target, target):
            return str(path)
        w, h = img.size
        o = Image.new("RGB", (target, target))
        off = (target - w) // 2
        o.paste(img, (off, off))
        o.paste(img.crop((0, 0, w, 1)).resize((w, off)), (off, 0))
        o.paste(img.crop((0, h - 1, w, h)).resize((w, off)), (off, off + h))
        o.paste(o.crop((off, 0, off + 1, target)).resize((off, target)), (0, 0))
        o.paste(o.crop((off + w - 1, 0, off + w, target)).resize((off, target)), (off + w, 0))
        p = str(path).replace(".jpg", "_b.jpg")
        o.save(p, "JPEG", quality=95, dpi=(300, 300))
        return p

    order = (["m01", "m02", "m03"]
             + [f"page_{n:02d}" for n in range(1, 26)]
             + ["m29", "m30", "m31", "m32"])
    files = [bleed(out / f"{k}.jpg") for k in order]

    pg_in = 8.75 * inch
    interior_pdf = out / "interior.pdf"
    cv = rl_canvas.Canvas(str(interior_pdf), pagesize=(pg_in, pg_in))
    for f in files:
        cv.drawImage(f, 0, 0, width=pg_in, height=pg_in)
        cv.showPage()
    cv.save()

    cover = generate_cover_from_base(name, skin, hair, style)
    cover_jpg = out / "cover_raw.jpg"
    cover.save(cover_jpg, "JPEG", quality=95, dpi=(300, 300))
    cw, ch = cover.size[0] / 300, cover.size[1] / 300
    del cover
    gc.collect()
    cover_pdf = out / "cover.pdf"
    cc = rl_canvas.Canvas(str(cover_pdf), pagesize=(cw * inch, ch * inch))
    cc.drawImage(str(cover_jpg), 0, 0, width=cw * inch, height=ch * inch)
    cc.showPage()
    cc.save()
    return str(interior_pdf), str(cover_pdf)
