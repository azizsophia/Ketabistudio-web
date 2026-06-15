"use client";

import { useState, useRef, useCallback } from "react";
import styles from "./CardMaker.module.css";
import CardFace from "./CardFace";
import {
  CardItem,
  Collection,
  CollectionId,
  COLLECTIONS,
  findCard,
  findCollection,
  findPaper,
  frontSlots,
  isArabic,
  OCCASIONS,
  PAPERS,
  RELATIONSHIPS,
  STEP_NAMES,
  STEP_ORDER,
  StepId,
  SWATCHES,
} from "@/lib/cards";

// The card maker stepper. Single component holding all state, ported from the
// prototype's `Component extends DCLogic` state object. Mobile-first: on small
// screens the live preview sits ABOVE the controls, shows one face at a time
// via Front/Inside tabs, and the controls are grouped into collapsible
// accordion sections. On wide screens preview + controls sit side by side and
// the sections render expanded.

const SAMPLE_EID = {
  eyebrow: "Eid Mubarak",
  bigText: "عيد مبارك",
  bigArabic: true,
  translit: "",
  line2: "",
  line2Arabic: false,
  foot: "",
};
const SAMPLE_COLOR: Record<CollectionId, string> = {
  arch: "#b35c3c",
  field: "#1f6b5a",
  wash: "#a85c63",
  statement: "#1f3a54",
  textile: "#1f4f54",
  image: "#a87a3c",
};

type AccordionKey = "wording" | "colour" | "message";

