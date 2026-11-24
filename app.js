/* OFFPACK app. All screens and logic in one file. Settings live in config.js, colors in styles.css. */

/* ===== Theme: remembers your light or dark choice ===== */
(function () {
  var root = document.documentElement;
  window.OFFPACK_THEME = {
    get: function () { try { var t = localStorage.getItem('offpack_theme'); return (t === 'dark' || t === 'light') ? t : 'system'; } catch (e) { return 'system'; } },
    set: function (t) {
      try {
        if (t === 'dark' || t === 'light') { localStorage.setItem('offpack_theme', t); root.setAttribute('data-theme', t); }
        else { localStorage.removeItem('offpack_theme'); root.removeAttribute('data-theme'); }
      } catch (e) {}
    }
  };
})();

/* ===== Supabase connection ===== */
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

/* ===== Helpers ===== */
/* OFFPACK small helpers used by every screen. */
(function () {
  'use strict';
  var U = {};
  U.$ = function (s, r) { return (r || document).querySelector(s); };
  U.$$ = function (s, r) { return Array.prototype.slice.call((r || document).querySelectorAll(s)); };
  U.esc = function (s) {
    return String(s === null || s === undefined ? '' : s).replace(/[&<>"']/g, function (c) {
      return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c];
    });
  };
  U.uuid = function () {
    if (window.crypto && crypto.randomUUID) return crypto.randomUUID();
    return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, function (c) {
      var r = Math.random() * 16 | 0; return (c === 'x' ? r : (r & 3 | 8)).toString(16);
    });
  };
  var MON = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
  function p2(n) { return n < 10 ? '0' + n : '' + n; }
  U.fmtDate = function (v, withTime) {
    var d = v instanceof Date ? v : new Date(v);
    if (isNaN(d)) return '-';
    var s = d.getDate() + ' ' + MON[d.getMonth()] + ' ' + d.getFullYear();
    return withTime === false ? s : s + ', ' + p2(d.getHours()) + ':' + p2(d.getMinutes());
  };
  U.toLocalInput = function (v) {
    var d = v instanceof Date ? v : new Date(v);
    return d.getFullYear() + '-' + p2(d.getMonth() + 1) + '-' + p2(d.getDate()) + 'T' + p2(d.getHours()) + ':' + p2(d.getMinutes());
  };
  U.fromLocalInput = function (s) { var d = new Date(s); return isNaN(d) ? null : d; };

  var toastTimer;
  U.toast = function (text) {
    var t = U.$('#toast'); if (!t) return;
    t.textContent = text; t.hidden = false;
    clearTimeout(toastTimer); toastTimer = setTimeout(function () { t.hidden = true; }, 2400);
  };

  // confirm dialog: returns a promise of true or false
  U.confirm = function (title, message, okLabel) {
    return new Promise(function (resolve) {
      var d = U.$('#dlg');
      U.$('#dlg-title').textContent = title; U.$('#dlg-msg').textContent = message;
      var ok = U.$('#dlg-ok'), no = U.$('#dlg-no');
      ok.textContent = okLabel || 'OK'; d.hidden = false;
      function done(v) { d.hidden = true; ok.onclick = no.onclick = null; resolve(v); }
      ok.onclick = function () { done(true); }; no.onclick = function () { done(false); };
    });
  };

  // shrink a photo before upload (max 1280 px, JPEG)
  U.compressImage = function (file, maxDim, quality) {
    return new Promise(function (resolve, reject) {
      var url = URL.createObjectURL(file), img = new Image();
      img.onload = function () {
        var w = img.naturalWidth, h = img.naturalHeight, s = Math.min(1, (maxDim || 1280) / Math.max(w, h));
        var c = document.createElement('canvas'); c.width = Math.round(w * s); c.height = Math.round(h * s);
        c.getContext('2d').drawImage(img, 0, 0, c.width, c.height);
        URL.revokeObjectURL(url);
        c.toBlob(function (b) { b ? resolve(b) : reject(new Error('Could not shrink that image.')); }, 'image/jpeg', quality || 0.8);
      };
      img.onerror = function () { URL.revokeObjectURL(url); reject(new Error('Could not read that image.')); };
      img.src = url;
    });
  };
  window.OFFPACK_U = U;
})();

/* ===== Trade math ===== */
/* OFFPACK trade math. Pure functions, no screen code, easy to test. */
(function (root) {
  'use strict';
  var C = {};

  function isUsdBase(i) { return i.asset_class === 'forex' && String(i.symbol).slice(0, 3) === 'USD'; }
  function isUsdQuote(i) { return i.quote_currency === 'USD' || i.quote_currency === 'USDT'; }
  C.canPnl = function (i) { return isUsdQuote(i) || isUsdBase(i); };

  C.parseNum = function (v) {
    if (v === null || v === undefined) return null;
    var s = String(v).replace(/[,\s]/g, '');
    if (s === '' || s === '-' || s === '.') return null;
    var n = Number(s);
    return isFinite(n) ? n : null;
  };

  // units of the traded asset for a position value in dollars
  C.quantity = function (i, positionValue, entry) {
    if (!(positionValue > 0) || !(entry > 0)) return null;
    return isUsdBase(i) ? positionValue : positionValue / entry;
  };

  // profit or loss in dollars (null if we cannot convert exactly)
  C.pnl = function (i, side, entry, exit, qty) {
    if (!C.canPnl(i) || !(qty > 0) || !(entry > 0) || !(exit > 0)) return null;
    var d = side === 'long' ? exit - entry : entry - exit;
    var raw = qty * d;
    return isUsdBase(i) ? raw / exit : raw;
  };

  C.riskAmount = function (i, side, entry, stop, qty) {
    var p = C.pnl(i, side, entry, stop, qty);
    return p === null ? null : Math.max(0, -p);
  };
  C.rewardAmount = function (i, side, entry, tp, qty) {
    var p = C.pnl(i, side, entry, tp, qty);
    return p === null ? null : Math.max(0, p);
  };

  // turn a dollar amount into a stop or take-profit price
  C.priceFromAmount = function (i, side, entry, qty, amount, kind) {
    if (!(qty > 0) || !(entry > 0) || !(amount >= 0)) return null;
    var d = isUsdBase(i) ? amount * entry / qty : amount / qty;
    var down = (kind === 'stop') === (side === 'long');
    return down ? entry - d : entry + d;
  };

  C.liquidation = function (i, side, entry, lev) {
    if (i.asset_class !== 'crypto' || !(lev > 1) || !(entry > 0)) return null;
    return side === 'long' ? entry * (1 - 1 / lev) : entry * (1 + 1 / lev);
  };
  C.margin = function (pv, lev) { return pv > 0 && lev >= 1 ? pv / lev : null; };
  C.rMultiple = function (pnl, risk) { return risk > 0 && pnl !== null && pnl !== undefined ? pnl / risk : null; };
  C.plannedRR = function (side, entry, stop, tp) {
    if (!(entry > 0) || !(stop > 0) || !(tp > 0)) return null;
    var risk = side === 'long' ? entry - stop : stop - entry;
    var reward = side === 'long' ? tp - entry : entry - tp;
    return risk > 0 && reward > 0 ? reward / risk : null;
  };
  C.levelErrors = function (side, entry, stop, tp) {
    var e = [];
    if (stop !== null && entry > 0) {
      if (side === 'long' && stop >= entry) e.push('Stop loss must be below your entry for a long.');
      if (side === 'short' && stop <= entry) e.push('Stop loss must be above your entry for a short.');
    }
    if (tp !== null && entry > 0) {
      if (side === 'long' && tp <= entry) e.push('Take profit must be above your entry for a long.');
      if (side === 'short' && tp >= entry) e.push('Take profit must be below your entry for a short.');
    }
    return e;
  };

  // trading session from the UTC hour: London 08-12, New York 13-20, Asia otherwise
  C.sessionFor = function (date) {
    var h = date.getUTCHours();
    return h >= 8 && h < 13 ? 'London' : h >= 13 && h < 21 ? 'New York' : 'Asia';
  };

  C.available = function (accountSize, closedPnl, openMargin) {
    return accountSize === null || accountSize === undefined ? null : accountSize + closedPnl - openMargin;
  };

  C.priceDecimals = function (i, p) {
    if (i && i.quote_currency === 'JPY') return 3;
    var a = Math.abs(p);
    return a >= 100 ? 2 : a >= 1 ? 4 : a >= 0.1 ? 5 : 6;
  };
  C.fmtPrice = function (i, p) {
    if (p === null || p === undefined || !isFinite(p)) return '-';
    var d = C.priceDecimals(i, p);
    return Number(p).toLocaleString('en-US', { minimumFractionDigits: d, maximumFractionDigits: d });
  };
  C.fmtMoney = function (v, signed) {
    if (v === null || v === undefined || !isFinite(v)) return '-';
    var s = Math.abs(v).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
    return (v < 0 ? '-' : signed ? '+' : '') + '$' + s;
  };
  C.fmtQty = function (q) {
    if (q === null || q === undefined || !isFinite(q)) return '-';
    return Number(q.toPrecision(5)).toLocaleString('en-US', { maximumFractionDigits: 8 });
  };

  if (typeof module !== 'undefined' && module.exports) module.exports = C; else root.OFFPACK_CALC = C;
})(this);

/* ===== Analytics ===== */
/* OFFPACK analytics. Pure functions over a list of trades, easy to test. */
(function (root) {
  'use strict';
  var S = {}, MIN_N = 5;
  S.MIN_N = MIN_N;
  var DAY = 86400000;

  S.isClosed = function (t) { return !!t.closed_at && t.pnl !== null && t.pnl !== undefined; };
  S.closedTrades = function (trades) {
    return trades.filter(S.isClosed).sort(function (a, b) { return new Date(a.closed_at) - new Date(b.closed_at); });
  };
  S.rangeStart = function (range, now) {
    now = now || new Date();
    return range === '7d' ? new Date(now.getTime() - 7 * DAY) : range === '30d' ? new Date(now.getTime() - 30 * DAY) : null;
  };
  S.inRange = function (closed, range, now) {
    var s = S.rangeStart(range, now);
    return s ? closed.filter(function (t) { return new Date(t.closed_at) >= s; }) : closed.slice();
  };

  S.summary = function (list, plannedRR) {
    var n = list.length, wins = 0, losses = 0, sumW = 0, sumL = 0, total = 0;
    list.forEach(function (t) {
      var p = Number(t.pnl); total += p;
      if (p > 0) { wins++; sumW += p; } else if (p < 0) { losses++; sumL += -p; }
    });
    var rrs = list.map(plannedRR || function () { return null; }).filter(function (x) { return x !== null && x !== undefined; });
    return {
      n: n, wins: wins, losses: losses, total: total,
      winRate: n ? wins / n * 100 : null,
      avgWin: wins ? sumW / wins : null, avgLoss: losses ? sumL / losses : null,
      profitFactor: sumL > 0 ? sumW / sumL : null,
      expectancy: n ? total / n : null,
      avgRR: rrs.length ? rrs.reduce(function (a, b) { return a + b; }, 0) / rrs.length : null
    };
  };

  // equity points for a window: starts at the balance when the window began
  S.equity = function (closedAll, range, accountSize, now) {
    var start = S.rangeStart(range, now), base = accountSize === null || accountSize === undefined ? 0 : Number(accountSize);
    var before = 0, inWin = [];
    closedAll.forEach(function (t) {
      if (start && new Date(t.closed_at) < start) before += Number(t.pnl); else inWin.push(t);
    });
    var v = base + before, pts = [{ t: start ? start.getTime() : (inWin.length ? new Date(inWin[0].closed_at).getTime() - 1 : (now || new Date()).getTime()), v: v }];
    inWin.forEach(function (t) { v += Number(t.pnl); pts.push({ t: new Date(t.closed_at).getTime(), v: v }); });
    return { points: pts, relative: accountSize === null || accountSize === undefined };
  };
  // biggest fall from a peak, as a negative percent of that peak
  S.maxDrawdown = function (points) {
    var peak = -Infinity, worst = 0;
    points.forEach(function (p) {
      if (p.v > peak) peak = p.v;
      if (peak > 0) { var dd = (p.v - peak) / peak * 100; if (dd < worst) worst = dd; }
    });
    return worst;
  };

  S.groupBy = function (list, keyFn) {
    var map = {}, order = [];
    list.forEach(function (t) {
      var k = keyFn(t); if (k === null || k === undefined || k === '') return;
      if (!map[k]) { map[k] = { key: k, n: 0, wins: 0, total: 0 }; order.push(k); }
      var g = map[k], p = Number(t.pnl); g.n++; g.total += p; if (p > 0) g.wins++;
    });
    return order.map(function (k) {
      var g = map[k]; g.winRate = g.wins / g.n * 100; g.avg = g.total / g.n; g.enough = g.n >= MIN_N; return g;
    }).sort(function (a, b) { return b.n - a.n; });
  };
  S.pairsChange = function (list) {
    return S.groupBy(list.filter(function (t) { return t.exit_emotion && t.entry_emotion; }), function (t) { return t.entry_emotion + ' to ' + t.exit_emotion; });
  };
  S.mistakes = function (list) {
    var map = {};
    list.forEach(function (t) { (t.mistakes || []).forEach(function (m) { map[m] = (map[m] || 0) + 1; }); });
    return Object.keys(map).map(function (k) { return { key: k, n: map[k] }; }).sort(function (a, b) { return b.n - a.n; });
  };
  // one plain finding, only when at least two feelings have enough trades
  S.finding = function (emotionGroups) {
    var ok = emotionGroups.filter(function (g) { return g.enough; });
    if (ok.length < 2) return null;
    var low = ok.slice().sort(function (a, b) { return a.winRate - b.winRate; })[0];
    var high = ok.slice().sort(function (a, b) { return b.winRate - a.winRate; })[0];
    if (low.winRate === high.winRate) return null;
    return { low: low, high: high };
  };

  function dayKey(d) { d = new Date(d); return d.getFullYear() + '-' + ('0' + (d.getMonth() + 1)).slice(-2) + '-' + ('0' + d.getDate()).slice(-2); }
  S.dayKey = dayKey;
  S.byDay = function (closed) {
    var m = {};
    closed.forEach(function (t) { var k = dayKey(t.closed_at); if (!m[k]) m[k] = { pnl: 0, n: 0, trades: [] }; m[k].pnl += Number(t.pnl); m[k].n++; m[k].trades.push(t); });
    return m;
  };
  // month grid, Monday first; null for empty cells
  S.monthGrid = function (year, month) {
    var first = new Date(year, month, 1), lead = (first.getDay() + 6) % 7, days = new Date(year, month + 1, 0).getDate(), cells = [];
    for (var i = 0; i < lead; i++) cells.push(null);
    for (var d = 1; d <= days; d++) cells.push(d);
    while (cells.length % 7) cells.push(null);
    return cells;
  };
  if (typeof module !== 'undefined' && module.exports) module.exports = S; else root.OFFPACK_STATS = S;
})(this);

