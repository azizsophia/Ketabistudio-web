#!/usr/bin/env python3
# PRINT (coil-bound) edition of "From One Root" for Lulu POD. Takes the digital
# edition's rendered pages (build_journal_v2 output) and assembles a Lulu-ready
# interior + cover:
#   - US Letter + 0.125in bleed at 300dpi (2625x3375 canvas, 2550x3300 trim)
#   - content scaled to 94% and shifted AWAY from the binding edge so the coil
#     punches never hit the gold border (odd pages bind left, even bind right)
#   - the digital-only "Before You Print" page is dropped
#   - two physical-only pages added: "This journal belongs to" + a closing NOTES
#     page, which also makes every day's story/write pair a facing spread
#     (story on the left-hand page, writing page on the right)
#   - cover PDF: front (title art) + back (short blurb), same punch-safe shift
# Run: python3 build_journal_print.py <rendered_pages_dir> <outdir>
import os, sys
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import numpy as np
from PIL import Image, ImageDraw, ImageFont, ImageFilter
import gen_journal as J

PW, PH = J.PW, J.PH
PLAY, PLAY_IT, AMIRI = J.PLAY, J.PLAY_IT, J.AMIRI
INK, SOFT, GOLD, MARK, RULE = J.INK, J.SOFT, J.GOLD, J.MARK, J.RULE

DPI = 300
CW, CH = 2625, 3375            # 8.75 x 11.25 in (trim + 0.125in bleed each side)
SCALE = 0.94                   # content scale inside the trim
TW, TH = int(2550 * SCALE), int(3300 * SCALE)   # 2397 x 3102
BIND_GAP = 190                 # binding-side gap from canvas edge (~0.51in past trim)
OUTER_GAP = CW - TW - BIND_GAP # lands right at the bleed line
Y_GAP = (CH - TH) // 2


def belongs_page(out):
    im = J._base(); d = ImageDraw.Draw(im)
    f_ar = ImageFont.truetype(AMIRI, 120)
    ar = "من جذر واحد"
    bb = d.textbbox((0, 0), ar, font=f_ar)
    d.text(((PW - (bb[2] - bb[0])) / 2 - bb[0], 560 - bb[1]), ar, font=f_ar, fill=GOLD)
    J._center(d, "THIS JOURNAL BELONGS TO", ImageFont.truetype(PLAY, 44), GOLD, 900, ls=8)
    d.line([(430, 1120), (PW - 430, 1120)], fill=RULE, width=2)
    J._center(d, "begun on", ImageFont.truetype(PLAY_IT, 46), SOFT, 1320)
    d.line([(600, 1480), (PW - 600, 1480)], fill=RULE, width=2)
    J._center(d, "one root at a time", ImageFont.truetype(PLAY_IT, 44), SOFT, 1700)
    J._center(d, "F R O M   O N E   R O O T", ImageFont.truetype(PLAY, 30), MARK, PH - 150, ls=6)
    im.save(out); return out


def notes_page(out):
    im = J._base(); d = ImageDraw.Draw(im)
    J._center(d, "N O T E S", ImageFont.truetype(PLAY, 40), GOLD, 220, ls=10)
    y = 420
    while y < PH - 260:
        d.line([(220, y), (PW - 220, y)], fill=RULE, width=2)
        y += 88
    J._center(d, "F R O M   O N E   R O O T", ImageFont.truetype(PLAY, 30), MARK, PH - 150, ls=6)
    im.save(out); return out


