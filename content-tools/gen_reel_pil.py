#!/usr/bin/env python3
# Browser-free reel renderer. Replicates the approved reel (film-graded faceless
# bg, gentle ken-burns, 3 beat-lines in Playfair italic on a radial band scrim,
# gold KETABI STUDIO end card held to the finish) entirely in PIL/numpy, then
# ffmpeg. ~30s/reel, no Chromium, restart-proof. Uploads each reel on finish.
import os, sys, glob, json, subprocess
from PIL import Image, ImageEnhance, ImageFilter, ImageDraw, ImageFont
import numpy as np
import imageio_ffmpeg

D = os.path.dirname(os.path.abspath(__file__))
LUX = os.path.dirname(D)
FONTS = "/home/user/Ketabistudio-web/worker/fonts"
PLAY_IT = os.path.join(FONTS, "PlayfairDisplay-Italic.ttf")
PLAY = os.path.join(FONTS, "PlayfairDisplay.ttf")
FPS, DUR = 25, 15.0
N = int(FPS * DUR)
W, H = 1080, 1920
ff = imageio_ffmpeg.get_ffmpeg_exe()

# ── easing / timing (mirrors the HTML) ──
def c01(x): return max(0.0, min(1.0, x))
def oc(x): return 1 - (1 - x) ** 3
def io(x): return 2 * x * x if x < .5 else 1 - ((-2 * x + 2) ** 2) / 2
def seg(t, a, b): return c01((t - a) / (b - a))

