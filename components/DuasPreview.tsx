"use client";

/**
 * Live cover preview for the personalized "My Beautiful Duas" book.
 * Composes the child's name (elegant serif, approximating the print
 * Cormorant Garamond) over the arch-portrait art for the chosen
 * character + look. Art lives at /images/duas/{character}-{look}.jpg.
 */
type Props = { name: string; character: string; look: string };

export default function DuasPreview({ name, character, look }: Props) {
  const src = `/images/duas/${character}-${look}.jpg`;
  const display = (name || "Your child").trim() || "Your child";
  return (
    <div
      style={{
        position: "relative",
        aspectRatio: "1 / 1",
        background: "#faf5ec",
        border: "4px solid #b8862b",
        borderRadius: 14,
        boxShadow: "0 10px 30px rgba(80,60,20,0.12)",
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        overflow: "hidden",
      }}
    >
      <div
        style={{
          fontFamily: "'Cormorant Garamond', Georgia, serif",
          fontStyle: "italic",
          fontWeight: 700,
          color: "#b8862b",
          fontSize: "clamp(30px, 8cqw, 64px)",
          lineHeight: 1.05,
          marginTop: "8%",
        }}
      >
        {display}&rsquo;s
      </div>
      <div
        style={{
          fontFamily: "'Cormorant Garamond', Georgia, serif",
          letterSpacing: "0.16em",
          color: "#3a3226",
          fontSize: "clamp(13px, 3.4cqw, 26px)",
          marginTop: "2%",
        }}
      >
        BEAUTIFUL DUAS
      </div>
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        src={src}
        alt=""
        style={{ width: "66%", marginTop: "auto", marginBottom: "5%", objectFit: "contain" }}
        onError={(e) => {
          (e.currentTarget as HTMLImageElement).style.visibility = "hidden";
        }}
      />
    </div>
  );
}
