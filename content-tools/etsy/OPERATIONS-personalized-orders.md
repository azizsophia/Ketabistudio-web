# Operations runbook — personalized orders (Etsy + Gumroad)

How a personalized order becomes a delivered file. The renderers are Python
(PIL) and run in Claude's session, not on the Vercel server, so rendering +
delivery are assisted, not fully hands-off. Reading orders IS automatable.

## 1. Collecting the name

**Etsy** — turn on Personalization per listing (Shop Manager → edit listing →
Personalization → On + Required, char limit 256, paste the instruction text from
`listing-guide-name-print.md`). The buyer types the name at checkout; it lands on
the order. (Etsy deprecated the API for this toggle — it's a 10-sec manual step.)

**Gumroad** — add a custom field per personalized product (product editor →
Checkout → Add custom field → "Type the name exactly as you'd like it" →
required). Custom fields are UI-only (not settable via API). Because Gumroad
delivers instantly, upload a "how it works" placeholder as the product file and
send the real render afterward.

## 2. Reading the order (automatable)

**Etsy:** `GET /api/etsy/orders?limit=25` (Bearer CRON_SECRET) returns recent
paid orders with buyer + the personalization string (the typed name). Requires
the token to carry **transactions_r** — re-authorize once at
`/api/etsy/authorize?key=ketabi-cron-2027` after the scope bump deploys.

**Gumroad:** `GET https://api.gumroad.com/v2/sales` (access_token) returns sales
incl. the custom-field value. No re-auth — the token already has full access.

## 3. Render + deliver

- Render: Claude runs the renderer for that name/tier (`gen_name_print.py` /
  `gen_keepsake.py`) → print-ready PDF + framing PNG (`gen_name_deliverables.make_print_files`).
- Deliver **Etsy:** send the files via Etsy Messages on the order (no public
  send-message API; owner attaches them). Etsy also auto-delivers the how-it-works PDF.
- Deliver **Gumroad:** email the buyer the files, or use the product's "Send
  updates" to push the real file.

Interim flow (low volume, works today): order email arrives → owner pastes Claude
the name → Claude renders in ~2 min → owner delivers the files. When volume grows,
Claude polls `/api/etsy/orders` + Gumroad `/sales` to pull names without forwarding.

## 4. Owner one-time / periodic tasks
- [ ] Etsy: Personalization On+Required on the 8 keepsakes + name print.
- [ ] Etsy: re-authorize once for transactions_r (link above).
- [ ] Gumroad: drag covers in, publish the 3 drafts; add custom field if selling
      a personalized product there.
- [ ] Paste the About / receipt / announcement copy (see chat + below).

## Copy set (paste-ready)
- Etsy About story, buyer message, announcement: in `listing-guide-name-print.md`
  chat delivery.
- Gumroad receipt: SET via API on all 3 products already.
- Gumroad profile bio (UI-only):
  > Ketabi Studio makes verified Islamic keepsakes: prints, decks, and downloads
  > where every name, du'a, and ayah is checked against the Qur'an and the
  > authentic Sunnah, with the source cited on each piece. No forwarded,
  > unsourced text. Beautiful enough to frame, trustworthy enough to teach from.
