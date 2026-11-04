// Screenshot two pages under the same conditions (fonts loaded, animations off) and diff them pixel by pixel in Chrome.
//   node tools-for-ai/compare.cjs <width> <urlA> <urlB> [--sections] [--css "<css for both>"] [--prep-a "<js for A>"] [--skip "<selector>"]
// Whole page by default; --sections compares header, each section and footer separately, so a section of a different
// height does not shift everything below it. Crops of differences go to tools-for-ai/out/ (A left, B right).
const { spawn } = require('child_process'), fs = require('fs'), os = require('os'), path = require('path');

const args = process.argv.slice(2), opt = (k) => { const i = args.indexOf(k); return i < 0 ? null : args.splice(i, 2)[1]; };
const sections = args.includes('--sections') && args.splice(args.indexOf('--sections'), 1);
const css = opt('--css') || '', prepA = opt('--prep-a'), skip = opt('--skip');
const [width, urlA, urlB] = args, W = +width;
const OUT = path.join(__dirname, 'out');
fs.mkdirSync(OUT, { recursive: true });

const CHROME = ['C:/Program Files/Google/Chrome/Application/chrome.exe', '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome', '/usr/bin/google-chrome'].find(fs.existsSync);
const port = 9300 + Math.floor(Math.random() * 600);
const chrome = spawn(CHROME, ['--headless=new', '--hide-scrollbars', '--user-data-dir=' + path.join(os.tmpdir(), 'nik-compare-' + port), '--remote-debugging-port=' + port, 'about:blank'], { stdio: 'ignore' });
const wait = (ms) => new Promise((r) => setTimeout(r, ms));
const FREEZE = '*,*::before,*::after{animation:none!important;transition:none!important;caret-color:transparent!important}';
// header, footer and every top-level section, in page order
const PARTS = `[...document.querySelectorAll('header, section, footer')].filter((e) => !e.parentElement.closest('header, section, footer'))`;

