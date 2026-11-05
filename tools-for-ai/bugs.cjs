// Things that are broken rather than inconsistent: JS errors, files that fail to load, and markup mistakes.
//   node tools-for-ai/bugs.cjs [base url] [--widths 1440,390] [pages...]    default: http://127.0.0.1:8740/v/04-11/ index catalog product
// Per page and width: console errors / warnings, uncaught exceptions, requests that failed or returned 4xx/5xx,
// and in the DOM: duplicate ids, references (for=, aria-labelledby, aria-controls, aria-describedby, href="#id") to ids
// that don't exist, images that didn't load or have no alt, buttons and links without a name, interactive elements
// inside interactive elements.
// --tab N  also presses Tab N times (real key presses) and lists stops where focus is invisible (no outline / shadow),
//          lands on something hidden or off-screen, or is lost; then Escape on the open burger menu.
const { spawn } = require('child_process'), fs = require('fs'), os = require('os'), path = require('path');

const args = process.argv.slice(2), opt = (k, d) => { const i = args.indexOf(k); return i < 0 ? d : args.splice(i, 2)[1]; };
const WIDTHS = opt('--widths', '1440,390').split(',').map(Number), TABS = +opt('--tab', 0);
const BASE = args[0] && args[0].startsWith('http') ? args.shift() : 'http://127.0.0.1:8740/v/04-11/';
const PAGES = args.length ? args : ['index', 'catalog', 'product'];
const CHROME = ['C:/Program Files/Google/Chrome/Application/chrome.exe', '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome', '/usr/bin/google-chrome'].find(fs.existsSync);
const port = 9300 + Math.floor(Math.random() * 600);
const chrome = spawn(CHROME, ['--headless=new', '--hide-scrollbars', '--user-data-dir=' + path.join(os.tmpdir(), 'nik-bugs-' + port), '--remote-debugging-port=' + port, 'about:blank'], { stdio: 'ignore' });
const wait = (ms) => new Promise((r) => setTimeout(r, ms));

const DOM = `(async () => {
  await document.fonts.ready;
  // scroll through the page so lazy images and the 3D model load
  for (let y = 0; y < document.documentElement.scrollHeight; y += 600) { scrollTo(0, y); await new Promise((r) => setTimeout(r, 120)); }
  await new Promise((r) => setTimeout(r, 1500)); scrollTo(0, 0);
  const out = [], name = (el) => el.tagName.toLowerCase() + (el.id ? '#' + el.id : '') + (typeof el.className === 'string' && el.className.trim() ? '.' + el.className.trim().split(/\\s+/).slice(0, 2).join('.') : '');
  const ids = {}; for (const el of document.querySelectorAll('[id]')) (ids[el.id] = ids[el.id] || []).push(el);
  for (const [id, els] of Object.entries(ids)) if (els.length > 1) out.push('duplicate id «' + id + '» ×' + els.length);
  for (const el of document.querySelectorAll('[for], [aria-labelledby], [aria-controls], [aria-describedby]'))
    for (const a of ['for', 'aria-labelledby', 'aria-controls', 'aria-describedby']) for (const id of (el.getAttribute(a) || '').split(/\\s+/).filter(Boolean))
      if (!document.getElementById(id)) out.push(a + '="' + id + '" on ' + name(el) + ' — no such id');
  for (const a of document.querySelectorAll('a[href^="#"]')) { const id = decodeURIComponent(a.getAttribute('href').slice(1)); if (id && !document.getElementById(id)) out.push('link to #' + id + ' («' + a.textContent.trim().slice(0, 30) + '») — no such id'); }
  for (const img of document.images) { if (img.closest('[hidden]')) continue;
    if (img.complete && img.naturalWidth === 0 && img.getAttribute('src')) out.push('image did not load: ' + img.getAttribute('src').slice(0, 80));
    if (!img.hasAttribute('alt')) out.push('image without alt: ' + (img.getAttribute('src') || '').slice(0, 80)); }
  for (const el of document.querySelectorAll('a[href], button')) {
    const r = el.getBoundingClientRect(); if (!r.width && !r.height) continue;
    const label = (el.getAttribute('aria-label') || el.textContent || el.title || [...el.querySelectorAll('img[alt]')].map((i) => i.alt).join('')).trim();
    if (!label && !el.getAttribute('aria-labelledby')) out.push('no accessible name: ' + name(el));
    if (el.parentElement.closest('a[href], button')) out.push('interactive inside interactive: ' + name(el) + ' in ' + name(el.parentElement.closest('a[href], button')));
  }
  const fieldsNoLabel = [...document.querySelectorAll('input:not([type=hidden]), select, textarea')].filter((f) => !f.labels?.length && !f.getAttribute('aria-label') && !f.getAttribute('aria-labelledby'));
  for (const f of fieldsNoLabel) out.push('field without label: ' + name(f));
  return out;
})()`;

