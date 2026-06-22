"use client";

import { useEffect, useRef, useState } from "react";
import styles from "./PhotoCropper.module.css";
import {
  type Crop,
  cropFromState,
  stateFromCrop,
  cropToBackground,
  effectiveShortPx,
  maxZoomForQuality,
} from "@/lib/photoCrop";

const clamp = (v: number, lo: number, hi: number) => Math.min(hi, Math.max(lo, v));
const clamp01 = (v: number) => clamp(v, 0, 1);

type Props = {
  src: string;
  /** frame aspect ratio (width / height) — e.g. 0.8 for the 4:5 cover arch, 1 for a square page */
  frameAspect: number;
  /** lowest acceptable visible-region short edge in px (caps zoom so it never prints blurry) */
  minShortPx: number;
  rounded?: string;
  value?: Crop | null;
  onChange: (c: Crop) => void;
  onClear?: () => void;
  /** in-context guides so the photo is positioned against what actually prints */
  captionAr?: string;
  captionTr?: string;
  showGradient?: boolean;
  showSafe?: boolean;
  /** full-bleed cover: pan only, no zoom (the photo fills the cover) */
  noZoom?: boolean;
};

export default function PhotoCropper({
  src, frameAspect, minShortPx, rounded, value, onChange, onClear,
  captionAr, captionTr, showGradient, showSafe, noZoom,
}: Props) {
  const frameRef = useRef<HTMLDivElement>(null);
  const [nat, setNat] = useState<{ w: number; h: number } | null>(null);
  const [zoom, setZoom] = useState(1);
  const [cx, setCx] = useState(0.5);
  const [cy, setCy] = useState(0.5);
  const inited = useRef(false);

  // read the image's natural pixel size (so the crop math uses real resolution)
  useEffect(() => {
    inited.current = false;
    setNat(null);
    const img = new window.Image();
    img.onload = () => setNat({ w: img.naturalWidth, h: img.naturalHeight });
    img.src = src;
  }, [src]);

  // seed editor state from a previously saved crop, once we know the dimensions
  useEffect(() => {
    if (!nat || inited.current) return;
    inited.current = true;
    if (value) {
      const s = stateFromCrop(value, nat.w / nat.h, frameAspect);
      setZoom(s.zoom); setCx(s.cx); setCy(s.cy);
    } else {
      setZoom(1); setCx(0.5); setCy(0.5);
    }
  }, [nat, value, frameAspect]);

  const natAspect = nat ? nat.w / nat.h : frameAspect;
  const zMax = noZoom ? 1 : (nat ? maxZoomForQuality(nat.w, nat.h, frameAspect, minShortPx) : 1);
  const crop = cropFromState(natAspect, frameAspect, noZoom ? 1 : Math.min(zoom, zMax || 1), cx, cy);

  // publish the crop whenever it changes (primitive deps avoid render loops)
  useEffect(() => {
    if (nat) onChange(crop);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [crop.x, crop.y, crop.w, crop.h, nat]);

  const bg = cropToBackground(crop);
  const lowRes = nat ? effectiveShortPx(crop, nat.w, nat.h) < minShortPx - 1 : false;

  // drag to pan (pointer events → mouse + touch)
  const drag = useRef<{ px: number; py: number; cx: number; cy: number } | null>(null);
  function onDown(e: React.PointerEvent) {
    (e.currentTarget as Element).setPointerCapture?.(e.pointerId);
    drag.current = { px: e.clientX, py: e.clientY, cx, cy };
  }
  function onMove(e: React.PointerEvent) {
    if (!drag.current || !frameRef.current) return;
    const r = frameRef.current.getBoundingClientRect();
    const dx = e.clientX - drag.current.px;
    const dy = e.clientY - drag.current.py;
    setCx(clamp01(drag.current.cx - (dx / r.width) * crop.w));
    setCy(clamp01(drag.current.cy - (dy / r.height) * crop.h));
  }
  function onUp() { drag.current = null; }
  function onWheel(e: React.WheelEvent) {
    if (!nat || noZoom) return;
    setZoom((z) => clamp(z * (e.deltaY < 0 ? 1.08 : 0.92), 1, zMax));
  }

  const canZoom = !noZoom && zMax > 1.001;

  return (
    <div className={styles.wrap}>
      <div
        ref={frameRef}
        className={styles.frame}
        style={{
          aspectRatio: String(frameAspect),
          borderRadius: rounded,
          backgroundImage: `url("${src}")`,
          backgroundSize: bg.size,
          backgroundPosition: bg.position,
        }}
        onPointerDown={onDown}
        onPointerMove={onMove}
        onPointerUp={onUp}
        onPointerCancel={onUp}
        onWheel={onWheel}
        role="application"
        aria-label="Drag to position the photo"
      >
        {showGradient && <span className={styles.grad} />}
        {showSafe && <span className={styles.safe} />}
        {(captionAr || captionTr) && (
          <span className={styles.cap}>
            {captionAr && <span className={styles.capAr} dir="rtl" lang="ar">{captionAr}</span>}
            {captionTr && <span className={styles.capTr}>{captionTr}</span>}
          </span>
        )}
        {onClear && (
          <button type="button" className={styles.clear} onClick={onClear} aria-label="Remove photo">×</button>
        )}
        {lowRes && <span className={styles.low}>Low res at this zoom</span>}
        <span className={styles.hint}>Drag to position</span>
      </div>
      {!noZoom && (
      <div className={styles.zoomRow} aria-hidden={!canZoom}>
        <span className={styles.zi}>−</span>
        <input
          className={styles.range}
          type="range"
          min={1}
          max={Math.max(1.01, zMax)}
          step={0.01}
          value={Math.min(zoom, zMax)}
          disabled={!canZoom}
          onChange={(e) => setZoom(parseFloat(e.target.value))}
          aria-label="Zoom"
        />
        <span className={styles.zi}>+</span>
      </div>
      )}
    </div>
  );
}
