// One element as it is now and in several variants, side by side with a label over each — for choosing between options.
//   node tools-for-ai/variants.cjs <width> <url> <out name> <selector> --v "<label>=<css>" [--v ...] [--js "<js for all>"] [--zoom 1] [--pad 0]
// Writes tools-for-ai/out/variants-<out name>.png; the first panel is «Зараз» (no extra CSS). The cookie panel is hidden
// unless the selector is the cookie panel. Nothing in the page files changes.
const { spawn } = require('child_process'), fs = require('fs'), os = require('os'), path = require('path');

const args = process.argv.slice(2), opt = (k, d) => { const i = args.indexOf(k); if (i < 0) return d; const v = args[i + 1]; args.splice(i, 2); return v; };
const variants = [['Зараз', '']];
for (let i; (i = args.indexOf('--v')) >= 0;) { const s = args.splice(i, 2)[1], k = s.indexOf('='); variants.push([s.slice(0, k), s.slice(k + 1)]); }
const zoom = +opt('--zoom', 1), pad = +opt('--pad', 0), js = opt('--js', '');
const [width, url, name, sel] = args;
const W = +width;
const OUT = path.join(__dirname, 'out');
fs.mkdirSync(OUT, { recursive: true });
const CHROME = ['C:/Program Files/Google/Chrome/Application/chrome.exe', '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome', '/usr/bin/google-chrome'].find(fs.existsSync);
const port = 9300 + Math.floor(Math.random() * 600);
const chrome = spawn(CHROME, ['--headless=new', '--hide-scrollbars', '--user-data-dir=' + path.join(os.tmpdir(), 'nik-variants-' + port), '--remote-debugging-port=' + port, 'about:blank'], { stdio: 'ignore' });
const wait = (ms) => new Promise((r) => setTimeout(r, ms));

(async () => {
  let tabs;
  for (let i = 0; i < 50 && !tabs; i++) { await wait(200); tabs = await fetch(`http://127.0.0.1:${port}/json`).then((r) => r.json()).catch(() => null); }
  const ws = new WebSocket(tabs.find((t) => t.type === 'page').webSocketDebuggerUrl);
  await new Promise((r) => (ws.onopen = r));
  let id = 0; const pending = {};
  ws.onmessage = (m) => { const d = JSON.parse(m.data); if (pending[d.id]) { pending[d.id](d.result); delete pending[d.id]; } };
  const send = (method, params = {}) => new Promise((r) => { pending[++id] = r; ws.send(JSON.stringify({ id, method, params })); });
  const evaluate = async (e) => (await send('Runtime.evaluate', { expression: e, awaitPromise: true, returnByValue: true })).result.value;
  await send('Emulation.setDeviceMetricsOverride', { width: W, height: 900, deviceScaleFactor: 1, mobile: W < 600 });
  await send('Emulation.setEmulatedMedia', { features: [{ name: 'prefers-reduced-motion', value: 'reduce' }] });

  const shots = [];
  for (const [label, css] of variants) {
    await send('Page.navigate', { url });
    await wait(3500);
    const hideCookie = sel.includes('cookie') ? '' : '.cookie{display:none!important}';
    const box = await evaluate(`(async () => {
      const s = document.createElement('style'); s.textContent = '*,*::before,*::after{transition:none!important;animation:none!important}' + ${JSON.stringify(hideCookie + css)}; document.head.appendChild(s); ${js}
      await document.fonts.ready;
      const e = [...document.querySelectorAll(${JSON.stringify(sel)})].find((x) => x.offsetWidth);
      if (!e) return null;
      e.scrollIntoView({ block: 'center' });
      await new Promise((r) => setTimeout(r, 300));
      const r = e.getBoundingClientRect();
      return { x: r.x, y: r.y, w: r.width, h: r.height, sy: scrollY };
    })()`);
    if (!box) throw new Error('not found: ' + sel + ' in «' + label + '»');
    const clip = { x: Math.max(0, box.x - pad), y: box.y + box.sy - pad, width: Math.min(box.w + pad * 2, W), height: box.h + pad * 2, scale: zoom };
    shots.push([label, (await send('Page.captureScreenshot', { format: 'png', captureBeyondViewport: true, clip })).data]);
  }
  await send('Page.navigate', { url: 'about:blank' });
  await wait(200);
  const png = await evaluate(`(async () => {
    const load = (d) => new Promise((r) => { const i = new Image(); i.onload = () => r(i); i.src = 'data:image/png;base64,' + d; });
    const items = ${JSON.stringify(shots)}, imgs = await Promise.all(items.map(([, d]) => load(d)));
    const gap = 24, head = 44, w = imgs.reduce((s, i) => s + i.width, 0) + gap * (imgs.length - 1), h = head + Math.max(...imgs.map((i) => i.height));
    const c = new OffscreenCanvas(w, h), g = c.getContext('2d');
    g.fillStyle = '#ffffff'; g.fillRect(0, 0, w, h);
    let x = 0;
    imgs.forEach((img, k) => {
      g.fillStyle = '#13385d'; g.font = '600 20px sans-serif'; g.textBaseline = 'middle'; g.fillText(items[k][0], x + 4, head / 2);
      g.drawImage(img, x, head);
      if (k < imgs.length - 1) { g.fillStyle = '#ff00ff'; g.fillRect(x + img.width + gap / 2 - 2, 0, 4, h); }
      x += img.width + gap;
    });
    const u = new Uint8Array(await (await c.convertToBlob({ type: 'image/png' })).arrayBuffer()); let s = ''; for (let i = 0; i < u.length; i += 0x8000) s += String.fromCharCode.apply(null, u.subarray(i, i + 0x8000)); return btoa(s);
  })()`);
  const file = path.join(OUT, `variants-${name}.png`);
  fs.writeFileSync(file, Buffer.from(png, 'base64'));
  console.log(path.relative(process.cwd(), file));
  ws.close(); chrome.kill(); process.exit(0);
})().catch((e) => { console.error(e.message || e); chrome.kill(); process.exit(1); });
