"use client";

/**
 * Live cover preview for the personalized "My Beautiful Duas" book.
 * Uses the real (nameless) printed cover art for the chosen character + look
 * and overlays the customer's typed name in gold, matching the print layout.
 * Nameless covers live at /images/duas/cover-{character}-{look}.jpg.
 */
type Props = { name: string; character: string; look: string };

export default function DuasPreview({ name, character, look }: Props) {
  const src = `/images/duas/cover-${character}-${look}.jpg`;
  const display = (name || "Your Child").trim() || "Your Child";
  return (
    <div
      style={{
        position: "relative",
        aspectRatio: "1 / 1",
        borderRadius: 14,
        overflow: "hidden",
        background: "#3a3460",
        boxShadow: "0 10px 30px rgba(80,60,20,0.18)",
        containerType: "inline-size",
      }}
    >
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        src={src}
        alt=""
        style={{ position: "absolute", inset: 0, width: "100%", height: "100%", objectFit: "cover" }}
        onError={(e) => {
          (e.currentTarget as HTMLImageElement).style.visibility = "hidden";
        }}
      />
      <div
        style={{
          position: "absolute",
          top: "6.5%",
          left: 0,
          right: 0,
          textAlign: "center",
          padding: "0 6%",
          fontFamily: "'Cormorant Garamond', Georgia, serif",
          fontStyle: "italic",
          fontWeight: 700,
          color: "#e0b25c",
          fontSize: "clamp(28px, 9.4cqw, 74px)",
          lineHeight: 1,
          textShadow: "0 2px 10px rgba(40,30,60,0.35)",
          whiteSpace: "nowrap",
          overflow: "hidden",
          textOverflow: "ellipsis",
        }}
      >
        {display}&rsquo;s
      </div>
    </div>
  );
}
