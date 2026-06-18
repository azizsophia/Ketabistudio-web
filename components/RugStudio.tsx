"use client";

import { useState } from "react";
import HopscotchRug, { RUG_COLORWAYS, type RugColorway } from "./HopscotchRug";
import styles from "./RugStudio.module.css";

export default function RugStudio() {
  const [name, setName] = useState("Muadh");
  const [ar, setAr] = useState("مُعاذ");
  const [way, setWay] = useState<RugColorway>("Meadow");

  return (
    <section className={styles.wrap}>
      <div className={styles.rugCol}>
        <div className={styles.rugFrame}>
          <HopscotchRug
            childName={name}
            childNameArabic={ar}
            colorway={way}
            style={{ width: "100%" }}
          />
        </div>
      </div>

      <div className={styles.controls}>
        <p className={styles.kicker}>A Ketabi keepsake rug</p>
        <h1 className={styles.h1}>The Hopscotch Rug</h1>
        <p className={styles.sub}>
          A soft play rug for little ones, with the crescent moon, clouds, and
          the numbers ١ to ١٠ to hop along. Personalized with your child&apos;s
          name.
        </p>

        <label className={styles.label} htmlFor="rname">Child&apos;s name</label>
        <input
          id="rname"
          className={styles.input}
          value={name}
          maxLength={20}
          onChange={(e) => setName(e.target.value)}
        />

        <label className={styles.label} htmlFor="rnameAr">
          Name in Arabic
        </label>
        <input
          id="rnameAr"
          className={styles.input}
          value={ar}
          maxLength={20}
          dir="rtl"
          onChange={(e) => setAr(e.target.value)}
        />

        <p className={styles.label}>Colorway</p>
        <div className={styles.ways}>
          {(Object.keys(RUG_COLORWAYS) as RugColorway[]).map((k) => (
            <button
              key={k}
              type="button"
              className={`${styles.way} ${way === k ? styles.wayOn : ""}`}
              onClick={() => setWay(k)}
            >
              <span
                className={styles.swatch}
                style={{ background: RUG_COLORWAYS[k].ground }}
                aria-hidden="true"
              />
              {k}
            </button>
          ))}
        </div>
      </div>
    </section>
  );
}
