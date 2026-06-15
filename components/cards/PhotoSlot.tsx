"use client";

import { useRef } from "react";

// Controlled photo slot for the Imagery collection. The selected photo and the
// low-res check are owned by CardMaker; this just displays it and reports picks
// (tap-to-upload works on mobile; drag-drop still works on desktop).
// TODO (phase 2): real upload + hosting, persistent crop/reframe.

interface PhotoSlotProps {
  width: number;
  height: number;
  url?: string | null;
  onPick?: (file: File) => void;
  interactive?: boolean;
}

export default function PhotoSlot({
  width,
  height,
  url,
  onPick,
  interactive = true,
}: PhotoSlotProps) {
  const inputRef = useRef<HTMLInputElement>(null);

  const base: React.CSSProperties = {
    position: "absolute",
    top: 0,
    left: 0,
    width,
    height,
    display: "block",
    background: "#e9dfcc",
    overflow: "hidden",
  };

  if (!interactive) return <div style={base} />;

  return (
    <div
      style={{ ...base, cursor: "pointer", border: url ? "none" : "1px dashed #c3b69c" }}
      onClick={() => inputRef.current?.click()}
      onDragOver={(e) => e.preventDefault()}
      onDrop={(e) => {
        e.preventDefault();
        const f = e.dataTransfer.files?.[0];
        if (f && f.type.startsWith("image/")) onPick?.(f);
      }}
    >
      {url ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={url}
          alt="Your photo"
          style={{ width: "100%", height: "100%", objectFit: "cover", display: "block" }}
        />
      ) : (
        <div
          style={{
            position: "absolute",
            inset: 0,
            display: "flex",
            flexDirection: "column",
            alignItems: "center",
            justifyContent: "center",
            gap: 6,
            textAlign: "center",
            padding: 12,
            color: "#7a715f",
            font: "400 11px var(--cards-ui, sans-serif)",
            letterSpacing: ".04em",
          }}
        >
          <span>Tap to upload</span>
          <span style={{ fontSize: 9, opacity: 0.7 }}>your photo</span>
        </div>
      )}
      <input
        ref={inputRef}
        type="file"
        accept="image/*"
        hidden
        onChange={(e) => {
          const f = e.target.files?.[0];
          if (f) onPick?.(f);
          e.target.value = "";
        }}
      />
    </div>
  );
}