def grade(src_path):
    src = Image.open(src_path).convert("RGB")
    TW, TH = 1180, 2100
    sw, sh = src.size
    s = max(TW / sw, TH / sh)
    src = src.resize((int(sw * s + .5), int(sh * s + .5)), Image.LANCZOS)
    nw, nh = src.size
    src = src.crop(((nw - TW) // 2, int((nh - TH) * 0.40), (nw - TW) // 2 + TW, int((nh - TH) * 0.40) + TH))
    a = np.asarray(src).astype(np.float32) * 0.90 + 16
    a[..., 0] *= 1.05; a[..., 2] *= 0.93
    a = np.clip(a, 0, 255)
    im = Image.fromarray(a.astype("uint8"))
    im = ImageEnhance.Color(im).enhance(0.85)
    im = Image.blend(im, im.filter(ImageFilter.GaussianBlur(14)), 0.13)
    a = np.asarray(im).astype(np.float32) + np.random.default_rng(7).normal(0, 8, (TH, TW, 1))
    return Image.fromarray(np.clip(a, 0, 255).astype("uint8"))

def scrim_overlay():
    # dark base rgba built from the linear (to-top) gradient + radial band,
    # matching the HTML values, composited alpha-over each frame.
    yy, xx = np.mgrid[0:H, 0:W].astype(np.float32)
    yn = 1 - yy / H  # 0 bottom -> 1 top, matches "to top"
    # linear stops: .9@0, .7@24, .34@46, .08@66, 0@100
    stops = [(0, .9), (.24, .7), (.46, .34), (.66, .08), (1, 0)]
    lin = np.interp(yn, [s[0] for s in stops], [s[1] for s in stops]).astype(np.float32)
    # radial band ellipse 82% x 30% at 50%,54%
    d = ((xx - .5 * W) / (.41 * W)) ** 2 + ((yy - .54 * H) / (.15 * H)) ** 2
    band = np.clip(1 - d, 0, 1)
    band = np.interp(band, [0, .48, 1], [0, .34, .60]).astype(np.float32)
    alpha = np.clip(np.maximum(lin, band), 0, 1)
    ov = np.zeros((H, W, 4), np.float32)
    ov[..., 0] = 11; ov[..., 1] = 13; ov[..., 2] = 10
    ov[..., 3] = alpha * 255
    return ov

def text_layer(text, font, fill, shadow=(0, 0, 0, 150)):
    tmp = Image.new("RGBA", (10, 10)); dd = ImageDraw.Draw(tmp)
    bb = dd.textbbox((0, 0), text, font=font)
    tw, th = bb[2] - bb[0], bb[3] - bb[1]
    pad = 40
    layer = Image.new("RGBA", (tw + pad * 2, th + pad * 2), (0, 0, 0, 0))
    d = ImageDraw.Draw(layer)
    ox, oy = pad - bb[0], pad - bb[1]
    d.text((ox, oy + 2), text, font=font, fill=shadow)
    d.text((ox, oy), text, font=font, fill=fill)
    return layer, tw, th

def render(name, bg_file, lines, sub):
    bg_full = grade(os.path.join(LUX, bg_file))  # 1180x2100
    BW, BH = bg_full.size
    scr = scrim_overlay()
    f_it = ImageFont.truetype(PLAY_IT, 78)
    f_it3 = ImageFont.truetype(PLAY_IT, 70)
    f_mk = ImageFont.truetype(PLAY, 34)
    f_sub = ImageFont.truetype(PLAY_IT, 36)
    L1 = text_layer(lines[0], f_it, (248, 243, 234, 255))
    L2 = text_layer(lines[1], f_it, (248, 243, 234, 255))
    L3 = text_layer(lines[2], f_it3, (248, 243, 234, 255))
    MK = text_layer("K E T A B I   S T U D I O", f_mk, (244, 236, 219, 255))
    SB = text_layer(sub, f_sub, (227, 220, 203, 255))

    fr = os.path.join(D, "pframes")
    os.makedirs(fr, exist_ok=True)
    for f in glob.glob(fr + "/*.png"):
        os.remove(f)

    for i in range(N):
        t = i / FPS
        k = io(seg(t, 0, 16))
        z = 1.06 - 0.06 * k
        # crop the 1180x2100 source to a z-scaled window centred, drift down w/ k
        cw, ch = W / z, H / z
        cx = BW / 2
        cy = BH / 2 + k * 0.014 * BH
        box = (cx - cw / 2, cy - ch / 2, cx + cw / 2, cy + ch / 2)
        frame = bg_full.resize((W, H), Image.LANCZOS, box=box).convert("RGBA")
        # scrim
        fa = np.asarray(frame).astype(np.float32)
        sa = scr[..., 3:4] / 255.0
        fa[..., :3] = fa[..., :3] * (1 - sa) + scr[..., :3] * sa
        frame = Image.fromarray(np.clip(fa, 0, 255).astype("uint8"), "RGBA")

        def place(layer_tuple, ybottom, alpha, rise):
            layer, tw, th = layer_tuple
            if alpha <= 0.003:
                return
            lyr = layer.copy()
            if alpha < 1:
                al = lyr.split()[3].point(lambda v: int(v * alpha))
                lyr.putalpha(al)
            x = (W - lyr.width) // 2
            y = int((H - ybottom) - lyr.height + rise)
            frame.alpha_composite(lyr, (x, y))

        # l1 + l2 (first phrase): in .5-1.7 / 2.6-3.9, out 7.4-8.2, rise 20
        a12out = 1 - seg(t, 7.4, 8.2)
        a1 = seg(t, .5, 1.7) * a12out
        a2 = seg(t, 2.6, 3.9) * a12out
        r1 = (1 - oc(seg(t, .5, 1.7))) * 20
        r2 = (1 - oc(seg(t, 2.6, 3.9))) * 20
        place(L1, 1060 - (78 * 1.2 - 78) / 2, a1, r1)
        place(L2, 950 - (78 * 1.2 - 78) / 2, a2, r2)
        # l3 (payoff): in 8.9-10.1 out 12-12.7
        a3 = seg(t, 8.9, 10.1) * (1 - seg(t, 12.0, 12.7))
        r3 = (1 - oc(seg(t, 8.9, 10.1))) * 20
        place(L3, 1000 - (70 * 1.2 - 70) / 2, a3, r3)
        # end card: fade 12.7-14 held. mark top:52% -> ybottom anchor
        ae = oc(seg(t, 12.7, 14.0))
        if ae > 0.003:
            mk, mtw, mth = MK
            sb, stw, sth = SB
            block = Image.new("RGBA", (W, 200), (0, 0, 0, 0))
            bd = ImageDraw.Draw(block)
            block.alpha_composite(mk, ((W - mk.width) // 2, 0))
            ry = mth + 46
            bd.line([(W // 2 - 35, ry), (W // 2 + 35, ry)], fill=(201, 168, 76, 255), width=2)
            block.alpha_composite(sb, ((W - sb.width) // 2, ry + 18))
            if ae < 1:
                block.putalpha(block.split()[3].point(lambda v: int(v * ae)))
            frame.alpha_composite(block, (0, int(H * 0.50)))

        frame.convert("RGB").save(f"{fr}/f{i:04d}.png")

    out = os.path.join(D, f"{name}.mp4")
    subprocess.run([ff, "-y", "-framerate", str(FPS), "-i", f"{fr}/f%04d.png",
        "-c:v", "libx264", "-pix_fmt", "yuv420p", "-profile:v", "high", "-level", "4.0",
        "-crf", "25", "-maxrate", "2200k", "-bufsize", "4400k", "-movflags", "+faststart",
        "-vf", "scale=1080:1920", out], check=True, stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL)
    mb = round(os.path.getsize(out) / 1024 / 1024, 2)
    print("ENCODED", name, mb, "MB", flush=True)
    # upload immediately
    r = subprocess.run(["curl", "-s", "-X", "POST",
        "https://www.ketabistudio.com/api/social/video",
        "-H", "Authorization: Bearer ketabi-cron-2027",
        "-F", f"file=@{out};type=video/mp4"], capture_output=True, text=True, timeout=120)
    url = json.loads(r.stdout).get("url", "")
    if url:
        with open(os.path.join(D, "reel_manifest.txt"), "a") as mf:
            mf.write(f"{name}\t{url}\n")
        print("UPLOADED", name, url, flush=True)
    return out

VARIANTS = [
    ("reel_rose", "im_18809860.jpg", ["Allah is Most Merciful.", "Be gentle with yourself", "as He is with you."]),
    ("reel_coffeewin", "c_13523793.jpg", ["The tea goes cold,", "the dua does not.", "He heard you."]),
    ("reel_quran_rope", "c_8164567.jpg", ["Hold onto His rope.", "On the days you slip,", "hold on tighter."]),
    ("reel_beads_names", "t_36855575.jpg", ["He has beautiful names,", "and He answers to them", "for you."]),
    ("reel_coffee_lost", "c_34531681.jpg", ["Whatever you lost,", "He is able", "to return it better."]),
    ("reel_quran_ayah", "c_29100259.jpg", ["Teach them one ayah,", "and watch it become", "the anchor of a life."]),
    ("reel_hand_count", "hand.jpg", ["You keep showing up.", "Allah keeps count", "of every single time."]),
    ("reel_window_fajr", "light.jpg", ["The light always returns.", "Fajr has never once", "failed to come."]),
]
SUB = "made with love, for mamas like you"

if __name__ == "__main__":
    only = sys.argv[1:] if len(sys.argv) > 1 else None
    for name, bg, lines in VARIANTS:
        if only and name not in only:
            continue
        out = os.path.join(D, f"{name}.mp4")
        if os.path.exists(out) and os.path.getsize(out) > 400000:
            print("SKIP", name, flush=True); continue
        render(name, bg, lines, SUB)
    print("ALL DONE")