/* ===== Live prices ===== */
/* OFFPACK live prices for crypto, straight from public market data (no keys). */
(function () {
  'use strict';
  var P = {}, HOSTS = ['https://data-api.binance.vision', 'https://api.binance.com'];
  function getJson(url) {
    return new Promise(function (resolve, reject) {
      var done = false, ctl = window.AbortController ? new AbortController() : null;
      var tm = setTimeout(function () { if (ctl) ctl.abort(); if (!done) { done = true; reject(new Error('timeout')); } }, 8000);
      fetch(url, { cache: 'no-store', signal: ctl ? ctl.signal : undefined }).then(function (r) {
        if (!r.ok) throw new Error('HTTP ' + r.status); return r.json();
      }).then(function (j) { if (!done) { done = true; clearTimeout(tm); resolve(j); } })
        .catch(function (e) { if (!done) { done = true; clearTimeout(tm); reject(e); } });
    });
  }
  function firstOk(urls, map) {
    return urls.reduce(function (p, u) { return p.catch(function () { return getJson(u).then(map); }); }, Promise.reject(new Error('start')));
  }
  P.supported = function (i) { return !!i && i.asset_class === 'crypto' && i.provider === 'binance'; };
  P.ticker = function (i) {
    var sym = encodeURIComponent(i.provider_symbol || i.symbol);
    return firstOk(HOSTS.map(function (h) { return h + '/api/v3/ticker/24hr?symbol=' + sym; }), function (j) {
      return { price: +j.lastPrice, change: +j.priceChangePercent, high: +j.highPrice, low: +j.lowPrice, volume: +j.quoteVolume, src: 'Binance' };
    }).catch(function () {
      var base = String(i.symbol).replace(/USDT$/, '');
      return Promise.all([getJson('https://api.exchange.coinbase.com/products/' + base + '-USD/ticker'), getJson('https://api.exchange.coinbase.com/products/' + base + '-USD/stats')]).then(function (r) {
        var last = +r[0].price, open = +r[1].open;
        return { price: last, change: open ? (last - open) / open * 100 : null, high: +r[1].high, low: +r[1].low, volume: null, src: 'Coinbase' };
      });
    }).then(function (t) { if (!(t.price > 0)) throw new Error('no price'); return t; });
  };
  var TF = { '1H': ['1m', 60], '4H': ['5m', 48], '1D': ['15m', 96], '1W': ['1h', 168], '1M': ['4h', 180] };
  P.timeframes = Object.keys(TF);
  P.candles = function (i, tf) {
    var c = TF[tf] || TF['1D'], sym = encodeURIComponent(i.provider_symbol || i.symbol);
    return firstOk(HOSTS.map(function (h) { return h + '/api/v3/klines?symbol=' + sym + '&interval=' + c[0] + '&limit=' + c[1]; }), function (rows) {
      return rows.map(function (r) { return { t: +r[0], v: +r[4] }; });
    });
  };
  window.OFFPACK_PRICES = P;
})();

/* ===== Data layer ===== */
/* OFFPACK data layer: everything that talks to Supabase for trades lives here. */
(function () {
  'use strict';
  var sb = window.sb, U = window.OFFPACK_U;
  var D = { user: null, profile: null, instruments: [], strategies: [], trades: [], favorites: [] };
  var BUCKET = 'trade-shots';
  var TRADE_SELECT = '*, instruments(id,symbol,name,asset_class,quote_currency)';

  function need(r) { if (r.error) throw r.error; return r.data; }

  D.load = function (user) {
    D.user = user;
    return Promise.all([
      sb.from('profiles').select('*').eq('id', user.id).maybeSingle().then(need),
      sb.from('instruments').select('*').order('sort_order', { ascending: true }).then(need),
      sb.from('strategies').select('*').order('created_at', { ascending: true }).then(need),
      sb.from('trades').select(TRADE_SELECT).order('opened_at', { ascending: false }).limit(1000).then(need),
      sb.from('favorites').select('instrument_id').then(need)
    ]).then(function (r) {
      D.favorites = (r[4] || []).map(function (x) { return x.instrument_id; });
      D.profile = r[0] || { id: user.id, display_name: null, currency: 'USD', account_balance: null, default_risk_pct: 1 };
      D.instruments = r[1] || []; D.strategies = r[2] || []; D.trades = r[3] || [];
    });
  };
  D.refreshTrades = function () {
    return sb.from('trades').select(TRADE_SELECT).order('opened_at', { ascending: false }).limit(1000).then(need).then(function (t) { D.trades = t || []; });
  };
  D.isFav = function (id) { return D.favorites.indexOf(id) > -1; };
  D.toggleFavorite = function (id) {
    var on = D.isFav(id);
    var q = on ? sb.from('favorites').delete().eq('instrument_id', id) : sb.from('favorites').insert({ instrument_id: id });
    return q.then(need).then(function () { if (on) D.favorites.splice(D.favorites.indexOf(id), 1); else D.favorites.push(id); return !on; });
  };
  D.enabledInstruments = function () { return D.instruments.filter(function (i) { return i.enabled; }); };
  D.instrument = function (id) { return D.instruments.filter(function (i) { return i.id === id; })[0] || null; };
  D.trade = function (id) { return D.trades.filter(function (t) { return t.id === id; })[0] || null; };
  D.strategyName = function (id) { var s = D.strategies.filter(function (x) { return x.id === id; })[0]; return s ? s.name : ''; };

  // money in the account
  D.closedPnl = function () {
    return D.trades.reduce(function (a, t) { return a + (t.closed_at && t.pnl !== null ? Number(t.pnl) : 0); }, 0);
  };
  D.openMargin = function (exceptId) {
    return D.trades.reduce(function (a, t) {
      return a + (!t.closed_at && t.id !== exceptId ? Number(t.position_value) / Number(t.leverage || 1) : 0);
    }, 0);
  };
  D.accountSize = function () { return D.profile.account_balance === null || D.profile.account_balance === undefined ? null : Number(D.profile.account_balance); };
  D.balance = function () { var a = D.accountSize(); return a === null ? null : a + D.closedPnl(); };
  D.available = function (exceptId) { var a = D.accountSize(); return a === null ? null : a + D.closedPnl() - D.openMargin(exceptId); };

  D.saveProfile = function (patch) {
    var row = Object.assign({ id: D.user.id }, patch);
    return sb.from('profiles').upsert(row).select('*').maybeSingle().then(need).then(function (p) { if (p) D.profile = p; return D.profile; });
  };
  D.addStrategy = function (name) {
    return sb.from('strategies').insert({ name: name }).select('*').maybeSingle().then(need).then(function (s) {
      if (s) D.strategies.push(s); return s;
    });
  };
  D.insertTrade = function (row) { return sb.from('trades').insert(row).select(TRADE_SELECT).maybeSingle().then(need); };
  D.updateTrade = function (id, patch) { return sb.from('trades').update(patch).eq('id', id).select(TRADE_SELECT).maybeSingle().then(need); };

  // screenshots
  D.uploadShots = function (tradeId, blobs) {
    var paths = [];
    return blobs.reduce(function (chain, blob, i) {
      return chain.then(function () {
        var p = D.user.id + '/' + tradeId + '/' + Date.now() + '-' + i + '.jpg';
        return sb.storage.from(BUCKET).upload(p, blob, { contentType: 'image/jpeg', upsert: false }).then(function (r) {
          if (r.error) throw r.error; paths.push(p);
        });
      });
    }, Promise.resolve()).then(function () { return paths; }, function (err) { D.removeShots(paths); throw err; });
  };
  D.removeShots = function (paths) {
    if (!paths || !paths.length) return Promise.resolve();
    return sb.storage.from(BUCKET).remove(paths).then(function () {}, function () {});
  };
  D.signedUrls = function (paths) {
    if (!paths || !paths.length) return Promise.resolve({});
    return sb.storage.from(BUCKET).createSignedUrls(paths, 3600).then(function (r) {
      var out = {}; (r.data || []).forEach(function (x) { if (x.signedUrl) out[x.path] = x.signedUrl; }); return out;
    }, function () { return {}; });
  };
  D.deleteTrade = function (t) {
    return D.removeShots(t.screenshots).then(function () {
      return sb.from('trades').delete().eq('id', t.id).then(need);
    });
  };
  window.OFFPACK_DATA = D;
})();

/* ===== Demo mode ===== */
/* OFFPACK demo mode: the real app with made-up trades. Nothing is saved or sent anywhere. */
(function () {
  'use strict';
  var C = window.OFFPACK_CALC, D = window.OFFPACK_DATA, CFG = window.OFFPACK;
  var active = /[?&]demo=1/.test(window.OFFPACK_SEARCH || '') && !!CFG.demoEnabled;
  window.OFFPACK_DEMO = active;
  var DAY = 86400000;
  var BASE = [['BTCUSDT', 'Bitcoin / Tether', 'crypto', 'USDT', 'binance', 67600], ['ETHUSDT', 'Ethereum / Tether', 'crypto', 'USDT', 'binance', 3420],
    ['SOLUSDT', 'Solana / Tether', 'crypto', 'USDT', 'binance', 152], ['BNBUSDT', 'BNB / Tether', 'crypto', 'USDT', 'binance', 610],
    ['EURUSD', 'Euro / US Dollar', 'forex', 'USD', 'none', 1.169], ['XAUUSD', 'Gold / US Dollar', 'metal', 'USD', 'none', 3880]];
  function rng(seed) { return function () { seed = (seed * 16807) % 2147483647; return (seed - 1) / 2147483646; }; }

  function build() {
    var r = rng(42), now = Date.now();
    var insts = BASE.map(function (b, i) { return { id: 'demo-' + b[0], symbol: b[0], name: b[1], asset_class: b[2], quote_currency: b[3], provider: b[4], provider_symbol: b[4] === 'none' ? null : b[0], enabled: true, sort_order: (i + 1) * 10, base: b[5] }; });
    var strategies = ['Pullback', 'Breakout', 'Reversal', 'Scalping', 'Trend Follow'].map(function (n, i) { return { id: 'ds' + i, name: n }; });
    var list = [];
    [['Calm', 8, 0.75], ['Confident', 6, 0.6], ['FOMO', 7, 0.2], ['Hesitant', 5, 0.4]].forEach(function (e) { for (var k = 0; k < e[1]; k++) list.push({ emo: e[0], p: e[2] }); });
    for (var a = list.length - 1; a > 0; a--) { var b = Math.floor(r() * (a + 1)), t = list[a]; list[a] = list[b]; list[b] = t; }
    var trades = list.map(function (x, idx) {
      var inst = insts[idx % insts.length], dec = inst.asset_class === 'forex' ? 4 : 2;
      var side = r() < 0.6 ? 'long' : 'short', dir = side === 'long' ? 1 : -1, entry = Number((inst.base * (1 + (r() - 0.5) * 0.02)).toFixed(dec));
      var win = r() < x.p, move = win ? 0.004 + r() * 0.014 : 0.003 + r() * 0.009;
      var exit = Number((entry * (1 + dir * (win ? move : -move))).toFixed(dec)), sl = Number((entry * (1 - dir * 0.008)).toFixed(dec)), tp = Number((entry * (1 + dir * 0.016)).toFixed(dec));
      var pv = Math.round(500 + r() * 1500), lev = [5, 10, 20][Math.floor(r() * 3)], qty = C.quantity(inst, pv, entry);
      var pnl = C.pnl(inst, side, entry, exit, qty), closedAt = new Date(now - (idx * 1.6 + 0.5) * DAY), openedAt = new Date(closedAt.getTime() - (1 + r() * 5) * 3600000);
      var mistakes = x.emo === 'FOMO' ? [['FOMO', 'Early entry', 'Moved stop'][Math.floor(r() * 3)]] : (r() < 0.1 ? ['No confirmation'] : []);
      return { id: 'dt' + idx, user_id: 'demo', instrument_id: inst.id, side: side, entry_price: entry, exit_price: exit, stop_loss: sl, take_profit: tp, position_value: pv, quantity: qty, leverage: lev,
        risk_amount: C.riskAmount(inst, side, entry, sl, qty), risk_pct: null, pnl: Number(pnl.toFixed(2)), session: ['Asia', 'London', 'New York'][Math.floor(r() * 3)], strategy_id: strategies[Math.floor(r() * 5)].id,
        entry_emotion: x.emo, exit_emotion: pnl > 0 ? (r() < 0.5 ? 'Calm' : 'Confident') : 'Frustrated', mistakes: mistakes, notes: null, screenshots: [],
        opened_at: openedAt.toISOString(), closed_at: closedAt.toISOString(), instruments: inst };
    });
    var eth = insts[1], eq = Number((eth.base * 0.995).toFixed(2));
    trades.unshift({ id: 'dopen', user_id: 'demo', instrument_id: eth.id, side: 'long', entry_price: eq, exit_price: null, stop_loss: Number((eq * 0.99).toFixed(2)), take_profit: Number((eq * 1.03).toFixed(2)), position_value: 1000, quantity: C.quantity(eth, 1000, eq),
      leverage: 10, risk_amount: null, risk_pct: null, pnl: null, session: 'London', strategy_id: 'ds0', entry_emotion: 'Calm', exit_emotion: null, mistakes: [], notes: null, screenshots: [], opened_at: new Date(now - 3600000).toISOString(), closed_at: null, instruments: eth });
    return { instruments: insts, strategies: strategies, trades: trades };
  }

  function useDemo() {
    function withInst(row) { return Object.assign({}, row, { instruments: D.instrument(row.instrument_id) }); }
    D.load = function (user) {
      var b = build(); D.user = user; D.instruments = b.instruments; D.strategies = b.strategies; D.trades = b.trades; D.favorites = [b.instruments[0].id];
      D.profile = { id: 'demo', display_name: 'Demo trader', currency: 'USD', account_balance: 10000, default_risk_pct: 1 };
      return Promise.resolve();
    };
    D.refreshTrades = function () { D.trades.sort(function (a, b) { return new Date(b.opened_at) - new Date(a.opened_at); }); return Promise.resolve(); };
    D.saveProfile = function (patch) { Object.assign(D.profile, patch); return Promise.resolve(D.profile); };
    D.addStrategy = function (name) { var s = { id: 'ds' + Date.now(), name: name }; D.strategies.push(s); return Promise.resolve(s); };
    D.insertTrade = function (row) { var t = withInst(row); D.trades.unshift(t); return Promise.resolve(t); };
    D.updateTrade = function (id, patch) { var t = D.trade(id); Object.assign(t, patch); t.instruments = D.instrument(t.instrument_id); return Promise.resolve(t); };
    D.deleteTrade = function (t) { var i = D.trades.indexOf(D.trade(t.id)); if (i > -1) D.trades.splice(i, 1); return Promise.resolve(); };
    D.uploadShots = function () { return Promise.resolve([]); };
    D.removeShots = function () { return Promise.resolve(); };
    D.signedUrls = function () { return Promise.resolve({}); };
    D.toggleFavorite = function (id) { var on = D.isFav(id); if (on) D.favorites.splice(D.favorites.indexOf(id), 1); else D.favorites.push(id); return Promise.resolve(!on); };
  }
  if (active) useDemo();
})();

