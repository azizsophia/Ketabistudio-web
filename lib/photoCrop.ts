// Shared crop/zoom model for customer photos. A Crop is the rectangle of the
// ORIGINAL image that is shown in a frame, in fractions [0..1]:
//   { x, y, w, h }  (top-left + size; its pixel aspect equals the frame aspect)
// The same Crop drives the on-screen editor AND the print renderer, so what the
// customer positions is exactly what prints. Quality is protected by capping
// zoom so the visible region never drops below a minimum source resolution.

export type Crop = { x: number; y: number; w: number; h: number };

export const ZOOM_MAX = 4;

const clamp = (v: number, lo: number, hi: number) => Math.min(hi, Math.max(lo, v));

/** Largest "cover" rectangle (zoom = 1) of frameAspect inside the image. */
export function baseCoverWH(natAspect: number, frameAspect: number): { w: number; h: number } {
  // aspects are width/height
  if (natAspect > frameAspect) return { w: frameAspect / natAspect, h: 1 }; // image wider → height fills
  return { w: 1, h: natAspect / frameAspect }; // image taller → width fills
}

/** Build the visible Crop from editor state (zoom ≥ 1, focal point cx,cy in [0..1]). */
export function cropFromState(
  natAspect: number,
  frameAspect: number,
  zoom: number,
  cx: number,
  cy: number
): Crop {
  const base = baseCoverWH(natAspect, frameAspect);
  const z = clamp(zoom, 1, ZOOM_MAX);
  const w = Math.min(1, base.w / z);
  const h = Math.min(1, base.h / z);
  const x = clamp(cx - w / 2, 0, 1 - w);
  const y = clamp(cy - h / 2, 0, 1 - h);
  return { x, y, w, h };
}

/** Recover editor state from a stored Crop (used when re-opening a photo). */
export function stateFromCrop(
  crop: Crop,
  natAspect: number,
  frameAspect: number
): { zoom: number; cx: number; cy: number } {
  const base = baseCoverWH(natAspect, frameAspect);
  const zoom = clamp(base.w / crop.w, 1, ZOOM_MAX);
  return { zoom, cx: crop.x + crop.w / 2, cy: crop.y + crop.h / 2 };
}

/** CSS background-size + background-position that show a Crop inside a frame
 *  (used by the on-screen editor and the live preview). */
export function cropToBackground(crop: Crop): { size: string; position: string } {
  const size = `${(100 / crop.w).toFixed(4)}% ${(100 / crop.h).toFixed(4)}%`;
  const px = crop.w < 1 ? (crop.x / (1 - crop.w)) * 100 : 0;
  const py = crop.h < 1 ? (crop.y / (1 - crop.h)) * 100 : 0;
  const position = `${px.toFixed(4)}% ${py.toFixed(4)}%`;
  return { size, position };
}

/** Shortest visible source edge in pixels — the resolution actually printed. */
export function effectiveShortPx(crop: Crop, natW: number, natH: number): number {
  return Math.min(crop.w * natW, crop.h * natH);
}

/** Highest zoom that keeps the visible region at/above minShortPx (so it never
 *  prints blurry). Returns 1 when even the un-zoomed photo is below the floor. */
export function maxZoomForQuality(
  natW: number,
  natH: number,
  frameAspect: number,
  minShortPx: number
): number {
  const natAspect = natW / natH;
  const base = baseCoverWH(natAspect, frameAspect);
  const baseShort = Math.min(base.w * natW, base.h * natH);
  if (minShortPx <= 0) return ZOOM_MAX;
  return clamp(baseShort / minShortPx, 1, ZOOM_MAX);
}

/** Validate a Crop coming from the client before we store/print it. */
export function isValidCrop(c: unknown): c is Crop {
  if (!c || typeof c !== "object") return false;
  const { x, y, w, h } = c as Record<string, unknown>;
  const ok = (n: unknown) => typeof n === "number" && isFinite(n);
  if (![x, y, w, h].every(ok)) return false;
  const X = x as number, Y = y as number, W = w as number, H = h as number;
  return (
    W > 0 && H > 0 && W <= 1.0001 && H <= 1.0001 &&
    X >= -0.0001 && Y >= -0.0001 && X + W <= 1.0001 && Y + H <= 1.0001
  );
}
