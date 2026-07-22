"use client";

import Script from "next/script";
import { usePathname } from "next/navigation";
import { useEffect, useRef } from "react";

/* Meta (Facebook) Pixel. Loads once, fires PageView on first load and on every
   client-side route change so Meta can (a) optimize paid delivery toward real
   buyers and (b) build retargeting/lookalike audiences from site visitors.
   The Pixel ID is public by design (it ships in client JS on every site that
   uses one), so it is safe to bake in a default; NEXT_PUBLIC_META_PIXEL_ID can
   override it without a code change. Purchase/other events fire via PixelEvent
   on the success pages. */

const PIXEL_ID = process.env.NEXT_PUBLIC_META_PIXEL_ID || "895853273045331";

export default function MetaPixel() {
  const pathname = usePathname();
  const primed = useRef(false);

  useEffect(() => {
    // The inline script already fires the first PageView on load; skip that
    // initial render, then fire one PageView per in-app navigation.
    if (!primed.current) {
      primed.current = true;
      return;
    }
    const w = window as unknown as { fbq?: (...a: unknown[]) => void };
    if (typeof w.fbq === "function") w.fbq("track", "PageView");
  }, [pathname]);

  if (!PIXEL_ID) return null;

  return (
    <>
      <Script id="meta-pixel" strategy="afterInteractive">
        {`!function(f,b,e,v,n,t,s){if(f.fbq)return;n=f.fbq=function(){n.callMethod?
n.callMethod.apply(n,arguments):n.queue.push(arguments)};if(!f._fbq)f._fbq=n;
n.push=n;n.loaded=!0;n.version='2.0';n.queue=[];t=b.createElement(e);t.async=!0;
t.src=v;s=b.getElementsByTagName(e)[0];s.parentNode.insertBefore(t,s)}(window,
document,'script','https://connect.facebook.net/en_US/fbevents.js');
fbq('init','${PIXEL_ID}');fbq('track','PageView');`}
      </Script>
      <noscript>
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          height="1"
          width="1"
          style={{ display: "none" }}
          alt=""
          src={`https://www.facebook.com/tr?id=${PIXEL_ID}&ev=PageView&noscript=1`}
        />
      </noscript>
    </>
  );
}
