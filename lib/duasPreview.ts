/**
 * Data + helpers for the "My Beautiful Duas" flip-through preview.
 *
 * The two spreads below are ported EXACTLY from
 * worker/pipeline/duas_book.json (story_spreads: "When I wake up" and
 * "When I go to sleep"). The Arabic is resolved from the book's
 * treasure_chest by the spread's arabic_ref (0 = wake, 11 = sleep).
 *
 * Narrative copy contains tokens that get substituted live:
 *   [Child’s Name]  -> the typed name (or a placeholder when empty)
 *   [He/She]        -> capitalised subject pronoun
 *   [he/she]        -> lowercase subject pronoun
 *   [his/her]       -> possessive pronoun
 */

export type DuasSpread = {
  occasion: string;
  narrative: string;
  arabic: string;
  translit: string;
  meaning: string;
};

/* "When I wake up" — story_spreads[0], arabic from treasure_chest[0]. */
export const WAKE_SPREAD: DuasSpread = {
  occasion: "When I wake up",
  narrative:
    "Soft morning light slipped through the curtains, and [Child’s Name] woke up with a big stretch and a smile.",
  arabic:
    "الْحَمْدُ لِلّهِ الّذِي أَحْيَانَا بَعْدَ مَا أَمَاتَنَا وَإِلَيْهِ النُّشُورُ",
  translit:
    "Alhamdu lillahi alladhi ahyana ba’da ma amatana wa ilayhi-n-nushur.",
  meaning: "Thank You, Allah, for waking me to a new day.",
};

/* "When I go to sleep" — story_spreads[10], arabic from treasure_chest[11]. */
export const SLEEP_SPREAD: DuasSpread = {
  occasion: "When I go to sleep",
  narrative:
    "Snuggled warm under the blanket, [Child’s Name] whispered one last dua of the day.",
  arabic: "بِاسْمِكَ اللّهُمَّ أَمُوتُ وَأَحْيَا",
  translit: "Bismika-llahumma amutu wa ahya.",
  meaning: "In Your name, O Allah, I live and die.",
};

type Pronouns = {
  subjectCap: string; // He / She
  subject: string; // he / she
  possessive: string; // his / her
};

/* boy -> male pronouns; girl and hijab -> female pronouns. */
function pronounsFor(character: string): Pronouns {
  if (character === "boy") {
    return { subjectCap: "He", subject: "he", possessive: "his" };
  }
  return { subjectCap: "She", subject: "she", possessive: "her" };
}

/**
 * Replace the name + pronoun tokens in a narrative string.
 * `name` is the child's name; when empty, falls back to "Your child".
 */
export function substitute(
  text: string,
  name: string,
  character: string
): string {
  const child = name.trim() || "Your child";
  const p = pronounsFor(character);
  return text
    .replace(/\[Child’s Name\]/g, child)
    .replace(/\[Child's Name\]/g, child)
    .replace(/\[He\/She\]/g, p.subjectCap)
    .replace(/\[he\/she\]/g, p.subject)
    .replace(/\[his\/her\]/g, p.possessive);
}
