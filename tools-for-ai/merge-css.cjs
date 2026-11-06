// Merges the CSS of the pages (as committed in --base) into one stylesheet, comments included.
//   node tools-for-ai/merge-css.cjs            trial: writes only tools-for-ai/out/trial-style.css, for same-check.cjs --trial <file>
//   node tools-for-ai/merge-css.cjs --apply    writes v/04-11/style.css and switches the three pages to it
// Rules identical on several pages become one rule. The merge keeps each page's rules in their own order, so the only thing
// that can change a page is a rule that came from another page. The intended renames live in same-check.cjs.
const fs = require('fs'), path = require('path');
const { parseCss, ruleKey, fromGit, renameSelector, HTML_CHANGES } = require('./same-check.cjs');

const ROOT = path.resolve(__dirname, '..'), VERSION = 'v/04-11', PAGES = ['index', 'catalog', 'product'], APPLY = process.argv.includes('--apply');
const OUT = APPLY ? path.join(ROOT, VERSION, 'style.css') : path.join(__dirname, 'out', 'trial-style.css');

// CSS text -> ordered items: comments between rules, and rules with their original text (a comment inside a rule stays in it)
function parseItems(src) {
  const items = [];
  const skipString = (s, i) => { const q = s[i]; for (let j = i + 1; j < s.length; j++) { if (s[j] === '\\') j++; else if (s[j] === q) return j + 1; } return s.length; };
  const skipComment = (s, i) => { const j = s.indexOf('*/', i + 2); return j < 0 ? s.length : j + 2; };
  const block = (t, ctx) => {
    for (let i = 0; i < t.length;) {
      if (/\s/.test(t[i])) { i++; continue; }
      if (t.startsWith('/*', i)) { const e = skipComment(t, i); items.push({ kind: 'comment', ctx, text: t.slice(i, e), key: 'comment ' + ctx.join(' ') + ' ' + t.slice(i, e).replace(/\s+/g, ' ').trim() }); i = e; continue; }
      let j = i, paren = 0;
      for (; j < t.length; j++) {
        const c = t[j];
        if (c === '"' || c === "'") { j = skipString(t, j) - 1; continue; }
        if (t.startsWith('/*', j)) { j = skipComment(t, j) - 1; continue; }
        if (c === '(') paren++; else if (c === ')') paren--; else if (!paren && (c === '{' || c === ';')) break;
      }
      if (j >= t.length) throw new Error('unclosed CSS: ' + t.slice(i, i + 80));
      if (t[j] === ';') { items.push({ kind: 'rule', ctx, raw: t.slice(i, j + 1) }); i = j + 1; continue; }
      let k = j + 1, depth = 1;
      for (; k < t.length && depth; k++) {
        const c = t[k];
        if (c === '"' || c === "'") { k = skipString(t, k) - 1; continue; }
        if (t.startsWith('/*', k)) { k = skipComment(t, k) - 1; continue; }
        if (c === '{') depth++; else if (c === '}') depth--;
      }
      const prelude = t.slice(i, j).trim();
      if (/^@(media|supports|container|layer)\b/.test(prelude)) block(t.slice(j + 1, k - 1), ctx.concat(prelude.replace(/\s+/g, ' ')));
      else items.push({ kind: 'rule', ctx, prelude, body: t.slice(j + 1, k - 1) });
      i = k;
    }
  };
  block(src, []);
  return items;
}

// the original CSS text of a page and its rules with the intended renames applied
function pageItems(page) {
  const html = String(fromGit(`${VERSION}/${page}.html`)).replace(/\r\n/g, '\n');
  const css = [...html.matchAll(/<style\b[^>]*>([\s\S]*?)<\/style>/gi)].map((m) => m[1]).join('\n');
  const items = parseItems(css);
  items.filter((x) => x.kind === 'rule').forEach((x) => {
    const p = parseCss(x.raw || `${x.prelude}{${x.body}}`).rules[0];
    if (x.raw) { x.key = ruleKey({ ctx: x.ctx, sel: p.sel, decl: p.decl }); return; }
    const sel = renameSelector(page, p.sel);
    x.prelude = sel === p.sel ? x.prelude : renameSelector(page, x.prelude) === x.prelude ? sel : renameSelector(page, x.prelude);
    x.key = ruleKey({ ctx: x.ctx, sel, decl: p.decl });
    x.text = `${x.prelude}{${x.body}}`;
  });
  // every rule of the page must be here: the same count as the parser the check uses
  const rules = items.filter((x) => x.kind === 'rule').length;
  if (rules !== parseCss(css).rules.length) throw new Error(`${page}: ${rules} rules vs ${parseCss(css).rules.length}`);
  return items;
}

