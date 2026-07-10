#!/usr/bin/env python3
# Etsy listing gallery graphics for the journal, rebuilt to match the FINAL
# book (68 pages, roomy writing lines) so nothing on the listing over-states
# the product. House style: ivory ground, gold small-caps header, italic
# caption. 2000x2000 (Etsy square). Run: build_journal_gallery.py <pages> <out>
import os, sys
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import numpy as np
from PIL import Image, ImageDraw, ImageFont, ImageFilter
import gen_journal as J

SRC = sys.argv[1] if len(sys.argv) > 1 else "/tmp/journal5"
OUT = sys.argv[2] if len(sys.argv) > 2 else "/tmp/journal_gallery"
S = 2000
BG = (238, 232, 221)
INK, SOFT, GOLD, MARK = J.INK, J.SOFT, J.GOLD, J.MARK
PLAY, PLAY_IT = J.PLAY, J.PLAY_IT
p = lambda n: os.path.join(SRC, n)


def _bg():
    a = np.full((S, S, 3), BG, np.float32)
    yy, xx = np.mgrid[0:S, 0:S].astype(np.float32)
    a *= (1 - 0.06 * (((xx - .5 * S) / S) ** 2 + ((yy - .5 * S) / S) ** 2))[..., None]
    a += np.random.default_rng(5).normal(0, 2.0, (S, S, 1))
    return Image.fromarray(np.clip(a, 0, 255).astype("uint8")).convert("RGBA")


def _center(d, t, f, fill, y, ls=0):
    w = sum(d.textlength(c, font=f) + ls for c in t) - ls if ls else d.textlength(t, font=f)
    x = (S - w) / 2
    if ls:
        for c in t:
            d.text((x, y), c, font=f, fill=fill); x += d.textlength(c, font=f) + ls
    else:
        d.text((x, y), t, font=f, fill=fill)


def _card(path, w, angle=0):
    im = Image.open(path).convert("RGB")
    h = int(w * im.height / im.width)
    im = im.resize((w, h), Image.LANCZOS)
    c = Image.new("RGBA", (w, h), (0, 0, 0, 0)); c.paste(im, (0, 0))
    ImageDraw.Draw(c).rectangle([0, 0, w - 1, h - 1], outline=(206, 196, 176, 255), width=3)
    pad = 70
    big = Image.new("RGBA", (w + 2 * pad, h + 2 * pad), (0, 0, 0, 0))
    sh = Image.new("RGBA", big.size, (0, 0, 0, 0))
    ImageDraw.Draw(sh).rectangle([pad + 8, pad + 16, pad + w + 8, pad + h + 16], fill=(30, 24, 16, 95))
    big = Image.alpha_composite(big, sh.filter(ImageFilter.GaussianBlur(22)))
    big.alpha_composite(c, (pad, pad))
    return big.rotate(angle, expand=True, resample=Image.BICUBIC) if angle else big


def _header_caption(im, header, caption):
    d = ImageDraw.Draw(im)
    _center(d, header, ImageFont.truetype(PLAY, 46), GOLD, 96, ls=8)
    _center(d, caption, ImageFont.truetype(PLAY_IT, 46), SOFT, S - 150)


def look_inside(out):
    im = _bg()
    story = _card(p("p001a_story.png"), 700, -5)
    write = _card(p("p001b_write.png"), 700, 5)
    im.alpha_composite(story, (S // 2 - 700 + 40, 300))
    im.alpha_composite(write, (S // 2 - 60, 320))
    _header_caption(im, "A LOOK INSIDE", "one root, its story, and a page that is yours")
    im.convert("RGB").save(out, quality=94); return out


def room_to_write(out):
    im = _bg()
    card = _card(p("p001b_write.png"), 1040, 0)
    im.alpha_composite(card, ((S - card.width) // 2, 250))
    _header_caption(im, "ROOM TO WRITE", "generous lined space under every prompt")
    im.convert("RGB").save(out, quality=94); return out


def every_section(out):
    im = _bg()
    tiles = ["p000_title.png", "p001a_story.png", "p001b_write.png", "p004_glossary.png",
             "p008a_story.png", "p015a_story.png", "p900_tracker.png", "p999_certificate.png"]
    cols, cw, gap = 4, 380, 34
    gw = cols * cw + (cols - 1) * gap
    x0 = (S - gw) // 2; y0 = 250
    d = ImageDraw.Draw(im)
    for i, t in enumerate(tiles):
        r, c = divmod(i, cols)
        src = Image.open(p(t)).convert("RGB")
        ch = int(cw * src.height / src.width)
        src = src.resize((cw, ch), Image.LANCZOS)
        x, y = x0 + c * (cw + gap), y0 + r * (ch + gap + 20)
        im.paste(src, (x, y))
        ImageDraw.Draw(im).rectangle([x, y, x + cw - 1, y + ch - 1], outline=(206, 196, 176), width=2)
    _header_caption(im, "A LOOK AT EVERY SECTION",
                    "sixty-eight pages: thirty roots, a guide, glossary, tracker, sources, certificate")
    im.convert("RGB").save(out, quality=94); return out


def certificate_showcase(out):
    im = _bg()
    card = _card(p("p999_certificate.png"), 980, 0)
    im.alpha_composite(card, ((S - card.width) // 2, 250))
    _header_caption(im, "A CERTIFICATE AT THE END", "for the day you finish")
    im.convert("RGB").save(out, quality=94); return out


def whats_inside(out):
    im = _bg(); d = ImageDraw.Draw(im)
    f_ar = ImageFont.truetype(J.AMIRI, 150)
    ar = "من جذر واحد"
    bb = d.textbbox((0, 0), ar, font=f_ar)
    d.text(((S - (bb[2] - bb[0])) / 2 - bb[0], 300 - bb[1]), ar, font=f_ar, fill=GOLD)
    _center(d, "What's Inside", ImageFont.truetype(PLAY_IT, 96), INK, 560)
    lines = [
        "68 pages",
        "30 Arabic roots, one a day",
        "a story page and a writing page each",
        "a guide, a how-to, and a glossary",
        "a progress tracker and full sources",
        "a completion certificate",
        "US Letter PDF, instant download",
    ]
    f = ImageFont.truetype(PLAY, 52)
    y = 760
    for t in lines:
        _center(d, t, f, INK, y); y += 116
    _center(d, "every root verified · every source cited",
            ImageFont.truetype(PLAY_IT, 46), SOFT, S - 150)
    im.convert("RGB").save(out, quality=94); return out


if __name__ == "__main__":
    os.makedirs(OUT, exist_ok=True)
    look_inside(os.path.join(OUT, "g_look_inside.jpg"))
    room_to_write(os.path.join(OUT, "g_room_to_write.jpg"))
    every_section(os.path.join(OUT, "g_every_section.jpg"))
    certificate_showcase(os.path.join(OUT, "g_certificate.jpg"))
    whats_inside(os.path.join(OUT, "g_whats_inside.jpg"))
    print("gallery graphics:", OUT)
