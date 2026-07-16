import { redirect } from "next/navigation";

// Retired (site audit 2026-07-16): this page duplicated the storybook shelf
// with softer imagery and nothing linked to it. Old bookmarks land on the shelf.
export default function KidsCorner() {
  redirect("/shop/storybooks");
}
