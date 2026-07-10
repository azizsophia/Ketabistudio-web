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


def cover_front(out):
    """Dedicated FRONT COVER (not the interior title page): the whole title
    stack is spread with generous rhythm and centered high in the page so there
    is no dead band at the top, with the brand line pinned near the foot. Owner
    flagged the reused title page as top-empty on the printed cover."""
    im = J._base(); d = ImageDraw.Draw(im)
    f_tag = ImageFont.truetype(PLAY, 38)
    f_ar  = ImageFont.truetype(AMIRI, 250)
    f_ti  = ImageFont.truetype(PLAY_IT, 150)
    f_su  = ImageFont.truetype(PLAY_IT, 54)
    f_ve  = ImageFont.truetype(PLAY, 40)
    ar = "من جذر واحد"
    bb = d.textbbox((0, 0), ar, font=f_ar); ar_h = bb[3] - bb[1]
    # gaps: tag->ar, ar->title, title->sub, sub->rule, rule->verified.
    # TOP-ANCHORED (not centered) with a clean ~8% cover margin so the title
    # starts high; generous rhythm carries the stack down toward the footer.
    G1, G2, G3, G4, G5 = 190, 230, 100, 130, 122
    tag_h = sum(f_tag.getmetrics()); ti_h = sum(f_ti.getmetrics())
    su_h = sum(f_su.getmetrics())
    y = 235
    J._center(d, "T H I R T Y   D A Y S   ·   T H I R T Y   R O O T S", f_tag, GOLD, y, ls=4)
    y += tag_h + G1
    d.text(((PW - (bb[2] - bb[0])) / 2 - bb[0], y - bb[1]), ar, font=f_ar, fill=GOLD)
    y += ar_h + G2
    J._center(d, "From One Root", f_ti, INK, y); y += ti_h + G3
    J._center(d, "a thirty-day journey through the language of the Qur'an", f_su, SOFT, y)
    y += su_h + G4
    d.line([(PW // 2 - 60, int(y)), (PW // 2 + 60, int(y))], fill=GOLD, width=3); y += 3 + G5
    J._center(d, "every root verified · every source cited", f_ve, SOFT, y)
    J._center(d, "K E T A B I   S T U D I O", ImageFont.truetype(PLAY, 34), MARK, PH - 190, ls=8)
    J._center(d, "ketabistudio.com", ImageFont.truetype(PLAY, 30), SOFT, PH - 125)
    im.save(out); return out


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


def notes_page(out, titled=True):
    im = J._base(); d = ImageDraw.Draw(im)
    if titled:
        J._center(d, "N O T E S", ImageFont.truetype(PLAY, 40), GOLD, 220, ls=10)
    y = 420 if titled else 300
    while y < PH - 260:
        d.line([(220, y), (PW - 220, y)], fill=RULE, width=2)
        y += 88
    J._center(d, "F R O M   O N E   R O O T", ImageFont.truetype(PLAY, 30), MARK, PH - 150, ls=6)
    im.save(out); return out


def back_cover(out):
    # Measured stack: arabic seal + blurb + rule + verified line, vertically
    # centered between the top border and the brand footer (no eyeballing).
    im = J._base(); d = ImageDraw.Draw(im)
    f_ar = ImageFont.truetype(AMIRI, 130)
    f = ImageFont.truetype(PLAY_IT, 54)
    f_ve = ImageFont.truetype(PLAY, 40)
    ar = "من جذر واحد"
    bb = d.textbbox((0, 0), ar, font=f_ar); ar_h = bb[3] - bb[1]
    lines = [
        "You say these Arabic words every day.",
        "Rahma. Sabr. Shukr.",
        "Thirty days, thirty roots: each traced to its",
        "true meaning and the ayah it lives in,",
        "with room to write your way toward it.",
    ]
    LGAP = 96                       # blurb line pitch
    G1, G2, G3 = 170, 96, 90        # ar->blurb, blurb->rule, rule->verified
    ve_h = sum(f_ve.getmetrics())
    total = ar_h + G1 + LGAP * (len(lines) - 1) + sum(f.getmetrics()) + G2 + 3 + G3 + ve_h
    top, bot = 220, PH - 400        # footer block owns the bottom 400px
    y = top + max(0, (bot - top - total) / 2)
    d.text(((PW - (bb[2] - bb[0])) / 2 - bb[0], y - bb[1]), ar, font=f_ar, fill=GOLD)
    y += ar_h + G1
    for t in lines:
        J._center(d, t, f, INK, y); y += LGAP
    y += G2 - LGAP + sum(f.getmetrics())
    d.line([(PW // 2 - 60, int(y)), (PW // 2 + 60, int(y))], fill=GOLD, width=3)
    y += 3 + G3
    J._center(d, "every root verified · every source cited", f_ve, SOFT, y)
    J._center(d, "K E T A B I   S T U D I O", ImageFont.truetype(PLAY, 34), MARK, PH - 320, ls=8)
    J._center(d, "ketabistudio.com", ImageFont.truetype(PLAY, 30), SOFT, PH - 250)
    im.save(out); return out


def _canvas_bg(w=None, h=None):
    """Full-bleed ivory matching _base's tone/noise (no border) so the pasted
    page edge is invisible. Width/height overridable for the one-piece cover."""
    w, h = w or CW, h or CH
    a = np.full((h, w, 3), J.BG, np.float32)
    yy, xx = np.mgrid[0:h, 0:w].astype(np.float32)
    dd = ((xx - .5 * w) / (.8 * w)) ** 2 + ((yy - .46 * h) / (.72 * h)) ** 2
    a = a * np.clip(1 - 0.06 * np.clip(dd, 0, 1), 0.94, 1)[..., None] \
        + np.random.default_rng(3).normal(0, 2.4, (h, w, 1))
    return Image.fromarray(np.clip(a, 0, 255).astype("uint8"))


_BG = _canvas_bg()

# ── one-piece coil cover sheet, to Lulu's exact template ──────────────
# Lulu /cover-dimensions/ for 0850X1100.FC.STD.CO.060UW444.MXX @ 70pp says
# 1242 x 810 pt = 17.25 x 11.25 in: two 8.625in panels (8.5 trim + 0.125
# bleed on the OUTER edge only), cut at the exact centre, spine = 0 (coil).
# Back cover is the LEFT panel, front cover the RIGHT (coil on the book's
# left edge, Lulu's default). Coil punches bite ~0.375in at the centre cut,
# so ink must stay >=0.5in from it (help.lulu.com 64000306954).
SHEET_W, SHEET_H = 5175, 3375       # 17.25 x 11.25 in @ 300dpi
CUT = SHEET_W / 2                   # 2587.5 — centre cut / binding trim edge
BIND_M = 90                         # paper gap art<-binding edge (0.30in);
                                    # art's own border sits 99px inside its
                                    # edge, so first INK is 189px = 0.63in
                                    # clear of the coil (bite = 112.5px)


def cover_sheet(front_png, back_png, out):
    """Compose the print cover exactly to Lulu's one-piece template: art fills
    each panel edge-to-edge visually (continuous ivory ground, no floating
    page-within-a-page), trimmed-page margins measured, not eyeballed."""
    cv = _canvas_bg(SHEET_W, SHEET_H)
    fr = Image.open(front_png).convert("RGB").resize((TW, TH), Image.LANCZOS)
    bk = Image.open(back_png).convert("RGB").resize((TW, TH), Image.LANCZOS)
    fr = fr.filter(ImageFilter.UnsharpMask(radius=2, percent=70, threshold=2))
    bk = bk.filter(ImageFilter.UnsharpMask(radius=2, percent=70, threshold=2))
    y = int(37.5 + (3300 - TH) / 2)             # equal top/bottom trim margins
    cv.paste(bk, (int(CUT - BIND_M - TW), y))   # back: binds on its right
    cv.paste(fr, (int(CUT + BIND_M), y))        # front: binds on its left
    cv.save(out)
    return out


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
    notes2 = os.path.join(outdir, "x_notes2.png"); notes_page(notes2, titled=False)
    backcv = os.path.join(outdir, "x_back.png"); back_cover(backcv)

    # Front matter is 5 pages (odd) so every day's story lands on a LEFT page
    # facing its writing page. The tracker lives up front, where a habit
    # tracker belongs; the worked-day page was removed (it repeated the how-to).
    order = [p("p000_title.png"), p("p002_howto.png"),
             p("p004_glossary.png"), p("p900_tracker.png"), belongs]
    for i in range(1, 31):
        order += [p(f"p{i:03d}a_story.png"), p(f"p{i:03d}b_write.png")]
    order += [p("p902_sourcesa.png"), p("p902_sourcesb.png"),
              p("p999_certificate.png"), notes, notes2]
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

    # Dedicated front-cover design (NOT the interior title page — owner flagged
    # the reused title page as top-empty on the printed cover).
    frontcv = os.path.join(outdir, "x_front.png"); cover_front(frontcv)

    sheet_png = os.path.join(outdir, "Ketabi-From-One-Root-Journal-Coil-Cover-Sheet.png")
    cover_sheet(frontcv, backcv, sheet_png)
    sheet_pdf = os.path.join(outdir, "Ketabi-From-One-Root-Journal-Coil-Cover.pdf")
    Image.open(sheet_png).save(sheet_pdf, "PDF", resolution=float(DPI),
                               title="From One Root - cover", author="Ketabi Studio",
                               producer="Ketabi Studio", creator="Ketabi Studio")
    print(f"cover: one-piece 17.25x11.25 | {sheet_pdf} | {os.path.getsize(sheet_pdf)/1048576:.1f}MB")


if __name__ == "__main__":
    src = sys.argv[1] if len(sys.argv) > 1 else "/tmp/journal2"
    out = sys.argv[2] if len(sys.argv) > 2 else "/tmp/journal_print"
    build(src, out)
