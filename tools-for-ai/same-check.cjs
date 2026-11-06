// Proves a refactoring changed nothing, in both directions: nothing lost, nothing changed, nothing added.
// A = the pages as committed in git (--base), B = the working copy.
//   node tools-for-ai/same-check.cjs                 everything (about 10 minutes)
//   node tools-for-ai/same-check.cjs --source-only   only part 1 (seconds)
//   node tools-for-ai/same-check.cjs --quick         part 1 + part 2 in the normal mode at 1440 and 390 only
//   node tools-for-ai/same-check.cjs --self-test     breaks things on purpose and confirms each one gets caught
//   node tools-for-ai/same-check.cjs --trial <file>  part 2 with B's CSS replaced by that one file, in memory: the site files aren't touched
// Options: --base <rev> (default 5ec6136) · --pages index,catalog · --envs normal,reduced,touch · --inject-b "<css>"
//
// Part 1, the source. For each page: the HTML without its CSS must be identical, and the CSS the page loads (<style> and
//   local <link> files, in order) must hold exactly the same rules and comments. Reports rules lost, added and moved.
// Part 2, the rendered pages. Two Chromes in lockstep, one on A, one on B. For every element and its ::before, ::after,
//   ::placeholder, ::selection, ::-webkit-scrollbar it compares every computed style and the box, plus the DOM itself:
//   - default state at every width on both sides of every breakpoint;
//   - forced :hover, :focus, :focus-visible, :focus-within, :active on all elements at once;
//   - every state the pages have (slides, tabs, form errors, filters, menu, cookie... see SCENARIOS);
//   - modes: normal, reduced motion, touch screen (hover:none);
//   - files requested (fonts, images), failed requests and JS errors;
//   - in reduced-motion mode a full-page screenshot of every state; pixels count as different above the same threshold as
//     compare.cjs, exact values are the job of the computed styles above.
//   The 3D viewer library is blocked here: it is time-dependent and CSS doesn't reach inside it. tools-for-ai/compare.cjs covers it.
//   COVERAGE lists CSS rules that never applied in any tested state: they are moved but not exercised.
// Details go to tools-for-ai/out/same-check/report.txt. Exit code 0 only if there are no differences at all.
const { spawn, execFileSync } = require('child_process'), fs = require('fs'), os = require('os'), path = require('path'), http = require('http');

const ROOT = path.resolve(__dirname, '..'), VERSION = 'v/04-11', OUT = path.join(__dirname, 'out', 'same-check');
const args = process.argv.slice(2);
const opt = (k, d) => { const i = args.indexOf(k); return i < 0 ? d : args.splice(i, 2)[1]; };
const flag = (k) => { const i = args.indexOf(k); if (i < 0) return false; args.splice(i, 1); return true; };
const BASE = opt('--base', '5ec6136'), PAGES = opt('--pages', 'index,catalog,product').split(','), INJECT_B = opt('--inject-b', ''), TRIAL = opt('--trial', '');
const ENV_NAMES = opt('--envs', 'normal,reduced,touch').split(','), SOURCE_ONLY = flag('--source-only'), QUICK = flag('--quick'), SELF_TEST = flag('--self-test');
// --tidied: style.css has been through tidy-css.cjs, whose --verify proves what was removed; part 1 then checks only the HTML and the comments
const TIDIED = flag('--tidied');
const SHOTS = path.join(OUT, 'shots');
fs.mkdirSync(SHOTS, { recursive: true });
const log = [], say = (s = '') => { console.log(s); log.push(s); }, note = (s) => log.push(s);
const wait = (ms) => new Promise((r) => setTimeout(r, ms));

// ---------- part 1: the source ----------

const fromGit = (p) => execFileSync('git', ['cat-file', 'blob', `${BASE}:${p}`], { cwd: ROOT, maxBuffer: 256 << 20 });
const fromDisk = (p) => fs.readFileSync(path.join(ROOT, p));

// a string starts at i: returns the index just after it
function endOfString(s, i) { const q = s[i]; for (let j = i + 1; j < s.length; j++) { if (s[j] === '\\') j++; else if (s[j] === q) return j + 1; } return s.length; }
const squeeze = (s) => s.replace(/\s+/g, ' ').trim();

// CSS text -> ordered rules { ctx: [@media...], sel, decl } and comments. Not a validator: it keeps the text it finds, so changes show up.
function parseCss(src) {
  const comments = []; let text = '';
  for (let i = 0; i < src.length;) {
    if (src[i] === '"' || src[i] === "'") { const j = endOfString(src, i); text += src.slice(i, j); i = j; continue; }
    if (src.startsWith('/*', i)) { const j = src.indexOf('*/', i + 2), e = j < 0 ? src.length : j + 2; comments.push(squeeze(src.slice(i, e))); i = e; continue; }
    text += src[i++];
  }
  const rules = [];
  const block = (t, ctx) => {
    for (let i = 0; i < t.length;) {
      let j = i, paren = 0;
      for (; j < t.length; j++) {
        const c = t[j];
        if (c === '"' || c === "'") { j = endOfString(t, j) - 1; continue; }
        if (c === '(') paren++; else if (c === ')') paren--; else if (!paren && (c === '{' || c === ';')) break;
      }
      if (j >= t.length) { if (t.slice(i).trim()) rules.push({ ctx, sel: squeeze(t.slice(i)), decl: '(unclosed)' }); return; }
      const prelude = squeeze(t.slice(i, j));
      if (t[j] === ';') { if (prelude) rules.push({ ctx, sel: prelude, decl: '' }); i = j + 1; continue; }
      let k = j + 1, depth = 1;
      for (; k < t.length && depth; k++) {
        const c = t[k];
        if (c === '"' || c === "'") { k = endOfString(t, k) - 1; continue; }
        if (c === '{') depth++; else if (c === '}') depth--;
      }
      const body = t.slice(j + 1, depth ? k : k - 1);
      if (/^@(media|supports|container|layer)\b/.test(prelude)) block(body, ctx.concat(prelude));
      else rules.push({ ctx, sel: prelude, decl: squeeze(body).replace(/;$/, '') });
      i = k;
    }
  };
  block(text, []);
  return { rules, comments };
}
const ruleKey = (r) => (r.ctx.length ? r.ctx.join(' ') + ' ' : '') + r.sel + ' {' + r.decl + '}';

