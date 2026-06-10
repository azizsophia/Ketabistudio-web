#!/usr/bin/env python3
"""
Ketabi Studio — Title Page Generator for "I Love My Hijab"
Produces (1) a personalized flattened title-page image for the print
pipeline, and (2) a layered, editable .psd for Photoshop.
"""
import math
import numpy as np
from PIL import Image, ImageDraw, ImageFont

FONT_CROC = "fonts/Crocodile Feet DEMO.otf"
FONT_BJOLA = "fonts/bjola.otf"

# Print specs (match interior pages)
CANVAS = 2550          # native PSD size
BLEED = 2625           # size with bleed
DPI = 300

# Brand palette
FOREST = (46, 74, 58)
CREAM = (246, 242, 236)
TEAL = (88, 180, 173)
GOLD = (201, 168, 76)
DEEP_GOLD = (168, 116, 38)     # richer amber-bronze, reads on cream
WARM_BROWN = (60, 42, 33)


def _sanitize(s):
    repl = {":": ",", ";": ",", "\u2014": "--", "\u2013": "-", "\u2026": "..."}
    for b, g in repl.items():
        s = s.replace(b, g)
    return s


def _bg_layer(size):
    """Soft vertical cream gradient background."""
    w = h = size
    arr = np.zeros((h, w, 3), dtype=np.float32)
    top = np.array([250, 247, 242], dtype=np.float32)     # lighter cream
    bot = np.array([240, 233, 222], dtype=np.float32)     # warmer cream
    for y in range(h):
        t = y / h
        arr[y, :, :] = top * (1 - t) + bot * t
    img = Image.fromarray(arr.astype(np.uint8), "RGB").convert("RGBA")
    return img


def _motif_layer(size):
    """Transparent layer with a gold crescent + small stars above title."""
    layer = Image.new("RGBA", (size, size), (0, 0, 0, 0))
    draw = ImageDraw.Draw(layer)
    cx = size // 2
    cy = int(size * 0.27)

    # Crescent: draw a filled gold circle, then knock out an offset circle
    r = int(size * 0.055)
    crescent = Image.new("RGBA", (size, size), (0, 0, 0, 0))
    cd = ImageDraw.Draw(crescent)
    cd.ellipse([cx - r, cy - r, cx + r, cy + r], fill=GOLD + (255,))
    # knock-out circle (offset right)
    off = int(r * 0.55)
    cd.ellipse([cx - r + off, cy - r - int(r*0.15),
                cx + r + off, cy + r - int(r*0.15)], fill=(0, 0, 0, 0))
    layer = Image.alpha_composite(layer, crescent)
    draw = ImageDraw.Draw(layer)

    # A few small sparkle stars around the crescent
    def star(dx, dy, s):
        x0, y0 = cx + dx, cy + dy
        pts = []
        for i in range(8):
            ang = math.pi / 4 * i
            rad = s if i % 2 == 0 else s * 0.4
            pts.append((x0 + rad * math.cos(ang), y0 + rad * math.sin(ang)))
        draw.polygon(pts, fill=TEAL + (255,))

    star(int(size*0.075), -int(size*0.02), int(size*0.013))
    star(int(size*0.095), int(size*0.03), int(size*0.009))
    star(-int(size*0.085), int(size*0.01), int(size*0.011))

    return layer


def _divider_layer(size, y_frac):
    """Transparent layer with a delicate gold center divider flourish."""
    layer = Image.new("RGBA", (size, size), (0, 0, 0, 0))
    draw = ImageDraw.Draw(layer)
    cx = size // 2
    y = int(size * y_frac)
    half = int(size * 0.16)
    # thin line
    draw.line([(cx - half, y), (cx + half, y)], fill=GOLD + (255,), width=4)
    # center diamond
    d = 14
    draw.polygon([(cx, y - d), (cx + d, y), (cx, y + d), (cx - d, y)],
                 fill=GOLD + (255,))
    # end dots
    draw.ellipse([cx - half - 8, y - 8, cx - half + 8, y + 8], fill=GOLD + (255,))
    draw.ellipse([cx + half - 8, y - 8, cx + half + 8, y + 8], fill=GOLD + (255,))
    return layer