def back_cover(out):
    im = J._base(); d = ImageDraw.Draw(im)
    f_ar = ImageFont.truetype(AMIRI, 130)
    ar = "من جذر واحد"
    bb = d.textbbox((0, 0), ar, font=f_ar)
    d.text(((PW - (bb[2] - bb[0])) / 2 - bb[0], 520 - bb[1]), ar, font=f_ar, fill=GOLD)
    f = ImageFont.truetype(PLAY_IT, 54)
    lines = [
        "You say these Arabic words every day.",
        "Rahma. Sabr. Shukr.",
        "Thirty days, thirty roots: each traced to its",
        "true meaning and the ayah it lives in,",
        "with room to write your way toward it.",
    ]
    y = 900
    for t in lines:
        J._center(d, t, f, INK, y); y += 96
    d.line([(PW // 2 - 60, y + 40), (PW // 2 + 60, y + 40)], fill=GOLD, width=3)
    J._center(d, "every root verified · every source cited",
              ImageFont.truetype(PLAY, 40), SOFT, y + 130)
    J._center(d, "K E T A B I   S T U D I O", ImageFont.truetype(PLAY, 34), MARK, PH - 320, ls=8)
    J._center(d, "ketabistudio.com", ImageFont.truetype(PLAY, 30), SOFT, PH - 250)
    im.save(out); return out


def _canvas_bg():
    """Full-bleed ivory matching _base's tone/noise (no border) so the pasted
    page edge is invisible."""
    a = np.full((CH, CW, 3), J.BG, np.float32)
    yy, xx = np.mgrid[0:CH, 0:CW].astype(np.float32)
    dd = ((xx - .5 * CW) / (.8 * CW)) ** 2 + ((yy - .46 * CH) / (.72 * CH)) ** 2
    a = a * np.clip(1 - 0.06 * np.clip(dd, 0, 1), 0.94, 1)[..., None] \
        + np.random.default_rng(3).normal(0, 2.4, (CH, CW, 1))
    return Image.fromarray(np.clip(a, 0, 255).astype("uint8"))


_BG = _canvas_bg()


def compose(src_path, right_hand):
    """Scale a rendered 1700x2200 page onto the bleed canvas, shifted away from
    the binding edge. right_hand=True → binds LEFT (content shifted right)."""
    page = Image.open(src_path).convert("RGB").resize((TW, TH), Image.LANCZOS)
    page = page.filter(ImageFilter.UnsharpMask(radius=2, percent=70, threshold=2))
    x = BIND_GAP if right_hand else OUTER_GAP
    cv = _BG.copy()
    cv.paste(page, (x, Y_GAP))
    return cv


def build(srcdir, outdir):
    os.makedirs(outdir, exist_ok=True)
    p = lambda n: os.path.join(srcdir, n)

    belongs = os.path.join(outdir, "x_belongs.png"); belongs_page(belongs)
    notes = os.path.join(outdir, "x_notes.png"); notes_page(notes)
    backcv = os.path.join(outdir, "x_back.png"); back_cover(backcv)

    order = [p("p000_title.png"), p("p002_howto.png"), p("p003_workedday.png"),
             p("p004_glossary.png"), belongs]
    for i in range(1, 31):
        order += [p(f"p{i:03d}a_story.png"), p(f"p{i:03d}b_write.png")]
    order += [p("p900_tracker.png"), p("p902_sourcesa.png"),
              p("p902_sourcesb.png"), p("p999_certificate.png"), notes]
    for f in order:
        assert os.path.exists(f), f"missing page: {f}"
    assert len(order) % 2 == 0, f"page count must be even, got {len(order)}"

    pages = []
    for idx, f in enumerate(order, 1):        # page 1 = right-hand
        pages.append(compose(f, right_hand=(idx % 2 == 1)))
        if idx % 10 == 0:
            print(f"  composed {idx}/{len(order)}")

    interior = os.path.join(outdir, "Ketabi-From-One-Root-Journal-Coil-Interior.pdf")
    pages[0].save(interior, "PDF", resolution=float(DPI), save_all=True,
                  append_images=pages[1:],
                  title="From One Root - a 30-day journey through the language of the Qur'an",
                  author="Ketabi Studio", producer="Ketabi Studio", creator="Ketabi Studio")
    print(f"interior: {len(pages)} pages | {interior} | {os.path.getsize(interior)/1048576:.1f}MB")

    front = compose(p("p000_title.png"), right_hand=True)   # front cover binds left
    back = compose(backcv, right_hand=False)                # back cover binds right
    cover = os.path.join(outdir, "Ketabi-From-One-Root-Journal-Coil-Cover.pdf")
    front.save(cover, "PDF", resolution=float(DPI), save_all=True, append_images=[back],
               title="From One Root - cover", author="Ketabi Studio",
               producer="Ketabi Studio", creator="Ketabi Studio")
    print(f"cover: 2 pages | {cover} | {os.path.getsize(cover)/1048576:.1f}MB")


if __name__ == "__main__":
    src = sys.argv[1] if len(sys.argv) > 1 else "/tmp/journal2"
    out = sys.argv[2] if len(sys.argv) > 2 else "/tmp/journal_print"
    build(src, out)
