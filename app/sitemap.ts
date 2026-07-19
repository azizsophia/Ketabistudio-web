import type { MetadataRoute } from "next";
import { VISIBLE_BOOKS } from "@/lib/books";
import { PHOTOBOOK_SLUGS } from "@/lib/photobook";
import { GIFT_GUIDES } from "@/lib/giftGuides";

/* Canonical public URLs. While the coming-soon gate is up these redirect,
   which crawlers handle fine; at launch they resolve directly. Keeps launch
   day clean instead of scrambling for a sitemap later. */
const BASE = "https://www.ketabistudio.com";

export default function sitemap(): MetadataRoute.Sitemap {
  const now = new Date("2026-07-11");
  const staticPages = [
    "",
    "/shop",
    "/shop/storybooks",
    "/shop/keepsakes",
    "/journal",
    "/books",
    "/books/i-am",
    "/digital-cards",
    "/support",
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

  const giftPages = GIFT_GUIDES.map((g) => ({
    url: `${BASE}/gifts/${g.slug}`,
    lastModified: now,
    changeFrequency: "weekly" as const,
    priority: 0.8,
  }));

  const keepsakePages = PHOTOBOOK_SLUGS.map((slug) => ({
    url: `${BASE}/keepsakes/${slug}`,
    lastModified: now,
    changeFrequency: "monthly" as const,
    priority: 0.6,
  }));

  return [...staticPages, ...bookPages, ...keepsakePages, ...giftPages];
}
