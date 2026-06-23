"use client";

import { useEffect, useMemo, useState, type CSSProperties } from "react";
import styles from "./IamBookBuilder.module.css";
import PhotoCropper from "./PhotoCropper";
import IamBookPreview from "./IamBookPreview";
import { type Crop, cropToBackground } from "@/lib/photoCrop";
import { type PreviewState } from "@/lib/iamPreview";
import {
  COLORWAYS, BINDINGS, NAME_MAX, DEDICATION_MAX, PHOTO_SLOTS, TRAITS,
  suggestArabicSmart, hasArabic, bindingCents,
  type Gender, type Colorway, type Binding,
} from "@/lib/iamBook";

// Frame shapes the photos print into, so the on-screen crop matches the page.
const COVER_ASPECT = 1; // full-bleed square cover (photo fills the whole face)
const COVER_MIN_PX = 1500;    // cover photo needs real resolution
const INSIDE_ASPECT = 1;      // full-bleed square page
const INSIDE_MIN_PX = 1400;   // keep an inside crop ≥ ~160 ppi

const COUNTRIES = [
  { code: "US", name: "United States" }, { code: "GB", name: "United Kingdom" },
  { code: "CA", name: "Canada" }, { code: "AU", name: "Australia" },
  { code: "AT", name: "Austria" }, { code: "BH", name: "Bahrain" },
  { code: "BE", name: "Belgium" }, { code: "DK", name: "Denmark" },
  { code: "EG", name: "Egypt" }, { code: "FI", name: "Finland" },
  { code: "FR", name: "France" }, { code: "DE", name: "Germany" },
  { code: "IE", name: "Ireland" }, { code: "IT", name: "Italy" },
  { code: "JO", name: "Jordan" }, { code: "KW", name: "Kuwait" },
  { code: "MY", name: "Malaysia" }, { code: "NL", name: "Netherlands" },
  { code: "NZ", name: "New Zealand" }, { code: "NO", name: "Norway" },
  { code: "OM", name: "Oman" }, { code: "QA", name: "Qatar" },
  { code: "SA", name: "Saudi Arabia" }, { code: "SG", name: "Singapore" },
  { code: "ZA", name: "South Africa" }, { code: "ES", name: "Spain" },
  { code: "SE", name: "Sweden" }, { code: "CH", name: "Switzerland" },
  { code: "TR", name: "Turkey" }, { code: "AE", name: "United Arab Emirates" },
] as const;
const STATE_REQUIRED = new Set(["US", "CA", "AU"]);
const DRAFT_KEY = "iam_draft_v1"; // auto-saved builder progress (this device)

type Photo = { url: string; w: number | null; h: number | null; busy?: boolean };
type Step = "details" | "photos" | "deliver";

const COVER_BG: Record<Colorway, { bg: string; dk: string }> = {
  teal: { bg: "#2f5d57", dk: "#21443f" },
  rose: { bg: "#a8596a", dk: "#7e3f4e" },
};

