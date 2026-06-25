import type { Metadata } from "next";
import PhotobookBuilder from "@/components/PhotobookBuilder";
import { PHOTOBOOK_TEMPLATES } from "@/lib/photobook";

export const metadata: Metadata = {
  title: "Welcome, Little One: a baby keepsake",
  description:
    "A hardcover keepsake for your little one: twenty things you love about them, sealed with a dua for righteous children. Perfect for an Aqiqah or first year.",
};

export default function AboutBabyPage() {
  const template = PHOTOBOOK_TEMPLATES["about-baby"];
  return <PhotobookBuilder template={template} />;
}
