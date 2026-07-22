"use client";

import { useEffect } from "react";

/* Fires a single Meta Pixel event (e.g. Purchase) once when a success page
   mounts. Deduplicated per browser session by event+id so a refresh or a
   back-navigation to the same confirmation does not double-count a sale. */

export default function PixelEvent({
  event,
  value,
  currency = "USD",
  id,
}: {
  event: string;
  value?: number;
  currency?: string;
  id?: string;
}) {
  useEffect(() => {
    const w = window as unknown as { fbq?: (...a: unknown[]) => void };
    if (typeof w.fbq !== "function") return;

    const key = `pxl:${event}:${id || ""}`;
    try {
      if (id && sessionStorage.getItem(key)) return;
    } catch {
      /* sessionStorage may be unavailable; fire anyway */
    }

    const params: Record<string, unknown> = {};
    if (typeof value === "number" && value > 0) {
      params.value = Number(value.toFixed(2));
      params.currency = currency;
    }
    if (id) params.content_ids = [id];

    w.fbq("track", event, params);

    try {
      if (id) sessionStorage.setItem(key, "1");
    } catch {
      /* ignore */
    }
  }, [event, value, currency, id]);

  return null;
}
