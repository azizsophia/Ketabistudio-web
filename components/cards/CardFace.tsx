"use client";

import React from "react";
import {
  CollectionId,
  FrontSlots,
  hexA,
  isArabic,
} from "@/lib/cards";
import PhotoSlot from "./PhotoSlot";

// CardFace renders a card FRONT or INSIDE for a given collection + config.
// Faithfully ported from the prototype's `makeFace` + the six face renderers
// (archFace / fieldFace / washFace / imageFace / textileFace / statementFace)
// and the `insideRenderers` map. Everything is authored at 232x327 design
// units and scaled via transform: scale(px/232) inside an overflow:hidden box,
// exactly like the prototype.

const CREAM = "#f7efe2";

// Font shorthands resolved against the card CSS variables (set on /cards page).
const SERIF = "var(--cards-serif), Georgia, serif";
const ARABIC_DISPLAY = "var(--cards-arabic-display), 'Reem Kufi', serif";
const UI = "var(--cards-ui), system-ui, sans-serif";
const ARABIC_BODY = "var(--font-arabic), 'Amiri', serif";

type CSS = React.CSSProperties;

// ---- shared bits ----
function eyebrowEl(color: string, t: string): React.ReactNode {
  if (!t) return null;
  return (
    <div
      style={{
        fontFamily: UI,
        fontWeight: 400,
        fontSize: 8,
        letterSpacing: ".4em",
        textTransform: "uppercase",
        color,
        paddingLeft: ".4em",
        marginBottom: 18,
      }}
    >
      {t}
    </div>
  );
}

// ---- the six FRONT renderers (native 232x327) ----

function FieldFace({ f, accent }: { f: FrontSlots; accent: string }) {
  return (
    <div
      style={{
        width: 232,
        height: 327,
        background: accent,
        overflow: "hidden",
        position: "relative",
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        justifyContent: "center",
        padding: "30px 24px",
        textAlign: "center",
      }}
    >
      <div
        style={{
          position: "absolute",
          top: 15,
          left: 15,
          right: 15,
          bottom: 15,
          border: `1px solid ${hexA("#f7efe2", 0.45)}`,
        }}
      />
      {eyebrowEl(hexA("#f7efe2", 0.85), f.eyebrow)}
      <div
        style={{
          fontFamily: f.bigArabic ? ARABIC_DISPLAY : SERIF,
          fontWeight: 500,
          fontSize: f.bigArabic ? 44 : 26,
          fontStyle: f.bigArabic ? "normal" : "italic",
          color: CREAM,
          lineHeight: 1.14,
        }}
      >
        {f.bigText}
      </div>
      {f.translit ? (
        <div
          style={{
            fontFamily: UI,
            fontWeight: 400,
            fontSize: 9,
            letterSpacing: ".2em",
            color: hexA("#f7efe2", 0.8),
            marginTop: 10,
          }}
        >
          {f.translit}
        </div>
      ) : null}
      {f.line2 ? (
        <div
          style={{
            fontFamily: f.line2Arabic ? ARABIC_DISPLAY : SERIF,
            fontWeight: 500,
            fontSize: f.line2Arabic ? 19 : 15,
            color: CREAM,
            marginTop: 14,
          }}
        >
          {f.line2}
        </div>
      ) : null}
      <div
        style={{
          width: 22,
          height: 1,
          background: hexA("#f7efe2", 0.55),
          margin: "18px 0",
        }}
      />
      {f.foot ? (
        <div
          style={{
            fontFamily: SERIF,
            fontWeight: 500,
            fontSize: 17,
            fontStyle: "italic",
            color: CREAM,
          }}
        >
          {f.foot}
        </div>
      ) : null}
    </div>
  );
}

