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

### 5. Field borders — 1 vs 1.5 px
- **Problem:** contact form fields have a 1 px border, the catalog search 1.5 px (both #8592A0). Every other line on a control is 1.5 px.
- **Fix:** fields **1.5 px**. Checkboxes stay 2 px (small box, needs the weight).
- **Decision:**

### 6. Card titles — same role, different spacing
- **Problem:** product cards 24 px with letter-spacing −0.48 px, news cards 24 px with −0.36 px; on mobile (20 px) line height 23 vs 25 px and −0.4 vs −0.3 px.
- **Where:** home — catalog cards vs news cards; catalog and product — product cards.
- **Fix:** news cards take the product card title style: 24 / 700, line height 1.2, −0.02em (mobile 20 / 700, line height 1.15, −0.02em).
- **Decision:**

### 7. Product card top row differs between pages
- **Problem:** on home the labels in the card's top row are spread to both ends; on catalog and product they sit together on the left. Visible when a card has two labels (e.g. «Новинка»).
- **Fix:** together on the left everywhere (as catalog / product).
- **Decision:**

### 8. Partner names 15 px on mobile
- **Problem:** everything else on mobile is 14, 16 or 17 px (17 is the body text on all pages — consistent).
- **Where:** home — «Клієнти та партнери», the running names.
- **Fix:** 16 px.
- **Decision:**

## Group 3 — design decisions (the scales for the UI kit)

### 9. Control heights — 6 different: 40, 44, 48, 52, 56, 58 px
- **Problem:** after item 4 the fields match the buttons; what remains is the 3D hotspot buttons at **52** px — a size used nowhere else.
- **Suggested scale:** **44** icon buttons · **48** secondary controls (tabs, sort, filters, hotspot buttons 52 → 48) · **56** primary buttons and fields.
- **Decision:**

### 10. Corner radii — 12 different: 2, 4, 8, 12, 14, 16, 18, 20, 22, 24, 28, round
- **Problem:** large boxes (28 / 22 on mobile), cards (24) and controls (8) follow a pattern; small surfaces don't — 12, 14, 16, 18 and 20 for similar things. Some catalog filter controls (group headers, «Показати ще») have **4** instead of 8.
- **Where:** 12 — header dropdown links · 14 — number box in «Від чипа», icons in the contact form · 16 — hero product label, document tiles · 18 — photos in cards and production steps, the note in the form · 20 — cookie panel · 4 — checkboxes, catalog filter headers, «Показати ще».
- **Suggested scale:** **4** checkboxes only · **8** all controls (filter headers and «Показати ще» 4 → 8) · **16** small surfaces (12, 14, 18, 20 → 16) · **24** cards · **28 / 22** large boxes (unchanged).
- **Decision:**

### 11. Numbers «01» — 8 different styles
- **Problem:** the same kind of label (an index number) looks different in every section.
- **Where (home):** hero slides — mono 16/600 · hero product label «01 / 04» — mono 14/600 · «Від чипа» card number — Geologica 24/700 (20 on mobile) · exploded-view markers — Geologica 12/700 (10 on mobile) · legend «NIK 2306 у розрізі» — mono 16/700 · production steps — mono 12/**900**.
- **Suggested:** two styles — **index**: JetBrains Mono 14/600 (hero, product label, legend, steps, «Від чипа» card) · **marker on an image**: JetBrains Mono 12/700 (exploded view). Afterwards their vertical centring is checked the same way as item 3.
- **Decision:**

### 12. Shadows on raised surfaces — 5 different
- **Problem:** product cards, the contact form card, the hero product label, the active hero chip and the cookie panel each have their own shadow.
- **Suggested:** two levels — **raised** (cards, form card, product label, chip) = the card shadow · **overlay** (cookie panel, mobile filter panel, menus) = the cookie shadow.
- **Decision:**
