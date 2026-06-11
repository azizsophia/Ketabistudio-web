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
    child_name = m.clean_child_name(child_name)
    img = fetch_base(f"cover__{skin}-{hair}-{style}.jpg")
    w, h = img.size  # 5100 x 2550

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
                  m.COVER_GOLD, front_left, front_right)
    centered_text(img, 312, "and Her Beautiful Hijab", desc_font,
                  m.COVER_GOLD, front_left, front_right)
    centered_text(img, 452, "by Ketabi Studio", bjola_byline,
                  m.COVER_GOLD, front_left, front_right)

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
    """Full book from bases: 25 pages + cover -> assemble_pdf (32pp)."""
    out = Path(out_dir)
    out.mkdir(parents=True, exist_ok=True)
    name = m.clean_child_name(child_name)
    pages = []
    for pg in range(1, 26):
        pages.append(generate_page_from_base(pg, name, skin, hair, style))
        print(f"  page {pg:02d} from base ok", flush=True)
    cover = generate_cover_from_base(name, skin, hair, style)
    interior_pdf, cover_pdf = m.assemble_pdf(pages, cover, out, name)
    return str(interior_pdf), str(cover_pdf)
