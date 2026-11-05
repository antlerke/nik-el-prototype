// The same element before (A) and after (B), side by side and zoomed — for reviewing a small visual change.
//   node tools-for-ai/pair.cjs <width> <urlA> <urlB> <out name> <selector> [--hover] [--zoom 2] [--pad 12] [--css-b "<css for B>"] [--js "<js for both>"] [--js-b "<js for B>"] [--nth 0]
// Writes tools-for-ai/out/pair-<out name>.png (A left, B right). The cookie panel is hidden unless the selector is the cookie panel.
const { spawn } = require('child_process'), fs = require('fs'), os = require('os'), path = require('path');

const args = process.argv.slice(2), opt = (k, d) => { const i = args.indexOf(k); if (i < 0) return d; const v = args[i + 1]; args.splice(i, 2); return v; };
const hover = args.includes('--hover') && args.splice(args.indexOf('--hover'), 1);
const zoom = +opt('--zoom', 2), pad = +opt('--pad', 12), cssB = opt('--css-b', ''), jsB = opt('--js-b', ''), jsBoth = opt('--js', ''), nth = +opt('--nth', 0);
const [width, urlA, urlB, name, sel] = args;
const W = +width;
const OUT = path.join(__dirname, 'out');
fs.mkdirSync(OUT, { recursive: true });
const CHROME = ['C:/Program Files/Google/Chrome/Application/chrome.exe', '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome', '/usr/bin/google-chrome'].find(fs.existsSync);
const port = 9300 + Math.floor(Math.random() * 600);
const chrome = spawn(CHROME, ['--headless=new', '--hide-scrollbars', '--user-data-dir=' + path.join(os.tmpdir(), 'nik-pair-' + port), '--remote-debugging-port=' + port, 'about:blank'], { stdio: 'ignore' });
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

  async function grab(url, css, js = '') {
    await send('Page.navigate', { url });
    await wait(3500);
    const box = await evaluate(`(async () => {
      const s = document.createElement('style'); s.textContent = '*,*::before,*::after{transition:none!important}' + ${JSON.stringify(css)}; document.head.appendChild(s); ${js}
      const k = document.querySelector('.cookie'); if (k && !${JSON.stringify(sel)}.includes('cookie')) k.style.display = 'none';
      await document.fonts.ready;
      const e = [...document.querySelectorAll(${JSON.stringify(sel)})].filter((x) => x.offsetWidth)[${nth}];
      if (!e) return null;
      e.scrollIntoView({ block: 'center' });
      await new Promise((r) => setTimeout(r, 300));
      const r = e.getBoundingClientRect();
      return { x: r.x, y: r.y, w: r.width, h: r.height, sy: scrollY };
    })()`);
    if (!box) throw new Error('not found: ' + sel + ' on ' + url);
    if (hover) { await send('Input.dispatchMouseEvent', { type: 'mouseMoved', x: box.x + box.w / 2, y: box.y + box.h / 2 }); await wait(400); }
    const clip = { x: Math.max(0, box.x - pad), y: box.y + box.sy - pad, width: Math.min(box.w + pad * 2, W), height: box.h + pad * 2, scale: zoom };
    const shot = (await send('Page.captureScreenshot', { format: 'png', captureBeyondViewport: !hover, clip })).data;
    if (hover) await send('Input.dispatchMouseEvent', { type: 'mouseMoved', x: 1, y: 1 });
    return shot;
  }
  const a = await grab(urlA, '', jsBoth), b = await grab(urlB, cssB, jsBoth + ';' + jsB);
  await send('Page.navigate', { url: 'about:blank' });
  await wait(200);
  const png = await evaluate(`(async () => {
    const load = (d) => new Promise((r) => { const i = new Image(); i.onload = () => r(i); i.src = 'data:image/png;base64,' + d; });
    const [A, B] = await Promise.all([load(${JSON.stringify(a)}), load(${JSON.stringify(b)})]);
    const gap = 24, c = new OffscreenCanvas(A.width + B.width + gap, Math.max(A.height, B.height)), g = c.getContext('2d');
    g.fillStyle = '#ff00ff'; g.fillRect(0, 0, c.width, c.height); g.drawImage(A, 0, 0); g.drawImage(B, A.width + gap, 0);
    const u = new Uint8Array(await (await c.convertToBlob({ type: 'image/png' })).arrayBuffer()); let s = ''; for (let i = 0; i < u.length; i += 0x8000) s += String.fromCharCode.apply(null, u.subarray(i, i + 0x8000)); return btoa(s);
  })()`);
  const file = path.join(OUT, `pair-${name}.png`);
  fs.writeFileSync(file, Buffer.from(png, 'base64'));
  console.log(path.relative(process.cwd(), file));
  ws.close(); chrome.kill(); process.exit(0);
})().catch((e) => { console.error(e.message || e); chrome.kill(); process.exit(1); });
