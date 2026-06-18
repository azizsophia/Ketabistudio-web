import type { Metadata } from "next";
import PhotobookBuilder from "@/components/PhotobookBuilder";
import KeepsakePreview from "@/components/KeepsakePreview";
import { PHOTOBOOK_TEMPLATES } from "@/lib/photobook";

export const metadata: Metadata = {
  title: "Everything I Love About Baba — a photo keepsake",
  description:
    "Fill a beautiful hardcover keepsake with your own photos and words — twenty things you love about Baba, sealed with the dua for parents. Printed to order.",
};

export default function AboutBabaPage() {
  const template = PHOTOBOOK_TEMPLATES["about-baba"];
  return (
    <>
      <KeepsakePreview
        slug="about-baba"
        title={template.title}
        subtitle="Flip through the full keepsake — every page holds one of your photos and words, sealed with the dua for parents."
      />
      <PhotobookBuilder template={template} />
    </>
  );
}