/* ===== Add and edit trade ===== */
/* OFFPACK Add / Edit trade: three short steps, then a review. */
(function () {
  'use strict';
  var U = window.OFFPACK_U, C = window.OFFPACK_CALC, D = window.OFFPACK_DATA, CFG = window.OFFPACK;
  var KEY = 'offpack_draft', draft = null, view = null;

  var HELP = {
    avail: 'Your account size plus closed profit and loss, minus the margin locked in your open trades.',
    maxpos: 'The biggest position you could open: your available balance times your leverage.',
    margin: 'The money the exchange locks in to keep this trade open: position size divided by leverage.',
    size: 'How many coins or units this position buys or sells.',
    liq: 'The price where the exchange closes your trade because your margin is used up. This is a rough estimate. Real exchanges add fees and their own rules.',
    rr: 'How much you could win for every $1 you risk, using your stop loss and take profit.',
    risk: 'What you lose if your stop loss is hit.'
  };

  function lastInstrument() {
    var t = D.trades[0]; if (t && D.instrument(t.instrument_id) && D.instrument(t.instrument_id).enabled) return t.instrument_id;
    var list = D.enabledInstruments(); var btc = list.filter(function (i) { return i.symbol === 'BTCUSDT'; })[0];
    return (btc || list[0] || {}).id || '';
  }
  function blank() {
    return { id: null, step: 1, emotion: '', side: 'long', instrumentId: lastInstrument(), entryTime: U.toLocalInput(new Date()), entry: '',
      leverage: 10, pv: '', slMode: 'price', slVal: '', tpMode: 'price', tpVal: '', exit: '', exitTime: '', exitEmotion: '', manualPnl: '',
      strategyId: '', session: '', sessionAuto: true, mistakes: [], notes: '', shots: [], removed: [], news: [] };
  }
  function fromTrade(t) {
    function s(v) { return v === null || v === undefined ? '' : String(v); }
    return { id: t.id, step: 1, emotion: t.entry_emotion || '', side: t.side, instrumentId: t.instrument_id, entryTime: U.toLocalInput(t.opened_at),
      entry: s(t.entry_price), leverage: Number(t.leverage) || 1, pv: s(t.position_value), slMode: 'price', slVal: s(t.stop_loss), tpMode: 'price', tpVal: s(t.take_profit),
      exit: s(t.exit_price), exitTime: t.closed_at ? U.toLocalInput(t.closed_at) : '', exitEmotion: t.exit_emotion || '', manualPnl: '',
      strategyId: t.strategy_id || '', session: t.session || '', sessionAuto: false, mistakes: (t.mistakes || []).slice(), notes: t.notes || '',
      shots: (t.screenshots || []).map(function (p) { return { path: p, url: '' }; }), removed: [], news: [] };
  }
  function persist() {
    if (draft.id) return;
    try { var c = Object.assign({}, draft, { news: [], shots: [] }); sessionStorage.setItem(KEY, JSON.stringify(c)); } catch (e) {}
  }
  function restore() { try { var s = sessionStorage.getItem(KEY); return s ? Object.assign(blank(), JSON.parse(s), { news: [], shots: [] }) : null; } catch (e) { return null; } }
  function clearDraft() { draft = null; try { sessionStorage.removeItem(KEY); } catch (e) {} }

  function chip(label, on, act, val, cls) {
    return '<button type="button" class="chip' + (on ? ' on' : '') + (cls ? ' ' + cls : '') + '" data-act="' + act + '" data-v="' + U.esc(val) + '">' + U.esc(label) + '</button>';
  }
  function inst() { return D.instrument(draft.instrumentId); }
  function num(v) { return C.parseNum(v); }
  function baseName(i) { return i && i.asset_class === 'crypto' ? String(i.symbol).replace(/USDT$/, '') : (i ? i.symbol : ''); }
  function valueUnit(i) { return i && i.asset_class === 'crypto' ? 'USDT' : 'USD'; }

  // ---- calculations used by the plan card, the review and the save
  function calc() {
    var i = inst(), side = draft.side, entry = num(draft.entry), lev = num(draft.leverage) || 1, pv = num(draft.pv);
    var r = { inst: i, entry: entry, lev: lev, pv: pv, side: side };
    r.avail = D.available(draft.id);
    r.maxpos = r.avail === null ? null : Math.max(0, r.avail) * lev;
    r.margin = C.margin(pv, lev);
    r.qty = i ? C.quantity(i, pv, entry) : null;
    r.liq = i ? C.liquidation(i, side, entry, lev) : null;
    r.stop = resolve('sl', r); r.riskAmt = r.stop !== null && r.qty ? C.riskAmount(i, side, entry, r.stop, r.qty) : null;
    r.tp = resolve('tp', r);
    r.rewardAmt = r.tp !== null && r.qty ? C.rewardAmount(i, side, entry, r.tp, r.qty) : null;
    r.rr = C.plannedRR(side, entry, r.stop, r.tp);
    r.riskPct = r.riskAmt !== null && r.avail > 0 ? r.riskAmt / r.avail * 100 : null;
    r.exit = num(draft.exit);
    r.pnl = r.exit !== null && r.qty ? C.pnl(i, side, entry, r.exit, r.qty) : null;
    if (r.exit !== null && r.pnl === null && num(draft.manualPnl) !== null) r.pnl = num(draft.manualPnl);
    r.R = r.pnl !== null && r.riskAmt ? C.rMultiple(r.pnl, r.riskAmt) : null;
    return r;
  }
  function resolve(which, r) {
    var mode = which === 'sl' ? draft.slMode : draft.tpMode, v = num(which === 'sl' ? draft.slVal : draft.tpVal);
    if (v === null) return null;
    if (mode === 'price') return v;
    if (!r.inst || !r.qty || !(r.entry > 0)) return null;
    if (which === 'sl') {
      var amt = mode === 'risk$' ? v : (r.avail > 0 ? r.avail * v / 100 : null);
      var px = amt === null ? null : C.priceFromAmount(r.inst, r.side, r.entry, r.qty, amt, 'stop');
      return px !== null && px > 0 ? px : null;
    }
    if (mode === 'profit$') return C.priceFromAmount(r.inst, r.side, r.entry, r.qty, v, 'tp');
    if (mode === 'r') {
      var base = draft.slMode === 'price' ? num(draft.slVal) : (r.stop !== undefined ? r.stop : null);
      var ra = base !== null && base !== undefined ? C.riskAmount(r.inst, r.side, r.entry, base, r.qty) : null;
      return ra ? C.priceFromAmount(r.inst, r.side, r.entry, r.qty, ra * v, 'tp') : null;
    }
    return null;
  }

  // ---- screens
  function head() {
    return '<div class="wh"><h1>' + (draft.id ? 'Edit trade' : 'Add trade') + '</h1><span class="muted">' + (draft.step > 3 ? 'Review' : 'Step ' + draft.step + ' of 3') + '</span></div>' +
      '<div class="prog">' + [1, 2, 3].map(function (n) { return '<i class="' + (draft.step >= n ? 'on' : '') + '"></i>'; }).join('') + '</div>';
  }
  function errBox() { return '<p class="msg err" id="errs" role="alert" hidden></p>'; }
  function foot(next, nextLabel, back) {
    return '<div class="stack" style="margin-top:18px"><button type="button" class="btn" data-act="' + next + '">' + nextLabel + '</button>' +
      (back ? '<button type="button" class="btn ghost" data-act="back">Back</button>' : '') +
      '<button type="button" class="linkbtn muted" data-act="discard" style="width:100%;text-align:center">' + (draft.id ? 'Cancel editing' : 'Discard draft') + '</button></div>';
  }
  function step1() {
    var i = inst(), quick = [];
    D.enabledInstruments().forEach(function (x) { if (['BTCUSDT', 'ETHUSDT', 'SOLUSDT'].indexOf(x.symbol) > -1) quick.push(x); });
    var levs = CFG.leverages.map(function (l) { return chip(l + 'x', Number(draft.leverage) === l, 'lev', l); }).join('');
    var hasBal = D.available(draft.id) !== null;
    return head() +
      '<div class="lbl2">How do you feel right now?</div><div class="chips">' + CFG.emotions.map(function (e) { return chip(e, draft.emotion === e, 'emo', e); }).join('') + '</div>' +
      '<div class="side2"><button type="button" class="long' + (draft.side === 'long' ? ' on' : '') + '" data-act="side" data-v="long">Long</button><button type="button" class="short' + (draft.side === 'short' ? ' on' : '') + '" data-act="side" data-v="short">Short</button></div>' +
      '<div class="lbl2">Pair</div><button type="button" class="pairbtn" data-act="pair-open"><b>' + U.esc(i ? i.symbol : 'Choose a pair') + '</b><span class="muted">' + U.esc(i ? i.name : '') + ' &nbsp;Change</span></button>' +
      '<div class="chips sm">' + quick.map(function (x) { return chip(x.symbol, x.id === draft.instrumentId, 'pair-pick', x.id); }).join('') + '</div>' +
      '<label class="field"><span class="lbl">Entry time</span><span class="inrow"><input class="in" type="datetime-local" data-f="entryTime" value="' + U.esc(draft.entryTime) + '"><button type="button" class="chip" data-act="now">Now</button></span></label>' +
      '<label class="field"><span class="lbl">Entry price</span><input class="in" inputmode="decimal" data-f="entry" value="' + U.esc(draft.entry) + '" placeholder="0.00"></label>' +
      (window.OFFPACK_PRICES.supported(i) ? '<div class="chips" style="margin-top:-4px"><button type="button" class="chip" data-act="livepx">Use live price</button></div>' : '') +
      '<div class="lbl2">Leverage (x)</div><div class="chips">' + levs + '</div>' +
      '<label class="field"><input class="in" inputmode="decimal" data-f="leverage" value="' + U.esc(draft.leverage) + '" aria-label="Leverage"></label>' +
      '<label class="field"><span class="lbl">Position value (' + valueUnit(i) + ')</span><input class="in" inputmode="decimal" data-f="pv" value="' + U.esc(draft.pv) + '" placeholder="0.00"></label>' +
      '<div class="chips">' + [25, 50, 75, 100].map(function (p) { return chip(p === 100 ? 'Max' : p + '%', false, 'pvpct', p); }).join('') + '</div>' +
      (hasBal ? '' : '<p class="muted" style="font-size:13px;margin-top:8px">Set your account size in <a href="#account">Account</a> to use these shortcuts and the risk numbers.</p>') +
      errBox() + foot('next', 'Next', false);
  }
  function modeSeg(which, modes, cur) {
    return '<div class="seg3">' + modes.map(function (m) { return '<button type="button" class="' + (cur === m[0] ? 'on' : '') + '" data-act="' + which + 'mode" data-v="' + m[0] + '">' + m[1] + '</button>'; }).join('') + '</div>';
  }
  function step2() {
    return head() +
      '<div class="lbl2">Stop loss (optional)</div>' + modeSeg('sl', [['price', 'Price'], ['risk$', 'Risk $'], ['riskpct', 'Risk %']], draft.slMode) +
      '<input class="in" inputmode="decimal" data-f="slVal" value="' + U.esc(draft.slVal) + '" placeholder="' + (draft.slMode === 'price' ? 'Stop price' : draft.slMode === 'risk$' ? 'Dollars to risk' : 'Percent of account to risk') + '">' +
      '<div class="lbl2">Take profit (optional)</div>' + modeSeg('tp', [['price', 'Price'], ['profit$', 'Profit $'], ['r', 'R multiple']], draft.tpMode) +
      '<input class="in" inputmode="decimal" data-f="tpVal" value="' + U.esc(draft.tpVal) + '" placeholder="' + (draft.tpMode === 'price' ? 'Target price' : draft.tpMode === 'profit$' ? 'Dollars to make' : 'For example 2') + '">' +
      '<div class="lbl2">Exit (leave empty for a live trade)</div>' +
      '<input class="in" inputmode="decimal" data-f="exit" value="' + U.esc(draft.exit) + '" placeholder="Exit price (optional)">' +
      '<div id="exitbox"></div>' +
      '<div class="card plan" id="plan"></div><div id="warns"></div>' + errBox() + foot('next', 'Next', true);
  }
  function exitBox() {
    var el = U.$('#exitbox', view); if (!el) return;
    if (num(draft.exit) === null) { el.innerHTML = ''; return; }
    var r = calc(), manual = r.exit !== null && C.canPnl(r.inst) === false;
    el.innerHTML = '<label class="field" style="margin-top:12px"><span class="lbl">Exit time</span><input class="in" type="datetime-local" data-f="exitTime" value="' + U.esc(draft.exitTime || U.toLocalInput(new Date())) + '"></label>' +
      '<div class="lbl2">How do you feel now? (optional)</div><div class="chips">' + CFG.emotions.map(function (e) { return chip(e, draft.exitEmotion === e, 'exitemo', e); }).join('') + '</div>' +
      (manual ? '<label class="field"><span class="lbl">Profit or loss in dollars (we cannot convert this pair exactly)</span><input class="in" inputmode="decimal" data-f="manualPnl" value="' + U.esc(draft.manualPnl) + '" placeholder="For example -12.40"></label>' : '');
    if (!draft.exitTime) draft.exitTime = U.toLocalInput(new Date());
  }
  function row(key, label, value) {
    return '<div class="kv"><span>' + label + ' <button type="button" class="info" data-act="help" data-v="' + key + '" aria-label="What is this?">i</button></span><span>' + value + '</span></div><p class="help" data-help="' + key + '" hidden>' + HELP[key] + '</p>';
  }
  function updatePlan() {
    var el = U.$('#plan', view); if (!el) return;
    var r = calc(), i = r.inst, rows = '<h3>Trade plan</h3>';
    rows += row('avail', 'Available balance', r.avail === null ? '<a href="#account">Set account size</a>' : C.fmtMoney(r.avail));
    rows += row('maxpos', 'Max position size (' + r.lev + 'x)', r.maxpos === null ? '-' : C.fmtMoney(r.maxpos));
    rows += row('margin', 'Margin (money you lock in)', r.margin === null ? '-' : C.fmtMoney(r.margin));
    rows += row('size', 'Trade size', r.qty === null ? '-' : C.fmtQty(r.qty) + ' ' + U.esc(baseName(i)));
    if (i && i.asset_class === 'crypto') rows += row('liq', 'Liquidation price (estimate)', r.liq === null ? '-' : C.fmtPrice(i, r.liq));
    rows += row('rr', 'Reward vs risk', r.rr === null ? '-' : '1 : ' + r.rr.toFixed(2));
    rows += row('risk', 'Amount at risk', r.riskAmt === null ? '-' : C.fmtMoney(r.riskAmt) + (r.riskPct !== null ? ' (' + r.riskPct.toFixed(2) + '% of account)' : ''));
    var open = U.$$('[data-help]:not([hidden])', el).map(function (p) { return p.getAttribute('data-help'); });
    el.innerHTML = rows;
    open.forEach(function (k) { var p = U.$('[data-help="' + k + '"]', el); if (p) p.hidden = false; });

    var w = [];
    if (r.maxpos !== null && r.pv > r.maxpos + 0.005) w.push('This position is bigger than your buying power.');
    if (r.riskPct !== null && r.riskPct > CFG.maxRiskPctWarn) w.push('You are risking more than ' + CFG.maxRiskPctWarn + '% of your account on this trade.');
    if (r.liq !== null && r.stop !== null && ((r.side === 'long' && r.liq >= r.stop) || (r.side === 'short' && r.liq <= r.stop))) w.push('Your stop is beyond the liquidation price. You would be liquidated before it triggers.');
    if (i && !C.canPnl(i) && r.exit !== null) w.push('Profit on this pair cannot be converted to dollars exactly.');
    C.levelErrors(r.side, r.entry, num(draft.slVal) !== null && draft.slMode === 'price' ? num(draft.slVal) : r.stop, num(draft.tpVal) !== null && draft.tpMode === 'price' ? num(draft.tpVal) : r.tp).forEach(function (m) { w.push('Fix this: ' + m); });
    var wb = U.$('#warns', view); if (wb) wb.innerHTML = w.map(function (m) { return '<p class="msg warn">' + U.esc(m) + '</p>'; }).join('');
  }
  function step3() {
    var shots = draft.shots.map(function (s, n) { return '<div class="shot"><img alt="Screenshot" data-path="' + U.esc(s.path) + '" src="' + U.esc(s.url) + '"><button type="button" data-act="rmshot" data-v="' + n + '" aria-label="Remove">&times;</button></div>'; }).join('') +
      draft.news.map(function (s, n) { return '<div class="shot"><img alt="New screenshot" src="' + U.esc(s.url) + '"><button type="button" data-act="rmnew" data-v="' + n + '" aria-label="Remove">&times;</button></div>'; }).join('');
    var total = draft.shots.length + draft.news.length;
    return head() +
      '<div class="lbl2">Setup</div><div class="chips">' + D.strategies.map(function (s) { return chip(s.name, draft.strategyId === s.id, 'setup', s.id); }).join('') +
      '<button type="button" class="chip" data-act="addsetup">+ Add</button></div><div id="newsetup"></div>' +
      '<div class="lbl2">Session (set from your entry time)</div><div class="chips">' + CFG.sessions.map(function (s) { return chip(s, draft.session === s, 'session', s); }).join('') + '</div>' +
      '<div class="lbl2">Mistakes (optional)</div><div class="chips">' + CFG.mistakes.map(function (m) { return chip(m, draft.mistakes.indexOf(m) > -1, 'mistake', m); }).join('') + '</div>' +
      '<label class="field" style="margin-top:14px"><span class="lbl">Notes</span><textarea class="in ta" data-f="notes" placeholder="Why did you take it?">' + U.esc(draft.notes) + '</textarea></label>' +
      '<div class="lbl2">Screenshots (up to ' + CFG.maxScreenshots + ')</div><div class="shots">' + shots + (total < CFG.maxScreenshots ? '<button type="button" class="shot add" data-act="pickshot">+ Add</button>' : '') + '</div>' +
      '<input type="file" id="shotin" accept="image/*" multiple hidden>' + errBox() + foot('review', 'Review trade', true);
  }
  function review() {
    var r = calc(), i = r.inst, st = D.strategyName(draft.strategyId);
    function kv(a, b) { return '<div class="kv"><span>' + a + '</span><span>' + b + '</span></div>'; }
    var closed = r.exit !== null;
    return head() + '<div class="card">' +
      kv('Pair', U.esc(i.symbol) + ' &middot; ' + (r.side === 'long' ? 'Long' : 'Short') + ' &middot; ' + r.lev + 'x') +
      kv('Entry', C.fmtPrice(i, r.entry) + ' &middot; ' + U.esc(U.fmtDate(U.fromLocalInput(draft.entryTime)))) +
      kv('Position value', C.fmtMoney(r.pv) + ' (' + C.fmtQty(r.qty) + ' ' + U.esc(baseName(i)) + ')') +
      kv('Stop loss', r.stop === null ? '-' : C.fmtPrice(i, r.stop)) + kv('Take profit', r.tp === null ? '-' : C.fmtPrice(i, r.tp)) +
      kv('Amount at risk', r.riskAmt === null ? '-' : C.fmtMoney(r.riskAmt)) +
      kv('Feeling', U.esc(draft.emotion) + (closed && draft.exitEmotion ? ' &rarr; ' + U.esc(draft.exitEmotion) : '')) +
      kv('Setup / session', U.esc(st || '-') + ' / ' + U.esc(draft.session || '-')) +
      kv('Mistakes', draft.mistakes.length ? U.esc(draft.mistakes.join(', ')) : 'None') +
      (draft.notes.trim() ? kv('Notes', U.esc(draft.notes.trim())) : '') +
      kv('Screenshots', String(draft.shots.length + draft.news.length)) +
      (closed ? kv('Exit', C.fmtPrice(i, r.exit)) + kv('Result', '<b class="' + (r.pnl !== null && r.pnl < 0 ? 'neg' : 'pos') + '">' + C.fmtMoney(r.pnl, true) + '</b>') : kv('Status', 'Open')) +
      '</div>' + errBox() + foot('save', draft.id ? 'Save changes' : 'Save trade', true);
  }

  function render() {
    var y = window.scrollY, fn = [null, step1, step2, step3, review][draft.step];
    view.innerHTML = fn();
    if (draft.step === 2) { exitBox(); updatePlan(); }
    if (draft.step === 3) loadShotUrls();
    window.scrollTo(0, y);
  }
  function showErr(m) { var e = U.$('#errs', view); if (e) { e.textContent = m; e.hidden = false; e.scrollIntoView({ block: 'center' }); } }
  function loadShotUrls() {
    var need = draft.shots.filter(function (s) { return !s.url; }).map(function (s) { return s.path; });
    if (!need.length) return;
    D.signedUrls(need).then(function (map) {
      draft.shots.forEach(function (s) { if (map[s.path]) s.url = map[s.path]; });
      U.$$('img[data-path]', view).forEach(function (im) { var u = map[im.getAttribute('data-path')]; if (u) im.src = u; });
    });
  }

  // ---- validation per step
  function check(step) {
    var r = calc();
    if (step >= 1) {
      if (!draft.emotion) return 'Pick how you feel first.';
      if (!r.inst) return 'Choose a pair.';
      if (!U.fromLocalInput(draft.entryTime)) return 'Set a valid entry time.';
      if (!(r.entry > 0)) return 'Enter your entry price.';
      if (!(r.lev >= 1)) return 'Leverage must be at least 1.';
      if (!(r.pv > 0)) return 'Enter your position value.';
    }
    if (step >= 2) {
      var errs = C.levelErrors(r.side, r.entry, r.stop, r.tp); if (errs.length) return errs[0];
      if (draft.slVal.trim() !== '' && r.stop === null) return 'We could not work out your stop loss. That risk may be bigger than your position, or your account size is not set.';
      if (draft.tpVal.trim() !== '' && r.tp === null) return 'We could not work out your take profit. For an R multiple, set a stop loss first.';
      if (draft.exit.trim() !== '') {
        if (r.exit === null || !(r.exit > 0)) return 'Enter a valid exit price or leave it empty.';
        var ex = U.fromLocalInput(draft.exitTime), en = U.fromLocalInput(draft.entryTime);
        if (!ex) return 'Set a valid exit time.'; if (ex < en) return 'The exit time must be after the entry time.';
        if (r.pnl === null) return 'Enter the profit or loss in dollars for this pair.';
      }
    }
    return '';
  }
  function autoSession() { if (!draft.sessionAuto) return; var d = U.fromLocalInput(draft.entryTime); if (d) draft.session = C.sessionFor(d); }

  // ---- pair picker
  function openPairSheet() {
    var sh = U.$('#sheet');
    var groups = { crypto: 'Crypto', forex: 'Forex', metal: 'Metals' };
    function list(q) {
      q = (q || '').trim().toLowerCase();
      var out = '';
      Object.keys(groups).forEach(function (g) {
        var items = D.enabledInstruments().filter(function (i) { return i.asset_class === g && (!q || (i.symbol + ' ' + i.name).toLowerCase().indexOf(q) > -1); });
        if (items.length) out += '<h3 class="gh">' + groups[g] + '</h3>' + items.map(function (i) {
          return '<button type="button" class="prow' + (i.id === draft.instrumentId ? ' on' : '') + '" data-id="' + i.id + '"><b>' + U.esc(i.symbol) + '</b><span class="muted">' + U.esc(i.name) + '</span></button>';
        }).join('');
      });
      return out || '<p class="muted" style="padding:16px 0">No pairs match.</p>';
    }
    sh.innerHTML = '<div class="sheet-box"><div class="wh"><h1 style="font-size:22px">Choose a pair</h1><button type="button" class="linkbtn" id="sh-close">Close</button></div>' +
      '<input class="in" id="sh-q" placeholder="Search, for example BTC or gold" autocomplete="off"><div id="sh-list">' + list('') + '</div></div>';
    sh.hidden = false;
    U.$('#sh-close').onclick = function () { sh.hidden = true; };
    U.$('#sh-q').oninput = function (e) { U.$('#sh-list').innerHTML = list(e.target.value); };
    U.$('#sh-list').onclick = function (e) {
      var b = e.target.closest('.prow'); if (!b) return;
      draft.instrumentId = b.getAttribute('data-id'); sh.hidden = true; persist(); render();
    };
  }

  // ---- save
  function buildRow() {
    var r = calc(), closed = r.exit !== null, d = U.fromLocalInput(draft.entryTime);
    function round(v) { return v === null || v === undefined ? null : Number(Number(v).toFixed(8)); }
    var row = {
      instrument_id: r.inst.id, side: r.side, entry_price: r.entry, exit_price: closed ? r.exit : null,
      stop_loss: round(r.stop), take_profit: round(r.tp), position_value: r.pv, quantity: round(r.qty), leverage: r.lev,
      risk_amount: round(r.riskAmt), risk_pct: round(r.riskPct), pnl: closed ? round(r.pnl) : null,
      session: draft.session || C.sessionFor(d), strategy_id: draft.strategyId || null, entry_emotion: draft.emotion,
      exit_emotion: closed ? (draft.exitEmotion || null) : null, mistakes: draft.mistakes.slice(), notes: draft.notes.trim() || null,
      opened_at: d.toISOString(), closed_at: closed ? U.fromLocalInput(draft.exitTime).toISOString() : null
    };
    return row;
  }
  var saving = false;
  function save(btn) {
    if (saving) return;
    var m = check(3); if (m) { showErr(m); return; }
    saving = true; btn.setAttribute('aria-busy', 'true'); btn.textContent = 'Saving...';
    var row = buildRow(), id = draft.id || U.uuid(), kept = draft.shots.map(function (s) { return s.path; }), uploaded = [];
    U.$('#errs', view).hidden = true;
    D.uploadShots(id, draft.news.map(function (n) { return n.blob; })).then(function (paths) {
      uploaded = paths; row.screenshots = kept.concat(paths);
      return draft.id ? D.updateTrade(id, row) : D.insertTrade(Object.assign({ id: id }, row));
    }).then(function (saved) {
      if (!saved) throw new Error('The trade could not be saved.');
      return D.removeShots(draft.removed).then(function () { return D.refreshTrades(); });
    }).then(function () {
      draft.news.forEach(function (n) { URL.revokeObjectURL(n.url); });
      var editing = !!draft.id; clearDraft(); saving = false;
      U.toast(editing ? 'Changes saved.' : 'Trade saved.'); location.hash = '#trade/' + id;
    }).catch(function (err) {
      saving = false; D.removeShots(uploaded);
      btn.removeAttribute('aria-busy'); btn.textContent = draft.id ? 'Save changes' : 'Save trade';
      showErr('Could not save: ' + (err && err.message ? err.message : 'try again.'));
    });
  }

  // ---- events
  function onClick(e) {
    var el = e.target.closest('[data-act]'); if (!el) return;
    var a = el.getAttribute('data-act'), v = el.getAttribute('data-v');
    switch (a) {
      case 'emo': draft.emotion = v; break;
      case 'exitemo': draft.exitEmotion = draft.exitEmotion === v ? '' : v; break;
      case 'side': draft.side = v; break;
      case 'pair-open': return openPairSheet();
      case 'pair-pick': draft.instrumentId = v; break;
      case 'now': draft.entryTime = U.toLocalInput(new Date()); autoSession(); break;
      case 'lev': draft.leverage = Number(v); break;
      case 'pvpct':
        var av = D.available(draft.id), lv = num(draft.leverage) || 1;
        if (av === null) { U.toast('Set your account size in Account first.'); return; }
        draft.pv = String(Math.floor(Math.max(0, av) * lv * Number(v)) / 100); break;
      case 'slmode': draft.slMode = v; draft.slVal = ''; break;
      case 'tpmode': draft.tpMode = v; draft.tpVal = ''; break;
      case 'setup': draft.strategyId = draft.strategyId === v ? '' : v; break;
      case 'session': draft.session = v; draft.sessionAuto = false; break;
      case 'mistake': var k = draft.mistakes.indexOf(v); if (k > -1) draft.mistakes.splice(k, 1); else draft.mistakes.push(v); break;
      case 'help': var p = U.$('[data-help="' + v + '"]', view); if (p) p.hidden = !p.hidden; return;
      case 'addsetup': return addSetupBox();
      case 'newsetup-save': return saveSetup();
      case 'livepx': window.OFFPACK_PRICES.ticker(inst()).then(function (t) { draft.entry = String(t.price); persist(); render(); }, function () { U.toast('Live price is unavailable right now.'); }); return;
      case 'pickshot': if (window.OFFPACK_DEMO) { U.toast('Screenshots are switched off in the demo.'); return; } return U.$('#shotin', view).click();
      case 'rmshot': var s = draft.shots.splice(Number(v), 1)[0]; if (s) draft.removed.push(s.path); break;
      case 'rmnew': var n = draft.news.splice(Number(v), 1)[0]; if (n) URL.revokeObjectURL(n.url); break;
      case 'back': draft.step -= 1; break;
      case 'next': var m1 = check(draft.step); if (m1) return showErr(m1); draft.step += 1; if (draft.step === 3) autoSession(); window.scrollTo(0, 0); break;
      case 'review': var m2 = check(3); if (m2) return showErr(m2); draft.step = 4; window.scrollTo(0, 0); break;
      case 'save': return save(el);
      case 'discard':
        return U.confirm(draft.id ? 'Cancel editing?' : 'Discard this draft?', 'Your changes will be lost.', 'Discard').then(function (ok) {
          if (!ok) return; var id = draft.id; clearDraft(); location.hash = id ? '#trade/' + id : '#journal';
        });
    }
    persist(); render();
  }
  function addSetupBox() {
    var b = U.$('#newsetup', view);
    b.innerHTML = '<div class="inrow" style="margin-top:10px"><input class="in" id="ns-name" maxlength="40" placeholder="Setup name"><button type="button" class="chip" data-act="newsetup-save">Add</button></div>';
    U.$('#ns-name', view).focus();
  }
  function saveSetup() {
    var name = U.$('#ns-name', view).value.trim(); if (!name) return;
    var dup = D.strategies.filter(function (s) { return s.name.toLowerCase() === name.toLowerCase(); })[0];
    if (dup) { draft.strategyId = dup.id; persist(); return render(); }
    D.addStrategy(name).then(function (s) { if (s) draft.strategyId = s.id; persist(); render(); }).catch(function (err) { showErr('Could not add that setup: ' + err.message); });
  }
  function onInput(e) {
    var f = e.target.getAttribute('data-f'); if (!f) return;
    draft[f] = e.target.value;
    if (f === 'entryTime') autoSession();
    persist();
    if (draft.step === 2) { if (f === 'exit') exitBox(); updatePlan(); }
  }
  function onChange(e) {
    if (e.target.id !== 'shotin') return;
    var files = Array.prototype.slice.call(e.target.files || []), room = CFG.maxScreenshots - draft.shots.length - draft.news.length;
    e.target.value = '';
    if (!files.length) return;
    if (files.length > room) U.toast('Only ' + CFG.maxScreenshots + ' screenshots per trade.');
    files.slice(0, Math.max(0, room)).reduce(function (chain, f) {
      return chain.then(function () { return U.compressImage(f, 1280, 0.8).then(function (blob) { draft.news.push({ blob: blob, url: URL.createObjectURL(blob) }); }); });
    }, Promise.resolve()).then(render, function (err) { U.toast(err.message); render(); });
  }

  window.OFFPACK_ADD = {
    open: function (container, editId) {
      view = container;
      if (editId) {
        var t = D.trade(editId); if (!t) { location.hash = '#journal'; return; }
        if (!draft || draft.id !== editId) draft = fromTrade(t);
      } else {
        if (draft && draft.id) draft = null;
        var pre = null; try { pre = sessionStorage.getItem('offpack_preset'); if (pre) sessionStorage.removeItem('offpack_preset'); } catch (e) {}
        if (pre) { draft = blank(); if (D.instrument(pre)) draft.instrumentId = pre; }
        if (!draft) draft = restore() || blank();
        if (!D.instrument(draft.instrumentId)) draft.instrumentId = lastInstrument();
      }
      view.onclick = onClick; view.oninput = onInput; view.onchange = onChange;
      render();
    },
    hasDraft: function () { return !!draft; }
  };
})();

