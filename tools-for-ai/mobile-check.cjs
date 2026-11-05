// Mobile problems on the built pages, as a phone sees them (touch, mobile viewport).
//   node tools-for-ai/mobile-check.cjs [base url] [--widths 320,360,390] [--shots] [pages...]
//   default: http://127.0.0.1:8740/v/04-11/ index catalog product
// Per page and width it lists:
//   overflow  — the page scrolls sideways, or something sticks out of the screen (not inside a sideways scroller)
//   clipped   — text cut off by its box (overflow hidden / ellipsis)
//   tap       — links and buttons smaller than 44 px (inline links in text: smaller than 24 px)
//   zoom      — fields with text under 16 px (iPhone zooms the page when they get focus)
//   tiny      — text under 12 px
//   edge      — text closer than 16 px to the screen edge (not inside a sideways scroller)
//   overlap   — two pieces of text on top of each other
// --shots saves every top-level part of each page as tools-for-ai/out/mob/<page>-<width>-<nn>.png
// --click "<selector>" taps that element first (e.g. the burger, the filter button), checks that state and saves the
//   screen as tools-for-ai/out/mob/<page>-<width>-click.png; --cookie keeps the cookie panel (hidden otherwise)
// --eval "<js>" only prints what that expression returns on each page and width (for measuring), no checks
const { spawn } = require('child_process'), fs = require('fs'), os = require('os'), path = require('path');

const args = process.argv.slice(2), opt = (k, d) => { const i = args.indexOf(k); return i < 0 ? d : args.splice(i, 2)[1]; };
const SHOTS = args.includes('--shots') && args.splice(args.indexOf('--shots'), 1);
const COOKIE = args.includes('--cookie') && args.splice(args.indexOf('--cookie'), 1);
const CLICK = opt('--click', null), EVAL = opt('--eval', null);
const WIDTHS = opt('--widths', '320,360,390').split(',').map(Number);
const BASE = args[0] && args[0].startsWith('http') ? args.shift() : 'http://127.0.0.1:8740/v/04-11/';
const PAGES = args.length ? args : ['index', 'catalog', 'product'];
const OUT = path.join(__dirname, 'out');
fs.mkdirSync(OUT, { recursive: true });
const CHROME = ['C:/Program Files/Google/Chrome/Application/chrome.exe', '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome', '/usr/bin/google-chrome'].find(fs.existsSync);
const port = 9300 + Math.floor(Math.random() * 600);
const chrome = spawn(CHROME, ['--headless=new', '--hide-scrollbars', '--user-data-dir=' + path.join(os.tmpdir(), 'nik-mobile-' + port), '--remote-debugging-port=' + port, 'about:blank'], { stdio: 'ignore' });
const wait = (ms) => new Promise((r) => setTimeout(r, ms));