export default function CardMaker() {
  const [step, setStep] = useState<StepId>("styles");
  const [styleId, setStyleId] = useState<CollectionId>("arch");
  const [itemId, setItemId] = useState<string>("eid");
  const [recipient, setRecipient] = useState("Fatima");
  const [sender, setSender] = useState("The Rahman Family");
  const [message, setMessage] = useState(
    "Wishing you and your family a joyful and blessed Eid. May your home be filled with light, laughter and barakah.",
  );
  const [accent, setAccent] = useState("#b35c3c");
  const [arabicIndex, setArabicIndex] = useState(0);
  const [arabicOff, setArabicOff] = useState(false);
  const [showName, setShowName] = useState(false);
  const [customFront, setCustomFront] = useState("");
  const [arabicOk, setArabicOk] = useState(false);
  const [paper, setPaper] = useState("mohawk");
  const [shipName, setShipName] = useState("Fatima Rahman");
  const [shipLine, setShipLine] = useState("14 Marlborough Road");
  const [shipCity, setShipCity] = useState("London");
  const [shipPost, setShipPost] = useState("N19 4QT");
  const [shipCountry, setShipCountry] = useState("United Kingdom");

  // preview + accordion UI state (not part of the card data)
  const [photoUrl, setPhotoUrl] = useState<string | null>(null);
  const [photoLowRes, setPhotoLowRes] = useState(false);
  const photoInputRef = useRef<HTMLInputElement>(null);
  const pickPhoto = useCallback((file: File) => {
    if (!file || !file.type.startsWith("image/")) return;
    const u = URL.createObjectURL(file);
    const probe = new window.Image();
    probe.onload = () =>
      setPhotoLowRes(Math.min(probe.naturalWidth, probe.naturalHeight) < 1500);
    probe.src = u;
    setPhotoUrl(u);
  }, []);

  const [faceTab, setFaceTab] = useState<"front" | "inside">("front");
  const [openSection, setOpenSection] = useState<AccordionKey | null>(
    "wording",
  );

  const item: CardItem = findCard(itemId);
  const paperObj = findPaper(paper);
  const collectionName = findCollection(styleId).name;

  // ---- front slots derived from choices ----
  const slots = frontSlots(item, {
    showName,
    recipient: recipient || "you",
    arabicIndex,
    arabicOff,
  });
  const custom = customFront.trim();
  if (custom) {
    slots.bigText = custom;
    slots.bigArabic = isArabic(custom);
    slots.translit = "";
  }

  const needsArabicConfirm = !!custom && isArabic(custom);
  const continueBlocked = needsArabicConfirm && !arabicOk;

  // ---- pick a card (seeds accent + default message) ----
  function pickItem(it: CardItem) {
    setItemId(it.id);
    setAccent(it.color);
    setCustomFront("");
    setArabicOk(false);
    setArabicIndex(0);
    setArabicOff(it.group === "occasion" && it.words.length === 0);
    setMessage(it.msg);
    setStep("maker");
    setFaceTab("front");
    setOpenSection("wording");
  }

  function insertDua() {
    const m = message.trim();
    setMessage(m + (m ? "\n\n" : "") + item.dua);
  }

  function toggleSection(key: AccordionKey) {
    setOpenSection((cur) => (cur === key ? null : key));
  }

  const showWordPicker = item.group === "occasion" && item.words.length > 0;

  // ---- step progress bar ----
  const cur = STEP_ORDER.indexOf(step);
  const stepBar = STEP_ORDER.map((id, i) => {
    const done = i < cur;
    const active = i === cur;
    return {
      id,
      n: i + 1,
      name: STEP_NAMES[id as StepId],
      active,
      fg: active || done ? "#f4f0e7" : "#9a8f7c",
      bg: active ? "#262320" : done ? "#a07f4a" : "transparent",
      bd: active || done ? "transparent" : "#c3b69c",
      label: active ? "#262320" : "#9a8f7c",
    };
  });

  return (
    <div className={styles.root}>
      {/* brand + steps */}
      <div className={styles.brandbar}>
        <div className={styles.brand}>Ketabi</div>
        <div className={styles.steps}>
          {stepBar.map((s) => (
            <div
              key={s.id}
              className={`${styles.step} ${s.active ? styles.stepActive : ""}`}
            >
              <span
                className={styles.stepDot}
                style={{ color: s.fg, background: s.bg, border: `1px solid ${s.bd}` }}
              >
                {s.n}
              </span>
              <span className={styles.stepName} style={{ color: s.label }}>
                {s.name}
              </span>
            </div>
          ))}
        </div>
        <div className={styles.brandTail}>Card studio</div>
      </div>

      {/* ============ STEP: COLLECTION ============ */}
      {step === "styles" && (
        <div className={styles.wrap}>
          <div className={styles.center}>
            <div className={styles.eyebrow}>The collections</div>
            <h1 className={styles.h1}>Choose a collection</h1>
            <p className={styles.lede}>
              Six luxury looks. Pick the visual world; every card comes in each.
            </p>
          </div>
          <div className={styles.collGrid}>
            {COLLECTIONS.map((c: Collection) => (
              <button
                key={c.id}
                className={styles.collCard}
                onClick={() => {
                  setStyleId(c.id);
                  setStep("gallery");
                }}
              >
                <span className={styles.tray}>
                  <CardFace
                    styleId={c.id}
                    accent={SAMPLE_COLOR[c.id]}
                    px={168}
                    face="front"
                    slots={SAMPLE_EID}
                  />
                </span>
                <span className={styles.collName} style={{ display: "block" }}>
                  {c.name}
                </span>
                <span className={styles.collTag} style={{ display: "block", margin: "4px auto 0" }}>
                  {c.tag}
                </span>
              </button>
            ))}
          </div>
        </div>
      )}

      {/* ============ STEP: CARD (gallery) ============ */}
      {step === "gallery" && (
        <div className={styles.wrap}>
          <div className={styles.center}>
            <button className={styles.backlink} onClick={() => setStep("styles")}>
              &larr; Collections
            </button>
            <div className={styles.eyebrow}>{collectionName} collection</div>
            <h1 className={styles.h1}>Choose your card</h1>
            <p className={styles.lede}>
              Every card is yours to personalise inside.
            </p>
          </div>

          <div className={styles.sectionLabel}>
            <span>Occasions</span>
            <span className={styles.sectionRule} />
          </div>
          <div className={styles.cardGrid}>
            {OCCASIONS.map((it) => (
              <button key={it.id} className={styles.galCard} onClick={() => pickItem(it)}>
                <span className={styles.trayS}>
                  <CardFace
                    styleId={styleId}
                    accent={it.color}
                    px={150}
                    face="front"
                    slots={frontSlots(it, { showName: false, arabicIndex: 0, arabicOff: false })}
                  />
                </span>
                <span className={styles.galTitle} style={{ display: "block" }}>
                  {it.title}
                </span>
              </button>
            ))}
          </div>

          <div className={styles.sectionLabel}>
            <span>For your loved ones</span>
            <span className={styles.sectionRule} />
          </div>
          <div className={styles.cardGrid} style={{ marginBottom: 0 }}>
            {RELATIONSHIPS.map((it) => (
              <button key={it.id} className={styles.galCard} onClick={() => pickItem(it)}>
                <span className={styles.trayS}>
                  <CardFace
                    styleId={styleId}
                    accent={it.color}
                    px={150}
                    face="front"
                    slots={frontSlots(it, { showName: false, arabicIndex: 0, arabicOff: false })}
                  />
                </span>
                <span className={styles.galTitle} style={{ display: "block" }}>
                  {it.title}
                </span>
              </button>
            ))}
          </div>
        </div>
      )}

      {/* ============ STEP: PERSONALISE (maker) ============ */}
      {step === "maker" && (
        <div className={styles.wrap}>
          <div className={styles.makerGrid}>
            {/* PREVIEW (above controls on mobile) */}
            <div className={styles.preview}>
              <div className={styles.previewLabel}>Live preview</div>
              <div className={styles.pills}>
                {COLLECTIONS.map((s) => {
                  const sel = styleId === s.id;
                  return (
                    <button
                      key={s.id}
                      className={styles.pill}
                      onClick={() => setStyleId(s.id)}
                      style={{
                        background: sel ? "#262320" : "#f4f0e7",
                        color: sel ? "#f4f0e7" : "#262320",
                        border: `1px solid ${sel ? "#262320" : "#ddd6c8"}`,
                      }}
                    >
                      {s.name}
                    </button>
                  );
                })}
              </div>

              {/* mobile: tabs + single face */}
              <div className={styles.faceTabs}>
                <button
                  className={`${styles.faceTab} ${faceTab === "front" ? styles.faceTabActive : ""}`}
                  onClick={() => setFaceTab("front")}
                >
                  Front
                </button>
                <button
                  className={`${styles.faceTab} ${faceTab === "inside" ? styles.faceTabActive : ""}`}
                  onClick={() => setFaceTab("inside")}
                >
                  Inside
                </button>
              </div>
              <div className={styles.singleFace}>
                <div className={styles.faceWrap}>
                  {faceTab === "front" ? (
                    <CardFace styleId={styleId} accent={accent} px={300} face="front" slots={slots} interactive photoUrl={photoUrl} onPickPhoto={pickPhoto} />
                  ) : (
                    <CardFace styleId={styleId} accent={accent} px={300} face="inside" message={message} sender={sender} eyebrow={item.eyebrow} />
                  )}
                </div>
                <div className={styles.faceCaption}>{faceTab}</div>
              </div>

              {/* desktop: both faces side by side */}
              <div className={styles.facesRow}>
                <div>
                  <div className={styles.faceWrap}>
                    <CardFace styleId={styleId} accent={accent} px={248} face="front" slots={slots} interactive photoUrl={photoUrl} onPickPhoto={pickPhoto} />
                  </div>
                  <div className={styles.faceCaption}>Front</div>
                </div>
                <div>
                  <div className={styles.faceWrap}>
                    <CardFace styleId={styleId} accent={accent} px={248} face="inside" message={message} sender={sender} eyebrow={item.eyebrow} />
                  </div>
                  <div className={styles.faceCaption}>Inside</div>
                </div>
              </div>

              {styleId === "image" && (
                <div className={styles.photoNote}>
                  <button
                    type="button"
                    className={styles.uploadBtn}
                    onClick={() => photoInputRef.current?.click()}
                  >
                    {photoUrl ? "Change photo" : "Upload photo"}
                  </button>
                  <input
                    ref={photoInputRef}
                    type="file"
                    accept="image/*"
                    hidden
                    onChange={(e) => {
                      const f = e.target.files?.[0];
                      if (f) pickPhoto(f);
                      e.target.value = "";
                    }}
                  />
                  <span className={styles.txt}>
                    For a crisp print, use an image at least{" "}
                    <span style={{ color: "#262320" }}>1500px</span> on the
                    shortest side. We&rsquo;ll flag anything lower.
                  </span>
                  {photoLowRes && (
                    <span className={styles.photoWarn}>
                      That image looks low resolution. It may print soft. Try one
                      at least 1500px on the shortest side.
                    </span>
                  )}
                </div>
              )}
            </div>

            {/* CONTROLS */}
            <div className={styles.controls}>
              <div className={`${styles.ctrlTitle} ${styles.serif}`}>{item.title}</div>
              <div className={styles.ctrlSub}>Personalise every detail</div>

              {/* --- Wording --- */}
              <Accordion
                title="Wording"
                open={openSection === "wording"}
                onToggle={() => toggleSection("wording")}
              >
                <div className={styles.group}>
                  <label className={styles.label}>Recipient name</label>
                  <input
                    className={styles.field}
                    value={recipient}
                    onChange={(e) => setRecipient(e.target.value)}
                    placeholder="Fatima"
                  />
                </div>

                <div className={styles.group}>
                  <label className={styles.label}>Name on the front?</label>
                  <div className={styles.togglePair}>
                    <ToggleBtn selected={!showName} onClick={() => setShowName(false)}>
                      Clean front
                    </ToggleBtn>
                    <ToggleBtn selected={showName} onClick={() => setShowName(true)}>
                      Show &ldquo;For {recipient}&rdquo;
                    </ToggleBtn>
                  </div>
                  <div className={styles.hint}>
                    {showName
                      ? "The name appears on the front of the card."
                      : "Front stays clean; the name & message sit inside. Recommended."}
                  </div>
                </div>

                {showWordPicker && (
                  <div className={styles.group}>
                    <label className={styles.label}>Word on front</label>
                    <div className={styles.wordRow}>
                      {item.group === "occasion" &&
                        item.words.map((w, i) => {
                          const sel = !arabicOff && arabicIndex === i;
                          return (
                            <button
                              key={i}
                              className={styles.wordBtn}
                              onClick={() => {
                                setArabicIndex(i);
                                setArabicOff(false);
                              }}
                              style={{
                                background: sel ? "#262320" : "#faf8f2",
                                color: sel ? "#f4f0e7" : "#262320",
                                border: `1px solid ${sel ? "#262320" : "#d9d2c2"}`,
                              }}
                            >
                              <span className={styles.wordAr}>{w.ar}</span>
                              <span className={styles.wordTl}>{w.translit}</span>
                            </button>
                          );
                        })}
                      <button
                        className={styles.englishBtn}
                        onClick={() => setArabicOff(true)}
                        style={{
                          background: arabicOff ? "#262320" : "#faf8f2",
                          color: arabicOff ? "#f4f0e7" : "#262320",
                          border: `1px solid ${arabicOff ? "#262320" : "#d9d2c2"}`,
                        }}
                      >
                        English only
                      </button>
                    </div>
                  </div>
                )}

                <div className={styles.group}>
                  <label className={styles.label}>
                    Custom front text <span className={styles.optional}>— optional</span>
                  </label>
                  <input
                    className={styles.field}
                    value={customFront}
                    onChange={(e) => setCustomFront(e.target.value)}
                    dir="auto"
                    placeholder="Type Arabic or English..."
                  />
                  <div className={styles.hint}>
                    Overrides the word above. Arabic is shaped &amp; printed
                    right-to-left exactly as typed. Please double-check your
                    spelling.
                  </div>
                </div>

                {needsArabicConfirm && (
                  <div className={styles.gate} onClick={() => setArabicOk((v) => !v)}>
                    <div
                      className={styles.gateBox}
                      style={{
                        background: arabicOk ? "#1f6b5a" : "#faf8f2",
                        border: `1.5px solid ${arabicOk ? "#1f6b5a" : "#c9a24a"}`,
                      }}
                    >
                      {arabicOk ? "✓" : ""}
                    </div>
                    <div className={styles.gateText}>
                      I confirm the Arabic I entered is spelled correctly. It will
                      be printed exactly as shown.
                    </div>
                  </div>
                )}
              </Accordion>

              {/* --- Colour & paper --- */}
              <Accordion
                title="Colour & paper"
                open={openSection === "colour"}
                onToggle={() => toggleSection("colour")}
              >
                <div className={styles.group}>
                  <label className={styles.label}>Colourway</label>
                  <div className={styles.swatches}>
                    {SWATCHES.map((c) => (
                      <button
                        key={c.hex}
                        className={styles.swatch}
                        title={c.name}
                        aria-label={c.name}
                        onClick={() => setAccent(c.hex)}
                        style={{
                          background: c.hex,
                          border: `2px solid ${accent === c.hex ? "#262320" : "transparent"}`,
                        }}
                      />
                    ))}
                  </div>
                </div>

                <div className={styles.group}>
                  <label className={styles.label}>Paper</label>
                  {PAPERS.map((p) => {
                    const sel = paper === p.id;
                    return (
                      <div
                        key={p.id}
                        className={styles.paperOpt}
                        onClick={() => setPaper(p.id)}
                        style={{
                          background: sel ? "#efeadf" : "#faf8f2",
                          border: `1px solid ${sel ? "#a07f4a" : "#d9d2c2"}`,
                        }}
                      >
                        <div>
                          <div className={styles.paperName}>{p.name}</div>
                          <div className={styles.paperDesc}>{p.desc}</div>
                        </div>
                        <div className={styles.paperPrice}>{p.price}</div>
                      </div>
                    );
                  })}
                </div>
              </Accordion>

              {/* --- Your message --- */}
              <Accordion
                title="Your message"
                open={openSection === "message"}
                onToggle={() => toggleSection("message")}
              >
                <div className={styles.group}>
                  <div className={styles.duaRow}>
                    <label className={styles.label} style={{ marginBottom: 0 }}>
                      Inside message
                    </label>
                    <button className={styles.duaLink} onClick={insertDua}>
                      + add a du&rsquo;a
                    </button>
                  </div>
                  <textarea
                    className={styles.field}
                    rows={4}
                    value={message}
                    onChange={(e) => setMessage(e.target.value)}
                    dir="auto"
                    placeholder="Write your message..."
                  />
                </div>
                <div className={styles.group}>
                  <label className={styles.label}>Signed</label>
                  <input
                    className={styles.field}
                    value={sender}
                    onChange={(e) => setSender(e.target.value)}
                    placeholder="The Rahman Family"
                  />
                </div>
              </Accordion>

              <div className={styles.actions}>
                <button
                  className={`${styles.primary} ${continueBlocked ? styles.primaryBlocked : styles.primaryDark}`}
                  disabled={continueBlocked}
                  onClick={() => {
                    if (continueBlocked) return;
                    setStep("checkout");
                  }}
                >
                  Continue to delivery
                </button>
                <button className={styles.ghostBtn} onClick={() => setStep("gallery")}>
                  &larr; Choose another card
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ============ STEP: DELIVER (checkout) ============ */}
      {step === "checkout" && (
        <div className={styles.wrap}>
          <div className={styles.checkoutGrid}>
            <div>
              <div className={styles.eyebrow}>Delivery</div>
              <h2 className={`${styles.h1} ${styles.serif}`}>Ship it as a gift</h2>
              <p className={styles.shipReassure}>
                We send it directly to your recipient in a kraft envelope,{" "}
                <b>blind, with no Ketabi invoice and zero printer branding.</b>{" "}
                It simply arrives, beautifully, from you.
              </p>

              <div className={styles.formGrid}>
                <div className={styles.formFull}>
                  <label className={styles.label}>Recipient name</label>
                  <input className={styles.field} value={shipName} onChange={(e) => setShipName(e.target.value)} placeholder="Fatima Rahman" />
                </div>
                <div className={styles.formFull}>
                  <label className={styles.label}>Address</label>
                  <input className={styles.field} value={shipLine} onChange={(e) => setShipLine(e.target.value)} placeholder="14 Marlborough Road" />
                </div>
                <div>
                  <label className={styles.label}>City</label>
                  <input className={styles.field} value={shipCity} onChange={(e) => setShipCity(e.target.value)} placeholder="London" />
                </div>
                <div>
                  <label className={styles.label}>Postcode</label>
                  <input className={styles.field} value={shipPost} onChange={(e) => setShipPost(e.target.value)} placeholder="N19 4QT" />
                </div>
                <div className={styles.formFull}>
                  <label className={styles.label}>Country</label>
                  <input className={styles.field} value={shipCountry} onChange={(e) => setShipCountry(e.target.value)} placeholder="United Kingdom" />
                </div>
              </div>

              <div className={styles.actions}>
                {/* TODO (phase 2): real print-PDF generation, POD API, Stripe payment, low-res image guard.
                    No charge happens here; "Place order" only advances to the confirmation step. */}
                <button
                  className={`${styles.primary} ${styles.primaryDark}`}
                  onClick={() => setStep("handoff")}
                >
                  Place order &middot; {paperObj.price}
                </button>
                <button className={styles.ghostBtn} onClick={() => setStep("maker")}>
                  &larr; Back to the card
                </button>
              </div>
            </div>

            <div className={styles.summary}>
              <div className={styles.summaryHead}>Order summary</div>
              <div className={styles.summaryTop}>
                <div style={{ flexShrink: 0 }}>
                  <CardFace styleId={styleId} accent={accent} px={64} face="front" slots={slots} />
                </div>
                <div style={{ minWidth: 0 }}>
                  <div className={`${styles.summaryTitle} ${styles.serif}`}>{item.title}</div>
                  <div className={styles.summaryMeta}>
                    {collectionName} &middot; {paperObj.short}
                  </div>
                </div>
              </div>
              <div className={styles.summaryRows}>
                <div className={styles.sumRow}>
                  <span>Card &amp; printing</span>
                  <span>{paperObj.price}</span>
                </div>
                <div className={styles.sumRow}>
                  <span>Direct delivery</span>
                  <span className={styles.sumFree}>Free</span>
                </div>
                <div className={styles.sumTotal}>
                  <span>Total</span>
                  <span>{paperObj.price}</span>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ============ STEP: PRINT (confirmation) ============ */}
      {step === "handoff" && (
        <div className={styles.wrap}>
          <div className={styles.confirm}>
            <div className={styles.tick}>&#10003;</div>
            <h2 className={`${styles.h1} ${styles.serif}`}>Order placed, off to print</h2>
            <p className={styles.confirmNote}>
              Thank you. Your card is on its way to print and will be posted
              directly to {shipName || "your recipient"} in a kraft envelope,
              white-label, with no Ketabi or printer branding.
            </p>

            <div className={styles.confirmFaces}>
              <div>
                <div className={styles.faceWrap}>
                  <CardFace styleId={styleId} accent={accent} px={150} face="front" slots={slots} />
                </div>
                <div className={styles.faceCaption}>Front</div>
              </div>
              <div>
                <div className={styles.faceWrap}>
                  <CardFace styleId={styleId} accent={accent} px={150} face="inside" message={message} sender={sender} eyebrow={item.eyebrow} />
                </div>
                <div className={styles.faceCaption}>Inside</div>
              </div>
            </div>

            {/* Intended print spec — placeholder only. The real print file is not
                generated in phase 1. */}
            <div className={styles.specCard}>
              <div className={styles.specHead}>Intended print spec</div>
              <div className={styles.specRow}>
                <span>Format</span>
                <span>A6 folded &middot; 105 &times; 148 mm</span>
              </div>
              <div className={styles.specRow}>
                <span>Artboard + bleed</span>
                <span>216 &times; 154 mm</span>
              </div>
              <div className={styles.specRow}>
                <span>Resolution</span>
                <span>2551 &times; 1819 px &middot; 300 DPI</span>
              </div>
              <div className={styles.specRow}>
                <span>Colour &middot; stock</span>
                <span>CMYK &middot; {paperObj.short}</span>
              </div>
            </div>

            <div className={styles.confirmActions}>
              <button
                className={styles.confirmBtn}
                onClick={() => {
                  setStep("styles");
                  setStyleId("arch");
                }}
              >
                Make another card
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

// ---- small presentational helpers ----

function Accordion({
  title,
  open,
  onToggle,
  children,
}: {
  title: string;
  open: boolean;
  onToggle: () => void;
  children: React.ReactNode;
}) {
  return (
    <div className={styles.accordion}>
      <button
        className={`${styles.accHead} ${open ? styles.accHeadOpen : ""}`}
        onClick={onToggle}
        aria-expanded={open}
      >
        <span>{title}</span>
        <span className={styles.chev}>&#9662;</span>
      </button>
      {open && <div className={styles.accBody}>{children}</div>}
    </div>
  );
}

function ToggleBtn({
  selected,
  onClick,
  children,
}: {
  selected: boolean;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      className={styles.toggleBtn}
      onClick={onClick}
      style={{
        background: selected ? "#262320" : "#faf8f2",
        color: selected ? "#f4f0e7" : "#262320",
        border: `1px solid ${selected ? "#262320" : "#d9d2c2"}`,
      }}
    >
      {children}
    </button>
  );
}
