#!/usr/bin/env python3
"""
Ketabi Studio — "I Love My Hijab" Personalized Book Pipeline
=============================================================
Reads PSD files, toggles character variants, replaces placeholder text
with customer names, recolors mom/dad skin tones, and assembles a
print-ready PDF for Lulu fulfillment.

Usage:
    python modesty_pipeline.py --name "Amira" --skin "Dark" \
        --hair_color "Black" --hair_style "Long straight"
"""

import os, re, sys, math, argparse, traceback
from pathlib import Path
from psd_tools import PSDImage
from PIL import Image, ImageDraw, ImageFont, ImageFilter
import numpy as np
from reportlab.lib.units import inch
from reportlab.pdfgen import canvas as rl_canvas

# ─── Paths ───────────────────────────────────────────────────────────
PSD_DIR   = Path("modesty_files")
FONT_DIR  = Path("fonts")
OUTPUT_DIR = Path("output")

FONT_CROC  = str(FONT_DIR / "Crocodile Feet DEMO.otf")
FONT_BJOLA = str(FONT_DIR / "bjola.otf")

# ─── Print specs ─────────────────────────────────────────────────────
PAGE_SIZE_IN = 8.5
BLEED_IN     = 0.125
TOTAL_IN     = PAGE_SIZE_IN + 2 * BLEED_IN   # 8.75
DPI          = 300
CANVAS_PX    = 2550                            # PSD native size
TOTAL_PX     = int(TOTAL_IN * DPI)             # 2625 with bleed

# ─── Character variants ─────────────────────────────────────────────
SKIN_TONES  = ["Blonde light", "Blonde dark", "Dark"]
HAIR_COLORS = ["Red", "Blonde", "Brown", "Black"]
HAIR_STYLES = ["Short curly", "Long curly", "Short straight", "Long straight"]

FONT_MAP = {
    "CrocodileFeetDEMO-Regular": FONT_CROC,
    "Bjola": FONT_BJOLA,
}

# ─── Text colors ─────────────────────────────────────────────────────
BODY_TEXT   = (64, 61, 79, 255)       # dark navy — body text, most pages
BODY_LIGHT_CREAM = (250, 246, 238, 255)  # cream — for dark-background pages
DARK_BG_PAGES = {24}                  # night scene etc. — use cream text
TEXT_OUTLINE = (255, 255, 255, 90)    # (unused now; kept for back-compat)
ACCENT_PINK = (199, 107, 160, 255)    # back-compat only

# Back-compat aliases
BODY_DARK = BODY_TEXT
BODY_LIGHT = BODY_TEXT
LIGHT_TEXT_PAGES = set()

# Accent words per page (the bold, colored words — like the original).
# Restrained: the 1-2 most meaningful words per page. The COLOR is not
# fixed here; it is sampled per page from that page's illustration so it
# always complements the art. Accent words render in the bold font.
ACCENTS = {
    1:  ["beautiful world"],
    2:  ["new adventure"],
    3:  ["something\rspecial"],
    4:  ["special"],
    5:  ["curiosity"],
    6:  ["hijab", "best self"],
    7:  ["love for Allah", "proud"],
    8:  ["most beautiful scarf"],
    9:  ["crown", "princess"],
    10: ["cape"],
    11: ["Allah loves us", "goodness"],
    12: ["tall", "proud"],
    13: ["special", "shine"],
    14: ["part of her"],
    15: ["beautiful", "rainbow"],
    16: ["hijab", "who I want to be"],
    17: ["even more you"],
    18: ["kind", "grateful"],
    19: ["mosque", "luckiest girl"],
    20: ["Prophet Muhammad", "greatest treasure"],
    21: ["how they treated each other"],
    22: ["so proud of you", "warmest"],
    23: ["Thank you, Allah", "beautiful hijab"],
    24: ["who she was"],
    25: ["modesty", "carrying a piece of heaven"],
}

ACCENT_FONT = "CrocodileFeetDEMO-Regular"  # same font as body, just recolored (matches original)

# Per-page accent colors sampled/read from the reference PDF
# (Modesty_01_colored). Body is navy; accent words are the SAME font,
# simply recolored. Each page has its own warm/cool accent hue.
ACCENT_COLORS = {
    1:  (230, 138, 28),    # orange
    2:  (60, 140, 150),    # teal
    3:  (176, 96, 56),     # terracotta
    4:  (208, 96, 48),     # red-orange
    5:  (150, 80, 158),    # purple
    6:  (214, 158, 18),    # gold
    7:  (0, 130, 130),     # teal
    8:  (52, 150, 168),    # blue-teal
    9:  (150, 84, 44),     # warm brown-orange
    10: (210, 130, 36),    # orange
    11: (0, 132, 128),     # teal
    12: (206, 100, 64),    # coral
    13: (18, 132, 146),    # teal
    14: (196, 158, 32),    # gold
    15: (200, 110, 70),    # coral
    16: (214, 150, 24),    # amber
    17: (60, 150, 140),    # teal
    18: (120, 140, 30),    # olive-green
    19: (210, 170, 30),    # gold
    20: (206, 150, 24),    # gold
    21: (120, 140, 30),    # green
    22: (150, 86, 162),    # purple
    23: (160, 80, 124),    # magenta
    24: (210, 168, 24),    # gold
    25: (170, 80, 130),    # rose-magenta (closing page)
}

# Text vertical/horizontal anchor per page, read from the reference PDF.
# v: "top" | "bottom"; h: "left" | "center" | "right". Most are top-center.
# Precise text placement per page, measured from the reference PDF.
# top_y = fraction of page height where the text block STARTS.
# h = horizontal anchor (left|center|right). v kept for back-compat.
# Most pages start near the top (~0.07-0.12); a few sit lower/bottom.
TEXT_POS = {
    1:  (0.085, "center"),       2:  (0.065, 0.58, 0.70),  3:  (0.565, "center", 0.58),
    4:  (0.075, 0.44),           5:  (0.065, "center"),        6:  (0.090, "right"),
    7:  (0.065, "left", 0.52),   8:  (0.640, "left", 0.58),    9:  (0.065, "right"),
    10: (0.080, 0.56),           11: (0.065, "left", 0.52),    12: (0.215, "right", 0.46),
    13: (0.080, 0.56),           14: (0.055, 0.56),            15: (0.060, "center"),
    16: (0.080, "center"),       17: (0.075, "center"),        18: (0.060, "center"),
    19: (0.715, "left", 0.58),   20: (0.070, "center"),        21: (0.060, "center"),
    22: (0.038, "left"),         23: (0.065, "center", 0.52),  24: (0.200, 0.30),
    25: (0.810, "center"),
}

