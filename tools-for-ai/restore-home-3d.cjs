// Puts back on the home page what was taken out on 10.11 (commit 1a7de9a, «only what the brief has»), Anna 24.11:
// the two hero buttons, «Від чипа до корпусу» (3D NIK 2308) and «NIK 2306 у розрізі». The catalog stays as it is.
// Every piece is copied word for word from the page as it was before 1a7de9a; sizes in style="…" become rem (as px-to-rem.cjs).
//   node tools-for-ai/restore-home-3d.cjs
const fs = require('fs'), path = require('path'), { execFileSync } = require('child_process');
const FILE = path.join(__dirname, '..', 'v', '04-11', 'index.html');
const old = execFileSync('git', ['show', '1a7de9a^:v/04-11/index.html'], { cwd: path.join(__dirname, '..'), encoding: 'utf8', maxBuffer: 1 << 26 }).replace(/\r\n/g, '\n');
let cur = fs.readFileSync(FILE, 'utf8');
const crlf = cur.includes('\r\n');
cur = cur.replace(/\r\n/g, '\n');

const rem = (px) => String(Math.round((px / 16) * 1e6) / 1e6).replace(/^0\./, '.') + 'rem';
const toRem = (s) => s.replace(/style="[^"]*"/g, (st) => st.replace(/(\d*\.?\d+)px\b/g, (m, n) => (+n <= 2.5 ? m : rem(+n))));
// the text between two markers of the old page, markers included
const cut = (from, to) => { const a = old.indexOf(from), b = old.indexOf(to, a); if (a < 0 || b < 0) throw new Error('not found in old page: ' + from); return old.slice(a, b + to.length); };
const put = (anchor, text, after = true) => {
  const i = cur.indexOf(anchor);
  if (i < 0 || cur.indexOf(anchor, i + 1) >= 0) throw new Error('anchor missing or not unique: ' + anchor);
  cur = after ? cur.slice(0, i + anchor.length) + text + cur.slice(i + anchor.length) : cur.slice(0, i) + text + cur.slice(i);
};

// head: the 3D viewer
put('<link rel="preconnect" href="https://fonts.googleapis.com">', cut('<script type="module" src="https://cdn.jsdelivr.net/npm/@google/model-viewer', '</script>') + '\n', false);
// hero: the two buttons, between the slide texts and the slide bars
put('      <ol class="{{idxCls}}"', toRem(cut('      <div class="hbtns">', '      </div>\n')), false);
// sections 3 and 4, after the catalog
put('<!-- 5. Повний цикл -->', toRem(cut('<!-- 3. Від чипа до корпусу -->', '</section>\n')) + '\n' + toRem(cut('<!-- 4. Лічильник у декомпозиції -->', '</section>\n')) + '\n', false);

// script: camera views, state, start-up, methods, data and template values
put('class Component extends DCLogic {', cut('const VIEWS3D', ';\n'), false);
cur = cur.replace('vid: true, p: 0, railStart: true, railEnd: false };', 'vid: true, p: 0, railStart: true, railEnd: false, spot: 0 };');
put('    this.railTimer = setTimeout(() => this.initRail(), 300);\n', cut('    this.m3dTimer', ';\n') + '\n');
put('  // catalog categories: the arrows move', cut('  // 3D block: model-viewer keeps', '    this.face3d();\n  }\n'), false);
put('  watchStats() {', cut('  pickSpot(i) {', '    requestAnimationFrame(step);\n  }\n'), false);
put('    const steps = [\n', cut('    // hotspots on the NIK 2308 model', "st: 'left: ' + x + '%; top: ' + y + '%' }));\n") + '\n', false);
put('      steps, stats,', '      spots, spot,\n      xparts, xmarks,\n', false);

fs.writeFileSync(FILE, crlf ? cur.replace(/\n/g, '\r\n') : cur);
console.log('done');
