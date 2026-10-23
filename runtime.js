// Minimal runtime for Claude Design (.dc.html) templates: {{holes}}, <sc-for>, <sc-if>,
// on*="{{handler}}" events and setState re-render (DOM patched with morphdom).
(function () {
  var handlers = [];
  var esc = function (s) { return String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;'); };
  function lookup(scope, p) {
    p = p.trim();
    if (p === 'true') return true;
    if (p === 'false') return false;
    return p.split('.').reduce(function (o, k) { return o == null ? undefined : o[k]; }, scope);
  }
  function holes(html, scope) {
    return html
      .replace(/\son([A-Z]\w*)="\{\{([^}]*)\}\}"/g, function (_, ev, p) {
        var fn = lookup(scope, p);
        if (typeof fn !== 'function') return '';
        handlers.push(fn);
        return ' data-on-' + ev.toLowerCase() + '="' + (handlers.length - 1) + '"';
      })
      .replace(/\{\{([^}]+)\}\}/g, function (_, p) {
        var v = lookup(scope, p);
        return v == null || typeof v === 'function' ? '' : esc(v);
      });
  }
  function attr(tag, name) { var m = tag.match(new RegExp(name + '="([^"]*)"')); return m ? m[1] : null; }
  function findClose(html, name, from) {
    var re = new RegExp('<(/?)' + name + '\\b[^>]*>', 'g'), depth = 1, m;
    re.lastIndex = from;
    while ((m = re.exec(html))) { depth += m[1] ? -1 : 1; if (depth === 0) return { start: m.index, end: re.lastIndex }; }
    throw new Error('unclosed ' + name);
  }
  function expand(html, scope) {
    var m = /<(sc-for|sc-if)\b[^>]*>/.exec(html);
    if (!m) return holes(html, scope);
    var name = m[1], openEnd = m.index + m[0].length, close = findClose(html, name, openEnd);
    var body = html.slice(openEnd, close.start), out = '';
    if (name === 'sc-for') {
      var list = lookup(scope, attr(m[0], 'list').replace(/[{}]/g, '')) || [], as = attr(m[0], 'as');
      list.forEach(function (it, i) { var s = Object.assign({}, scope); s[as] = it; s.$index = i; out += expand(body, s); });
    } else if (lookup(scope, attr(m[0], 'value').replace(/[{}]/g, ''))) out = expand(body, scope);
    return holes(html.slice(0, m.index), scope) + out + expand(html.slice(close.end), scope);
  }
  var EVENTS = { click: 'click', mouseenter: 'mouseenter', mouseleave: 'mouseleave', mousemove: 'mousemove', focus: 'focus', submit: 'submit', change: 'change' };
  function bind(root) {
    Object.keys(EVENTS).forEach(function (ev) {
      root.querySelectorAll('[data-on-' + ev + ']').forEach(function (el) {
        el.__dcb = el.__dcb || {};
        if (el.__dcb[ev]) return;
        el.__dcb[ev] = true;
        el.addEventListener(EVENTS[ev], function (e) {
          var fn = handlers[+el.getAttribute('data-on-' + ev)];
          if (fn) fn(e);
        });
      });
    });
  }
  window.DCLogic = function DCLogic(props) { this.props = props || {}; this.state = {}; };
  window.DCLogic.prototype.setState = function (s) {
    Object.assign(this.state, s);
    var self = this;
    if (!this.__q) { this.__q = true; Promise.resolve().then(function () { self.__q = false; self.__render(); }); }
  };
  window.DC = {
    mount: function (Component) {
      var tpl = document.getElementById('tpl').textContent;
      var app = document.getElementById('app');
      var c = new Component({});
      c.__render = function () {
        handlers = [];
        var next = document.createElement('div');
        next.id = 'app';
        next.innerHTML = expand(tpl, c.renderVals()).replace(/\/_blob\/([0-9a-f]{32})/g, function (m, id) { return (window.DC_BLOBS || {})[id] || m; });
        if (window.morphdom) morphdom(app, next, { onBeforeElUpdated: function (from, to) { if (/^(INPUT|TEXTAREA|SELECT)$/.test(from.tagName)) return false; return !from.isEqualNode(to); } });
        else app.innerHTML = next.innerHTML;
        bind(app);
      };
      c.__render();
    }
  };
})();