function WashFace({ f, accent }: { f: FrontSlots; accent: string }) {
  return (
    <div
      style={{
        width: 232,
        height: 327,
        overflow: "hidden",
        position: "relative",
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        justifyContent: "center",
        padding: "30px 26px",
        textAlign: "center",
        background: `radial-gradient(120px 100px at 26% 22%,${hexA(
          accent,
          0.5,
        )},transparent 70%),radial-gradient(140px 120px at 78% 30%,rgba(214,184,120,.5),transparent 70%),radial-gradient(150px 130px at 60% 82%,${hexA(
          accent,
          0.3,
        )},transparent 70%),#f7f0e6`,
      }}
    >
      {eyebrowEl(hexA(accent, 0.95), f.eyebrow)}
      <div
        style={{
          fontFamily: f.bigArabic ? ARABIC_DISPLAY : SERIF,
          fontWeight: 500,
          fontSize: f.bigArabic ? 30 : 24,
          fontStyle: f.bigArabic ? "normal" : "italic",
          color: "#4a352c",
          lineHeight: 1.18,
          whiteSpace: "nowrap",
        }}
      >
        {f.bigText}
      </div>
      {f.translit ? (
        <div
          style={{
            fontFamily: UI,
            fontWeight: 400,
            fontSize: 9,
            letterSpacing: ".2em",
            color: "#9a7b62",
            marginTop: 10,
          }}
        >
          {f.translit}
        </div>
      ) : null}
      {f.line2 ? (
        <div
          style={{
            fontFamily: f.line2Arabic ? ARABIC_DISPLAY : SERIF,
            fontWeight: 500,
            fontSize: f.line2Arabic ? 19 : 14,
            color: accent,
            marginTop: 12,
            lineHeight: 1.25,
          }}
        >
          {f.line2}
        </div>
      ) : null}
      <div
        style={{
          width: 22,
          height: 1,
          background: hexA(accent, 0.4),
          margin: "18px 0",
        }}
      />
      {f.foot ? (
        <div
          style={{
            fontFamily: SERIF,
            fontWeight: 500,
            fontSize: 16,
            fontStyle: "italic",
            color: "#6a5448",
          }}
        >
          {f.foot}
        </div>
      ) : null}
    </div>
  );
}

function ImageFace({
  f,
  accent,
  interactive,
  photoUrl,
  onPickPhoto,
}: {
  f: FrontSlots;
  accent: string;
  interactive?: boolean;
  photoUrl?: string | null;
  onPickPhoto?: (file: File) => void;
}) {
  return (
    <div
      style={{
        width: 232,
        height: 327,
        overflow: "hidden",
        position: "relative",
        background: "#e9dfcc",
      }}
    >
      {interactive ? (
        <PhotoSlot width={232} height={327} url={photoUrl} onPick={onPickPhoto} />
      ) : (
        <div
          style={{
            position: "absolute",
            inset: 0,
            background: `linear-gradient(150deg,${hexA(accent, 0.14)},${hexA(accent, 0.3)})`,
            display: "flex",
            flexDirection: "column",
            alignItems: "center",
            justifyContent: "center",
            gap: 8,
          }}
        >
          <div
            style={{
              width: 34,
              height: 28,
              borderRadius: 5,
              border: `1.5px solid ${hexA(accent, 0.75)}`,
              position: "relative",
            }}
          >
            <div
              style={{
                position: "absolute",
                left: 6,
                bottom: 5,
                width: 8,
                height: 8,
                borderRadius: 999,
                background: hexA(accent, 0.75),
              }}
            />
          </div>
          <div
            style={{
              font: "500 10px var(--cards-ui, sans-serif)",
              letterSpacing: ".12em",
              textTransform: "uppercase",
              color: hexA(accent, 0.95),
            }}
          >
            Your photo here
          </div>
        </div>
      )}
      <div
        style={{
          position: "absolute",
          left: 0,
          right: 0,
          bottom: 0,
          padding: "36px 18px 16px",
          textAlign: "center",
          background: `linear-gradient(to top,${hexA("#191309", 0.74)},${hexA("#191309", 0.34)} 55%,transparent)`,
          textShadow: "0 1px 5px rgba(0,0,0,.55)",
        }}
      >
        {eyebrowEl("#f1e7d2", f.eyebrow)}
        <div
          style={{
            fontFamily: f.bigArabic ? ARABIC_DISPLAY : SERIF,
            fontWeight: 500,
            fontSize: f.bigArabic ? 30 : 24,
            fontStyle: f.bigArabic ? "normal" : "italic",
            color: "#fdf8ef",
            lineHeight: 1.1,
          }}
        >
          {f.bigText}
        </div>
        {f.line2 ? (
          <div
            style={{
              fontFamily: f.line2Arabic ? ARABIC_DISPLAY : SERIF,
              fontWeight: 500,
              fontSize: f.line2Arabic ? 18 : 14,
              color: "#f3e9d2",
              marginTop: 8,
            }}
          >
            {f.line2}
          </div>
        ) : null}
        {f.foot ? (
          <div
            style={{
              fontFamily: SERIF,
              fontWeight: 500,
              fontSize: 15,
              fontStyle: "italic",
              color: "#efe6d3",
              marginTop: 10,
            }}
          >
            {f.foot}
          </div>
        ) : null}
      </div>
    </div>
  );
}

