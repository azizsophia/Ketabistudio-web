"use client";

import type { ReactNode, CSSProperties } from "react";
import type { PhotobookTemplate } from "@/lib/photobook";
import KeepsakeFlipbook from "./KeepsakeFlipbook";
import s from "./KeepsakeLivePreview.module.css";

/**
 * LIVE preview of the keepsake, built from the builder's current state — the
 * pages update as the customer types names, edits captions, and uploads photos.
 * It mirrors the print layout (worker/pipeline/photobook_pipeline.py): ivory +
 * espresso + champagne-gold hairlines, Cormorant type, full-bleed heroes
 * (~1-in-3) with a scrim caption, and centred 4:5 gallery pages otherwise. The
 * dua page is the EXACT printed asset (identical for every order).
 *
 * It is a faithful on-screen representation; the physical book is printed from
 * the same layout at 300 DPI.
 */

// Mirrors photobook_pipeline._is_hero (1-indexed photo position).
const isHero = (n: number) => n % 3 === 1;

type Page = { url: string | null; caption: string };

function Frame() {
  return <span className={s.frame} aria-hidden="true" />;
}

function PhotoOrEmpty({ url, className }: { url: string | null; className: string }) {
  if (url) {
    // eslint-disable-next-line @next/next/no-img-element
    return <img src={url} alt="" className={className} />;
  }
  return (
    <span className={`${className} ${s.empty}`}>
      <span className={s.emptyLabel}>Your photo here</span>
    </span>
  );
}

export default function KeepsakeLivePreview({
  template,
  recipient,
  author,
  coverPhotoUrl,
  pages,
}: {
  template: PhotobookTemplate;
  recipient: string;
  author: string;
  coverPhotoUrl: string | null;
  pages: Page[];
}) {
  const who = recipient.trim() || template.recipientLabel.replace(/'s name$/, "");
  const by = author.trim();
  const verb = template.slug === "about-baby" ? "Everything We Love" : "Everything I Love";
  // These keepsakes print their distinctive title on the cover (the name shows
  // inside, on the dedication); the rest personalise the cover with the name.
  const customCover =
    template.slug === "about-spouse" ||
    template.slug === "about-baby" ||
    template.slug === "our-ramadan";

  const cover: ReactNode = (
    <div className={s.pg}>
      <PhotoOrEmpty url={coverPhotoUrl} className={s.heroPhoto} />
      <span className={s.coverOverlay}>
        <span className={s.coverKicker}>A Keepsake</span>
        {customCover ? (
          <span className={s.coverTitle}>{template.title}</span>
        ) : (
          <>
            <span className={s.coverTitle}>{verb}</span>
            <span className={s.coverTitle}>About {who}</span>
          </>
        )}
        <span className={s.coverRule} aria-hidden="true" />
        {by && <span className={s.coverBy}>by {by}</span>}
      </span>
    </div>
  );

  const title: ReactNode = (
    <div className={`${s.pg} ${s.centered}`}>
      <Frame />
      <span className={s.kicker}>A Keepsake</span>
      {customCover ? (
        <span className={s.title}>{template.title}</span>
      ) : (
        <>
          <span className={s.title}>{verb}</span>
          <span className={s.title}>About {who}</span>
        </>
      )}
      <span className={s.rule} aria-hidden="true" />
      {by && <span className={s.byline}>by {by}</span>}
    </div>
  );

  const dedication: ReactNode = (
    <div className={`${s.pg} ${s.centered}`}>
      <span className={s.kickerSm}>For</span>
      <span className={s.dedName}>{who}</span>
      <span className={s.dedLine}>{template.dedication}</span>
      <span className={s.rule} aria-hidden="true" />
      {by && <span className={s.byline}>with all my love, {by}</span>}
    </div>
  );

  const photoPages: ReactNode[] = pages.map((p, idx) => {
    const n = idx + 1;
    if (isHero(n)) {
      return (
        <div className={s.pg} key={n}>
          <PhotoOrEmpty url={p.url} className={s.heroPhoto} />
          {p.caption.trim() && (
            <span className={s.heroCapWrap}>
              <span className={s.heroTick} aria-hidden="true" />
              <span className={s.heroCap}>{p.caption}</span>
            </span>
          )}
        </div>
      );
    }
    return (
      <div className={`${s.pg} ${s.galPage}`} key={n}>
        <PhotoOrEmpty url={p.url} className={s.galPhoto} />
        {p.caption.trim() && <span className={s.galCap}>{p.caption}</span>}
      </div>
    );
  });

  const dua: ReactNode = (
    // eslint-disable-next-line @next/next/no-img-element
    <img src={`/images/keepsake/${template.slug}/page23.jpg`} alt="The dua for parents" />
  );

  const closing: ReactNode = (
    <div className={`${s.pg} ${s.centered}`}>
      <span className={s.madeWith}>Made with love</span>
      {by && <span className={s.byline}>by {by}</span>}
      <span className={s.rule} aria-hidden="true" />
      <span className={s.kicker}>Ketabi Studio</span>
    </div>
  );

  const nodes = [cover, title, dedication, ...photoPages, dua, closing];
  const labels = [
    "Cover",
    "Title",
    "Dedication",
    ...pages.map((_, i) => `Page ${i + 1} of 20`),
    "The dua for parents",
    "Closing",
  ];

  const accentVars = {
    "--kacc": template.accent.main,
    "--kacc-deep": template.accent.deep,
    "--kacc-dark": template.accent.dark,
  } as CSSProperties;

  return (
    <div className={s.frameWrap} style={accentVars}>
      <KeepsakeFlipbook pages={nodes} labels={labels} />
    </div>
  );
}
