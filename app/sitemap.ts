import type { MetadataRoute } from "next";
import { VISIBLE_BOOKS } from "@/lib/books";
import { PHOTOBOOK_SLUGS } from "@/lib/photobook";

/* Canonical public URLs. While the coming-soon gate is up these redirect,
   which crawlers handle fine; at launch they resolve directly. Keeps launch
   day clean instead of scrambling for a sitemap later. */
const BASE = "https://www.ketabistudio.com";

export default function sitemap(): MetadataRoute.Sitemap {
  const now = new Date("2026-07-11");
  const staticPages = [
    "",
    "/shop",
    "/books",
    "/digital-cards",
    "/shop/keepsakes",
    "/about",
    "/app",
    "/refund-policy",
    "/privacy-policy",
    "/terms",
  ].map((path) => ({
    url: `${BASE}${path}`,
    lastModified: now,
    changeFrequency: "weekly" as const,
    priority: path === "" ? 1 : 0.7,
  }));

  const bookPages = VISIBLE_BOOKS.map((b) => ({
    url: `${BASE}/books/${b.slug}`,
    lastModified: now,
    changeFrequency: "monthly" as const,
    priority: 0.8,
  }));

  const keepsakePages = PHOTOBOOK_SLUGS.map((slug) => ({
    url: `${BASE}/keepsakes/${slug}`,
    lastModified: now,
    changeFrequency: "monthly" as const,
    priority: 0.6,
  }));

  return [...staticPages, ...bookPages, ...keepsakePages];
}
