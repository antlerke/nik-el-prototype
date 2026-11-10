// The parts every page shares: header, mobile menu, footer, cookie panel and their data. Change them here, once.
// runtime.js puts SHELL.top and SHELL.bottom where a page's template has <shell-top></shell-top> and <shell-bottom></shell-bottom>.
window.SHELL = {
  top: `<div style="font-family: Geologica, sans-serif; color: var(--text); background: #ffffff; overflow-x: clip">

<a href="#main" class="skip">Перейти до змісту</a>
<header class="hd">
  <div class="wrap">
    <a href="index.html" aria-label="НІК-ЕЛЕКТРОНІКА — на головну" style="display: flex"><img src="../../assets/4acb50f3-nik-logo.svg" alt="НІК-ЕЛЕКТРОНІКА — на головну" style="height: 34px; width: auto; display: block; position: relative; top: -6px"></a>
    <nav aria-label="Головне меню" style="flex: 1 1 auto">
      <ul class="menu">
        <sc-for list="{{menu}}" as="m" hint-placeholder-count="4">
          <li>
            <a href="{{m.href}}" aria-haspopup="true">{{m.t}}<svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.6" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="m6 9 6 6 6-6"></path></svg></a>
            <div class="drop">
              <sc-for list="{{m.items}}" as="i" hint-placeholder-count="4"><a href="{{i.href}}">{{i.t}}</a></sc-for>
            </div>
          </li>
        </sc-for>
      </ul>
    </nav>
    <a href="#" class="docs"><svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M14 3H7a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2V8z"></path><path d="M14 3v5h5M9 13h6M9 17h6"></path></svg>Електронні документи</a>
    <div style="display: flex; align-items: center; gap: 6px">
      <button class="icon burger" type="button" aria-label="{{menuLabel}}" aria-expanded="{{menuExp}}" aria-controls="mnav" onClick="{{toggleMenu}}"><svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" aria-hidden="true"><path d="{{burgerPath}}"></path></svg></button>
      <button class="icon" aria-label="Пошук моделі, документа або статті" title="Пошук моделі, документа або статті"><svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" aria-hidden="true"><circle cx="11" cy="11" r="7"></circle><path d="m20 20-3.5-3.5"></path></svg></button>
      <a href="#" class="icon" aria-label="Увійти в особистий кабінет" title="Увійти в особистий кабінет"><svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" aria-hidden="true"><circle cx="12" cy="8" r="4"></circle><path d="M4 21c1.5-4 4.5-6 8-6s6.5 2 8 6"></path></svg></a>
      <div class="lang"><button type="button" class="lang-btn" aria-haspopup="true" aria-label="Мова сайту: українська">UA<svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.6" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="m6 9 6 6 6-6"></path></svg></button><div class="drop lang-drop" aria-label="Мова сайту"><a href="#" aria-current="true" lang="uk">Українська</a><a href="#" lang="en">English</a><a href="#" lang="ru">Русский</a></div></div>
    </div>
  </div>
</header>
<sc-if value="{{menuOpen}}" hint-placeholder-val="{{false}}">
  <nav class="mnav" id="mnav" aria-label="Мобільне меню" onClick="{{menuClick}}">
    <sc-for list="{{menu}}" as="m" hint-placeholder-count="4">
      <div class="grp">
        <a href="{{m.href}}">{{m.t}}<svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M5 12h14M13 6l6 6-6 6"></path></svg></a>
        <div class="sub"><sc-for list="{{m.items}}" as="i" hint-placeholder-count="4"><a href="{{i.href}}">{{i.t}}</a></sc-for></div>
      </div>
    </sc-for>
    <div class="foot">
      <a href="#" class="btn btn-line" style="width: 100%">Електронні документи</a>
      <a href="index.html#contact" class="btn btn-red" style="width: 100%">Зв'язатися з нами</a>
      <div class="seg" aria-label="Мова сайту" style="align-self: flex-start"><a href="#" aria-current="true">UA</a><a href="#">EN</a><a href="#">RU</a></div>
    </div>
  </nav>
</sc-if>`,
  bottom: `<footer class="ft">
  <div class="wrap">
    <div class="ftop"><img src="../../assets/0fb4110e-nik-logo-white.svg" alt="НІК-ЕЛЕКТРОНІКА" style="height: 64px; width: auto; display: block"></div>
    <div class="fcols">
      <div><b>Контакти</b><span>Тел./факс:<br><a href="tel:+380444980619" class="num">+380 (44) 498-06-19</a></span><a href="mailto:info@nikel.com.ua">info@nikel.com.ua</a><span>Пн–Пт, 8:00–17:00</span></div>
      <div><b>Ми в соцмережах</b><a href="https://www.linkedin.com/company/nik-el-ua/" target="_blank" rel="noopener">LinkedIn</a><a href="https://www.instagram.com/nik.elektronika" target="_blank" rel="noopener">Instagram</a><a href="https://www.facebook.com/nik.elektronika.ua" target="_blank" rel="noopener">Facebook</a><a href="https://www.youtube.com/@nik-elektronika" target="_blank" rel="noopener">YouTube</a></div>
      <div><b>Юридична інформація</b><a href="#">Політика конфіденційності</a><a href="#">Політика використання файлів cookie</a><a href="#">Згода на обробку персональних даних</a><a href="#" onClick="{{openCookie}}">Налаштування cookie</a></div>
      <div><b>Навігація</b><a href="index.html#contact">Зв'язатися з нами</a></div>
    </div>
    <div class="fbot">
      <span>© 2005–2026 ТОВ «НІК-ЕЛЕКТРОНІКА». Усі права захищено.</span>
    </div>
  </div>
</footer>

<!-- Cookie-банер -->
<sc-if value="{{cookie}}" hint-placeholder-val="{{true}}">
  <div class="cookie" role="region" aria-label="Налаштування cookie">
    <p>Ми використовуємо необхідні cookie, щоб сайт працював. За вашою згодою також використаємо аналітичні cookie і сторонні сервіси — карти та відео. Детальніше — у <a href="#">Політиці cookie</a>.</p>
    <div class="row">
      <button class="btn btn-ink" onClick="{{closeCookie}}">Прийняти всі</button>
      <button class="btn btn-line" onClick="{{closeCookie}}">Лише необхідні</button>
      <button class="btn lnk" onClick="{{openCookie}}">Налаштувати</button>
    </div>
  </div>
</sc-if>
<sc-if value="{{cookieSet}}" hint-placeholder-val="{{false}}">
  <div class="cookie cookie-set" role="region" aria-labelledby="cookie-set-h">
    <h2 id="cookie-set-h">Налаштування cookie</h2>
    <label class="consent"><input type="checkbox" checked="" disabled=""><span><b>Необхідні</b> (завжди увімкнені) — мова сайту, вхід до кабінету, захист форм.</span></label>
    <label class="consent"><input type="checkbox"><span><b>Аналітичні</b> — допомагають нам розуміти, як користуються сайтом.</span></label>
    <label class="consent"><input type="checkbox"><span><b>Сторонні сервіси</b> — карти Google Maps і відео YouTube.</span></label>
    <div class="row"><button class="btn btn-ink" onClick="{{closeCookie}}">Зберегти вибір</button></div>
  </div>
</sc-if>

</div>`
};