// a page's HTML -> the rest of the HTML without its CSS, and the CSS it loads, in order
function pageSource(html, readLocal, folder) {
  const parts = [];
  const rest = html.replace(/\r\n/g, '\n').replace(/<style\b[^>]*>[\s\S]*?<\/style>\n?|<link\b[^>]*rel="stylesheet"[^>]*>\n?/gi, (m) => {
    if (/^<style/i.test(m)) { parts.push({ from: '<style>', text: m.replace(/^<style\b[^>]*>/i, '').replace(/<\/style>\n?$/i, '') }); return ''; }
    const href = (m.match(/href="([^"]+)"/) || [])[1] || '';
    if (/^(https?:)?\/\//.test(href)) return m; // the Google Fonts link stays part of the page
    parts.push({ from: href, text: String(readLocal(path.posix.join(folder, href))) });
    return '';
  });
  const css = parts.map((p) => p.text).join('\n').replace(/\r\n/g, '\n');
  return { rest, parts, css, ...parseCss(css) };
}
function multisetMinus(a, b) { const n = new Map(); b.forEach((x) => n.set(x, (n.get(x) || 0) + 1)); return a.filter((x) => { const c = n.get(x) || 0; if (c) { n.set(x, c - 1); return false; } return true; }); }
// how many items of the common part are out of order (common minus the longest common subsequence)
function movedCount(a, b) {
  if (a.length === b.length && a.every((x, i) => x === b[i])) return 0;
  const keep = (list, other) => { const n = new Map(); other.forEach((x) => n.set(x, (n.get(x) || 0) + 1)); return list.filter((x) => { const c = n.get(x) || 0; if (!c) return false; n.set(x, c - 1); return true; }); };
  // the whole of b: in a shared file the same rule can stand twice, and the page's own copy may be the later one
  const x = keep(a, b), y = b;
  let row = new Uint16Array(y.length + 1);
  for (let i = 1; i <= x.length; i++) { const next = new Uint16Array(y.length + 1); for (let j = 1; j <= y.length; j++) next[j] = x[i - 1] === y[j - 1] ? row[j - 1] + 1 : Math.max(row[j], next[j - 1]); row = next; }
  return x.length - row[y.length];
}
// known: rules and comments of all the pages. In one shared file a page also gets the other pages' rules; only what no page had counts as added.
function compareSource(A, B, known = { rules: new Set(A.rules.map(ruleKey)), comments: new Set(A.comments) }) {
  const a = A.rules.map(ruleKey), b = B.rules.map(ruleKey), extra = multisetMinus(b, a), extraComments = multisetMinus(B.comments, A.comments);
  const out = { rules: a.length, lost: multisetMinus(a, b), added: extra.filter((k) => !known.rules.has(k)), fromOthers: extra.filter((k) => known.rules.has(k)).length, moved: movedCount(a, b), commentsLost: multisetMinus(A.comments, B.comments), commentsAdded: extraComments.filter((k) => !known.comments.has(k)), htmlSame: A.rest === B.rest, cssTextSame: A.css.trim() === B.css.trim(), htmlDiff: null };
  if (!out.htmlSame) { let i = 0; while (i < A.rest.length && A.rest[i] === B.rest[i]) i++; let ea = A.rest.length, eb = B.rest.length; while (ea > i && eb > i && A.rest[ea - 1] === B.rest[eb - 1]) { ea--; eb--; } out.htmlDiff = { a: A.rest.slice(i, ea).slice(0, 300), b: B.rest.slice(i, eb).slice(0, 300) }; }
  return out;
}
const sourceProblems = (c) => c.lost.length + c.added.length + c.moved + c.commentsLost.length + c.commentsAdded.length + (c.htmlSame ? 0 : 1);

function part1() {
  say('PART 1 — the source (A = ' + BASE + ', B = working copy)');
  let problems = 0; const usedFiles = new Set(), sources = {}, known = { rules: new Set(), comments: new Set() };
  for (const page of ['index', 'catalog', 'product']) {
    const file = `${VERSION}/${page}.html`, A = pageSource(withChanges(file, String(fromGit(file))), fromGit, VERSION);
    // the base with the block names of the intended changes, so that the rules can be compared
    A.rules = A.rules.map((r) => ({ ...r, sel: renameSelector(page, r.sel) }));
    sources[page] = A;
    A.rules.forEach((r) => known.rules.add(ruleKey(r))); A.comments.forEach((x) => known.comments.add(x));
  }
  for (const page of PAGES) {
    const file = `${VERSION}/${page}.html`, A = sources[page], B = pageSource(String(fromDisk(file)), fromDisk, VERSION), c = compareSource(A, B, known);
    B.parts.filter((p) => p.from !== '<style>').forEach((p) => usedFiles.add(p.from));
    problems += TIDIED ? (c.htmlSame ? 0 : 1) + c.commentsLost.length + c.commentsAdded.length : sourceProblems(c);
    if (TIDIED) { c.lost = []; c.added = []; c.moved = 0; }
    say(`  ${page}: HTML without CSS ${c.htmlSame ? 'identical (apart from the intended changes)' : 'DIFFERENT'} · its ${c.rules} rules: ${c.lost.length} lost, ${c.added.length} that no page had, ${c.moved} out of order · ${c.fromOthers} rules from the other pages · comments: ${c.commentsLost.length} lost, ${c.commentsAdded.length} that no page had · loads: ${B.parts.map((p) => p.from).join(', ')}`);
    if (c.htmlDiff) { say('    HTML A: ' + JSON.stringify(c.htmlDiff.a)); say('    HTML B: ' + JSON.stringify(c.htmlDiff.b)); }
    for (const [label, list] of [['lost', c.lost], ['added', c.added], ['comment lost', c.commentsLost], ['comment added', c.commentsAdded]]) list.slice(0, 40).forEach((x) => say(`    ${label}: ${x.slice(0, 220)}`));
  }
  // nothing else in the repo changed, no CSS file sits unused
  const changed = execFileSync('git', ['-c', 'core.safecrlf=false', 'status', '--porcelain', '-uall'], { cwd: ROOT }).toString().split('\n').filter(Boolean);
  const committed = execFileSync('git', ['-c', 'core.safecrlf=false', 'diff', '--name-only', BASE, 'HEAD'], { cwd: ROOT }).toString().split('\n').filter(Boolean);
  const all = [...new Set(changed.map((l) => l.slice(3).replace(/^"|"$/g, '')).concat(committed))];
  const expected = (f) => f.startsWith('tools-for-ai/') || new RegExp('^' + VERSION + '/[^/]+\\.css$').test(f) || ['index', 'catalog', 'product'].some((p) => f === `${VERSION}/${p}.html`);
  const other = all.filter((f) => !expected(f));
  say(`  files changed since ${BASE}: ${all.length ? all.join(', ') : 'none'}`);
  if (other.length) { say('  UNEXPECTED files changed: ' + other.join(', ')); problems += other.length; }
  const cssFiles = fs.readdirSync(path.join(ROOT, VERSION)).filter((f) => f.endsWith('.css')), unused = cssFiles.filter((f) => !usedFiles.has(f));
  if (unused.length) { say('  CSS files no page links: ' + unused.join(', ')); problems += unused.length; }
  say(problems ? `  => ${problems} problem(s)` : '  => nothing lost, nothing added');
  return problems;
}

// ---------- part 2: the rendered pages ----------

const WIDTHS_ALL = [1920, 1440, 1360, 1359, 1300, 1299, 1181, 1180, 1101, 1100, 1061, 1060, 901, 900, 601, 600, 390, 360, 359, 320]; // both sides of every @media width
const ENVS = {
  normal: { motion: 'no-preference', touch: false, defaults: WIDTHS_ALL, pseudo: [1440, 1000, 700, 390, 320], states: [1440, 1000, 700, 390], shots: false },
  reduced: { motion: 'reduce', touch: false, defaults: [1440, 390], pseudo: [1440, 390], states: [1440, 390], shots: true },
  touch: { motion: 'no-preference', touch: true, defaults: [1000, 390], pseudo: [390], states: [1000, 390], shots: false }
};
if (QUICK) { ENVS.normal = { ...ENVS.normal, defaults: [1440, 390], pseudo: [1440, 390], states: [1440, 390] }; ENV_NAMES.length = 0; ENV_NAMES.push('normal'); }
const TINY_PX = 4; // a few pixels on a rendering seam; any real CSS change also shows in the computed styles
const PSEUDO = [['hover'], ['focus'], ['focus-visible'], ['focus-within'], ['active'], ['hover', 'focus', 'focus-visible', 'focus-within', 'active']];

const click = (sel, n = 0) => `__sc.click(${JSON.stringify(sel)}, ${n})`;
const steps = (list) => list.map(([name, js, extra]) => ({ name, js, ...extra }));
const COOKIE = { name: 'cookie panel', steps: steps([['closed', click('.cookie .btn-ink')], ['opened again', `[...document.querySelectorAll('.ft nav a')].find((a) => /cookie/i.test(a.textContent)).click()`]]) };
const MENU = { name: 'mobile menu', steps: steps([['open', click('.burger')], ['closed', click('.burger')]]) };
const SCROLLED = { name: 'scrolled', steps: steps([['1500 px down', '0', { scrollTop: 1500 }]]) };
const fill = (sel, v) => `__sc.fill(${JSON.stringify(sel)}, ${JSON.stringify(v)})`;
const SCENARIOS = {
  index: [
    { name: 'hero slides', steps: [1, 2, 3].map((i) => ({ name: 'slide ' + (i + 1), js: click('.idx button', i) })).concat({ name: 'hovered, not the bars', js: '0', forceHover: '.hero' }) },
    { name: 'catalog tabs', steps: [1, 2, 3].map((i) => ({ name: 'tab ' + (i + 1), js: click('#catalog [role=tab]', i) })) },
    { name: '3D block', steps: [1, 2, 3, 4, 5, 6].map((i) => ({ name: 'spot ' + (i + 1), js: click('.chips button', i), wait: 1000 })).concat({ name: 'moved, spots facing', js: `document.querySelector('.m3d').classList.add('moved'); document.querySelectorAll('.spot').forEach((b) => b.classList.add('face'))` }) },
    { name: 'video paused', steps: [{ name: 'paused', js: click('.vbox button') }] },
    { name: 'figures counted', steps: [{ name: 'counted', js: `document.getElementById('h-figs').closest('section').scrollIntoView()`, wait: 2800 }] },
    { name: 'contact form', steps: steps([
      ['sent empty, errors shown', `document.querySelector('#contact form').requestSubmit()`],
      ['wrong values', [fill('#f-name', 'А'), fill('#f-tel', '67'), fill('#f-mail', 'wrong')].join(';')],
      ['right values', [fill('#f-name', 'Тарас Шевченко'), fill('#f-tel', '671234567'), fill('#f-mail', 'test@example.com'), fill('#f-reg', '@second-option'), fill('#f-topic', '@second-option'), fill('#f-desc', 'Текст'), `document.querySelector('.consent input').click()`].join(';')],
      ['sent', `document.querySelector('#contact form').requestSubmit()`],
      ['form again', click('#contact .btn-line')]
    ]) },
    COOKIE, MENU, SCROLLED
  ],
  catalog: [
    { name: 'tabs', steps: steps([['services', click('[role=tab]', 1)], ['software', click('[role=tab]', 2)], ['products', click('[role=tab]', 0)]]) },
    { name: 'filter sheet', steps: steps([['open', click('.rbar .fbtn')], ['closed by veil', click('.veil')]]) },
    { name: 'filters', steps: steps([
      ['one ticked', click('.acc-p .cb', 0)], ['second ticked', click('.acc-p .cb', 5)], ['group: show more', click('.acc-f .tl.sm', 0)], ['withdrawn shown', click('.filt > .fg:not(.acc) .cb')],
      ['group closed', click('.acc-t', 0)], ['chip removed', click('.rbar .chipx:not(.chip-clear)')], ['reset all', click('.ffoot .tl')]
    ]) },
    { name: 'search', steps: steps([['nothing found', [fill('#cat-q', 'zzzz'), `document.querySelector('form.search').requestSubmit()`].join(';')], ['reset', click('.rst')]]) },
    { name: 'sort and pages', steps: steps([['sorted', fill('select.sort', 'name')], ['page 2', click('.pager a', 0)]]) },
    COOKIE, MENU, SCROLLED
  ],
  product: [
    { name: 'gallery', steps: steps([['photo 2', click('.gidx button', 1)], ['photo 1', click('.gidx button', 0)]]) },
    { name: 'sub-menu', steps: [1, 2, 3, 4].map((i) => ({ name: 'item ' + (i + 1), js: click('nav.subnav a', i) })) },
    COOKIE, MENU, SCROLLED
  ]
};

// runs inside the pages
function pageHelper() {
  const raf = () => new Promise((r) => requestAnimationFrame(() => r()));
  const pause = (ms) => new Promise((r) => setTimeout(r, ms));
  const hash = (s) => { let a = 0xdeadbeef, b = 0x41c6ce57; for (let i = 0; i < s.length; i++) { const c = s.charCodeAt(i); a = Math.imul(a ^ c, 2654435761); b = Math.imul(b ^ c, 1597334677); } a = Math.imul(a ^ (a >>> 16), 2246822507) ^ Math.imul(b ^ (b >>> 13), 3266489909); b = Math.imul(b ^ (b >>> 16), 2246822507) ^ Math.imul(a ^ (a >>> 13), 3266489909); return (b >>> 0).toString(36) + (a >>> 0).toString(36); };
  // logical names are aliases of the physical properties, which are compared; Chrome sometimes gives them before layout (margin-inline-start 0 vs 72.5)
  const ALIAS = /^(margin|padding|border|scroll-margin|scroll-padding|inset|overflow)-(inline|block)|^inset-|^(min-|max-)?(inline|block)-size$/;
  // sorted: the browser may list custom properties (--ink, --red...) in a different order, which means nothing
  const read = (cs) => { const lines = []; for (let i = 0; i < cs.length; i++) { const k = cs[i]; if (!ALIAS.test(k)) lines.push(k + ': ' + cs.getPropertyValue(k)); } return lines.sort().join('\n') + '\n'; };
  const rnd = (n) => Math.round(n * 100) / 100;
  let rows = [];
  // the slide timers are held at their start and running animations jump to their end, so both sides show the same moment
  function freeze() {
    for (const a of document.getAnimations()) {
      try {
        if (a.timeline !== document.timeline) continue; // scroll-linked: follows the scroll position, the same on both sides
        if (typeof CSSTransition !== 'undefined' && a instanceof CSSTransition) { a.finish(); continue; }
        if (a.animationName === 'prog' || a.effect.getComputedTiming().iterations === Infinity) { a.pause(); a.currentTime = 0; continue; }
        a.finish();
      } catch (e) { /* an animation removed meanwhile */ }
    }
  }
  const label = (el, i) => el.tagName.toLowerCase() + (el.id ? '#' + el.id : '') + (typeof el.className === 'string' && el.className.trim() ? '.' + el.className.trim().split(/\s+/).join('.') : (el.getAttribute('class') ? '.' + el.getAttribute('class').trim().split(/\s+/).join('.') : '')) + ':' + i;
  const OVERFLOW = /auto|scroll|hidden|clip/;
  const selectionFor = new Set();
  function snap() {
    const seen = new Map(); rows = [];
    const add = (path, pseudo, text) => { let h = seen.get(text); if (!h) { h = hash(text); seen.set(text, h); } rows.push({ path, pseudo, text, h }); };
    ['html', 'body', 'p', 'a', 'h1', 'h2', 'input', 'button'].forEach((s) => { const e = document.querySelector(s); if (e) selectionFor.add(e); });
    const walk = (el, p) => {
      const cs = getComputedStyle(el), r = el.getBoundingClientRect();
      add(p, '', read(cs) + `@box: ${rnd(r.left)} ${rnd(r.top)} ${rnd(r.width)} ${rnd(r.height)} scroll ${el.scrollWidth} ${el.scrollHeight}\n`);
      for (const ps of ['::before', '::after']) { const c = getComputedStyle(el, ps); if (c.content !== 'none' && c.content !== 'normal') add(p, ps, read(c)); }
      if (el.matches('input, textarea')) add(p, '::placeholder', read(getComputedStyle(el, '::placeholder')));
      if (selectionFor.has(el)) add(p, '::selection', read(getComputedStyle(el, '::selection')));
      if (OVERFLOW.test(cs.overflowX + cs.overflowY)) add(p, '::-webkit-scrollbar', read(getComputedStyle(el, '::-webkit-scrollbar')));
      [...el.children].forEach((ch, i) => { if (!/^(SCRIPT|STYLE|TEMPLATE|HEAD)$/.test(ch.tagName)) walk(ch, p + ' > ' + label(ch, i)); });
    };
    walk(document.documentElement, 'html');
    return { n: rows.length, keys: hash(rows.map((x) => x.path + '|' + x.pseudo).join('\n')), hashes: rows.map((x) => x.h), dom: hash(document.body.outerHTML) };
  }
  // CSS rules that apply in this state (dynamic pseudo-classes and pseudo-elements are stripped: they are exercised by other passes)
  let rules = null;
  const DYN = 'hover|focus-visible|focus-within|focus|active|visited';
  const EL = 'before|after|placeholder|selection|-webkit-scrollbar(?:-[a-z]+)?';
  function tester(sel) {
    return sel.split(/,(?![^(]*\))/).map((one) => {
      const t = one.replace(new RegExp(`:not\\(:has\\([^()]*:(?:${DYN})\\)\\)`, 'g'), '').replace(new RegExp(`:not\\(\\s*:(${DYN})\\s*\\)`, 'g'), '').replace(new RegExp(`(^|[\\s>+~(])::?(?:${EL}|${DYN})(?![\\w-])`, 'g'), '$1*').replace(new RegExp(`::?(?:${EL})(?![\\w-])`, 'g'), '').replace(new RegExp(`:(?:${DYN})(?![\\w-])`, 'g'), '').trim();
      return t || '*';
    });
  }
  function collect() {
    rules = []; const count = new Map();
    const visit = (list, conds) => {
      for (const r of list) {
        if (r instanceof CSSStyleRule) { const base = conds.map((c) => c.text).join(' ') + ' | ' + r.selectorText, k = (count.get(base) || 0) + 1; count.set(base, k); rules.push({ key: base + (k > 1 ? ' #' + k : ''), text: conds.map((c) => c.text).join(' ') + ' | ' + r.cssText, test: tester(r.selectorText), conds, hit: false }); }
        else if (r instanceof CSSMediaRule) visit(r.cssRules, conds.concat({ text: '@media ' + r.conditionText, media: r.conditionText }));
        else if (r instanceof CSSSupportsRule) visit(r.cssRules, conds.concat({ text: '@supports ' + r.conditionText, sup: r.conditionText }));
      }
    };
    for (const s of document.styleSheets) { let list; try { list = s.cssRules; } catch (e) { continue; } visit(list, []); }
  }
  const holds = (c) => (c.media ? matchMedia(c.media).matches : CSS.supports(c.sup));
  const hits = (t) => { try { return !!document.querySelector(t); } catch (e) { return false; } };
  function cover() { if (!rules) collect(); const got = []; for (const r of rules) { if (r.hit || !r.conds.every(holds)) continue; if (r.test.some(hits)) { r.hit = true; got.push({ key: r.key, text: r.text }); } } return got; }

  window.__sc = {
    async settle(top) {
      const go = () => window.scrollTo({ top, left: 0, behavior: 'instant' });
      for (let i = 0; i < 4; i++) { freeze(); go(); await raf(); }
      await document.fonts.ready;
      await Promise.race([Promise.all([...document.images].map((img) => { img.loading = 'eager'; return img.complete ? 0 : new Promise((r) => { img.onload = img.onerror = r; }); })), pause(6000)]);
      await Promise.race([Promise.all([...document.images].map((img) => (img.complete && img.naturalWidth ? img.decode().catch(() => 0) : 0))), pause(3000)]);
      for (let i = 0; i < 4; i++) { freeze(); go(); await raf(); }
    },
    async ready() { while (!document.querySelector('#app > *')) await pause(30); freeze(); await pause(450); freeze(); },
    pause,
    snap,
    detail: (idx) => idx.map((i) => rows[i]),
    paths: () => rows.map((x) => x.path + (x.pseudo ? ' ' + x.pseudo : '')),
    cover,
    allRules: () => { if (!rules) collect(); return rules.map((r) => r.key); },
    allTexts: () => { if (!rules) collect(); return rules.map((r) => r.text); },
    media: (q) => matchMedia(q).matches,
    // rebuilds layout and layers from scratch: drops what the browser kept from earlier states
    reflow() { const h = document.documentElement; h.style.display = 'none'; void h.offsetHeight; h.removeAttribute('style'); void h.offsetHeight; },
    hidePhotos(on) {
      let st = document.getElementById('__sc-photos');
      if (on && !st) { st = document.createElement('style'); st.id = '__sc-photos'; st.textContent = 'img{visibility:hidden!important}'; document.documentElement.appendChild(st); }
      if (!on && st) st.remove();
    },
    click(sel, n) { const el = document.querySelectorAll(sel)[n]; if (!el) throw new Error('not on the page: ' + sel + ' #' + n); el.click(); },
    fill(sel, v) {
      const el = document.querySelector(sel); if (!el) throw new Error('not on the page: ' + sel);
      el.value = v === '@second-option' ? el.options[1].value : v;
      el.dispatchEvent(new Event('input', { bubbles: true })); el.dispatchEvent(new Event('change', { bubbles: true }));
    }
  };
}

// ----- the intended changes of the move to one stylesheet, all of them; anything else has to match exactly -----
// HTML: a class for a block that had none, and two classes renamed because the name meant two different things.
const HTML_CHANGES = {
  [`${VERSION}/product.html`]: [['<section style="padding: 32px 0 72px;', '<section class="ptop" style="padding: 32px 0 72px;']],
  [`${VERSION}/catalog.html`]: [
    ['<div class="ph" style="min-height: 360px">', '<div class="placeholder" style="min-height: 360px">'], ['<div class="svc">', '<div class="svc-grid">'],
    ['<div class="wrap cat">', '<div class="wrap cat pbody">'], ['<div class="wrap" style="padding-top: 48px; padding-bottom: 120px">', '<div class="wrap pbody" style="padding-top: 48px; padding-bottom: 120px">'], ['<section class="wrap" style="padding-bottom: 120px">', '<section class="wrap band-sec" style="padding-bottom: 120px">']
  ]
};
// Selectors: one class = one style. On the home page .ph is a photo box and .svc a tile; on the other pages they were a placeholder and a grid.
const renameClasses = (page, sel) => (page === 'index' ? sel : sel.replace(/\.ph(?![\w-])/g, '.placeholder').replace(/\.svc(?![\w-])/g, '.svc-grid'));
// "The N-th block of <main>" exists on every page: in one file these rules would hit all of them, so each names its block instead.
const BLOCK_NAMES = {
  catalog: { 'main>:nth-child(1)': 'main>.phead', 'main>:nth-child(2)': 'main>.pbody', 'main>:nth-child(3)': 'main>.band-sec' },
  product: { 'main>:nth-child(1)': 'main>.ptop', 'main>:nth-child(3)': 'main>#p-desc', 'main>:nth-child(4)': 'main>#p-spec' }
};
const renameSelector = (page, sel) => renameClasses(page, (BLOCK_NAMES[page] || {})[sel] || sel);
// Rules of the catalog and product that now also reach these elements of the home page. Computed value changes, the picture doesn't
// (compare.cjs shows that); A gets the same value, so that everything else, including boxes, still has to match exactly.
const SHARED_ON_PURPOSE = { index: '.cgo{text-align:center}@media (max-width:600px){main .btn:not(.fbtn):not(.rst){align-self:stretch}}@media (max-width:900px){.fcols .num{white-space:nowrap}}' };

// A: the same HTML changes, and the renamed classes in its own CSS, as the renamed HTML would otherwise lose them
function withChanges(p, html) {
  for (const [from, to] of HTML_CHANGES[p] || []) { if (!html.includes(from)) throw new Error(`${p}: expected text not found: ${from}`); html = html.split(from).join(to); }
  const page = path.posix.basename(p, '.html');
  return html.replace(/(<style\b[^>]*>)([\s\S]*?)(<\/style>)/gi, (m, open, css, close) => open + css.replace(/\.ph(?![\w-])/g, page === 'index' ? '.ph' : '.placeholder').replace(/\.svc(?![\w-])/g, page === 'index' ? '.svc' : '.svc-grid') + close);
}
const fromGitChanged = (p) => (p.endsWith('.html') ? Buffer.from(withChanges(p, String(fromGit(p)))) : fromGit(p));

// --trial: the page as it is on disk, with all its CSS replaced by the trial file, in place of the first <style>
function trialHtml(p) {
  const css = fs.readFileSync(TRIAL, 'utf8'); let first = true;
  let html = String(fromDisk(p));
  for (const [from, to] of HTML_CHANGES[p] || []) html = html.split(from).join(to);
  return html.replace(/<style\b[^>]*>[\s\S]*?<\/style>\n?|<link\b[^>]*rel="stylesheet"[^>]*>\n?/gi, (m) => {
    if (/^<link/i.test(m) && /href="(https?:)?\/\//.test(m)) return m;
    if (first) { first = false; return '<style>' + css + '</style>\n'; }
    return '';
  });
}

// the pages as committed under /A/, the working copy under /B/ (same depth, so relative paths resolve the same)
function startServer() {
  const TYPES = { '.html': 'text/html; charset=utf-8', '.js': 'text/javascript', '.css': 'text/css', '.webp': 'image/webp', '.jpg': 'image/jpeg', '.png': 'image/png', '.svg': 'image/svg+xml', '.woff2': 'font/woff2', '.glb': 'model/gltf-binary' };
  const cache = new Map();
  const srv = http.createServer((req, res) => {
    const url = decodeURIComponent(req.url.split('?')[0]), m = url.match(/^\/(A|B)\/(.*)$/);
    const send = (code, body, type) => { res.writeHead(code, { 'Content-Type': type || 'text/plain', 'Cache-Control': 'no-store' }); res.end(body); };
    if (!m) return send(404, 'not found: ' + url);
    try {
      let body;
      if (m[1] === 'A') { if (!cache.has(m[2])) cache.set(m[2], fromGitChanged(m[2])); body = cache.get(m[2]); } else body = TRIAL && m[2].endsWith('.html') ? trialHtml(m[2]) : fromDisk(m[2]);
      send(200, body, TYPES[path.extname(m[2])]);
    } catch (e) { send(404, 'not found: ' + url); }
  });
  return new Promise((r) => srv.listen(0, '127.0.0.1', () => r(srv)));
}

async function openChrome(tag) {
  const CHROME = ['C:/Program Files/Google/Chrome/Application/chrome.exe', '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome', '/usr/bin/google-chrome'].find(fs.existsSync);
  const port = 9300 + Math.floor(Math.random() * 600);
  const proc = spawn(CHROME, ['--headless=new', '--user-data-dir=' + path.join(os.tmpdir(), 'nik-same-' + tag), '--remote-debugging-port=' + port, '--no-first-run', '--disable-gpu', '--num-raster-threads=1', '--disable-partial-raster', '--disable-checker-imaging', '--disable-lcd-text', '--force-color-profile=srgb', 'about:blank'], { stdio: 'ignore' });
  let tabs;
  for (let i = 0; i < 75 && !tabs; i++) { await wait(200); tabs = await fetch(`http://127.0.0.1:${port}/json`).then((r) => r.json()).catch(() => null); }
  const ws = new WebSocket(tabs.find((t) => t.type === 'page').webSocketDebuggerUrl);
  await new Promise((r) => (ws.onopen = r));
  let id = 0; const pending = {}, on = {};
  ws.onmessage = (m) => {
    const d = JSON.parse(m.data);
    if (d.id && pending[d.id]) { pending[d.id](d); delete pending[d.id]; } else if (d.method && on[d.method]) on[d.method](d.params);
  };
  const raw = (method, params = {}) => new Promise((r) => { pending[++id] = r; ws.send(JSON.stringify({ id, method, params })); });
  const send = async (method, params) => { const d = await raw(method, params); if (d.error) throw new Error(method + ': ' + d.error.message); return d.result; };
  const ev = async (expression) => {
    const r = await send('Runtime.evaluate', { expression, awaitPromise: true, returnByValue: true });
    if (r.exceptionDetails) throw new Error((r.exceptionDetails.exception && r.exceptionDetails.exception.description) || r.exceptionDetails.text);
    return r.result.value;
  };
  const side = { tag, send, ev, on, requests: new Set(), failed: new Set(), errors: new Set(), close() { ws.close(); proc.kill(); } };
  await send('Page.enable'); await send('Runtime.enable'); await send('DOM.enable'); await send('CSS.enable'); await send('Network.enable');
  await send('Network.setBlockedURLs', { urls: ['*model-viewer*', '*.glb'] });
  return side;
}

async function runPart2(opts = {}) {
  const srv = await startServer(), port = srv.address().port;
  const [A, B] = await Promise.all([openChrome('a'), openChrome('b')]);
  const both = (fn) => Promise.all([fn(A), fn(B)]);
  const clean = (u) => u.replace(new RegExp(`^http://127\\.0\\.0\\.1:${port}/[AB]/`), '/');
  for (const s of [A, B]) {
    s.on['Network.requestWillBeSent'] = (p) => { if (p.request.url.startsWith('http')) s.requests.add(clean(p.request.url)); };
    const names = {};
    s.on['Network.responseReceived'] = (p) => { names[p.requestId] = p.response.url; if (p.response.status >= 400) s.failed.add(p.response.status + ' ' + clean(p.response.url)); };
    s.on['Network.loadingFailed'] = (p) => { if (!p.blockedReason && !p.canceled) s.failed.add('failed ' + p.errorText + ' ' + clean(names[p.requestId] || p.requestId)); };
    s.on['Runtime.exceptionThrown'] = (p) => { const d = p.exceptionDetails; s.errors.add(((d.exception && d.exception.description) || d.text).split('\n')[0].replace(new RegExp(`http://127\\.0\\.0\\.1:${port}/[AB]/`, 'g'), '/')); };
  }
  const helper = `(${pageHelper})()`, stats = { snapshots: 0, shots: 0, shotsTiny: 0, retries: 0, diffs: 0, stepErrors: 0, byPage: {}, agg: {} };
  const covered = {}, allRules = {}, coveredTexts = {}, ownTexts = {};
  let C = null; // a third Chrome, only to decode two screenshots that aren't byte-identical
  async function pixelDiff(a, b) {
    C = C || (await openChrome('c'));
    return C.ev(`(async () => {
      const load = (d) => new Promise((r) => { const i = new Image(); i.onload = () => r(i); i.src = 'data:image/png;base64,' + d; });
      const [A, B] = await Promise.all([load(${JSON.stringify(a)}), load(${JSON.stringify(b)})]);
      if (A.width !== B.width || A.height !== B.height) return { big: Infinity, note: A.width + 'x' + A.height + ' vs ' + B.width + 'x' + B.height };
      const read = (img) => { const c = new OffscreenCanvas(img.width, img.height), g = c.getContext('2d'); g.drawImage(img, 0, 0); return g.getImageData(0, 0, img.width, img.height).data; };
      const da = read(A), db = read(B); let big = 0;
      for (let i = 0; i < da.length; i += 4) if (Math.abs(da[i] - db[i]) + Math.abs(da[i + 1] - db[i + 1]) + Math.abs(da[i + 2] - db[i + 2]) > 24) big++;
      return { big };
    })()`);
  }
  const inject = opts.injectB || INJECT_B;

  async function setWidth(w) { await both((s) => s.send('Emulation.setDeviceMetricsOverride', { width: w, height: 1000, deviceScaleFactor: 1, mobile: false })); }
  async function load(page, env) {
    await both(async (s) => {
      await s.send('Emulation.setEmulatedMedia', { features: [{ name: 'prefers-reduced-motion', value: env.motion }] });
      await s.send('Emulation.setTouchEmulationEnabled', { enabled: env.touch, maxTouchPoints: env.touch ? 5 : 1 });
      const loaded = new Promise((r) => { s.on['Page.loadEventFired'] = r; });
      await s.send('Page.navigate', { url: `http://127.0.0.1:${port}/${s.tag.toUpperCase()}/${VERSION}/${page}.html` });
      await Promise.race([loaded, wait(30000)]);
      await s.ev(helper);
      await s.ev('__sc.ready()');
    });
    const addStyle = (css) => `(() => { const s = document.createElement('style'); s.textContent = ${JSON.stringify(css)}; document.head.appendChild(s); })()`;
    if (SHARED_ON_PURPOSE[page]) await A.ev(addStyle(SHARED_ON_PURPOSE[page]));
    if (inject) await B.ev(addStyle(inject));
    if (opts.mutateB) await B.ev(opts.mutateB);
  }
  async function force(classes) {
    await both(async (s) => {
      const { root } = await s.send('DOM.getDocument', { depth: 0 });
      const { nodeIds } = await s.send('DOM.querySelectorAll', { nodeId: root.nodeId, selector: 'html, body, body *' });
      await Promise.all(nodeIds.map((nodeId) => s.send('CSS.forcePseudoState', { nodeId, forcedPseudoClasses: classes })));
    });
  }
  const parse = (t) => new Map(t.split('\n').filter(Boolean).map((l) => { const i = l.indexOf(': '); return [l.slice(0, i), l.slice(i + 2)]; }));
  async function check(where, env, scrollTop) {
    const pg = (stats.byPage[where.page] = stats.byPage[where.page] || { snapshots: 0, diffs: 0, list: [] });
    await both((s) => s.ev(`__sc.settle(${scrollTop || 0})`));
    // a real difference stays, a moment caught mid-render doesn't: read again before calling it a difference
    let a, b;
    for (let attempt = 0; attempt < (TRIAL ? 1 : 3); attempt++) {
      if (attempt) { stats.retries++; await wait(400); await both((s) => s.ev('__sc.reflow()')); await both((s) => s.ev(`__sc.settle(${scrollTop || 0})`)); }
      [a, b] = await both((s) => s.ev('__sc.snap()'));
      if (a.dom === b.dom && a.keys === b.keys && a.hashes.every((h, i) => h === b.hashes[i])) break;
    }
    stats.snapshots++; pg.snapshots++;
    const title = `${where.page} · ${where.env} · ${where.state} @${where.width}`;
    const report = (line) => { stats.diffs++; pg.diffs++; pg.list.push(title + ' — ' + line); note('DIFF ' + title + ' — ' + line); };
    if (a.dom !== b.dom) report('the DOM differs');
    if (a.keys !== b.keys) {
      const [pa, pb] = await both((s) => s.ev('__sc.paths()'));
      multisetMinus(pa, pb).slice(0, 6).forEach((x) => report('only in A: ' + x));
      multisetMinus(pb, pa).slice(0, 6).forEach((x) => report('only in B: ' + x));
    } else {
      const idx = []; a.hashes.forEach((h, i) => { if (h !== b.hashes[i]) idx.push(i); });
      if (idx.length) {
        const [da, db] = await both((s) => s.ev(`__sc.detail(${JSON.stringify(idx.slice(0, 40))})`));
        report(`${idx.length} element(s) differ`);
        const agg = (stats.agg[where.page] = stats.agg[where.page] || new Map());
        da.forEach((row, i) => {
          const ma = parse(row.text), mb = parse(db[i].text), lines = [], el = row.path.split(' > ').pop().replace(/:\d+$/, '') + row.pseudo;
          new Set([...ma.keys(), ...mb.keys()]).forEach((k) => {
            if (ma.get(k) === mb.get(k)) return;
            lines.push(`${k}: ${ma.get(k)} → ${mb.get(k)}`);
            if (k === '@box') return;
            const key = `${el}  ${k}: ${ma.get(k)} → ${mb.get(k)}`, seen = agg.get(key);
            if (seen) seen.n++; else agg.set(key, { n: 1, first: `${where.state} @${where.width} ${where.env}` });
          });
          if (i < 5) note(`    ${row.path}${row.pseudo ? ' ' + row.pseudo : ''}\n      ${lines.slice(0, 10).join('\n      ')}`);
          if (i === 0) pg.list[pg.list.length - 1] += ` (first: ${el} ${lines.slice(0, 2).join('; ')})`;
        });
      }
    }
    if (env.shots) {
      stats.shots++;
      // the window grows to the height of the page, then the shot (like compare.cjs), then back
      // photos are hidden for the shot: Chrome scales the same file slightly differently from run to run. Their files, sizes and places are compared above, compare.cjs shows them.
      const shoot = async () => {
        await both(async (s) => { await s.ev('__sc.hidePhotos(true)'); const h = await s.ev('Math.ceil(document.documentElement.scrollHeight)'); await s.send('Emulation.setDeviceMetricsOverride', { width: where.width, height: h, deviceScaleFactor: 1, mobile: false }); await s.ev('__sc.settle(0)'); });
        const shots = await both((s) => s.send('Page.captureScreenshot', { format: 'png' }));
        await both((s) => s.ev('__sc.hidePhotos(false)'));
        await setWidth(where.width);
        return shots;
      };
      let [sa, sb] = await shoot();
      if (sa.data !== sb.data) {
        let px = await pixelDiff(sa.data, sb.data);
        for (let attempt = 0; px.big > TINY_PX && attempt < 2; attempt++) { stats.retries++; await wait(400); await both((s) => s.ev('__sc.reflow()')); [sa, sb] = await shoot(); px = sa.data === sb.data ? { big: 0 } : await pixelDiff(sa.data, sb.data); }
        if (px.big > TINY_PX) {
          const name =`${where.page}-${where.env}-${where.width}-${String(where.state).replace(/[^\w]+/g, '_')}`.slice(0, 90);
          fs.writeFileSync(path.join(SHOTS, name + '-A.png'), Buffer.from(sa.data, 'base64')); fs.writeFileSync(path.join(SHOTS, name + '-B.png'), Buffer.from(sb.data, 'base64'));
          report(`screenshots differ, ${px.note || px.big + ' px'} → out/same-check/shots/${name}-A.png / -B.png`);
        } else stats.shotsTiny++;
      }
    }
    const got = await B.ev('__sc.cover()'), set = (covered[where.page] = covered[where.page] || new Set()), texts = (coveredTexts[where.page] = coveredTexts[where.page] || new Set());
    got.forEach((r) => { set.add(r.key); texts.add(r.text); });
    allRules[where.page] = allRules[where.page] || (await B.ev('__sc.allRules()'));
    ownTexts[where.page] = ownTexts[where.page] || new Set(await A.ev('__sc.allTexts()'));
  }

  for (const page of opts.pages || PAGES) for (const envName of opts.envs || ENV_NAMES) {
    const env = ENVS[envName], t0 = Date.now(), before = stats.snapshots, want = (x) => !opts.only || opts.only === x;
    const widths = (list) => opts.widths || list;
    if (want('default') || want('pseudo')) {
      await load(page, env);
      if (envName === 'touch') { const hn = await B.ev(`__sc.media('(hover:none)')`); if (!hn) say('  ! touch mode: (hover:none) is not active'); }
      if (want('default')) for (const w of widths(env.defaults)) { await setWidth(w); await check({ page, env: envName, state: 'default', width: w }, env); }
      if (want('pseudo')) {
        for (const cls of PSEUDO) {
          if (opts.pseudo && !cls.join().includes(opts.pseudo)) continue;
          await force(cls);
          for (const w of widths(env.pseudo)) { await setWidth(w); await check({ page, env: envName, state: ':' + cls.join('+:'), width: w }, env); }
          await force([]);
        }
      }
    }
    for (const sc of SCENARIOS[page]) {
      if (!want(sc.name) && !want('states')) continue;
      await setWidth(widths(env.states)[0]);
      await load(page, env);
      for (const st of sc.steps) {
        let failed = null;
        await both(async (s) => { try { await s.ev(st.js); } catch (e) { failed = e.message; } });
        if (failed) { stats.stepErrors++; say(`  ! ${page} · ${sc.name} / ${st.name}: ${failed}`); }
        if (st.forceHover) await both(async (s) => { const { root } = await s.send('DOM.getDocument', { depth: 0 }), { nodeId } = await s.send('DOM.querySelector', { nodeId: root.nodeId, selector: st.forceHover }); await s.send('CSS.forcePseudoState', { nodeId, forcedPseudoClasses: ['hover'] }); });
        await both((s) => s.ev(`__sc.pause(${st.wait || 80})`));
        for (const w of widths(env.states)) { await setWidth(w); await check({ page, env: envName, state: sc.name + ' / ' + st.name, width: w }, env, st.scrollTop); }
      }
    }
    if (!opts.silent) say(`  ${page} · ${envName}: ${stats.snapshots - before} snapshots, ${Math.round((Date.now() - t0) / 1000)} s`);
  }

  // files, failed requests and JS errors, in both directions
  const onlyIn = (x, y) => [...x].filter((v) => !y.has(v));
  const local = new RegExp('^/' + VERSION + '/[^/]+\\.css$');
  const reqA = new Set([...A.requests].filter((u) => !local.test(u))), reqB = new Set([...B.requests].filter((u) => !local.test(u)));
  const lists = [['files requested only by A', onlyIn(reqA, reqB)], ['files requested only by B', onlyIn(reqB, reqA)], ['failed only in A', onlyIn(A.failed, B.failed)], ['failed only in B', onlyIn(B.failed, A.failed)], ['JS errors only in A', onlyIn(A.errors, B.errors)], ['JS errors only in B', onlyIn(B.errors, A.errors)]];
  let extra = 0;
  for (const [name, list] of lists) if (list.length) { extra += list.length; if (!opts.silent) say(`  ${name}: ${list.slice(0, 10).join(', ')}`); note(name + ': ' + list.join(', ')); }
  stats.extra = extra; stats.covered = covered; stats.allRules = allRules; stats.requests = reqA.size; stats.sharedFailed = [...A.failed].filter((x) => B.failed.has(x)); stats.sharedErrors = [...A.errors].filter((x) => B.errors.has(x));
  stats.foreign = {};
  for (const page of Object.keys(coveredTexts)) stats.foreign[page] = [...coveredTexts[page]].filter((t) => !ownTexts[page].has(t));
  A.close(); B.close(); if (C) C.close(); srv.close();
  return stats;
}

function printPart2(stats) {
  for (const [page, p] of Object.entries(stats.byPage)) {
    say(`  ${page}: ${p.snapshots} snapshots compared, ${p.diffs} difference(s)`);
    p.list.slice(0, 15).forEach((x) => say('    ' + x.slice(0, 260)));
    if (p.list.length > 15) say(`    ... and ${p.list.length - 15} more, see report.txt`);
  }
  say(`  screenshots compared: ${stats.shots} (${stats.shotsTiny} of them with tiny rendering noise under the threshold); states read again: ${stats.retries}`);
  for (const [page, agg] of Object.entries(stats.agg)) {
    const rows = [...agg.entries()].sort((a, b) => b[1].n - a[1].n);
    note(`what differs on ${page} (${rows.length} kinds):\n  ` + rows.map(([k, v]) => `×${v.n}  ${k}   [first: ${v.first}]`).join('\n  '));
    if (TRIAL) { say(`  ${page}: ${rows.length} kinds of difference; the most frequent:`); rows.slice(0, 14).forEach(([k, v]) => say(`    ×${v.n}  ${k}`.slice(0, 200))); }
  }
  if (TRIAL) for (const [page, list] of Object.entries(stats.foreign)) {
    say(`  ${page}: ${list.length} rules from the other pages also apply here (they may or may not change anything)`);
    note(`rules from other pages that apply on ${page}:\n  ` + list.join('\n  '));
  }
  say(`  files requested (fonts, images, scripts), same on both sides: ${stats.requests}`);
  if (stats.sharedFailed.length) say(`  failing on BOTH sides (already there, not caused by this): ${stats.sharedFailed.join(', ')}`);
  if (stats.sharedErrors.length) say(`  JS errors on BOTH sides (already there): ${stats.sharedErrors.join(' | ')}`);
  say('COVERAGE — CSS rules that applied to something in at least one tested state');
  for (const page of Object.keys(stats.allRules)) {
    const all = stats.allRules[page], got = stats.covered[page] || new Set(), miss = all.filter((k) => !got.has(k));
    say(`  ${page}: ${all.length - miss.length} of ${all.length}; never applied: ${miss.length}`);
    note(`never applied on ${page}:\n  ` + miss.join('\n  '));
  }
}

// ---------- self-test: break things on purpose, every one must be caught ----------

async function selfTest() {
  let bad = 0;
  const ok = (cond, what) => { say(`  ${cond ? 'caught ' : 'MISSED '} ${what}`); if (!cond) bad++; };
  say('SELF-TEST part 1: the source');
  const html = String(fromGit(`${VERSION}/index.html`));
  const orig = pageSource(html, fromGit, VERSION);
  const test = (mutated, read = fromGit) => compareSource(orig, pageSource(mutated, read, VERSION));
  const sample = '.skip:focus{top:12px}', cmt = (html.match(/\/\*[^*]*\*\//) || [])[0];
  if (!html.includes(sample) || !cmt) throw new Error('self-test samples not found in index.html');
  let c = test(html.replace(sample, '')); ok(c.lost.length === 1 && !c.added.length, 'a rule deleted → 1 lost');
  c = test(html.replace(sample, sample + '.zzz{color:red}')); ok(c.added.length === 1 && !c.lost.length, 'a rule added → 1 added');
  c = test(html.replace(sample, '.skip:focus{top:13px}')); ok(c.lost.length === 1 && c.added.length === 1, 'a value changed → 1 lost + 1 added');
  c = test(html.replace(sample, '').replace('</style>\n\n', '</style>\n\n').replace(/(<\/style>)(?![\s\S]*<\/style>)/, sample + '$1')); ok(c.moved === 1 && !c.lost.length && !c.added.length, 'a rule moved to the end → 1 moved');
  c = test(html.replace(cmt, '')); ok(c.commentsLost.length === 1, 'a comment deleted → 1 comment lost');
  c = test(html.replace('<title>', '<title>x')); ok(!c.htmlSame, 'page text changed → HTML different');
  c = test(html.replace(/style="display: flex"/, '')); ok(!c.htmlSame, 'an inline style removed → HTML different');
  const moved = html.replace(/<style\b[^>]*>[\s\S]*?<\/style>\n?/gi, (m, off) => (off === html.search(/<style\b/i) ? '<link rel="stylesheet" href="fake.css">\n' : ''));
  c = compareSource(orig, pageSource(moved, () => orig.css, VERSION)); ok(sourceProblems(c) === 0, 'correct control: all CSS moved to a linked file → no problems reported');

  say('SELF-TEST part 2: the rendered pages');
  const control = await runPart2({ pages: ['catalog'], envs: ['normal'], widths: [1440, 390], only: 'default', silent: true });
  ok(control.diffs === 0, `correct control: nothing broken → 0 differences (got ${control.diffs})`);
  const cases = [
    ['value changed, default state', { pages: ['index'], envs: ['normal'], only: 'default', widths: [1440], injectB: '.kick{letter-spacing:.09em}' }],
    ['variable changed', { pages: ['catalog'], envs: ['normal'], only: 'default', widths: [1440], injectB: ':root{--red:#c8102f}' }],
    ['only under :hover', { pages: ['catalog'], envs: ['normal'], only: 'pseudo', pseudo: 'hover', widths: [1440], injectB: '.btn-red:hover{background:#000}' }],
    ['only under :focus-visible', { pages: ['product'], envs: ['normal'], only: 'pseudo', pseudo: 'focus-visible', widths: [1440], injectB: ':focus-visible{outline-width:4px}' }],
    ['only at ≤359 px', { pages: ['catalog'], envs: ['normal'], only: 'default', widths: [359], injectB: '@media (max-width:359px){.ft{padding-top:1px}}' }],
    ['only on ::before', { pages: ['index'], envs: ['normal'], only: 'default', widths: [1440], injectB: '.kick::before{width:7px}' }],
    ['only on ::placeholder', { pages: ['index'], envs: ['normal'], only: 'default', widths: [1440], injectB: '#f-tel::placeholder{color:#000}' }],
    ['only on ::selection', { pages: ['product'], envs: ['normal'], only: 'default', widths: [1440], injectB: '::selection{color:#000}' }],
    ['only with form errors', { pages: ['index'], envs: ['normal'], only: 'contact form', widths: [1440], injectB: 'form.tried input:invalid{outline:1px solid #000}' }],
    ['only with the filter sheet open', { pages: ['catalog'], envs: ['normal'], only: 'filter sheet', widths: [390], injectB: '.filt.open{padding-top:1px}' }],
    ['only with the mobile menu open', { pages: ['product'], envs: ['normal'], only: 'mobile menu', widths: [390], injectB: '.mnav{padding-top:1px}' }],
    ['only in reduced-motion mode (+ screenshot)', { pages: ['product'], envs: ['reduced'], only: 'default', widths: [1440], injectB: '@media (prefers-reduced-motion:reduce){.hd{padding-top:1px}}' }],
    ['only on touch screens', { pages: ['index'], envs: ['touch'], only: 'default', widths: [390], injectB: '@media (hover:none){.hd{padding-top:1px}}' }],
    ['a real rule deleted', { pages: ['catalog'], envs: ['normal'], only: 'pseudo', pseudo: 'hover', widths: [1440], mutateB: `(() => { for (const s of document.styleSheets) { let l; try { l = s.cssRules; } catch (e) { continue; } for (let i = 0; i < l.length; i++) if (l[i].selectorText === '.btn-line:hover') { s.deleteRule(i); return; } } throw new Error('rule not found'); })()` }],
    ['two real rules in swapped order', { pages: ['index'], envs: ['normal'], only: 'default', widths: [1440], mutateB: `(() => { for (const s of document.styleSheets) { let l; try { l = s.cssRules; } catch (e) { continue; } for (let i = 0; i < l.length; i++) if (l[i].selectorText === '.info p') { const t = l[i].cssText; s.deleteRule(i); s.insertRule(t, l.length); return; } } throw new Error('rule not found'); })()` }],
    ['a font file that fails to load', { pages: ['catalog'], envs: ['normal'], only: 'default', widths: [1440], injectB: '@font-face{font-family:Geologica;font-weight:900;src:url(nope.woff2)}.hd{font-weight:900}' }]
  ];
  for (const [what, o] of cases) { const r = await runPart2({ ...o, silent: true }); ok(r.diffs + r.extra > 0, `${what} (${r.diffs} differences${r.extra ? ', ' + r.extra + ' in files/errors' : ''})`); }
  say(bad ? `SELF-TEST: ${bad} NOT caught` : 'SELF-TEST: everything was caught');
  return bad;
}

module.exports = { parseCss, pageSource, ruleKey, fromGit, renameSelector, HTML_CHANGES };
if (require.main === module) (async () => {
  const t0 = Date.now();
  let problems = 0;
  // earlier screenshots of differences are this tool's own output, git-ignored
  fs.readdirSync(SHOTS).filter((f) => f.endsWith('.png')).forEach((f) => fs.unlinkSync(path.join(SHOTS, f)));
  if (SELF_TEST) problems = await selfTest();
  else {
    if (TRIAL) say(`TRIAL: B uses only ${TRIAL}; the site files aren't touched`); else problems += part1();
    if (!SOURCE_ONLY) {
      say('PART 2 — the rendered pages');
      const stats = await runPart2();
      printPart2(stats);
      problems += stats.diffs + stats.extra + stats.stepErrors;
      if (stats.stepErrors) say(`  ${stats.stepErrors} state(s) could not be reached`);
    }
    say(problems ? `RESULT: ${problems} difference(s)` : 'RESULT: identical — nothing lost, nothing changed, nothing added');
  }
  say(`(${Math.round((Date.now() - t0) / 1000)} s)`);
  fs.writeFileSync(path.join(OUT, SELF_TEST ? 'self-test.txt' : 'report.txt'), log.join('\n') + '\n');
  process.exit(problems ? 1 : 0);
})().catch((e) => { console.error(e); process.exit(2); });
