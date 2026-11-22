/* Creates the Supabase connection used by every page (window.sb). */
(function () {
  var C = window.OFFPACK;
  window.sb = null;
  if (!window.supabase || !C) return;
  function remember() {
    try { return localStorage.getItem('offpack_remember') !== '0'; } catch (e) { return true; }
  }
  var storage = {
    getItem: function (k) {
      try { var v = sessionStorage.getItem(k); return v !== null ? v : localStorage.getItem(k); } catch (e) { return null; }
    },
    setItem: function (k, v) {
      try {
        var keep = remember();
        (keep ? localStorage : sessionStorage).setItem(k, v);
        (keep ? sessionStorage : localStorage).removeItem(k);
      } catch (e) {}
    },
    removeItem: function (k) {
      try { localStorage.removeItem(k); sessionStorage.removeItem(k); } catch (e) {}
    }
  };
  window.sb = window.supabase.createClient(C.supabaseUrl, C.supabaseKey, {
    auth: { storage: storage, persistSession: true, autoRefreshToken: true, detectSessionInUrl: true }
  });
})();
