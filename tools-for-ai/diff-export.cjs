// Line diff between a built page and a Claude Design export, after mapping export links and asset paths to ours.
//   node tools-for-ai/diff-export.cjs <built page> <export .dc.html> [css|html|js]   (all three by default)
// Assets are compared by content (md5), so a renamed but identical file is not a difference.
const fs = require('fs'), path = require('path'), crypto = require('crypto'), { spawnSync } = require('child_process');

const [built, exp, only] = process.argv.slice(2);
const OUT = path.join(__dirname, 'out');
fs.mkdirSync(OUT, { recursive: true });
const LINKS = { Main: 'index.html', Mobile: 'index.html', Catalog: 'catalog.html', 'Mobile-Catalog': 'catalog.html', Product: 'product.html', 'Mobile-Product': 'product.html' };
const md5 = (f) => crypto.createHash('md5').update(fs.readFileSync(f)).digest('hex');
const between = (s, a, b) => { const i = s.indexOf(a); return s.slice(i + a.length, s.indexOf(b, i + a.length)); };

const assets = (s, base) => s.replace(/(?:\.\/|\.\.\/\.\.\/)assets\/[^"')\s]+/g, (m) => { const f = path.resolve(base, m); return fs.existsSync(f) ? 'asset:' + md5(f).slice(0, 8) : 'MISSING:' + m; });
const links = (s) => s.replace(/\b((?:Mobile-)?[A-Za-z]+)-v5(?:-[a-z0-9]{4})*\.dc\.html(#[\w-]*)?/g, (m, b, h) => (LINKS[b] ? LINKS[b] + (h || '') : '#'));

const e = fs.readFileSync(exp, 'utf8'), xdc = between(e, '<x-dc>', '</x-dc>'), eb = path.dirname(exp);
const E = {
  css: between(xdc, '<helmet>', '</helmet>'),
  html: xdc.slice(xdc.indexOf('</helmet>') + 9),
  js: between(e.slice(e.indexOf('data-dc-script')), '>', '</script>'),
};
const b = fs.readFileSync(built, 'utf8'), bh = between(b, '<head>', '</head>'), bb = path.dirname(built);
const B = {
  css: bh.slice(bh.indexOf('<link rel="preconnect"'), bh.indexOf('<script src="https://cdn.jsdelivr.net/npm/morphdom')),
  html: between(b, '<script type="text/x-template" id="tpl">', '</script>\n<script>'),
  js: between(b, '<script>\nwindow.DC_BLOBS = ', '\nDC.mount(Component);').replace(/^.*?;\n/, ''),
};
let total = 0;
for (const part of only ? [only] : ['css', 'html', 'js']) {
  const fa = path.join(OUT, `export.${part}.txt`), fb = path.join(OUT, `built.${part}.txt`);
  fs.writeFileSync(fa, links(assets(E[part], eb)).trim() + '\n');
  fs.writeFileSync(fb, assets(B[part], bb).trim() + '\n');
  const r = spawnSync('git', ['diff', '--no-index', '--no-color', '-U0', '--word-diff=plain', fa, fb], { encoding: 'utf8' });
  const hunks = r.stdout.split('\n').filter((l) => !/^(diff|index|---|\+\+\+) /.test(l) && l !== '');
  console.log(`\n===== ${part.toUpperCase()}: ${hunks.filter((l) => l.startsWith('@@')).length} changed place(s)  ([-export-] {+built+})`);
  console.log(hunks.map((l) => (l.length > 300 ? l.slice(0, 300) + ' …' : l)).join('\n'));
  total += hunks.filter((l) => l.startsWith('@@')).length;
}
console.log(`\n${total} changed place(s) in total`);
