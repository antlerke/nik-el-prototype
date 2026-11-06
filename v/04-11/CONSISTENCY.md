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

### 16. Product page, mobile: gap after «Технічні характеристики» 158 px instead of 160
- **Problem:** the section's bottom padding is reduced on purpose (the specs table adds its own space), but a later rule set 64 px where an earlier one had 66 — so the visible gap was 158 px, the others 160.
- **Decision:** ✅ done — 66 px, both rules now agree; all visible gaps between product sections on mobile are 160 px. Desktop unchanged.

## Group 5 — mobile (check of 2026-11-05)

Found by `tools-for-ai/mobile-check.cjs` (phone emulation, 320 / 360 / 390 px, also with the menu, the catalog filter panel
and the cookie panel open) and by looking at every section. Clean: nothing sticks out of the screen, fields are 16 px
(no iPhone zoom), no text under 12 px, no text touching the screen edge.

### 17. «Повний цикл»: step titles break in the middle of a word
- **Problem:** on mobile the titles may break anywhere, so a word is split without a hyphen: «Конструкторськ / е бюро» (390), «Конструкто / рське», «випробуван / ня» (320). At 320 the pink tile's word «післягарантійне» is wider than the tile and gets cut.
- **Where:** home, mobile — «Повний цикл — від розробки до сервісу», the six steps under the photos.
- **Suggested fix (choose):** A — number above the title (the title gets the full tile width) · B — smaller title · C — one step per row.
- **Decision:** ✅ done (Anna) — A was tried and undone (number above the title didn't look right). Instead, on mobile: titles 14 px, numbers like the photo markers (20 px circle, 12 px); «Конструкторське» has a soft hyphen, used only below 360 px («Конструк- / торське бюро»). All titles are whole words at 360 and 390; the section is 18–70 px shorter. Tablet and desktop unchanged. The pink tile (no hyphens there — they also split «післягарантійне» at 390): narrower than 360 px its side padding is 8 px instead of 16, so «обслуговування,» fits; font stays 14 px.

### 18. Cookie panel: button text on two lines
- **Problem:** the two buttons sit side by side and are too narrow: «Лише необхідні» wraps at 390, both buttons wrap at 320.
- **Where:** all pages, mobile — cookie panel.
- **Suggested fix:** buttons one under another, full width, one line each.
- **Decision:** ✅ done (Anna) — on mobile «Прийняти всі» and «Лише необхідні» are one under another, full width, text on one line; «Налаштувати» below. The panel is ~50 px taller. All three pages; desktop unchanged.

### 19. News: first photo taller than the others
- **Problem:** on mobile the three news cards are the same list, but the first photo is ~300 px tall (left over from the big desktop card), the other two 200 px.
- **Where:** home, mobile — «Новини та статті».
- **Suggested fix:** 200 px for all three.
- **Decision:** ✅ done (Anna) — on mobile all three news photos are 200 px (the first was 320); the section is 120 px shorter. Tablet and desktop unchanged (the big card stays big).

### 20. Product page: second block in a section starts 24 px after the first
- **Problem:** on desktop two blocks sit side by side; on mobile they stack with only 24 px between them, so a new kicker and heading stick to the table / documents above.
- **Where:** product, mobile — «Як читати код замовлення» after the specs table, «Огляд моделі» after the documents.
- **Suggested fix:** 64 px before a block that starts with its own kicker and heading (text → picture stays 24 px).
- **Decision:** ✅ done (Anna) — on mobile 64 px before «Як читати код замовлення» and «Огляд моделі»; each section is 40 px taller. «Опис» and «Креслення» (text → picture) stay 24 px. Tablet (48 px) and desktop unchanged.

### 21. Product page: breadcrumb line starts with «/»
- **Problem:** the breadcrumbs wrap and the second line starts with the separator: «/ NIK 2306» (390), «/ Облік електроенергії …» (320).
- **Where:** product, mobile — breadcrumbs.
- **Suggested fix:** the «/» stays on the line with the item before it, so a new line starts with a link.
- **Decision:** ✅ done (Anna) — the separator now belongs to the item before it, so a wrapped line starts with a link («Облік електроенергії / NIK 2306»). Same rule on catalog (no visible change there); spacing and heights unchanged.

### 22. Footer links too small to tap
- **Problem:** the link lists are 23 px tall with 12 px between them; «Політика конфіденційності», «Cookie», «LinkedIn · Facebook · YouTube» are 18–20 px. The guideline for touch is 44 px.
- **Where:** all pages, mobile — footer.
- **Suggested fix:** a 44 px tap area around each link without changing how the footer looks.
- **Decision:** ✅ done (Anna: on the 8 px grid) — 44 px isn't possible without loosening the footer (the column links are 31 px apart), so: column links 32 px (lines 24 px instead of 23.2, + the 8 px gap; two-line links 56 px), bottom links 40 px. The extra is invisible padding; the footer is 9–12 px taller on mobile. All three pages; tablet and desktop unchanged.

### 23. Mobile menu: language buttons 36 px
- **Problem:** UA / EN / RU are 36 px tall; everything else in the menu is 44–48 px.
- **Where:** all pages — mobile menu, bottom.
- **Suggested fix:** 44 px.
- **Decision:** ✅ done (Anna: on the 8 px grid) — language buttons 40 px, so the whole switch is 48 px like the tabs. Burger menu on all three pages; the header switch on desktop unchanged.

### 24. 320 px: the 3D hint touches the edge of its box
- **Problem:** «Потягніть убік, щоб обернути» runs right up to the box's right edge (no space left).
- **Where:** home «Від чипа до корпусу» and product, 320 px only.
- **Suggested fix (choose):** A — the hint may wrap onto two lines, keeping 24 px from the edge · B — shorter text on narrow screens («Потягніть, щоб обернути»).
- **Decision:** ✅ done (Anna: B) — narrower than 360 px the hint is «Потягніть, щоб обернути» (43–53 px clear of the edge at 320); from 360 px it stays «Потягніть убік, щоб обернути» (41 px and more). Home and product; desktop text unchanged.

### 25. Video section: kicker too close to the video (found by Anna)
- **Problem:** on mobile the video is on top and the text block below it; the kicker «Відеоекскурсія виробництвом» sat only 16 px under the video, so it looked stuck to the picture.
- **Where:** home, mobile — «Автоматизоване виробництво».
- **Options:** A — 32 px above the kicker · B — kicker on the video's bottom-left corner, as on desktop.
- **Decision:** ✅ done (Anna: A) — 32 px between the video and the kicker; the block is 16 px taller. Tablet and desktop unchanged.

### 26. «Від чипа»: hotspot switches inconvenient on mobile (found by Anna)
- **Problem:** on mobile the 7 switches were a full-width list under the card (~390 px tall): after picking one you had to scroll back up to see the card and the model.
- **Where:** home, mobile — «Від чипа до корпусу».
- **Options:** A — one row under the 3D model that scrolls sideways (like the tabs) · B — several per row, wrapping · C — two columns.
- **Decision:** ✅ done (Anna: A) — order on mobile: model → row of switches → card; the picked switch (also when picked by a mark on the model) scrolls to the middle of the row, the page doesn't move. The section is 332 px shorter. Tablet and desktop unchanged.

## Group 6 — mobile re-check after group 5 (2026-11-05)

### 27. Header logo: tap area 34 px
- **Problem:** the logo link (to the home page) is only as tall as the logo, 34 px; the header is 64 px.
- **Where:** all pages, header up to 900 px (where the logo is 34 px).
- **Suggested fix:** 48 px tap area, invisible (padding offset by negative margin).
- **Decision:** ✅ done (Anna) — the logo link is a 48 px tap area up to 900 px; nothing moves (header pixel-identical). All three pages; desktop unchanged.

### 28. Breadcrumb links 18 px tall
- **Problem:** «Головна», «Каталог», «Облік електроенергії» are 18 px tall tap targets.
- **Where:** catalog and product, mobile.
- **Suggested fix:** 32 px tap areas like the footer — lines 24 px (+ the 8 px gap), so the crumbs get ~4 px taller per line.
- **Decision:** ✅ done (Anna) — on mobile the crumb links are 32 px tap areas (lines 24 px instead of 20.3, + the 8 px gap); the crumbs are ~4 px taller per line, everything else only moves by that much. Catalog and product; tablet and desktop unchanged.

### 29. Catalog, mobile: «Фільтри» button outline differs from the sort next to it
- **Problem:** «Фільтри» (48 px) has the dark button outline, the sort beside it the light one; on the home page 48 px controls (tabs) use the light outline, the dark one is for 56 px buttons.
- **Where:** catalog, mobile — above the results.
- **Suggested fix:** the light outline, like the sort and the tabs.
- **Decision:** ✅ done (Anna) — «Фільтри» (up to 900 px) has the light outline like the sort and the tabs; hover too: dark outline instead of the navy fill. Desktop has no such button.

### 30. Home, mobile: 3D hint icon gap 10 px
- **Problem:** the gap between the rotate icon and «Потягніть убік, щоб обернути» is 10 px on home mobile, 8 px everywhere else (home desktop, product).
- **Suggested fix:** 8 px.
- **Decision:** ✅ done (Anna) — 8 px, like home desktop and product.

### 31. Contact block: «дня» alone on a line
- **Problem:** «Відповідаємо протягом 1 робочого дня» wraps so that «дня» is alone on the second line.
- **Where:** home, mobile — «Готові до співпраці?», under the e-mail.
- **Suggested fix:** non-breaking spaces in «1 робочого дня», so it wraps as one piece.
- **Decision:** ✅ done (Anna) — «1 робочого дня» has non-breaking spaces and wraps as one piece («Відповідаємо протягом / 1 робочого дня»).

### 32. Model and standard names split across lines
- **Problem:** a name breaks between its parts: «NIK / 2308» (home 390, «Від чипа» text), «ISO / 27001» (home 320, news title), «NIK LTE / Module» (product 320–360, feature list), «EN / 62053-23» (product 320–360, specs table).
- **Suggested fix:** non-breaking spaces inside these names.
- **Decision:** ✅ done (Anna) — non-breaking spaces in «NIK 2308», «ISO 27001», «NIK LTE Module», «EN 50470-3», «EN 62053-23»; the standards also get an invisible word joiner after the hyphen (JetBrains Mono has no non-breaking hyphen glyph), so «EN 62053-23» never splits at «-». Seen on desktop / tablet too: the news title on 768 now wraps «за / ISO 27001».

### 33. One word alone on the last line (product)
- **Problem:** «Ціни, наявність і замовлення — у кабінеті / партнера.» (all mobile widths); heading «Облік і керування навантаженням в одному / приладі» (360–390).
- **Suggested fix:** non-breaking spaces, so «у кабінеті партнера» and «в одному приладі» wrap as one piece (also keeps «у» / «в» off the line end).
- **Decision:** ✅ done (Anna) — «у кабінеті партнера» and «в одному приладі» wrap as one piece; on desktop the heading now reads «навантаженням / в одному приладі» (the «в» no longer hangs at the line end). Heights unchanged.

### 34. Hero slide switches 24 px tall
- **Problem:** on mobile the four bars under the product picture are 44 × 24 px tap targets (the minimum).
- **Suggested fix:** 48 × 32 px tap areas, invisible (like the footer links).
- **Decision:** ✅ done (Anna) — each bar has an invisible 48 × 32 px tap area (neighbours touch, no overlap); the look is unchanged.

## Group 7 — bugs (check of 2026-11-05: JS errors, failed loads, markup, interactions)

### 35. Catalog search ran on leaving the field, with no button to start it (found by Anna)
- **Problem:** the search applied only after Enter or when the field lost focus; the magnifier was decoration only.
- **Options:** A — the magnifier becomes the button · B — a «Знайти» button inside the field.
- **Decision:** ✅ done (Anna: B) — the field is a search form with a 40 px «Знайти» button (navy, like «Прийняти всі»); search runs on the button or Enter (the phone keyboard's «Пошук»), not while typing or on leaving the field. On narrow phones the placeholder is shortened with «…» (320: «Модель, пр…»). The search label is kept for screen readers.

### 36. Header, catalog filters and product sub-menu didn't stick
- **Problem:** they are `position: sticky` in the CSS, but the page wrapper (from the Claude Design export) had `overflow-x: hidden`, which turns sticky off — they scrolled away with the page.
- **Decision:** ✅ done (Anna) — the wrapper uses `overflow-x: clip` (still no sideways scroll); the header stays on top on all pages, the product sub-menu right under it (96 / 80 / 64 px), the catalog filters (desktop) 24 px under the header.
  Two follow-ups, done as 39 and 40.

### 37. Home, mobile: «Також у каталозі» row didn't scroll
- **Problem:** the block wraps (`flex-wrap`), so on mobile the row grew to its full length (977 px) and was cut by the screen edge instead of scrolling — the last chips were unreachable.
- **Decision:** ✅ done (Anna) — no wrapping on mobile; the row is screen-wide and scrolls sideways like the tabs.

### 38. Footer at 320 px: phone number past its column
- **Problem:** «+380 (44) 498-06-19» (kept on one line) is wider than its column and reached the screen edge (cut at 320).
- **Decision:** ✅ done (Anna) — narrower than 360 px «Контакти» takes the full width as its own row; the footer is 111 px taller there. All three pages.

### 39. Catalog (desktop): sticky filter panel taller than the screen
- **Problem:** once sticky (36), the ~1000 px panel stuck under the header and its lower part («Сертифікати», «Показати зняті») was only reachable at the end of the results.
- **Decision:** ✅ done (Anna) — the panel is at most the screen height minus 144 px (24 px clear at the bottom); what doesn't fit scrolls inside it (thin scrollbar, the page doesn't scroll along).

### 40. Product sub-menu: active item didn't follow scrolling
- **Problem:** the underline moved only on click; with the sub-menu now always visible it showed «Опис» while reading other sections.
- **Decision:** ✅ done (Anna) — the section whose top is 80 px under the sub-menu is current, while scrolling and after a jump. Desktop: documents and video sit side by side, so that row shows «Документи», or «Відео» if that was clicked (remembered until you scroll to another section).

### 41. Catalog: page button «1» shown when nothing was found
- **Problem:** the page buttons were always on — with 0 results (and with a single page) a lone «1» stayed under the empty message.
- **Decision:** ✅ done (Anna) — page buttons only when there is more than one page. (The «Послуги» / «Програмне забезпечення» tabs were checked again: they work — 4 service cards, NIK SPACE; the first check was wrong.)

### 42. Catalog: «скиньте фільтри» left the old search text in the field
- **Problem:** after «нічого не знайдено» → «скиньте фільтри» all models came back, but the field still showed the old query (the page doesn't re-render fields).
- **Decision:** ✅ done (Anna) — the reset empties the search field too.

### 43. Contact form: fields with an error weren't marked for screen readers
- **Problem:** after «Надіслати запит» with empty fields the errors showed in red, but a screen reader only heard the label — not that the field is wrong, nor the error text.
- **Decision:** ✅ done (Anna) — on a failed submit each wrong field gets `aria-invalid` and its error text (now with an id) as its description; focus goes to the first one as before, so it reads e.g. «ПІБ, невірно, Вкажіть прізвище та ім’я». Fixing a field removes the mark. Nothing visible changes.

### 44. Home: scroll «reveal» animation on headings (found by Anna)
- **Problem:** six section headings and the six «Повний цикл» photo cards faded in and slid up 40 px, tied to the scroll position (half-transparent and shifted if you stop scrolling); the kicker above didn't move, so they drifted apart; home only, and only in browsers with scroll-driven animations (Chrome, Edge). Came with the Claude Design export.
- **Decision:** ✅ done (Anna: remove) — the animation and its `rv` classes are gone; headings and cards are simply there, as on catalog and product. The site header is not affected.

Also fixed in the checking tool: `mobile-check.cjs` treated the page wrapper as a sideways scroller and so missed every overflow; 37 and 38 were found after that fix.

## Group 8 — cleanup of `style.css` and the pages, postponed (listed 2026-11-06)

All the CSS of this version now lives in `v/04-11/style.css`. Anna: new pages come first, this cleanup continues later. None of these items is visible on the pages today, and all of them are ⏸ postponed (Anna).

Agreed rule for new pages, and the goal of this group: one class = one style. Reuse existing classes; a real variant gets its own class on the element, named by what it does, not by the page (`.tag-small`, not `.about-tag`); colours through `var(--...)`; no `main>:nth-child` rules.

### 45. Colours written directly instead of the variable
- **Problem:** about 17 places write the value (`#c8102e`, `#59636e`…) where a variable exists (`var(--red)`, `var(--muted)`); 355 already use the variable. Changing a variable would miss these places.
- **Fix:** use the variable there. Nothing visible changes.

### 46. Rules still repeated
- **Problem:** `.tag,.doc em` and `.tag,.ptag em` both set 4 px corners; the base `.tag{padding:6px 10px}` is overridden at every width by two `@media` rules. `tidy-css.cjs` removes only what can never win under the same or a wider condition, so these stayed.
- **Fix:** merge them one by one, each checked with `same-check.cjs`.

### 47. `!important` — 53 of them
- **Problem:** many exist only to beat an inline `style="…"`; they make a rule hard to override on a new page.
- **Fix:** goes away together with 48.

### 48. Inline `style="…"` — 70 (home 28, catalog 17, product 25)
- **Problem:** styles outside `style.css`; a few are filled in by the page's code and have to stay.
- **Fix:** move the static ones to classes.

### 49. One class name, two meanings
- **Problem:** `.n` is the red number on the home page and «Знайдено» in the catalog. No conflict today, because each rule sits under its own parent, but it is confusing. `.ph` and `.svc` were the same kind of case and are already renamed (`.placeholder`, `.svc-grid`).
- **Fix:** rename, and look for other such names.

### 50. Header and footer copied into every page
- **Problem:** a change in the menu has to be repeated on each page; the cost grows with every new page.
- **Fix:** one shared header and footer.

### 51. The rule isn't written in `style.css` itself
- **Fix:** a short comment at the top of the file with the rule above, for Anna and the developers. Comments that lost their rule in the cleanup can be reviewed at the same time.

### 52. Small bugs that were there before
- **Problem:** `favicon.ico` is missing (404); `aria-controls="mnav"` on the burger button points at a menu that exists only while it is open.

### 53. Checking tools
- **Problem:** `same-check.cjs` compares only the three old pages with commit `5ec6136`; the `css` mode of `diff-export.cjs` no longer sees the CSS, because it left the pages.
- **Fix:** before more refactoring, move its base to a newer commit, empty its list of intended changes and add the new pages' states.

Item 15 (unused CSS) still waits for the UI kit: 58 rules applied on no page in the check of 2026-11-06 (some, such as `:disabled` states, may be useful for the kit).
