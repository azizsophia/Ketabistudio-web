#!/usr/bin/env python3
# Carousel 02 — qalb (the heart = "the thing that turns"). Same brand aesthetic
# as carousel 01: cream paper, slate-green ink, gold frame, real Amiri Arabic.
# Verified: qalb shares root ق ل ب with qalaba/taqallub (to turn/flip); the
# du'a "Ya Muqallib al-qulub..." is Tirmidhi 2140 (hasan), quoted verbatim.
import os
from playwright.sync_api import sync_playwright

D = os.path.dirname(os.path.abspath(__file__))
FONTS = "/home/user/Ketabistudio-web/worker/fonts"
EXE = "/opt/pw-browsers/chromium-1194/chrome-linux/chrome"

CSS = f"""
@font-face {{ font-family:'Playfair'; src:url('file://{FONTS}/PlayfairDisplay.ttf'); }}
@font-face {{ font-family:'PlayfairIt'; src:url('file://{FONTS}/PlayfairDisplay-Italic.ttf'); }}
@font-face {{ font-family:'CormorantIt'; src:url('file://{FONTS}/Cormorant-Italic.ttf'); }}
@font-face {{ font-family:'Amiri'; src:url('file://{FONTS}/Amiri-Regular.ttf'); }}
@font-face {{ font-family:'AmiriB'; src:url('file://{FONTS}/Amiri-Bold.ttf'); }}
*{{margin:0;padding:0;box-sizing:border-box}}
html,body{{width:1080px;height:1350px;overflow:hidden}}
.slide{{position:absolute;inset:0;background-size:cover;background-position:center;
  padding:130px 120px;color:#2f3b32;display:flex;flex-direction:column}}
.frame{{position:absolute;inset:44px;border:2px solid rgba(179,146,79,.55);pointer-events:none}}
.numwrap{{margin-bottom:40px}}
.rule{{width:44px;height:2px;background:#b3924f;opacity:.6;margin-bottom:14px}}
.num{{font-family:'Playfair',serif;font-size:26px;letter-spacing:5px;opacity:.55}}
.main{{font-family:'Playfair',serif;font-size:76px;line-height:1.22}}
.main .em{{font-family:'PlayfairIt',serif}}
.sub{{font-family:'CormorantIt',serif;font-size:44px;line-height:1.45;opacity:.78;margin-top:56px}}
.ar{{font-family:'AmiriB',serif;direction:rtl}}
.arBig{{font-size:200px;line-height:1.1;text-align:center}}
.arMed{{font-size:130px;line-height:1.3;text-align:center}}
.arDua{{font-family:'Amiri',serif;direction:rtl;font-size:66px;line-height:1.95;text-align:center;opacity:.95}}
.arWord{{font-family:'AmiriB',serif;font-size:88px;line-height:1.4}}
.pair{{display:flex;align-items:baseline;justify-content:center;gap:36px;margin-top:40px}}
.gloss{{font-family:'CormorantIt',serif;font-size:44px;opacity:.78}}
.center{{justify-content:center;text-align:center}}
.grow{{flex:1;display:flex;flex-direction:column;justify-content:center}}
.wm{{position:absolute;bottom:56px;right:64px;font-family:'CormorantIt',serif;
  font-size:27px;opacity:.42;letter-spacing:1px}}
.mark{{font-family:'Playfair',serif;letter-spacing:12px;font-size:36px;text-align:center}}
.goldrule{{width:70px;height:2px;background:#b3924f;opacity:.75;margin:34px auto}}
.tag{{font-family:'CormorantIt',serif;font-size:40px;opacity:.8;text-align:center;line-height:1.5}}
.foot{{font-family:'Playfair',serif;font-size:26px;letter-spacing:3px;opacity:.6;text-align:center;margin-top:60px}}
"""

