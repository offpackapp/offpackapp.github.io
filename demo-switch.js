/* OFFPACK demo switch: lets a logged-in user try the demo inside the app, with a balance they can change.
   Loaded after app.js. The switch is remembered for this tab only (sessionStorage), so closing the tab ends the demo.
   config.js turns the switch into the same mode as app.html?demo=1, so the made-up trades in app.js do the rest.
   In demo mode nothing is saved and your real account and trades are never touched. */
(function () {
  'use strict';
  var U = window.OFFPACK_U, D = window.OFFPACK_DATA, A = window.OFFPACK_ACCOUNT, V = window.OFFPACK_VIEWS;
  var T = window.OFFPACK_THEME, C = window.OFFPACK_CALC, CFG = window.OFFPACK;
  if (!U || !D || !A || !V || !T || !C || !CFG || !CFG.demoEnabled) return;

  var FLAG = 'offpack_demo', BAL = 'offpack_demo_balance';
  var PRESETS = [1000, 5000, 10000, 50000, 100000];

  function read(k) { try { return sessionStorage.getItem(k); } catch (e) { return null; } }
  function write(k, v) { try { sessionStorage.setItem(k, v); } catch (e) {} }
  function clear() { try { sessionStorage.removeItem(FLAG); sessionStorage.removeItem(BAL); } catch (e) {} }
  function reloadHome() { location.hash = '#home'; location.reload(); }
  function money(n) { return C.fmtMoney(n); }

  // true only when this tab was switched into the demo from inside a logged-in account
  var inApp = read(FLAG) === '1' && !!window.OFFPACK_DEMO;

  function startDemo() {
    write(FLAG, '1');
    if (read(FLAG) !== '1') { U.toast('The demo could not start in this browser.'); return; }
    reloadHome();
  }
  function exitDemo() { clear(); reloadHome(); }

  // ---- demo balance
  function randomBalance(current) {
    var n, tries = 0, v, step;
    do {
      v = Math.exp(Math.log(500) + Math.random() * (Math.log(250000) - Math.log(500)));
      step = v < 5000 ? 100 : v < 50000 ? 500 : 5000;
      n = Math.round(v / step) * step; tries++;
    } while (n === current && tries < 5);
    return n;
  }
  function setBalance(view, n) {
    var msg = U.$('#d-msg', view);
    if (!(n > 0 && n <= 1000000000)) { msg.textContent = 'Enter a balance between 1 and 1,000,000,000.'; msg.hidden = false; return; }
    D.saveProfile({ account_balance: n }).then(function () {
      write(BAL, String(n)); U.toast('Demo balance set to ' + money(n) + '.'); renderDemoAccount(view);
    });
  }

  // ---- the Account screen while in demo
  function renderDemoAccount(view) {
    var cur = T.get(), bal = D.accountSize();
    view.innerHTML = '<h1>Demo</h1>' +
      '<div class="card"><p>You are in the demo. The trades are made up and nothing is saved. Your real account and trades are untouched.</p></div>' +
      '<div class="card"><h3>Demo balance</h3><p class="muted" style="margin-bottom:12px">Pick a starting balance, type your own, or shuffle for a random one.</p>' +
      '<div class="chips">' + PRESETS.map(function (n) { return '<button type="button" class="chip' + (bal === n ? ' on' : '') + '" data-bal="' + n + '">' + money(n).replace(/\.00$/, '') + '</button>'; }).join('') + '</div>' +
      '<label class="field"><span class="lbl">Balance (USD)</span><input class="in" id="d-bal" inputmode="decimal" value="' + U.esc(bal === null ? '' : bal) + '"></label>' +
      '<p class="msg err" id="d-msg" hidden></p>' +
      '<div class="stack"><button type="button" class="btn" id="d-set">Set balance</button><button type="button" class="btn ghost" id="d-shuffle">Shuffle balance</button></div></div>' +
      '<div class="card"><h3>Appearance</h3><div class="seg">' + ['system', 'dark', 'light'].map(function (m) { return '<button type="button" class="' + (cur === m ? 'on' : '') + '" data-theme-set="' + m + '">' + m[0].toUpperCase() + m.slice(1) + '</button>'; }).join('') + '</div></div>' +
      '<div class="stack"><button type="button" class="btn" id="d-exit">Exit demo</button><button type="button" class="btn ghost" id="d-out">Log out</button></div>';
    view.onclick = function (e) {
      var b = e.target.closest('button'); if (!b) return;
      var theme = b.getAttribute('data-theme-set'), preset = b.getAttribute('data-bal');
      if (theme) { T.set(theme); return renderDemoAccount(view); }
      if (preset) return setBalance(view, Number(preset));
      if (b.id === 'd-set') return setBalance(view, C.parseNum(U.$('#d-bal', view).value));
      if (b.id === 'd-shuffle') return setBalance(view, randomBalance(bal));
      if (b.id === 'd-exit') return exitDemo();
      if (b.id === 'd-out') {
        var go = function () { location.replace('login.html'); };
        clear(); if (!window.sb) return go(); window.sb.auth.signOut().then(go, go);
      }
    };
  }

  // ---- hook into the screens that already exist
  var accountOrig = A.render;
  A.render = function (view) {
    if (inApp) return renderDemoAccount(view);
    accountOrig(view);
    try {
      if (window.OFFPACK_DEMO) return;
      var out = U.$('#signout', view); if (!out || out.parentNode !== view) return;
      var card = document.createElement('div'); card.className = 'card';
      card.innerHTML = '<h3>Demo</h3><p class="muted" style="margin-bottom:12px">Look around Offpack with made-up trades and a balance you choose. Your real trades are not touched and nothing is saved.</p><button type="button" class="btn ghost" id="demo-start">Start demo</button>';
      view.insertBefore(card, out);
      U.$('#demo-start', view).onclick = startDemo;
    } catch (e) {}
  };

  var homeOrig = V.home;
  V.home = function (view) {
    homeOrig(view);
    try {
      if (window.OFFPACK_DEMO || D.trades.length) return;
      var add = U.$('a.btn[href="#add"]', view); if (!add) return;
      var b = document.createElement('button'); b.type = 'button'; b.className = 'btn ghost'; b.style.marginTop = '10px';
      b.textContent = 'Look around in the demo first'; b.onclick = startDemo;
      add.parentNode.appendChild(b);
    } catch (e) {}
  };

  // ---- when this tab is in the in-app demo
  if (inApp) {
    var saved = C.parseNum(read(BAL));
    if (saved > 0 && D.profile) D.profile.account_balance = saved;
    var bar = U.$('#demobar');
    if (bar) {
      bar.innerHTML = '<span>Demo mode. Nothing here is saved.</span><span><a href="#" id="demo-exit"><u>Exit demo</u></a></span>';
      bar.onclick = function (e) { if (e.target.closest('#demo-exit')) { e.preventDefault(); exitDemo(); } };
    }
    window.dispatchEvent(new Event('hashchange'));
  }
})();
