#!/usr/bin/env python3
# VARIED listing mockups: the fix for "every product looks the same on Etsy".
# Same print house-style, but each hero varies frame colour, wall tone, and
# composition (hung on a wall vs leaning on a wood ledge) so the shop GRID reads
# as distinct products. Brand-controlled, no stock photos. 1080x1080 hero.
import os
from PIL import Image, ImageDraw, ImageFilter
import numpy as np

SCR = "/tmp/claude-0/-home-user-Ketabistudio-web/cd7de56a-bf46-5546-8ecd-6e0295c3376d/scratchpad"
W = H = 1080

FRAMES = {
    "black": dict(edge=(38, 34, 30), bevel=(58, 52, 46)),
    "wood":  dict(edge=(120, 86, 54), bevel=(150, 112, 74)),
    "white": dict(edge=(238, 234, 226), bevel=(250, 247, 241)),
    "gold":  dict(edge=(178, 142, 74), bevel=(206, 172, 104)),
}


def _wall(base, light=(0.35, 0.30)):
    im = np.full((H, W, 3), base, np.float32)
    yy, xx = np.mgrid[0:H, 0:W].astype(np.float32)
    g = np.clip(1 - (((xx - light[0] * W) / (1.15 * W)) ** 2 +
                     ((yy - light[1] * H) / (1.15 * H)) ** 2), 0, 1)[..., None]
    im += g * 18
    im += np.random.default_rng(7).normal(0, 2.0, (H, W, 1))
    return Image.fromarray(np.clip(im, 0, 255).astype("uint8"))


def _framed(art, fw, frame_style, mat=44, frame=22):
    """Return an RGBA layer of the matted, framed print (portrait 4:5)."""
    fh = int(fw * 1350 / 1080)
    fs = FRAMES[frame_style]
    layer = Image.new("RGBA", (fw + 2 * frame, fh + 2 * frame), (0, 0, 0, 0))
    d = ImageDraw.Draw(layer)
    # frame with a subtle inner bevel highlight
    d.rectangle([0, 0, fw + 2 * frame - 1, fh + 2 * frame - 1], fill=fs["edge"] + (255,))
    d.rectangle([frame - 4, frame - 4, fw + frame + 3, fh + frame + 3], fill=fs["bevel"] + (255,))
    # ivory mat
    d.rectangle([frame, frame, fw + frame, fh + frame], fill=(243, 238, 229, 255))
    inner = art.resize((fw - 2 * mat, fh - 2 * mat), Image.LANCZOS).convert("RGBA")
    layer.paste(inner, (frame + mat, frame + mat))
    # thin gold liner around the art window
    d.rectangle([frame + mat - 3, frame + mat - 3, fw + frame - mat + 2, fh + frame - mat + 2],
                outline=(176, 140, 66, 255), width=2)
    return layer


def _shadow(size, offset, blur, alpha):
    sh = Image.new("RGBA", (W, H), (0, 0, 0, 0))
    d = ImageDraw.Draw(sh)
    x, y, w, h = offset[0], offset[1], size[0], size[1]
    d.rectangle([x, y, x + w, y + h], fill=(28, 22, 16, alpha))
    return sh.filter(ImageFilter.GaussianBlur(blur))


def hung(art, out, wall, frame_style, fw=600):
    """Print hung centred on a wall."""
    im = _wall(wall).convert("RGBA")
    fl = _framed(art, fw, frame_style)
    fx, fy = (W - fl.width) // 2, (H - fl.height) // 2 - 8
    im = Image.alpha_composite(im, _shadow((fl.width, fl.height), (fx + 14, fy + 20), 20, 80))
    im.alpha_composite(fl, (fx, fy))
    im.convert("RGB").save(out, quality=92)
    return out


def leaning(art, out, wall, frame_style, ledge=(196, 176, 150), fw=560):
    """Print leaning on a wood ledge, gallery style."""
    # build wall + ledge in RGB, then move to RGBA for compositing
    ly = int(H * 0.80)
    la = np.asarray(_wall(wall)).astype(np.float32)  # RGB
    shelf = np.array(ledge, np.float32)
    grad = np.linspace(1.06, 0.82, H - ly)[:, None, None]
    la[ly:, :, :] = shelf[None, None, :] * grad
    la[ly:ly + 3, :, :] *= 1.15  # front lip highlight
    im = Image.fromarray(np.clip(la, 0, 255).astype("uint8")).convert("RGBA")
    fl = _framed(art, fw, frame_style)
    fx = (W - fl.width) // 2 + 6
    fy = ly - fl.height + 6
    # contact shadow under the frame on the ledge + soft cast up the wall
    im = Image.alpha_composite(im, _shadow((fl.width, 40), (fx - 4, ly - 10), 16, 120))
    im = Image.alpha_composite(im, _shadow((fl.width, fl.height), (fx + 22, fy + 8), 26, 55))
    im.alpha_composite(fl, (fx, fy))
    im.convert("RGB").save(out, quality=92)
    return out


# product -> (source art, wall tone, frame style, composition)
CONFIG = {
    "teacher": (f"{SCR}/keepsake_teacher.png", (214, 210, 198), "wood",  "hung"),
    "hajj":    (f"{SCR}/keepsake_hajj.png",    (222, 212, 196), "black", "leaning"),
    "birth":   (f"{SCR}/keepsake_birth.png",   (206, 212, 216), "white", "hung"),
    "home":    (f"{SCR}/keepsake_home.png",    (210, 200, 186), "wood",  "leaning"),
    "protect": (f"{SCR}/keepsake_protect.png", (210, 210, 206), "white", "hung"),
    "parents": (f"{SCR}/keepsake_parents.png", (216, 206, 194), "gold",  "leaning"),
    "wedding": (f"{SCR}/keepsake_wedding.png", (222, 208, 206), "gold",  "leaning"),
    "getwell": (f"{SCR}/keepsake_getwell.png", (206, 214, 210), "white", "hung"),
    "name":    (f"{SCR}/names/np_noor.png",    (204, 196, 184), "black", "hung"),
}


def render(key, out):
    art_path, wall, fstyle, comp = CONFIG[key]
    art = Image.open(art_path).convert("RGB")
    if comp == "hung":
        return hung(art, out, wall, fstyle)
    return leaning(art, out, wall, fstyle)


if __name__ == "__main__":
    import sys
    outdir = os.path.join(os.path.dirname(os.path.abspath(__file__)), "_mockups")
    os.makedirs(outdir, exist_ok=True)
    keys = sys.argv[1:] or list(CONFIG.keys())
    made = []
    for k in keys:
        out = os.path.join(outdir, f"mock_{k}.jpg")
        render(k, out); made.append((k, out)); print("OK", k)
    # before/after style sheet (just the new ones, gridded)
    cols = min(4, len(made)); tw = 340
    rows = (len(made) + cols - 1) // cols
    sheet = Image.new("RGB", (tw * cols + 10 * (cols + 1), tw * rows + 10 * (rows + 1)), (22, 22, 22))
    for i, (k, p) in enumerate(made):
        r, c = divmod(i, cols)
        sheet.paste(Image.open(p).resize((tw, tw), Image.LANCZOS), (10 + c * (tw + 10), 10 + r * (tw + 10)))
    sheet.save(os.path.join(os.path.dirname(outdir), "_mockups_sheet.jpg"), quality=92)
    print("SHEET", len(made))
