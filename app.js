/* App shell: checks you are signed in, shows the Home placeholder, theme switch and sign out. */
(function () {
  'use strict';
  var sb = window.sb;
  function $(s) { return document.querySelector(s); }
  function toLogin() { location.replace('login.html'); }

  var toastTimer;
  function toast(text) {
    var t = $('#toast'); t.textContent = text; t.hidden = false;
    clearTimeout(toastTimer); toastTimer = setTimeout(function () { t.hidden = true; }, 2200);
  }
  function kv(label, value, cls) {
    var row = document.createElement('div'); row.className = 'kv';
    var a = document.createElement('span'); a.textContent = label;
    var b = document.createElement('span'); b.textContent = value; if (cls) b.className = cls;
    row.appendChild(a); row.appendChild(b); return row;
  }
  function greeting() { var h = new Date().getHours(); return h < 12 ? 'Good morning' : h < 18 ? 'Good afternoon' : 'Good evening'; }

  function start(user) {
    $('#boot').hidden = true;
    $('#hello').textContent = greeting() + '.';
    var box = $('#check');
    box.appendChild(kv('Signed in as', user.email || 'unknown'));

    sb.from('profiles').select('display_name').eq('id', user.id).maybeSingle().then(function (r) {
      if (r.error) { box.appendChild(kv('Profile', 'Error: ' + r.error.message, 'neg')); return; }
      if (!r.data) { box.appendChild(kv('Profile', 'Not found', 'neg')); return; }
      box.appendChild(kv('Profile', 'Ready', 'pos'));
      if (r.data.display_name) $('#hello').textContent = greeting() + ', ' + r.data.display_name + '.';
    });
    sb.from('instruments').select('id', { count: 'exact', head: true }).eq('enabled', true).then(function (r) {
      if (r.error) box.appendChild(kv('Pairs', 'Error: ' + r.error.message, 'neg'));
      else box.appendChild(kv('Pairs available', String(r.count), 'pos'));
    });

    document.querySelectorAll('[data-soon]').forEach(function (b) {
      b.addEventListener('click', function () { toast('Coming in the next stage.'); });
    });

    var T = window.OFFPACK_THEME;
    function mark() {
      var cur = T.get();
      document.querySelectorAll('[data-theme-set]').forEach(function (b) { b.classList.toggle('on', b.getAttribute('data-theme-set') === cur); });
    }
    document.querySelectorAll('[data-theme-set]').forEach(function (b) {
      b.addEventListener('click', function () { T.set(b.getAttribute('data-theme-set')); mark(); });
    });
    mark();

    $('#signout').addEventListener('click', function () {
      sb.auth.signOut().then(toLogin).catch(toLogin);
    });
  }

  if (!sb) { $('#boot').textContent = 'Could not load. Refresh the page and try again.'; return; }
  sb.auth.getSession().then(function (r) {
    var s = r.data && r.data.session;
    if (!s) { toLogin(); return; }
    start(s.user);
  }).catch(toLogin);
  sb.auth.onAuthStateChange(function (ev) { if (ev === 'SIGNED_OUT') toLogin(); });
})();