function TextileFace({ f, accent }: { f: FrontSlots; accent: string }) {
  const motifs: React.ReactNode[] = [];
  for (let y = 24; y < 327; y += 40) {
    for (let x = 24; x < 232; x += 40) {
      motifs.push(
        <g key={`${x}-${y}`} transform={`translate(${x},${y})`}>
          <circle r={3} fill="none" stroke={hexA("#ecd296", 0.5)} strokeWidth={1} />
          <path
            d="M0,-9 C4,-4 4,-2 0,2 C-4,-2 -4,-4 0,-9 Z"
            fill="none"
            stroke={hexA("#ecd296", 0.45)}
            strokeWidth={1}
          />
          <path
            d="M0,9 C4,4 4,2 0,-2 C-4,2 -4,4 0,9 Z"
            fill="none"
            stroke={hexA("#ecd296", 0.45)}
            strokeWidth={1}
          />
          <path
            d="M-9,0 C-4,-4 -2,-4 2,0 C-2,4 -4,4 -9,0 Z"
            fill="none"
            stroke={hexA("#ecd296", 0.4)}
            strokeWidth={1}
          />
          <path
            d="M9,0 C4,-4 2,-4 -2,0 C2,4 4,4 9,0 Z"
            fill="none"
            stroke={hexA("#ecd296", 0.4)}
            strokeWidth={1}
          />
        </g>,
      );
    }
  }
  return (
    <div
      style={{
        width: 232,
        height: 327,
        overflow: "hidden",
        position: "relative",
        background: accent,
      }}
    >
      <svg
        width={232}
        height={327}
        viewBox="0 0 232 327"
        style={{ position: "absolute", top: 0, left: 0 }}
      >
        {motifs}
      </svg>
      <div
        style={{
          position: "absolute",
          left: 24,
          right: 24,
          top: "50%",
          transform: "translateY(-50%)",
          background: "#f6f0e3",
          border: `1px solid ${hexA("#d8b878", 1)}`,
          padding: "24px 16px",
          textAlign: "center",
          boxShadow: "0 10px 22px rgba(0,0,0,.22)",
        }}
      >
        {eyebrowEl("#9a7b52", f.eyebrow)}
        <div
          style={{
            fontFamily: f.bigArabic ? ARABIC_DISPLAY : SERIF,
            fontWeight: 500,
            fontSize: f.bigArabic ? 30 : 23,
            fontStyle: f.bigArabic ? "normal" : "italic",
            color: accent,
            lineHeight: 1.1,
          }}
        >
          {f.bigText}
        </div>
        {f.line2 ? (
          <div
            style={{
              fontFamily: f.line2Arabic ? ARABIC_DISPLAY : SERIF,
              fontWeight: 500,
              fontSize: f.line2Arabic ? 18 : 14,
              color: accent,
              marginTop: 8,
            }}
          >
            {f.line2}
          </div>
        ) : null}
        {f.foot ? (
          <div
            style={{
              fontFamily: SERIF,
              fontWeight: 500,
              fontSize: 15,
              fontStyle: "italic",
              color: "#5a4636",
              marginTop: 10,
            }}
          >
            {f.foot}
          </div>
        ) : null}
      </div>
    </div>
  );
}