export default function IamBookBuilder() {
  const [step, setStep] = useState<Step>("details");

  const [name, setName] = useState("");
  const [nameAr, setNameAr] = useState("");
  const [arConfirmed, setArConfirmed] = useState(false);
  const [arRough, setArRough] = useState(false); // suggestion was an approximate transliteration
  const [gender, setGender] = useState<Gender>("boy");
  const [dedication, setDedication] = useState("");
  const [colorway, setColorway] = useState<Colorway>("teal");
  const [binding, setBinding] = useState<Binding>("hardcover");

  const [cover, setCover] = useState<Photo | null>(null);
  const [coverCrop, setCoverCrop] = useState<Crop | null>(null);
  const [photos, setPhotos] = useState<(Photo | null)[]>(
    Array(PHOTO_SLOTS).fill(null)
  );
  const [photoCrops, setPhotoCrops] = useState<(Crop | null)[]>(
    Array(PHOTO_SLOTS).fill(null)
  );

  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");
  const [sName, setSName] = useState("");
  const [line1, setLine1] = useState("");
  const [line2, setLine2] = useState("");
  const [city, setCity] = useState("");
  const [state, setState] = useState("");
  const [postcode, setPostcode] = useState("");
  const [country, setCountry] = useState("US");

  const [error, setError] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [showPreview, setShowPreview] = useState(false);
  const [reuseFor, setReuseFor] = useState<number | null>(null);
  const [hydrated, setHydrated] = useState(false);

  // ── auto-save: restore an in-progress book on this device, and keep it saved
  //    as the customer works, so a refresh or coming back never loses photos ──
  useEffect(() => {
    try {
      const raw = localStorage.getItem(DRAFT_KEY);
      if (raw) {
        const d = JSON.parse(raw);
        if (typeof d.name === "string") setName(d.name);
        if (typeof d.nameAr === "string") setNameAr(d.nameAr);
        if (typeof d.arConfirmed === "boolean") setArConfirmed(d.arConfirmed);
        if (d.gender === "boy" || d.gender === "girl") setGender(d.gender);
        if (typeof d.dedication === "string") setDedication(d.dedication);
        if (d.colorway === "teal" || d.colorway === "rose") setColorway(d.colorway);
        if (d.binding === "hardcover" || d.binding === "paperback") setBinding(d.binding);
        if (d.cover) setCover(d.cover);
        if (d.coverCrop) setCoverCrop(d.coverCrop);
        if (Array.isArray(d.photos) && d.photos.length === PHOTO_SLOTS) setPhotos(d.photos);
        if (Array.isArray(d.photoCrops) && d.photoCrops.length === PHOTO_SLOTS) setPhotoCrops(d.photoCrops);
        if (typeof d.email === "string") setEmail(d.email);
        if (typeof d.phone === "string") setPhone(d.phone);
        if (typeof d.sName === "string") setSName(d.sName);
        if (typeof d.line1 === "string") setLine1(d.line1);
        if (typeof d.line2 === "string") setLine2(d.line2);
        if (typeof d.city === "string") setCity(d.city);
        if (typeof d.state === "string") setState(d.state);
        if (typeof d.postcode === "string") setPostcode(d.postcode);
        if (typeof d.country === "string") setCountry(d.country);
      }
    } catch { /* ignore corrupt drafts */ }
    setHydrated(true);
  }, []);

  useEffect(() => {
    if (!hydrated) return;
    const keep = (p: Photo | null): Photo | null =>
      p && p.url && !p.busy ? { url: p.url, w: p.w, h: p.h } : null;
    try {
      localStorage.setItem(DRAFT_KEY, JSON.stringify({
        name, nameAr, arConfirmed, gender, dedication, colorway, binding,
        cover: keep(cover), coverCrop,
        photos: photos.map(keep), photoCrops,
        email, phone, sName, line1, line2, city, state, postcode, country,
      }));
    } catch { /* storage full / unavailable — non-fatal */ }
  }, [hydrated, name, nameAr, arConfirmed, gender, dedication, colorway, binding,
      cover, coverCrop, photos, photoCrops, email, phone, sName, line1, line2,
      city, state, postcode, country]);

  const priceCents = useMemo(() => bindingCents(binding), [binding]);

  // distinct photos already added (cover + inside), offered for reuse so a
  // parent who wants the same photo on more than one page needn't re-upload.
  const usedPhotos = useMemo(() => {
    const seen = new Set<string>();
    const out: Photo[] = [];
    for (const p of [cover, ...photos]) {
      if (p?.url && !p.busy && !seen.has(p.url)) { seen.add(p.url); out.push(p); }
    }
    return out;
  }, [cover, photos]);

  function assignReuse(src: Photo) {
    if (reuseFor === null) return;
    const i = reuseFor;
    setPhotos((arr) => arr.map((x, j) => (j === i ? { url: src.url, w: src.w, h: src.h } : x)));
    setPhotoCrops((arr) => arr.map((x, j) => (j === i ? null : x)));
    setReuseFor(null);
  }

  const previewState: PreviewState = {
    name, nameAr, gender, dedication, colorway,
    cover: cover?.url ? { url: cover.url, crop: coverCrop } : null,
    photos: photos.map((p, i) => (p?.url ? { url: p.url, crop: photoCrops[i] } : null)),
  };

  async function upload(file: File): Promise<Photo> {
    const fd = new FormData();
    fd.append("file", file);
    const r = await fetch("/api/photobook/photo", { method: "POST", body: fd });
    const d = await r.json();
    if (!r.ok || !d.url) throw new Error(d.error || "Upload failed");
    return { url: d.url, w: d.width ?? null, h: d.height ?? null };
  }

  async function onCover(file: File) {
    setError("");
    setCoverCrop(null); // new photo → re-centre the crop
    setCover({ url: "", w: null, h: null, busy: true });
    try { setCover(await upload(file)); }
    catch (e) { setCover(null); setError((e as Error).message); }
  }
  async function onPhoto(i: number, file: File) {
    setError("");
    setPhotoCrops((c) => c.map((x, j) => (j === i ? null : x)));
    setPhotos((p) => p.map((x, j) => (j === i ? { url: "", w: null, h: null, busy: true } : x)));
    try {
      const ph = await upload(file);
      setPhotos((p) => p.map((x, j) => (j === i ? ph : x)));
    } catch (e) {
      setPhotos((p) => p.map((x, j) => (j === i ? null : x)));
      setError((e as Error).message);
    }
  }

  // A photo is too small only if its native short edge is under the floor for
  // the frame it goes in (so even un-zoomed it can't print sharply).
  const tooSmall = (p: Photo | null, floor: number) =>
    !!p && !p.busy && p.w !== null && Math.min(p.w, p.h || 0) < floor;
  const anyLowRes =
    tooSmall(cover, COVER_MIN_PX) || photos.some((p) => tooSmall(p, INSIDE_MIN_PX));

  function goPhotos() {
    setError("");
    if (!name.trim()) return setError("Please enter your child's name.");
    if (!nameAr.trim() || !hasArabic(nameAr))
      return setError("Please enter the child's name in Arabic.");
    if (!arConfirmed)
      return setError("Please confirm the Arabic spelling is correct.");
    if (dedication.length > DEDICATION_MAX)
      return setError(`Dedication must be ${DEDICATION_MAX} characters or fewer.`);
    setStep("photos");
  }
  function goDeliver() {
    setError("");
    if (cover?.busy || photos.some((p) => p?.busy))
      return setError("Please wait for your photos to finish uploading.");
    if (!cover?.url) return setError("Please add a cover photo.");
    if (photos.some((p) => !p?.url))
      return setError("Please add all twelve inside photos, one for each trait.");
    if (anyLowRes) return setError("Some photos are low resolution and will print blurry. Please replace them.");
    setStep("deliver");
  }

  async function placeOrder() {
    setError("");
    if (!email.trim() || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim()))
      return setError("Please enter a valid email address.");
    if (!sName.trim() || !line1.trim() || !city.trim() || !postcode.trim())
      return setError("Please complete the delivery address.");
    if (STATE_REQUIRED.has(country) && !state.trim())
      return setError("Please enter the state or province.");
    if (phone.replace(/[^\d]/g, "").length < 7)
      return setError("Please enter a valid phone number for delivery.");
    setSubmitting(true);
    try {
      const r = await fetch("/api/iam/order", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: name.trim(), name_arabic: nameAr.trim(), gender,
          dedication: dedication.trim(), colorway, binding,
          cover_photo_url: cover?.url || null,
          cover_crop: cover?.url ? coverCrop : null,
          photos: photos.map((p, i) =>
            p?.url ? { url: p.url, crop: photoCrops[i] || null } : null
          ),
          email: email.trim(),
          shipping: {
            name: sName.trim(), line1: line1.trim(), line2: line2.trim(),
            city: city.trim(), state: state.trim(), postcode: postcode.trim(),
            country_code: country, phone: phone.trim(),
          },
        }),
      });
      const d = await r.json();
      if (r.ok && d.ok && d.orderId) {
        const c = await fetch("/api/checkout", {
          method: "POST", headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ orderId: d.orderId }),
        });
        const cd = await c.json();
        if (c.ok && cd.url) {
          try { localStorage.removeItem(DRAFT_KEY); } catch { /* non-fatal */ }
          window.location.href = cd.url;
          return;
        }
        setError(cd.error || "Could not start checkout.");
      } else setError(d.error || "Something went wrong. Please try again.");
    } catch { setError("Network error. Please try again."); }
    finally { setSubmitting(false); }
  }

  const Preview = (
    <div className={styles.previewPane}>
      <p className={styles.previewLabel}>Front cover</p>
      <div className={styles.cover}>
        <span className={styles.coverPhotoArea}>
          {cover?.url ? (
            <span
              className={styles.coverPhoto}
              style={{
                backgroundImage: `url("${cover.url}")`,
                backgroundRepeat: "no-repeat",
                backgroundSize: coverCrop ? cropToBackground(coverCrop).size : "cover",
                backgroundPosition: coverCrop ? cropToBackground(coverCrop).position : "50% 42%",
              }}
            />
          ) : (
            <span className={`${styles.coverPhoto} ${styles.coverEmpty}`}>Your photo</span>
          )}
        </span>
        <span className={styles.cScrim} />
        <span className={styles.cKeyline} />
        <span className={styles.coverPlate}>
          <svg className={styles.cStar} viewBox="0 0 100 100" aria-hidden="true">
            <polygon points="50,4 58,42 96,50 58,58 50,96 42,58 4,50 42,42" fill="currentColor" />
          </svg>
          <span className={styles.cIam}>I am</span>
          <span className={styles.cName}>{name.trim() || "Your child"}</span>
          <span className={styles.cRule} />
          <span className={styles.cNameAr} dir="rtl" lang="ar">{nameAr.trim()}</span>
        </span>
      </div>
      <p className={styles.previewNote}>
        Inside: twelve “I am” affirmations in English and Arabic, plus a dua, each
        with your own photo of your child.
      </p>
    </div>
  );

  /* ── step: details ── */
  if (step === "details") {
    return (
      <section className={styles.section}>
        <div className={styles.grid}>
          {Preview}
          <div className={styles.form}>
            <p className={styles.stepLabel}>Step 1 of 3</p>
            <h1 className={styles.heading}>Make their book</h1>
            <p className={styles.sub}>
              A keepsake where your child is the hero of every page, twelve
              beautiful traits, in English and Arabic.
            </p>

            <label className={styles.label} htmlFor="nm">Child&apos;s name</label>
            <input id="nm" className={styles.input} maxLength={NAME_MAX}
              value={name} placeholder="e.g. Yusuf"
              onChange={(e) => {
                setName(e.target.value);
                // auto-fill only on a confident (curated) match while the field is empty
                if (!nameAr) {
                  const r = suggestArabicSmart(e.target.value);
                  if (r.exact) { setNameAr(r.arabic); setArConfirmed(false); setArRough(false); }
                }
              }} />

            <label className={styles.label} htmlFor="nmar">Name in Arabic</label>
            <div className={styles.arRow}>
              <input id="nmar" className={`${styles.input} ${styles.arInput}`} dir="rtl" lang="ar"
                value={nameAr} placeholder="الاسم بالعربية"
                onChange={(e) => { setNameAr(e.target.value); setArConfirmed(false); setArRough(false); }} />
              <button type="button" className={styles.suggest}
                onClick={() => {
                  if (!name.trim()) { setError("Please enter your child's name first."); return; }
                  const r = suggestArabicSmart(name);
                  if (r.arabic) { setNameAr(r.arabic); setArConfirmed(false); setArRough(!r.exact); }
                  else setError("Please type your child's name in Arabic.");
                }}>
                Suggest
              </button>
            </div>
            {arRough && (
              <p className={styles.arHint}>
                This is an approximate spelling. Please check it carefully and
                edit if needed, we print exactly what you confirm.
              </p>
            )}
            <label className={styles.check}>
              <input type="checkbox" checked={arConfirmed} onChange={(e) => setArConfirmed(e.target.checked)} />
              I confirm the Arabic spelling is correct.
            </label>

            <span className={styles.label}>Gender (sets he/she in the text)</span>
            <div className={styles.pills}>
              {(["boy", "girl"] as Gender[]).map((g) => (
                <button key={g} type="button"
                  className={`${styles.pill} ${gender === g ? styles.pillOn : ""}`}
                  onClick={() => setGender(g)}>{g === "boy" ? "Boy" : "Girl"}</button>
              ))}
            </div>

            <span className={styles.label}>Cover colour</span>
            <div className={styles.swatchRow}>
              {COLORWAYS.map((c) => (
                <button key={c.id} type="button" title={c.name} aria-label={c.name}
                  className={`${styles.swatch} ${colorway === c.id ? styles.swatchOn : ""}`}
                  style={{ background: c.hex }} onClick={() => setColorway(c.id)} />
              ))}
            </div>

            <span className={styles.label}>Binding</span>
            <div className={styles.pills}>
              {BINDINGS.map((b) => (
                <button key={b.id} type="button"
                  className={`${styles.pill} ${binding === b.id ? styles.pillOn : ""}`}
                  onClick={() => setBinding(b.id)}>
                  {b.name} · {b.display}
                </button>
              ))}
            </div>

            <label className={styles.label} htmlFor="ded">Dedication (optional)</label>
            <textarea id="ded" className={styles.textarea} rows={3} maxLength={DEDICATION_MAX}
              placeholder="A short message, e.g. To Yusuf, with all our love, Mama and Baba."
              value={dedication} onChange={(e) => setDedication(e.target.value)} />
            <span className={styles.count}>{dedication.length}/{DEDICATION_MAX}</span>

            {error && <p className={styles.error}>{error}</p>}
            <div className={styles.btnRow}>
              <button className={`btn btn-primary ${styles.next}`} onClick={goPhotos}>
                Continue to photos
              </button>
            </div>
          </div>
        </div>
      </section>
    );
  }

  /* ── step: photos ── */
  if (step === "photos") {
    return (
      <section className={styles.section}>
        <div className={styles.grid}>
          {Preview}
          <div className={styles.form}>
            <p className={styles.stepLabel}>Step 2 of 3</p>
            <h1 className={styles.heading}>Add your photos</h1>
            <p className={styles.sub}>
              A cover photo plus one for each of the twelve traits, so your child
              is on every page. Drag to position and zoom each one.
            </p>

            <span className={styles.label}>Cover photo</span>
            <PhotoSlot
              photo={cover} crop={coverCrop} big
              frameAspect={COVER_ASPECT} minShortPx={COVER_MIN_PX}
              onPick={onCover}
              onCrop={setCoverCrop}
              onClear={() => { setCover(null); setCoverCrop(null); }}
            />

            <span className={styles.label}>Inside photos</span>
            <div className={styles.photoGrid}>
              {photos.map((p, i) => (
                <PhotoSlot key={i} photo={p} crop={photoCrops[i]} label={TRAITS[i]?.trait}
                  frameAspect={INSIDE_ASPECT} minShortPx={INSIDE_MIN_PX}
                  canReuse={usedPhotos.length > 0}
                  onReuseRequest={() => setReuseFor(i)}
                  onPick={(f) => onPhoto(i, f)}
                  onCrop={(c) => setPhotoCrops((arr) => arr.map((x, j) => (j === i ? c : x)))}
                  onClear={() => {
                    setPhotos((arr) => arr.map((x, j) => (j === i ? null : x)));
                    setPhotoCrops((arr) => arr.map((x, j) => (j === i ? null : x)));
                  }} />
              ))}
            </div>

            <p className={styles.note}>
              Drag any photo to position it, and pinch or use the slider to zoom.
              You can reuse the same photo on more than one page. Use clear photos
              for the sharpest print, the zoom is limited so nothing prints blurry.
            </p>

            <button type="button" className={`btn btn-outline ${styles.previewBtn}`} onClick={() => setShowPreview(true)}>
              Preview the whole book
            </button>

            {error && <p className={styles.error}>{error}</p>}
            <div className={styles.btnRow}>
              <button className="btn btn-outline" onClick={() => setStep("details")}>← Details</button>
              <button className={`btn btn-primary ${styles.next}`} onClick={goDeliver}>
                Continue to delivery
              </button>
            </div>
          </div>
        </div>
        {showPreview && <IamBookPreview state={previewState} onClose={() => setShowPreview(false)} />}
        {reuseFor !== null && (
          <ReusePicker photos={usedPhotos} onPick={assignReuse} onClose={() => setReuseFor(null)} />
        )}
      </section>
    );
  }

  /* ── step: deliver ── */
  return (
    <section className={styles.section}>
      <div className={styles.inner}>
        <p className={styles.stepLabel}>Step 3 of 3</p>
        <h1 className={styles.heading}>Where should we send it?</h1>
        <p className={styles.sub}>Printed to order and shipped worldwide.</p>

        <div className={styles.formGrid}>
          <div className={styles.full}>
            <label className={styles.label} htmlFor="em">Your email (for the receipt)</label>
            <input id="em" className={styles.input} type="email" autoComplete="email"
              placeholder="you@example.com" value={email} onChange={(e) => setEmail(e.target.value)} />
          </div>
          <div className={styles.full}>
            <label className={styles.label} htmlFor="ph">Phone (for the courier)</label>
            <input id="ph" className={styles.input} type="tel" autoComplete="tel"
              placeholder="For delivery updates" value={phone} onChange={(e) => setPhone(e.target.value)} />
          </div>
          <div className={styles.full}>
            <label className={styles.label} htmlFor="co">Country</label>
            <select id="co" className={styles.input} value={country} onChange={(e) => setCountry(e.target.value)}>
              {COUNTRIES.map((c) => <option key={c.code} value={c.code}>{c.name}</option>)}
            </select>
          </div>
          <div className={styles.full}>
            <label className={styles.label} htmlFor="rn">Recipient&apos;s name</label>
            <input id="rn" className={styles.input} autoComplete="name"
              value={sName} onChange={(e) => setSName(e.target.value)} />
          </div>
          <div className={styles.full}>
            <label className={styles.label} htmlFor="l1">Address line 1</label>
            <input id="l1" className={styles.input} autoComplete="address-line1"
              value={line1} onChange={(e) => setLine1(e.target.value)} />
          </div>
          <div className={styles.full}>
            <label className={styles.label} htmlFor="l2">Address line 2 (optional)</label>
            <input id="l2" className={styles.input} autoComplete="address-line2"
              value={line2} onChange={(e) => setLine2(e.target.value)} />
          </div>
          <div><label className={styles.label} htmlFor="ci">City</label>
            <input id="ci" className={styles.input} value={city} onChange={(e) => setCity(e.target.value)} /></div>
          <div><label className={styles.label} htmlFor="st">State / Region</label>
            <input id="st" className={styles.input} value={state} onChange={(e) => setState(e.target.value)} /></div>
          <div><label className={styles.label} htmlFor="zp">Postcode</label>
            <input id="zp" className={styles.input} value={postcode} onChange={(e) => setPostcode(e.target.value)} /></div>
        </div>

        <div className={styles.summary}>
          <div className={styles.sumRow}>
            <span>“I am {name.trim() || "…"}” · {binding === "hardcover" ? "Hardcover" : "Paperback"}</span>
            <span>${(priceCents / 100).toFixed(2)}</span>
          </div>
          <p className={styles.note}>Printed to order. Shipping calculated at checkout.</p>
        </div>

        <button type="button" className={`btn btn-outline ${styles.previewBtn}`} onClick={() => setShowPreview(true)}>
          Preview the whole book before you pay
        </button>

        {error && <p className={styles.error}>{error}</p>}
        <div className={styles.btnRow}>
          <button className="btn btn-outline" onClick={() => setStep("photos")}>← Photos</button>
          <button className={`btn btn-primary ${styles.next}`} onClick={placeOrder} disabled={submitting}>
            {submitting ? "Starting checkout…" : "Continue to payment"}
          </button>
        </div>
      </div>
      {showPreview && <IamBookPreview state={previewState} onClose={() => setShowPreview(false)} />}
    </section>
  );
}

