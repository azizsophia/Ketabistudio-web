import { redirect } from "next/navigation";
import Link from "next/link";
import { quran } from "@/lib/quran";
import { getUser, getAccess, FREE_SURAHS } from "@/lib/hifz/access";
import { HIFZ_MONTHLY_DISPLAY, HIFZ_ANNUAL_DISPLAY } from "@/lib/pricing";
import UpgradePanel from "./UpgradePanel";
import styles from "./hifz.module.css";

export const dynamic = "force-dynamic";
export const metadata = { title: "Hifz" };

type Chapter = {
  id: number;
  name_simple: string;
  name_arabic: string;
  translated_name?: { name: string };
  verses_count: number;
};

export default async function HifzHome() {
  const user = await getUser();
  if (!user) redirect("/hifz/login");

  const access = await getAccess(user.id);

  const data = (await quran.chapters()) as { chapters?: Chapter[] } | null;
  const chapters = data?.chapters ?? [];

  return (
    <div className="wrap">
      <div className={styles.page}>
        <div className={styles.head}>
          <p className={styles.eyebrow}>Ketabi Hifz</p>
          <h1 className={styles.title}>The Holy Quran</h1>
          <p className={styles.sub}>
            {access.subscribed
              ? "All 114 surahs are open. Choose where to begin."
              : "Start with the free surahs below, or unlock the full Quran."}
          </p>
          <p className={styles.sub} style={{ marginTop: 8 }}>
            <Link href="/hifz/account" className={styles.back} style={{ marginBottom: 0 }}>
              Account & billing
            </Link>
          </p>
        </div>

        {!access.subscribed && (
          <UpgradePanel
            monthly={HIFZ_MONTHLY_DISPLAY}
            annual={HIFZ_ANNUAL_DISPLAY}
          />
        )}

        {chapters.length === 0 ? (
          <p className={styles.empty}>
            The Quran content is loading or temporarily unavailable. Please
            refresh in a moment.
          </p>
        ) : (
          <div className={styles.list}>
            {chapters.map((c) => {
              const unlocked = access.subscribed || FREE_SURAHS.has(c.id);
              const inner = (
                <div
                  className={`${styles.surah} ${
                    unlocked ? "" : styles.surahLocked
                  }`}
                >
                  <span className={styles.num}>{c.id}</span>
                  <div className={styles.surahMeta}>
                    <div className={styles.surahName}>
                      {c.translated_name?.name || c.name_simple}
                    </div>
                    <div className={styles.surahSub}>
                      {c.name_simple} · {c.verses_count} verses
                    </div>
                  </div>
                  <span className={styles.surahArabic}>{c.name_arabic}</span>
                  {!unlocked && <span className={styles.lock}>🔒</span>}
                </div>
              );

              return unlocked ? (
                <Link
                  key={c.id}
                  href={`/hifz/surah/${c.id}`}
                  className={styles.surahLink}
                >
                  {inner}
                </Link>
              ) : (
                <div key={c.id}>{inner}</div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