function StatementFace({ f, accent }: { f: FrontSlots; accent: string }) {
  return (
    <div
      style={{
        width: 232,
        height: 327,
        overflow: "hidden",
        position: "relative",
        background: "#f1ece1",
      }}
    >
      <div
        style={{
          position: "absolute",
          top: 0,
          left: 0,
          right: 0,
          bottom: 80,
          padding: "0 26px",
          display: "flex",
          flexDirection: "column",
          justifyContent: "center",
        }}
      >
        {eyebrowEl(accent, f.eyebrow)}
        <div
          style={{
            fontFamily: f.bigArabic ? ARABIC_DISPLAY : SERIF,
            fontWeight: f.bigArabic ? 500 : 600,
            fontSize: f.bigArabic ? 34 : 28,
            color: f.bigArabic ? accent : "#1f2a26",
            lineHeight: 1.08,
            marginTop: 4,
            whiteSpace: "nowrap",
          }}
        >
          {f.bigText}
        </div>
        {f.translit ? (
          <div
            style={{
              fontFamily: UI,
              fontWeight: 400,
              fontSize: 9,
              letterSpacing: ".2em",
              color: "#9a8f7c",
              marginTop: 8,
            }}
          >
            {f.translit}
          </div>
        ) : null}
        {f.line2 ? (
          <div
            style={{
              fontFamily: f.line2Arabic ? ARABIC_DISPLAY : SERIF,
              fontWeight: 500,
              fontSize: f.line2Arabic ? 21 : 15,
              color: accent,
              marginTop: 12,
              lineHeight: 1.25,
            }}
          >
            {f.line2}
          </div>
        ) : null}
      </div>
      <div
        style={{
          position: "absolute",
          bottom: 0,
          left: 0,
          right: 0,
          height: 80,
          background: accent,
          display: "flex",
          alignItems: "center",
          justifyContent: "flex-start",
          padding: "0 26px",
        }}
      >
        <div
          style={{
            fontFamily: SERIF,
            fontWeight: 500,
            fontSize: 14,
            fontStyle: "italic",
            color: CREAM,
            lineHeight: 1.3,
          }}
        >
          {f.foot || ""}
        </div>
      </div>
    </div>
  );
}

function ArchFace({ f, accent }: { f: FrontSlots; accent: string }) {
  return (
    <div
      style={{
        width: 232,
        height: 327,
        overflow: "hidden",
        position: "relative",
        background: "linear-gradient(180deg,#f4eee2,#ece2cf)",
      }}
    >
      <svg
        width={232}
        height={327}
        viewBox="0 0 232 327"
        style={{ position: "absolute", top: 0, left: 0 }}
      >
        <path
          d="M52,292 L52,150 Q52,66 116,38 Q180,66 180,150 L180,292 Z"
          fill="#f9f3e7"
          stroke={accent}
          strokeWidth={1.5}
        />
        <path
          d="M60,290 L60,152 Q60,80 116,54 Q172,80 172,152 L172,290"
          fill="none"
          stroke={hexA(accent, 0.5)}
          strokeWidth={0.7}
        />
        <circle cx={116} cy={90} r={9} fill={accent} />
        <circle cx={119.5} cy={88} r={7.4} fill="#f9f3e7" />
        <rect x={44} y={294} width={144} height={3} fill={accent} />
        <rect x={44} y={300} width={144} height={1} fill={hexA(accent, 0.5)} />
      </svg>
      <div
        style={{
          position: "absolute",
          left: 60,
          right: 60,
          top: 108,
          bottom: 54,
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          justifyContent: "center",
          textAlign: "center",
        }}
      >
        {eyebrowEl(accent, f.eyebrow)}
        <div
          style={{
            fontFamily: f.bigArabic ? ARABIC_DISPLAY : SERIF,
            fontWeight: 500,
            fontSize: f.bigArabic ? 26 : 20,
            fontStyle: f.bigArabic ? "normal" : "italic",
            color: f.bigArabic ? accent : "#3a2f24",
            lineHeight: 1.14,
          }}
        >
          {f.bigText}
        </div>
        {f.translit ? (
          <div
            style={{
              fontFamily: UI,
              fontWeight: 400,
              fontSize: 8,
              letterSpacing: ".18em",
              color: "#9a8568",
              marginTop: 7,
            }}
          >
            {f.translit}
          </div>
        ) : null}
        {f.line2 ? (
          <div
            style={{
              fontFamily: f.line2Arabic ? ARABIC_DISPLAY : SERIF,
              fontWeight: 500,
              fontSize: f.line2Arabic ? 17 : 13,
              color: accent,
              marginTop: 8,
              lineHeight: 1.25,
            }}
          >
            {f.line2}
          </div>
        ) : null}
        <div
          style={{
            width: 18,
            height: 1,
            background: hexA(accent, 0.5),
            margin: "11px auto",
          }}
        />
        {f.foot ? (
          <div
            style={{
              fontFamily: SERIF,
              fontWeight: 500,
              fontSize: 14,
              fontStyle: "italic",
              color: "#5a4636",
              lineHeight: 1.3,
            }}
          >
            {f.foot}
          </div>
        ) : null}
      </div>
    </div>
  );
}

