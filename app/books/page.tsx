import { redirect } from "next/navigation";

// "Books" means the storybook shelf. Individual titles still live at
// /books/[slug]; this index forwards straight to the shelf (the general
// four-category hub stays at /shop) so no two nav paths show the same page.
export default function BooksIndex() {
  redirect("/shop/storybooks");
}
