#!/usr/bin/env python3
# Launch deliverables for the name-print product:
#   - make_howitworks_pdf(): the small branded PDF Etsy auto-delivers on purchase
#     (real custom files are sent per order). Clean metadata: no AI/claude/tool
#     names anywhere in the file or its metadata.
#   - make_frame_mockup(): drops a rendered print into a matted frame on a soft
#     wall — the listing hero photo. Brand-controlled so every mockup matches.
#   - make_print_files(): per-order print-ready PDF (5x7 / 8x10 / A4) + framing PNG.
import os, numpy as np
from PIL import Image, ImageDraw, ImageFont, JpegImagePlugin
Image.init()

FONTS = os.path.join(os.path.dirname(os.path.abspath(__file__)), "..", "..", "worker", "fonts")
PLAY    = os.path.join(FONTS, "PlayfairDisplay.ttf")
PLAY_IT = os.path.join(FONTS, "PlayfairDisplay-Italic.ttf")

BG   = (240, 234, 223)
INK  = (42, 60, 52)
SOFT = (112, 120, 108)
GOLD = (176, 140, 66)
MARK = (150, 132, 96)

# ---------------------------------------------------------------- how-it-works
def _wrap(d, text, font, maxw):
    out, cur = [], ""
    for w in text.split():
        t = (cur + " " + w).strip()
        if d.textlength(t, font=font) <= maxw:
            cur = t
        else:
            out.append(cur); cur = w
    if cur:
        out.append(cur)
    return out

