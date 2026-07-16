/* ── Launch flags ──────────────────────────────────────────────────
   These are COMMITTED constants (not env vars) so the coming-soon gate is
   deterministic — Vercel Edge Middleware inlines env vars unreliably at
   build time, which left the gate silently off. To go fully live, set
   COMING_SOON to false and redeploy.

   Owner bypass: visit  /?preview=<PREVIEW_KEY>  once to set a cookie that
   unlocks the full site (so you can browse + place test orders). The key
   can be overridden by a PREVIEW_KEY env var if present, else this default
   is used. */
export const COMING_SOON = false; // LAUNCHED 2026-07-16 (owner's call) — store is public

export const PREVIEW_KEY = "ketabi-preview-2026";
