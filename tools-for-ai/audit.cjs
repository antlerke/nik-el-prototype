// Design consistency audit of the built pages: what the pages actually use, and where the same thing differs.
//   node tools-for-ai/audit.cjs [base url] [pages...]    default: http://127.0.0.1:8740/v/04-11/ index catalog product
// Writes tools-for-ai/out/audit.json and prints a summary:
//   1. CSS drift — :root variables and rules for the same selector that differ between pages (each page has its own CSS copy)
//   2. Rendered inventory at 1440 and 390 px — type styles, colours, radii, control heights, shadows, section spacing
const { spawn } = require('child_process'), fs = require('fs'), os = require('os'), path = require('path');

const args = process.argv.slice(2);
const BASE = args[0] && args[0].startsWith('http') ? args.shift() : 'http://127.0.0.1:8740/v/04-11/';
const PAGES = args.length ? args : ['index', 'catalog', 'product'];
const WIDTHS = [1440, 390];
const OUT = path.join(__dirname, 'out');
fs.mkdirSync(OUT, { recursive: true });

const CHROME = ['C:/Program Files/Google/Chrome/Application/chrome.exe', '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome', '/usr/bin/google-chrome'].find(fs.existsSync);
const port = 9300 + Math.floor(Math.random() * 600);
const chrome = spawn(CHROME, ['--headless=new', '--hide-scrollbars', '--user-data-dir=' + path.join(os.tmpdir(), 'nik-audit-' + port), '--remote-debugging-port=' + port, 'about:blank'], { stdio: 'ignore' });
const wait = (ms) => new Promise((r) => setTimeout(r, ms));

// runs in the page: CSS rules as written (top-level and inside @media), and computed styles of what is on screen
const COLLECT = `(async () => {
  await document.fonts.ready;
  const rules = [];
  const walk = (list, media) => { for (const r of list) {
    if (r.type === 1) rules.push({ media, sel: r.selectorText, decl: r.style.cssText });
    else if (r.cssRules) walk(r.cssRules, r.media ? r.media.mediaText : (r.conditionText || media)); } };
  for (const s of document.styleSheets) { try { walk(s.cssRules, ''); } catch (e) {} }
  const rootVars = {};
  for (const r of rules) if (r.sel === ':root' && !r.media) for (const d of r.decl.split(';')) { const [k, ...v] = d.split(':'); if (k && k.trim().startsWith('--')) rootVars[k.trim()] = v.join(':').trim(); }

  const short = (el) => { let s = el.tagName.toLowerCase(); if (el.id) s += '#' + el.id; else if (typeof el.className === 'string' && el.className.trim()) s += '.' + el.className.trim().split(/\\s+/).slice(0, 2).join('.'); const p = el.closest('section, header, footer'); return s + (p ? '  in ' + (p.tagName.toLowerCase() + ((p.querySelector('h1, h2') || {}).textContent || '').trim().slice(0, 24).replace(/^/, ' «') + '»') : ''); };
  const visible = (el) => { const r = el.getBoundingClientRect(); const cs = getComputedStyle(el); return r.width > 0 && r.height > 0 && cs.visibility !== 'hidden' && cs.display !== 'none' && +cs.opacity > 0; };
  const type = [], colors = [], radii = [], controls = [], shadows = [], sections = [];
  for (const el of document.querySelectorAll('body *')) {
    if (!visible(el) || el.closest('model-viewer, svg')) continue;
    const cs = getComputedStyle(el);
    const ownText = [...el.childNodes].filter((n) => n.nodeType === 3).map((n) => n.textContent).join('').trim();
    if (ownText) {
      type.push({ family: cs.fontFamily.split(',')[0].replace(/"/g, ''), size: cs.fontSize, weight: cs.fontWeight, lh: cs.lineHeight, ls: cs.letterSpacing, tt: cs.textTransform, color: cs.color, text: ownText.slice(0, 40), where: short(el) });
      colors.push({ kind: 'text', value: cs.color, where: short(el) });
    }
    if (cs.backgroundColor !== 'rgba(0, 0, 0, 0)') colors.push({ kind: 'background', value: cs.backgroundColor, where: short(el) });
    for (const side of ['Top']) if (parseFloat(cs['border' + side + 'Width']) > 0 && cs['border' + side + 'Style'] !== 'none') colors.push({ kind: 'border', value: cs['border' + side + 'Color'] + ' ' + cs['border' + side + 'Width'], where: short(el) });
    if (cs.boxShadow !== 'none') { shadows.push({ value: cs.boxShadow, where: short(el) }); const m = cs.boxShadow.match(/(rgba?\\([^)]*\\)) 0px 0px 0px ([\\d.]+px) inset/); if (m) colors.push({ kind: 'line (inset shadow)', value: m[1] + ' ' + m[2], where: short(el) }); }
    if (cs.borderTopLeftRadius !== '0px') radii.push({ value: cs.borderTopLeftRadius, where: short(el) });
    if (el.matches('button, a.btn, .btn, select, input:not([type=checkbox]):not([type=radio]), textarea, [role=tab]')) { const r = el.getBoundingClientRect(); controls.push({ kind: el.tagName.toLowerCase() + (el.getAttribute('role') ? '[' + el.getAttribute('role') + ']' : ''), h: Math.round(r.height), radius: cs.borderTopLeftRadius, font: cs.fontSize + '/' + cs.fontWeight, pad: cs.paddingLeft + ' ' + cs.paddingRight, text: (el.textContent || el.value || el.placeholder || el.getAttribute('aria-label') || '').trim().slice(0, 30), where: short(el) }); }
    if (el.matches('section, header, footer, main > *') && el.parentElement.closest('section, header, footer') === null) sections.push({ where: short(el), padTop: cs.paddingTop, padBottom: cs.paddingBottom, bg: cs.backgroundColor !== 'rgba(0, 0, 0, 0)' ? cs.backgroundColor : cs.backgroundImage !== 'none' ? 'gradient' : 'none' });
  }
  const wrap = document.querySelector('.wrap'); const wcs = wrap && getComputedStyle(wrap);
  return { rules, rootVars, type, colors, radii, controls, shadows, sections, container: wrap ? { maxWidth: wcs.maxWidth, width: Math.round(wrap.getBoundingClientRect().width), pad: wcs.paddingLeft } : null };
})()`;

