// Finds hover / focus states whose box-shadow list does not line up with the normal state.
//   node tools-for-ai/shadow-check.cjs [base url] [pages...]    default: http://127.0.0.1:8740/v/04-11/ index catalog product
// A transition pairs shadows by position: if the normal state is "ring, drop" and the hover is "drop, ring",
// the ring is grown out of the blurred drop shadow and only turns crisp at the end — the border seems to come late.
const { spawn } = require('child_process'), fs = require('fs'), os = require('os'), path = require('path');

const args = process.argv.slice(2);
const BASE = args[0] && args[0].startsWith('http') ? args.shift() : 'http://127.0.0.1:8740/v/04-11/';
const PAGES = args.length ? args : ['index', 'catalog', 'product'];
const CHROME = ['C:/Program Files/Google/Chrome/Application/chrome.exe', '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome', '/usr/bin/google-chrome'].find(fs.existsSync);
const port = 9300 + Math.floor(Math.random() * 600);
const chrome = spawn(CHROME, ['--headless=new', '--user-data-dir=' + path.join(os.tmpdir(), 'nik-shadow-' + port), '--remote-debugging-port=' + port, 'about:blank'], { stdio: 'ignore' });
const wait = (ms) => new Promise((r) => setTimeout(r, ms));

function scan() {
  const STATE = /:(hover|focus-within|focus-visible|focus)\b/g;
  const rules = [];
  const walk = (list, media) => { for (const r of list) { if (r.type === 1) rules.push({ sel: r.selectorText, bs: r.style.boxShadow, media }); else if (r.cssRules) walk(r.cssRules, r.media ? r.media.mediaText : media); } };
  for (const s of document.styleSheets) { try { walk(s.cssRules, ''); } catch (e) { /* cross-origin sheet */ } }
  const split = (v) => { const out = []; let d = 0, cur = ''; for (const ch of v) { if (ch === '(') d++; if (ch === ')') d--; if (ch === ',' && !d) { out.push(cur.trim()); cur = ''; } else cur += ch; } if (cur.trim()) out.push(cur.trim()); return out; };
  // ring = 0 0 0 Npx (an outline), drop = anything with offset or blur
  const kind = (s) => { const inset = /inset/.test(s); const nums = (s.replace(/rgba?\([^)]*\)|var\([^)]*\)|#[0-9a-f]+/gi, '').match(/-?[\d.]+px|(^|\s)0(?=\s|$)/g) || []).map(parseFloat); const ring = nums.length >= 4 && !nums[0] && !nums[1] && !nums[2]; return (inset ? 'inset ' : '') + (ring ? 'ring' : 'drop'); };
  const out = [];
  for (const r of rules) {
    if (!r.bs || r.bs === 'none') continue;
    for (const one of r.sel.split(',')) {
      const state = one.match(STATE);
      if (!state) continue;
      const baseSel = one.replace(STATE, '').trim();
      let el; try { el = [...document.querySelectorAll(baseSel)].find((e) => e.offsetWidth); } catch (e) { continue; }
      if (!el) continue;
      const base = getComputedStyle(el).boxShadow;
      if (base === 'none') continue;
      const a = split(base).map(kind), b = split(r.bs).map(kind);
      // fine: the same kinds at the same positions; a shadow added (or removed) at the end just fades in (or out)
      if (a.slice(0, Math.min(a.length, b.length)).every((k, i) => k === b[i])) continue;
      out.push(`${r.media ? '@media ' + r.media + '  ' : ''}${one.trim()}\n      normal: ${a.join(' + ')}   →   ${state.join('')}: ${b.join(' + ')}`);
    }
  }
  return [...new Set(out)];
}

(async () => {
  let tabs;
  for (let i = 0; i < 50 && !tabs; i++) { await wait(200); tabs = await fetch(`http://127.0.0.1:${port}/json`).then((r) => r.json()).catch(() => null); }
  const ws = new WebSocket(tabs.find((t) => t.type === 'page').webSocketDebuggerUrl);
  await new Promise((r) => (ws.onopen = r));
  let id = 0; const pending = {};
  ws.onmessage = (m) => { const d = JSON.parse(m.data); if (pending[d.id]) { pending[d.id](d.result); delete pending[d.id]; } };
  const send = (method, params = {}) => new Promise((r) => { pending[++id] = r; ws.send(JSON.stringify({ id, method, params })); });
  let total = 0;
  for (const w of [1440, 390]) for (const page of PAGES) {
    await send('Emulation.setDeviceMetricsOverride', { width: w, height: 900, deviceScaleFactor: 1, mobile: false });
    await send('Page.navigate', { url: BASE + page + '.html' });
    await wait(3000);
    const r = await send('Runtime.evaluate', { expression: `(${scan})()`, returnByValue: true });
    if (r.exceptionDetails) throw new Error(page + ': ' + (r.exceptionDetails.exception?.description || r.exceptionDetails.text));
    const found = r.result.value;
    total += found.length;
    console.log(`== ${page} @${w}: ${found.length ? found.length + ' mismatch(es)' : 'none'}`);
    found.forEach((x) => console.log('  ' + x));
  }
  console.log(total ? `\n${total} mismatch(es)` : '\nno mismatches');
  ws.close(); chrome.kill(); process.exit(0);
})().catch((e) => { console.error(e); chrome.kill(); process.exit(1); });