function PhotoSlot({
  photo, crop, onPick, onCrop, onClear, label, big, frameAspect, minShortPx, rounded,
  captionAr, captionTr, canReuse, onReuseRequest,
}: {
  photo: Photo | null;
  crop: Crop | null;
  onPick: (f: File) => void;
  onCrop: (c: Crop) => void;
  onClear: () => void;
  label?: string;
  big?: boolean;
  frameAspect: number;
  minShortPx: number;
  rounded?: string;
  captionAr?: string;
  captionTr?: string;
  canReuse?: boolean;
  onReuseRequest?: () => void;
}) {
  if (photo?.busy) {
    return <div className={`${styles.tile} ${big ? styles.tileBig : ""}`}><span className={styles.tileMsg}>Uploading…</span></div>;
  }
  if (photo?.url) {
    return (
      <div className={big ? styles.coverSlot : undefined}>
        <PhotoCropper
          src={photo.url}
          frameAspect={frameAspect}
          minShortPx={minShortPx}
          rounded={rounded}
          value={crop}
          onChange={onCrop}
          onClear={onClear}
          captionAr={captionAr}
          captionTr={captionTr}
          showGradient={false}
          showSafe={!big}
          noZoom={big}
        />
        <label className={styles.replaceBtn}>
          Replace photo
          <input type="file" accept="image/*" hidden
            onChange={(e) => e.target.files?.[0] && onPick(e.target.files[0])} />
        </label>
      </div>
    );
  }
  return (
    <div className={`${styles.tile} ${styles.emptyTile} ${big ? styles.tileBig : ""}`}>
      <label className={styles.tileAdd}>
        <input type="file" accept="image/*" hidden
          onChange={(e) => e.target.files?.[0] && onPick(e.target.files[0])} />
        <span>{label || "Add"}</span>
      </label>
      {canReuse && onReuseRequest && (
        <button type="button" className={styles.reuseLink} onClick={onReuseRequest}>
          or reuse a photo
        </button>
      )}
    </div>
  );
}

function ReusePicker({ photos, onPick, onClose }: {
  photos: Photo[]; onPick: (p: Photo) => void; onClose: () => void;
}) {
  return (
    <div className={styles.reuseBackdrop} onClick={onClose} role="dialog" aria-modal="true">
      <div className={styles.reusePanel} onClick={(e) => e.stopPropagation()}>
        <p className={styles.reuseTitle}>Reuse one of your photos</p>
        <div className={styles.reuseGrid}>
          {photos.map((p, idx) => (
            <button key={idx} type="button" className={styles.reuseThumb} onClick={() => onPick(p)}>
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={p.url} alt="" />
            </button>
          ))}
        </div>
        <button type="button" className="btn btn-outline" onClick={onClose}>Cancel</button>
      </div>
    </div>
  );
}
