// Cuts a product out of its background, using two renders of the same shot on two different backgrounds (dark + light):
// where the two pictures differ, it is background; where they match, it is the product (difference matting).
//   node tools-for-ai/cutout.cjs <dark image> <light image> <out .webp|.png> [--base http://127.0.0.1:8740/] [--margin 0.03] [--lo 0.1] [--hi 0.9]
// Image paths are relative to the repo root (served by tools-for-ai/serve.cjs). The result is cropped to the product plus --margin
// (share of its size); --lo / --hi: alpha below lo becomes 0, above hi becomes 1 (cleans the background and the solid body).
const { spawn } = require('child_process'), fs = require('fs'), os = require('os'), path = require('path');

const args = process.argv.slice(2), opt = (k, d) => { const i = args.indexOf(k); return i < 0 ? d : args.splice(i, 2)[1]; };
const BASE = opt('--base', 'http://127.0.0.1:8740/'), MARGIN = +opt('--margin', 0.03), LO = +opt('--lo', 0.1), HI = +opt('--hi', 0.9);
const [dark, light, out] = args;
if (!out) { console.error('usage: node tools-for-ai/cutout.cjs <dark image> <light image> <out .webp|.png>'); process.exit(1); }
const CHROME = ['C:/Program Files/Google/Chrome/Application/chrome.exe', '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome', '/usr/bin/google-chrome'].find(fs.existsSync);
const port = 9300 + Math.floor(Math.random() * 600);
const chrome = spawn(CHROME, ['--headless=new', '--user-data-dir=' + path.join(os.tmpdir(), 'nik-cut-' + port), '--remote-debugging-port=' + port, 'about:blank'], { stdio: 'ignore' });
const wait = (ms) => new Promise((r) => setTimeout(r, ms));

