import type { Metadata } from "next";
import PhotobookBuilder from "@/components/PhotobookBuilder";
import { PHOTOBOOK_TEMPLATES } from "@/lib/photobook";

export const metadata: Metadata = {
  title: "The Coolness of My Eyes — a keepsake for your spouse",
  description:
    "A hardcover keepsake of your love story — twenty things you love about the one Allah chose for you, sealed with the dua for spouses. Printed to order.",
};

export default function AboutSpousePage() {
  const template = PHOTOBOOK_TEMPLATES["about-spouse"];
  return <PhotobookBuilder template={template} />;
}
