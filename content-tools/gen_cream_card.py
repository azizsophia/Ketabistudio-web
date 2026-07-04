#!/usr/bin/env python3
# Cream typographic card — the LIGHT tile that alternates with dark filmic
# reminders in the curated grid. Warm cream ground, thin gold frame, letter-
# spaced KETABI STUDIO, a large Playfair line, a small italic sub, and the
# domain footer. Matches the existing branded cards. 1080x1350.
import sys, os
from PIL import Image, ImageDraw, ImageFont
import numpy as np

FONTS = "/home/user/Ketabistudio-web/worker/fonts"
PLAY = os.path.join(FONTS, "PlayfairDisplay.ttf")
PLAY_IT = os.path.join(FONTS, "PlayfairDisplay-Italic.ttf")
W, H = 1080, 1350
CREAM = (243, 238, 226)
INK = (47, 59, 50)      # deep slate green
GOLD = (192, 162, 86)
SUBINK = (120, 116, 100)

def wrap(draw, text, font, maxw):
    words = text.split(); lines=[]; cur=""
    for w in words:
        t=(cur+" "+w).strip()
        if draw.textlength(t,font=font)<=maxw: cur=t
        else:
            if cur: lines.append(cur)
            cur=w
    if cur: lines.append(cur)
    return lines

def make(line, out, sub="made with love, for mamas like you", brand="K E T A B I   S T U D I O"):
    im = Image.new("RGB",(W,H),CREAM)
    # faint warm paper texture
    a = np.asarray(im).astype(np.float32)
    a += np.random.default_rng(3).normal(0,2.5,(H,W,1))
    im = Image.fromarray(np.clip(a,0,255).astype("uint8"))
    d = ImageDraw.Draw(im)
    # thin gold frame
    m=54
    d.rectangle([m,m,W-m,H-m], outline=GOLD, width=2)
    # brand top
    fb=ImageFont.truetype(PLAY,26)
    bw=d.textlength(brand,font=fb)
    d.text(((W-bw)//2,120),brand,font=fb,fill=(150,128,74))
    # main line
    fs=70; font=ImageFont.truetype(PLAY,fs)
    lines=[]
    for para in line.replace("\\n","\n").split("\n"):
        lines+=wrap(d,para,font,W-260)
    lh=int(fs*1.24); total=lh*len(lines)
    y=H//2-total//2-20
    for ln in lines:
        w=d.textlength(ln,font=font); d.text(((W-w)//2,y),ln,font=font,fill=INK); y+=lh
    # gold rule
    ry=y+18
    d.line([(W//2-34,ry),(W//2+34,ry)],fill=GOLD,width=2)
    # italic sub
    fsub=ImageFont.truetype(PLAY_IT,34); sw=d.textlength(sub,font=fsub)
    d.text(((W-sw)//2,ry+22),sub,font=fsub,fill=SUBINK)
    # domain footer
    fd=ImageFont.truetype(PLAY,22); dom="ketabistudio.com"
    dw=d.textlength(dom,font=fd); d.text(((W-dw)//2,H-150),dom,font=fd,fill=(150,128,74))
    im.save(out,quality=93); print("saved",out)

if __name__=="__main__":
    line,out=sys.argv[1],sys.argv[2]
    sub=sys.argv[3] if len(sys.argv)>3 else "made with love, for mamas like you"
    make(line,out,sub)