(async () => {
  let tabs;
  for (let i = 0; i < 50 && !tabs; i++) { await wait(200); tabs = await fetch(`http://127.0.0.1:${port}/json`).then((r) => r.json()).catch(() => null); }
  const ws = new WebSocket(tabs.find((t) => t.type === 'page').webSocketDebuggerUrl);
  await new Promise((r) => (ws.onopen = r));
  let id = 0; const pending = {};
  ws.onmessage = (m) => { const d = JSON.parse(m.data); if (pending[d.id]) { pending[d.id](d.result || d); delete pending[d.id]; } };
  const send = (method, params = {}) => new Promise((r) => { pending[++id] = r; ws.send(JSON.stringify({ id, method, params })); });
  const evaluate = async (expr) => (await send('Runtime.evaluate', { expression: expr, awaitPromise: true, returnByValue: true })).result.value;
  await send('Page.enable');
  await send('Emulation.setEmulatedMedia', { features: [{ name: 'prefers-reduced-motion', value: 'reduce' }] });

  async function load(url, prep) {
    await send('Emulation.setDeviceMetricsOverride', { width: W, height: 1000, deviceScaleFactor: 1, mobile: false });
    await send('Page.navigate', { url });
    await wait(4000);
    if (prep) await evaluate(prep);
    await evaluate(`(async () => { const s = document.createElement('style'); s.textContent = ${JSON.stringify(FREEZE + css)}; document.head.appendChild(s);
      document.querySelectorAll('img').forEach((i) => (i.loading = 'eager'));
      await document.fonts.ready; await Promise.all([...document.images].map((i) => i.complete ? 0 : new Promise((r) => { i.onload = i.onerror = r; }))); })()`);
    const h = await evaluate('Math.ceil(document.documentElement.scrollHeight)');
    await send('Emulation.setDeviceMetricsOverride', { width: W, height: h, deviceScaleFactor: 1, mobile: false });
    await wait(1500);
    const parts = sections ? await evaluate(`${PARTS}.map((e) => { const r = e.getBoundingClientRect(); return { name: e.tagName.toLowerCase() + (e.id ? '#' + e.id : '') + ' ' + ((e.querySelector('h1, h2') || {}).textContent || e.className || '').trim().slice(0, 40), y: Math.round(r.top + scrollY), h: Math.round(r.height), skip: ${skip ? `!!e.matches(${JSON.stringify(skip)}) || !!e.querySelector(${JSON.stringify(skip)})` : 'false'} }; })`) : [{ name: 'page', y: 0, h, skip: false }];
    return { png: (await send('Page.captureScreenshot', { format: 'png' })).data, h, parts };
  }

  const a = await load(urlA, prepA), b = await load(urlB);
  if (a.parts.length !== b.parts.length) console.log(`! different number of parts: A ${a.parts.length}, B ${b.parts.length}`);
  await send('Emulation.setDeviceMetricsOverride', { width: 800, height: 600, deviceScaleFactor: 1, mobile: false });
  await send('Page.navigate', { url: 'about:blank' });
  await wait(300);
  const result = await evaluate(`(async () => {
    const load = (d) => new Promise((r) => { const i = new Image(); i.onload = () => r(i); i.src = 'data:image/png;base64,' + d; });
    const [A, B] = await Promise.all([load(${JSON.stringify(a.png)}), load(${JSON.stringify(b.png)})]);
    const pa = ${JSON.stringify(a.parts)}, pb = ${JSON.stringify(b.parts)}, out = [];
    const b64 = async (c) => { const u = new Uint8Array(await (await c.convertToBlob({ type: 'image/png' })).arrayBuffer()); let s = ''; for (let i = 0; i < u.length; i += 0x8000) s += String.fromCharCode.apply(null, u.subarray(i, i + 0x8000)); return btoa(s); };
    for (let k = 0; k < Math.max(pa.length, pb.length); k++) {
      const x = pa[k], y = pb[k];
      if (!x || !y) { out.push({ name: (x || y).name, note: 'missing in ' + (x ? 'B' : 'A') }); continue; }
      if (x.skip || y.skip) { out.push({ name: y.name, note: 'skipped' }); continue; }
      const w = ${W}, h = Math.max(x.h, y.h), px = (img, p) => { const c = new OffscreenCanvas(w, h), g = c.getContext('2d'); g.fillStyle = '#ff00ff'; g.fillRect(0, 0, w, h); g.drawImage(img, 0, p.y, w, p.h, 0, 0, w, p.h); return c; };
      const ca = px(A, x), cb = px(B, y), da = ca.getContext('2d').getImageData(0, 0, w, h).data, db = cb.getContext('2d').getImageData(0, 0, w, h).data;
      let n = 0, top = h, bot = -1;
      for (let i = 0; i < da.length; i += 4) if (Math.abs(da[i] - db[i]) + Math.abs(da[i + 1] - db[i + 1]) + Math.abs(da[i + 2] - db[i + 2]) > 24) { n++; const r = Math.floor(i / 4 / w); top = Math.min(top, r); bot = r; }
      const item = { name: y.name, heightA: x.h, heightB: y.h, diffPixels: n };
      if (n) {
        const t = Math.max(0, top - 40), ch = Math.min(h, bot + 40) - t, c = new OffscreenCanvas(w * 2 + 16, ch), g = c.getContext('2d');
        g.fillStyle = '#ff00ff'; g.fillRect(0, 0, c.width, ch); g.drawImage(ca, 0, t, w, ch, 0, 0, w, ch); g.drawImage(cb, 0, t, w, ch, w + 16, 0, w, ch);
        item.rows = top + '-' + bot; item.crop = await b64(c);
      }
      out.push(item);
    }
    return out;
  })()`);
  let differ = 0;
  result.forEach((r, k) => {
    if (r.crop) { const f = path.join(OUT, `diff-${W}-${String(k).padStart(2, '0')}.png`); fs.writeFileSync(f, Buffer.from(r.crop, 'base64')); r.crop = path.relative(process.cwd(), f); differ++; }
    console.log(`${String(k).padStart(2)} ${r.name.padEnd(56)} ${r.note || (r.diffPixels ? `${r.diffPixels} px differ (rows ${r.rows}; heights ${r.heightA}/${r.heightB}) → ${r.crop}` : `identical${r.heightA !== r.heightB ? ` (heights ${r.heightA}/${r.heightB})` : ''}`)}`);
  });
  console.log(differ ? `\n${differ} part(s) differ` : '\nall compared parts identical');
  ws.close(); chrome.kill(); process.exit(0);
})().catch((e) => { console.error(e); chrome.kill(); process.exit(1); });