/* ===== Journal and trade details ===== */
/* OFFPACK Journal: trade list, trade details, closing a trade. */
(function () {
  'use strict';
  var U = window.OFFPACK_U, C = window.OFFPACK_CALC, D = window.OFFPACK_DATA, CFG = window.OFFPACK, S = window.OFFPACK_STATS;
  var f = { q: '', status: 'all', emo: '' };

  function pnlHtml(t) {
    if (!S.isClosed(t)) return '<span class="tag">Open</span>';
    var p = Number(t.pnl); return '<span class="' + (p < 0 ? 'neg' : p > 0 ? 'pos' : 'muted') + '">' + C.fmtMoney(p, true) + '</span>';
  }
  function row(t) {
    var i = t.instruments || {};
    return '<a class="trade" href="#trade/' + t.id + '"><div><div class="t1"><b>' + U.esc(i.symbol || '?') + '</b><span class="side ' + t.side + '">' + (t.side === 'long' ? 'Long' : 'Short') + '</span><span class="muted">' + Number(t.leverage) + 'x</span></div>' +
      '<div class="t2 muted">' + U.esc(U.fmtDate(t.opened_at)) + (t.entry_emotion ? ' &middot; ' + U.esc(t.entry_emotion) : '') + '</div></div><div class="tr">' + pnlHtml(t) + '</div></a>';
  }
  function filtered() {
    var q = f.q.trim().toLowerCase();
    return D.trades.filter(function (t) {
      if (f.status === 'open' && t.closed_at) return false;
      if (f.status === 'closed' && !t.closed_at) return false;
      if (f.emo && t.entry_emotion !== f.emo) return false;
      if (q) { var hay = ((t.instruments && t.instruments.symbol) + ' ' + (t.notes || '') + ' ' + (t.entry_emotion || '') + ' ' + D.strategyName(t.strategy_id)).toLowerCase(); if (hay.indexOf(q) < 0) return false; }
      return true;
    });
  }
  function listBody() {
    var l = filtered();
    if (!D.trades.length) return '<div class="card empty"><h2>No trades yet.</h2><p class="muted">Log your first one. It takes a minute.</p><a class="btn" href="#add" style="margin-top:16px">Add trade</a></div>';
    if (!l.length) return '<p class="muted" style="padding:20px 0">No trades match.</p>';
    return '<p class="muted" style="font-size:13px;margin-bottom:6px">' + l.length + (l.length === 1 ? ' trade' : ' trades') + '</p><div class="card list">' + l.map(row).join('') + '</div>';
  }
  function chips() {
    function c(label, on, act, v) { return '<button type="button" class="chip' + (on ? ' on' : '') + '" data-act="' + act + '" data-v="' + U.esc(v) + '">' + U.esc(label) + '</button>'; }
    return '<div class="chips">' + [['all', 'All'], ['open', 'Open'], ['closed', 'Closed']].map(function (s) { return c(s[1], f.status === s[0], 'status', s[0]); }).join('') + '</div>' +
      '<div class="chips scroll">' + CFG.emotions.map(function (e) { return c(e, f.emo === e, 'emo', e); }).join('') + '</div>';
  }
  function list(view) {
    view.innerHTML = '<h1>Journal</h1><input class="in" id="jq" placeholder="Search pair, notes or setup" value="' + U.esc(f.q) + '" style="margin-bottom:10px"><div id="jc">' + chips() + '</div><div id="jl">' + listBody() + '</div>';
    view.oninput = function (e) { if (e.target.id === 'jq') { f.q = e.target.value; U.$('#jl', view).innerHTML = listBody(); } };
    view.onclick = function (e) {
      var b = e.target.closest('[data-act]'); if (!b) return;
      var a = b.getAttribute('data-act'), v = b.getAttribute('data-v');
      if (a === 'status') f.status = v; else if (a === 'emo') f.emo = f.emo === v ? '' : v; else return;
      U.$('#jc', view).innerHTML = chips(); U.$('#jl', view).innerHTML = listBody();
    };
  }

  // ---- details
  function kv(a, b) { return '<div class="kv"><span>' + a + '</span><span>' + b + '</span></div>'; }
  function detail(view, id) {
    var t = D.trade(id);
    if (!t) { view.innerHTML = '<p class="muted">That trade was not found.</p><a class="btn ghost" href="#journal">Back to journal</a>'; return; }
    var i = t.instruments || D.instrument(t.instrument_id) || { symbol: '?' }, closed = S.isClosed(t), p = closed ? Number(t.pnl) : null;
    var R = closed ? C.rMultiple(p, Number(t.risk_amount)) : null, entry = Number(t.entry_price);
    var rr = C.plannedRR(t.side, entry, t.stop_loss === null ? 0 : Number(t.stop_loss), t.take_profit === null ? 0 : Number(t.take_profit));
    var pr = function (v) { return v === null || v === undefined ? '-' : C.fmtPrice(i, Number(v)); };
    var tags = function (a) { return a && a.length ? a.map(function (m) { return '<span class="tag neg">' + U.esc(m) + '</span>'; }).join(' ') : '<span class="muted">None</span>'; };
    view.innerHTML = '<a class="back" href="#journal">&larr; Journal</a>' +
      '<div class="dh"><h1>' + U.esc(i.symbol) + '</h1><span class="side ' + t.side + '">' + (t.side === 'long' ? 'Long' : 'Short') + '</span>' + (closed ? '' : '<span class="tag">Open</span>') + '</div>' +
      '<div class="card big">' + (closed ? '<div class="bigv ' + (p < 0 ? 'neg' : p > 0 ? 'pos' : '') + '">' + C.fmtMoney(p, true) + '</div><div class="muted">' + (R !== null ? R.toFixed(2) + 'R' : 'Result') + '</div>' :
        '<div class="bigv">Open</div><div class="muted">Close it when you exit</div>') + '</div>' +
      '<div class="card">' + kv('Entry price', pr(t.entry_price)) + kv('Exit price', pr(t.exit_price)) + kv('Stop loss', pr(t.stop_loss)) + kv('Take profit', pr(t.take_profit)) +
      kv('Position value', C.fmtMoney(Number(t.position_value))) + kv('Trade size', t.quantity ? C.fmtQty(Number(t.quantity)) : '-') + kv('Leverage', Number(t.leverage) + 'x') +
      kv('Amount at risk', t.risk_amount === null ? '-' : C.fmtMoney(Number(t.risk_amount)) + (t.risk_pct !== null ? ' (' + Number(t.risk_pct).toFixed(2) + '%)' : '')) +
      kv('Planned reward vs risk', rr === null ? '-' : '1 : ' + rr.toFixed(2)) + kv('Opened', U.esc(U.fmtDate(t.opened_at))) + kv('Closed', t.closed_at ? U.esc(U.fmtDate(t.closed_at)) : '-') +
      kv('Session', U.esc(t.session || '-')) + kv('Setup', U.esc(D.strategyName(t.strategy_id) || '-')) + '</div>' +
      '<div class="card"><h3>How you felt</h3><div class="chips"><span class="tag">' + U.esc(t.entry_emotion || '-') + '</span>' + (t.exit_emotion ? '<span class="muted">&rarr;</span><span class="tag">' + U.esc(t.exit_emotion) + '</span>' : '') + '</div>' +
      '<h3 style="margin-top:14px">Mistakes</h3><div class="chips">' + tags(t.mistakes) + '</div></div>' +
      (t.notes ? '<div class="card"><h3>Notes</h3><p style="white-space:pre-wrap">' + U.esc(t.notes) + '</p></div>' : '') +
      (t.screenshots && t.screenshots.length ? '<div class="card"><h3>Screenshots</h3><div class="shots" id="dshots">' + t.screenshots.map(function (s) { return '<div class="shot"><img alt="Screenshot" data-path="' + U.esc(s) + '" src=""></div>'; }).join('') + '</div></div>' : '') +
      '<div class="stack" style="margin-top:6px">' + (closed ? '' : '<button type="button" class="btn" data-act="close">Close trade</button>') +
      '<a class="btn ghost" href="#edit/' + t.id + '">Edit</a><button type="button" class="btn ghost danger" data-act="delete">Delete trade</button></div>';
    if (t.screenshots && t.screenshots.length) D.signedUrls(t.screenshots).then(function (map) {
      U.$$('#dshots img', view).forEach(function (im) { im.src = map[im.getAttribute('data-path')] || ''; });
    });
    view.oninput = null;
    view.onclick = function (e) {
      var im = e.target.closest('#dshots img'); if (im && im.src) return lightbox(im.src);
      var b = e.target.closest('[data-act]'); if (!b) return;
      if (b.getAttribute('data-act') === 'close') closeSheet(t, function () { detail(view, id); });
      if (b.getAttribute('data-act') === 'delete') {
        U.confirm('Delete this trade?', 'This also deletes its screenshots. You cannot undo it.', 'Delete').then(function (ok) {
          if (!ok) return;
          D.deleteTrade(t).then(function () { return D.refreshTrades(); }).then(function () { U.toast('Trade deleted.'); location.hash = '#journal'; }, function (err) { U.toast('Could not delete: ' + err.message); });
        });
      }
    };
  }
  function lightbox(src) {
    var sh = U.$('#sheet'); sh.innerHTML = '<div class="sheet-box"><div class="wh"><span></span><button type="button" class="linkbtn" id="sh-close">Close</button></div><img alt="Screenshot" src="' + U.esc(src) + '" style="width:100%;border-radius:10px"></div>';
    sh.hidden = false; U.$('#sh-close').onclick = function () { sh.hidden = true; };
  }

  // ---- close a trade
  function closeSheet(t, done) {
    var i = t.instruments || D.instrument(t.instrument_id), sh = U.$('#sheet');
    var qty = t.quantity ? Number(t.quantity) : C.quantity(i, Number(t.position_value), Number(t.entry_price));
    var st = { exit: '', time: U.toLocalInput(new Date()), emo: '', manual: '' };
    function preview() {
      var ex = C.parseNum(st.exit), p = ex > 0 ? C.pnl(i, t.side, Number(t.entry_price), ex, qty) : null;
      if (ex > 0 && p === null && C.parseNum(st.manual) !== null) p = C.parseNum(st.manual);
      var R = p !== null ? C.rMultiple(p, Number(t.risk_amount)) : null;
      return { ex: ex, p: p, R: R };
    }
    function draw() {
      var pv = preview(), manual = pv.ex > 0 && !C.canPnl(i);
      sh.innerHTML = '<div class="sheet-box"><div class="wh"><h1 style="font-size:22px">Close ' + U.esc(i.symbol) + '</h1><button type="button" class="linkbtn" id="sh-close">Cancel</button></div>' +
        '<label class="field"><span class="lbl">Exit price</span><input class="in" id="c-exit" inputmode="decimal" value="' + U.esc(st.exit) + '" placeholder="0.00"></label>' +
        '<label class="field"><span class="lbl">Exit time</span><input class="in" id="c-time" type="datetime-local" value="' + U.esc(st.time) + '"></label>' +
        (manual ? '<label class="field"><span class="lbl">Profit or loss in dollars</span><input class="in" id="c-manual" inputmode="decimal" value="' + U.esc(st.manual) + '"></label>' : '') +
        '<div class="lbl2">How do you feel now? (optional)</div><div class="chips">' + CFG.emotions.map(function (e) { return '<button type="button" class="chip' + (st.emo === e ? ' on' : '') + '" data-e="' + U.esc(e) + '">' + U.esc(e) + '</button>'; }).join('') + '</div>' +
        '<div class="card" style="margin-top:14px" id="c-prev">' + prev(pv) + '</div><p class="msg err" id="c-err" hidden></p><button type="button" class="btn" id="c-save">Close trade</button></div>';
      sh.hidden = false;
      U.$('#sh-close').onclick = function () { sh.hidden = true; };
      U.$('#c-exit').oninput = function (e) { st.exit = e.target.value; U.$('#c-prev').innerHTML = prev(preview()); var m = !C.canPnl(i) && C.parseNum(st.exit) > 0; if (m !== !!U.$('#c-manual')) draw(); };
      U.$('#c-time').oninput = function (e) { st.time = e.target.value; };
      var mi = U.$('#c-manual'); if (mi) mi.oninput = function (e) { st.manual = e.target.value; U.$('#c-prev').innerHTML = prev(preview()); };
      U.$$('[data-e]', sh).forEach(function (b) { b.onclick = function () { var v = b.getAttribute('data-e'); st.emo = st.emo === v ? '' : v; draw(); }; });
      U.$('#c-save').onclick = save;
    }
    function prev(pv) { return pv.p === null ? '<span class="muted">Enter your exit price to see the result.</span>' : '<div class="kv"><span>Result</span><b class="' + (pv.p < 0 ? 'neg' : 'pos') + '">' + C.fmtMoney(pv.p, true) + '</b></div>' + (pv.R !== null ? '<div class="kv"><span>R multiple</span><b>' + pv.R.toFixed(2) + 'R</b></div>' : ''); }
    function save() {
      var pv = preview(), err = U.$('#c-err'), btn = U.$('#c-save'), when = U.fromLocalInput(st.time);
      function fail(m) { err.textContent = m; err.hidden = false; }
      if (!(pv.ex > 0)) return fail('Enter a valid exit price.');
      if (!when) return fail('Set a valid exit time.'); if (when < new Date(t.opened_at)) return fail('The exit time must be after the entry time.');
      if (pv.p === null) return fail('Enter the profit or loss in dollars.');
      btn.setAttribute('aria-busy', 'true'); btn.textContent = 'Saving...';
      D.updateTrade(t.id, { exit_price: pv.ex, closed_at: when.toISOString(), pnl: Number(pv.p.toFixed(6)), exit_emotion: st.emo || null })
        .then(function () { return D.refreshTrades(); }).then(function () { sh.hidden = true; U.toast('Trade closed.'); done(); },
          function (e) { btn.removeAttribute('aria-busy'); btn.textContent = 'Close trade'; fail('Could not save: ' + e.message); });
    }
    draw();
  }
  window.OFFPACK_JOURNAL = { list: list, detail: detail, row: row };
})();

