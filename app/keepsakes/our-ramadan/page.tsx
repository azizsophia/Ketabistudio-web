import type { Metadata } from "next";
import PhotobookBuilder from "@/components/PhotobookBuilder";
import { PHOTOBOOK_TEMPLATES } from "@/lib/photobook";

export const metadata: Metadata = {
  title: "Everything I Love About Ramadan — a family keepsake",
  description:
    "A hardcover keepsake of your family's Ramadan & Eid — twenty things you love about the month, sealed with a dua for your family. Printed to order.",
};

export default function OurRamadanPage() {
  const template = PHOTOBOOK_TEMPLATES["our-ramadan"];
  return <PhotobookBuilder template={template} />;
}
