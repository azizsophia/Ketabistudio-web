import { permanentRedirect } from "next/navigation";

/* The store is LIVE (2026-07-16). Old bio links, reels and waitlist emails
   still point here and were landing on a stale teaser — send everyone to the
   real storefront. Any ?r= attribution is forwarded so analytics keep it. */
export default async function ComingSoonPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const params = await searchParams;
  const qs = new URLSearchParams();
  for (const [k, v] of Object.entries(params)) {
    if (typeof v === "string") qs.set(k, v);
  }
  const suffix = qs.toString();
  permanentRedirect(suffix ? `/?${suffix}` : "/");
}