/* ===== Account ===== */
/* OFFPACK Account: name, account size, default risk, theme, export, log out. */
(function () {
  'use strict';
  var U = window.OFFPACK_U, C = window.OFFPACK_CALC, D = window.OFFPACK_DATA, CFG = window.OFFPACK;

  function csvCell(v, text) {
    var s = v === null || v === undefined ? '' : String(v);
    if (text && /^[=+\-@\t\r]/.test(s)) s = "'" + s;
    return /[",\n\r]/.test(s) ? '"' + s.replace(/"/g, '""') + '"' : s;
  }
  function exportCsv() {
    var head = ['opened_at', 'closed_at', 'pair', 'side', 'leverage', 'entry_price', 'exit_price', 'stop_loss', 'take_profit', 'position_value', 'quantity', 'pnl', 'risk_amount', 'entry_emotion', 'exit_emotion', 'setup', 'session', 'mistakes', 'notes'];
    var lines = [head.join(',')];
    D.trades.slice().reverse().forEach(function (t) {
      lines.push([t.opened_at, t.closed_at, t.instruments && t.instruments.symbol, t.side, t.leverage, t.entry_price, t.exit_price, t.stop_loss, t.take_profit, t.position_value, t.quantity, t.pnl, t.risk_amount]
        .map(function (v) { return csvCell(v, false); }).concat([csvCell(t.entry_emotion, true), csvCell(t.exit_emotion, true), csvCell(D.strategyName(t.strategy_id), true), csvCell(t.session, true), csvCell((t.mistakes || []).join('; '), true), csvCell(t.notes, true)]).join(','));
    });
    var blob = new Blob(['\ufeff' + lines.join('\r\n')], { type: 'text/csv;charset=utf-8' }), url = URL.createObjectURL(blob), a = document.createElement('a');
    a.href = url; a.download = 'offpack-trades.csv'; document.body.appendChild(a); a.click(); a.remove();
    setTimeout(function () { URL.revokeObjectURL(url); }, 2000);
  }
  function renderDemo(view) {
    var T = window.OFFPACK_THEME, cur = T.get();
    view.innerHTML = '<h1>Demo</h1><div class="card"><p>You are in the demo. The trades are made up and nothing is saved.</p></div>' +
      '<div class="card"><h3>Appearance</h3><div class="seg">' + ['system', 'dark', 'light'].map(function (m) { return '<button type="button" class="' + (cur === m ? 'on' : '') + '" data-theme-set="' + m + '">' + m[0].toUpperCase() + m.slice(1) + '</button>'; }).join('') + '</div></div>' +
      '<div class="stack"><a class="btn" href="login.html?mode=signup">Create free account</a><a class="btn ghost" href="index.html">Exit demo</a></div>';
    U.$$('[data-theme-set]', view).forEach(function (b) { b.onclick = function () { T.set(b.getAttribute('data-theme-set')); renderDemo(view); }; });
  }
  function openDelete() {
    var sh = U.$('#sheet');
    sh.innerHTML = '<div class="sheet-box"><div class="wh"><h1 style="font-size:22px">Delete account</h1><button type="button" class="linkbtn" id="sh-close">Cancel</button></div>' +
      '<p class="muted" style="margin:8px 0 14px">This permanently deletes your account, every trade and every screenshot. You cannot undo it. Export your trades first if you want a copy. Type DELETE to confirm.</p>' +
      '<input class="in" id="del-in" autocomplete="off" placeholder="DELETE"><p class="msg err" id="del-err" hidden style="margin-top:12px"></p><button type="button" class="btn ghost danger" id="del-go" style="margin-top:12px">Delete my account</button></div>';
    sh.hidden = false;
    U.$('#sh-close').onclick = function () { sh.hidden = true; };
    U.$('#del-go').onclick = function () {
      var err = U.$('#del-err'), btn = U.$('#del-go');
      function fail(m) { err.textContent = m; err.hidden = false; btn.removeAttribute('aria-busy'); btn.textContent = 'Delete my account'; }
      if (U.$('#del-in').value.trim() !== 'DELETE') return fail('Type DELETE in capital letters to confirm.');
      btn.setAttribute('aria-busy', 'true'); btn.textContent = 'Deleting...'; err.hidden = true;
      var paths = []; D.trades.forEach(function (t) { (t.screenshots || []).forEach(function (p) { paths.push(p); }); });
      D.removeShots(paths).then(function () { return window.sb.rpc('delete_my_account'); }).then(function (r) {
        if (r && r.error) return fail('Could not delete your account: ' + r.error.message + '. Email ' + CFG.supportEmail + ' and we will do it for you.');
        return window.sb.auth.signOut().then(function () { location.replace('index.html'); }, function () { location.replace('index.html'); });
      }, function (e) { fail('Could not delete your account: ' + (e && e.message || 'try again') + '.'); });
    };
  }
  function render(view) {
    if (window.OFFPACK_DEMO) return renderDemo(view);
    var p = D.profile, size = D.accountSize(), T = window.OFFPACK_THEME, cur = T.get();
    view.innerHTML = '<h1>Account</h1>' +
      '<div class="card"><h3>Signed in as</h3><p>' + U.esc(D.user.email || '') + '</p></div>' +
      '<form class="card stack" id="af" novalidate><h3>Your trading account</h3>' +
      '<label class="field"><span class="lbl">Name</span><input class="in" id="a-name" maxlength="40" value="' + U.esc(p.display_name || '') + '" placeholder="What should we call you?"></label>' +
      '<label class="field"><span class="lbl">Account size (USD)</span><input class="in" id="a-size" inputmode="decimal" value="' + U.esc(size === null ? '' : size) + '" placeholder="For example 10000"></label>' +
      '<label class="field"><span class="lbl">Default risk per trade (%)</span><input class="in" id="a-risk" inputmode="decimal" value="' + U.esc(p.default_risk_pct) + '"></label>' +
      '<p class="muted" style="font-size:13px">Your account size is the starting balance. Closed trades add to it. All amounts are in US dollars for now.</p>' +
      '<p class="msg err" id="a-msg" hidden></p><button class="btn" type="submit" id="a-save">Save</button></form>' +
      '<div class="card"><h3>Appearance</h3><div class="seg">' + ['system', 'dark', 'light'].map(function (m) { return '<button type="button" class="' + (cur === m ? 'on' : '') + '" data-theme-set="' + m + '">' + m[0].toUpperCase() + m.slice(1) + '</button>'; }).join('') + '</div></div>' +
      '<div class="card"><h3>Your data</h3><p class="muted" style="margin-bottom:12px">Download every trade as a spreadsheet file.</p><button type="button" class="btn ghost" id="a-export">Export trades (CSV)</button>' +
      '</div><div class="card"><h3>Delete account</h3><p class="muted" style="margin-bottom:12px">Permanently remove your account and all your data.</p><button type="button" class="btn ghost danger" id="a-delete">Delete account</button></div>' +
      '<button type="button" class="btn ghost" id="signout">Log out</button>';
    U.$('#a-export', view).onclick = function () { if (!D.trades.length) return U.toast('No trades to export yet.'); exportCsv(); };
    U.$$('[data-theme-set]', view).forEach(function (b) { b.onclick = function () { T.set(b.getAttribute('data-theme-set')); render(view); }; });
    U.$('#a-delete', view).onclick = openDelete;
    U.$('#signout', view).onclick = function () { window.sb.auth.signOut().then(function () { location.replace('login.html'); }, function () { location.replace('login.html'); }); };
    U.$('#af', view).onsubmit = function (e) {
      e.preventDefault();
      var msg = U.$('#a-msg', view), btn = U.$('#a-save', view);
      function fail(m) { msg.textContent = m; msg.hidden = false; }
      var sizeTxt = U.$('#a-size', view).value.trim(), size = sizeTxt === '' ? null : C.parseNum(sizeTxt), risk = C.parseNum(U.$('#a-risk', view).value);
      if (sizeTxt !== '' && (size === null || size < 0)) return fail('Enter a valid account size, or leave it empty.');
      if (!(risk > 0 && risk <= 100)) return fail('Default risk must be between 0 and 100.');
      msg.hidden = true; btn.setAttribute('aria-busy', 'true'); btn.textContent = 'Saving...';
      D.saveProfile({ display_name: U.$('#a-name', view).value.trim() || null, account_balance: size, default_risk_pct: risk }).then(function () {
        btn.removeAttribute('aria-busy'); btn.textContent = 'Save'; U.toast('Saved.');
      }, function (err) { btn.removeAttribute('aria-busy'); btn.textContent = 'Save'; fail('Could not save: ' + err.message); });
    };
  }
  window.OFFPACK_ACCOUNT = { render: render, csv: csvCell };
})();

/* ===== Home, calendar, insights ===== */
/* OFFPACK Home, Calendar and Insights screens. */
(function () {
  'use strict';
  var U = window.OFFPACK_U, C = window.OFFPACK_CALC, D = window.OFFPACK_DATA, S = window.OFFPACK_STATS, J = window.OFFPACK_JOURNAL;
  var ranges = { home: 'all', ins: 'all' };
  var cal = { y: new Date().getFullYear(), m: new Date().getMonth(), sel: '' };
  var RANGES = [['7d', 'Last 7D'], ['30d', 'Last 30D'], ['all', 'All time']];

  function plannedRR(t) { return C.plannedRR(t.side, Number(t.entry_price), Number(t.stop_loss), Number(t.take_profit)); }
  function rangeChips(key) {
    return '<div class="chips">' + RANGES.map(function (r) { return '<button type="button" class="chip' + (ranges[key] === r[0] ? ' on' : '') + '" data-range="' + r[0] + '">' + r[1] + '</button>'; }).join('') + '</div>';
  }
  function greeting() { var h = new Date().getHours(); return h < 12 ? 'Good morning' : h < 18 ? 'Good afternoon' : 'Good evening'; }
  function tile(label, value, cls) { return '<div class="card kpi"><small>' + label + '</small><div class="kv-big ' + (cls || '') + '">' + value + '</div></div>'; }
  function sgn(v) { return v > 0 ? 'pos' : v < 0 ? 'neg' : ''; }

  function curve(points) {
    var W = 400, H = 150, pad = 10, pts = points.length < 2 ? [points[0] || { t: 0, v: 0 }, { t: 1, v: (points[0] || { v: 0 }).v }] : points;
    var t0 = pts[0].t, t1 = pts[pts.length - 1].t, vs = pts.map(function (p) { return p.v; }), lo = Math.min.apply(null, vs), hi = Math.max.apply(null, vs);
    var xy = pts.map(function (p, i) {
      var x = t1 > t0 ? (p.t - t0) / (t1 - t0) * W : i / (pts.length - 1) * W;
      var y = hi > lo ? H - pad - (p.v - lo) / (hi - lo) * (H - 2 * pad) : H / 2;
      return [x, y];
    });
    var line = xy.map(function (p, i) { return (i ? 'L' : 'M') + p[0].toFixed(1) + ' ' + p[1].toFixed(1); }).join('');
    var up = pts[pts.length - 1].v >= pts[0].v, col = up ? 'var(--good)' : 'var(--bad)';
    return '<svg class="ch" viewBox="0 0 ' + W + ' ' + H + '" preserveAspectRatio="none" role="img" aria-label="Equity curve"><path d="' + line + 'L' + W + ' ' + H + 'L0 ' + H + 'Z" style="fill:' + col + ';opacity:0.12"/><path d="' + line + '" fill="none" stroke-width="2" vector-effect="non-scaling-stroke" stroke-linejoin="round" style="stroke:' + col + '"/></svg>';
  }
  function bindRange(view, key, redraw) {
    view.onclick = function (e) { var b = e.target.closest('[data-range]'); if (b) { ranges[key] = b.getAttribute('data-range'); redraw(); } };
  }

  // ---- Home
  function home(view) {
    var closedAll = S.closedTrades(D.trades), list = S.inRange(closedAll, ranges.home), sum = S.summary(list, plannedRR);
    var eq = S.equity(closedAll, ranges.home, D.accountSize()), dd = S.maxDrawdown(eq.points);
    var groups = S.groupBy(list, function (t) { return t.entry_emotion; }), fd = S.finding(groups), name = D.profile.display_name;
    var size = D.accountSize();
    view.innerHTML = '<h1>' + U.esc(greeting() + (name ? ', ' + name : '') + '.') + '</h1>' + rangeChips('home') +
      (size === null ? '<div class="card"><b>Set your account size</b><p class="muted" style="margin:6px 0 12px">We use it for your balance, risk and drawdown.</p><a class="btn" href="#account">Open Account</a></div>' :
        '<div class="card"><small class="muted">Account balance</small><div class="kv-big">' + C.fmtMoney(D.balance()) + '</div></div>') +
      (fd ? '<div class="card finding"><b>' + U.esc(fd.low.key) + ' has your lowest win rate</b><div class="muted">' + fd.low.n + ' ' + U.esc(fd.low.key) + ' trades, ' + fd.low.winRate.toFixed(0) + '% win rate. ' + U.esc(fd.high.key) + ' trades: ' + fd.high.winRate.toFixed(0) + '%.</div></div>' :
        '<div class="card finding"><div class="muted">Log at least ' + S.MIN_N + ' closed trades with each feeling to see patterns here.</div></div>') +
      '<div class="grid2">' + tile('Total P&amp;L', C.fmtMoney(sum.total, true), sgn(sum.total)) + tile('Win rate', sum.winRate === null ? '-' : sum.winRate.toFixed(1) + '%') +
      tile('Trades', String(sum.n)) + tile('Avg R:R', sum.avgRR === null ? '-' : '1 : ' + sum.avgRR.toFixed(2)) + '</div>' +
      '<div class="card kpi wide"><small>Max drawdown</small><div class="kv-big ' + (dd < 0 ? 'neg' : '') + '">' + dd.toFixed(1) + '%</div></div>' +
      '<div class="card"><h3>Equity curve</h3>' + curve(eq.points) + (eq.relative ? '<p class="muted" style="font-size:12px">Starts at zero until you set your account size.</p>' : '') + '</div>' +
      '<div class="card"><div class="wh"><h3 style="margin:0">Recent trades</h3><a class="muted" href="#journal">See all</a></div>' +
      (D.trades.length ? '<div class="list">' + D.trades.slice(0, 5).map(J.row).join('') + '</div>' : '<p class="muted" style="margin:10px 0 12px">No trades yet.</p><a class="btn" href="#add">Add your first trade</a>') + '</div>';
    bindRange(view, 'home', function () { home(view); });
  }

  // ---- Calendar
  var MONTHS = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];
  function calendar(view) {
    var closed = S.closedTrades(D.trades), byDay = S.byDay(closed), cells = S.monthGrid(cal.y, cal.m), total = 0, count = 0;
    var days = cells.map(function (d) {
      if (!d) return '<div class="day empty"></div>';
      var key = cal.y + '-' + ('0' + (cal.m + 1)).slice(-2) + '-' + ('0' + d).slice(-2), x = byDay[key];
      if (x) { total += x.pnl; count += x.n; }
      return '<button type="button" class="day' + (x ? (x.pnl >= 0 ? ' win' : ' loss') : '') + (cal.sel === key ? ' sel' : '') + '" data-d="' + key + '"><span>' + d + '</span>' + (x ? '<b>' + (x.pnl >= 0 ? '+' : '-') + Math.round(Math.abs(x.pnl)) + '</b>' : '') + '</button>';
    }).join('');
    var sel = cal.sel && byDay[cal.sel] ? byDay[cal.sel] : null;
    view.innerHTML = '<h1>Calendar</h1><div class="wh calnav"><button type="button" class="ib" data-nav="-1" aria-label="Previous month">&lsaquo;</button><b>' + MONTHS[cal.m] + ' ' + cal.y + '</b><button type="button" class="ib" data-nav="1" aria-label="Next month">&rsaquo;</button></div>' +
      '<p class="muted" style="margin-bottom:10px">This month: <b class="' + sgn(total) + '">' + C.fmtMoney(total, true) + '</b> &middot; ' + count + (count === 1 ? ' trade' : ' trades') + '</p>' +
      '<div class="cal"><div class="dow">Mon</div><div class="dow">Tue</div><div class="dow">Wed</div><div class="dow">Thu</div><div class="dow">Fri</div><div class="dow">Sat</div><div class="dow">Sun</div>' + days + '</div>' +
      (sel ? '<div class="card list" style="margin-top:14px"><h3>' + U.esc(U.fmtDate(cal.sel + 'T12:00:00', false)) + '</h3>' + sel.trades.map(J.row).join('') + '</div>' : '<p class="muted" style="margin-top:14px">Tap a day to see its trades.</p>');
    view.onclick = function (e) {
      var n = e.target.closest('[data-nav]'), d = e.target.closest('[data-d]');
      if (n) { cal.m += Number(n.getAttribute('data-nav')); if (cal.m < 0) { cal.m = 11; cal.y--; } if (cal.m > 11) { cal.m = 0; cal.y++; } cal.sel = ''; calendar(view); }
      else if (d) { var k = d.getAttribute('data-d'); cal.sel = cal.sel === k ? '' : k; calendar(view); }
    };
  }

  // ---- Insights
  function bars(groups) {
    return groups.map(function (g) {
      var cls = !g.enough ? 'dim' : g.avg > 0 ? 'pos' : g.avg < 0 ? 'neg' : 'dim';
      return '<div class="row"><span>' + U.esc(g.key) + ' <span class="muted">(' + g.n + ')</span></span><span class="' + (cls === 'dim' ? '' : cls) + '">' + g.winRate.toFixed(0) + '%</span></div><div class="bar"><i class="' + cls + '" style="width:' + g.winRate + '%"></i></div>';
    }).join('');
  }
  function insights(view) {
    var closed = S.closedTrades(D.trades), list = S.inRange(closed, ranges.ins), sum = S.summary(list, plannedRR);
    var chipsHtml = rangeChips('ins');
    if (!list.length) { view.innerHTML = '<h1>Insights</h1>' + chipsHtml + '<div class="card empty"><h2>Nothing to show yet.</h2><p class="muted">Close a few trades and your patterns will appear here.</p><a class="btn" href="#add" style="margin-top:16px">Add trade</a></div>'; bindRange(view, 'ins', function () { insights(view); }); return; }
    var emo = S.groupBy(list, function (t) { return t.entry_emotion; }), fd = S.finding(emo);
    var setups = S.groupBy(list, function (t) { return D.strategyName(t.strategy_id); }), sess = S.groupBy(list, function (t) { return t.session; });
    var pairs = S.pairsChange(list), mist = S.mistakes(list);
    var money = function (g) { return '<div class="kv"><span>' + U.esc(g.key) + ' <span class="muted">(' + g.n + ')</span></span><span class="' + (g.enough ? sgn(g.avg) : 'muted') + '">' + C.fmtMoney(g.avg, true) + '</span></div>'; };
    view.innerHTML = '<h1>Insights</h1>' + chipsHtml +
      (fd ? '<div class="card finding"><b>' + U.esc(fd.low.key) + ' has your lowest win rate</b><div class="muted">' + fd.low.n + ' ' + U.esc(fd.low.key) + ' trades, ' + fd.low.winRate.toFixed(0) + '% win rate</div></div>' :
        '<div class="card finding"><div class="muted">Log at least ' + S.MIN_N + ' closed trades with the same feeling, for two or more feelings, to see your first finding.</div></div>') +
      '<div class="grid2">' + tile('Profit factor', sum.profitFactor === null ? '-' : sum.profitFactor.toFixed(2)) + tile('Expectancy', C.fmtMoney(sum.expectancy, true), sgn(sum.expectancy)) +
      tile('Avg win', sum.avgWin === null ? '-' : C.fmtMoney(sum.avgWin), sum.avgWin === null ? '' : 'pos') + tile('Avg loss', sum.avgLoss === null ? '-' : C.fmtMoney(-sum.avgLoss), sum.avgLoss === null ? '' : 'neg') + '</div>' +
      (emo.length ? '<div class="card"><h3>Win rate by feeling</h3>' + bars(emo) + '</div><div class="card"><h3>Average result by feeling</h3>' + emo.map(money).join('') + '</div>' : '') +
      (pairs.length ? '<div class="card"><h3>Feeling at entry vs exit</h3>' + pairs.map(function (g) { return '<div class="kv"><span>' + U.esc(g.key) + '</span><span class="muted">' + g.n + (g.n === 1 ? ' trade' : ' trades') + '</span></div>'; }).join('') + '</div>' : '') +
      (mist.length ? '<div class="card"><h3>Repeated mistakes</h3>' + mist.map(function (m) { return '<div class="kv"><span>' + U.esc(m.key) + '</span><span class="neg">' + m.n + (m.n === 1 ? ' time' : ' times') + '</span></div>'; }).join('') + '</div>' : '') +
      (setups.length ? '<div class="card"><h3>Win rate by setup</h3>' + bars(setups) + '</div>' : '') +
      (sess.length ? '<div class="card"><h3>Win rate by session</h3>' + bars(sess) + '</div>' : '') +
      '<p class="muted" style="font-size:12px">Based on closed trades. Results with fewer than ' + S.MIN_N + ' trades are less reliable. Bar color shows average result: green is profit, red is loss, grey is fewer than ' + S.MIN_N + ' trades.</p>';
    bindRange(view, 'ins', function () { insights(view); });
  }
  window.OFFPACK_VIEWS = { home: home, calendar: calendar, insights: insights, curve: curve };
})();

