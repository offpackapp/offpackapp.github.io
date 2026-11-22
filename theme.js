/* Applies the saved light or dark choice before the page paints. */
(function () {
  var root = document.documentElement;
  try {
    var t = localStorage.getItem('offpack_theme');
    if (t === 'dark' || t === 'light') root.setAttribute('data-theme', t);
  } catch (e) {}
  window.OFFPACK_THEME = {
    get: function () {
      try { var t = localStorage.getItem('offpack_theme'); return (t === 'dark' || t === 'light') ? t : 'system'; }
      catch (e) { return 'system'; }
    },
    set: function (t) {
      try {
        if (t === 'dark' || t === 'light') { localStorage.setItem('offpack_theme', t); root.setAttribute('data-theme', t); }
        else { localStorage.removeItem('offpack_theme'); root.removeAttribute('data-theme'); }
      } catch (e) {}
    }
  };
})();
