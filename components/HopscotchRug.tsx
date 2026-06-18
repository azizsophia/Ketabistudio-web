import type { CSSProperties } from "react";

/* Pixel-perfect recreation of "Hopscotch Rug Art" (Claude Design handoff).
   The SVG art + Arabic numerals are the EXACT source markup; only the colorway,
   the child's name, and the Arabic name are filled in from props. Fonts are the
   design's Fredoka + Baloo Bhaijaan 2, self-hosted via next/font CSS vars. */

export const RUG_COLORWAYS = {
  Meadow: { ground: "#f3ead0", star: "#e6b94e" },
  Blush: { ground: "#f4e4dc", star: "#e0a85a" },
  Sky: { ground: "#e6eef0", star: "#e6b94e" },
} as const;
export type RugColorway = keyof typeof RUG_COLORWAYS;

const MARKUP = `<div style="position:relative;width:100%;aspect-ratio:2/3;border-radius:3.5cqw;overflow:hidden;container-type:inline-size;background:{{ groundColor }}">

  <!-- ===== SVG: textured art, no text ===== -->
  <svg viewBox="0 0 960 1440" preserveAspectRatio="xMidYMid meet" style="position:absolute;inset:0;width:100%;height:100%;display:block">
    <defs>
      <radialGradient id="moonG" cx="40%" cy="36%" r="70%">
        <stop offset="0" stop-color="#f7e7ad"></stop>
        <stop offset="1" stop-color="#ecca73"></stop>
      </radialGradient>
      <filter id="plush" x="-40%" y="-40%" width="180%" height="180%" color-interpolation-filters="sRGB">
        <feTurbulence type="fractalNoise" baseFrequency="0.04" numOctaves="2" seed="7" result="n"></feTurbulence>
        <feDisplacementMap in="SourceGraphic" in2="n" scale="9" xChannelSelector="R" yChannelSelector="G" result="d"></feDisplacementMap>
        <feGaussianBlur in="d" stdDeviation="1.8" result="fuzz"></feGaussianBlur>
        <feMerge><feMergeNode in="fuzz"></feMergeNode><feMergeNode in="d"></feMergeNode></feMerge>
        <feDropShadow dx="0" dy="5" stdDeviation="6" flood-color="#5a4220" flood-opacity="0.28"></feDropShadow>
      </filter>
      <filter id="tile" x="-30%" y="-30%" width="160%" height="160%" color-interpolation-filters="sRGB">
        <feTurbulence type="fractalNoise" baseFrequency="0.05" numOctaves="2" seed="5" result="n"></feTurbulence>
        <feDisplacementMap in="SourceGraphic" in2="n" scale="6" xChannelSelector="R" yChannelSelector="G" result="d"></feDisplacementMap>
        <feGaussianBlur in="d" stdDeviation="1.4" result="fuzz"></feGaussianBlur>
        <feMerge><feMergeNode in="fuzz"></feMergeNode><feMergeNode in="d"></feMergeNode></feMerge>
        <feDropShadow dx="0" dy="4" stdDeviation="5" flood-color="#5a4220" flood-opacity="0.26"></feDropShadow>
      </filter>
      <filter id="raise" x="-40%" y="-40%" width="180%" height="180%" color-interpolation-filters="sRGB">
        <feDropShadow dx="0" dy="2.5" stdDeviation="1.6" flood-color="#5a4220" flood-opacity="0.32"></feDropShadow>
      </filter>
      <filter id="grain" color-interpolation-filters="sRGB">
        <feTurbulence type="fractalNoise" baseFrequency="0.5" numOctaves="3" stitchTiles="stitch" result="t"></feTurbulence>
        <feColorMatrix in="t" type="matrix" values="0 0 0 0 0.30  0 0 0 0 0.24  0 0 0 0 0.13  0 0 0 0.8 0"></feColorMatrix>
      </filter>
    </defs>

    <rect x="0" y="0" width="960" height="1440" fill="{{ groundColor }}"></rect>
    <rect x="0" y="0" width="960" height="1440" fill="#000" filter="url(#grain)" opacity="0.22" style="mix-blend-mode:multiply"></rect>

    <!-- stars flanking title + moon -->
    <g filter="url(#raise)" fill="{{ starColor }}">
      <g transform="translate(150,150) scale(0.85)"><path d="M0,-15 L4.5,-5 14,-4.2 6.5,3.2 9.5,13 0,7.5 -9.5,13 -6.5,3.2 -14,-4.2 -4.5,-5 Z"></path></g>
      <g transform="translate(810,150) scale(0.85)"><path d="M0,-15 L4.5,-5 14,-4.2 6.5,3.2 9.5,13 0,7.5 -9.5,13 -6.5,3.2 -14,-4.2 -4.5,-5 Z"></path></g>
      <g transform="translate(250,470) scale(0.72)"><path d="M0,-15 L4.5,-5 14,-4.2 6.5,3.2 9.5,13 0,7.5 -9.5,13 -6.5,3.2 -14,-4.2 -4.5,-5 Z"></path></g>
      <g transform="translate(710,470) scale(0.72)"><path d="M0,-15 L4.5,-5 14,-4.2 6.5,3.2 9.5,13 0,7.5 -9.5,13 -6.5,3.2 -14,-4.2 -4.5,-5 Z"></path></g>
      <g transform="translate(140,760) scale(0.95)"><path d="M0,-15 L4.5,-5 14,-4.2 6.5,3.2 9.5,13 0,7.5 -9.5,13 -6.5,3.2 -14,-4.2 -4.5,-5 Z"></path></g>
      <g transform="translate(820,760) scale(0.95)"><path d="M0,-15 L4.5,-5 14,-4.2 6.5,3.2 9.5,13 0,7.5 -9.5,13 -6.5,3.2 -14,-4.2 -4.5,-5 Z"></path></g>
      <g transform="translate(150,1080) scale(0.7)"><path d="M0,-15 L4.5,-5 14,-4.2 6.5,3.2 9.5,13 0,7.5 -9.5,13 -6.5,3.2 -14,-4.2 -4.5,-5 Z"></path></g>
      <g transform="translate(810,1080) scale(0.7)"><path d="M0,-15 L4.5,-5 14,-4.2 6.5,3.2 9.5,13 0,7.5 -9.5,13 -6.5,3.2 -14,-4.2 -4.5,-5 Z"></path></g>
      <circle cx="250" cy="1230" r="6"></circle><circle cx="710" cy="1230" r="6"></circle>
    </g>

    <!-- clouds -->
    <g filter="url(#plush)" fill="#aecada">
      <g transform="translate(230,560)"><ellipse cx="0" cy="0" rx="38" ry="21"></ellipse><ellipse cx="34" cy="6" rx="26" ry="16"></ellipse><ellipse cx="-32" cy="6" rx="24" ry="15"></ellipse></g>
      <g transform="translate(730,600)"><ellipse cx="0" cy="0" rx="32" ry="18"></ellipse><ellipse cx="28" cy="5" rx="22" ry="14"></ellipse><ellipse cx="-26" cy="5" rx="20" ry="13"></ellipse></g>
    </g>

    <!-- crescent moon -->
    <g filter="url(#plush)">
      <path d="M540,285 A118,118 0 1 0 540,455 A92,92 0 1 1 540,285 Z" fill="url(#moonG)"></path>
    </g>
    <!-- happy face on the belly -->
    <g stroke="#8a6326" stroke-width="8" stroke-linecap="round" fill="none" filter="url(#raise)">
      <path d="M366,356 q12,-15 24,0"></path>
      <path d="M402,356 q12,-15 24,0"></path>
      <path d="M372,382 q26,21 52,0"></path>
    </g>
    <g fill="#ef9f76" opacity="0.55"><ellipse cx="368" cy="379" rx="13" ry="8"></ellipse><ellipse cx="430" cy="379" rx="13" ry="8"></ellipse></g>

    <!-- tiles -->
    <g filter="url(#tile)">
      <rect x="388" y="540" width="184" height="112" rx="22" fill="#b9a35e"></rect>
      <rect x="286" y="661" width="184" height="112" rx="22" fill="#7a9bb3"></rect>
      <rect x="490" y="661" width="184" height="112" rx="22" fill="#cd7e58"></rect>
      <rect x="388" y="782" width="184" height="112" rx="22" fill="#d2a14c"></rect>
      <rect x="286" y="903" width="184" height="112" rx="22" fill="#d2a14c"></rect>
      <rect x="490" y="903" width="184" height="112" rx="22" fill="#88a06a"></rect>
      <rect x="388" y="1024" width="184" height="112" rx="22" fill="#7f9670"></rect>
      <rect x="286" y="1145" width="184" height="112" rx="22" fill="#cd7e58"></rect>
      <rect x="490" y="1145" width="184" height="112" rx="22" fill="#9aa45f"></rect>
      <rect x="388" y="1266" width="184" height="112" rx="22" fill="#8f9b54"></rect>
    </g>
    <g fill="#ffffff" opacity="0.12">
      <rect x="399" y="551" width="162" height="90" rx="14"></rect>
      <rect x="297" y="672" width="162" height="90" rx="14"></rect>
      <rect x="501" y="672" width="162" height="90" rx="14"></rect>
      <rect x="399" y="793" width="162" height="90" rx="14"></rect>
      <rect x="297" y="914" width="162" height="90" rx="14"></rect>
      <rect x="501" y="914" width="162" height="90" rx="14"></rect>
      <rect x="399" y="1035" width="162" height="90" rx="14"></rect>
      <rect x="297" y="1156" width="162" height="90" rx="14"></rect>
      <rect x="501" y="1156" width="162" height="90" rx="14"></rect>
      <rect x="399" y="1277" width="162" height="90" rx="14"></rect>
    </g>
  </svg>

  <!-- ===== HTML TEXT OVERLAY ===== -->
  <div style="position:absolute;inset:0;pointer-events:none">
    <!-- title: the name leads -->
    <div style="position:absolute;left:4%;top:4.5%;width:92%;display:flex;flex-direction:column;align-items:center;justify-content:center;line-height:1;text-align:center">
      <span style="font:600 3.4cqw var(--font-fredoka),sans-serif;letter-spacing:.4cqw;text-transform:uppercase;white-space:nowrap;color:#b07a4e">{{ kicker }}</span>
      <span style="font:700 11cqw var(--font-baloo),sans-serif;color:#7e5230;white-space:nowrap;margin-top:1.4cqw">{{ nameAr }}</span>
    </div>
    <!-- numerals -->
    <div style="position:absolute;left:40.42%;top:37.5%;width:19.17%;height:7.78%;display:flex;align-items:center;justify-content:center;line-height:1;color:#fbf4e2;text-shadow:0 .35cqw .5cqw rgba(90,66,32,.45)"><span style="font:800 6.2cqw var(--font-baloo),sans-serif">١٠</span></div>
    <div style="position:absolute;left:29.79%;top:45.9%;width:19.17%;height:7.78%;display:flex;align-items:center;justify-content:center;line-height:1;color:#fbf4e2;text-shadow:0 .35cqw .5cqw rgba(90,66,32,.45)"><span style="font:800 7cqw var(--font-baloo),sans-serif">٨</span></div>
    <div style="position:absolute;left:51.04%;top:45.9%;width:19.17%;height:7.78%;display:flex;align-items:center;justify-content:center;line-height:1;color:#fbf4e2;text-shadow:0 .35cqw .5cqw rgba(90,66,32,.45)"><span style="font:800 7cqw var(--font-baloo),sans-serif">٩</span></div>
    <div style="position:absolute;left:40.42%;top:54.31%;width:19.17%;height:7.78%;display:flex;align-items:center;justify-content:center;line-height:1;color:#fbf4e2;text-shadow:0 .35cqw .5cqw rgba(90,66,32,.45)"><span style="font:800 7cqw var(--font-baloo),sans-serif">٧</span></div>
    <div style="position:absolute;left:29.79%;top:62.71%;width:19.17%;height:7.78%;display:flex;align-items:center;justify-content:center;line-height:1;color:#fbf4e2;text-shadow:0 .35cqw .5cqw rgba(90,66,32,.45)"><span style="font:800 7cqw var(--font-baloo),sans-serif">٥</span></div>
    <div style="position:absolute;left:51.04%;top:62.71%;width:19.17%;height:7.78%;display:flex;align-items:center;justify-content:center;line-height:1;color:#fbf4e2;text-shadow:0 .35cqw .5cqw rgba(90,66,32,.45)"><span style="font:800 7cqw var(--font-baloo),sans-serif">٦</span></div>
    <div style="position:absolute;left:40.42%;top:71.11%;width:19.17%;height:7.78%;display:flex;align-items:center;justify-content:center;line-height:1;color:#fbf4e2;text-shadow:0 .35cqw .5cqw rgba(90,66,32,.45)"><span style="font:800 7cqw var(--font-baloo),sans-serif">٤</span></div>
    <div style="position:absolute;left:29.79%;top:79.51%;width:19.17%;height:7.78%;display:flex;align-items:center;justify-content:center;line-height:1;color:#fbf4e2;text-shadow:0 .35cqw .5cqw rgba(90,66,32,.45)"><span style="font:800 7cqw var(--font-baloo),sans-serif">٢</span></div>
    <div style="position:absolute;left:51.04%;top:79.51%;width:19.17%;height:7.78%;display:flex;align-items:center;justify-content:center;line-height:1;color:#fbf4e2;text-shadow:0 .35cqw .5cqw rgba(90,66,32,.45)"><span style="font:800 7cqw var(--font-baloo),sans-serif">٣</span></div>
    <div style="position:absolute;left:40.42%;top:87.92%;width:19.17%;height:7.78%;display:flex;align-items:center;justify-content:center;line-height:1;color:#fbf4e2;text-shadow:0 .35cqw .5cqw rgba(90,66,32,.45)"><span style="font:800 7cqw var(--font-baloo),sans-serif">١</span></div>
  </div>
</div>`;

function esc(s: string) {
  return s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
}

export default function HopscotchRug({
  childName = "Muadh",
  childNameArabic = "\u0645\u064f\u0639\u0627\u0630",
  colorway = "Meadow",
  style,
}: {
  childName?: string;
  childNameArabic?: string;
  colorway?: RugColorway;
  style?: CSSProperties;
}) {
  const w = RUG_COLORWAYS[colorway] ?? RUG_COLORWAYS.Meadow;
  const name = (childName || "Muadh").trim() || "Muadh";
  const nameAr =
    (childNameArabic || "\u0645\u064f\u0639\u0627\u0630").trim() ||
    "\u0645\u064f\u0639\u0627\u0630";
  const kicker = name + "\u2019s Moon";
  const html = MARKUP.split("{{ groundColor }}").join(w.ground)
    .split("{{ starColor }}").join(w.star)
    .split("{{ kicker }}").join(esc(kicker))
    .split("{{ nameAr }}").join(esc(nameAr));
  return <div style={style} dangerouslySetInnerHTML={{ __html: html }} />;
}