def page(bg, body):
    return (f"<!DOCTYPE html><html><head><meta charset='utf-8'><style>{CSS}</style></head>"
            f"<body><div class='slide' style=\"background-image:url('file://{D}/{bg}')\">"
            f"<div class='frame'></div>{body}<div class='wm'>@ketabistudio</div></div></body></html>")

def num(n): return f"<div class='numwrap'><div class='rule'></div><div class='num'>0{n}</div></div>"

slides = [
    # 1 hook
    page("paper0.jpg",
        "<div class='grow center'>"
        "<div class='main' style='font-size:80px'>In Arabic, the word for<br>"
        "<span class='em'>the heart</span> comes from<br>a root that means:<br>to turn over.</div>"
        "<div class='sub'>once you see it, you feel it</div></div>"),
    # 2 the root
    page("paper1.jpg",
        num(2) +
        "<div class='grow'>"
        "<div class='ar arBig'>ق&nbsp;&nbsp;ل&nbsp;&nbsp;ب</div>"
        "<div class='main' style='font-size:60px;text-align:center;margin-top:90px'>Qalb. The heart.</div>"
        "<div class='pair'><span class='ar arWord'>قَلَبَ</span><span class='gloss'>qalaba, to flip, to overturn</span></div>"
        "</div>"),
    # 3 the meaning
    page("paper2.jpg",
        num(3) +
        "<div class='grow'><div class='main'>Your heart is named<br>after its own nature.<br>"
        "<span class='em'>Always turning.<br>Never still.</span></div>"
        "<div class='sub'>the word itself tells you</div></div>"),
    # 4 taqallub
    page("paper0.jpg",
        num(4) +
        "<div class='grow'><div class='ar arMed'>تَقَلُّب</div>"
        "<div class='main' style='font-size:56px;text-align:center;margin-top:50px'>"
        "The same root gives <span class='em'>taqallub</span>,<br>the turning of a heart<br>between states.</div>"
        "<div class='sub' style='text-align:center'>faith, then doubt, then hope,<br>then fear, and back again</div></div>"),
    # 5 the turn (emotional)
    page("paper1.jpg",
        num(5) +
        "<div class='grow'><div class='main' style='font-size:66px'>So when your heart<br>will not hold still,<br>"
        "that is not your failure.</div>"
        "<div class='sub'>it is the meaning of the word</div></div>"),
    # 6 the du'a
    page("paper2.jpg",
        "<div class='grow center'>"
        "<div class='main' style='font-size:52px'>The Prophet <span style='font-family:AmiriB'>&#65018;</span> often turned<br>to Allah by this name:</div>"
        "<div class='arDua' style='margin-top:56px'>يَا مُقَلِّبَ الْقُلُوبِ<br>ثَبِّتْ قَلْبِي عَلَىٰ دِينِكَ</div>"
        "<div class='sub' style='font-size:42px;margin-top:44px'>O Turner of hearts,<br>keep my heart firm upon Your religion.</div></div>"),
    # 7 brand close
    page("paper0.jpg",
        "<div class='grow center'>"
        "<div class='mark'>KETABI STUDIO</div><div class='goldrule'></div>"
        "<div class='tag'>keepsakes &amp; storybooks that plant<br>His words in little hearts</div>"
        "<div class='foot'>COMING SOON &nbsp;·&nbsp; KETABISTUDIO.COM</div></div>"),
]

with sync_playwright() as p:
    b = p.chromium.launch(executable_path=EXE, args=["--no-sandbox"])
    pg = b.new_page(viewport={"width": 1080, "height": 1350}, device_scale_factor=1)
    for i, html in enumerate(slides, 1):
        f = os.path.join(D, f"_q{i}.html"); open(f, "w").write(html)
        pg.goto("file://" + f, wait_until="networkidle"); pg.wait_for_timeout(250)
        pg.screenshot(path=os.path.join(D, f"c02_{i}.jpg"), type="jpeg", quality=93)
        print("slide", i)
    b.close()
print("DONE")
