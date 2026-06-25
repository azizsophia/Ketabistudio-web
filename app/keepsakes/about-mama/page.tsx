import type { Metadata } from "next";
import PhotobookBuilder from "@/components/PhotobookBuilder";
import { PHOTOBOOK_TEMPLATES } from "@/lib/photobook";

export const metadata: Metadata = {
  title: "Everything I Love About Mama, a photo keepsake",
  description:
    "Fill a beautiful hardcover keepsake with your own photos, each page carrying a heartfelt line written for you: twenty things to love about Mama, sealed with the dua for parents. Printed to order.",
};

export default function AboutMamaPage() {
  const template = PHOTOBOOK_TEMPLATES["about-mama"];
  return <PhotobookBuilder template={template} />;
}
