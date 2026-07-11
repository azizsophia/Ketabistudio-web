import type { MetadataRoute } from "next";

/* Allow crawling of public pages (the coming-soon page and legal pages are
   the only things visitors see while the gate is up, which is fine to index
   for waitlist discovery). Admin, API and delivered-card links stay out. */
export default function robots(): MetadataRoute.Robots {
  return {
    rules: {
      userAgent: "*",
      allow: "/",
      disallow: ["/admin", "/api/", "/c/", "/order/"],
    },
    sitemap: "https://www.ketabistudio.com/sitemap.xml",
    host: "https://www.ketabistudio.com",
  };
}
