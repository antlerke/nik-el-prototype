// Home catalog back to the client's concept (Anna, 24.11): tabs by direction, 8 model cards, «Увесь каталог», «Також у каталозі».
// Replaces the nine category tiles of the brief (commit 1a7de9a); copied word for word from the page before 1a7de9a.
//   node tools-for-ai/restore-home-catalog.cjs
const fs = require('fs'), path = require('path'), { execFileSync } = require('child_process');
const FILE = path.join(__dirname, '..', 'v', '04-11', 'index.html');
const old = execFileSync('git', ['show', '1a7de9a^:v/04-11/index.html'], { cwd: path.join(__dirname, '..'), encoding: 'utf8', maxBuffer: 1 << 26 }).replace(/\r\n/g, '\n');
let cur = fs.readFileSync(FILE, 'utf8').replace(/\r\n/g, '\n');

const part = (src, from, to) => { const a = src.indexOf(from), b = src.indexOf(to, a); if (a < 0 || b < 0) throw new Error('not found: ' + from); return [a, b + to.length]; };
const swap = (from, to, text) => { const [a, b] = part(cur, from, to); cur = cur.slice(0, a) + text + cur.slice(b); };
const take = (from, to) => { const [a, b] = part(old, from, to); return old.slice(a, b); };
const one = (a, b) => { if (cur.split(a).length !== 2) throw new Error('not unique: ' + a); cur = cur.replace(a, b); };

// markup: the whole catalog section
swap('<!-- 2. Каталог: категорії -->', '</section>\n', take('<!-- 2. Каталог: товари за категоріями -->', '</section>\n'));
// script: tab state instead of the arrows' state, no arrow code
one('railStart: true, railEnd: false, spot: 0 };', "tab: 'all', spot: 0 };");
one('    this.railTimer = setTimeout(() => this.initRail(), 300);\n', '');
swap('  // catalog categories: the arrows move', "behavior: still ? 'auto' : 'smooth' });\n  }\n", '');
// data and template values
swap('    // catalog on the home page: nine categories', '    ];\n', take('    // catalog on the home page: 8 models', "const also = ['Програмне забезпечення', 'Мережеве обладнання', 'Аксесуари', 'Контрактне виробництво', 'Високовольтні мережі'];"));
one("      cats, railAtStart: String(s.railStart), railAtEnd: String(s.railEnd), railPrev: () => this.moveRail(-1), railNext: () => this.moveRail(1),\n",
  "      tabs, prods, catName, showMore: rest < 4, moreSpan: 'grid-column: span ' + rest, also,\n");

fs.writeFileSync(FILE, cur.replace(/\n/g, '\r\n'));
console.log('done');
