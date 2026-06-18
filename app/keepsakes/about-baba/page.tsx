import type { Metadata } from "next";
import PhotobookBuilder from "@/components/PhotobookBuilder";
import { PHOTOBOOK_TEMPLATES } from "@/lib/photobook";

export const metadata: Metadata = {
  title: "Everything I Love About Baba — a photo keepsake",
  description:
    "Fill a beautiful hardcover keepsake with your own photos and words — twenty things you love about Baba, sealed with the dua for parents. Printed to order.",
};

export default function AboutBabaPage() {
  const template = PHOTOBOOK_TEMPLATES["about-baba"];
  return <PhotobookBuilder template={template} />;
}
