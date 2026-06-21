// Build the live "this is exactly what you'll get" preview for the I Am book by
// filling the SAME print template the worker renders (iam-templates/book-template.html,
// so the on-screen flip-through matches the printed book. Token names, the rose
// colourway swap, and the per-photo crop styles all mirror worker/pipeline/iam_book.py.

import { type Crop, cropToImageStyle } from "./photoCrop";

export type PreviewPhoto = { url: string; crop: Crop | null } | null;
export type PreviewState = {
  name: string;
  nameAr: string;
  gender: "boy" | "girl";
  dedication: string;
  colorway: "teal" | "rose";
  cover: PreviewPhoto;
  photos: PreviewPhoto[];
};

const PRONOUNS: Record<string, Record<string, string>> = {
  boy: { Subject: "He", subject: "he", object: "him", possessive: "his" },
  girl: { Subject: "She", subject: "she", object: "her", possessive: "her" },
};

// teal palette -> rose palette (identical to the worker's ROSE map)
const ROSE: Record<string, string> = {
  "#2f5d57": "#a8596a",
  "#21443f": "#7e3f4e",
  "#24493f": "#7a4150",
  "#bcd0c9": "#e3c6cd",
};

// Preview-only CSS: hide the dev page labels, stack spreads on narrow screens,
// and neutralise the template's fit script so pages lay out cleanly to scroll.
const PREVIEW_CSS = `
<style id="iam-preview">
  .label{display:none!important}
  .fitme{transform:none!important}
  body{background:#e7e2d8;padding:14px 0 30px}
  .book{gap:20px}
  .spread{box-shadow:0 18px 40px rgba(60,40,20,.22)}
  @media (max-width:860px){
    .sheet{width:90vw!important;height:90vw!important}
    .spread{flex-direction:column;width:90vw!important;box-shadow:none;gap:0}
    .spread .sheet{width:90vw!important;height:90vw!important;border-radius:8px;margin-bottom:16px;box-shadow:0 14px 30px rgba(60,40,20,.2)}
    .spread .gutter{display:none}
  }
</style>`;

function tokensFor(s: PreviewState): Record<string, string> {
  const pr = PRONOUNS[s.gender] || PRONOUNS.boy;
  const name = s.name.trim() || "Your child";
  const ded = s.dedication.trim() || `For ${name}, a gift to grow into.`;
  const t: Record<string, string> = {
    CHILD_NAME: name,
    CHILD_NAME_ARABIC: s.nameAr.trim(),
    DEDICATION: ded,
    LOGO: "/images/logo-vertical-dark.png",
    ...pr,
  };
  t.PHOTO_COVER = s.cover?.url || "";
  t.PHOTO_COVER_STYLE = cropToImageStyle(s.cover?.crop);
  for (let i = 1; i <= 12; i++) {
    const p = s.photos[i - 1];
    t[`PHOTO_${i}`] = p?.url || "";
    t[`PHOTO_${i}_STYLE`] = cropToImageStyle(p?.crop);
  }
  return t;
}

function fill(html: string, tokens: Record<string, string>): string {
  return html.replace(/\{\{\s*([A-Za-z0-9_]+)\s*\}\}/g, (_m, k) => tokens[k] ?? "");
}

/** Produce a full filled HTML document for the iframe srcDoc. */
export function buildPreviewHtml(template: string, state: PreviewState): string {
  let html = template;
  if (state.colorway === "rose") {
    for (const [a, b] of Object.entries(ROSE)) html = html.split(a).join(b);
  }
  html = fill(html, tokensFor(state));
  html = html.replace("</head>", `${PREVIEW_CSS}</head>`);
  return html;
}
