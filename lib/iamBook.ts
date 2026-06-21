// Data + helpers for the "I Am [Child]" personalized book builder.
// The book is a 32-page square keepsake (Lulu 8.5x8.5), personalized with the
// child's name (English + Arabic), gender (pronouns), an optional dedication,
// up to 12 optional photos, a colourway, and a binding. Twelve "I am" character
// affirmations, English + Arabic, the same content the worker renderer prints.

import {
  BOOK_PRICE_CENTS,
  HARDCOVER_PRICE_CENTS,
  SOFTCOVER_PRICE_DISPLAY,
  HARDCOVER_PRICE_DISPLAY,
} from "./pricing";

export const IAM_SLUG = "i-am";
export const NAME_MAX = 24;
export const DEDICATION_MAX = 220;
export const PHOTO_SLOTS = 12; // all optional; empty slots print a designed page

export type Gender = "boy" | "girl";
export type Colorway = "teal" | "rose";
export type Binding = "hardcover" | "paperback";

export const COLORWAYS: { id: Colorway; name: string; hex: string }[] = [
  { id: "teal", name: "Teal & Gold", hex: "#2f5d57" },
  { id: "rose", name: "Rose & Gold", hex: "#a8596a" },
];

export const BINDINGS: { id: Binding; name: string; note: string; display: string; cents: number }[] = [
  { id: "hardcover", name: "Hardcover", note: "Premium keepsake, sewn casewrap", display: HARDCOVER_PRICE_DISPLAY, cents: HARDCOVER_PRICE_CENTS },
  { id: "paperback", name: "Paperback", note: "Soft, lighter, lovely too", display: SOFTCOVER_PRICE_DISPLAY, cents: BOOK_PRICE_CENTS },
];

export function bindingCents(b: string): number {
  return b === "paperback" ? BOOK_PRICE_CENTS : HARDCOVER_PRICE_CENTS;
}

// The twelve affirmations (mirrors the worker's content.json), used for the
// live preview so what the customer sees matches what prints.
export const TRAITS: { trait: string; arabic: string; translit: string }[] = [
  { trait: "Kind", arabic: "لَطِيف", translit: "lateef" },
  { trait: "Grateful", arabic: "شَاكِر", translit: "shakir" },
  { trait: "Loving", arabic: "بَارّ", translit: "barr" },
  { trait: "Generous", arabic: "كَرِيم", translit: "kareem" },
  { trait: "Honest", arabic: "صَادِق", translit: "sadiq" },
  { trait: "Forgiving", arabic: "صَفُوح", translit: "safooh" },
  { trait: "Patient", arabic: "صَابِر", translit: "sabir" },
  { trait: "Brave", arabic: "شُجَاع", translit: "shujaa" },
  { trait: "Curious", arabic: "مُتَعَلِّم", translit: "muta'allim" },
  { trait: "Clean", arabic: "نَظِيف", translit: "nadheef" },
  { trait: "Cheerful", arabic: "بَشُوش", translit: "bashoosh" },
  { trait: "Mindful", arabic: "تَقِيّ", translit: "taqiyy" },
];

// Arabic detection (so we can confirm the field really holds Arabic).
export const ARABIC_RE = /[؀-ۿ]/;
export function hasArabic(s: string): boolean {
  return ARABIC_RE.test(s || "");
}

/* A starter lookup of common names -> a common Arabic spelling. This only
   PRE-FILLS the field; the parent always edits and confirms it, so a name that
   isn't here (or is spelled differently) is simply typed in. Never printed
   without the parent confirming. */
export const NAME_SUGGEST: Record<string, string> = {
  muhammad: "مُحَمَّد", mohammed: "مُحَمَّد", ahmad: "أَحْمَد", ahmed: "أَحْمَد",
  mahmoud: "مَحْمُود", yusuf: "يُوسُف", yousef: "يُوسُف", ibrahim: "إِبْرَاهِيم",
  ismail: "إِسْمَاعِيل", ishaq: "إِسْحَاق", yaqub: "يَعْقُوب", musa: "مُوسَى",
  isa: "عِيسَى", harun: "هَارُون", dawud: "دَاوُود", sulaiman: "سُلَيْمَان",
  nuh: "نُوح", adam: "آدَم", idris: "إِدْرِيس", yunus: "يُونُس", yahya: "يَحْيَى",
  zakariya: "زَكَرِيَّا", ali: "عَلِيّ", omar: "عُمَر", umar: "عُمَر",
  uthman: "عُثْمَان", abubakr: "أَبُو بَكْر", hamza: "حَمْزَة", bilal: "بِلَال",
  hassan: "حَسَن", husayn: "حُسَيْن", hussein: "حُسَيْن", zaid: "زَيْد",
  khalid: "خَالِد", talha: "طَلْحَة", anas: "أَنَس", saad: "سَعْد",
  maryam: "مَرْيَم", aisha: "عَائِشَة", fatima: "فَاطِمَة", fatimah: "فَاطِمَة",
  khadijah: "خَدِيجَة", zainab: "زَيْنَب", zaynab: "زَيْنَب", hafsa: "حَفْصَة",
  ruqayya: "رُقَيَّة", sumayya: "سُمَيَّة", safiyya: "صَفِيَّة", asiya: "آسِيَة",
  amina: "آمِنَة", aminah: "آمِنَة", halima: "حَلِيمَة", layla: "لَيْلَى",
  salma: "سَلْمَى", noor: "نُور", nur: "نُور", huda: "هُدَى", sara: "سَارَة",
  sarah: "سَارَة", hana: "هَنَاء", maya: "مَايَا", aaliyah: "عَالِيَة",
  amir: "أَمِير", amira: "أَمِيرَة", rayan: "رَيَّان", rayyan: "رَيَّان",
  yahya2: "يَحْيَى", imran: "عِمْرَان", iman: "إِيمَان", asma: "أَسْمَاء",
};

export function suggestArabic(name: string): string {
  const k = (name || "").trim().toLowerCase().replace(/\s+/g, "");
  return NAME_SUGGEST[k] || "";
}