function FrontInner({
  styleId,
  slots,
  accent,
  interactive,
  photoUrl,
  onPickPhoto,
}: {
  styleId: CollectionId;
  slots: FrontSlots;
  accent: string;
  interactive?: boolean;
  photoUrl?: string | null;
  onPickPhoto?: (file: File) => void;
}) {
  switch (styleId) {
    case "field":
      return <FieldFace f={slots} accent={accent} />;
    case "wash":
      return <WashFace f={slots} accent={accent} />;
    case "image":
      return (
        <ImageFace
          f={slots}
          accent={accent}
          interactive={interactive}
          photoUrl={photoUrl}
          onPickPhoto={onPickPhoto}
        />
      );
    case "textile":
      return <TextileFace f={slots} accent={accent} />;
    case "statement":
      return <StatementFace f={slots} accent={accent} />;
    case "arch":
    default:
      return <ArchFace f={slots} accent={accent} />;
  }
}

// ---- INSIDE renderers ----

function InsideMessage({
  message,
  sender,
  pad,
}: {
  message: string;
  sender: string;
  pad?: string;
}) {
  const msgRtl = isArabic(message);
  const msgStyle: CSS = {
    fontFamily: msgRtl ? ARABIC_BODY : SERIF,
    fontWeight: 400,
    fontSize: msgRtl ? 15 : 13.5,
    color: "#3a352b",
    lineHeight: msgRtl ? 1.85 : 1.72,
    whiteSpace: "pre-wrap",
  };
  return (
    <div
      style={{
        position: "absolute",
        top: "50%",
        left: 0,
        right: 0,
        transform: "translateY(-50%)",
        padding: pad || "0 38px",
        textAlign: "center",
        zIndex: 2,
      }}
    >
      <div dir="auto" style={msgStyle}>
        {message}
      </div>
      <div
        dir="auto"
        style={{
          marginTop: 14,
          fontFamily: SERIF,
          fontWeight: 500,
          fontSize: 14,
          fontStyle: "italic",
          color: "#7a6a58",
        }}
      >
        {"— " + (sender || "With love")}
      </div>
    </div>
  );
}

function Quatrefoil({ accent }: { accent: string }) {
  return (
    <svg width={18} height={18} viewBox="-11 -11 22 22">
      <circle cx={0} cy={-5} r={5} fill="none" stroke={hexA(accent, 0.7)} strokeWidth={1} />
      <circle cx={0} cy={5} r={5} fill="none" stroke={hexA(accent, 0.7)} strokeWidth={1} />
      <circle cx={-5} cy={0} r={5} fill="none" stroke={hexA(accent, 0.7)} strokeWidth={1} />
      <circle cx={5} cy={0} r={5} fill="none" stroke={hexA(accent, 0.7)} strokeWidth={1} />
      <circle cx={0} cy={0} r={1.6} fill={accent} />
    </svg>
  );
}

function Sprig({ accent }: { accent: string }) {
  return (
    <svg width={34} height={16} viewBox="-17 -8 34 16">
      <path
        d="M0,7 C0,2 0,-1 0,-6"
        stroke={hexA(accent, 0.7)}
        strokeWidth={1}
        fill="none"
        strokeLinecap="round"
      />
      <path
        d="M0,-1 C5,-2 8,-5 10,-9 M0,-1 C-5,-2 -8,-5 -10,-9 M0,3 C4,2 6,0 8,-3 M0,3 C-4,2 -6,0 -8,-3"
        stroke={hexA(accent, 0.6)}
        strokeWidth={1}
        fill="none"
        strokeLinecap="round"
      />
      <circle cx={0} cy={-6} r={1.5} fill={accent} />
    </svg>
  );
}

