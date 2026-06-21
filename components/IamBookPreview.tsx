"use client";

import { useEffect, useState } from "react";
import styles from "./IamBookPreview.module.css";
import { buildPreviewHtml, type PreviewState } from "@/lib/iamPreview";

// the print template is fetched once and reused for every preview open
let _tplCache: string | null = null;

export default function IamBookPreview({
  state, onClose,
}: { state: PreviewState; onClose: () => void }) {
  const [html, setHtml] = useState<string | null>(null);
  const [err, setErr] = useState("");

  useEffect(() => {
    let alive = true;
    (async () => {
      try {
        if (!_tplCache) {
          const r = await fetch("/api/iam/template", { cache: "no-store" });
          if (!r.ok) throw new Error("load failed");
          _tplCache = await r.text();
        }
        if (alive) setHtml(buildPreviewHtml(_tplCache, state));
      } catch {
        if (alive) setErr("Could not load the preview. Please try again.");
      }
    })();
    return () => { alive = false; };
  }, [state]);

  // lock background scroll while the modal is open + close on Escape
  useEffect(() => {
    document.body.style.overflow = "hidden";
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    window.addEventListener("keydown", onKey);
    return () => {
      document.body.style.overflow = "";
      window.removeEventListener("keydown", onKey);
    };
  }, [onClose]);

  return (
    <div className={styles.backdrop} onClick={onClose} role="dialog" aria-modal="true" aria-label="Book preview">
      <div className={styles.panel} onClick={(e) => e.stopPropagation()}>
        <div className={styles.bar}>
          <span className={styles.title}>Your book, exactly as it prints</span>
          <button type="button" className={styles.close} onClick={onClose} aria-label="Close preview">×</button>
        </div>
        {err ? (
          <p className={styles.msg}>{err}</p>
        ) : html ? (
          <iframe className={styles.frame} title="Book preview" srcDoc={html} />
        ) : (
          <p className={styles.msg}>Building your preview…</p>
        )}
        <p className={styles.foot}>Scroll to flip through every page, exactly as it will print.</p>
      </div>
    </div>
  );
}
