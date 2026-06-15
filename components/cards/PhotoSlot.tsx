"use client";

import { useCallback, useRef, useState } from "react";

// A simplified drop/click photo slot for the Imagery collection.
// Reimplemented from the prototype's image-slot.js (drag + crop), but pared
// down: drop or click-to-browse, object-fit:cover, with a low-res advisory.
// TODO (phase 2): real upload + hosting, persistent crop/reframe, and a hard
// low-res image guard (reject < 1500px short edge before accepting).

interface PhotoSlotProps {
  width: number;
  height: number;
  // Called with a flag when the dropped image is below the print threshold.
  onLowRes?: (isLow: boolean) => void;
  interactive?: boolean;
}

const MIN_SHORT_EDGE = 1500;

export default function PhotoSlot({
  width,
  height,
  onLowRes,
  interactive = true,
}: PhotoSlotProps) {
  const [url, setUrl] = useState<string | null>(null);
  const [over, setOver] = useState(false);
  const [lowRes, setLowRes] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  const ingest = useCallback(
    (file: File | undefined) => {
      if (!file || !file.type.startsWith("image/")) return;
      const objectUrl = URL.createObjectURL(file);
      const probe = new window.Image();
      probe.onload = () => {
        const shortEdge = Math.min(probe.naturalWidth, probe.naturalHeight);
        const isLow = shortEdge < MIN_SHORT_EDGE;
        setLowRes(isLow);
        onLowRes?.(isLow);
      };
      probe.src = objectUrl;
      setUrl(objectUrl);
    },
    [onLowRes],
  );

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

  if (!interactive) {
    return <div style={base} />;
  }

  return (
    <div
      style={{
        ...base,
        cursor: "pointer",
        border: over ? "2px solid #a07f4a" : "1px dashed #c3b69c",
      }}
      onClick={() => inputRef.current?.click()}
      onDragOver={(e) => {
        e.preventDefault();
        setOver(true);
      }}
      onDragLeave={() => setOver(false)}
      onDrop={(e) => {
        e.preventDefault();
        setOver(false);
        ingest(e.dataTransfer.files?.[0]);
      }}
    >
      {url ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={url}
          alt="Your photo"
          style={{
            width: "100%",
            height: "100%",
            objectFit: "cover",
            display: "block",
          }}
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
          <span>Drop your photo</span>
          <span style={{ fontSize: 9, opacity: 0.7 }}>or tap to browse</span>
        </div>
      )}
      {lowRes && (
        <div
          style={{
            position: "absolute",
            left: 6,
            right: 6,
            bottom: 6,
            background: "rgba(179,38,30,.92)",
            color: "#fff",
            font: "400 9px var(--cards-ui, sans-serif)",
            padding: "4px 6px",
            borderRadius: 3,
            lineHeight: 1.3,
          }}
        >
          Low resolution. Use an image at least 1500px on the shortest side for
          a crisp print.
        </div>
      )}
      <input
        ref={inputRef}
        type="file"
        accept="image/*"
        hidden
        onChange={(e) => {
          ingest(e.target.files?.[0]);
          e.target.value = "";
        }}
      />
    </div>
  );
}