function Rosette({ accent }: { accent: string }) {
  const petals: React.ReactNode[] = [];
  for (let i = 0; i < 8; i++) {
    const ang = (i * 45 * Math.PI) / 180;
    petals.push(
      <circle
        key={i}
        cx={6 * Math.cos(ang)}
        cy={6 * Math.sin(ang)}
        r={2.1}
        fill="none"
        stroke={hexA(accent, 0.7)}
        strokeWidth={1}
      />,
    );
  }
  return (
    <svg width={18} height={18} viewBox="-11 -11 22 22">
      {petals}
      <circle cx={0} cy={0} r={1.8} fill={accent} />
    </svg>
  );
}

function MotifHead({
  motif,
  accent,
  top,
}: {
  motif: React.ReactNode;
  accent: string;
  top?: number;
}) {
  return (
    <div
      style={{
        position: "absolute",
        top: top == null ? 34 : top,
        left: 0,
        right: 0,
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        zIndex: 2,
      }}
    >
      <div style={{ width: 28, height: 1, background: hexA(accent, 0.45) }} />
      <div style={{ margin: "0 10px", display: "flex" }}>{motif}</div>
      <div style={{ width: 28, height: 1, background: hexA(accent, 0.45) }} />
    </div>
  );
}

function IFrame({ children }: { children: React.ReactNode }) {
  return (
    <div
      style={{
        width: 232,
        height: 327,
        background: "#f8f2e8",
        position: "relative",
        overflow: "hidden",
      }}
    >
      {children}
    </div>
  );
}

