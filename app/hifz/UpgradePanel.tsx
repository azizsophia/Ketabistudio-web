"use client";

import { useState } from "react";
import styles from "./hifz.module.css";

export default function UpgradePanel({
  monthly,
  annual,
}: {
  monthly: string;
  annual: string;
}) {
  const [loading, setLoading] = useState<"monthly" | "annual" | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function start(plan: "monthly" | "annual") {
    setError(null);
    setLoading(plan);
    try {
      const res = await fetch("/api/hifz/checkout", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ plan }),
      });
      const data = await res.json();
      if (data?.url) {
        window.location.href = data.url;
        return;
      }
      setError(data?.error || "Could not start checkout.");
    } catch {
      setError("Could not start checkout.");
    } finally {
      setLoading(null);
    }
  }

  return (
    <div className={styles.upgrade}>
      <h2 className={styles.upgradeTitle}>Unlock all 114 surahs</h2>
      <p className={styles.upgradeBody}>
        Memorize the whole Quran with translation, recitation, and your own
        progress saved across devices.
      </p>
      <div className={styles.upgradeBtns}>
        <button
          className="btn btn-gold"
          onClick={() => start("monthly")}
          disabled={loading !== null}
        >
          {loading === "monthly" ? "…" : `${monthly} / month`}
        </button>
        <button
          className="btn btn-outline"
          style={{ color: "var(--cream)", boxShadow: "inset 0 0 0 2px var(--cream)" }}
          onClick={() => start("annual")}
          disabled={loading !== null}
        >
          {loading === "annual" ? "…" : `${annual} / year`}
        </button>
      </div>
      {error && (
        <p className={styles.error} style={{ color: "var(--gold)" }}>
          {error}
        </p>
      )}
    </div>
  );
}
