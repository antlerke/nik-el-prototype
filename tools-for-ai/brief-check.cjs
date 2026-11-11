// Proves brief/TZ.md holds the same text as the client's PDF: no word lost, added, changed or moved.
//   node tools-for-ai/brief-check.cjs               compare, list every difference
//   node tools-for-ai/brief-check.cjs --self-test   break TZ.md in memory and confirm the check notices
// Words are compared with their punctuation, first as a count of each word, then in reading order.
// Only the text after <!-- brief-start --> counts. Headings, table bars and bold are markdown, not text.
// Exit code 0 only if there are no differences.
const { execFileSync } = require('child_process'), fs = require('fs'), path = require('path');
const ROOT = path.join(__dirname, '..'), PDF = path.join(ROOT, 'brief/texts-ua.pdf'), MD = path.join(ROOT, 'brief/TZ.md');

// Table headers Google Docs repeats at the top of a page when a table continues there. TZ.md has each table once.
const REPEATED_HEADERS = {
  3: 'Слайд Текст', 5: 'Блок Елемент Текст', 6: 'Елемент Текст', 18: 'Текст',
  29: 'Параметр Значення', 30: '№ Випробування Що підтверджує', 33: 'Сертифікат Опис', 44: 'Елемент Текст',
  46: 'Ситуація Текст', 47: 'Елемент Текст', 48: 'Елемент Текст', 50: 'Елемент Текст',
  55: 'Елемент Текст', 59: '№ Тема Питання Відповідь Посилання', 60: '№ Тема Питання Відповідь Посилання',
  62: 'Хто встановлює Назва Категорія Призначення Строк', 64: 'Коли Які дані',
};
// A question in the chatbot table breaks across a page right before its closing »?
const MD_SPLIT = { 'параметризація»?': ['параметризація', '»?'] };
// The PDF does not store everything in reading order: the About page's SEO table comes after its text (4 gaps),
// and five table rows break across two pages, so the end of a row comes after the next page starts (12 gaps).
const EXPECTED_ORDER_GAPS = 16;

function pdftotext() {
  const bins = ['pdftotext', 'C:/Program Files/Git/mingw64/bin/pdftotext.exe'];
  for (const bin of bins) {
    try { return execFileSync(bin, ['-enc', 'UTF-8', '-raw', PDF, '-'], { encoding: 'utf8', maxBuffer: 1 << 26, stdio: ['ignore', 'pipe', 'ignore'] }); }
    catch (e) { if (e.code !== 'ENOENT') throw e; }
  }
  throw new Error('pdftotext not found');
}

const split = s => s.normalize('NFC').split(/\s+/).filter(Boolean);
function pdfWords() {
  const problems = [], words = [];
  pdftotext().split('\f').forEach((text, i) => {
    const page = split(text.replace(/\u200b/g, '')).filter(w => w !== '●');
    for (const w of split(REPEATED_HEADERS[i + 1] || '')) {
      const at = page.indexOf(w);
      if (at < 0) problems.push(`page ${i + 1}: repeated header word "${w}" is not on the page`); else page.splice(at, 1);
    }
    words.push(...page);
  });
  return { words, problems };
}
function mdWords(md) {
  const start = md.indexOf('<!-- brief-start -->');
  if (start < 0) throw new Error('no <!-- brief-start --> in TZ.md');
  const body = md.slice(start).replace(/<!--[\s\S]*?-->/g, ' ').replace(/!\[[^\]]*\]\([^)]*\)/g, ' ')
    .replace(/\[([^\]]*)\]\((https?:[^)]*)\)/g, '$1').replace(/<br>/g, ' ');
  const lines = body.split('\n').filter(l => !/^\|[-| ]+\|$/.test(l.trim()))
    .map(l => l.replace(/^#{1,6}\s+/, '').replace(/^- /, '').replace(/(?<!\\)\|/g, ' ').replace(/\*\*/g, '').replace(/\\([*_])/g, '$1'));
  return split(lines.join('\n')).flatMap(w => MD_SPLIT[w] || [w]);
}
function counts(a, b) {
  const n = new Map();
  for (const w of a) n.set(w, (n.get(w) || 0) + 1);
  for (const w of b) n.set(w, (n.get(w) || 0) - 1);
  const lost = [], added = [];
  for (const [w, c] of n) { if (c > 0) lost.push(`${w} ×${c}`); if (c < 0) added.push(`${w} ×${-c}`); }
  return { lost, added };
}
// Walks both texts together. Where they part, finds the nearest place they agree again and reports the gap.
function order(a, b) {
  const gaps = [];
  let i = 0, j = 0;
  const same = (p, q) => a[p] === b[q] && a[p + 1] === b[q + 1] && a[p + 2] === b[q + 2];
  while (i < a.length && j < b.length) {
    if (a[i] === b[j]) { i++; j++; continue; }
    let next = null;
    for (let k = 1; k < 600 && !next; k++) for (let x = 0; x <= k; x++) if (same(i + x, j + k - x)) { next = [i + x, j + k - x]; break; }
    if (!next) next = [a.length, b.length];
    gaps.push(`PDF: ${a.slice(i, next[0]).join(' ')}\n    MD:  ${b.slice(j, next[1]).join(' ')}`);
    [i, j] = next;
  }
  return gaps;
}
function missingImages(md) {
  return [...md.matchAll(/!\[[^\]]*\]\(([^)]+)\)/g)].map(m => m[1]).filter(f => !fs.existsSync(path.join(ROOT, 'brief', f)));
}

const md = fs.readFileSync(MD, 'utf8'), pdf = pdfWords();
const report = text => { const w = mdWords(text); return { words: w, ...counts(pdf.words, w), gaps: order(pdf.words, w) }; };
const base = report(md);
if (process.argv.includes('--self-test')) {
  const broken = [['a word removed', md.replace('Точний облік енергоресурсів', 'Точний енергоресурсів')],
    ['a word changed', md.replace('150 000', '150 001')], ['a word added', md.replace('Надіслати запит', 'Надіслати цей запит')],
    ['punctuation changed', md.replace('Усі права захищено.', 'Усі права захищено')],
    ['two table rows swapped', md.replace(/(\| 150 000 \| .*\n)(\| 10 млн\+ \| .*\n)/, '$2$1')]];
  let ok = true;
  for (const [name, text] of broken) {
    const r = report(text), caught = r.lost.length + r.added.length > 0 || r.gaps.length > base.gaps.length;
    console.log(`${caught ? 'caught' : 'MISSED'}: ${name}`);
    ok = ok && caught;
  }
  process.exit(ok ? 0 : 1);
}
const { words, lost, added, gaps } = base, images = missingImages(md);
const list = a => a.length ? '\n  ' + a.join('\n  ') : '';
console.log(`PDF: ${pdf.words.length} words, TZ.md: ${words.length} words`);
console.log(`In the PDF but not in TZ.md: ${lost.length}${list(lost)}`);
console.log(`In TZ.md but not in the PDF: ${added.length}${list(added)}`);
const orderOk = gaps.length === EXPECTED_ORDER_GAPS;
console.log(`Places where the order differs: ${gaps.length} (expected ${EXPECTED_ORDER_GAPS})${orderOk ? '' : list(gaps)}`);
console.log(`Problems with repeated headers: ${pdf.problems.length}${list(pdf.problems)}`);
console.log(`Missing pictures: ${images.length}${list(images)}`);
const clean = !lost.length && !added.length && orderOk && !pdf.problems.length && !images.length;
console.log(clean ? 'OK: the same text in the same order.' : 'DIFFERENT.');
process.exit(clean ? 0 : 1);
