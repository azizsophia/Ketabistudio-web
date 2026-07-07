#!/usr/bin/env python3
# "The Names of a Family" — premium personalized print: every family member's
# name traced to its verified root + the ayah it carries. 3-7 names per print.
# Reuses the verified NAMES library (name_data.py); any name not in the library
# gets verified before rendering (never ship unverified). Premium tier $25-35.
import os, sys, numpy as np
from PIL import Image, ImageDraw, ImageFont

_HERE = os.path.dirname(os.path.abspath(__file__))
sys.path.insert(0, _HERE)
FONTS = os.path.join(_HERE, "..", "..", "worker", "fonts")
PLAY    = os.path.join(FONTS, "PlayfairDisplay.ttf")
PLAY_IT = os.path.join(FONTS, "PlayfairDisplay-Italic.ttf")
AMIRI   = os.path.join(FONTS, "Amiri-Bold.ttf")
BW, BH = 1080, 1350

BG=(240,234,223); INK=(42,60,52); SOFT=(112,120,108); GOLD=(176,140,66)
MARK=(150,132,96); BORDER=(196,170,110)

def _base(W, H):
    im = Image.new("RGB", (W, H), BG)
    a = np.asarray(im).astype(np.float32)
    yy, xx = np.mgrid[0:H, 0:W].astype(np.float32)
    d = ((xx-.5*W)/(.72*W))**2 + ((yy-.44*H)/(.60*H))**2
    a = a*np.clip(1-0.09*np.clip(d,0,1),0.91,1)[...,None] + np.random.default_rng(3).normal(0,3.2,(H,W,1))
    im = Image.fromarray(np.clip(a,0,255).astype("uint8"))
    bw = max(2, round(2*(W/BW)))
    ImageDraw.Draw(im).rectangle([round(46*W/BW), round(46*H/BH), W-round(46*W/BW), H-round(46*H/BH)],
                                 outline=BORDER, width=bw)
    return im

def _center(d, t, f, fill, y, W, ls=0):
    if ls:
        wd = sum(d.textlength(c, font=f)+ls for c in t)-ls; x=(W-wd)/2
        for c in t: d.text((x,y),c,font=f,fill=fill); x+=d.textlength(c,font=f)+ls
    else:
        d.text(((W-d.textlength(t,font=f))/2,y),t,font=f,fill=fill)

def render_family(family_name, members, out_path, sc=1.0):
    """members: list of dicts {arabic, translit, line} where line is the verified
    one-line connection (e.g. 'its root lights An-Nur 24:35')."""
    n = len(members)
    W, H = round(BW*sc), round(BH*sc)
    def S(x): return round(x*sc)
    im = _base(W, H); d = ImageDraw.Draw(im)
    f_tag  = ImageFont.truetype(PLAY, S(24))
    f_fam  = ImageFont.truetype(PLAY_IT, S(64))

    _center(d, "THE NAMES OF A FAMILY, WRITTEN INTO THE QUR'AN", f_tag, GOLD, S(100), W, ls=S(4))
    _center(d, family_name, f_fam, INK, S(160), W)
    d.line([(W//2-S(34), S(268)), (W//2+S(34), S(268))], fill=GOLD, width=max(2,S(2)))

    # measured sequential stack with AUTO-FIT: shrink fonts until the true
    # measured total (real Amiri bboxes incl. harakat) fits the page. Rows can
    # never collide or overflow by construction.
    top, bot = S(310), H - S(165)
    G_AR, G_TR = S(14), S(8)
    for ar_sz in (96, 88, 80, 72, 66, 60, 54, 48):
        f_ar = ImageFont.truetype(AMIRI, S(ar_sz))
        f_tr = ImageFont.truetype(PLAY_IT, S(max(28, int(ar_sz*0.42))))
        f_ln = ImageFont.truetype(PLAY, S(max(22, int(ar_sz*0.28))))
        tr_h = sum(f_tr.getmetrics()); ln_h = sum(f_ln.getmetrics())
        G_ROW = S(max(24, int(ar_sz*0.42)))
        rows = []
        for m in members:
            bb = d.textbbox((0, 0), m["arabic"], font=f_ar)
            rows.append((m, bb, (bb[3]-bb[1]) + G_AR + tr_h + G_TR + ln_h))
        total = sum(r[2] for r in rows) + G_ROW * (n - 1)
        if total <= (bot - top):
            break
    y = top + max(0, ((bot - top) - total) / 2)
    for m, bb, rh in rows:
        d.text(((W-(bb[2]-bb[0]))/2 - bb[0], y - bb[1]), m["arabic"], font=f_ar, fill=GOLD)
        yy = y + (bb[3]-bb[1]) + G_AR
        _center(d, m["translit"], f_tr, INK, yy, W)
        yy += tr_h + G_TR
        _center(d, m["line"], f_ln, SOFT, yy, W)
        y += rh + G_ROW

    d.line([(W//2-S(26), H-S(120)), (W//2+S(26), H-S(120))], fill=GOLD, width=max(2,S(2)))
    _center(d, "K E T A B I   S T U D I O", f_tag, MARK, H-S(102), W, ls=S(3))
    im.save(out_path)
    return out_path

# Sample family from the verified library
SAMPLE = ("The Yusuf Family", [
    dict(arabic="يُوسُف", translit="Yusuf", line="a prophet given a whole surah in his name · Surah Yusuf 12"),
    dict(arabic="عَائِشَة", translit="Aisha", line="from the root of a pleasant life · Qur'an 101:7"),
    dict(arabic="نُور", translit="Noor", line="the word Allah chose for His own light · Qur'an 24:35"),
    dict(arabic="زَيْد", translit="Zayd", line="the only companion named in the Qur'an · Qur'an 33:37"),
    dict(arabic="مَرْيَم", translit="Maryam", line="the only woman Allah names in the Qur'an · Qur'an 3:42"),
])

if __name__ == "__main__":
    out = sys.argv[1] if len(sys.argv) > 1 else "/tmp/family_print.png"
    render_family(SAMPLE[0], SAMPLE[1], out, sc=1.0)
    print("wrote", out)
