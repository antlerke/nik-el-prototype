// Local preview server for the repo: node tools-for-ai/serve.cjs [port]   (default 8740)
//   /<path>             a file from the working tree
//   /@<rev>/<path>      the same file as committed in git, e.g. /@HEAD/v/04-11/index.html — compare against it without copies
//   /_blob/<id>         an image a Claude Design export loads at runtime, served from assets/ via the DC_BLOBS maps of the built pages
const http = require('http'), fs = require('fs'), path = require('path'), { execFileSync } = require('child_process');

const ROOT = path.resolve(__dirname, '..');
const PORT = +process.argv[2] || 8740;
const TYPES = { '.html': 'text/html; charset=utf-8', '.txt': 'text/plain; charset=utf-8', '.md': 'text/markdown; charset=utf-8', '.js': 'text/javascript', '.cjs': 'text/javascript', '.css': 'text/css', '.json': 'application/json', '.webp': 'image/webp', '.jpg': 'image/jpeg', '.png': 'image/png', '.svg': 'image/svg+xml', '.woff2': 'font/woff2', '.glb': 'model/gltf-binary' };

function blobs() {
  const map = {};
  for (const v of fs.existsSync(ROOT + '/v') ? fs.readdirSync(ROOT + '/v') : []) {
    for (const p of ['index', 'catalog', 'product']) {
      const f = `${ROOT}/v/${v}/${p}.html`;
      const m = fs.existsSync(f) && fs.readFileSync(f, 'utf8').match(/window\.DC_BLOBS = (\{.*?\});/);
      if (m) for (const [id, src] of Object.entries(JSON.parse(m[1]))) map[id] = path.posix.join('v', v, src);
    }
  }
  return map;
}

http.createServer((req, res) => {
  const send = (code, body, type) => { res.writeHead(code, { 'Content-Type': type || 'text/plain; charset=utf-8', 'Cache-Control': 'no-store' }); res.end(body); };
  let url = decodeURIComponent(req.url.split('?')[0]);
  const blob = url.match(/\/_blob\/([0-9a-f]{32})/);
  if (blob) url = '/' + (blobs()[blob[1]] || 'missing');
  const rev = url.match(/^\/@([\w.~^-]+)\/(.*)$/);
  if (rev) {
    try { return send(200, execFileSync('git', ['show', `${rev[1]}:${rev[2]}`], { cwd: ROOT, maxBuffer: 64 << 20 }), TYPES[path.extname(rev[2])]); }
    catch { return send(404, 'not in git: ' + url); }
  }
  const file = path.join(ROOT, url);
  if (!file.startsWith(ROOT) || !fs.existsSync(file) || fs.statSync(file).isDirectory()) return send(404, 'not found: ' + url);
  send(200, fs.readFileSync(file), TYPES[path.extname(file)]);
}).listen(PORT, '127.0.0.1', () => console.log(`serving ${ROOT} on http://127.0.0.1:${PORT}`));
