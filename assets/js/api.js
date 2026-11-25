/* ============================================================
   طبقة الاتصال — Google Apps Script (Google Sheet) أو وضع تجريبي محلي
   ============================================================ */
(function () {
  'use strict';
  var cfg = window.KIT_CONFIG || {};
  var API_URL = String(cfg.API_URL || '').trim();
  var MODE = API_URL ? 'remote' : 'local';
  var REFRESH = Math.max(2, Number(cfg.RESULTS_REFRESH_SECONDS) || 3) * 1000;

  /* ---------- تخزين آمن ---------- */
  var mem = {};
  var S = (function () {
    try {
      var t = '__ilkit_t';
      window.localStorage.setItem(t, '1');
      window.localStorage.removeItem(t);
      return window.localStorage;
    } catch (e) {
      return {
        getItem: function (k) { return Object.prototype.hasOwnProperty.call(mem, k) ? mem[k] : null; },
        setItem: function (k, v) { mem[k] = String(v); },
        removeItem: function (k) { delete mem[k]; }
      };
    }
  })();
  function get(k, def) {
    try { var v = S.getItem('ilkit:' + k); return v == null ? def : JSON.parse(v); } catch (e) { return def; }
  }
  function set(k, v) { try { S.setItem('ilkit:' + k, JSON.stringify(v)); } catch (e) { /* ignore */ } }
  function del(k) { try { S.removeItem('ilkit:' + k); } catch (e) { /* ignore */ } }

  /* ---------- أدوات ---------- */
  function rand(n) {
    var a = 'abcdefghijkmnpqrstuvwxyz23456789', s = '';
    var buf = (window.crypto && window.crypto.getRandomValues) ? window.crypto.getRandomValues(new Uint32Array(n)) : null;
    for (var i = 0; i < n; i++) s += a[(buf ? buf[i] : Math.floor(Math.random() * 1e9)) % a.length];
    return s;
  }
  function shortCode() {
    var a = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789', s = '';
    for (var i = 0; i < 4; i++) s += a[Math.floor(Math.random() * a.length)];
    return s;
  }
  function cleanSession(s) {
    s = String(s || '').toUpperCase().replace(/[^A-Z0-9_-]/g, '').slice(0, 24);
    return s || 'OPEN';
  }
  function pid() { var v = get('pid'); if (!v) { v = rand(16); set('pid', v); } return v; }
  function aid() { var v = get('aid'); if (!v) { v = rand(16); set('aid', v); } return v; }

  function sleep(ms) { return new Promise(function (r) { setTimeout(r, ms); }); }

  function withTimeout(promise, ms) {
    return new Promise(function (resolve, reject) {
      var t = setTimeout(function () { reject(new Error('timeout')); }, ms);
      promise.then(function (v) { clearTimeout(t); resolve(v); }, function (e) { clearTimeout(t); reject(e); });
    });
  }

  /* ---------- الوضع البعيد: Apps Script ---------- */
  function remoteGet(params, ms) {
    var qs = Object.keys(params).map(function (k) {
      return encodeURIComponent(k) + '=' + encodeURIComponent(params[k] == null ? '' : params[k]);
    }).join('&');
    var url = API_URL + (API_URL.indexOf('?') >= 0 ? '&' : '?') + qs + '&_=' + Date.now();
    return withTimeout(fetch(url, { method: 'GET', redirect: 'follow', cache: 'no-store' }), ms || 15000)
      .then(function (r) { return r.json(); })
      .then(function (j) { if (!j || j.ok === false) throw new Error((j && j.error) || 'api'); return j; });
  }
  function remotePost(body, ms) {
    // نرسل النص كـ text/plain لتجنّب طلب preflight (متوافق مع Apps Script)
    return withTimeout(fetch(API_URL, { method: 'POST', redirect: 'follow', body: JSON.stringify(body) }), ms || 15000)
      .then(function (r) { return r.json(); })
      .then(function (j) { if (!j || j.ok === false) throw new Error((j && j.error) || 'api'); return j; });
  }

  /* ---------- الوضع المحلي (تجريبي — نفس المتصفح) ---------- */
  var local = {
    key: function (session, activity) { return 'local:' + session + ':' + activity; },
    submit: function (p) {
      var k = local.key(p.session, p.activity);
      var arr = get(k, []);
      arr.push({ ts: Date.now(), pub: p.pub });
      set(k, arr);
      var rows = get('localrows:' + p.activity, []);
      rows.push({ ts: Date.now(), session: p.session, data: p.data });
      if (rows.length > 3000) rows = rows.slice(-3000);
      set('localrows:' + p.activity, rows);
      return Promise.resolve({ ok: true });
    },
    results: function (session, activity, since) {
      var arr = get(local.key(session, activity), []);
      var from = Math.max(0, Number(since) || 0);
      var reset = false;
      if (from > arr.length) { from = 0; reset = true; }
      return Promise.resolve({ ok: true, items: arr.slice(from), next: arr.length, reset: reset });
    },
    getState: function (session) { return Promise.resolve({ ok: true, state: get('localstate:' + session, null) }); },
    setState: function (session, state) { set('localstate:' + session, state); return Promise.resolve({ ok: true }); },
    checkPin: function (pin) { return Promise.resolve({ ok: !!String(pin || '').trim() }); },
    clear: function (session) {
      Object.keys(window.KIT.ACTIVITIES).forEach(function (a) { del(local.key(session, a)); });
      del('localstate:' + session);
    }
  };

  /* ---------- الواجهة الموحدة ---------- */
  var API = {
    mode: MODE,
    url: API_URL,
    refreshMs: REFRESH,
    get: get, set: set, del: del,
    pid: pid, aid: aid, rand: rand, shortCode: shortCode, cleanSession: cleanSession, sleep: sleep,

    submit: function (payload) {
      // payload: {session, activity, sheet, pid, data:{label:value}, pub:{...}}
      if (MODE === 'local') return local.submit(payload);
      var body = Object.assign({ action: 'submit' }, payload);
      return remotePost(body, 15000).catch(function () {
        return sleep(1200).then(function () { return remotePost(body, 15000); });
      }).catch(function () {
        return remoteGet({ action: 'submit', payload: JSON.stringify(payload) }, 15000);
      });
    },
    results: function (session, activity, since) {
      if (MODE === 'local') return local.results(session, activity, since);
      return remoteGet({ action: 'results', session: session, activity: activity, since: since == null ? '' : since }, 12000);
    },
    getState: function (session) {
      if (MODE === 'local') return local.getState(session);
      return remoteGet({ action: 'state', session: session }, 10000);
    },
    setState: function (session, state, pin) {
      if (MODE === 'local') return local.setState(session, state);
      return remotePost({ action: 'setState', session: session, state: state, pin: pin }, 10000);
    },
    checkPin: function (pin) {
      if (MODE === 'local') return local.checkPin(pin);
      return remotePost({ action: 'checkPin', pin: pin }, 10000).then(function (j) { return { ok: !!j.valid, reason: j.reason || '' }; });
    },
    ping: function () {
      if (MODE === 'local') return Promise.resolve({ ok: true, local: true });
      return remoteGet({ action: 'ping' }, 10000);
    },
    localClear: function (session) { local.clear(session); },
    localSubmitRaw: function (session, activity, pub) {
      var k = local.key(session, activity);
      var arr = get(k, []); arr.push({ ts: Date.now(), pub: pub }); set(k, arr);
    }
  };

  /* ---------- مراقبة النتائج (للشاشة) ---------- */
  var watchers = {}; // key -> {items, next, subs:[], timer, busy, err}
  API.watch = function (session, activity, cb) {
    var key = session + '|' + activity;
    var w = watchers[key];
    if (!w) {
      w = watchers[key] = { session: session, activity: activity, items: [], next: null, subs: [], timer: null, busy: false, err: false, loaded: false };
    }
    w.subs.push(cb);
    if (w.loaded) cb(w.items, { error: w.err, fresh: false });
    if (!w.timer) {
      var tick = function () {
        if (w.busy) return;
        w.busy = true;
        API.results(w.session, w.activity, w.next).then(function (j) {
          if (j.reset) w.items = [];
          var added = (j.items || []);
          if (added.length) w.items = w.items.concat(added);
          w.next = j.next;
          w.err = false;
          var first = !w.loaded;
          w.loaded = true;
          if (added.length || first || j.reset) w.subs.forEach(function (s) { s(w.items, { error: false, added: added.length, first: first }); });
        }).catch(function () {
          if (!w.err) { w.err = true; w.subs.forEach(function (s) { s(w.items, { error: true }); }); }
        }).then(function () { w.busy = false; });
      };
      tick();
      w.timer = setInterval(tick, MODE === 'local' ? 1000 : REFRESH);
      w.tick = tick;
    }
    return function unwatch() {
      w.subs = w.subs.filter(function (s) { return s !== cb; });
      if (!w.subs.length && w.timer) { clearInterval(w.timer); w.timer = null; }
    };
  };
  API.resetWatchers = function () {
    Object.keys(watchers).forEach(function (k) { var w = watchers[k]; if (w.timer) clearInterval(w.timer); });
    watchers = {};
  };
  // تحديث فوري في الوضع المحلي عند الكتابة من تبويب آخر
  window.addEventListener('storage', function (e) {
    if (MODE !== 'local' || !e.key || e.key.indexOf('ilkit:local:') !== 0) return;
    Object.keys(watchers).forEach(function (k) { var w = watchers[k]; if (w.timer && w.tick) w.tick(); });
  });

  /* ---------- روابط ---------- */
  API.baseUrl = function () {
    var b = String(cfg.PUBLIC_BASE_URL || '').trim();
    if (b) return b.replace(/[#?].*$/, '').replace(/index\.html$/, '').replace(/\/?$/, '/');
    var href = window.location.href.replace(/[#?].*$/, '');
    return href.replace(/[^/]*$/, '');
  };
  API.participantUrl = function (session, activity) {
    var u = API.baseUrl() + 'p.html';
    var q = [];
    if (session && session !== 'OPEN') q.push('s=' + encodeURIComponent(session));
    if (activity) q.push('a=' + encodeURIComponent(activity));
    return u + (q.length ? '?' + q.join('&') : '');
  };
  API.isPublicHost = function () {
    if (String(cfg.PUBLIC_BASE_URL || '').trim()) return true;
    var h = window.location.hostname;
    if (window.location.protocol === 'file:') return false;
    return !(h === 'localhost' || h === '127.0.0.1' || h === '[::1]' || h === '');
  };

  window.API = API;
})();
