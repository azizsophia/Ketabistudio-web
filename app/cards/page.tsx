import { redirect } from "next/navigation";

// Physical greeting cards were retired (matte stock scuffed in transit and the
// print-and-post economics did not work). The card experience now lives fully
// in the animated Digital Cards, so this old route sends visitors there.
export default function CardsPage() {
  redirect("/digital-cards");
}
