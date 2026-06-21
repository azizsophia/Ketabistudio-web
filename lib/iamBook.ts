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
   isn't here (or is spelled differently) is simply typed in or corrected.
   Never printed without the parent confirming. */
export const NAME_SUGGEST: Record<string, string> = {
  // ── prophets & classical male names ──
  muhammad: "مُحَمَّد", mohammed: "مُحَمَّد", mohammad: "مُحَمَّد", muhammed: "مُحَمَّد",
  ahmad: "أَحْمَد", ahmed: "أَحْمَد", mahmoud: "مَحْمُود", mahmud: "مَحْمُود",
  yusuf: "يُوسُف", yousef: "يُوسُف", yousuf: "يُوسُف", youssef: "يُوسُف",
  ibrahim: "إِبْرَاهِيم", ismail: "إِسْمَاعِيل", ismael: "إِسْمَاعِيل",
  ishaq: "إِسْحَاق", yaqub: "يَعْقُوب", yaqoub: "يَعْقُوب", musa: "مُوسَى",
  isa: "عِيسَى", harun: "هَارُون", haroon: "هَارُون", dawud: "دَاوُود", dawood: "دَاوُود",
  sulaiman: "سُلَيْمَان", sulayman: "سُلَيْمَان", suleiman: "سُلَيْمَان",
  nuh: "نُوح", adam: "آدَم", idris: "إِدْرِيس", yunus: "يُونُس", younes: "يُونُس",
  yahya: "يَحْيَى", zakariya: "زَكَرِيَّا", ayyub: "أَيُّوب", ayoub: "أَيُّوب",
  taha: "طٰهٰ", yaseen: "يَاسِين", yasin: "يَاسِين", luqman: "لُقْمَان",
  salih: "صَالِح", saleh: "صَالِح", shuaib: "شُعَيْب", hud: "هُود",
  // ── companions & common male names ──
  ali: "عَلِيّ", omar: "عُمَر", umar: "عُمَر", uthman: "عُثْمَان", othman: "عُثْمَان",
  abubakr: "أَبُو بَكْر", hamza: "حَمْزَة", bilal: "بِلَال", hassan: "حَسَن", hasan: "حَسَن",
  husayn: "حُسَيْن", hussein: "حُسَيْن", hussain: "حُسَيْن", zaid: "زَيْد", zayd: "زَيْد",
  khalid: "خَالِد", talha: "طَلْحَة", anas: "أَنَس", saad: "سَعْد", sad: "سَعْد",
  muadh: "مُعَاذ", muath: "مُعَاذ", ammar: "عَمَّار", abdullah: "عَبْدُ الله",
  abdurrahman: "عَبْدُ الرَّحْمٰن", abdulrahman: "عَبْدُ الرَّحْمٰن", abdulaziz: "عَبْدُ العَزِيز",
  zubair: "الزُّبَيْر", suhaib: "صُهَيْب", suhayb: "صُهَيْب", ubayd: "عُبَيْد",
  qasim: "قَاسِم", tariq: "طَارِق", tarek: "طَارِق", faris: "فَارِس", fares: "فَارِس",
  sami: "سَامِي", samir: "سَمِير", nadir: "نَادِر", nabil: "نَبِيل", munir: "مُنِير",
  rashid: "رَشِيد", rasheed: "رَشِيد", karim: "كَرِيم", kareem: "كَرِيم",
  jamal: "جَمَال", kamal: "كَمَال", hashim: "هَاشِم", hatim: "حَاتِم", hatem: "حَاتِم",
  faisal: "فَيْصَل", fahad: "فَهْد", fahd: "فَهْد", fadi: "فَادِي", ghassan: "غَسَّان",
  habib: "حَبِيب", hadi: "هَادِي", hamid: "حَامِد", imad: "عِمَاد", imran: "عِمْرَان",
  jad: "جَاد", mazin: "مَازِن", mansour: "مَنْصُور", murad: "مُرَاد", nasir: "نَاصِر",
  nasser: "نَاصِر", raed: "رَائِد", raid: "رَائِد", saif: "سَيْف", sayf: "سَيْف",
  sufyan: "سُفْيَان", tamim: "تَمِيم", talal: "طَلَال", usama: "أُسَامَة", osama: "أُسَامَة",
  waleed: "وَلِيد", walid: "وَلِيد", wael: "وَائِل", yazan: "يَزَن", zain: "زَيْن",
  zayn: "زَيْن", ziad: "زِيَاد", ziyad: "زِيَاد", zuhair: "زُهَيْر", adnan: "عَدْنَان",
  amir: "أَمِير", ameer: "أَمِير", rayan: "رَيَّان", rayyan: "رَيَّان", bashir: "بَشِير",
  basim: "بَاسِم", bassam: "بَسَّام", nawaf: "نَوَّاف", majid: "مَاجِد", maged: "مَاجِد",
  marwan: "مَرْوَان", nizar: "نِزَار",
  // ── women: mothers, companions & common female names ──
  maryam: "مَرْيَم", mariam: "مَرْيَم", aisha: "عَائِشَة", ayesha: "عَائِشَة",
  fatima: "فَاطِمَة", fatimah: "فَاطِمَة", khadijah: "خَدِيجَة", khadija: "خَدِيجَة",
  zainab: "زَيْنَب", zaynab: "زَيْنَب", hafsa: "حَفْصَة", ruqayya: "رُقَيَّة", ruqayyah: "رُقَيَّة",
  sumayya: "سُمَيَّة", sumayyah: "سُمَيَّة", safiyya: "صَفِيَّة", safiyyah: "صَفِيَّة",
  asiya: "آسِيَة", asiyah: "آسِيَة", amina: "آمِنَة", aminah: "آمِنَة", halima: "حَلِيمَة",
  hawwa: "حَوَّاء", hajar: "هَاجَر", sawda: "سَوْدَة", ramla: "رَمْلَة",
  layla: "لَيْلَى", laila: "لَيْلَى", salma: "سَلْمَى", noor: "نُور", nour: "نُور", nur: "نُور",
  huda: "هُدَى", sara: "سَارَة", sarah: "سَارَة", hana: "هَنَاء", hanaa: "هَنَاء",
  maya: "مَايَا", aaliyah: "عَالِيَة", alia: "عَالِيَة", aliyah: "عَالِيَة",
  amira: "أَمِيرَة", ameera: "أَمِيرَة", iman: "إِيمَان", eman: "إِيمَان", asma: "أَسْمَاء",
  yasmin: "يَاسْمِين", yasmine: "يَاسْمِين", jasmine: "يَاسْمِين", lina: "لِينَا", lana: "لَانَا",
  mira: "مِيرَا", nada: "نَدَى", reem: "رِيم", rim: "رِيم", rana: "رَنَا", rama: "رَامَا",
  sana: "سَنَاء", sanaa: "سَنَاء", shahd: "شَهْد", tala: "تَالَا", talia: "تَالِيَا",
  wafa: "وَفَاء", yara: "يَارَا", zahra: "زَهْرَاء", zahraa: "زَهْرَاء", zara: "زَارَا",
  aya: "آيَة", ayah: "آيَة", alya: "عَلْيَاء", bushra: "بُشْرَى", dina: "دِينَا", deena: "دِينَا",
  duaa: "دُعَاء", farah: "فَرَح", ghada: "غَادَة", hala: "هَالَة", hanan: "حَنَان",
  hind: "هِنْد", israa: "إِسْرَاء", jana: "جَنَى", jannah: "جَنَّة", jood: "جُود", joud: "جُود",
  lama: "لَمَى", lamar: "لَمَار", lubna: "لُبْنَى", maha: "مَهَا", malak: "مَلَك", manar: "مَنَار",
  rahma: "رَحْمَة", raneem: "رَنِيم", sawsan: "سَوْسَن", sireen: "سِيرِين", sirin: "سِيرِين",
  sundus: "سُنْدُس", tasneem: "تَسْنِيم", tasnim: "تَسْنِيم", yaqeen: "يَقِين", yaqin: "يَقِين",
  zaina: "زَيْنَة", zeina: "زَيْنَة", razan: "رَزَان", raghad: "رَغَد", retaj: "رِتَاج",
  shaden: "شَادِن", lian: "لِيَان",
};

