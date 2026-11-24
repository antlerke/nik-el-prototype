// Puts back blocks removed on 10.11 only because the brief didn't have them (Anna, 24.11: the brief complements the concept,
// it is not a reason to cut). Blocks the brief replaced with its own version stay as they are (about «Більше про компанію»,
// partners «Станьте дистриб’ютором», service «Маєте питання»); the phone and email beside the home form stay out (client feedback).
//   Home: the «06 Сервісний центр» tile after the production steps, the labels under the video, the row of client groups
//         under the partner logos, «Надіслати ще один запит» after the form is sent.
//   Career: «Хто працює в НІК-ЕЛЕКТРОНІКА» after the page head.
//   Vacancies: «Не знайшли свою вакансію?» under the list (the page already has its own band for when there are no vacancies).
// Each piece is copied word for word from the page before its removal; sizes in style="…" become rem.
//   node tools-for-ai/restore-cut-blocks.cjs
const fs = require('fs'), path = require('path'), { execFileSync } = require('child_process');
const ROOT = path.join(__dirname, '..');
const show = (rev, f) => execFileSync('git', ['show', rev + ':v/04-11/' + f], { cwd: ROOT, encoding: 'utf8', maxBuffer: 1 << 26 }).replace(/\r\n/g, '\n');
const rem = (px) => String(Math.round((px / 16) * 1e6) / 1e6).replace(/^0\./, '.') + 'rem';
const toRem = (s) => s.replace(/style="[^"]*"/g, (st) => st.replace(/(\d*\.?\d+)px\b/g, (m, n) => (+n <= 2.5 ? m : rem(+n))));
const cut = (src, from, to) => { const a = src.indexOf(from), b = src.indexOf(to, a); if (a < 0 || b < 0) throw new Error('not found in old page: ' + from); return src.slice(a, b + to.length); };

function edit(file, fn) {
  const p = path.join(ROOT, 'v', '04-11', file);
  let cur = fs.readFileSync(p, 'utf8').replace(/\r\n/g, '\n');
  const put = (anchor, text, after = true) => {
    const i = cur.indexOf(anchor);
    if (i < 0 || cur.indexOf(anchor, i + 1) >= 0) throw new Error(file + ': anchor missing or not unique: ' + anchor);
    cur = after ? cur.slice(0, i + anchor.length) + text + cur.slice(i + anchor.length) : cur.slice(0, i) + text + cur.slice(i);
  };
  fn(put);
  fs.writeFileSync(p, cur.replace(/\n/g, '\r\n'));
}

// home, from the page before 9697836
const home = show('9697836^', 'index.html');
edit('index.html', (put) => {
  put('{{st.t}}</div></li>\n      </sc-for>\n', cut(home, '      <li><div class="ph svc">', '</li>\n'));
  put('до повірки на власному обладнанні.</p>\n', cut(home, '      <div class="vrow">', '</div>\n'));
  put('  </div>\n</section>\n\n<!-- 9. Прес-центр -->', cut(home, '    <div class="mrow rev">', '    </div>\n'), false);
  put('зв\'яжемося з вами протягом 1 робочого дня.</p>\n', toRem(cut(home, '          <button class="btn btn-line" style="margin-top: 28px" onClick="{{again}}">', '</button>\n')));
  put('    const marquee = ', cut(home, '    const seg = [', ';\n'), false);
  put('      marquee,', ' segs: [seg, seg],');
  put("formCls: s.tried ? 'tried' : '',\n", cut(home, '      again: () =>', ',\n'));
});

// career, from the page before aeb165a
const career = show('aeb165a^', 'career.html');
const team = cut(career, '<section class="sec on-paper" aria-labelledby="h-team">', '</section>\n');
edit('career.html', (put) => {
  put('<section class="sec cr-dark"', toRem(team) + '\n', false);
});

// vacancies, from the page before 079a934; the button sends the résumé the same way as the page's other résumé button
const vac = show('079a934^', 'vacancies.html');
const band = cut(vac, '<section class="wrap band-sec">', '</section>\n').replace('<a href="#" class="btn btn-red">Надіслати резюме', '<a href="{{resume}}" class="btn btn-red">Надіслати резюме');
edit('vacancies.html', (put) => {
  put('</main>', '\n<sc-if value="{{hasVacs}}" hint-placeholder-val="{{true}}">\n' + toRem(band) + '</sc-if>\n', false);
});
console.log('done');