def _text_layer(size, text, font_path, font_size, color, y_center,
                tracking=0):
    """Transparent layer with horizontally-centered text."""
    text = _sanitize(text)
    layer = Image.new("RGBA", (size, size), (0, 0, 0, 0))
    draw = ImageDraw.Draw(layer)
    font = ImageFont.truetype(font_path, font_size)

    if tracking == 0:
        bb = font.getbbox(text)
        tw = bb[2] - bb[0]
        x = (size - tw) // 2
        draw.text((x, y_center - (bb[3] - bb[1]) // 2 - bb[1]),
                  text, fill=color + (255,), font=font)
    else:
        # letter-spaced rendering
        widths = []
        for ch in text:
            bb = font.getbbox(ch)
            widths.append((bb[2] - bb[0]) + tracking)
        total = sum(widths) - tracking
        x = (size - total) // 2
        ref = font.getbbox("Ay")
        for ch, wch in zip(text, widths):
            bb = font.getbbox(ch)
            draw.text((x, y_center - (ref[3] - ref[1]) // 2 - ref[1]),
                      ch, fill=color + (255,), font=font)
            x += wch
    return layer


def build_title_page(child_name, save_psd_path=None, save_img_path=None,
                     add_bleed=True):
    """Compose the title page. Returns the flattened PIL image (RGB)."""
    size = CANVAS

    # Build layers — "(Name)" leads, "and Her Beautiful Hijab" below
    bg = _bg_layer(size)
    motif = _motif_layer(size)
    # Name auto-shrinks if long
    name_size = int(size * 0.085)
    test_font = ImageFont.truetype(FONT_BJOLA, name_size)
    while test_font.getbbox(child_name)[2] > size * 0.8 and name_size > int(size * 0.05):
        name_size -= 6
        test_font = ImageFont.truetype(FONT_BJOLA, name_size)
    title = _text_layer(size, child_name, FONT_BJOLA,
                        name_size, FOREST, int(size * 0.42))
    subtitle = _text_layer(size, "and Her Beautiful Hijab", FONT_BJOLA,
                          int(size * 0.044), GOLD, int(size * 0.50))
    divider = _divider_layer(size, 0.585)
    studio = _text_layer(size, "Ketabi Studio", FONT_BJOLA,
                        int(size * 0.032), WARM_BROWN, int(size * 0.88),
                        tracking=6)

    # Composite for flattened output
    flat = bg.copy()
    for ly in [motif, title, subtitle, divider, studio]:
        flat = Image.alpha_composite(flat, ly)
    flat_rgb = flat.convert("RGB")

    # Add bleed if requested (pad to 2625 by edge extension)
    if add_bleed:
        flat_rgb = _add_bleed(flat_rgb, BLEED)

    if save_img_path:
        flat_rgb.save(save_img_path, "JPEG", quality=95, dpi=(DPI, DPI))

    # Build layered PSD
    if save_psd_path:
        _write_psd(save_psd_path, size, {
            "Background": bg,
            "Crescent & Stars": motif,
            "Name": title,
            "Title line": subtitle,
            "Divider": divider,
            "Studio": studio,
        })

    return flat_rgb


def _add_bleed(img, target):
    src_w, src_h = img.size
    if src_w == target and src_h == target:
        return img
    result = Image.new("RGB", (target, target), CREAM)
    ox, oy = (target - src_w) // 2, (target - src_h) // 2
    result.paste(img, (ox, oy))
    if oy > 0:
        result.paste(img.crop((0, 0, src_w, 1)).resize((src_w, oy)), (ox, 0))
        result.paste(img.crop((0, src_h - 1, src_w, src_h)).resize((src_w, oy)),
                     (ox, oy + src_h))
    if ox > 0:
        left = result.crop((ox, 0, ox + 1, target)).resize((ox, target))
        result.paste(left, (0, 0))
        right = result.crop((ox + src_w - 1, 0, ox + src_w, target)).resize((ox, target))
        result.paste(right, (ox + src_w, 0))
    return result


def _write_psd(path, size, layers_dict):
    """Write a layered PSD using pytoshop. Layers are raster RGBA."""
    import pytoshop
    from pytoshop.user import nested_layers
    from pytoshop.enums import ColorMode, Compression

    layers = []
    # pytoshop stacks layers with first = top; we pass top-to-bottom
    order = ["Studio", "Divider", "Title line", "Name",
             "Crescent & Stars", "Background"]
    for name in order:
        img = layers_dict[name].convert("RGBA")
        arr = np.array(img)
        r = arr[:, :, 0].astype(np.uint8)
        g = arr[:, :, 1].astype(np.uint8)
        b = arr[:, :, 2].astype(np.uint8)
        a = arr[:, :, 3].astype(np.uint8)
        layer = nested_layers.Image(
            name=name,
            visible=True,
            opacity=255,
            channels={0: r, 1: g, 2: b, -1: a},
        )
        layers.append(layer)

    psd = nested_layers.nested_layers_to_psd(
        layers, color_mode=ColorMode.rgb, compression=Compression.raw,
    )
    with open(path, "wb") as f:
        psd.write(f)


if __name__ == "__main__":
    import sys
    name = sys.argv[1] if len(sys.argv) > 1 else "Amira"
    img = build_title_page(
        name,
        save_psd_path="output/TitlePage.psd",
        save_img_path="output/title_page_preview.jpg",
        add_bleed=False,
    )
    print(f"Title page built for {name}: {img.size}")