export function suggestArabic(name: string): string {
  const k = (name || "").trim().toLowerCase().replace(/\s+/g, "");
  return NAME_SUGGEST[k] || "";
}

/* A rough Latin->Arabic transliteration for names NOT in the lookup, so the
   "Suggest" button always offers a starting point. It is intentionally a first
   draft: the parent MUST read it and correct it before confirming (the UI
   flags it as approximate). Common digraphs and long vowels are handled; short
   medial vowels are dropped, the way Arabic names are usually written. */
const _DIGRAPH: Record<string, string> = {
  kh: "خ", sh: "ش", th: "ث", dh: "ذ", gh: "غ", ph: "ف", ck: "ك",
};
const _LONG: Record<string, string> = {
  aa: "ا", ee: "ي", ii: "ي", oo: "و", uu: "و", ou: "و", ea: "ي",
  ai: "اي", ay: "اي", ei: "ي", ey: "ي", au: "او", aw: "او",
};
const _CONS: Record<string, string> = {
  b: "ب", t: "ت", j: "ج", d: "د", r: "ر", z: "ز", s: "س", f: "ف",
  q: "ق", k: "ك", l: "ل", m: "م", n: "ن", h: "ه", w: "و", y: "ي",
  g: "غ", p: "ب", v: "ف", c: "ك", x: "كس", "'": "ع",
};

export function transliterateArabic(name: string): string {
  const s = (name || "").trim().toLowerCase().replace(/[^a-z']/g, "");
  if (!s) return "";
  const out: string[] = [];
  const isVowel = (c: string) => "aeiou".includes(c);
  for (let i = 0; i < s.length; i++) {
    const pair = s[i] + (s[i + 1] || "");
    if (_DIGRAPH[pair]) { out.push(_DIGRAPH[pair]); i++; continue; }
    if (_LONG[pair]) { out.push(_LONG[pair]); i++; continue; }
    const c = s[i];
    if (isVowel(c)) {
      if (i === 0) out.push(c === "u" || c === "o" ? "أو" : c === "i" || c === "e" ? "إي" : "أ");
      else if (i === s.length - 1) out.push(c === "u" || c === "o" ? "و" : c === "i" || c === "e" ? "ي" : "ا");
      // medial short vowel: dropped
      continue;
    }
    if (_CONS[c]) out.push(_CONS[c]);
  }
  return out.join("");
}

/* Returns { arabic, exact }. exact=true → came from the curated list
   (trustworthy); exact=false → a rough transliteration the parent must check. */
export function suggestArabicSmart(name: string): { arabic: string; exact: boolean } {
  const hit = suggestArabic(name);
  if (hit) return { arabic: hit, exact: true };
  return { arabic: transliterateArabic(name), exact: false };
}
