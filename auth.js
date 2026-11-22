/* Sign in, create account, forgot password and set new password. */
(function () {
  'use strict';
  var C = window.OFFPACK, sb = window.sb;
  var views = ['signin', 'signup', 'forgot', 'reset', 'sent'];
  var busy = false, recovery = false, lastEmail = '';

  function $(s, r) { return (r || document).querySelector(s); }
  function msg(text, kind) { var m = $('#msg'); m.textContent = text; m.className = 'msg ' + (kind || 'err'); m.hidden = false; }
  function clearMsg() { var m = $('#msg'); m.hidden = true; m.textContent = ''; }
  function show(v) {
    views.forEach(function (n) { $('#v-' + n).hidden = (n !== v); });
    clearMsg();
    var r = $('#resend'); if (r) r.hidden = true;
  }
  function busyOn(btn) { busy = true; btn.setAttribute('aria-busy', 'true'); btn.textContent = btn.getAttribute('data-busy'); }
  function busyOff(btn) { busy = false; btn.removeAttribute('aria-busy'); btn.textContent = btn.getAttribute('data-label'); }
  function validEmail(e) { return /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(e); }

  var RULES = {
    len: function (p) { return p.length >= 8; },
    upper: /[A-Z]/, lower: /[a-z]/, num: /[0-9]/, sym: /[^A-Za-z0-9]/
  };
  function checkRules(form, p) {
    var all = true;
    Object.keys(RULES).forEach(function (k) {
      var r = RULES[k], ok = typeof r === 'function' ? r(p) : r.test(p);
      all = all && ok;
      var li = $('[data-rule="' + k + '"]', form);
      if (li) li.classList.toggle('ok', ok);
    });
    return all;
  }

  function friendly(err) {
    var m = ((err && err.message) || '').toLowerCase(), s = err && err.status;
    if (m.indexOf('invalid login') > -1) return 'Wrong email or password.';
    if (m.indexOf('email not confirmed') > -1) return 'Confirm your email first. Check your inbox and spam folder.';
    if (s === 429 || m.indexOf('rate limit') > -1 || m.indexOf('too many') > -1 || m.indexOf('security purposes') > -1) return 'Too many tries. Wait a few minutes and try again.';
    if (m.indexOf('different from the old') > -1 || m.indexOf('same password') > -1) return 'Choose a new password that is different from your old one.';
    if (m.indexOf('weak') > -1 || m.indexOf('password should') > -1) return 'That password does not meet the rules.';
    if (m.indexOf('failed to fetch') > -1 || m.indexOf('network') > -1) return 'Can\u2019t reach Offpack. Check your connection and try again.';
    return 'Something went wrong. Try again.';
  }

  function hashParams() {
    var out = {};
    String(window.OFFPACK_HASH || '').replace(/^#/, '').split('&').forEach(function (kv) {
      if (!kv) return;
      var i = kv.indexOf('=');
      if (i < 0) return;
      try { out[decodeURIComponent(kv.slice(0, i))] = decodeURIComponent(kv.slice(i + 1).replace(/\+/g, ' ')); } catch (e) {}
    });
    return out;
  }

  function wirePasswordToggles() {
    document.querySelectorAll('[data-toggle]').forEach(function (b) {
      b.addEventListener('click', function () {
        var inp = document.getElementById(b.getAttribute('data-toggle'));
        var hide = inp.type === 'password';
        inp.type = hide ? 'text' : 'password';
        b.textContent = hide ? 'Hide' : 'Show';
      });
    });
  }

  function init() {
    wirePasswordToggles();
    if (C.demoEnabled) document.querySelectorAll('.demo').forEach(function (d) { d.hidden = false; });
    document.querySelectorAll('[data-go]').forEach(function (b) {
      b.addEventListener('click', function () { show(b.getAttribute('data-go')); });
    });
    if (!sb) { msg('Could not load the sign-in service. Refresh the page and try again.'); return; }

    var hp = hashParams();
    var mode = /[?&]mode=signup/.test(window.OFFPACK_SEARCH || '') ? 'signup' : 'signin';
    if (hp.type === 'recovery') { recovery = true; show('reset'); }
    else {
      show(mode);
      if (hp.error || hp.error_description) msg('That link expired or was already used. Request a new one.');
    }

    sb.auth.onAuthStateChange(function (ev) {
      if (ev === 'PASSWORD_RECOVERY') { recovery = true; show('reset'); }
    });
    sb.auth.getSession().then(function (r) {
      if (r.data && r.data.session && !recovery) location.replace('app.html');
    });

    $('#f-signup-pw').addEventListener('input', function (e) { checkRules($('#v-signup'), e.target.value); });
    $('#f-reset-pw').addEventListener('input', function (e) { checkRules($('#v-reset'), e.target.value); });

    $('#form-signin').addEventListener('submit', function (e) {
      e.preventDefault(); if (busy) return;
      var email = $('#f-signin-email').value.trim().toLowerCase(), pw = $('#f-signin-pw').value, btn = $('#btn-signin');
      if (!validEmail(email) || !pw) { msg('Enter your email and password.'); return; }
      clearMsg(); lastEmail = email;
      try { localStorage.setItem('offpack_remember', $('#f-remember').checked ? '1' : '0'); } catch (x) {}
      busyOn(btn);
      sb.auth.signInWithPassword({ email: email, password: pw }).then(function (r) {
        busyOff(btn);
        if (r.error) {
          msg(friendly(r.error));
          if ((r.error.message || '').toLowerCase().indexOf('not confirmed') > -1) $('#resend').hidden = false;
          return;
        }
        location.replace('app.html');
      }).catch(function (err) { busyOff(btn); msg(friendly(err)); });
    });

    $('#resend').addEventListener('click', function () {
      if (busy || !lastEmail) return;
      busy = true;
      sb.auth.resend({ type: 'signup', email: lastEmail, options: { emailRedirectTo: C.siteUrl + '/login.html' } }).then(function (r) {
        busy = false;
        if (r.error) msg(friendly(r.error)); else msg('Email sent. Check your inbox and spam folder.', 'ok');
      }).catch(function (err) { busy = false; msg(friendly(err)); });
    });

    $('#form-signup').addEventListener('submit', function (e) {
      e.preventDefault(); if (busy) return;
      var email = $('#f-signup-email').value.trim().toLowerCase(), pw = $('#f-signup-pw').value, btn = $('#btn-signup');
      if (!validEmail(email)) { msg('Enter a valid email address.'); return; }
      if (!checkRules($('#v-signup'), pw)) { msg('Your password needs to meet every rule in the list.'); return; }
      clearMsg(); lastEmail = email; busyOn(btn);
      sb.auth.signUp({ email: email, password: pw, options: { emailRedirectTo: C.siteUrl + '/login.html' } }).then(function (r) {
        busyOff(btn);
        if (r.error) { msg(friendly(r.error)); return; }
        if (r.data && r.data.session) { location.replace('app.html'); return; }
        $('#sent-email').textContent = email;
        show('sent');
      }).catch(function (err) { busyOff(btn); msg(friendly(err)); });
    });

    $('#form-forgot').addEventListener('submit', function (e) {
      e.preventDefault(); if (busy) return;
      var email = $('#f-forgot-email').value.trim().toLowerCase(), btn = $('#btn-forgot');
      if (!validEmail(email)) { msg('Enter a valid email address.'); return; }
      clearMsg(); busyOn(btn);
      sb.auth.resetPasswordForEmail(email, { redirectTo: C.siteUrl + '/login.html' }).then(function (r) {
        busyOff(btn);
        if (r.error && (r.error.status === 429 || /rate|security/i.test(r.error.message || ''))) { msg(friendly(r.error)); return; }
        msg('If that email has an account, a reset link is on its way. Check your inbox and spam folder.', 'ok');
      }).catch(function (err) { busyOff(btn); msg(friendly(err)); });
    });

    $('#form-reset').addEventListener('submit', function (e) {
      e.preventDefault(); if (busy) return;
      var pw = $('#f-reset-pw').value, btn = $('#btn-reset');
      if (!checkRules($('#v-reset'), pw)) { msg('Your password needs to meet every rule in the list.'); return; }
      clearMsg(); busyOn(btn);
      sb.auth.updateUser({ password: pw }).then(function (r) {
        busyOff(btn);
        if (r.error) { msg(friendly(r.error)); return; }
        msg('Password updated.', 'ok');
        setTimeout(function () { location.replace('app.html'); }, 900);
      }).catch(function (err) { busyOff(btn); msg(friendly(err)); });
    });
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init); else init();
})();
