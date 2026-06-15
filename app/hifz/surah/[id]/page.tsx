import { redirect } from "next/navigation";
import Link from "next/link";
import { quran } from "@/lib/quran";
import { createClient } from "@/lib/supabase/server";
import { getUser, getAccess, FREE_SURAHS } from "@/lib/hifz/access";
import Ayah from "./Ayah";
import styles from "../../hifz.module.css";

export const dynamic = "force-dynamic";

// Sensible defaults — see report notes:
//   translation 131 = "The Clear Quran" (Dr. Mustafa Khattab)
//   recitation   7 = Mishary Rashid Alafasy
const TRANSLATION_ID = "131";
const RECITER_ID = 7;

// Per-ayah audio urls from QF come back as paths; prefix the CDN host when
// they aren't already absolute.
const AUDIO_HOST = "https://verses.quran.foundation/";
function audioUrl(raw?: string | null): string | null {
  if (!raw) return null;
  if (raw.startsWith("http://") || raw.startsWith("https://")) return raw;
  return AUDIO_HOST + raw.replace(/^\//, "");
}

type Verse = {
  id: number;
  verse_key: string;
  verse_number: number;
  text_uthmani?: string;
  translations?: { text: string }[];
  audio?: { url?: string } | null;
};

export async function generateMetadata({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  return { title: `Surah ${id}` };
}

export default async function SurahPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const chapterId = Number(id);
  if (!Number.isInteger(chapterId) || chapterId < 1 || chapterId > 114) {
    redirect("/hifz");
  }

  const user = await getUser();
  if (!user) redirect("/hifz/login");

  const access = await getAccess(user.id);
  if (!access.subscribed && !FREE_SURAHS.has(chapterId)) {
    redirect("/hifz");
  }

  const data = (await quran.versesByChapter(chapterId, {
    translations: TRANSLATION_ID,
    audio: RECITER_ID,
    fields: "text_uthmani",
    perPage: 286, // longest surah (Al-Baqarah) so we get the whole surah
  })) as { verses?: Verse[] } | null;

  const verses = data?.verses ?? [];

  // Which of these verses has the user already marked memorized?
  const memorizedKeys = new Set<string>();
  try {
    const supabase = await createClient();
    const { data: prog } = await supabase
      .from("hifz_progress")
      .select("verse_key, status")
      .eq("user_id", user.id)
      .eq("status", "memorized");
    (prog ?? []).forEach((r: { verse_key: string }) =>
      memorizedKeys.add(r.verse_key)
    );
  } catch {
    /* progress is non-critical for rendering */
  }

  return (
    <div className="wrap">
      <div className={styles.page}>
        <Link href="/hifz" className={styles.back}>
          ← All surahs
        </Link>

        <div className={styles.head}>
          <p className={styles.eyebrow}>Surah {chapterId}</p>
          <h1 className={styles.title}>Memorize</h1>
        </div>

        {chapterId !== 1 && chapterId !== 9 && (
          <p className={styles.bismillah}>
            بِسْمِ ٱللَّهِ ٱلرَّحْمَٰنِ ٱلرَّحِيمِ
          </p>
        )}

        {verses.length === 0 ? (
          <p className={styles.empty}>
            This surah is loading or temporarily unavailable. Please refresh in
            a moment.
          </p>
        ) : (
          <div className={styles.ayahList}>
            {verses.map((v) => (
              <Ayah
                key={v.verse_key}
                verseKey={v.verse_key}
                ayahNumber={v.verse_number}
                arabic={v.text_uthmani ?? ""}
                translation={v.translations?.[0]?.text ?? null}
                audioUrl={audioUrl(v.audio?.url)}
                initialMemorized={memorizedKeys.has(v.verse_key)}
              />
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