// what the shared parts need from every page: Object.assign(this.base(s), { ...the page's own values })
DCLogic.prototype.base = function (s) {
  const isMenu = (t, href, items) => ({ t, href, items: items.map((x) => (Array.isArray(x) ? { t: x[0], href: x[1] } : { t: x, href })) });
  return {
    menu: [
      isMenu('Каталог', 'catalog.html', ['Продукти', ['Послуги', 'services.html'], ['Програмне забезпечення', 'software.html'], 'Таблиця взаємозамінності', 'Порівняти товари']),
      isMenu('Про нас', 'about.html', ['Про компанію', ['Історія компанії', 'history.html'], ['Кар’єра', 'career.html'], ['Вакансії', 'vacancies.html'], ['Центр оцінки відповідності', 'conformity.html'], ['Наші партнери', 'partners.html']]),
      isMenu('Контакти', 'where.html', ['Де купити', ['Сервісний центр', 'service.html']]),
      isMenu('Прес-центр', 'news.html', ['Новини', ['НІКіпедія', '#'], ['Ми у ЗМІ', '#']])
    ],
    cookie: s.cookie && !s.menu && !s.cookieSet,
    cookieSet: s.cookieSet && !s.menu,
    menuOpen: s.menu, menuExp: String(s.menu), menuLabel: s.menu ? 'Закрити меню' : 'Відкрити меню',
    burgerPath: s.menu ? 'M6 6l12 12M18 6 6 18' : 'M4 7h16M4 12h16M4 17h16',
    toggleMenu: () => this.setState({ menu: !s.menu }),
    menuClick: (e) => { if (e && e.target && e.target.closest && e.target.closest('a')) this.setState({ menu: false }); },
    closeCookie: () => this.setState({ cookie: false, cookieSet: false }),
    openCookie: (e) => { if (e && e.preventDefault) e.preventDefault(); this.setState({ cookieSet: true }); }
  };
};
