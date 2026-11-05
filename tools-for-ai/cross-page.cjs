// Cross-page consistency: the homepage is the source of truth; catalog and product should render shared things the same way.
//   node tools-for-ai/cross-page.cjs [base url] [--shots]    default: http://127.0.0.1:8740/v/04-11/
// --shots also saves every top-level part (header, each section, footer) of each page as tools-for-ai/out/xp/<page>-<width>-<nn>.png
// For every element kind (tag + classes, or tag + nearest classed parent when it has no class) it collects the rendered
// style at 1440 and 390 px, then lists kinds whose style on catalog / product matches none of the homepage's variants,
// and kinds that exist only on catalog / product (new components — to compare by role, by eye).
// Writes tools-for-ai/out/cross-page.json and prints the report.
const { spawn } = require('child_process'), fs = require('fs'), os = require('os'), path = require('path');

const args = process.argv.slice(2), SHOTS = args.includes('--shots') && args.splice(args.indexOf('--shots'), 1);
const BASE = args[0] || 'http://127.0.0.1:8740/v/04-11/';
const PAGES = ['index', 'catalog', 'product'], WIDTHS = [1440, 390];
const OUT = path.join(__dirname, 'out');
fs.mkdirSync(OUT, { recursive: true });
const CHROME = ['C:/Program Files/Google/Chrome/Application/chrome.exe', '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome', '/usr/bin/google-chrome'].find(fs.existsSync);
const port = 9300 + Math.floor(Math.random() * 600);
const chrome = spawn(CHROME, ['--headless=new', '--hide-scrollbars', '--user-data-dir=' + path.join(os.tmpdir(), 'nik-cross-' + port), '--remote-debugging-port=' + port, 'about:blank'], { stdio: 'ignore' });
const wait = (ms) => new Promise((r) => setTimeout(r, ms));

