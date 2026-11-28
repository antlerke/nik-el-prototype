// Builds the demo view.html (a long real news item in the new article layout) from v/04-11/article.html + body.html.
//   node tools-for-ai/options/news-long/build.cjs
const fs = require('fs'), path = require('path');
const root = path.join(__dirname, '../../..');
let s = fs.readFileSync(path.join(root, 'v/04-11/article.html'), 'utf8');
const body = fs.readFileSync(path.join(__dirname, 'body.html'), 'utf8');
const a = s.indexOf('    <nav class="lg-toc"'), end = '    </article>';
const b = s.indexOf(end) + end.length + (s[s.indexOf(end) + end.length] === '\r' ? 2 : 1);
s = s.slice(0, a) + body + s.slice(b);
s = s.replace('<meta charset="utf-8">', '<meta charset="utf-8">\n<!-- Demo for Anna (28.11): a long real news item from nik-el.com in the new article layout. Shown inside the switcher: http://127.0.0.1:8740/tools-for-ai/options/news-long/index.html -->\n<base href="../../../v/04-11/">');
s = s.replace(/<title>.*?<\/title>/, '<title>Підключення лічильників через трансформатори струму — НІК-ЕЛЕКТРОНІКА</title>');
s = s.replace(/<h1>.*?<\/h1>/, '<h1>Підключення лічильників через трансформатори струму</h1>');
s = s.replace(/<p class="lead">.*?<\/p>/, '<p class="lead">З 2017 року НІК-ЕЛЕКТРОНІКА випускає трансформатори струму нової конструкції: як вони влаштовані, де застосовуються і яким стандартам відповідають.</p>');
s = s.replace('<time datetime="2023-02-01">01.02.2023</time> · 3&nbsp;хв читання', '<time datetime="2020-12-11">11.12.2020</time> · 6&nbsp;хв читання');
s = s.replace('<span class="tag">Сертифікація</span><span><time', '<span class="tag">Продукція</span><span><time');
s = s.replace('<span aria-current="page">ISO&nbsp;27001</span>', '<span aria-current="page">Трансформатори струму</span>');
s = s.replace("const tc = { s1: '', s2: '' };", "const tc = { s1: '', s2: '', s3: '', s4: '', s5: '', s6: '' };");
fs.writeFileSync(path.join(__dirname, 'view.html'), s);
console.log('ok', (s.match(/<h2 id="s/g) || []).length, 'sections');
