"use client";

import { usePathname } from "next/navigation";
import Header from "./Header";
import Footer from "./Footer";
import Splash from "./Splash";

/* The shared card viewer (/c/<token>) is a full-bleed, immersive gift moment —
   no shop header or footer. Everywhere else renders the normal site chrome. */
function isImmersive(pathname: string | null): boolean {
  return !!pathname && pathname.startsWith("/c/");
}

export function SiteHeader() {
  if (isImmersive(usePathname())) return null;
  return (
    <>
      <Splash />
      <Header />
    </>
  );
}

export function SiteFooter() {
  if (isImmersive(usePathname())) return null;
  return <Footer />;
}
