// Compares the client's texts (brief/TZ.md) with what the pages of v/04-11 really show, in both directions.
//   node tools-for-ai/brief-compare.cjs
// Prints a summary table; the details go to tools-for-ai/out/brief-compare/report.txt:
//   - each text of the brief: found as written, found with other punctuation, partly found (% of its word triples,
//     with the closest text on the page), or missing, and on which other page it was found if any;
//   - Title and Meta description compared with the page's own;
//   - the shared header, footer and contact form against every page;
//   - each block of text on the page's main part that the brief doesn't have.
// A page's text is its rendered DOM, plus its template and script strings, so states shown only after a click count too.
const { spawn } = require('child_process'), fs = require('fs'), path = require('path');
const ROOT = path.join(__dirname, '..'), OUT = path.join(ROOT, 'tools-for-ai/out/brief-compare'), TMP = path.join(ROOT, 'tools-for-ai/out/tmp');
const PAGES = ['index', 'catalog', 'product', 'about', 'history', 'career', 'vacancies', 'news', 'article', 'conformity', 'partners', 'cases', 'service', 'where', 'services', 'contract', 'hv', 'askoe', 'custom', 'repair', 'software', 'culture', 'students', 'nikipedia', 'nikipedia-article', 'media', '404', 'search', 'documents', 'cookies', 'privacy', 'consent'];
const SECTION_PAGE = { 'Головна': 'index', 'НІКіпедія': 'nikipedia', 'Ми у ЗМІ': 'media', 'Службові сторінки (404, пошук)': '404', 'Електронні документи': 'documents', 'Політика cookie': 'cookies', 'Політика конфіденційності': 'privacy', 'Згода на обробку персональних даних': 'consent', 'Корпоративна культура': 'culture', 'Студентам і випускникам': 'students', 'Послуги': 'services', 'Контрактне виробництво': 'contract', 'Високовольтні мережі': 'hv', 'Впровадження АСКОЕ': 'askoe', 'Розробка на замовлення': 'custom', 'Ремонт лічильників': 'repair', 'Програмне забезпечення': 'software', 'Про компанію': 'about', 'Історія компанії': 'history', "Кар'єра": 'career', 'Вакансії': 'vacancies', 'Новини': 'news',
  'Центр оцінки відповідності': 'conformity', 'Наші партнери': 'partners', "Кейси та об'єкти": 'cases', 'Сервісний центр': 'service' };