def make_howitworks_pdf(out_path, product="name print"):
    W, H = 1275, 1650  # ~8.5x11 at 150dpi
    im = Image.new("RGB", (W, H), BG)
    a = np.asarray(im).astype(np.float32)
    yy, xx = np.mgrid[0:H, 0:W].astype(np.float32)
    dd = ((xx - .5 * W) / (.72 * W)) ** 2 + ((yy - .44 * H) / (.60 * H)) ** 2
    a = a * np.clip(1 - 0.08 * np.clip(dd, 0, 1), 0.92, 1)[..., None]
    a += np.random.default_rng(3).normal(0, 2.6, (H, W, 1))
    im = Image.fromarray(np.clip(a, 0, 255).astype("uint8"))
    d = ImageDraw.Draw(im)
    d.rectangle([54, 54, W - 54, H - 54], outline=(196, 170, 110), width=2)

    f_h  = ImageFont.truetype(PLAY_IT, 78)
    f_sub= ImageFont.truetype(PLAY, 30)
    f_b  = ImageFont.truetype(PLAY, 34)
    f_step = ImageFont.truetype(PLAY_IT, 38)
    f_mark = ImageFont.truetype(PLAY, 26)

    def C(txt, font, fill, y, ls=0):
        if ls:
            wd = sum(d.textlength(c, font=font) + ls for c in txt) - ls; x = (W - wd) / 2
            for c in txt:
                d.text((x, y), c, font=font, fill=fill); x += d.textlength(c, font=font) + ls
        else:
            d.text(((W - d.textlength(txt, font=font)) / 2, y), txt, font=font, fill=fill)

    C("KETABI STUDIO", f_mark, MARK, 150, ls=8)
    C("Thank you", f_h, INK, 300)
    d.line([(W // 2 - 40, 430), (W // 2 + 40, 430)], fill=GOLD, width=2)
    C(f"Your personalized {product} is on its way", f_sub, SOFT, 470)

    steps = [
        ("1.", "Your print is hand-finished with your name, its meaning, and the",
               "verified ayah or heritage note that belongs to it."),
        ("2.", "We'll confirm the Arabic spelling with you here in Etsy Messages,",
               "so every letter is exactly right."),
        ("3.", "Your high-resolution files (print-ready PDF + framing PNG) arrive",
               "in your Etsy Messages within 24 hours."),
    ]
    y = 640
    for num, l1, l2 in steps:
        C(num, f_step, GOLD, y)
        C(l1, f_b, INK, y + 66)
        C(l2, f_b, INK, y + 112)
        y += 250

    C("Any questions, just reply to your order. We're so glad you're here.", f_sub, SOFT, y + 10)
    d.line([(W // 2 - 30, H - 190), (W // 2 + 30, H - 190)], fill=GOLD, width=2)
    C("ketabistudio.com", f_mark, MARK, H - 168, ls=4)

    im.save(out_path, "PDF", resolution=150.0,
            title="Your Ketabi Studio Name Print", author="Ketabi Studio",
            producer="Ketabi Studio", creator="Ketabi Studio")
    return out_path

# ------------------------------------------------------------------- mockup
def make_frame_mockup(print_png, out_path, wall=(214, 205, 192)):
    """Matted, thin-framed print on a soft wall with a gentle drop shadow."""
    W, H = 1080, 1080
    im = Image.new("RGB", (W, H), wall)
    a = np.asarray(im).astype(np.float32)
    yy, xx = np.mgrid[0:H, 0:W].astype(np.float32)
    # soft top-left light on the wall
    g = np.clip(1 - (((xx - .35 * W) / (1.1 * W)) ** 2 + ((yy - .30 * H) / (1.1 * H)) ** 2), 0, 1)[..., None]
    a += g * 16
    a += np.random.default_rng(7).normal(0, 2.2, (H, W, 1))
    im = Image.fromarray(np.clip(a, 0, 255).astype("uint8"))

    art = Image.open(print_png).convert("RGB")
    # frame geometry (portrait 4:5 print)
    fw = 560
    fh = int(fw * 1350 / 1080)
    fx = (W - fw) // 2
    fy = (H - fh) // 2 - 6
    mat = 46          # ivory mat width
    frame = 20        # thin frame width

    # drop shadow
    sh = Image.new("RGBA", (W, H), (0, 0, 0, 0))
    ds = ImageDraw.Draw(sh)
    ds.rectangle([fx - frame + 16, fy - frame + 22, fx + fw + frame + 16, fy + fh + frame + 22],
                 fill=(30, 26, 20, 70))
    from PIL import ImageFilter
    sh = sh.filter(ImageFilter.GaussianBlur(18))
    im = Image.alpha_composite(im.convert("RGBA"), sh).convert("RGB")
    d = ImageDraw.Draw(im)

    # frame (soft matte black-brown), mat (ivory), then the art
    d.rectangle([fx - frame, fy - frame, fx + fw + frame, fy + fh + frame], fill=(38, 34, 30))
    d.rectangle([fx, fy, fx + fw, fy + fh], fill=(243, 238, 229))
    inner = art.resize((fw - 2 * mat, fh - 2 * mat))
    im.paste(inner, (fx + mat, fy + mat))
    # thin gold liner around the art window
    d.rectangle([fx + mat - 3, fy + mat - 3, fx + fw - mat + 2, fy + fh - mat + 2],
                outline=(176, 140, 66), width=2)
    im.save(out_path, quality=92)
    return out_path

# ------------------------------------------------------------- print files
def make_print_files(entry, name_key, outdir):
    """Per-order deliverables: a print-ready multi-size PDF + a framing PNG."""
    from gen_name_print import render_name
    os.makedirs(outdir, exist_ok=True)
    png = os.path.join(outdir, f"Ketabi-Name-Print-{name_key}.png")
    render_name(entry, png, sc=2.0)  # hi-res for framing
    art = Image.open(png).convert("RGB")

    pages = []
    for label, (pw, ph) in {"5x7": (1500, 2100), "8x10": (2400, 3000),
                            "A4": (2480, 3508)}.items():
        page = Image.new("RGB", (pw, ph), (255, 255, 255))
        # fit the 4:5 art centered with a margin
        m = int(pw * 0.06)
        aw = pw - 2 * m
        ah = int(aw * 1350 / 1080)
        if ah > ph - 2 * m:
            ah = ph - 2 * m; aw = int(ah * 1080 / 1350)
        page.paste(art.resize((aw, ah)), ((pw - aw) // 2, (ph - ah) // 2))
        pages.append(page)
    pdf = os.path.join(outdir, f"Ketabi-Name-Print-{name_key}-PRINT.pdf")
    pages[0].save(pdf, "PDF", resolution=300.0, save_all=True, append_images=pages[1:],
                  title="Ketabi Studio Name Print", author="Ketabi Studio",
                  producer="Ketabi Studio", creator="Ketabi Studio")
    return pdf, png

if __name__ == "__main__":
    import sys
    sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
    OUT = sys.argv[1] if len(sys.argv) > 1 else "/tmp/name_deliverables"
    os.makedirs(OUT, exist_ok=True)
    make_howitworks_pdf(os.path.join(OUT, "How-It-Works.pdf"))
    print("wrote how-it-works pdf")
