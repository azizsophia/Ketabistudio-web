import { redirect } from "next/navigation";

// The library is now organised under /shop (Storybooks + Keepsakes + Cards +
// Play Mats). Individual titles still live at /books/[slug]; this index simply
// forwards to the new shop so old links and CTAs keep working.
export default function BooksIndex() {
  redirect("/shop");
}
