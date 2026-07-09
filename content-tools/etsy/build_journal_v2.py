#!/usr/bin/env python3
# "From One Root" SECOND EDITION. Keeps every verified day spread + the original
# voice ("Allah", not "God"), and ADDS premium product pages in the same ivory/
# gold style: print guide, worked day, glossary, progress tracker, a scholarly-
# insight note (the audit's 3 clarify points, handled transparently), and a
# completion certificate. No unverified hadith are imported. Measured layouts,
# asserted non-overflow. Run: python3 build_journal_v2.py <outdir>
import os, sys
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from PIL import Image, ImageDraw, ImageFont
import gen_journal as J
from journal_data import DAYS
from build_journal import title_page, howto_page, sources_page

PW, PH = J.PW, J.PH
PLAY, PLAY_IT, AMIRI = J.PLAY, J.PLAY_IT, J.AMIRI
INK, SOFT, GOLD, MARK, RULE = J.INK, J.SOFT, J.GOLD, J.MARK, J.RULE


def _foot(d):
    J._center(d, "F R O M   O N E   R O O T", ImageFont.truetype(PLAY, 30), MARK, PH - 150, ls=6)


def _prose_page(title, paras, out, tsize=40, bsize=52, gap=60, lg=1.45, maxw=PW - 460):
    """Title + centered paragraph block, vertically centered, non-overflowing."""
    im = J._base(); d = ImageDraw.Draw(im)
    f_t = ImageFont.truetype(PLAY, tsize)
    f = ImageFont.truetype(PLAY, bsize)
    wr = [J._wrap(p, f, maxw) for p in paras]
    lh = int(f.size * lg); asc, desc = f.getmetrics()
    ph = lambda lines: lh * (len(lines) - 1) + asc + desc
    t_h = sum(f_t.getmetrics())
    total = t_h + 120 + sum(ph(p) for p in wr) + gap * (len(wr) - 1)
    top, bot = 200, PH - 220
    y = top + max(0, (bot - top - total) / 2)
    J._center(d, title, f_t, GOLD, y, ls=8); y += t_h + 120
    for p in wr:
        y = J._block(d, p, f, INK, y, lg=lg); y += gap
    assert y - gap <= PH - 180, f"{title} overflow y={y}"
    _foot(d); im.save(out); return out


def print_guide(out):
    return _prose_page("BEFORE YOU PRINT", [
        "This journal is made for US Letter paper, 8.5 by 11 inches. Print at 100 percent, not fit to page, so nothing is cropped at the edges.",
        "For the writing pages, a slightly heavier paper, 24 lb or 90 gsm, keeps your ink from showing through the other side.",
        "Print double sided for a book you keep, or single sided if you want to tear a page free and carry it with you.",
        "Coil or disc binding lets the journal lay flat while you write. Any local print shop can do this for a few dollars.",
        "Full colour is loveliest, but every page still reads beautifully in grayscale.",
    ], out, gap=58)


def worked_day(out):
    return _prose_page("WHAT A DAY LOOKS LIKE", [
        "Each day is two pages. The first tells the story of one Arabic root, the true meaning that lives inside three letters. Read it slowly. The fact is a doorway, not the destination.",
        "The second page is yours. A few honest questions, and room to answer them.",
        "You do not need beautiful sentences. You need true ones. A single honest line is worth more than a careful, empty page.",
        "Some prompts ask for a memory. Some ask for a plan. One or two ask for a little courage. Answer the ones that reach you, and let the rest wait.",
        "There is no right way to fill these pages. There is only your way.",
    ], out, gap=56)


GLOSSARY = [
    ("Triliteral root", "Arabic is built on roots of three letters. From those three, a whole family of words grows, all sharing one core meaning."),
    ("Ayah", "A verse of the Qur'an. The word also means a sign, something that points past itself to its Maker."),
    ("Surah", "A chapter of the Qur'an. There are one hundred and fourteen in all."),
    ("Hadith", "A reported saying or action of the Prophet, peace be upon him, preserved through a chain of narrators."),
    ("Sahih", "The soundest grade of hadith: a continuous chain of reliable narrators, with no hidden defect."),
    ("Hasan", "A good grade, reliable but with a minor weakness that keeps it just below sahih."),
    ("al-Mufradat", "Raghib al-Isfahani's eleventh-century dictionary of the Qur'an's key words, a standard classical reference."),
]


def glossary_page(out):
    im = J._base(); d = ImageDraw.Draw(im)
    J._center(d, "A FEW WORDS, EXPLAINED", ImageFont.truetype(PLAY, 40), GOLD, 210, ls=8)
    f_term = ImageFont.truetype(PLAY_IT, 46)
    f_def = ImageFont.truetype(PLAY, 38)
    x0 = 210; y = 400
    for term, definition in GLOSSARY:
        d.text((x0, y), term, font=f_term, fill=GOLD); y += int(46 * 1.35)
        y = J._block(d, J._wrap(definition, f_def, PW - 420), f_def, INK, y, lg=1.34, align="left", x0=x0)
        y += 44
    assert y <= PH - 180, f"glossary overflow y={y}"
    _foot(d); im.save(out); return out