const CHECK = `(async () => {
  await document.fonts.ready;
  const k = document.querySelector('.cookie'); if (k && !${!!COOKIE}) k.style.display = 'none';
  const W = innerWidth, out = [];
  const name = (el) => { let s = el.tagName.toLowerCase(); if (el.id) s += '#' + el.id; else if (typeof el.className === 'string' && el.className.trim()) s += '.' + el.className.trim().split(/\\s+/).slice(0, 2).join('.');
    const p = el.closest('section, header, footer, nav.mnav'); return s + (p ? ' in ' + p.tagName.toLowerCase() + ' «' + ((p.querySelector('h1, h2') || {}).textContent || p.className || '').trim().slice(0, 22) + '»' : ''); };
  const vis = (el) => { const r = el.getBoundingClientRect(), cs = getComputedStyle(el); return r.width > 0 && r.height > 0 && cs.visibility !== 'hidden' && +cs.opacity > 0 && !el.closest('[aria-hidden=true], [hidden], .sr'); };
  const own = (el) => [...el.childNodes].filter((n) => n.nodeType === 3).map((n) => n.textContent).join('').trim();
  // inside something that scrolls sideways or clips (a carousel, a marquee): the screen edge does not apply
  const scroller = (el) => { for (let p = el.parentElement; p && p !== document.body; p = p.parentElement) { const o = getComputedStyle(p).overflowX; if (o !== 'visible') return p; } return null; };
  const add = (kind, el, note) => out.push({ kind, where: name(el), text: (own(el) || el.getAttribute('aria-label') || el.placeholder || '').slice(0, 30), note, y: Math.round(el.getBoundingClientRect().top + scrollY) });
  const de = document.documentElement;
  if (de.scrollWidth > W + 1) out.push({ kind: 'overflow', where: 'page', text: '', note: 'page is ' + de.scrollWidth + ' px wide on a ' + W + ' px screen', y: 0 });
  const all = [...document.querySelectorAll('body *')].filter((el) => !el.closest('svg, model-viewer, script, style') && vis(el));
  const sticking = [];
  for (const el of all) {
    const r = el.getBoundingClientRect(), cs = getComputedStyle(el), text = own(el), sc = scroller(el);
    if ((r.right > W + 1 || r.left < -1) && !sc && cs.position !== 'fixed' && !sticking.some((s) => s.contains(el))) { sticking.push(el); add('overflow', el, 'x ' + Math.round(r.left) + '…' + Math.round(r.right)); }
    if (text && /hidden|clip/.test(cs.overflowX + cs.overflowY) && (el.scrollWidth > el.clientWidth + 1 || el.scrollHeight > el.clientHeight + 2)) add('clipped', el, 'content ' + el.scrollWidth + '×' + el.scrollHeight + ' in ' + el.clientWidth + '×' + el.clientHeight);
    if (text && cs.textOverflow === 'ellipsis' && el.scrollWidth > el.clientWidth + 1) add('clipped', el, 'ellipsis');
    if (el.matches('a[href], button, input:not([type=hidden]), select, textarea, summary, [role=button], [role=tab], [onclick]') && !el.parentElement.closest('a[href], button')) {
      const inline = cs.display === 'inline' && el.closest('p, li, small, span.hint, label');
      const box = el.matches('input[type=checkbox], input[type=radio]') && el.closest('label') ? el.closest('label').getBoundingClientRect() : r;
      const min = inline ? 24 : 44;
      if (Math.round(box.height) < min || Math.round(box.width) < Math.min(min, 44)) add('tap', el, Math.round(box.width) + '×' + Math.round(box.height) + (inline ? ' (inline link)' : ''));
    }
    if (el.matches('input:not([type=checkbox]):not([type=radio]):not([type=hidden]), select, textarea') && parseFloat(cs.fontSize) < 16) add('zoom', el, 'font ' + cs.fontSize);
    if (text && parseFloat(cs.fontSize) < 12 && parseFloat(cs.fontSize) > 0) add('tiny', el, 'font ' + cs.fontSize);
    if (text && !sc && cs.position !== 'fixed' && (r.left < 15.5 || r.right > W - 15.5)) {
      const rg = document.createRange(); rg.selectNodeContents(el); const t = rg.getBoundingClientRect();
      if (t.width && (t.left < 15.5 || t.right > W - 15.5)) add('edge', el, 'text x ' + Math.round(t.left) + '…' + Math.round(t.right));
    }
  }
  // text on text: boxes of the text itself (not the element) that intersect
  const texts = all.filter((el) => own(el)).map((el) => { const rg = document.createRange(); rg.selectNodeContents(el); return { el, rects: [...rg.getClientRects()].filter((q) => q.width > 1 && q.height > 1) }; });
  for (let i = 0; i < texts.length; i++) for (let j = i + 1; j < texts.length; j++) {
    const a = texts[i], b = texts[j]; if (a.el.contains(b.el) || b.el.contains(a.el)) continue;
    const hit = a.rects.some((p) => b.rects.some((q) => Math.min(p.right, q.right) - Math.max(p.left, q.left) > 2 && Math.min(p.bottom, q.bottom) - Math.max(p.top, q.top) > 3));
    if (hit) add('overlap', a.el, 'on ' + name(b.el) + ' «' + own(b.el).slice(0, 20) + '»');
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
  await send('Emulation.setTouchEmulationEnabled', { enabled: true, maxTouchPoints: 5 });
  await send('Emulation.setEmulatedMedia', { features: [{ name: 'prefers-reduced-motion', value: 'reduce' }] });

  const report = {};
  for (const page of PAGES) for (const w of WIDTHS) {
    await send('Emulation.setDeviceMetricsOverride', { width: w, height: 844, deviceScaleFactor: 1, mobile: true });
    await send('Page.navigate', { url: BASE + page + '.html' });
    await wait(3500);
    if (CLICK) {
      const ok = (await send('Runtime.evaluate', { returnByValue: true, expression: `(() => { const e = [...document.querySelectorAll(${JSON.stringify(CLICK)})].find((x) => x.offsetWidth); if (e) e.click(); return !!e; })()` })).result.value;
      if (!ok) { console.log(`! ${page}@${w}: nothing to tap for ${CLICK}`); continue; }
      await wait(900);
    }
    if (EVAL) {
      const v = await send('Runtime.evaluate', { expression: `(async () => { await document.fonts.ready; return (${EVAL}); })()`, awaitPromise: true, returnByValue: true });
      console.log(`${page}@${w}: ` + JSON.stringify(v.exceptionDetails ? v.exceptionDetails.exception?.description : v.result.value));
      continue;
    }
    const r = await send('Runtime.evaluate', { expression: CHECK, awaitPromise: true, returnByValue: true });
    if (r.exceptionDetails) throw new Error(page + ': ' + (r.exceptionDetails.exception?.description || r.exceptionDetails.text));
    report[page + '@' + w] = r.result.value;
    if (CLICK || COOKIE) {
      fs.mkdirSync(path.join(OUT, 'mob'), { recursive: true });
      fs.writeFileSync(path.join(OUT, 'mob', `${page}-${w}-${CLICK ? 'click' : 'cookie'}.png`), Buffer.from((await send('Page.captureScreenshot', { format: 'png' })).data, 'base64'));
    }
    if (!SHOTS) continue;
    const parts = (await send('Runtime.evaluate', { returnByValue: true, expression: `[...document.querySelectorAll('header, section, footer, main > *')].filter((e) => !e.parentElement.closest('header, section, footer') && e.getBoundingClientRect().height > 0)
      .map((e) => { const r = e.getBoundingClientRect(); return { y: Math.round(r.top + scrollY), h: Math.ceil(r.height) }; })` })).result.value;
    fs.mkdirSync(path.join(OUT, 'mob'), { recursive: true });
    for (const [n, p] of parts.entries()) {
      const shot = await send('Page.captureScreenshot', { format: 'png', captureBeyondViewport: true, clip: { x: 0, y: p.y, width: w, height: Math.min(p.h, 3000), scale: 1 } });
      fs.writeFileSync(path.join(OUT, 'mob', `${page}-${w}-${String(n).padStart(2, '0')}.png`), Buffer.from(shot.data, 'base64'));
    }
  }
  fs.writeFileSync(path.join(OUT, 'mobile-check.json'), JSON.stringify(report, null, 1));
  for (const [k, items] of Object.entries(report)) {
    console.log(`\n########## ${k} — ${items.length} finding(s)`);
    for (const kind of ['overflow', 'clipped', 'overlap', 'tap', 'zoom', 'tiny', 'edge']) for (const it of items.filter((x) => x.kind === kind))
      console.log(`  ${kind.padEnd(8)} ${it.where.slice(0, 62).padEnd(62)} «${it.text}»  ${it.note}  y${it.y}`);
  }
  ws.close(); chrome.kill(); process.exit(0);
})().catch((e) => { console.error(e); chrome.kill(); process.exit(1); });
