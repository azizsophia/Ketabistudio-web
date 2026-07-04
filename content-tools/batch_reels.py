#!/usr/bin/env python3
# Batch reel renderer. For each variant (background + 3 beat-lines) it film-
# grades the background, writes a per-variant HTML, screenshots 15s of frames
# via one shared Playwright browser, and encodes an <4.5MB mp4. Same aesthetic
# as the approved reel: band scrim for legibility, Ken-burns drift, gentle held
# end card.
import os, glob, subprocess
from PIL import Image, ImageEnhance, ImageFilter
import numpy as np
from playwright.sync_api import sync_playwright
import imageio_ffmpeg

D = os.path.dirname(os.path.abspath(__file__))
LUX = os.path.dirname(D)
EXE = "/opt/pw-browsers/chromium-1194/chrome-linux/chrome"
FPS, DUR = 25, 15.0
N = int(FPS*DUR)

# (out_name, background_file, [beat1, beat2, payoff], end_sub)
VARIANTS = [
    ("reel_window", "light.jpg",
     ["Allah is nearer to you", "than the weight you carry.", "turn to Him, and breathe."],
     "made with love, for mamas like you"),
    ("reel_quran", "c_8164567.jpg",
     ["Keep the Qur'an in your home,", "and it softens everything,", "even you, on the hard days."],
     "made with love, for mamas like you"),
    ("reel_beads", "t_36855575.jpg",
     ["Every dhikr you make", "slips through your fingers", "straight to the One who hears."],
     "made with love, for mamas like you"),
]

