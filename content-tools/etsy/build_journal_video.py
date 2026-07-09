#!/usr/bin/env python3
# Etsy listing video for the journal: a quiet slideshow of REAL pages (cover,
# a story spread, a writing page, the tracker, the certificate) with a subtle
# Ken Burns drift and soft crossfades. No text claims, just the pages moving.
# 1080x1350 (4:5), ~8s, silent mp4. Uses the ffmpeg bundled with imageio_ffmpeg.
import os, sys
import numpy as np
from PIL import Image
import imageio_ffmpeg

SRC = sys.argv[1] if len(sys.argv) > 1 else "/tmp/journal2"
OUT = sys.argv[2] if len(sys.argv) > 2 else "/tmp/journal_video.mp4"
W, H, FPS = 1080, 1350, 30
BG = (238, 232, 221)

PAGES = ["p000_title.png", "p001a_story.png", "p001b_write.png",
         "p900_tracker.png", "p999_certificate.png"]

HOLD = 1.45   # seconds a page is fully alone-ish
XF = 0.55     # crossfade seconds
Z0, Z1 = 1.0, 1.045   # ken burns zoom range


def _bg():
    a = np.full((H, W, 3), BG, np.float32)
    yy, xx = np.mgrid[0:H, 0:W].astype(np.float32)
    v = 1 - 0.06 * (((xx - .5 * W) / W) ** 2 + ((yy - .5 * H) / H) ** 2)
    return a * v[..., None]


BASE = _bg()


def _fit(path):
    im = Image.open(path).convert("RGB")
    scale = min((W - 96) / im.width, (H - 96) / im.height)
    return im.resize((int(im.width * scale), int(im.height * scale)), Image.LANCZOS)


FITTED = [_fit(os.path.join(SRC, p)) for p in PAGES]


def render(idx, phase):
    """Page idx composited on the background, ken-burns zoom by phase[0..1]."""
    z = Z0 + (Z1 - Z0) * phase
    src = FITTED[idx]
    nw, nh = int(src.width * z), int(src.height * z)
    im = src.resize((nw, nh), Image.LANCZOS)
    canvas = BASE.copy()
    # soft drop shadow
    x0, y0 = (W - nw) // 2, (H - nh) // 2
    sh = np.zeros((H, W), np.float32)
    pad = 14
    sh[max(0, y0 + pad):min(H, y0 + nh + pad), max(0, x0 + pad):min(W, x0 + nw + pad)] = 1.0
    # cheap blur via downscale-up
    from PIL import ImageFilter
    shim = Image.fromarray((sh * 60).astype("uint8")).filter(ImageFilter.GaussianBlur(18))
    canvas -= np.asarray(shim, np.float32)[..., None]
    ar = np.asarray(im, np.float32)
    yy0, xx0 = max(0, y0), max(0, x0)
    yy1, xx1 = min(H, y0 + nh), min(W, x0 + nw)
    sy0, sx0 = yy0 - y0, xx0 - x0
    canvas[yy0:yy1, xx0:xx1] = ar[sy0:sy0 + (yy1 - yy0), sx0:sx0 + (xx1 - xx0)]
    return np.clip(canvas, 0, 255).astype("uint8")


def main():
    hold_f = int(HOLD * FPS)
    xf_f = int(XF * FPS)
    writer = imageio_ffmpeg.write_frames(
        OUT, (W, H), fps=FPS, quality=8, macro_block_size=8,
        output_params=["-pix_fmt", "yuv420p"])
    writer.send(None)
    n = len(PAGES)
    total_hold = hold_f
    for i in range(n):
        # solo hold
        for f in range(total_hold):
            ph = (i * (total_hold) + f) / (n * total_hold)  # slow global drift
            writer.send(np.ascontiguousarray(render(i, min(1.0, ph))))
        # crossfade into next
        if i < n - 1:
            for f in range(xf_f):
                t = f / xf_f
                pa = min(1.0, (i * total_hold + total_hold + f) / (n * total_hold))
                pb = min(1.0, ((i + 1) * total_hold + f) / (n * total_hold))
                a = render(i, pa).astype(np.float32)
                b = render(i + 1, pb).astype(np.float32)
                writer.send(np.ascontiguousarray(
                    (a * (1 - t) + b * t).astype("uint8")))
    writer.close()
    mb = os.path.getsize(OUT) / 1048576
    dur = (n * hold_f + (n - 1) * xf_f) / FPS
    print(f"video: {OUT} | {dur:.1f}s | {mb:.1f}MB | {W}x{H}")


if __name__ == "__main__":
    main()
