import type { Metadata } from "next";
import IamBookBuilder from "@/components/IamBookBuilder";

export const metadata: Metadata = {
  title: "I Am: a personalized book of good character",
  description:
    "A personalized keepsake where your child is the hero of every page. Twelve beautiful traits in English and Arabic, with their name, your dedication, and your own photos.",
};

export default function IamBookPage() {
  return <IamBookBuilder />;
}