def grade(src_path):
    src = Image.open(src_path).convert("RGB")
    TW, TH = 1180, 2100
    sw, sh = src.size
    s = max(TW/sw, TH/sh)
    src = src.resize((int(sw*s+.5), int(sh*s+.5)), Image.LANCZOS)
    nw, nh = src.size
    src = src.crop(((nw-TW)//2, int((nh-TH)*0.40), (nw-TW)//2+TW, int((nh-TH)*0.40)+TH))
    a = np.asarray(src).astype(np.float32)*0.90 + 16
    a[...,0] *= 1.05; a[...,2] *= 0.93
    a = np.clip(a, 0, 255)
    im = Image.fromarray(a.astype("uint8"))
    im = ImageEnhance.Color(im).enhance(0.85)
    im = Image.blend(im, im.filter(ImageFilter.GaussianBlur(14)), 0.13)
    a = np.asarray(im).astype(np.float32) + np.random.default_rng(7).normal(0,8,(TH,TW,1))
    return Image.fromarray(np.clip(a,0,255).astype("uint8"))

HTML = """<!DOCTYPE html><html><head><meta charset="utf-8">
<link rel="preconnect" href="https://fonts.googleapis.com">
<link href="https://fonts.googleapis.com/css2?family=Playfair+Display:ital,wght@1,500;0,600&display=swap" rel="stylesheet">
<style>
 *{{margin:0;padding:0;box-sizing:border-box}}
 html,body{{width:1080px;height:1920px;overflow:hidden;background:#12140f}}
 #frame{{position:absolute;inset:0;overflow:hidden}}
 #bg{{position:absolute;left:50%;top:50%;width:1180px;height:2100px;object-fit:cover;transform:translate(-50%,-50%) scale(1.06)}}
 #scrim{{position:absolute;inset:0;background:linear-gradient(to top,
    rgba(12,14,10,.9) 0%, rgba(12,14,10,.7) 24%, rgba(12,14,10,.34) 46%, rgba(12,14,10,.08) 66%, rgba(12,14,10,0) 100%)}}
 #band{{position:absolute;inset:0;background:radial-gradient(ellipse 82% 30% at 50% 54%,
    rgba(10,12,9,.60) 0%, rgba(10,12,9,.34) 52%, rgba(10,12,9,0) 100%)}}
 .txt{{position:absolute;left:90px;right:90px;text-align:center;color:#f8f3ea;
      font-family:'Playfair Display',serif;font-style:italic;font-weight:500;
      text-shadow:0 2px 20px rgba(0,0,0,.6);opacity:0;line-height:1.2}}
 #l1{{bottom:1060px;font-size:78px}}
 #l2{{bottom:950px;font-size:78px}}
 #l3{{bottom:1000px;font-size:70px}}
 #end{{position:absolute;left:0;right:0;top:52%;text-align:center;opacity:0}}
 #mk{{font-family:'Playfair Display',serif;font-weight:600;font-style:normal;letter-spacing:11px;font-size:34px;color:#f4ecdb;text-shadow:0 2px 22px rgba(0,0,0,.7)}}
 #rule{{width:70px;height:2px;background:#c9a84c;opacity:.9;margin:26px auto;box-shadow:0 0 12px rgba(0,0,0,.5)}}
 #sub{{font-family:'Playfair Display',serif;font-style:italic;font-size:36px;color:#e3dccb;text-shadow:0 2px 20px rgba(0,0,0,.7)}}
</style></head><body>
<div id="frame">
  <img id="bg" src="{bg}">
  <div id="scrim"></div><div id="band"></div>
  <div class="txt" id="l1">{l1}</div>
  <div class="txt" id="l2">{l2}</div>
  <div class="txt" id="l3">{l3}</div>
  <div id="end"><div id="mk">KETABI STUDIO</div><div id="rule"></div><div id="sub">{sub}</div></div>
</div>
<script>
const $=id=>document.getElementById(id);
const c01=x=>Math.max(0,Math.min(1,x));
const oc=x=>1-Math.pow(1-x,3);
const io=x=>x<.5?2*x*x:1-Math.pow(-2*x+2,2)/2;
const seg=(t,a,b)=>c01((t-a)/(b-a));
function fade(el,inA,inB,outA,outB,t,rise){{
  el.style.opacity=seg(t,inA,inB)*(1-seg(t,outA,outB));
  if(rise!==undefined) el.style.transform=`translateY(${{(1-oc(seg(t,inA,inB)))*rise}}px)`;
}}
window.__seek=function(t){{
  const k=io(seg(t,0,16));
  $('bg').style.transform=`translate(-50%,${{-50-k*1.4}}%) scale(${{1.06-0.06*k}})`;
  fade($('l1'),0.5,1.7,7.4,8.2,t,20);
  fade($('l2'),2.6,3.9,7.4,8.2,t,20);
  fade($('l3'),8.9,10.1,12.0,12.7,t,20);
  $('end').style.opacity=oc(seg(t,12.7,14.0));
}};
__seek(0);
</script></body></html>"""

def esc(s): return s.replace("&","&amp;").replace("<","&lt;").replace(">","&gt;")

ff = imageio_ffmpeg.get_ffmpeg_exe()
fr = os.path.join(D, "bframes"); os.makedirs(fr, exist_ok=True)

with sync_playwright() as p:
    b = p.chromium.launch(executable_path=EXE, args=["--no-sandbox"])
    for name, bg, lines, sub in VARIANTS:
        grade(os.path.join(LUX, bg)).save(os.path.join(D, f"{name}_bg.jpg"), quality=90)
        html = HTML.format(bg=f"{name}_bg.jpg", l1=esc(lines[0]), l2=esc(lines[1]), l3=esc(lines[2]), sub=esc(sub))
        hp = os.path.join(D, f"{name}.html"); open(hp, "w").write(html)
        for f in glob.glob(fr+"/*.png"): os.remove(f)
        pg = b.new_page(viewport={"width":1080,"height":1920}, device_scale_factor=1)
        pg.goto("file://"+hp, wait_until="networkidle")
        try: pg.evaluate("document.fonts.ready")
        except Exception: pass
        pg.wait_for_timeout(400)
        for i in range(N):
            pg.evaluate(f"window.__seek({i/FPS})"); pg.screenshot(path=f"{fr}/f{i:04d}.png")
        pg.close()
        out = os.path.join(D, f"{name}.mp4")
        subprocess.run([ff,"-y","-framerate",str(FPS),"-i",f"{fr}/f%04d.png",
            "-c:v","libx264","-pix_fmt","yuv420p","-profile:v","high","-level","4.0",
            "-crf","25","-maxrate","2200k","-bufsize","4400k","-movflags","+faststart",
            "-vf","scale=1080:1920", out], check=True, stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL)
        print("ENCODED", name, round(os.path.getsize(out)/1024/1024,2), "MB")
    b.close()
print("ALL DONE")