function InsideInner({
  styleId,
  accent,
  message,
  sender,
  eyebrow,
}: {
  styleId: CollectionId;
  accent: string;
  message: string;
  sender: string;
  eyebrow: string;
}) {
  const msg = (pad?: string) => (
    <InsideMessage message={message} sender={sender} pad={pad} />
  );
  const msgRtl = isArabic(message);
  const cartoucheMsgStyle: CSS = {
    fontFamily: msgRtl ? ARABIC_BODY : SERIF,
    fontWeight: 400,
    fontSize: msgRtl ? 15 : 13.5,
    color: "#3a352b",
    lineHeight: msgRtl ? 1.85 : 1.72,
    whiteSpace: "pre-wrap",
  };

  switch (styleId) {
    case "field":
      return (
        <IFrame>
          <div
            style={{
              position: "absolute",
              top: 0,
              left: 0,
              bottom: 0,
              width: 11,
              background: accent,
            }}
          />
          <div
            style={{
              position: "absolute",
              top: 0,
              left: 11,
              bottom: 0,
              width: 3,
              background: hexA(accent, 0.28),
            }}
          />
          <MotifHead motif={<Quatrefoil accent={accent} />} accent={accent} />
          <div
            style={{
              position: "absolute",
              bottom: 30,
              left: 0,
              right: 0,
              display: "flex",
              justifyContent: "center",
            }}
          >
            <div style={{ width: 30, height: 1, background: hexA(accent, 0.4) }} />
          </div>
          {msg("0 34px 0 42px")}
        </IFrame>
      );
    case "wash":
      return (
        <IFrame>
          <div
            style={{
              position: "absolute",
              top: -40,
              right: -36,
              width: 170,
              height: 150,
              borderRadius: "50%",
              background: hexA(accent, 0.4),
              filter: "blur(26px)",
            }}
          />
          <div
            style={{
              position: "absolute",
              bottom: -48,
              left: -40,
              width: 170,
              height: 150,
              borderRadius: "50%",
              background: hexA(accent, 0.3),
              filter: "blur(28px)",
            }}
          />
          <div
            style={{
              position: "absolute",
              top: 118,
              left: -30,
              right: -30,
              height: 96,
              background: `radial-gradient(60% 56% at 50% 50%,${hexA(
                accent,
                0.16,
              )},transparent 72%)`,
              filter: "blur(8px)",
            }}
          />
          <MotifHead motif={<Sprig accent={accent} />} accent={accent} />
          {msg("0 40px")}
        </IFrame>
      );
    case "statement":
      return (
        <IFrame>
          <div
            style={{
              position: "absolute",
              top: 0,
              left: 0,
              right: 0,
              height: 9,
              background: accent,
            }}
          />
          <div
            style={{
              position: "absolute",
              top: 36,
              left: 0,
              right: 0,
              textAlign: "center",
              zIndex: 2,
              fontFamily: UI,
              fontWeight: 400,
              fontSize: 9,
              letterSpacing: ".34em",
              textTransform: "uppercase",
              color: accent,
            }}
          >
            {eyebrow}
          </div>
          <div
            style={{
              position: "absolute",
              top: 58,
              left: 0,
              right: 0,
              display: "flex",
              justifyContent: "center",
              zIndex: 2,
            }}
          >
            <div style={{ width: 30, height: 2, background: accent }} />
          </div>
          {msg("0 38px")}
          <div
            style={{
              position: "absolute",
              bottom: 0,
              left: 0,
              right: 0,
              height: 9,
              background: accent,
            }}
          />
        </IFrame>
      );
    case "textile": {
      const tiles: React.ReactNode[] = [];
      let row = 0;
      for (let y = 16; y < 332; y += 28) {
        const off = row % 2 ? 14 : 0;
        for (let x = 8; x < 240; x += 28) {
          tiles.push(
            <g key={`${x}-${y}`} transform={`translate(${x + off},${y})`}>
              <path d="M0,-5 C2.6,-2.6 2.6,-1 0,1 C-2.6,-1 -2.6,-2.6 0,-5 Z" fill="none" stroke={hexA(accent, 0.16)} strokeWidth={1} />
              <path d="M0,5 C2.6,2.6 2.6,1 0,-1 C-2.6,1 -2.6,2.6 0,5 Z" fill="none" stroke={hexA(accent, 0.16)} strokeWidth={1} />
              <path d="M-5,0 C-2.6,-2.6 -1,-2.6 1,0 C-1,2.6 -2.6,2.6 -5,0 Z" fill="none" stroke={hexA(accent, 0.16)} strokeWidth={1} />
              <path d="M5,0 C2.6,-2.6 1,-2.6 -1,0 C1,2.6 2.6,2.6 5,0 Z" fill="none" stroke={hexA(accent, 0.16)} strokeWidth={1} />
              <circle cx={0} cy={0} r={0.9} fill={hexA(accent, 0.3)} />
            </g>,
          );
        }
        row++;
      }
      return (
        <IFrame>
          <svg
            width={232}
            height={327}
            viewBox="0 0 232 327"
            style={{ position: "absolute", top: 0, left: 0 }}
          >
            {tiles}
          </svg>
          <div
            style={{
              position: "absolute",
              top: "50%",
              left: 24,
              right: 24,
              transform: "translateY(-50%)",
              background: hexA("#f8f2e8", 0.94),
              border: `1px solid ${hexA(accent, 0.4)}`,
              boxShadow: "0 6px 18px rgba(40,30,15,.1)",
              padding: "26px 22px 24px",
              textAlign: "center",
              zIndex: 2,
            }}
          >
            <div style={{ display: "flex", justifyContent: "center", marginBottom: 14 }}>
              <Rosette accent={accent} />
            </div>
            <div dir="auto" style={cartoucheMsgStyle}>
              {message}
            </div>
            <div
              dir="auto"
              style={{
                marginTop: 14,
                fontFamily: SERIF,
                fontWeight: 500,
                fontSize: 13.5,
                fontStyle: "italic",
                color: "#7a6a58",
              }}
            >
              {"— " + (sender || "With love")}
            </div>
          </div>
        </IFrame>
      );
    }
    case "image":
      return (
        <IFrame>
          <div
            style={{
              position: "absolute",
              top: 0,
              left: 0,
              right: 0,
              height: 96,
              overflow: "hidden",
              background: `radial-gradient(70px 60px at 24% 26%,${hexA(
                "#ffe7b0",
                0.85,
              )},transparent 60%),linear-gradient(150deg,${hexA(
                accent,
                0.9,
              )},${accent})`,
            }}
          >
            <div
              style={{
                position: "absolute",
                top: 14,
                right: 26,
                width: 34,
                height: 34,
                borderRadius: "50%",
                background: "rgba(255,255,255,.22)",
                filter: "blur(2px)",
              }}
            />
            <div
              style={{
                position: "absolute",
                top: 48,
                right: 64,
                width: 18,
                height: 18,
                borderRadius: "50%",
                background: "rgba(255,255,255,.18)",
                filter: "blur(2px)",
              }}
            />
            <div
              style={{
                position: "absolute",
                inset: 0,
                boxShadow: "inset 0 -8px 16px rgba(0,0,0,.12)",
              }}
            />
          </div>
          <div
            style={{
              position: "absolute",
              top: 104,
              left: 30,
              right: 30,
              height: 1,
              background: hexA(accent, 0.5),
            }}
          />
          <div
            style={{
              position: "absolute",
              top: 112,
              left: 0,
              right: 0,
              textAlign: "center",
              zIndex: 2,
              fontFamily: UI,
              fontWeight: 400,
              fontSize: 9,
              letterSpacing: ".26em",
              textTransform: "uppercase",
              color: hexA(accent, 0.85),
            }}
          >
            {eyebrow}
          </div>
          <div
            style={{
              position: "absolute",
              top: 150,
              left: 0,
              right: 0,
              bottom: 24,
              display: "flex",
              alignItems: "center",
            }}
          >
            <div style={{ width: "100%", padding: "0 36px", textAlign: "center" }}>
              <div dir="auto" style={cartoucheMsgStyle}>
                {message}
              </div>
              <div
                dir="auto"
                style={{
                  marginTop: 14,
                  fontFamily: SERIF,
                  fontWeight: 500,
                  fontSize: 13.5,
                  fontStyle: "italic",
                  color: "#7a6a58",
                }}
              >
                {"— " + (sender || "With love")}
              </div>
            </div>
          </div>
        </IFrame>
      );
    case "arch":
    default:
      return (
        <IFrame>
          <svg
            width={232}
            height={327}
            viewBox="0 0 232 327"
            style={{ position: "absolute", top: 0, left: 0 }}
          >
            <path
              d="M26,306 L26,150 Q26,30 116,16 Q206,30 206,150 L206,306"
              fill="none"
              stroke={hexA(accent, 0.4)}
              strokeWidth={1.3}
            />
            <path
              d="M36,306 L36,152 Q36,46 116,32 Q196,46 196,152 L196,306"
              fill="none"
              stroke={hexA(accent, 0.22)}
              strokeWidth={0.7}
            />
            <circle cx={115} cy={66} r={9} fill={accent} />
            <circle cx={119.5} cy={63} r={7.4} fill="#f8f2e8" />
          </svg>
          {msg("0 50px")}
        </IFrame>
      );
  }
}

