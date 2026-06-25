import type { Metadata } from "next";
import DigitalCardMaker from "@/components/cards/DigitalCardMaker";

export const metadata: Metadata = {
  title: "Digital greeting cards",
  description:
    "A beautiful animated Islamic greeting card, delivered instantly by a private link. Personalize the message and dua, share it by text, WhatsApp or email, anywhere in the world.",
};

export default function DigitalCardsPage() {
  return <DigitalCardMaker />;
}