const SHARED = /^(1\. Хедер|10\. Футер|9\. CTA)/; // blocks of the home page's part of the brief that every page has
const LABEL_COLUMNS = new Set(['Елемент', '', 'Блок', 'Слайд', 'Фото', 'Ситуація', 'Подія', '№', 'Тема', 'Посилання']);
const NOT_SITE_TEXT = /^(За вайрфреймом|Слайди каруселі|Alt-тексти|Випадні списки|Плитки \(|Грід карток|Кнопки на інших сторінках|додати |Текст UA:|Галерея з фото|Куди надходять)/;
const PREFIX = /^(H[1-6]|Кнопка|Кнопки|Заклик внизу|Заклик|Текст|Плашка-попередження|Примітка внизу|Кнопки внизу|Переваги \(3 плитки\)|Вступне гасло під H1|Стрілки слайдера):\s*/;

const norm = (s) => s.normalize('NFC').toLowerCase().replace(/[\u2019\u02bc`]/g, "'").replace(/[\u00ad\u2060\u200b]/g, '').replace(/\\([*_])/g, '$1').replace(/[\s\u00a0\u202f]+/g, ' ').trim();
const words = (s) => norm(s).replace(/[^\p{L}\p{N}']+/gu, ' ').trim().split(' ').filter(Boolean);
const loose = (s) => ' ' + words(s).join(' ') + ' ';
const triples = (w) => { const t = new Set(); for (let i = 0; i + 2 < w.length; i++) t.add(w.slice(i, i + 3).join(' ')); return t; };
const short = (s, n = 150) => { s = s.replace(/\s+/g, ' ').trim(); return s.length > n ? s.slice(0, n) + '…' : s; };
const cut = (l) => l.trim().replace(/^\||\|$/g, '').split(/(?<!\\)\|/).map((c) => c.trim());
const delimiter = (l) => !!l && /^\|[-| ]+\|$/.test(l.trim());

function parseBrief(md) {
  const lines = md.slice(md.indexOf('<!-- brief-start -->')).replace(/<!--[\s\S]*?-->/g, '').split('\n');
  const sections = []; let s = null, sub = '', head = null;
  const add = (kind, text, label) => {
    text = text.replace(/\*\*/g, '').replace(/<br>/g, ' ').replace(/\[([^\]]*)\]\(https?:[^)]*\)/g, '$1').replace(/\\\*/g, '').trim();
    if (!text || text === '—' || /^\[[^\]]*\]$/.test(text) || /^https?:/.test(text)) return;
    s.units.push({ kind, sub, label: label || '', text });
  };
  lines.forEach((l, i) => {
    if (/^## /.test(l)) { s = { title: l.slice(3).trim(), units: [] }; sections.push(s); sub = ''; return; }
    if (!s) return;
    const h = l.match(/^#{3,4} (.*)/);
    if (h) { sub = h[1].trim(); if (!/^(SEO|Додати|\d+(–\d+)?\. )/.test(sub)) add('heading', sub); return; }
    if (l.startsWith('|')) {
      if (delimiter(l)) return;
      if (delimiter(lines[i + 1])) { head = cut(l); return; }
      const cells = cut(l), label = cells.filter((_, c) => LABEL_COLUMNS.has(head[c])).join(' / ');
      if (/^(Title|Meta description)/.test(cells[0]) && head[0] === 'Елемент') {
        if (/^(Title|Title сторінки|Meta description)( \(до \d+ знаків\))?$/.test(cells[0])) add(cells[0].startsWith('Title') ? 'title' : 'meta', cells[1], cells[0]);
        return;
      }
      cells.forEach((c, n) => { if (LABEL_COLUMNS.has(head[n])) return; c.split(/\s·\s|\sКнопк[аи]:\s/).forEach((p) => add('cell', p, label)); });
      return;
    }
    let t = l.trim();
    if (!t || t.startsWith('![')) return;
    t = t.replace(/\*\*/g, '').replace(/^- /, '').replace(/^\d+\. /, '');
    if (NOT_SITE_TEXT.test(t) || t.endsWith(':')) return;
    const stripped = t.replace(PREFIX, '');
    (stripped !== t && stripped.includes(' · ') ? stripped.split(/\s·\s/) : [stripped]).forEach((p) => add('text', p));
  });
  return sections;
}

function collect() {
  const SKIP = 'script,style,template,noscript,svg,model-viewer';
  const inline = (d) => d === 'inline' || d === 'contents', texty = (el) => !!el.textContent.trim();
  const hasBlockChild = (el) => { for (const c of el.children) { if (c.matches(SKIP)) continue; const d = getComputedStyle(c).display; if (d === 'none') continue; if ((!inline(d) && texty(c)) || hasBlockChild(c)) return true; } return false; };
  const zone = (el) => el.closest('header.hd') ? 'header' : el.closest('footer.ft') ? 'footer' : el.closest('.cookie') ? 'cookie' : el.closest('.mnav') ? 'mnav' : el.closest('nav') ? 'nav' : 'main';
  const blocks = [];
  for (const el of document.body.querySelectorAll('*')) {
    if (el.closest(SKIP)) continue;
    const d = getComputedStyle(el).display;
    if (d === 'none' || inline(d) || !texty(el) || hasBlockChild(el)) continue;
    blocks.push({ zone: zone(el), tag: el.tagName.toLowerCase(), text: el.textContent.replace(/\s+/g, ' ').trim() });
  }
  const walker = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT), parts = [];
  while (walker.nextNode()) if (!walker.currentNode.parentElement.closest(SKIP)) parts.push(walker.currentNode.nodeValue);
  const attrs = [...document.querySelectorAll('[placeholder],[alt],[aria-label],[title],input[value]')].flatMap((e) => ['placeholder', 'alt', 'aria-label', 'title', 'value'].map((a) => e.getAttribute(a)).filter(Boolean));
  const html = (s) => new DOMParser().parseFromString(s, 'text/html').body.textContent;
  const tpl = document.getElementById('tpl');
  const code = [...document.querySelectorAll('script:not([src]):not(#tpl)')].map((s) => s.textContent).join('\n');
  const strings = [...code.matchAll(/'((?:[^'\\\n]|\\.)*)'|"((?:[^"\\\n]|\\.)*)"|`((?:[^`\\]|\\.)*)`/g)].map((m) => m[1] || m[2] || m[3] || '').filter((s) => /[\u0400-\u04ff]/.test(s))
    .map((s) => html(s.replace(/\\(['"`])/g, '$1').replace(/\\u([0-9a-f]{4})/gi, (_, h) => String.fromCharCode(parseInt(h, 16)))));
  return { title: document.title, description: (document.querySelector('meta[name=description]') || {}).content || '', text: parts.join(' '), attrs, raw: (tpl ? html(tpl.textContent) : '') + ' ' + strings.join(' '), blocks };
}

async function render() {
  fs.mkdirSync(TMP, { recursive: true });
  const port = 9300 + Math.floor(Math.random() * 600), http = 8800 + Math.floor(Math.random() * 100), profile = path.join(TMP, 'brief-' + port);
  const env = { ...process.env, TMP, TEMP: TMP };
  const server = spawn(process.execPath, [path.join(ROOT, 'tools-for-ai/serve.cjs'), String(http)], { stdio: 'ignore' });
  const CHROME = ['C:/Program Files/Google/Chrome/Application/chrome.exe', '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome', '/usr/bin/google-chrome'].find(fs.existsSync);
  const chrome = spawn(CHROME, ['--headless=new', '--hide-scrollbars', '--user-data-dir=' + profile, '--remote-debugging-port=' + port, 'about:blank'], { stdio: 'ignore', env });
  const wait = (ms) => new Promise((r) => setTimeout(r, ms));
  try {
    let tabs;
    for (let i = 0; i < 50 && !tabs; i++) { await wait(200); tabs = await fetch(`http://127.0.0.1:${port}/json`).then((r) => r.json()).catch(() => null); }
    const ws = new WebSocket(tabs.find((t) => t.type === 'page').webSocketDebuggerUrl);
    await new Promise((r) => (ws.onopen = r));
    let id = 0; const pending = {};
    ws.onmessage = (m) => { const d = JSON.parse(m.data); if (d.id && pending[d.id]) { pending[d.id](d.result); delete pending[d.id]; } };
    const send = (method, params = {}) => new Promise((r) => { pending[++id] = r; ws.send(JSON.stringify({ id, method, params })); });
    const value = async (expression) => (await send('Runtime.evaluate', { expression, returnByValue: true })).result.value;
    await send('Runtime.enable');
    await send('Emulation.setDeviceMetricsOverride', { width: 1440, height: 900, deviceScaleFactor: 1, mobile: false });
    const out = {};
    for (const page of PAGES) {
      await send('Page.navigate', { url: `http://127.0.0.1:${http}/v/04-11/${page}.html` });
      for (let i = 0; i < 50; i++) { await wait(200); if (await value(`document.readyState === 'complete' && !!document.querySelector('#app main')`)) break; }
      await wait(1200);
      out[page] = await value('(' + collect + ')()');
      if (!out[page] || !out[page].blocks.length) throw new Error('nothing rendered on ' + page);
    }
    ws.close();
    return out;
  } finally {
    chrome.kill(); server.kill(); await wait(1000);
    try { fs.rmSync(profile, { recursive: true, force: true }); } catch {}
  }
}

function hay(p) {
  const all = [p.text, ...p.attrs, p.raw].join(' ');
  const w = words(all);
  return { strict: norm(all), loose: ' ' + w.join(' ') + ' ', tri: triples(w), blocks: p.blocks.map((b) => ({ ...b, set: new Set(words(b.text)) })) };
}
const withoutNotes = (t) => t.replace(/\([^)]*\)/g, ' ').replace(/\[[^\]]*\]/g, ' ').replace(/\s+/g, ' ').trim();
function match(text, h) {
  const n = norm(text);
  if (h.strict.includes(n)) return { status: 'exact' };
  if (h.loose.includes(loose(text))) return { status: 'punct' };
  const bare = withoutNotes(text);
  if (bare && bare !== text && words(bare).length && h.loose.includes(loose(bare))) return { status: 'notes' };
  const w = words(text), t = triples(w);
  let pct = 0;
  if (t.size) { let hit = 0; for (const x of t) if (h.tri.has(x)) hit++; pct = Math.round(100 * hit / t.size); }
  const set = new Set(w); let best = null, score = 0;
  for (const b of h.blocks) { let common = 0; for (const x of set) if (b.set.has(x)) common++; const d = 2 * common / (set.size + b.set.size || 1); if (d > score) { score = d; best = b; } }
  return { status: pct >= 30 || score >= 0.6 ? 'partial' : 'missing', pct, closest: score >= 0.35 ? best.text : '' };
}

(async () => {
  const brief = parseBrief(fs.readFileSync(path.join(ROOT, 'brief/TZ.md'), 'utf8'));
  const raw = await render(), hays = Object.fromEntries(PAGES.map((p) => [p, hay(raw[p])]));
  const elsewhere = (text, except) => PAGES.filter((p) => p !== except && ['exact', 'punct', 'notes'].includes(match(text, hays[p]).status));
  const log = [], table = [];
  const wholeBrief = loose(brief.flatMap((s) => s.units.map((u) => u.text)).join(' '));
  for (const s of brief) {
    const page = SECTION_PAGE[s.title];
    log.push('', '='.repeat(100), `## ${s.title} → ${page ? page + '.html' : 'NO PAGE ON THE SITE'}`);
    const sum = { exact: 0, punct: 0, notes: 0, partial: 0, missing: 0 }; let title = '', meta = '';
    const items = [];
    for (const u of s.units) {
      if (u.kind === 'title' || u.kind === 'meta') {
        if (!page) continue;
        const site = u.kind === 'title' ? raw[page].title : raw[page].description, same = norm(site) === norm(u.text);
        if (u.kind === 'title') title = same ? 'OK' : 'DIFF'; else meta = same ? 'OK' : site ? 'DIFF' : 'NONE';
        log.push(`${same ? 'OK  ' : 'DIFF'} ${u.kind}\n     brief: ${u.text}\n     site:  ${site || '(none)'}`);
        continue;
      }
      if (!page) { const on = elsewhere(u.text); sum[on.length ? 'exact' : 'missing']++; if (on.length) items.push(`  on ${on.join(', ')}: [${u.sub}] ${short(u.text, 110)}`); continue; }
      const m = match(u.text, hays[page]);
      sum[m.status]++;
      if (['partial', 'missing'].includes(m.status)) {
        const on = elsewhere(u.text, page);
        items.push(`${m.status === 'partial' ? 'PART' : 'MISS'}${m.pct ? ' ' + m.pct + '%' : ''} [${short(u.sub, 40)}]${u.label ? ' (' + short(u.label, 40) + ')' : ''} ${short(u.text)}${on.length ? '\n     also on: ' + on.join(', ') : ''}${m.closest ? '\n     closest: ' + short(m.closest) : ''}`);
      } else if (m.status === 'punct') items.push(`PUNC [${short(u.sub, 40)}] ${short(u.text)}`);
    }
    log.push(...items);
    table.push([s.title, page || '—', s.units.filter((u) => u.kind !== 'title' && u.kind !== 'meta').length, sum.exact + sum.notes, sum.punct, sum.partial, sum.missing, title || '—', meta || '—']);
    if (page) {
      const secText = loose(s.units.map((u) => u.text).join(' '));
      const extra = raw[page].blocks.filter((b) => b.zone === 'main' && words(b.text).length >= 2);
      const lines = extra.filter((b) => !secText.includes(loose(b.text))).map((b) => `  ${b.tag}${wholeBrief.includes(loose(b.text)) ? ' (elsewhere in the brief)' : ''}: ${short(b.text, 170)}`);
      log.push('', `--- On the page, not in this part of the brief: ${lines.length} of ${extra.length} blocks`, ...lines);
    }
  }
  log.push('', '='.repeat(100), '## Pages with no part of their own in the brief');
  for (const p of PAGES.filter((x) => !Object.values(SECTION_PAGE).includes(x))) {
    const main = raw[p].blocks.filter((b) => b.zone === 'main' && words(b.text).length >= 2), inBrief = main.filter((b) => wholeBrief.includes(loose(b.text)));
    log.push(`${p}.html: ${main.length} blocks, ${inBrief.length} of them in the brief · title: ${raw[p].title} · description: ${raw[p].description || '(none)'}`);
  }
  log.push('', '='.repeat(100), '## Shared blocks (header, footer, form) against every page; only what is missing somewhere');
  for (const u of brief[0].units.filter((x) => SHARED.test(x.sub))) {
    const missing = PAGES.filter((p) => !['exact', 'punct', 'notes'].includes(match(u.text, hays[p]).status));
    if (missing.length) log.push(`${missing.length === PAGES.length ? 'NOWHERE' : missing.length + '/' + PAGES.length} [${short(u.sub, 24)}] ${u.label ? '(' + short(u.label, 30) + ') ' : ''}${short(u.text, 110)}${missing.length < PAGES.length ? '\n     missing on: ' + missing.join(', ') : ''}`);
  }
  fs.mkdirSync(OUT, { recursive: true });
  fs.writeFileSync(path.join(OUT, 'report.txt'), log.join('\n') + '\n');
  fs.writeFileSync(path.join(OUT, 'pages.json'), JSON.stringify(Object.fromEntries(PAGES.map((p) => [p, raw[p].blocks])), null, 1));
  console.log('section | page | texts | as written | other punctuation | partly | missing | title | meta');
  for (const r of table) console.log(r.join(' | '));
  console.log('\nDetails: tools-for-ai/out/brief-compare/report.txt');
})().catch((e) => { console.error(e); process.exit(1); });
