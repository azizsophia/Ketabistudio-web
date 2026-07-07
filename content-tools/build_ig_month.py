#!/usr/bin/env python3
# Build a 30-day Instagram + Facebook schedule (platforms=ig,fb — NOT Threads).
# 1 post/day at 19:00 UTC. Mixes root-content posts (reach/saves) with product
# spotlights (sales, with an Etsy CTA). IG rewards hashtags, so captions carry a
# tasteful set (the poster strips them only for Threads, which we don't target).
# Content is verified (journal_data); products link to the live listings.
import os, sys, json
sys.path.insert(0, os.path.join(os.path.dirname(os.path.abspath(__file__)), "etsy"))
from journal_data import DAYS
import gen_thread_post as T
from PIL import Image

D = os.path.dirname(os.path.abspath(__file__))
SCR = "/tmp/claude-0/-home-user-Ketabistudio-web/cd7de56a-bf46-5546-8ecd-6e0295c3376d/scratchpad"
MK = os.path.join(D, "etsy", "_mockups")
OUT = os.path.join(D, "_ig_month")
os.makedirs(OUT, exist_ok=True)

# reuse the clean, figure/alcohol-free pool + key() from the threads builder
import build_threads_week as BW

HASH_CONTENT = ("#arabiclanguage #quran #islamicreminders #muslim #islam #deen "
                "#imaan #islamicquotes #arabic #revert #dua #muslimah")
HASH_PRODUCT = ("#islamicart #muslimgift #arabiccalligraphy #quran #islamicgifts "
                "#muslimhome #islamicwallart #eidgift #muslimwedding #newbaby #aqiqah #muslimah")

# product spotlights: (image, caption). All link to the shop.
CTA = "\n\nShop the link in my bio  ·  ketabistudio.com\n\n" + HASH_PRODUCT
PRODUCTS = [
    (f"{MK}/mock_name.jpg",
     "A name, written into the Qur'an.\n\nWe find the verse that carries the root of your name and set it in verified Arabic, every source cited. A keepsake for a new baby, an aqiqah, or someone you love." + CTA),
    (f"{SCR}/COVER-FOR-JOURNAL.jpg",
     "From One Root: a 30-day journal through the language of the Qur'an.\n\nOne Arabic root a day, traced to its classical source, with room to reflect. Every source cited. I have never seen anything like it." + CTA),
    (f"{MK}/mock_wedding.jpg",
     "“And He placed between you love and mercy.”\n\nThe nikah verse, personalized with the couple's names and year. A wedding or anniversary keepsake in verified Arabic, Qur'an 30:21." + CTA),
    (f"{MK}/mock_teacher.jpg",
     "“The best of you are those who learn the Qur'an and teach it.”\n\nFor the one who taught you Qur'an. Personalized, hadith-sourced, ready to print." + CTA),
    (f"{MK}/mock_birth.jpg",
     "A name written for your baby.\n\nBirth date, a Qur'anic dua, and their name in gold Arabic. A keepsake for the nursery or a new-baby gift." + CTA),
    (f"{MK}/mock_protect.jpg",
     "A dua of protection, with your child's name.\n\nThe Prophet's own words of protection (peace be upon him), set in verified Arabic for the nursery wall." + CTA),
    (f"{MK}/mock_hajj.jpg",
     "Hajj Mabrur, made personal.\n\nTheir name and year, with the reward of an accepted Hajj. A congratulations keepsake for a returning pilgrim." + CTA),
    (f"{MK}/mock_home.jpg",
     "A blessing over your home.\n\nThe dua for a blessed dwelling, personalized with your family name. A housewarming or new-home keepsake, Qur'an 23:29." + CTA),
    (f"{MK}/mock_parents.jpg",
     "For the ones who raised you.\n\n“My Lord, have mercy upon them as they raised me when I was small.” Personalized, Qur'an 17:24." + CTA),
    (f"{MK}/mock_getwell.jpg",
     "A shifa dua, personalized.\n\nWords of healing in verified Arabic, with their name. A get-well or comfort keepsake, from Sahih al-Bukhari." + CTA),
]


def content_post(day, bg, out):
    translit = day["translit"].split("·")[0].strip()
    T.letters(bg, day["letters"], translit, day["gloss"], out)
    story2 = ". ".join(day["story"].split(". ")[:2]) + "."
    cap = f"{translit} — {day['gloss'].replace(' · ', ', ')}\n\n{story2}\n\n{HASH_CONTENT}"
    # keep the owner rule: no em dashes. use a middot instead.
    cap = cap.replace(" — ", "  ·  ")
    return cap


def build(start_date, ndays=30):
    from datetime import date, timedelta
    y, m, dd = map(int, start_date.split("-"))
    d0 = date(y, m, dd)
    posts = []
    bi = 0
    pi = 0
    content_roots = [d for d in DAYS]  # rotate through all roots for content
    ci = 0
    for i in range(ndays):
        the_date = (d0 + timedelta(days=i)).isoformat()
        # every 3rd day is a product spotlight; others are root content
        if i % 3 == 2:
            img, cap = PRODUCTS[pi % len(PRODUCTS)]; pi += 1
            posts.append(dict(image=img, caption=cap, date=the_date, kind="product"))
        else:
            day = content_roots[ci % len(content_roots)]; ci += 1
            bg = BW.CLEAN[bi % len(BW.CLEAN)]; bi += 1
            out = os.path.join(OUT, f"ig{i+1:02d}_{BW.key(day['translit'])}.jpg")
            cap = content_post(day, bg, out)
            posts.append(dict(image=out, caption=cap, date=the_date, kind="content"))
    with open(os.path.join(OUT, "posts.json"), "w") as f:
        json.dump(posts, f, ensure_ascii=False, indent=2)
    print(f"BUILT {len(posts)} IG/FB posts ({sum(p['kind']=='product' for p in posts)} product, "
          f"{sum(p['kind']=='content' for p in posts)} content) -> {OUT}")
    return posts


if __name__ == "__main__":
    start = sys.argv[1] if len(sys.argv) > 1 else "2026-07-09"
    build(start, int(sys.argv[2]) if len(sys.argv) > 2 else 30)