/* ===== Pairs and favorites ===== */
/* OFFPACK pairs: search all pairs, favorites, and the pair page with a live price. */
(function () {
  'use strict';
  var U = window.OFFPACK_U, C = window.OFFPACK_CALC, D = window.OFFPACK_DATA, P = window.OFFPACK_PRICES;
  var timer = null, tf = '1D', q = '';
  var STAR = '<svg viewBox="0 0 24 24" width="22" height="22" aria-hidden="true"><path d="M12 3l2.7 5.6 6.1.9-4.4 4.3 1 6.1L12 17l-5.4 2.9 1-6.1L3.2 9.5l6.1-.9z"/></svg>';
  function stop() { if (timer) { clearInterval(timer); timer = null; } }
  function star(id) { return '<button type="button" class="star' + (D.isFav(id) ? ' on' : '') + '" data-fav="' + id + '" aria-label="Favorite">' + STAR + '</button>'; }
  function chg(v) { return v === null || v === undefined || !isFinite(v) ? '' : '<span class="' + (v < 0 ? 'neg' : 'pos') + '">' + (v > 0 ? '+' : '') + v.toFixed(2) + '%</span>'; }
  function bindFav(view, after) {
    if (view._fav) view.removeEventListener('click', view._fav, true);
    view._fav = function (e) {
      var b = e.target.closest('[data-fav]'); if (!b) return;
      e.preventDefault(); e.stopPropagation();
      D.toggleFavorite(b.getAttribute('data-fav')).then(function () { after(); }, function (err) { U.toast('Could not update favorites: ' + err.message); });
    };
    view.addEventListener('click', view._fav, true);
  }

  // ---- all pairs
  function directory(view) {
    var groups = { crypto: 'Crypto', forex: 'Forex', metal: 'Metals' };
    function list() {
      var t = q.trim().toLowerCase(), out = '';
      Object.keys(groups).forEach(function (g) {
        var items = D.enabledInstruments().filter(function (i) { return i.asset_class === g && (!t || (i.symbol + ' ' + i.name).toLowerCase().indexOf(t) > -1); });
        if (items.length) out += '<h3 class="gh">' + groups[g] + '</h3><div class="card list">' + items.map(function (i) {
          return '<a class="trade" href="#pair/' + i.id + '"><div><b>' + U.esc(i.symbol) + '</b><div class="t2 muted">' + U.esc(i.name) + '</div></div>' + star(i.id) + '</a>';
        }).join('') + '</div>';
      });
      return out || '<p class="muted" style="padding:16px 0">No pairs match.</p>';
    }
    view.innerHTML = '<h1>Pairs</h1><input class="in" id="pq" placeholder="Search, for example BTC or gold" value="' + U.esc(q) + '" style="margin-bottom:6px"><div id="pl">' + list() + '</div>';
    view.oninput = function (e) { if (e.target.id === 'pq') { q = e.target.value; U.$('#pl', view).innerHTML = list(); } };
    view.onclick = null; bindFav(view, function () { U.$('#pl', view).innerHTML = list(); });
  }

  // ---- favorites
  function favorites(view) {
    var favs = D.instruments.filter(function (i) { return D.isFav(i.id) && i.enabled; });
    view.innerHTML = '<h1>Favorites</h1>' + (favs.length ? '<div class="card list">' + favs.map(function (i) {
      return '<a class="trade" href="#pair/' + i.id + '"><div><b>' + U.esc(i.symbol) + '</b><div class="t2 muted">' + U.esc(i.name) + '</div></div><div class="tr"><span data-px="' + i.id + '" class="muted">' + (P.supported(i) ? '...' : '') + '</span> ' + star(i.id) + '</div></a>';
    }).join('') + '</div>' : '<div class="card empty"><h2>No favorites yet.</h2><p class="muted">Star a pair to keep it here.</p><a class="btn" href="#pairs" style="margin-top:16px">Browse pairs</a></div>') +
      '<a class="btn ghost" href="#pairs" style="margin-top:12px">Browse all pairs</a>';
    favs.filter(P.supported).forEach(function (i) {
      P.ticker(i).then(function (t) { var el = U.$('[data-px="' + i.id + '"]', view); if (el) el.innerHTML = C.fmtPrice(i, t.price) + ' ' + chg(t.change); }, function () { var el = U.$('[data-px="' + i.id + '"]', view); if (el) el.textContent = 'n/a'; });
    });
    view.onclick = null; view.oninput = null; bindFav(view, function () { favorites(view); });
  }

  // ---- one pair
  function pair(view, id) {
    stop();
    var i = D.instrument(id) || D.instruments.filter(function (x) { return x.symbol === id; })[0];
    if (!i) { view.innerHTML = '<p class="muted">That pair was not found.</p><a class="btn ghost" href="#pairs">Browse pairs</a>'; return; }
    var live = P.supported(i);
    view.innerHTML = '<a class="back" href="#pairs">&larr; Pairs</a><div class="dh"><div><h1>' + U.esc(i.symbol) + '</h1><div class="muted">' + U.esc(i.name) + '</div></div><span style="margin-left:auto">' + star(i.id) + '</span></div>' +
      (live ? '<div class="card big"><div class="bigv" id="px">...</div><div id="pc" class="muted">Loading live price</div></div>' +
        '<div class="chips" id="tfs">' + P.timeframes.map(function (t) { return '<button type="button" class="chip' + (t === tf ? ' on' : '') + '" data-tf="' + t + '">' + t + '</button>'; }).join('') + '</div>' +
        '<div class="card"><div id="chart" style="min-height:150px"></div></div><div class="card" id="stats"></div><p class="muted" style="font-size:12px;margin-bottom:12px" id="src"></p>' :
        '<div class="card empty"><p class="muted">Live prices are not available for this pair yet. You can still log trades on it.</p></div>') +
      '<a class="btn" href="#add" id="logit">Log a trade on ' + U.esc(i.symbol) + '</a>';
    view.onclick = function (e) {
      var t = e.target.closest('[data-tf]');
      if (t) { tf = t.getAttribute('data-tf'); U.$$('#tfs .chip', view).forEach(function (c) { c.classList.toggle('on', c.getAttribute('data-tf') === tf); }); loadChart(); return; }
      if (e.target.closest('#logit')) { try { sessionStorage.setItem('offpack_preset', i.id); } catch (x) {} }
    };
    view.oninput = null; bindFav(view, function () { U.$('[data-fav]', view).outerHTML = star(i.id); });
    if (!live) return;
    function loadTicker() {
      P.ticker(i).then(function (t) {
        var px = U.$('#px', view); if (!px) return;
        px.textContent = C.fmtPrice(i, t.price); U.$('#pc', view).innerHTML = chg(t.change) + (t.change === null ? '' : ' <span class="muted">24h</span>');
        U.$('#stats', view).innerHTML = '<div class="kv"><span>24h high</span><span>' + C.fmtPrice(i, t.high) + '</span></div><div class="kv"><span>24h low</span><span>' + C.fmtPrice(i, t.low) + '</span></div>' + (t.volume ? '<div class="kv"><span>24h volume</span><span>' + C.fmtMoney(t.volume).replace(/\.\d\d$/, '') + '</span></div>' : '');
        U.$('#src', view).textContent = 'Price from ' + t.src + '. It may be delayed or wrong. Check your exchange before you trade.';
      }, function () { var px = U.$('#px', view); if (px) { px.textContent = '-'; U.$('#pc', view).textContent = 'Live price is unavailable right now.'; } });
    }
    function loadChart() {
      var el = U.$('#chart', view); if (!el) return; el.innerHTML = '<p class="muted" style="padding:50px 0;text-align:center">Loading chart</p>';
      var mine = tf;
      P.candles(i, tf).then(function (pts) { if (mine !== tf || !U.$('#chart', view)) return; el.innerHTML = window.OFFPACK_VIEWS.curve(pts); },
        function () { if (U.$('#chart', view)) U.$('#chart', view).innerHTML = '<p class="muted" style="padding:50px 0;text-align:center">Chart unavailable right now.</p>'; });
    }
    loadTicker(); loadChart(); timer = setInterval(loadTicker, 10000);
  }
  window.OFFPACK_PAIRS = { directory: directory, favorites: favorites, pair: pair, stop: stop };
})();

