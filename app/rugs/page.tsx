import type { Metadata } from "next";
import RugStudio from "@/components/RugStudio";

export const metadata: Metadata = {
  title: "The Hopscotch Rug",
  description:
    "A soft personalized play rug for little ones, with the crescent moon and the numbers 1 to 10 in Arabic to hop along.",
};

export default function RugsPage() {
  return <RugStudio />;
}