// ---- public scaled wrappers (makeFace / insideFace) ----

interface CardFaceProps {
  styleId: CollectionId;
  accent: string;
  px: number;
  face: "front" | "inside";
  // front config
  slots?: FrontSlots;
  interactive?: boolean;
  photoUrl?: string | null;
  onPickPhoto?: (file: File) => void;
  // inside config
  message?: string;
  sender?: string;
  eyebrow?: string;
}

export default function CardFace({
  styleId,
  accent,
  px,
  face,
  slots,
  interactive,
  photoUrl,
  onPickPhoto,
  message = "",
  sender = "",
  eyebrow = "",
}: CardFaceProps) {
  const sc = px / 232;
  const inner =
    face === "front" ? (
      <FrontInner
        styleId={styleId}
        slots={slots as FrontSlots}
        accent={accent}
        interactive={interactive}
        photoUrl={photoUrl}
        onPickPhoto={onPickPhoto}
      />
    ) : (
      <InsideInner
        styleId={styleId}
        accent={accent}
        message={message}
        sender={sender}
        eyebrow={eyebrow}
      />
    );
  return (
    <div
      style={{
        width: px,
        height: Math.round((px * 327) / 232),
        position: "relative",
        overflow: "hidden",
      }}
    >
      <div
        style={{
          position: "absolute",
          top: 0,
          left: 0,
          width: 232,
          height: 327,
          transform: `scale(${sc})`,
          transformOrigin: "top left",
        }}
      >
        {inner}
      </div>
    </div>
  );
}