const COLLECT = `(async () => {
  await document.fonts.ready;
  const STATE = /^(on|is-|active|open|sel|cur)/;
  const cls = (el) => typeof el.className === 'string' ? el.className.trim().split(/\\s+/).filter((c) => c && !STATE.test(c)).sort() : [];
  const key = (el) => { const c = cls(el); if (c.length) return el.tagName.toLowerCase() + '.' + c.join('.');
    let p = el.parentElement; while (p && p !== document.body && !cls(p).length) p = p.parentElement;
    return el.tagName.toLowerCase() + (p && p !== document.body ? ' in ' + p.tagName.toLowerCase() + '.' + cls(p).join('.') : ''); };
  const out = [];
  for (const el of document.querySelectorAll('body *')) {
    if (el.closest('svg, model-viewer, .cookie') || ['SCRIPT', 'STYLE', 'BR', 'SOURCE', 'PATH'].includes(el.tagName)) continue;
    const r = el.getBoundingClientRect(), cs = getComputedStyle(el);
    if (!r.width || !r.height || cs.visibility === 'hidden' || cs.display === 'none' || +cs.opacity === 0) continue;
    const text = [...el.childNodes].filter((n) => n.nodeType === 3).map((n) => n.textContent).join('').trim();
    const s = {};
    if (text) Object.assign(s, { font: cs.fontFamily.split(',')[0].replace(/"/g, '') + ' ' + cs.fontSize + '/' + cs.fontWeight, lh: cs.lineHeight, ls: cs.letterSpacing, tt: cs.textTransform, color: cs.color });
    if (cs.backgroundColor !== 'rgba(0, 0, 0, 0)') s.bg = cs.backgroundColor;
    if (cs.borderTopLeftRadius !== '0px') s.radius = cs.borderTopLeftRadius;
    if (cs.boxShadow !== 'none') s.shadow = cs.boxShadow;
    if (parseFloat(cs.borderTopWidth) && cs.borderTopStyle !== 'none') s.border = cs.borderTopWidth + ' ' + cs.borderTopColor;
    if (parseFloat(cs.borderBottomWidth) && cs.borderBottomStyle !== 'none') s.borderB = cs.borderBottomWidth + ' ' + cs.borderBottomColor;
    const pad = [cs.paddingTop, cs.paddingRight, cs.paddingBottom, cs.paddingLeft].join(' '); if (pad !== '0px 0px 0px 0px') s.pad = pad;
    if (r.height <= 64 && /^(A|BUTTON|INPUT|SELECT|SPAN|LABEL|I|B|EM|SMALL)$/.test(el.tagName)) s.h = Math.round(r.height) + 'px';
    if (/flex|grid/.test(cs.display) && cs.gap !== 'normal') s.gap = cs.gap;
    if (!Object.keys(s).length) continue;
    out.push({ key: key(el), s, text: (text || el.getAttribute('aria-label') || '').slice(0, 30), y: Math.round(r.top + scrollY) });
  }
  return out;
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
  for (const w of WIDTHS) for (const page of PAGES) {
    await send('Emulation.setDeviceMetricsOverride', { width: w, height: 1000, deviceScaleFactor: 1, mobile: false });
    await send('Page.navigate', { url: BASE + page + '.html' });
    await wait(3500);
    const r = await send('Runtime.evaluate', { expression: COLLECT, awaitPromise: true, returnByValue: true });
    if (r.exceptionDetails) throw new Error(page + ': ' + (r.exceptionDetails.exception?.description || r.exceptionDetails.text));
    data[page + '@' + w] = r.result.value;
    if (!SHOTS) continue;
    const parts = (await send('Runtime.evaluate', { returnByValue: true, expression: `(() => { const k = document.querySelector('.cookie'); if (k) k.style.display = 'none';
      return [...document.querySelectorAll('header, section, footer, main > *')].filter((e) => !e.parentElement.closest('header, section, footer') && e.getBoundingClientRect().height > 0)
        .map((e) => { const r = e.getBoundingClientRect(); return { y: Math.round(r.top + scrollY), h: Math.ceil(r.height) }; }); })()` })).result.value;
    fs.mkdirSync(path.join(OUT, 'xp'), { recursive: true });
    for (const [n, p] of parts.entries()) {
      const shot = await send('Page.captureScreenshot', { format: 'png', captureBeyondViewport: true, clip: { x: 0, y: p.y, width: w, height: Math.min(p.h, 2400), scale: 1 } });
      fs.writeFileSync(path.join(OUT, 'xp', `${page}-${w}-${String(n).padStart(2, '0')}.png`), Buffer.from(shot.data, 'base64'));
    }
  }
  fs.writeFileSync(path.join(OUT, 'cross-page.json'), JSON.stringify(data, null, 1));

  const sig = (s) => JSON.stringify(Object.keys(s).sort().map((k) => [k, s[k]]));
  for (const w of WIDTHS) {
    const byKey = {};
    for (const p of PAGES) for (const e of data[p + '@' + w]) {
      const k = (byKey[e.key] = byKey[e.key] || {}); const v = (k[p] = k[p] || {}); const g = sig(e.s);
      (v[g] = v[g] || { n: 0, s: e.s, text: e.text, y: e.y }).n++;
    }
    console.log(`\n########## ${w}px — shared kinds that render differently from the homepage`);
    const onlyNew = [];
    for (const [k, v] of Object.entries(byKey).sort()) {
      if (!v.index) { onlyNew.push([k, v]); continue; }
      for (const p of PAGES.slice(1)) for (const [g, x] of Object.entries(v[p] || {})) {
        if (v.index[g]) continue;
        // closest homepage variant: the one with the fewest differing properties
        const diff = (a, b) => [...new Set([...Object.keys(a), ...Object.keys(b)])].filter((q) => a[q] !== b[q]);
        const best = Object.values(v.index).map((h) => ({ h, d: diff(h.s, x.s) })).sort((a, b) => a.d.length - b.d.length)[0];
        console.log(`  ${k}   [${p} ×${x.n} «${x.text}» y${x.y}]`);
        for (const q of best.d) console.log(`      ${q.padEnd(7)} home: ${best.h.s[q] || '—'}   ${p}: ${x.s[q] || '—'}`);
      }
    }
    console.log(`\n---------- ${w}px — kinds only on catalog / product (${onlyNew.length})`);
    for (const [k, v] of onlyNew) for (const p of PAGES.slice(1)) for (const x of Object.values(v[p] || {}))
      console.log(`  ${k.padEnd(44)} ${p.padEnd(8)} ×${x.n}  ${Object.entries(x.s).map(([a, b]) => a + ' ' + b).join(' · ').slice(0, 170)}  «${x.text}»`);
  }
  ws.close(); chrome.kill(); process.exit(0);
})().catch((e) => { console.error(e); chrome.kill(); process.exit(1); });