# (legacy) coarse anchor table — kept for back-compat
TEXT_ANCHORS = {
    1: ("top","center"),  2: ("top","center"),  3: ("bottom","center"),
    4: ("top","right"),   5: ("top","left"),    6: ("top","right"),
    7: ("top","center"),  8: ("bottom","center"),9: ("top","center"),
    10:("top","center"),  11:("top","center"),  12:("top","right"),
    13:("top","center"),  14:("top","center"),  15:("top","right"),
    16:("top","center"),  17:("top","center"),  18:("top","center"),
    19:("top","center"),  20:("top","right"),   21:("top","center"),
    22:("top","center"),  23:("top","center"),  24:("top","center"),
    25:("bottom","center"),
}

# Page 25 is the book's closing lines (was baked into the art; now
# rendered by the pipeline). Corrected copy, name substituted.
PAGE25_TEXT = (
    "From that day on,\r(Child's Name) embraced modesty with joy,\r"
    "knowing it was a special part of her identity and faith.\r"
    "She felt like she was carrying a piece of heaven\r"
    "with her everywhere she went."
)

# ─── Mom/dad recolor pages ───────────────────────────────────────────
MOM_PAGES = {3, 4, 6, 8, 9, 10, 11, 13, 14, 19, 20, 22}
SKIN_MAP  = {"Blonde light": "light", "Blonde dark": "medium", "Dark": "dark"}