(async () => {
  let tabs;
  for (let i = 0; i < 50 && !tabs; i++) { await wait(200); tabs = await fetch(`http://127.0.0.1:${port}/json`).then((r) => r.json()).catch(() => null); }
  const ws = new WebSocket(tabs.find((t) => t.type === 'page').webSocketDebuggerUrl);
  await new Promise((r) => (ws.onopen = r));
  let id = 0; const pending = {};
  ws.onmessage = (m) => { const d = JSON.parse(m.data); if (pending[d.id]) { pending[d.id](d.result); delete pending[d.id]; } };
  const send = (method, params = {}) => new Promise((r) => { pending[++id] = r; ws.send(JSON.stringify({ id, method, params })); });

  const data = {};
  for (const page of PAGES) for (const w of WIDTHS) {
    await send('Emulation.setDeviceMetricsOverride', { width: w, height: 1000, deviceScaleFactor: 1, mobile: false });
    await send('Page.navigate', { url: BASE + page + '.html' });
    await wait(3500);
    const r = await send('Runtime.evaluate', { expression: COLLECT, awaitPromise: true, returnByValue: true });
    if (r.exceptionDetails) throw new Error(page + ': ' + (r.exceptionDetails.exception?.description || r.exceptionDetails.text));
    data[page + '@' + w] = r.result.value;
  }
  fs.writeFileSync(path.join(OUT, 'audit.json'), JSON.stringify(data, null, 1));

  // ---------- 1. CSS drift between pages ----------
  const at = (p) => data[p + '@1440'];
  console.log('########## 1. CSS DRIFT BETWEEN PAGES (each page carries its own CSS)');
  const vars = {}; for (const p of PAGES) for (const [k, v] of Object.entries(at(p).rootVars)) (vars[k] = vars[k] || {})[p] = v;
  const varDiff = Object.entries(vars).filter(([, v]) => new Set(Object.values(v)).size > 1 || Object.keys(v).length < PAGES.length);
  console.log(`\n:root variables: ${Object.keys(vars).length} in total, ${varDiff.length} differ or are missing on some page`);
  varDiff.forEach(([k, v]) => console.log(`  ${k.padEnd(10)} ` + PAGES.map((p) => `${p}: ${v[p] || '—'}`).join(' | ')));
  // final effective declarations per selector+media (later rules win), compared across pages
  const eff = (p) => { const m = {}; for (const r of at(p).rules) { const key = (r.media ? '@media ' + r.media + ' ' : '') + r.sel; m[key] = Object.assign(m[key] || {}, Object.fromEntries(r.decl.split(';').map((d) => d.split(/:(.*)/s).map((x) => x && x.trim())).filter((d) => d[0]))); } return m; };
  const E = Object.fromEntries(PAGES.map((p) => [p, eff(p)]));
  const shared = Object.keys(E[PAGES[0]]).filter((k) => PAGES.every((p) => E[p][k]));
  const drift = [];
  for (const k of shared) {
    const props = new Set(PAGES.flatMap((p) => Object.keys(E[p][k])));
    const diffs = [...props].filter((pr) => new Set(PAGES.map((p) => E[p][k][pr] || '—')).size > 1);
    if (diffs.length) drift.push({ sel: k, diffs: diffs.map((pr) => pr + ': ' + PAGES.map((p) => p + '=' + (E[p][k][pr] || '—')).join(', ')) });
  }
  console.log(`\nselectors on all ${PAGES.length} pages: ${shared.length}; with different values: ${drift.length}`);
  drift.forEach((d) => { console.log('  ' + d.sel); d.diffs.slice(0, 6).forEach((x) => console.log('      ' + x)); if (d.diffs.length > 6) console.log(`      … +${d.diffs.length - 6} more`); });

  // ---------- 2. rendered inventory ----------
  const group = (items, key) => { const g = {}; for (const it of items) { const k = key(it); (g[k] = g[k] || { n: 0, where: new Set(), ex: it }).n++; g[k].where.add(it.page); } return Object.entries(g).sort((a, b) => b[1].n - a[1].n); };
  const all = (field) => Object.entries(data).flatMap(([k, v]) => v[field].map((x) => ({ ...x, page: k })));
  console.log('\n########## 2. WHAT THE PAGES RENDER (1440 + 390 px)');
  const T = group(all('type'), (t) => `${t.family} ${t.size}/${t.weight} lh ${t.lh} ls ${t.ls}${t.tt !== 'none' ? ' ' + t.tt : ''}`);
  console.log(`\ntype styles: ${T.length} distinct (family size/weight, line-height, letter-spacing)`);
  T.forEach(([k, g]) => console.log(`  ${String(g.n).padStart(4)}×  ${k.padEnd(62)} «${g.ex.text.slice(0, 26)}»  ${[...g.where].join(' ')}`));
  const sizes = group(all('type'), (t) => t.family + ' ' + t.size);
  console.log(`\nfont sizes per family: ` + [...new Set(all('type').map((t) => t.family))].map((f) => f + ': ' + [...new Set(all('type').filter((t) => t.family === f).map((t) => parseFloat(t.size)))].sort((a, b) => a - b).join(', ')).join('  |  '));
  for (const kind of ['text', 'background', 'border', 'line (inset shadow)']) {
    const C = group(all('colors').filter((c) => c.kind === kind), (c) => c.value);
    console.log(`\n${kind} colours: ${C.length} distinct`);
    C.forEach(([k, g]) => console.log(`  ${String(g.n).padStart(4)}×  ${k.padEnd(40)} e.g. ${g.ex.where.slice(0, 60)}`));
  }
  const R = group(all('radii'), (r) => r.value);
  console.log(`\ncorner radii: ${R.length} distinct — ` + R.map(([k, g]) => `${k} ×${g.n}`).join(', '));
  const H = group(all('controls'), (c) => `${c.kind} h${c.h} r${c.radius} ${c.font}`);
  console.log(`\ncontrols (height, radius, font): ${H.length} distinct`);
  H.forEach(([k, g]) => console.log(`  ${String(g.n).padStart(4)}×  ${k.padEnd(40)} «${g.ex.text}»  ${g.ex.where.slice(0, 50)}  ${[...g.where].join(' ')}`));
  const S = group(all('shadows'), (s) => s.value);
  console.log(`\nshadows: ${S.length} distinct`);
  S.forEach(([k, g]) => console.log(`  ${String(g.n).padStart(4)}×  ${k.slice(0, 110)}`));
  console.log('\nsection spacing (padding top / bottom):');
  for (const [k, v] of Object.entries(data)) console.log(`  ${k.padEnd(14)} ` + [...new Set(v.sections.map((s) => s.padTop + '/' + s.padBottom))].join('  ') + `   container ${v.container ? v.container.width + 'px, side padding ' + v.container.pad : '—'}`);
  ws.close(); chrome.kill(); process.exit(0);
})().catch((e) => { console.error(e); chrome.kill(); process.exit(1); });