const JOB = (A, B, type) => `(async () => {
  const load = (u) => new Promise((r, j) => { const i = new Image(); i.onload = () => r(i); i.onerror = () => j(new Error('cannot load ' + u)); i.src = u; });
  const [ia, ib] = await Promise.all([load(${JSON.stringify(A)}), load(${JSON.stringify(B)})]);
  const W = ia.naturalWidth, H = ia.naturalHeight;
  if (ib.naturalWidth !== W || ib.naturalHeight !== H) throw new Error('the two images differ in size');
  const px = (img) => { const c = document.createElement('canvas'); c.width = W; c.height = H; const x = c.getContext('2d'); x.drawImage(img, 0, 0); return x.getImageData(0, 0, W, H).data; };
  const a = px(ia), b = px(ib), N = W * H;
  // 1. rough split: the difference on the outer band is the background difference
  const mag = new Float32Array(N), band = [];
  for (let i = 0; i < N; i++) { const o = i * 4, dr = b[o] - a[o], dg = b[o + 1] - a[o + 1], db = b[o + 2] - a[o + 2]; mag[i] = Math.hypot(dr, dg, db); }
  for (let y = 0; y < H; y += 4) for (let x = 0; x < W; x += 4) if (x < W * 0.05 || x > W * 0.95 || y < H * 0.05 || y > H * 0.95) band.push(mag[y * W + x]);
  band.sort((p, q) => p - q); const D0 = band[band.length >> 1];
  // 2. both backgrounds on a coarse grid, from pixels that are clearly background; cells under the product filled from around
  const G = 32, gw = Math.ceil(W / G), gh = Math.ceil(H / G), sum = new Float64Array(gw * gh * 6), cnt = new Float64Array(gw * gh);
  for (let y = 0; y < H; y += 2) for (let x = 0; x < W; x += 2) { const i = y * W + x; if (mag[i] < D0 * 0.9) continue; const g = ((y / G) | 0) * gw + ((x / G) | 0), o = i * 4;
    for (let k = 0; k < 3; k++) { sum[g * 6 + k] += a[o + k]; sum[g * 6 + 3 + k] += b[o + k]; } cnt[g]++; }
  const bg = new Float64Array(gw * gh * 6), known = new Uint8Array(gw * gh);
  for (let g = 0; g < gw * gh; g++) if (cnt[g] > 20) { known[g] = 1; for (let k = 0; k < 6; k++) bg[g * 6 + k] = sum[g * 6 + k] / cnt[g]; }
  for (let it = 0; it < 400; it++) { let left = 0; const nk = known.slice();
    for (let gy = 0; gy < gh; gy++) for (let gx = 0; gx < gw; gx++) { const g = gy * gw + gx; if (known[g]) continue; let n = 0; const acc = [0, 0, 0, 0, 0, 0];
      for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) { const X = gx + dx, Y = gy + dy; if (X < 0 || Y < 0 || X >= gw || Y >= gh || !known[Y * gw + X]) continue; n++; for (let k = 0; k < 6; k++) acc[k] += bg[(Y * gw + X) * 6 + k]; }
      if (n) { for (let k = 0; k < 6; k++) bg[g * 6 + k] = acc[k] / n; nk[g] = 1; } else left++; }
    known.set(nk); if (!left) break; }
  const bgAt = (x, y, k) => { const fx = Math.min(Math.max(x / G - 0.5, 0), gw - 1), fy = Math.min(Math.max(y / G - 0.5, 0), gh - 1), x0 = fx | 0, y0 = fy | 0, x1 = Math.min(x0 + 1, gw - 1), y1 = Math.min(y0 + 1, gh - 1), tx = fx - x0, ty = fy - y0;
    const v = (X, Y) => bg[(Y * gw + X) * 6 + k]; return (v(x0, y0) * (1 - tx) + v(x1, y0) * tx) * (1 - ty) + (v(x0, y1) * (1 - tx) + v(x1, y1) * tx) * ty; };
  // 3. alpha from the difference along (light bg − dark bg); colour from the light image with its background taken out
  const c = document.createElement('canvas'); c.width = W; c.height = H; const ctx = c.getContext('2d'), outD = ctx.createImageData(W, H), o2 = outD.data;
  let x0 = W, y0 = H, x1 = 0, y1 = 0;
  for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) { const i = y * W + x, o = i * 4;
    const B1 = [bgAt(x, y, 0), bgAt(x, y, 1), bgAt(x, y, 2)], B2 = [bgAt(x, y, 3), bgAt(x, y, 4), bgAt(x, y, 5)], Dv = [B2[0] - B1[0], B2[1] - B1[1], B2[2] - B1[2]];
    const dd = Dv[0] * Dv[0] + Dv[1] * Dv[1] + Dv[2] * Dv[2] || 1;
    const t = ((b[o] - a[o]) * Dv[0] + (b[o + 1] - a[o + 1]) * Dv[1] + (b[o + 2] - a[o + 2]) * Dv[2]) / dd;
    const al = Math.min(Math.max(1 - t, 0), 1), s = Math.min(Math.max((al - ${LO}) / (${HI} - ${LO}), 0), 1), out = s * s * (3 - 2 * s);
    for (let k = 0; k < 3; k++) o2[o + k] = al > 0.02 ? Math.min(Math.max((b[o + k] - (1 - al) * B2[k]) / al, 0), 255) : 255;
    o2[o + 3] = Math.round(out * 255);
    if (out > 0.5) { if (x < x0) x0 = x; if (x > x1) x1 = x; if (y < y0) y0 = y; if (y > y1) y1 = y; } }
  ctx.putImageData(outD, 0, 0);
  const m = Math.round(Math.max(x1 - x0, y1 - y0) * ${MARGIN}), cx = Math.max(x0 - m, 0), cy = Math.max(y0 - m, 0), cw = Math.min(x1 + m, W - 1) - cx + 1, ch = Math.min(y1 + m, H - 1) - cy + 1;
  const k = document.createElement('canvas'); k.width = cw; k.height = ch; k.getContext('2d').drawImage(c, cx, cy, cw, ch, 0, 0, cw, ch);
  return { url: k.toDataURL(${JSON.stringify(type)}, 0.9), w: cw, h: ch, crop: [cx, cy], bgDiff: Math.round(D0) };
})()`;

(async () => {
  let tabs;
  for (let i = 0; i < 50 && !tabs; i++) { await wait(200); tabs = await fetch(`http://127.0.0.1:${port}/json`).then((r) => r.json()).catch(() => null); }
  const ws = new WebSocket(tabs.find((t) => t.type === 'page').webSocketDebuggerUrl);
  await new Promise((r) => (ws.onopen = r));
  let id = 0; const pending = {};
  ws.onmessage = (m) => { const d = JSON.parse(m.data); if (pending[d.id]) { pending[d.id](d.result); delete pending[d.id]; } };
  const send = (method, params = {}) => new Promise((r) => { pending[++id] = r; ws.send(JSON.stringify({ id, method, params })); });
  // open a page on the same server, so the canvas may read the images
  await send('Page.navigate', { url: BASE + 'tools-for-ai/' }); await wait(800);
  const type = out.toLowerCase().endsWith('.png') ? 'image/png' : 'image/webp';
  const r = await send('Runtime.evaluate', { expression: JOB(BASE + dark, BASE + light, type), awaitPromise: true, returnByValue: true });
  if (r.exceptionDetails) throw new Error(r.exceptionDetails.exception?.description || r.exceptionDetails.text);
  const v = r.result.value;
  fs.writeFileSync(out, Buffer.from(v.url.split(',')[1], 'base64'));
  console.log(`${out}: ${v.w}×${v.h} px (cropped at ${v.crop}), ${Math.round(fs.statSync(out).size / 1024)} KB; background difference ${v.bgDiff}`);
  ws.close(); chrome.kill(); process.exit(0);
})().catch((e) => { console.error(e); chrome.kill(); process.exit(1); });