/* ===== Router and start-up ===== */
/* OFFPACK app: signs you in, loads your data, and shows the right screen. */
(function () {
  'use strict';
  var sb = window.sb, U = window.OFFPACK_U, D = window.OFFPACK_DATA, V = window.OFFPACK_VIEWS, J = window.OFFPACK_JOURNAL;
  var view = U.$('#view'), loaded = false;
  function toLogin() { location.replace('login.html'); }

  function route() {
    if (!loaded) return;
    var h = (location.hash || '#home').replace(/^#/, ''), parts = h.split('/'), name = parts[0] || 'home';
    U.$('#sheet').hidden = true;
    window.OFFPACK_PAIRS.stop();
    view.onclick = view.oninput = view.onchange = null;
    if (view._fav) { view.removeEventListener('click', view._fav, true); view._fav = null; }
    window.scrollTo(0, 0);
    U.$$('.tabs [data-tab]').forEach(function (b) {
      var on = b.getAttribute('data-tab') === (name === 'trade' ? 'journal' : name === 'edit' ? 'journal' : name);
      b.classList.toggle('on', on); if (on) b.setAttribute('aria-current', 'page'); else b.removeAttribute('aria-current');
    });
    try {
      if (name === 'home') V.home(view);
      else if (name === 'journal') J.list(view);
      else if (name === 'add') window.OFFPACK_ADD.open(view, null);
      else if (name === 'edit') window.OFFPACK_ADD.open(view, parts[1]);
      else if (name === 'trade') J.detail(view, parts[1]);
      else if (name === 'calendar') V.calendar(view);
      else if (name === 'insights') V.insights(view);
      else if (name === 'account') window.OFFPACK_ACCOUNT.render(view);
      else if (name === 'pairs') window.OFFPACK_PAIRS.directory(view);
      else if (name === 'favorites') window.OFFPACK_PAIRS.favorites(view);
      else if (name === 'pair') window.OFFPACK_PAIRS.pair(view, parts[1]);
      else { location.hash = '#home'; }
    } catch (err) {
      view.innerHTML = '<div class="card"><b>Something went wrong on this screen.</b><p class="muted" style="margin:8px 0 12px">' + U.esc(err && err.message || '') + '</p><a class="btn" href="#home">Go to Home</a></div>';
      if (window.console) console.error(err);
    }
  }

  function start(user) {
    D.load(user).then(function () {
      loaded = true; U.$('#boot').hidden = true;
      var n = (D.profile.display_name || user.email || '?').trim()[0] || '?'; U.$('#me').textContent = n.toUpperCase();
      window.addEventListener('hashchange', route); route();
    }, function (err) {
      U.$('#boot').innerHTML = '<div style="text-align:center;padding:0 24px"><p>Could not load your data.</p><p class="muted" style="font-size:13px;margin:8px 0 16px">' + U.esc(err && err.message || '') + '</p><button class="btn" onclick="location.reload()">Try again</button></div>';
    });
  }

  if (window.OFFPACK_DEMO) { U.$('#demobar').hidden = false; start({ id: 'demo', email: 'demo@offpack.app' }); return; }
  if (!sb) { U.$('#boot').textContent = 'Could not load. Refresh the page and try again.'; return; }
  sb.auth.getSession().then(function (r) {
    var s = r.data && r.data.session; if (!s) { toLogin(); return; } start(s.user);
  }).catch(toLogin);
  sb.auth.onAuthStateChange(function (ev) { if (ev === 'SIGNED_OUT') toLogin(); });
})();
