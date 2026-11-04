// How far capital letters sit from the vertical centre of their label, measured from font metrics (not pixels).
//   node tools-for-ai/caps-center.cjs <url> [width]      e.g. http://127.0.0.1:8740/v/04-11/catalog.html 390
// Checks every visible element whose own text is all capitals (or text-transform: uppercase) in a monospace font and
// that has a box (background, border or inset shadow). Positive = letters sit high. Also reports a ::before dot's offset
// from the letters' centre.
const { spawn } = require('child_process'), fs = require('fs'), os = require('os'), path = require('path');

const [url, width = '1440'] = process.argv.slice(2);
const CHROME = ['C:/Program Files/Google/Chrome/Application/chrome.exe', '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome', '/usr/bin/google-chrome'].find(fs.existsSync);
const port = 9300 + Math.floor(Math.random() * 600);
const chrome = spawn(CHROME, ['--headless=new', '--user-data-dir=' + path.join(os.tmpdir(), 'nik-caps-' + port), '--remote-debugging-port=' + port, 'about:blank'], { stdio: 'ignore' });
const wait = (ms) => new Promise((r) => setTimeout(r, ms));

const MEASURE = `(async () => {
  await document.fonts.ready;
  const cv = document.createElement('canvas').getContext('2d'), groups = {};
  for (const el of document.querySelectorAll('body *')) {
    const text = [...el.childNodes].filter((n) => n.nodeType === 3).map((n) => n.textContent).join('').trim();
    if (!text || !el.offsetWidth) continue;
    const cs = getComputedStyle(el);
    if (!/mono/i.test(cs.fontFamily)) continue;
    if (cs.textTransform !== 'uppercase' && text !== text.toUpperCase()) continue;
    const boxed = cs.backgroundColor !== 'rgba(0, 0, 0, 0)' || parseFloat(cs.borderTopWidth) > 0 || /inset/.test(cs.boxShadow);
    if (!boxed) continue;
    cv.font = cs.fontWeight + ' ' + cs.fontSize + ' ' + cs.fontFamily;
    const m = cv.measureText('Н'), node = [...el.childNodes].find((n) => n.nodeType === 3 && n.textContent.trim());
    const rg = document.createRange(); rg.selectNodeContents(node);
    const r = rg.getBoundingClientRect(), b = el.getBoundingClientRect();
    const top = b.top + parseFloat(cs.borderTopWidth) + parseFloat(cs.paddingTop), bottom = b.bottom - parseFloat(cs.borderBottomWidth) - parseFloat(cs.paddingBottom);
    const outerTop = b.top + parseFloat(cs.borderTopWidth), outerBottom = b.bottom - parseFloat(cs.borderBottomWidth);
    const base = r.top + m.fontBoundingBoxAscent, cap = base - m.actualBoundingBoxAscent, capMid = (cap + base) / 2;
    const off = (outerTop + outerBottom) / 2 - capMid;
    const bf = getComputedStyle(el, '::before');
    let dot = '';
    if (bf.content !== 'none' && parseFloat(bf.height) > 0) {
      // the ::before box is a flex item centred on the line; its centre equals the content box centre when align-items is center
      const dotMid = cs.alignItems === 'center' ? (top + bottom) / 2 + (parseFloat(bf.top) || 0) : NaN;
      dot = ' · dot ' + (dotMid - capMid).toFixed(2) + 'px below letters';
    }
    const sel = el.tagName.toLowerCase() + (el.className && typeof el.className === 'string' ? '.' + el.className.trim().split(/\\s+/).join('.') : '');
    const key = sel + ' (' + cs.fontSize + ', pad ' + cs.paddingTop + '/' + cs.paddingBottom + ')';
    (groups[key] = groups[key] || { n: 0, offs: new Set(), dot, sample: text.slice(0, 24) }).n++;
    groups[key].offs.add(off.toFixed(2));
  }
  return Object.entries(groups).map(([k, g]) => ({ k, n: g.n, offs: [...g.offs], dot: g.dot, sample: g.sample }));
})()`;

(async () => {
  let tabs;
  for (let i = 0; i < 50 && !tabs; i++) { await wait(200); tabs = await fetch(`http://127.0.0.1:${port}/json`).then((r) => r.json()).catch(() => null); }
  const ws = new WebSocket(tabs.find((t) => t.type === 'page').webSocketDebuggerUrl);
  await new Promise((r) => (ws.onopen = r));
  let id = 0; const pending = {};
  ws.onmessage = (m) => { const d = JSON.parse(m.data); if (pending[d.id]) { pending[d.id](d.result); delete pending[d.id]; } };
  const send = (method, params = {}) => new Promise((r) => { pending[++id] = r; ws.send(JSON.stringify({ id, method, params })); });
  await send('Emulation.setDeviceMetricsOverride', { width: +width, height: 1000, deviceScaleFactor: 1, mobile: false });
  await send('Page.navigate', { url });
  await wait(3500);
  const r = await send('Runtime.evaluate', { expression: MEASURE, awaitPromise: true, returnByValue: true });
  if (r.exceptionDetails) throw new Error(r.exceptionDetails.exception?.description || r.exceptionDetails.text);
  for (const g of r.result.value) console.log(`${g.offs.map((o) => (o > 0 ? '+' : '') + o).join('/').padStart(7)}px  ${g.k}  ×${g.n}  «${g.sample}»${g.dot}`);
  ws.close(); chrome.kill(); process.exit(0);
})().catch((e) => { console.error(e); chrome.kill(); process.exit(1); });