(async () => {
  let tabs;
  for (let i = 0; i < 50 && !tabs; i++) { await wait(200); tabs = await fetch(`http://127.0.0.1:${port}/json`).then((r) => r.json()).catch(() => null); }
  const ws = new WebSocket(tabs.find((t) => t.type === 'page').webSocketDebuggerUrl);
  await new Promise((r) => (ws.onopen = r));
  let id = 0; const pending = {}, events = [];
  ws.onmessage = (m) => { const d = JSON.parse(m.data); if (d.id && pending[d.id]) { pending[d.id](d.result); delete pending[d.id]; } else if (d.method) events.push(d); };
  const send = (method, params = {}) => new Promise((r) => { pending[++id] = r; ws.send(JSON.stringify({ id, method, params })); });
  await send('Runtime.enable'); await send('Log.enable'); await send('Network.enable');
  await send('Emulation.setEmulatedMedia', { features: [{ name: 'prefers-reduced-motion', value: 'reduce' }] });

  for (const page of PAGES) for (const w of WIDTHS) {
    await send('Emulation.setDeviceMetricsOverride', { width: w, height: 900, deviceScaleFactor: 1, mobile: w < 600 });
    events.length = 0;
    await send('Page.navigate', { url: BASE + page + '.html' });
    await wait(4000);
    const dom = (await send('Runtime.evaluate', { expression: DOM, awaitPromise: true, returnByValue: true })).result.value || ['(DOM check failed)'];
    const found = [];
    const urls = {};
    for (const e of events) {
      if (e.method === 'Network.requestWillBeSent') urls[e.params.requestId] = e.params.request.url;
      if (e.method === 'Network.responseReceived' && e.params.response.status >= 400) found.push(`HTTP ${e.params.response.status}: ${e.params.response.url.slice(0, 100)}`);
      if (e.method === 'Network.loadingFailed' && !e.params.canceled) found.push(`failed to load (${e.params.errorText}): ${(urls[e.params.requestId] || '?').slice(0, 100)}`);
      if (e.method === 'Runtime.exceptionThrown') found.push('JS exception: ' + (e.params.exceptionDetails.exception?.description || e.params.exceptionDetails.text).split('\n')[0]);
      if (e.method === 'Runtime.consoleAPICalled' && ['error', 'warning', 'assert'].includes(e.params.type)) found.push('console.' + e.params.type + ': ' + e.params.args.map((a) => a.value ?? a.description ?? '').join(' ').slice(0, 160));
      if (e.method === 'Log.entryAdded' && ['error', 'warning'].includes(e.params.entry.level)) found.push('browser ' + e.params.entry.level + ': ' + e.params.entry.text.slice(0, 160));
    }
    if (TABS) {
      await send('Runtime.evaluate', { expression: `scrollTo(0, 0); document.activeElement && document.activeElement.blur(); const k = document.querySelector('.cookie'); if (k) k.style.display = 'none';` });
      const key = async (k, code) => { await send('Input.dispatchKeyEvent', { type: 'keyDown', key: k, code, windowsVirtualKeyCode: k === 'Tab' ? 9 : 27 }); await send('Input.dispatchKeyEvent', { type: 'keyUp', key: k, code, windowsVirtualKeyCode: k === 'Tab' ? 9 : 27 }); await wait(140); };
      for (let i = 0; i < TABS; i++) {
        await key('Tab', 'Tab');
        const s = (await send('Runtime.evaluate', { returnByValue: true, expression: `(() => { const e = document.activeElement; if (!e || e === document.body) return 'focus lost (body)';
          const n = e.tagName.toLowerCase() + (e.className && typeof e.className === 'string' ? '.' + e.className.trim().split(/\\s+/)[0] : '') + ' «' + (e.getAttribute('aria-label') || e.textContent || e.placeholder || '').trim().slice(0, 24) + '»';
          const r = e.getBoundingClientRect(), cs = getComputedStyle(e);
          let hidden = !r.width || !r.height; for (let p = e; p && !hidden; p = p.parentElement) { const c = getComputedStyle(p); if (c.visibility === 'hidden' || c.display === 'none' || +c.opacity < 0.05) hidden = true; }
          if (hidden) return 'focus on hidden element: ' + n;
          if (r.bottom < 0 || r.top > innerHeight || r.right < 0 || r.left > innerWidth) return 'focus off-screen: ' + n;
          const ring = (cs.outlineStyle !== 'none' && parseFloat(cs.outlineWidth) > 0) || cs.boxShadow !== 'none' || [...e.querySelectorAll('*')].some((c) => { const x = getComputedStyle(c); return x.outlineStyle !== 'none' && parseFloat(x.outlineWidth) > 0; });
          return ring ? '' : 'no visible focus: ' + n; })()` })).result.value;
        if (s) found.push('Tab ' + (i + 1) + ': ' + s);
      }
      const esc = (await send('Runtime.evaluate', { awaitPromise: true, returnByValue: true, expression: `(async () => { const b = document.querySelector('button.burger'); if (!b || !b.offsetWidth) return null; b.focus(); b.click(); await new Promise((r) => setTimeout(r, 500)); return !!(document.getElementById('mnav') && document.getElementById('mnav').offsetWidth); })()` })).result.value;
      if (esc) { await key('Escape', 'Escape'); await wait(400); const still = (await send('Runtime.evaluate', { returnByValue: true, expression: `!!(document.getElementById('mnav') && document.getElementById('mnav').offsetWidth)` })).result.value; if (still) found.push('Escape does not close the burger menu'); }
    }
    const all = [...new Set([...found, ...dom])];
    console.log(`\n########## ${page}@${w} — ${all.length} finding(s)`);
    all.forEach((x) => console.log('  ' + x));
  }
  ws.close(); chrome.kill(); process.exit(0);
})().catch((e) => { console.error(e); chrome.kill(); process.exit(1); });
