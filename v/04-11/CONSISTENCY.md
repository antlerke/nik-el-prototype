# v/04-11 — design consistency: problems and fixes

Found by the audit of 2026-11-04 (`tools-for-ai/audit.cjs`, pages at 1440 and 390 px). All of these come from the
Claude Design exports themselves — the same audit on the export files shows the same problems.

How it works: each item has the problem, where it is, a suggested fix and a **Decision** line for Anna.
Once decided, each item is done as its own commit, checked with screenshots, and ticked here.
Order: safest first — group 1 has no choice to make, group 2 is obvious but visible, group 3 sets the scales for the UI kit.

Already done: tags and kickers vertically centred · sort in the catalog 48 px like the tabs · legend «NIK 2306 у розрізі» keeps red numbers / grey text.

---

## Group 1 — no choice needed (bugs, or invisible)

### 1. Tag line height differs between pages (code only, not visible)
- **Problem:** home tags use line-height `normal` (24 px tall), catalog / product `1.3` (23.6 px), so each page needs its own centring offset.
- **Fix:** one tag rule on all pages; no visible change.
- **Decision:** ✅ done — one rule on all pages: 24 px tall (16 px line), capitals centred (4.5 / 3.5 px padding).

### 2. Text gets bolder when selected
- **Problem:** the selected 3D hotspot button goes from weight 500 to 600 — its text gets wider and the button jumps.
- **Where:** home — «Від чипа до корпусу».
- **Fix:** keep 500; show the selection by colour only (as the tabs do).
- **Decision:** ✅ done — selected stays 500; selection shown by white background, dark outline and text, red dot. (The button box itself is a fixed grid cell; it was the text that got wider.)

### 3. «PDF» badges and page numbers not vertically centred (same font effect as the tags)
- **Where:** product — «PDF» badges in «Документація» (1.3 px high) · catalog — page numbers «1», «2» (1 px).
- **Fix:** same as tags and kickers — text moved down by that amount, box size unchanged.
- **Decision:** ✅ done — «PDF» and page numbers centred (0.00 px); sizes unchanged (44×28, 44×44).

## Group 2 — obvious, small visible change

### 4. Fields and the button next to them: 58 vs 56 px
- **Problem:** in the contact form the button «Надіслати запит» is 56 px, the fields above it 58 px; the catalog search is 58 px too. Every button on the site is 56 px.
- **Fix:** fields **56** px (contact form and catalog search).
- **Decision:** ✅ done — contact form fields (incl. phone) and catalog search are 56 px, like the buttons. Text area stays 140 px.
  ⚠ The first version also stretched the consent checkbox to 56 px (it is an `input` too) — fixed: checkboxes are excluded.

