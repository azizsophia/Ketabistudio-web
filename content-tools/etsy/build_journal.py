#!/usr/bin/env python3
# Assembles the full "From One Root" journal PDF: title page, how-to-use page,
# 30 day spreads (story + writing), sources page. Clean metadata (Ketabi Studio
# only). Run: python3 build_journal.py <outdir>
import os, sys
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from PIL import Image, ImageDraw, ImageFont, JpegImagePlugin
Image.init()
import gen_journal as J
from journal_data import DAYS

PW, PH = J.PW, J.PH
PLAY, PLAY_IT, AMIRI = J.PLAY, J.PLAY_IT, J.AMIRI
INK, SOFT, GOLD, MARK = J.INK, J.SOFT, J.GOLD, J.MARK

def title_page(out):
    # measured, optically balanced stack: whole block centered between the top
    # border and the brand/copyright footer, with even rhythm.
    im = J._base(); d = ImageDraw.Draw(im)
    f_tag = ImageFont.truetype(PLAY, 36)
    f_ar  = ImageFont.truetype(AMIRI, 250)
    f_ti  = ImageFont.truetype(PLAY_IT, 148)
    f_su  = ImageFont.truetype(PLAY_IT, 54)
    f_ve  = ImageFont.truetype(PLAY, 40)
    f_mk  = ImageFont.truetype(PLAY, 34)
    f_cp  = ImageFont.truetype(PLAY, 28)
    ar = "من جذر واحد"
    bb = d.textbbox((0, 0), ar, font=f_ar)
    ar_h = bb[3] - bb[1]
    G1, G2, G3, G4, G5 = 130, 150, 60, 90, 70  # tag→ar→title→sub→div→verified
    tag_h = sum(f_tag.getmetrics()); ti_h = sum(f_ti.getmetrics())
    su_h = sum(f_su.getmetrics()); ve_h = sum(f_ve.getmetrics())
    total = tag_h + G1 + ar_h + G2 + ti_h + G3 + su_h + G4 + 3 + G5 + ve_h
    top, bot = 220, PH - 420  # leave room for footer block
    y = top + ((bot - top) - total) / 2
    J._center(d, "T H I R T Y   D A Y S   ·   T H I R T Y   R O O T S", f_tag, GOLD, y, ls=4); y += tag_h + G1
    d.text(((PW - (bb[2]-bb[0]))/2 - bb[0], y - bb[1]), ar, font=f_ar, fill=GOLD); y += ar_h + G2
    J._center(d, "From One Root", f_ti, INK, y); y += ti_h + G3
    J._center(d, "a thirty-day journey through the language of the Qur'an", f_su, SOFT, y); y += su_h + G4
    d.line([(PW//2-60, int(y)), (PW//2+60, int(y))], fill=GOLD, width=3); y += 3 + G5
    J._center(d, "every root verified · every source cited", f_ve, SOFT, y)
    # footer block: brand + copyright
    J._center(d, "K E T A B I   S T U D I O", f_mk, MARK, PH - 300, ls=8)
    J._center(d, "© 2026 Ketabi Studio · ketabistudio.com · All rights reserved", f_cp, SOFT, PH - 225)
    J._center(d, "For personal use only. May not be reproduced, resold, or redistributed.", f_cp, SOFT, PH - 180)
    im.save(out)

HOWTO = ("This journal moves one root at a time. Each day gives you three letters of "
 "Arabic, the true meaning that lives inside them, and a place to write.\n \n"
 "Read the story page slowly. The fact is the doorway, not the point.\n \n"
 "Then answer honestly on the writing page. Nobody is grading this. Some prompts "
 "ask for memories, some for plans, one or two for courage.\n \n"
 "You can walk the thirty days in a month, or take a root a week and live with it "
 "longer. There is no falling behind here.\n \n"
 "Everything in these pages is verified. Every root was checked against the "
 "classical Arabic sources, every ayah against the Qur'an, every hadith "
 "against its grading, and the sources are cited on the page where they are used. Where a "
 "connection is a classical scholar's insight rather than settled fact, the page "
 "says so. That is a promise we keep across everything we make.\n \n"
 "Begin with mercy. It was always the beginning.")

def howto_page(out):
    im = J._base(); d = ImageDraw.Draw(im)
    J._center(d, "HOW TO WALK THESE PAGES", ImageFont.truetype(PLAY, 40), GOLD, 260, ls=8)
    f = ImageFont.truetype(PLAY, 52)
    y = 480
    for para in HOWTO.split("\n"):
        if para.strip() == "":
            y += 30; continue
        y = J._block(d, J._wrap(para, f, PW-420), f, INK, y, lg=1.45)
        y += 26
    J._center(d, "F R O M   O N E   R O O T", ImageFont.truetype(PLAY, 30), MARK, PH-150, ls=6)
    im.save(out)

def sources_page(out):
    im = J._base(); d = ImageDraw.Draw(im)
    J._center(d, "SOURCES", ImageFont.truetype(PLAY, 40), GOLD, 240, ls=10)
    f = ImageFont.truetype(PLAY, 40); fs = ImageFont.truetype(PLAY, 36)
    y = 420
    intro = ("Roots and meanings were checked against the classical dictionaries of "
     "the Arabic language: Lane's Arabic-English Lexicon, Lisan al-Arab, and Raghib "
     "al-Isfahani's al-Mufradat, with root occurrences confirmed at corpus.quran.com. "
     "Hadith are cited with collection, number, and grading. Qur'an references were "
     "verified at quran.com.")
    y = J._block(d, J._wrap(intro, f, PW-420), f, INK, y, lg=1.42)
    y += 70
    for i, day in enumerate(DAYS, 1):
        line = f"Day {i}  ·  {day['translit']}  ·  {day['citation']}"
        y = J._block(d, J._wrap(line, fs, PW-380), fs, SOFT, y, lg=1.3, align="left", x0=210)
        y += 10
        if y > PH - 320 and i < len(DAYS):
            J._center(d, "F R O M   O N E   R O O T", ImageFont.truetype(PLAY, 30), MARK, PH-150, ls=6)
            im.save(out.replace(".png", "a.png"))
            im = J._base(); d = ImageDraw.Draw(im); y = 240
    J._center(d, "F R O M   O N E   R O O T", ImageFont.truetype(PLAY, 30), MARK, PH-150, ls=6)
    im.save(out.replace(".png", "b.png") if os.path.exists(out.replace(".png", "a.png")) else out)

def build(outdir):
    os.makedirs(outdir, exist_ok=True)
    pages = []
    p = f"{outdir}/p000_title.png"; title_page(p); pages.append(p)
    p = f"{outdir}/p001_howto.png"; howto_page(p); pages.append(p)
    for i, day in enumerate(DAYS, 1):
        s = f"{outdir}/p{i:03d}a_story.png"; J.render_story_page(i, day, s); pages.append(s)
        w = f"{outdir}/p{i:03d}b_write.png"; J.render_writing_page(i, day, w); pages.append(w)
    src = f"{outdir}/p999_sources.png"; sources_page(src)
    for cand in (src.replace(".png", "a.png"), src.replace(".png", "b.png"), src):
        if os.path.exists(cand) and cand not in pages:
            pages.append(cand)
    ims = [Image.open(x).convert("RGB") for x in pages]
    pdf = f"{outdir}/Ketabi-From-One-Root-Journal.pdf"
    ims[0].save(pdf, "PDF", resolution=200.0, save_all=True, append_images=ims[1:],
        title="From One Root - a 30-day journey through the language of the Qur'an",
        author="Ketabi Studio", producer="Ketabi Studio", creator="Ketabi Studio")
    print("pages:", len(ims), "| pdf:", pdf, "| %.1fMB" % (os.path.getsize(pdf)/1048576))

if __name__ == "__main__":
    build(sys.argv[1] if len(sys.argv) > 1 else "/tmp/journal")
