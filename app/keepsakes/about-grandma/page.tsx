import type { Metadata } from "next";
import PhotobookBuilder from "@/components/PhotobookBuilder";
import { PHOTOBOOK_TEMPLATES } from "@/lib/photobook";

export const metadata: Metadata = {
  title: "Everything I Love About Grandma — a photo keepsake",
  description:
    "Fill a beautiful hardcover keepsake with your own photos and words — twenty things you love about Grandma, sealed with a dua for those who raised us. Printed to order.",
};

export default function AboutGrandmaPage() {
  const template = PHOTOBOOK_TEMPLATES["about-grandma"];
  return <PhotobookBuilder template={template} />;
}
