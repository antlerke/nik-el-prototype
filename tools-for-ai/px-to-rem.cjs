// Converts the site's sizes from px to rem (1rem = 16 px at the browser's default size), so the whole site can be drawn
// smaller on computers by one root size (client feedback 19.11: «все завелике»; Anna chose 85 %).
//   node tools-for-ai/px-to-rem.cjs [--dry]
// v/04-11/style.css: every length outside comments and outside @media / @container / @supports conditions.
// v/04-11/*.html and shell.js: lengths inside style="…" attributes.
// Kept in px: hairlines and small offsets up to 2.5 px (borders, rings, ticks), which must stay sharp.
// Exact: n px / 16 always has a short decimal, so at the default root size every value draws exactly as before.
const fs = require('fs'), path = require('path');
const DIR = path.join(__dirname, '..', 'v', '04-11'), DRY = process.argv.includes('--dry');
const rem = (px) => { const v = Math.round((px / 16) * 1e6) / 1e6; return (v === 0 ? '0' : String(v).replace(/^(-?)0\./, '$1.')) + 'rem'; };
const convert = (text, counter) => text.replace(/(^|[^\w.#-])(-?)(\d*\.?\d+)px\b/g, (m, pre, sign, num) => {
  const n = parseFloat(num);
  if (n <= 2.5) { counter.kept++; return m; }
  counter.done++; return pre + rem(+(sign + num));
});
// style.css: walk it, copying comments and at-rule conditions untouched
const css = (src, counter) => {
  let out = '', i = 0;
  while (i < src.length) {
    if (src.startsWith('/*', i)) { const j = src.indexOf('*/', i + 2) + 2; out += src.slice(i, j); i = j; continue; }
    if (src[i] === '@' && /^@(media|container|supports)\b/.test(src.slice(i, i + 12))) { const j = src.indexOf('{', i); out += src.slice(i, j + 1); i = j + 1; continue; }
    // plain text up to the next comment or at-rule
    let j = i; while (j < src.length && !src.startsWith('/*', j) && !(src[j] === '@' && /^@(media|container|supports)\b/.test(src.slice(j, j + 12)))) j++;
    out += convert(src.slice(i, j), counter); i = j;
  }
  return out;
};
const total = { done: 0, kept: 0 };
const cssFile = path.join(DIR, 'style.css'), c1 = { done: 0, kept: 0 };
const cssOut = css(fs.readFileSync(cssFile, 'utf8'), c1);
console.log('style.css: converted', c1.done, 'kept', c1.kept);
if (!DRY) fs.writeFileSync(cssFile, cssOut);
for (const f of fs.readdirSync(DIR).filter((f) => /\.html$/.test(f) || f === 'shell.js')) {
  const p = path.join(DIR, f), src = fs.readFileSync(p, 'utf8'), c = { done: 0, kept: 0 };
  const out = src.replace(/style="([^"]*)"/g, (m, v) => 'style="' + convert(v, c) + '"');
  if (c.done) { console.log(f + ': converted', c.done, 'kept', c.kept); if (!DRY) fs.writeFileSync(p, out); }
  total.done += c.done;
}
console.log('inline styles converted', total.done);
