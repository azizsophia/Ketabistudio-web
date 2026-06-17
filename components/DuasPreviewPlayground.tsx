"use client";

import { useState } from "react";
import DuasPreview from "./DuasPreview";
import styles from "./OrderSection.module.css";

// A preview-only personalizer for the (not-yet-orderable) Duas book: lets people
// type a name + choose the child/look and see the dynamic flip-through preview,
// WITHOUT any checkout. Reuses the order form's styles for visual consistency.

const MAX_NAME = 14;
const DUAS_CHARACTERS = [
  { key: "girl", label: "Girl" },
  { key: "boy", label: "Boy" },
] as const;
const DUAS_LOOKS = [
  { key: "afro", label: "Deep skin, curly hair" },
  { key: "indian", label: "Medium skin, straight hair" },
  { key: "white", label: "Light skin, blonde hair" },
] as const;

export default function DuasPreviewPlayground() {
  const [name, setName] = useState("");
  const [character, setCharacter] = useState<string>("girl");
  const [wearsHijab, setWearsHijab] = useState<boolean>(true);
  const [look, setLook] = useState<string>("indian");
  const effectiveChar =
    character === "boy" ? "boy" : wearsHijab ? "hijab" : "girl";

  return (
    <div className={styles.playground}>
      <div>
        <p className={styles.label}>Their name</p>
        <input
          className={styles.field}
          type="text"
          placeholder="Type their name"
          maxLength={MAX_NAME}
          value={name}
          onChange={(e) => setName(e.target.value)}
          autoComplete="off"
        />

        <p className={styles.label} id="pg-char">Your child</p>
        <div className={styles.stylePills} role="group" aria-labelledby="pg-char">
          {DUAS_CHARACTERS.map((ch) => (
            <button
              key={ch.key}
              type="button"
              className={`${styles.pill} ${character === ch.key ? styles.pillActive : ""}`}
              aria-pressed={character === ch.key}
              onClick={() => setCharacter(ch.key)}
            >
              {ch.label}
            </button>
          ))}
        </div>

        {character === "girl" && (
          <>
            <p className={styles.label} id="pg-hijab">Hijab</p>
            <div className={styles.stylePills} role="group" aria-labelledby="pg-hijab">
              <button
                type="button"
                className={`${styles.pill} ${wearsHijab ? styles.pillActive : ""}`}
                aria-pressed={wearsHijab}
                onClick={() => setWearsHijab(true)}
              >
                With hijab
              </button>
              <button
                type="button"
                className={`${styles.pill} ${!wearsHijab ? styles.pillActive : ""}`}
                aria-pressed={!wearsHijab}
                onClick={() => setWearsHijab(false)}
              >
                Without hijab
              </button>
            </div>
          </>
        )}

        <p className={styles.label} id="pg-look">Their look</p>
        <div className={styles.lookGrid} role="group" aria-labelledby="pg-look">
          {DUAS_LOOKS.map((lk) => (
            <button
              key={lk.key}
              type="button"
              className={`${styles.lookOption} ${look === lk.key ? styles.lookActive : ""}`}
              aria-label={lk.label}
              aria-pressed={look === lk.key}
              onClick={() => setLook(lk.key)}
            >
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={`/images/duas/${effectiveChar}-${lk.key}.jpg`} alt={lk.label} />
            </button>
          ))}
        </div>
      </div>

      <div className={styles.previewCol}>
        <DuasPreview name={name} character={effectiveChar} look={look} />
        <p className={styles.previewHint}>
          A glimpse of the personalized preview. Orders open soon, Inshallah.
        </p>
      </div>
    </div>
  );
}