// add a page's items to the merged list: longest common subsequence, the rest goes in at its place
function align(base, items, page) {
  const n = base.length, m = items.length, T = Array.from({ length: n + 1 }, () => new Uint16Array(m + 1));
  for (let i = n - 1; i >= 0; i--) for (let j = m - 1; j >= 0; j--) T[i][j] = base[i].key === items[j].key ? T[i + 1][j + 1] + 1 : Math.max(T[i + 1][j], T[i][j + 1]);
  const out = []; let i = 0, j = 0;
  while (i < n || j < m) {
    if (i < n && j < m && base[i].key === items[j].key) { base[i].pages.add(page); out.push(base[i]); i++; j++; }
    else if (j < m && (i === n || T[i][j + 1] >= T[i + 1][j])) { out.push({ ...items[j], pages: new Set([page]) }); j++; }
    else out.push(base[i++]);
  }
  return out;
}

const lists = {};
for (const page of PAGES) lists[page] = pageItems(page);
let merged = lists[PAGES[0]].map((x) => ({ ...x, pages: new Set([PAGES[0]]) }));
for (const page of PAGES.slice(1)) merged = align(merged, lists[page], page);

// a page's items must stay in their own order inside the merged list
for (const page of PAGES) {
  const own = merged.filter((x) => x.pages.has(page)).map((x) => x.key), want = lists[page].map((x) => x.key);
  if (own.length !== want.length || own.some((k, i) => k !== want[i])) throw new Error(`${page}: order not kept`);
}

// consecutive items of the same @media go into one block, in the compact style the pages were written in
const lines = [];
for (let i = 0; i < merged.length;) {
  const ctx = merged[i].ctx, key = ctx.join('|'), group = [];
  while (i < merged.length && merged[i].ctx.join('|') === key) group.push(merged[i++]);
  const text = group.map((x) => (x.kind === 'comment' ? x.text : x.raw || x.text));
  if (!ctx.length) { group.forEach((x, k) => { if (x.kind === 'comment' && lines.length) lines.push(''); lines.push(text[k]); }); continue; }
  lines.push(ctx.reduceRight((inner, c) => `${c}{\n${inner.replace(/^/gm, '  ')}\n}`, text.join('\n')));
}
const css = lines.join('\n') + '\n';
fs.writeFileSync(OUT, css);

const rules = merged.filter((x) => x.kind === 'rule'), by = (k) => rules.filter((x) => x.pages.size === k).length;
const keyCount = new Map(); rules.forEach((x) => keyCount.set(x.key, (keyCount.get(x.key) || 0) + 1));
console.log(`merged: ${rules.length} rules, ${merged.length - rules.length} comments, ${Math.round(css.length / 1024)} KB → ${path.relative(process.cwd(), OUT)}`);
console.log(`on all 3 pages: ${by(3)} · on 2 pages: ${by(2)} · on 1 page: ${by(1)}`);
console.log(`rules that stay twice because pages order them differently: ${[...keyCount.values()].filter((v) => v > 1).length}`);
// the same animation name with a different body would be silently replaced
const frames = new Map(); rules.filter((x) => (x.prelude || '').startsWith('@keyframes')).forEach((x) => frames.set(x.prelude, (frames.get(x.prelude) || new Set()).add(x.body.replace(/\s+/g, ''))));
const clash = [...frames].filter(([, s]) => s.size > 1).map(([k]) => k);
console.log(`animations with the same name but different steps: ${clash.length ? clash.join(', ') : 'none'}`);

if (APPLY) {
  for (const page of PAGES) {
    const file = path.join(ROOT, VERSION, page + '.html'), raw = fs.readFileSync(file, 'utf8'), eol = raw.includes('\r\n') ? '\r\n' : '\n';
    let first = true, html = raw.replace(/<style\b[^>]*>[\s\S]*?<\/style>\r?\n?/gi, () => { if (!first) return ''; first = false; return `<link rel="stylesheet" href="style.css">${eol}`; });
    for (const [from, to] of HTML_CHANGES[`${VERSION}/${page}.html`] || []) { if (!html.includes(from)) throw new Error(`${page}: expected text not found: ${from}`); html = html.replace(from, to); }
    fs.writeFileSync(file, html);
    console.log(`${page}.html: ${first ? 'NO <style> found' : 'now links style.css'}`);
  }
}
