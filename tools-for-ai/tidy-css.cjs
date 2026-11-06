// Removes the CSS declarations in v/04-11/style.css that can never win: the same selector sets the same property again later in the file,
// under the same condition or none at all. Anything a browser could fall back to is kept (see RISKY and UNSURE).
//   node tools-for-ai/tidy-css.cjs                dry run: lists them in tools-for-ai/out/tidy-removed.txt, changes nothing
//   node tools-for-ai/tidy-css.cjs --apply        rewrites style.css
//   node tools-for-ai/tidy-css.cjs --verify [rev] proof: without the dead declarations, the file in rev (default HEAD) and the working copy are the same
const fs = require('fs'), path = require('path'), { execFileSync } = require('child_process');

const ROOT = path.resolve(__dirname, '..'), FILE = 'v/04-11/style.css', OUT = path.join(__dirname, 'out', 'tidy-removed.txt');
// a later value a browser may not understand: it would ignore it and use the earlier one, so the earlier one is not dead
const RISKY = /\d(dvh|svh|lvh|dvw|svw|lvw|cqi|cqw|cqh|cqb|cqmin|cqmax)\b|color-mix\(|oklch\(|oklab\(|\blch\(|\blab\(|light-dark\(|\b(clip|balance|pretty|stable)\b/;
// a later selector list a browser may reject as a whole: then that rule doesn't exist there
const UNSURE = /::?-(webkit|moz|ms)-|:has\(/;
const SHORTHAND = { 'padding-top': 'padding', 'padding-right': 'padding', 'padding-bottom': 'padding', 'padding-left': 'padding', 'margin-top': 'margin', 'margin-right': 'margin', 'margin-bottom': 'margin', 'margin-left': 'margin' };

const skipString = (s, i) => { const q = s[i]; for (let j = i + 1; j < s.length; j++) { if (s[j] === '\\') j++; else if (s[j] === q) return j + 1; } return s.length; };
const skipComment = (s, i) => { const j = s.indexOf('*/', i + 2); return j < 0 ? s.length : j + 2; };
const squeeze = (s) => s.replace(/\s+/g, ' ').trim();

function scan(css) {
  const rules = [], blocks = [];
  const walk = (start, end, ctx) => {
    for (let i = start; i < end;) {
      if (/\s/.test(css[i])) { i++; continue; }
      if (css.startsWith('/*', i)) { i = skipComment(css, i); continue; }
      let j = i, paren = 0;
      for (; j < end; j++) {
        const c = css[j];
        if (c === '"' || c === "'") { j = skipString(css, j) - 1; continue; }
        if (css.startsWith('/*', j)) { j = skipComment(css, j) - 1; continue; }
        if (c === '(') paren++; else if (c === ')') paren--; else if (!paren && (c === '{' || c === ';')) break;
      }
      if (j >= end) return;
      if (css[j] === ';') { i = j + 1; continue; }
      let k = j + 1, depth = 1;
      for (; k < end && depth; k++) {
        const c = css[k];
        if (c === '"' || c === "'") { k = skipString(css, k) - 1; continue; }
        if (css.startsWith('/*', k)) { k = skipComment(css, k) - 1; continue; }
        if (c === '{') depth++; else if (c === '}') depth--;
      }
      const prelude = css.slice(i, j).trim();
      if (/^@(media|supports|container|layer)\b/.test(prelude)) { const inner = ctx.concat(squeeze(prelude)); blocks.push({ start: i, end: k, bodyStart: j + 1, bodyEnd: k - 1 }); walk(j + 1, k - 1, inner); }
      else if (!prelude.startsWith('@')) rules.push({ start: i, end: k, bodyStart: j + 1, bodyEnd: k - 1, ctx: ctx.join(' '), prelude, body: css.slice(j + 1, k - 1) });
      i = k;
    }
  };
  walk(0, css.length, []);
  return { rules, blocks };
}

const topSplit = (s, sep) => {
  const out = []; let cur = '', depth = 0;
  for (let i = 0; i < s.length; i++) {
    const c = s[i];
    if (c === '"' || c === "'") { const e = skipString(s, i); cur += s.slice(i, e); i = e - 1; continue; }
    if (c === '(' || c === '[') depth++; else if (c === ')' || c === ']') depth--;
    if (c === sep && !depth) { out.push(cur); cur = ''; } else cur += c;
  }
  out.push(cur);
  return out;
};
const branches = (prelude) => topSplit(prelude.replace(/\/\*[\s\S]*?\*\//g, ''), ',').map((b) => squeeze(b).replace(/\s*([>+~])\s*/g, '$1'));
function decls(body) {
  return topSplit(body, ';').map((raw) => {
    const t = raw.trim(), i = t.indexOf(':');
    if (!t || i < 0 || t.includes('/*')) return { raw, skip: true };
    const value = squeeze(t.slice(i + 1)).replace(/\s*!important$/i, '');
    return { raw, prop: t.slice(0, i).trim().toLowerCase(), value, important: /!important\s*$/i.test(t) };
  });
}

// marks dead declarations, from the last rule to the first; a rule's own fallbacks (a:1;a:2 inside one rule) stay
function findDead(rules) {
  const covers = new Map(), dead = [];
  for (let r = rules.length - 1; r >= 0; r--) {
    const R = rules[r], list = decls(R.body), bs = branches(R.prelude);
    R.decls = list;
    if (!R.body.includes('/*')) for (const d of list) {
      if (d.skip) continue;
      const by = bs.map((b) => {
        const forB = covers.get(b); if (!forB) return null;
        const options = (forB.get(d.prop) || []).concat(SHORTHAND[d.prop] ? forB.get(SHORTHAND[d.prop]) || [] : []);
        return options.find((c) => (c.ctx === R.ctx || c.ctx === '') && (c.important || !d.important) && (c.value === d.value || !RISKY.test(c.value))) || null;
      });
      if (by.every(Boolean)) { d.dead = true; dead.push({ rule: R, decl: d, by: by[0] }); }
    }
    if (!UNSURE.test(R.prelude)) for (const d of list) {
      if (d.skip || d.dead) continue;
      for (const b of bs) {
        if (!covers.has(b)) covers.set(b, new Map());
        const m = covers.get(b); if (!m.has(d.prop)) m.set(d.prop, []);
        m.get(d.prop).push({ ctx: R.ctx, important: d.important, value: d.value, prelude: R.prelude });
      }
    }
  }
  return dead;
}

// the file with the dead declarations gone: comments and everything else stay as they are
function rewrite(css) {
  const { rules } = scan(css), dead = findDead(rules);
  let out = css;
  for (let r = rules.length - 1; r >= 0; r--) {
    const R = rules[r], list = R.decls;
    if (!list.some((d) => d.dead)) continue;
    const kept = list.filter((d) => !d.dead && (d.skip ? d.raw.trim() : true));
    const body = kept.map((d) => d.raw).join(';');
    out = kept.length ? out.slice(0, R.bodyStart) + body + out.slice(R.bodyEnd) : out.slice(0, R.start) + out.slice(R.end);
  }
  // @media blocks left with nothing in them, then the lines that became empty
  for (let again = true; again;) {
    again = false;
    const { blocks } = scan(out);
    for (let b = blocks.length - 1; b >= 0; b--) if (!out.slice(blocks[b].bodyStart, blocks[b].bodyEnd).trim()) { out = out.slice(0, blocks[b].start) + out.slice(blocks[b].end); again = true; break; }
  }
  return { css: out.replace(/\n[ \t]+(?=\n)/g, '').replace(/\n{3,}/g, '\n\n'), dead, rules };
}
// the same in a form to compare: every rule with what is left in it
function effective(css) {
  const { css: clean } = rewrite(css), { rules } = scan(clean);
  return rules.map((R) => (R.ctx ? R.ctx + ' ' : '') + branches(R.prelude).join(',') + ' {' + decls(R.body).filter((d) => d.raw.trim()).map((d) => squeeze(d.raw)).join(';') + '}');
}

const args = process.argv.slice(2), file = path.join(ROOT, FILE), current = fs.readFileSync(file, 'utf8').replace(/\r\n/g, '\n');
if (args[0] === '--verify') {
  const rev = args[1] || 'HEAD', old = execFileSync('git', ['show', `${rev}:${FILE}`], { cwd: ROOT, maxBuffer: 64 << 20 }).toString().replace(/\r\n/g, '\n');
  const a = effective(old), b = effective(current);
  const comment = (s) => (s.match(/\/\*[\s\S]*?\*\//g) || []).map(squeeze), ca = comment(old), cb = comment(current);
  let bad = 0;
  for (let i = 0; i < Math.max(a.length, b.length); i++) if (a[i] !== b[i]) { if (bad++ < 10) console.log(`rule ${i}:\n  ${rev}: ${a[i]}\n  now: ${b[i]}`); }
  const lostC = ca.filter((c, i) => ca.indexOf(c) === i && !cb.includes(c)).length;
  console.log(`effective rules: ${a.length} in ${rev}, ${b.length} now, ${bad} different; comments: ${ca.length} in ${rev}, ${cb.length} now, ${lostC} lost; dead declarations left: ${findDead(scan(current).rules).length}`);
  process.exit(bad || lostC ? 1 : 0);
}
const { css, dead, rules } = rewrite(current);
const gone = rules.filter((R) => R.decls.every((d) => d.dead || (d.skip && !d.raw.trim()))).length;
const lines = dead.slice().reverse().map(({ rule, decl, by }) => `${rule.ctx ? rule.ctx + ' ' : ''}${squeeze(rule.prelude)} { ${squeeze(decl.raw)} }\n    set again by: ${by.ctx ? by.ctx + ' ' : ''}${squeeze(by.prelude)} { ${by.value} }`);
fs.mkdirSync(path.dirname(OUT), { recursive: true });
fs.writeFileSync(OUT, lines.join('\n') + '\n');
console.log(`${rules.length} rules, ${dead.length} declarations can never win; ${gone} rules disappear completely; ${current.length} → ${css.length} bytes. List: ${path.relative(process.cwd(), OUT)}`);
if (args[0] === '--apply') { fs.writeFileSync(file, css); console.log('style.css rewritten'); }