# ─── Story text (all 25 pages) ───────────────────────────────────────
def sample_accent_color(img, bbox=None):
    """Pick a vibrant accent color from the illustration that reads clearly
    as text: samples saturated mid-to-deep pixels (avoiding pale background
    and white), returns the dominant rich hue darkened slightly so it stays
    legible on light page areas."""
    import numpy as np
    from collections import Counter
    a = np.array(img.convert("RGB"))
    flat = a.reshape(-1, 3).astype(int)
    r, g, b = flat[:, 0], flat[:, 1], flat[:, 2]
    mx = np.maximum(np.maximum(r, g), b)
    mn = np.minimum(np.minimum(r, g), b)
    sat = mx - mn
    bright = flat.sum(axis=1)
    keep = (sat > 70) & (bright > 180) & (bright < 560)
    pick = flat[keep]
    if len(pick) < 50:
        return (199, 107, 160)
    q = (pick // 28 * 28)
    common = Counter(map(tuple, q)).most_common(6)
    best = max(common, key=lambda kv: (max(kv[0]) - min(kv[0])))[0]
    # Boost saturation a touch and darken slightly so the accent pops on
    # light page areas, like the original's vivid accents.
    import colorsys
    rr, gg, bb = [c / 255 for c in best]
    h, s, v = colorsys.rgb_to_hsv(rr, gg, bb)
    s = min(1.0, s * 1.35)
    v = min(0.92, v * 0.92)
    rr, gg, bb = colorsys.hsv_to_rgb(h, s, v)
    return (int(rr * 255), int(gg * 255), int(bb * 255))


def build_accent_runs(text, accent_phrases, font_name, font_size,
                      body_color=None, accent_color=None, accent_font=None):
    """Accent phrases get the accent color + bold accent font; the rest the
    body color/font. \\r line breaks preserved. Matched left-to-right."""
    body_color = body_color or BODY_TEXT
    accent_color = accent_color or ACCENT_PINK
    accent_font = accent_font or font_name
    spans = []
    search_from = 0
    for phrase in accent_phrases:
        idx = text.find(phrase, search_from)
        if idx == -1:
            idx = text.find(phrase)
        if idx != -1:
            spans.append((idx, idx + len(phrase)))
            search_from = idx + len(phrase)
    spans.sort()
    clean = []
    for s, e in spans:
        if clean and s < clean[-1][1]:
            continue
        clean.append((s, e))
    runs = []
    pos = 0
    for s, e in clean:
        if s > pos:
            runs.append({"text": text[pos:s], "font_name": font_name,
                         "font_size": font_size, "color": body_color})
        runs.append({"text": text[s:e], "font_name": accent_font,
                     "font_size": font_size, "color": accent_color})
        pos = e
    if pos < len(text):
        runs.append({"text": text[pos:], "font_name": font_name,
                     "font_size": font_size, "color": body_color})
    return runs


STORY = {
    1: (
        "In a town full of sunshine and flowers,\r"
        "where bees hummed and butterflies danced,\r"
        "there lived a girl named (Child's Name).\r"
        "She loved to laugh, to run, and to explore\r"
        "every corner of her beautiful world."
    ),
    2: (
        "(Child's Name) spent her days playing\r"
        "hopscotch on the sidewalk,\r"
        "racing bicycles with her neighbors,\r"
        "and kicking soccer balls until the sun went down.\r"
        "Every day was a new adventure."
    ),
    3: (
        "One afternoon, her mama called from the door.\r"
        "\"Come inside, habibti! I have something\r"
        "special to show you.\"\r"
        "(Child's Name) ran so fast\r"
        "her shoes nearly flew off!"
    ),
    4: (
        "They sat together on (Child's Name)'s bed.\r"
        "Mama tucked a strand of hair behind her ear\r"
        "and smiled.\r"
        "\"Do you know what makes Mama\r"
        "feel so special every day?\""
    ),
    5: (
        "(Child's Name) tilted her head.\r"
        "\"What is it, Mama?\"\r"
        "Her eyes grew wide with curiosity.\r"
        "She loved Mama's surprises."
    ),
    6: (
        "\"My hijab,\" Mama said softly.\r"
        "\"When I put it on, it reminds me\r"
        "to be kind, to be gentle,\r"
        "and to always be my best self.\r"
        "It's like a hug I carry with me all day.\""
    ),
    7: (
        "\"Muslim girls and women wear the hijab\r"
        "to show their love for Allah,\" Mama said.\r"
        "\"It's a way of saying, I am proud\r"
        "of who I am, inside and out.\""
    ),
    8: (
        "Mama walked to the closet and pulled out\r"
        "the most beautiful scarf\r"
        "(Child's Name) had ever seen.\r"
        "It was soft and pink with tiny flowers,\r"
        "and it shimmered in the light."
    ),
    9: (
        "Mama draped it gently around her.\r"
        "\"A hijab is like a crown,\" she whispered.\r"
        "\"It shows the world that you are brave,\r"
        "and kind, and loved.\"\r"
        "(Child's Name) felt like a princess."
    ),
    10: (
        "(Child's Name) twirled the soft fabric around her.\r"
        "\"But why do we wear it, Mama?\"\r"
        "she asked, swishing it like a cape."
    ),
    11: (
        "\"Because Allah loves us,\" Mama said,\r"
        "\"and the hijab helps us remember\r"
        "to fill our hearts with goodness.\r"
        "It's not just something we wear.\r"
        "It's something we feel.\""
    ),
    12: (
        "(Child's Name) looked in the mirror\r"
        "and couldn't stop smiling.\r"
        "There she was, the same (Child's Name),\r"
        "but something felt different.\r"
        "She felt tall. She felt proud."
    ),
    13: (
        "Mama kissed her forehead.\r"
        "\"My beautiful girl,\" she said.\r"
        "\"The hijab is special because you are special.\r"
        "Wear it with love, and it will shine.\""
    ),
    14: (
        "After that day, (Child's Name) wore her hijab\r"
        "while swinging high in the trees,\r"
        "while reading her favorite stories,\r"
        "and while baking cookies with Mama.\r"
        "It was part of her, like her smile."
    ),
    15: (
        "When her friend came to visit,\r"
        "she noticed right away.\r"
        "\"You look so beautiful, (Child's Name)!\"\r"
        "she said. \"Like a rainbow after the rain!\""
    ),
    16: (
        "(Child's Name) smiled and said,\r"
        "\"I love my hijab!\r"
        "It reminds me to be kind and good.\r"
        "It's not just about what I wear.\r"
        "It's about who I want to be.\""
    ),
    17: (
        "Her friend's face lit up.\r"
        "\"That's so cool!\" she said.\r"
        "\"I love that you wear it.\r"
        "It makes you even more you!\""
    ),
    18: (
        "They jumped on the bed\r"
        "and laughed until their cheeks hurt.\r"
        "Being kind, being grateful,\r"
        "being themselves -- that was the best feeling\r"
        "in the whole wide world."
    ),
    19: (
        "That evening, (Child's Name) and her family\r"
        "walked to the mosque together.\r"
        "Mama held one hand, Baba held the other,\r"
        "and (Child's Name) felt like\r"
        "the luckiest girl in the world."
    ),
    20: (
        "Inside, they sat on soft prayer mats\r"
        "and listened to the imam.\r"
        "He told stories about the Prophet Muhammad,\r"
        "peace be upon him,\r"
        "and how kindness is the greatest treasure."
    ),
    21: (
        "After the prayers,\r"
        "(Child's Name) and her friends\r"
        "played and laughed in the open air.\r"
        "It didn't matter what anyone wore.\r"
        "What mattered was how they treated each other."
    ),
    22: (
        "As the first stars appeared,\r"
        "Mama wrapped her arms around (Child's Name).\r"
        "\"I'm so proud of you, habibti,\" she said.\r"
        "And that hug felt like the warmest\r"
        "hijab in the world."
    ),
    23: (
        "(Child's Name) sat under the old tree\r"
        "and watched the sky turn pink and gold.\r"
        "\"Thank you, Allah,\" she whispered,\r"
        "\"for my family, my friends,\r"
        "and my beautiful hijab.\""
    ),
    24: (
        "That night, under the soft glow of the moon,\r"
        "(Child's Name) read her favorite du'a\r"
        "and smiled to herself.\r"
        "She knew exactly who she was."
    ),
    25: (
        "From that day on,\r"
        "(Child's Name) embraced modesty with joy,\r"
        "knowing it was a special part of her identity and faith.\r"
        "She felt like she was carrying a piece of heaven\r"
        "with her everywhere she went."
    ),
}


# ═════════════════════════════════════════════════════════════════════
#  PSD LAYER MANIPULATION
# ═════════════════════════════════════════════════════════════════════

def _normalize_skin_name(name):
    """Map PSD skin-group layer names to canonical skin tones, tolerating
    known typos (e.g. 'Blode light' on page 15) and minor whitespace/case
    variation. Returns the canonical name, or the stripped original if no
    confident match is found."""
    import difflib
    stripped = " ".join(name.strip().split())   # collapse internal spaces
    # Exact known-typo map
    typo_map = {
        "blode light": "Blonde light",
        "blonde light": "Blonde light",
        "blonde dark": "Blonde dark",
        "dark": "Dark",
    }
    key = stripped.lower()
    if key in typo_map:
        return typo_map[key]
    # Safe fuzzy fallback against canonical tones (high cutoff to avoid
    # ever picking the wrong tone)
    match = difflib.get_close_matches(stripped, SKIN_TONES, n=1, cutoff=0.85)
    if match:
        return match[0]
    return stripped


def _norm_layer(s):
    """Normalize a PSD layer name for matching: casefold, collapse all
    whitespace, treat hyphens/underscores as spaces. 'Long Straight',
    'long  straight', and 'Long-straight' all become 'long straight'."""
    return " ".join(s.replace("-", " ").replace("_", " ").split()).casefold()


class VariantError(RuntimeError):
    """Raised when a requested character variant cannot be matched to a
    PSD layer. MUST abort the render: a silent miss hides the character."""


def _set_skin_variant(group, skin_tone, hair_color, hair_style):
    """Toggle skin/hair layers inside a character group (Girl, Mother, Father)."""
    group.visible = True
    skin_matched = False
    for skin_group in group:
        if skin_group.kind != "group":
            continue
        normalized = _normalize_skin_name(skin_group.name)
        is_target_skin = normalized == skin_tone
        skin_group.visible = is_target_skin
        if not is_target_skin:
            continue
        skin_matched = True
        # Check if this group has hair sub-groups (pages 1-11 Girl only)
        has_hair_groups = any(
            c.kind == "group" and _norm_layer(c.name) in
            {_norm_layer(h) for h in HAIR_COLORS}
            for c in skin_group
        )
        if has_hair_groups:
            hair_matched = False
            for hair_group in skin_group:
                if hair_group.kind != "group":
                    continue
                is_target_hair = (
                    _norm_layer(hair_group.name) == _norm_layer(hair_color)
                )
                hair_group.visible = is_target_hair
                if is_target_hair:
                    hair_matched = True
                    style_matched = False
                    for style_layer in hair_group:
                        hit = (
                            _norm_layer(style_layer.name)
                            == _norm_layer(hair_style)
                        )
                        style_layer.visible = hit
                        style_matched = style_matched or hit
                    if not style_matched:
                        have = [s.name for s in hair_group]
                        raise VariantError(
                            f"No style layer matching {hair_style!r} in "
                            f"{group.name!r}>{skin_group.name!r}>"
                            f"{hair_group.name!r}; have: {have}"
                        )
            if not hair_matched:
                have = [h.name for h in skin_group if h.kind == "group"]
                raise VariantError(
                    f"No hair group matching {hair_color!r} in "
                    f"{group.name!r}>{skin_group.name!r}; have: {have}"
                )
        else:
            # Skin-only: show whatever child is inside
            for child in skin_group:
                child.visible = True
    if not skin_matched:
        have = [s.name for s in group if s.kind == "group"]
        raise VariantError(
            f"No skin group matching {skin_tone!r} in {group.name!r}; "
            f"have: {have}"
        )


def set_variant(psd, skin_tone, hair_color, hair_style):
    """Toggle PSD layers for Girl, Mother, and Father character groups."""
    CHARACTER_GROUPS = {"Girl", "Mother", "Father"}
    for layer in psd:
        if layer.kind == "group" and layer.name.strip() in CHARACTER_GROUPS:
            _set_skin_variant(layer, skin_tone, hair_color, hair_style)


# ═════════════════════════════════════════════════════════════════════
#  TEXT EXTRACTION & RENDERING
# ═════════════════════════════════════════════════════════════════════

def extract_text_layers(psd):
    """Walk the PSD tree and return parsed info for every type layer."""
    text_layers = []
    def _scan(layers):
        for layer in layers:
            if layer.kind == "type":
                text_layers.append(_parse_text_layer(layer))
            if hasattr(layer, "__iter__"):
                _scan(layer)
    _scan(psd)
    return text_layers


def _parse_text_layer(layer):
    ed = layer.engine_dict
    rd = layer.resource_dict
    text = layer.text
    fonts = [dict(f)["Name"] for f in rd.get("FontSet", [])]

    sr = ed.get("StyleRun", {})
    runs_data = sr.get("RunArray", [])
    lengths = sr.get("RunLengthArray", [])
    runs = []
    pos = 0
    for run, length in zip(runs_data, lengths):
        sd = run.get("StyleSheet", {}).get("StyleSheetData", {})
        font_idx = int(sd.get("Font", 0))
        font_name = fonts[font_idx] if font_idx < len(fonts) else fonts[0]
        font_size = float(sd.get("FontSize", 58))
        cv = sd.get("FillColor", {}).get("Values", [1.0, 0, 0, 0])
        color_rgb = (
            int(float(cv[1]) * 255),
            int(float(cv[2]) * 255),
            int(float(cv[3]) * 255),
            int(min(float(cv[0]), 1.0) * 255),
        )
        runs.append({
            "text": text[pos:pos + length],
            "font_name": font_name,
            "font_size": font_size,
            "color": color_rgb,
        })
        pos += length

    pr = ed.get("ParagraphRun", {})
    para_runs = pr.get("RunArray", [])
    just = 2   # default center
    if para_runs:
        just = int(
            para_runs[0]
            .get("ParagraphSheet", {})
            .get("Properties", {})
            .get("Justification", 2)
        )

    return {
        "bbox": (layer.left, layer.top, layer.right, layer.bottom),
        "text": text,
        "runs": runs,
        "justification": just,
    }


import re as _re

# ─── Placeholder handling (production-critical) ──────────────────────
# Canonical placeholders. Matched case-insensitively with any apostrophe
# variant and flexible internal spacing, so customer orders never ship
# with an unreplaced placeholder.
_APOS = "['\u2019\u02bc\u0060\u00b4]"   # straight, curly, modifier, backtick, acute
CHILD_PLACEHOLDER_RE = _re.compile(
    r"\(\s*child\s*" + _APOS + r"?\s*s?\s*name\s*\)", _re.IGNORECASE
)
FRIEND_PLACEHOLDER_RE = _re.compile(
    r"\(\s*friend\s*" + _APOS + r"?\s*s?\s*name\s*\)", _re.IGNORECASE
)
# Safety net: catches ANY leftover placeholder-looking token after subbing
LEFTOVER_RE = _re.compile(
    r"\(\s*(?:child|friend|your|name)[^)]*\)|name\s*\)|\(\s*name",
    _re.IGNORECASE,
)


class PlaceholderError(Exception):
    """Raised when a placeholder survives substitution (blocks the order)."""
    pass


_FONT_CMAP_CACHE = {}

def _font_supported_chars(font_path=None):
    """Return the set of unicode code points the body font can render."""
    path = font_path or FONT_CROC
    if path not in _FONT_CMAP_CACHE:
        try:
            from fontTools.ttLib import TTFont
            tt = TTFont(path)
            _FONT_CMAP_CACHE[path] = set(tt.getBestCmap().keys())
        except Exception:
            _FONT_CMAP_CACHE[path] = None   # unknown -> skip the check
    return _FONT_CMAP_CACHE[path]


def clean_child_name(raw):
    """Validate & normalize a customer-entered child's name.
    Raises ValueError on clearly invalid input so a bad order is caught
    before any book is generated."""
    if raw is None:
        raise ValueError("Child name is required.")
    name = " ".join(str(raw).split())          # collapse whitespace
    name = name.strip()
    if not name:
        raise ValueError("Child name is empty.")
    if len(name) > 30:
        raise ValueError(f"Child name too long ({len(name)} chars, max 30).")
    # Reject placeholder syntax / control characters
    if "(" in name or ")" in name:
        raise ValueError("Child name contains invalid characters: ( )")
    if any(ord(c) < 32 for c in name):
        raise ValueError("Child name contains control characters.")
    # Reject characters the print font cannot render (would show as a
    # crocodile glyph). Apostrophes/hyphens are font-supported and fine.
    supported = _font_supported_chars()
    if supported is not None:
        bad = sorted({c for c in name if ord(c) not in supported})
        if bad:
            raise ValueError(
                "Child name contains characters the book font cannot "
                f"print: {' '.join(bad)}. Please use standard letters."
            )
    return name


def validate_no_placeholders(text, page_label=""):
    """Raise PlaceholderError if any placeholder fragment survives."""
    m = LEFTOVER_RE.search(text)
    if m:
        raise PlaceholderError(
            f"Unreplaced placeholder on {page_label}: '{m.group(0)}' "
            f"in text: {text[:120]!r}"
        )


def substitute_names(text_info, child_name):
    """Replace placeholder names across run boundaries."""
    runs = text_info["runs"]
    if not runs:
        return

    # Build per-character style index
    char_styles = []
    for i, run in enumerate(runs):
        char_styles.extend([i] * len(run["text"]))
    full_text = "".join(r["text"] for r in runs)

    # Apply regex substitutions, keeping char_styles aligned.
    def _sub_pattern(text, styles, pattern, replacement):
        out_text, out_styles, pos = [], [], 0
        for mt in pattern.finditer(text):
            s, e = mt.start(), mt.end()
            out_text.append(text[pos:s])
            out_styles.extend(styles[pos:s])
            si = styles[s] if s < len(styles) else (styles[-1] if styles else 0)
            out_text.append(replacement)
            out_styles.extend([si] * len(replacement))
            pos = e
        out_text.append(text[pos:])
        out_styles.extend(styles[pos:])
        return "".join(out_text), out_styles

    full_text, char_styles = _sub_pattern(
        full_text, char_styles, CHILD_PLACEHOLDER_RE, child_name)
    full_text, char_styles = _sub_pattern(
        full_text, char_styles, FRIEND_PLACEHOLDER_RE, "her friend")

    if not full_text:
        text_info["runs"] = []
        text_info["text"] = ""
        return

    # Rebuild runs from per-character styles
    new_runs = []
    cs = char_styles[0]
    ct = full_text[0]
    for i in range(1, len(full_text)):
        si = char_styles[i] if i < len(char_styles) else cs
        if si == cs:
            ct += full_text[i]
        else:
            t = runs[cs]
            new_runs.append({
                "text": ct,
                "font_name": t["font_name"],
                "font_size": t["font_size"],
                "color": t["color"],
            })
            cs = si
            ct = full_text[i]
    t = runs[min(cs, len(runs) - 1)]
    new_runs.append({
        "text": ct,
        "font_name": t["font_name"],
        "font_size": t["font_size"],
        "color": t["color"],
    })
    text_info["runs"] = new_runs
    text_info["text"] = full_text


def render_text_on_image(img, text_info, page_num=None, override_color=None):
    """Render story text exactly like the original book: dark navy body
    text with recolored accent words (same font), centered, with generous
    line spacing, sitting directly on the illustration. NO glow, NO panel,
    NO outline. Honors the story's own line breaks (\\r); only wraps a
    line if it genuinely exceeds the text-box width.
    """
    bbox = text_info["bbox"]
    just = text_info.get("justification", 2)
    runs = text_info["runs"]
    if not runs:
        return

    font_cache = {}

    def get_font(name, size):
        key = (name, int(size))
        if key not in font_cache:
            path = FONT_MAP.get(name, FONT_CROC)
            font_cache[key] = ImageFont.truetype(path, int(size))
        return font_cache[key]

    fsize = int(runs[0]["font_size"])

    # Character stream with (char, color, font_name, size); hard breaks on \r
    hard_lines = [[]]
    for run in runs:
        col = tuple((override_color if override_color else run["color"])[:3])
        fn = run["font_name"]
        for ch in sanitize_text(run["text"]):
            if ch == "\r":
                hard_lines.append([])
            else:
                hard_lines[-1].append((ch, col, fn, int(run["font_size"])))

    x_left, x_right = bbox[0], bbox[2]
    box_width = x_right - x_left

    def chunk_w(chars):
        if not chars:
            return 0
        s = "".join(c[0] for c in chars)
        f = get_font(chars[0][2], chars[0][3])
        b = f.getbbox(s)
        return b[2] - b[0]

    def line_width(line):
        w, i = 0, 0
        while i < len(line):
            fn, sz = line[i][2], line[i][3]
            j = i
            while j < len(line) and line[j][2] == fn and line[j][3] == sz:
                j += 1
            w += chunk_w(line[i:j])
            i = j
        return w

    # Honor the story's own line breaks; only wrap a hard line if it is
    # genuinely wider than the box.
    display = []
    for hl in hard_lines:
        if not hl:
            display.append([])
            continue
        if line_width(hl) <= box_width:
            display.append(hl)
            continue
        # wrap this overflowing line on spaces
        words, cur = [], []
        for tup in hl:
            if tup[0] == " ":
                if cur:
                    words.append(cur); cur = []
                words.append([tup])
            else:
                cur.append(tup)
        if cur:
            words.append(cur)
        line = []
        for word in words:
            is_space = (len(word) == 1 and word[0][0] == " ")
            if line and not is_space and line_width(line + word) > box_width:
                while line and line[-1][0] == " ":
                    line.pop()
                display.append(line)
                line = [] if is_space else list(word)
            else:
                line.extend(word)
        while line and line[-1][0] == " ":
            line.pop()
        if line:
            display.append(line)

    # Generous line spacing to match the original's airy feel (~1.55x).
    body_font = get_font(runs[0]["font_name"], fsize)
    ab = body_font.getbbox("Ayg")
    ascent = -ab[1]
    glyph_h = ab[3] - ab[1]
    line_h = int(glyph_h * 1.72)

    # Vertical placement. Default ("top") anchors the block at the bbox top,
    # as the legacy PSD path expects. The bases path passes valign="center" so
    # the (rewritten) story copy sits centered on the SAME region the original
    # text occupied — text_layout.json stores each page's tight original text
    # bbox, so centering reproduces the original placement even when the new
    # copy's line count differs slightly from the original's.
    block_h = len(display) * line_h
    if text_info.get("valign", "top") == "center":
        y = int((bbox[1] + bbox[3]) / 2 - block_h / 2)
    else:
        y = bbox[1]
    # Overflow guard: keep the block ~3% inside the top/bottom trim edge. This
    # still allows the original's snug bottom-of-page placements (~4% margin)
    # but prevents a taller-than-original block from spilling into the trim.
    guard = int(img.height * 0.03)
    y = max(guard, min(y, img.height - guard - block_h))

    draw = ImageDraw.Draw(img)
    for line in display:
        if not line:
            y += line_h
            continue
        lw = line_width(line)
        if just == 2:
            x = x_left + (box_width - lw) // 2
        elif just == 1:
            x = x_right - lw
        else:
            x = x_left
        i = 0
        while i < len(line):
            fn, sz, col = line[i][2], line[i][3], line[i][1]
            j = i
            while (j < len(line) and line[j][2] == fn
                   and line[j][3] == sz and line[j][1] == col):
                j += 1
            seg = "".join(c[0] for c in line[i:j])
            f = get_font(fn, sz)
            draw.text((x, y + ascent), seg, fill=col, font=f, anchor="ls")
            x += chunk_w(line[i:j])
            i = j
        y += line_h


# ═════════════════════════════════════════════════════════════════════
#  MOM / DAD SKIN-TONE RECOLORING
# ═════════════════════════════════════════════════════════════════════

def get_diff_mask(page_num):
    """Diff two girl variants to isolate the girl-character pixels."""
    variants = {}
    for skin in ["Blonde light", "Dark"]:
        psd = PSDImage.open(
            str(PSD_DIR / f"Modesty_{page_num:02d}_colored.psd")
        )
        set_variant(psd, skin, "Brown", "Long curly")
        # Hide text layers for clean diff
        for layer in psd.descendants():
            if layer.kind == "type":
                layer.visible = False
        img = psd.composite()
        if img.mode == "RGBA":
            bg = Image.new("RGB", img.size, (255, 255, 255))
            bg.paste(img, mask=img.split()[3])
            img = bg
        else:
            img = img.convert("RGB")
        variants[skin] = np.array(img, dtype=np.float32)
    diff = np.abs(variants["Blonde light"] - variants["Dark"]).sum(axis=2)
    return diff > 30


def recolor_mom(img, skin_label, diff_mask=None):
    """Shift mom/dad skin pixels to match the selected girl variant."""
    if skin_label == "light":
        return img

    arr = np.array(img, dtype=np.float32)
    r, g, b = arr[:, :, 0], arr[:, :, 1], arr[:, :, 2]

    # Detect skin-colored pixels (warm tones typical of the light-skin mom)
    skin_mask = (
        (r > 180) & (r < 255)
        & (g > 140) & (g < 230)
        & (b > 100) & (b < 200)
        & (r > g) & (g > b)
        & ((r - b) > 20)
        & ((r - g) < 80)
    )

    # Exclude the girl character pixels (already the right tone)
    if diff_mask is not None:
        skin_mask = skin_mask & ~diff_mask

    if skin_mask.sum() == 0:
        return img

    # Recolor multipliers
    if skin_label == "medium":
        rm, gm, bm = 0.85, 0.78, 0.72
    else:  # dark
        rm, gm, bm = 0.72, 0.58, 0.50

    # Gaussian-blur the mask edges for smooth blending
    mask_img = Image.fromarray((skin_mask * 255).astype(np.uint8))
    mask_blur = mask_img.filter(ImageFilter.GaussianBlur(radius=3))
    m = np.array(mask_blur, dtype=np.float32) / 255.0

    result = np.stack([
        arr[:, :, 0] * (1 - m) + arr[:, :, 0] * rm * m,
        arr[:, :, 1] * (1 - m) + arr[:, :, 1] * gm * m,
        arr[:, :, 2] * (1 - m) + arr[:, :, 2] * bm * m,
    ], axis=2)
    result = np.clip(result, 0, 255).astype(np.uint8)
    return Image.fromarray(result)


# ═════════════════════════════════════════════════════════════════════
#  BLEED / PAGE SIZING
# ═════════════════════════════════════════════════════════════════════

def add_bleed(img, target_px=TOTAL_PX):
    """Pad image from 2550 to 2625 px by extending edge pixels."""
    src_w, src_h = img.size
    if src_w == target_px and src_h == target_px:
        return img

    result = Image.new("RGB", (target_px, target_px), (255, 255, 255))
    ox = (target_px - src_w) // 2
    oy = (target_px - src_h) // 2
    result.paste(img, (ox, oy))

    # Extend edges for bleed
    if oy > 0:
        top_strip = img.crop((0, 0, src_w, 1))
        for y in range(oy):
            result.paste(top_strip, (ox, y))
        bot_strip = img.crop((0, src_h - 1, src_w, src_h))
        for y in range(oy + src_h, target_px):
            result.paste(bot_strip, (ox, y))
    if ox > 0:
        for x in range(ox):
            col = result.crop((ox, 0, ox + 1, target_px))
            result.paste(col, (x, 0))
        for x in range(ox + src_w, target_px):
            col = result.crop((ox + src_w - 1, 0, ox + src_w, target_px))
            result.paste(col, (x, 0))
    return result


# ═════════════════════════════════════════════════════════════════════
#  SINGLE PAGE GENERATION
# ═════════════════════════════════════════════════════════════════════

def generate_page(page_num, child_name, skin_tone, hair_color, hair_style,
                  diff_masks=None):
    """Generate one interior page as a print-ready PIL image."""
    child_name = clean_child_name(child_name)
    psd_path = PSD_DIR / f"Modesty_{page_num:02d}_colored.psd"
    if not psd_path.exists():
        raise FileNotFoundError(f"Missing PSD: {psd_path}")

    print(f"  Page {page_num:02d}: loading PSD...", end=" ", flush=True)
    psd = PSDImage.open(str(psd_path))

    # Page 17 has no character groups (friend-only, fixed illustration)
    if page_num != 17:
        set_variant(psd, skin_tone, hair_color, hair_style)

    # Hide original text layers — we'll render our own
    for layer in psd.descendants():
        if layer.kind == "type":
            layer.visible = False

    # Composite the illustration
    img = psd.composite()
    if img.mode == "RGBA":
        bg = Image.new("RGB", img.size, (255, 255, 255))
        bg.paste(img, mask=img.split()[3])
        img = bg
    else:
        img = img.convert("RGB")
    print("composited...", end=" ", flush=True)

    # Mom/dad skin recoloring (mom & dad are baked into background, not layered)
    skin_label = SKIN_MAP.get(skin_tone, "light")
    if page_num in MOM_PAGES and skin_label != "light":
        mask = diff_masks.get(page_num) if diff_masks else None
        img = recolor_mom(img, skin_label, diff_mask=mask)
        print("recolored mom...", end=" ", flush=True)

    # Build text info from story text
    # Re-open PSD to read original text layer positions
    psd_for_text = PSDImage.open(str(psd_path))
    text_layers = extract_text_layers(psd_for_text)

    if text_layers and page_num in STORY:
        # Use the first (main) text layer's bounding box and style
        tl = text_layers[0]
        # Override with new story text
        new_text = STORY[page_num]
        # Build a single-run text info with the child's name substituted
        text_color = (
            BODY_LIGHT if page_num in LIGHT_TEXT_PAGES else BODY_DARK
        )
        font_name = tl["runs"][0]["font_name"] if tl["runs"] else "CrocodileFeetDEMO-Regular"
        font_size = tl["runs"][0]["font_size"] if tl["runs"] else 58.0

        new_info = {
            "bbox": tl["bbox"],
            "text": new_text,
            "runs": [{
                "text": new_text,
                "font_name": font_name,
                "font_size": font_size,
                "color": text_color,
            }],
            "justification": tl["justification"],
        }
        # Substitute child's name
        substitute_names(new_info, child_name)
        # SAFETY GUARD: never render a page with a surviving placeholder
        validate_no_placeholders(new_info["text"], page_label=f"page {page_num}")
        # Render
        render_text_on_image(img, new_info, page_num=page_num)
        print("text rendered...", end=" ", flush=True)

    # Add bleed
    img = add_bleed(img)
    print("done.")
    return img


# ═════════════════════════════════════════════════════════════════════
#  COVER GENERATION
# ═════════════════════════════════════════════════════════════════════

def sanitize_text(s):
    """Replace characters the Crocodile Feet DEMO font lacks (renders as a
    crocodile glyph) with safe equivalents. Missing: : ; — –"""
    if not s:
        return s
    replacements = {
        "\u003a": ",",    # colon  -> comma
        "\u003b": ",",    # semicolon -> comma
        "\u2014": "--",   # em-dash -> double hyphen
        "\u2013": "-",    # en-dash -> hyphen
        "\u2026": "...",  # ellipsis -> three dots
    }
    for bad, good in replacements.items():
        s = s.replace(bad, good)
    return s


def _draw_wrapped(draw, text, font, fill, box, line_spacing=1.3, align="center"):
    """Word-wrap text within a box (x_left, y_top, x_right, y_bottom)."""
    text = sanitize_text(text)
    x_left, y_top, x_right, y_bottom = box
    max_width = x_right - x_left

    # Split on explicit paragraph breaks first
    paragraphs = text.split("\n\n")
    all_lines = []
    for para in paragraphs:
        words = para.replace("\n", " ").split()
        line = ""
        for word in words:
            test = (line + " " + word).strip()
            bb = font.getbbox(test)
            if (bb[2] - bb[0]) <= max_width or not line:
                line = test
            else:
                all_lines.append(line)
                line = word
        if line:
            all_lines.append(line)
        all_lines.append("")  # blank line between paragraphs

    # Measure line height
    ref_bb = font.getbbox("Ay")
    line_h = int((ref_bb[3] - ref_bb[1]) * line_spacing)

    y = y_top
    for line in all_lines:
        if not line:
            y += line_h // 2
            continue
        bb = font.getbbox(line)
        tw = bb[2] - bb[0]
        if align == "center":
            x = x_left + (max_width - tw) // 2
        elif align == "right":
            x = x_right - tw
        else:
            x = x_left
        draw.text((x, y - bb[1]), line, fill=fill, font=font)
        y += line_h


def generate_cover(child_name, skin_tone, hair_color, hair_style):
    """Generate the cover wrap (back + front, 5100x2550) with new title."""
    child_name = clean_child_name(child_name)
    cover_path = PSD_DIR / "Cover.psd"
    if not cover_path.exists():
        raise FileNotFoundError(f"Missing cover PSD: {cover_path}")

    print("  Cover: loading PSD...", end=" ", flush=True)
    psd = PSDImage.open(str(cover_path))

    # Set girl variant on cover
    set_variant(psd, skin_tone, hair_color, hair_style)

    # Hide original text layers — we render our own
    for layer in psd.descendants():
        if layer.kind == "type":
            layer.visible = False

    img = psd.composite()
    if img.mode == "RGBA":
        bg = Image.new("RGB", img.size, (255, 255, 255))
        bg.paste(img, mask=img.split()[3])
        img = bg
    else:
        img = img.convert("RGB")
    print("composited...", end=" ", flush=True)

    draw = ImageDraw.Draw(img)
    w, h = img.size  # 5100 x 2550

    # ── Colors from original PSD ──
    COVER_GOLD = (216, 138, 43, 255)
    COVER_WHITE = (255, 255, 255, 255)

    # ── Load fonts ──
    bjola_byline = ImageFont.truetype(FONT_BJOLA, 64)      # "by Ketabi Studio"

    # ── Helper: clean centered text (no outline, no shadow) ──
    def centered_text(base_img, y, text, font, fill, x_left, x_right):
        d = ImageDraw.Draw(base_img)
        bb = d.textbbox((0, 0), text, font=font)
        tw = bb[2] - bb[0]
        x = x_left + (x_right - x_left - tw) // 2
        d.text((x, y), text, fill=fill, font=font)
        return base_img

    # ── Helper: largest font (<= base) that fits text within max_width ──
    def fit_font(text, base_size, max_width, min_size=72, path=FONT_BJOLA):
        d = ImageDraw.Draw(img)
        size = base_size
        while size > min_size:
            f = ImageFont.truetype(path, size)
            bb = d.textbbox((0, 0), text, font=f)
            if (bb[2] - bb[0]) <= max_width:
                return f
            size -= 4
        return ImageFont.truetype(path, min_size)

    # Front cover x range: 2550..5100
    front_left, front_right = 2550, 5100
    panel_max_w = (front_right - front_left) - 220

    # ── Title: big "(Name)" + "and Her Beautiful Hijab" + byline ──
    # Sized large for shelf/thumbnail impact; sits in the clear band above
    # the girl's hair (which starts ~y=613). Both lines auto-shrink to fit.
    title_text = f"{child_name} and Her Beautiful Hijab"   # full title (validation)
    name_font = fit_font(child_name, 215, panel_max_w, min_size=120)
    desc_font = fit_font("and Her Beautiful Hijab", 108, panel_max_w, min_size=80)
    centered_text(img, 70, child_name, name_font,
                  COVER_GOLD, front_left, front_right)
    centered_text(img, 312, "and Her Beautiful Hijab", desc_font,
                  COVER_GOLD, front_left, front_right)
    centered_text(img, 452, "by Ketabi Studio", bjola_byline,
                  COVER_GOLD, front_left, front_right)

    # Bind draw for the back-cover blurb
    draw = ImageDraw.Draw(img)

    # ── 4. Back cover blurb (left half, clean white area) ──
    blurb_text = (
        f"Some things make us feel brave. Some things make us "
        f"feel kind. For {child_name}, that something is her very "
        f"own hijab.\n\n"
        f"When Mama wraps it around her for the first time, "
        f"{child_name} discovers that a hijab is like a hug she "
        f"carries all day long, and a little crown that reminds her "
        f"to shine from the inside out.\n\n"
        f"A warm, joyful celebration of faith, family, and the "
        f"magic of being proudly, beautifully you."
    )
    # SAFETY GUARD: blurb + title must contain no surviving placeholder
    validate_no_placeholders(blurb_text, page_label="back cover blurb")
    validate_no_placeholders(title_text, page_label="cover title")
    blurb_font = ImageFont.truetype(FONT_CROC, 58)
    blurb_box = (560, 600, 2080, 1950)   # x_left, y_top, x_right, y_bottom
    _draw_wrapped(draw, blurb_text, blurb_font, BODY_DARK, blurb_box,
                  line_spacing=1.35, align="center")

    print("text rendered...", end=" ", flush=True)

    # ── Assemble to Lulu's exact 32-page cover spec ──
    # Full wrap = 17.39 x 8.75 in = 5217 x 2625 px @300dpi
    #   [bleed | back trim | spine | front trim | bleed], bleed top/bottom too
    BLEED_PX = 38          # 0.125 in
    SPINE_PX = 42          # ~0.14 in for 32 pp, 80# coated (from Lulu)
    trim_w = w // 2        # 2550 (back) | 2550 (front)
    total_w = BLEED_PX + trim_w + SPINE_PX + trim_w + BLEED_PX  # 5218
    total_h = BLEED_PX + h + BLEED_PX                            # 2626

    back = img.crop((0, 0, trim_w, h))
    front = img.crop((trim_w, 0, w, h))
    spine_color = img.getpixel((trim_w - 1, h // 2))

    cover = Image.new("RGB", (total_w, total_h), spine_color)
    x_back = BLEED_PX
    x_spine = BLEED_PX + trim_w
    x_front = BLEED_PX + trim_w + SPINE_PX
    cover.paste(back, (x_back, BLEED_PX))
    cover.paste(Image.new("RGB", (SPINE_PX, h), spine_color), (x_spine, BLEED_PX))
    cover.paste(front, (x_front, BLEED_PX))

    # Bleed by edge extension (top/bottom, far-left, far-right)
    # top & bottom strips across back+front (not spine, but spine_color fills it)
    top = cover.crop((0, BLEED_PX, total_w, BLEED_PX + 1)).resize((total_w, BLEED_PX))
    cover.paste(top, (0, 0))
    bot = cover.crop((0, BLEED_PX + h - 1, total_w, BLEED_PX + h)).resize((total_w, BLEED_PX))
    cover.paste(bot, (0, BLEED_PX + h))
    left = cover.crop((BLEED_PX, 0, BLEED_PX + 1, total_h)).resize((BLEED_PX, total_h))
    cover.paste(left, (0, 0))
    right = cover.crop((x_front + trim_w - 1, 0, x_front + trim_w, total_h)).resize((BLEED_PX, total_h))
    cover.paste(right, (x_front + trim_w, 0))

    print(f"assembled to {cover.size} (Lulu spec)... done.")
    return cover


# ═════════════════════════════════════════════════════════════════════
#  PDF ASSEMBLY
# ═════════════════════════════════════════════════════════════════════

def assemble_pdf(pages, cover_img, output_path, child_name):
    """Combine interior pages + cover into Lulu-ready PDFs."""
    interior_path = output_path / f"{child_name}_interior.pdf"
    cover_path_out = output_path / f"{child_name}_cover.pdf"

    # ── Interior PDF ──
    print(f"\n  Assembling interior PDF ({len(pages)} pages)...", flush=True)
    page_w = TOTAL_IN * inch
    page_h = TOTAL_IN * inch
    c = rl_canvas.Canvas(str(interior_path), pagesize=(page_w, page_h))

    for i, page_img in enumerate(pages):
        tmp = output_path / f"_tmp_page_{i+1:02d}.jpg"
        page_img.save(str(tmp), "JPEG", quality=95, dpi=(DPI, DPI))
        c.drawImage(str(tmp), 0, 0, width=page_w, height=page_h)
        c.showPage()
        tmp.unlink()

    c.save()
    print(f"  Interior PDF saved: {interior_path}")

    # ── Cover PDF ──
    if cover_img is not None:
        print("  Assembling cover PDF...", flush=True)
        cw_in = cover_img.size[0] / DPI
        ch_in = cover_img.size[1] / DPI
        cc = rl_canvas.Canvas(
            str(cover_path_out), pagesize=(cw_in * inch, ch_in * inch)
        )
        tmp_cover = output_path / "_tmp_cover.jpg"
        cover_img.save(str(tmp_cover), "JPEG", quality=95, dpi=(DPI, DPI))
        cc.drawImage(
            str(tmp_cover), 0, 0,
            width=cw_in * inch, height=ch_in * inch,
        )
        cc.showPage()
        cc.save()
        tmp_cover.unlink()
        print(f"  Cover PDF saved: {cover_path_out}")

    return interior_path, cover_path_out


# ═════════════════════════════════════════════════════════════════════
#  MAIN PIPELINE
# ═════════════════════════════════════════════════════════════════════

def run_pipeline(child_name, skin_tone, hair_color, hair_style):
    """Full end-to-end generation."""
    print(f"\n{'='*60}")
    print(f"  Ketabi Studio — I Love My Hijab")
    print(f"  Generating for: {child_name}")
    print(f"  Variant: {skin_tone} / {hair_color} / {hair_style}")
    print(f"{'='*60}\n")

    OUTPUT_DIR.mkdir(exist_ok=True)

    # Generate all 25 interior pages
    print("Generating interior pages...")
    pages = []
    for pg in range(1, 26):
        try:
            img = generate_page(
                pg, child_name, skin_tone, hair_color, hair_style,
            )
            pages.append(img)
        except Exception as e:
            print(f"  Page {pg:02d}: ERROR — {e}")
            traceback.print_exc()
            # Insert a blank white page as placeholder
            pages.append(Image.new("RGB", (TOTAL_PX, TOTAL_PX), (255, 255, 255)))

    # Generate cover
    print("\nGenerating cover...")
    try:
        cover_img = generate_cover(child_name, skin_tone, hair_color, hair_style)
    except Exception as e:
        print(f"  Cover ERROR — {e}")
        traceback.print_exc()
        cover_img = None

    # Assemble PDFs
    interior_pdf, cover_pdf = assemble_pdf(
        pages, cover_img, OUTPUT_DIR, child_name
    )

    print(f"\n{'='*60}")
    print(f"  COMPLETE!")
    print(f"  Interior: {interior_pdf}")
    print(f"  Cover:    {cover_pdf}")
    print(f"{'='*60}\n")
    return interior_pdf, cover_pdf


# ═════════════════════════════════════════════════════════════════════
#  CLI ENTRY POINT
# ═════════════════════════════════════════════════════════════════════

if __name__ == "__main__":
    parser = argparse.ArgumentParser(
        description="Generate a personalized 'I Love My Hijab' book"
    )
    parser.add_argument("--name", default="Amira", help="Child's name")
    parser.add_argument("--skin", default="Dark",
                        choices=SKIN_TONES, help="Skin tone")
    parser.add_argument("--hair_color", default="Black",
                        choices=HAIR_COLORS, help="Hair color")
    parser.add_argument("--hair_style", default="Long straight",
                        choices=HAIR_STYLES, help="Hair style")
    args = parser.parse_args()

    run_pipeline(args.name, args.skin, args.hair_color, args.hair_style)