def tracker_page(out):
    im = J._base(); d = ImageDraw.Draw(im)
    J._center(d, "THIRTY ROOTS", ImageFont.truetype(PLAY, 40), GOLD, 210, ls=10)
    J._center(d, "one for each day, mark them as you go", ImageFont.truetype(PLAY_IT, 40), SOFT, 300)
    f = ImageFont.truetype(PLAY, 38)
    col_x = [230, PW // 2 + 60]
    top = 470; row_h = 104; per_col = 15
    for i, day in enumerate(DAYS, 1):
        col = 0 if i <= per_col else 1
        row = (i - 1) % per_col
        x = col_x[col]; y = top + row * row_h
        d.ellipse([x, y + 4, x + 34, y + 38], outline=GOLD, width=3)
        label = f"Day {i:>2}   {day['translit']}"
        d.text((x + 60, y), label, font=f, fill=INK)
    _foot(d); im.save(out); return out


def insight_page(out):
    # The audit's 3 clarify points, handled transparently as a trust feature.
    return _prose_page("A NOTE ON SCHOLARLY INSIGHT", [
        "Most of what you read here is settled: a root, its meaning, the verse it lives in. A few connections are the insight of classical scholars rather than plain dictionary fact, and honesty asks that we say so plainly.",
        "Mercy and the womb. Rahma and rahim share the root r-h-m; the link between them rests on a sound hadith and the lexicographers. (Day 1)",
        "Worship and the worn road. 'Ibadah, at its root, means devoted servitude. The image of a road worn smooth by walking, tariq mu'abbad, is how the Arabs pictured a practice made easier each time it is repeated. (Day 10)",
        "Knowledge and the world. 'Ilm is linked to 'alam, the world, through the root '-l-m, following Raghib al-Isfahani: the world is that by which its Maker is known. The word 'ilm itself fills the Qur'an, as when we are taught to ask, My Lord, increase me in knowledge. (Qur'an 20:114, Day 27)",
        "None of this is guesswork. Where it is interpretation, we have told you. That is the whole promise of this journal.",
    ], out, bsize=46, gap=48)


def certificate_page(out):
    im = J._base(); d = ImageDraw.Draw(im)
    # arabic seal
    f_ar = ImageFont.truetype(AMIRI, 150)
    ar = "من جذر واحد"
    bb = d.textbbox((0, 0), ar, font=f_ar)
    d.text(((PW - (bb[2] - bb[0])) / 2 - bb[0], 360 - bb[1]), ar, font=f_ar, fill=GOLD)
    J._center(d, "T H I R T Y   R O O T S ,   C O M P L E T E", ImageFont.truetype(PLAY, 40), GOLD, 620, ls=6)
    d.line([(PW // 2 - 70, 720), (PW // 2 + 70, 720)], fill=GOLD, width=3)
    J._center(d, "Carried, one root at a time, by", ImageFont.truetype(PLAY_IT, 50), INK, 830)
    d.line([(430, 1010), (PW - 430, 1010)], fill=RULE, width=2)   # name line
    J._center(d, "over thirty days in the language of the Qur'an.", ImageFont.truetype(PLAY_IT, 50), INK, 1080)
    J._center(d, "Finished on", ImageFont.truetype(PLAY, 40), SOFT, 1280)
    d.line([(600, 1380), (PW - 600, 1380)], fill=RULE, width=2)   # date line
    J._center(d, "May the words you have carried now carry you.", ImageFont.truetype(PLAY_IT, 46), SOFT, 1520)
    J._center(d, "K E T A B I   S T U D I O", ImageFont.truetype(PLAY, 34), MARK, PH - 300, ls=8)
    J._center(d, "ketabistudio.com", ImageFont.truetype(PLAY, 30), SOFT, PH - 235)
    im.save(out); return out


def build(outdir):
    os.makedirs(outdir, exist_ok=True)
    pages = []

    def add(name, fn):
        p = os.path.join(outdir, name); fn(p); pages.append(p)

    add("p000_title.png", title_page)
    add("p001_printguide.png", print_guide)
    add("p002_howto.png", howto_page)
    add("p003_workedday.png", worked_day)
    add("p004_glossary.png", glossary_page)
    for i, day in enumerate(DAYS, 1):
        s = os.path.join(outdir, f"p{i:03d}a_story.png"); J.render_story_page(i, day, s); pages.append(s)
        w = os.path.join(outdir, f"p{i:03d}b_write.png"); J.render_writing_page(i, day, w); pages.append(w)
    add("p900_tracker.png", tracker_page)
    # sources (may split into a/b)
    src = os.path.join(outdir, "p902_sources.png"); sources_page(src)
    for cand in (src.replace(".png", "a.png"), src.replace(".png", "b.png"), src):
        if os.path.exists(cand) and cand not in pages:
            pages.append(cand)
    add("p999_certificate.png", certificate_page)

    ims = [Image.open(x).convert("RGB") for x in pages]
    pdf = os.path.join(outdir, "Ketabi-From-One-Root-Journal-2E.pdf")
    ims[0].save(pdf, "PDF", resolution=200.0, save_all=True, append_images=ims[1:],
                title="From One Root - a 30-day journey through the language of the Qur'an (Second Edition)",
                author="Ketabi Studio", producer="Ketabi Studio", creator="Ketabi Studio")
    mb = os.path.getsize(pdf) / 1048576
    print(f"pages: {len(ims)} | pdf: {pdf} | {mb:.1f}MB")
    return pdf


if __name__ == "__main__":
    build(sys.argv[1] if len(sys.argv) > 1 else "/tmp/journal2")