### 5. Field borders — 1 vs 1.5 px
- **Problem:** contact form fields have a 1 px border, the catalog search 1.5 px (both #8592A0). Every other line on a control is 1.5 px.
  (In the CSS both are 1.5 px — but the fields use a real border, which the browser rounds down to 1 px on standard screens; the search, tabs and buttons draw an inset line, which stays 1.5 px.)
- **Fix (first try, undone):** fields drawn with the inset 1.5 px line → on standard screens they got thicker than before, which wasn't wanted.
- **Decision:** ✅ done, option B — the form fields stay exactly as they were (1.5 px border, shown as 1 px on standard screens); the **catalog search now uses the same border** as the fields, in every state (hover darker, focus dark + ring, disabled light). Tabs, sort and outline buttons keep their own line (a different kind of control). Checkboxes unchanged.

### 6. Card titles — same role, different spacing
- **Problem:** product cards 24 px with letter-spacing −0.48 px, news cards 24 px with −0.36 px; on mobile (20 px) line height 23 vs 25 px and −0.4 vs −0.3 px.
- **Where:** home — catalog cards vs news cards; catalog and product — product cards.
- **Fix:** news cards take the product card title style: 24 / 700, line height 1.2, −0.02em (mobile 20 / 700, line height 1.15, −0.02em).
- **Decision:** ✅ done — news and product card titles identical: 24/700, 28.8 px line, −0.48 px (mobile 20/700, 23 px line, −0.4 px).
  Side effect on desktop: «НІК-ЕЛЕКТРОНІКА» now fits on one line, so the two small news cards changed height (303 / 291 → 290 / 304 px).

### 7. Product card top row differs between pages
- **Problem:** on home the labels in the card's top row are spread to both ends; on catalog and product they sit together on the left. Visible when a card has two labels (e.g. «Новинка»).
- **Fix:** together on the left everywhere (as catalog / product).
- **Decision:** ✅ done — same rule on all pages (left, 8 px gap, wraps). On home no visible change (its cards have one label) — screenshots identical.

### 8. Partner names 15 px on mobile
- **Problem:** everything else on mobile is 14, 16 or 17 px (17 is the body text on all pages — consistent).
- **Where:** home — «Клієнти та партнери», the running names.
- **Fix:** 16 px.
- **Decision:** ✅ done — partner names 16 px on mobile (desktop stays 20 px).

## Group 3 — design decisions (the scales for the UI kit)

### 9. Control heights — 6 different: 40, 44, 48, 52, 56, 58 px
- **Problem:** after item 4 the fields match the buttons; what remains is the 3D hotspot buttons at **52** px — a size used nowhere else.
- **Suggested scale:** **44** icon buttons · **48** secondary controls (tabs, sort, filters, hotspot buttons 52 → 48) · **56** primary buttons and fields.
- **Decision:** ✅ done (Anna: 48) — hotspot buttons 48 px like the tabs. Scale now: 44 icon buttons · 48 "pick one" and secondary controls · 56 buttons and fields.

### 10. Corner radii — 12 different: 2, 4, 8, 12, 14, 16, 18, 20, 22, 24, 28, round
- **Problem:** large boxes (28 / 22 on mobile), cards (24) and controls (8) follow a pattern; small surfaces don't — 12, 14, 16, 18 and 20 for similar things. Some catalog filter controls (group headers, «Показати ще») have **4** instead of 8.
- **Where:** 12 — header dropdown links · 14 — number box in «Від чипа», icons in the contact form · 16 — hero product label, document tiles · 18 — photos in cards and production steps, the note in the form · 20 — cookie panel · 4 — checkboxes, catalog filter headers, «Показати ще».
- **Suggested scale:** **4** checkboxes only · **8** all controls (filter headers and «Показати ще» 4 → 8) · **16** small surfaces (12, 14, 18, 20 → 16) · **24** cards · **28 / 22** large boxes (unchanged).
- **Decision:** ✅ done (Anna) — scale now **4** checkboxes and small labels up to 28 px tall (tags, «Новинка», «PDF», «01 / 04») · **8** controls, kickers, menu links, catalog filter headers and «Показати ще», hero product label · **16** small surfaces (photos in cards and production steps, «Від чипа» number box, contact icons, the form note, document tiles, cookie panel) · **24** cards · **28 / 22** large boxes («Від чипа» card now 22 on mobile too). 12 → 8 distinct radii on the pages.

### 11. Numbers «01» — 8 different styles
- **Problem:** the same kind of label (an index number) looks different in every section.
- **Where (home):** hero slides — mono 16/600 · hero product label «01 / 04» — mono 14/600 · «Від чипа» card number — Geologica 24/700 (20 on mobile) · exploded-view markers — Geologica 12/700 (10 on mobile) · legend «NIK 2306 у розрізі» — mono 16/700 · production steps — mono 12/**900**.
- **Suggested:** two styles — **index**: JetBrains Mono 14/600 (hero, product label, legend, steps, «Від чипа» card) · **marker on an image**: JetBrains Mono 12/700 (exploded view). Afterwards their vertical centring is checked the same way as item 3.
- **Decision:** ✅ done (Anna: option B + centred) — all numbers JetBrains Mono 600: **14 px** in badges and circles («01 / 04», «Від чипа» card number, legend, production steps), **12 px** on the exploded-view markers; hero slide numbers stay 16 px plain text. Every number vertically centred (0 px); circles and boxes keep their size.

### 12. Shadows on raised surfaces — 5 different
- **Problem:** product cards, the contact form card, the hero product label, the active hero chip and the cookie panel each have their own shadow.
- **Suggested:** two levels — **raised** (cards, form card, product label, chip) = the card shadow · **overlay** (cookie panel, mobile filter panel, menus) = the cookie shadow.
- **Decision:** ✅ done (Anna: option A) — **raised** `0 0 0 1px line, 0 12px 32px −24px rgba(19,56,93,.28)`: product and news cards, contact form card, hero product label and chips · **above the page** `0 24px 64px rgba(10,32,56,.22), 0 0 0 1px rgba(19,56,93,.06)`: cookie panel, dropdown menus, mobile filter panel (upwards). Card hover unchanged.

## Group 4 — found in the re-check after groups 1–3 (audit of 2026-11-04)

### 13. Video section heading on mobile differs from the other section headings
- **Problem:** «Автоматизоване виробництво» (on the video) is 26 px like every mobile section heading, but with line height 23.9 px and letter-spacing −1.3 px; the others have 26.5 px and −1.04 px. Desktop is the same for all.
- **Where:** home, mobile — section «Автоматизоване виробництво».
- **Suggested fix:** the same line height and letter-spacing as the other mobile section headings.
- **Decision:** ✅ done — on mobile the video heading now has line height 1.02 (26.5 px) and −0.04em (−1.04 px) like the other section headings; the section is 5 px taller. Desktop unchanged.

### 14. «Від чипа» card text: line height 1.6 instead of 1.5
- **Problem:** on desktop the card's description («Показує спожиту активну…») is 20 px with line height 1.6 (32 px); the other 20 px body text (e.g. «Повний цикл…») uses 1.5 (30 px). Mobile is the same for both.
- **Where:** home, desktop — «Від чипа до корпусу», the card next to the 3D model.
- **Suggested fix:** line height 1.5.
- **Decision:** ✅ done — the card text is 20 px / 30 px on desktop like the other body text; the card is 6 px shorter. Mobile unchanged (already 1.5).

### 15. Unused CSS left over from the export (code only, not visible)
- **Problem:** each page carries rules that no longer do anything: overridden by later rules (e.g. the old catalog sort focus), or for elements that no longer exist (`.tel-hint`, `.tilt` from the old 2D picture, `.thumbs` from the removed product thumbnails).
- **Suggested fix:** list them per page, remove them, and prove with the pixel comparison (all pages, 1440 and 390, incl. hover and focus) that nothing changes. A step towards leaving the Claude Design export behind.
- **Decision:** ⏸ postponed (Anna) — to be done together with the new UI kit, when the pages' CSS is rebuilt on the kit's scales.
