/* ============================================================
   صفحة المشارك — الانضمام والأنشطة من الجوال
   ============================================================ */
(function () {
  'use strict';
  var KIT = window.KIT, API = window.API, VIZ = window.VIZ;
  var A = KIT.ACTIVITIES, P = KIT.PRACTICES, esc = VIZ.esc, icon = window.icon;
  var params = new URLSearchParams(window.location.search);
  var session = API.cleanSession(params.get('s') || 'OPEN');
  var view = document.getElementById('view');
  var profile = API.get('profile', null);
  var TEXT_ON_LIGHT = { 1: '#D2412F', 2: '#A9740A', 3: '#0E8C68', 4: '#1878B8', 5: '#C22D70' };

  /* ---------- أدوات ---------- */
  function h53(str) {
    var h1 = 0xdeadbeef, h2 = 0x41c6ce57;
    for (var i = 0, ch; i < str.length; i++) {
      ch = str.charCodeAt(i);
      h1 = Math.imul(h1 ^ ch, 2654435761);
      h2 = Math.imul(h2 ^ ch, 1597334677);
    }
    h1 = Math.imul(h1 ^ (h1 >>> 16), 2246822507) ^ Math.imul(h2 ^ (h2 >>> 13), 3266489909);
    h2 = Math.imul(h2 ^ (h2 >>> 16), 2246822507) ^ Math.imul(h1 ^ (h1 >>> 13), 3266489909);
    return (4294967296 * (2097151 & h2) + (h1 >>> 0)).toString(36).slice(0, 8);
  }
  function uFor(act, anon) { return h53((anon ? API.aid() : API.pid()) + ':' + act); }
  function first(name) { return String(name || '').trim().split(/\s+/)[0] || ''; }
  function pOf(a) { return a && a.p ? P[a.p - 1] : null; }
  function pv(p) {
    if (!p) return '';
    var h = p.color.replace('#', ''), n = parseInt(h, 16);
    return '--pc:' + p.color + ';--pcs:rgba(' + ((n >> 16) & 255) + ',' + ((n >> 8) & 255) + ',' + (n & 255) + ',.14);--pct:' + TEXT_ON_LIGHT[p.n] + ';';
  }
  function badge(p) { return '<span class="p-badge" style="--pc:' + p.color + '">' + icon(p.icon) + '</span>'; }
  function doneKey(act) { return 'done:' + session + ':' + act; }
  function getDone(act) { return API.get(doneKey(act), null); }
  function markDone(act, extra) {
    var d = API.get(doneKey(act), { n: 0 });
    d.n = (d.n || 0) + 1; d.at = Date.now();
    if (extra) Object.keys(extra).forEach(function (k) { d[k] = extra[k]; });
    API.set(doneKey(act), d);
    updateHeader();
  }
  function setUrl(act) {
    try {
      var u = new URL(window.location.href);
      if (act) u.searchParams.set('a', act); else u.searchParams.delete('a');
      history.replaceState(null, '', u.pathname + u.search);
    } catch (e) { /* ignore */ }
  }
  function toast(msg) {
    var t = document.getElementById('toast');
    t.textContent = msg; t.classList.add('show');
    clearTimeout(toast._t); toast._t = setTimeout(function () { t.classList.remove('show'); }, 2600);
  }
  function setActions(html) {
    var old = document.querySelector('.p-actions');
    if (old) old.remove();
    if (!html) return null;
    var d = document.createElement('div');
    d.className = 'p-actions';
    d.innerHTML = '<div class="inner">' + html + '</div>';
    document.body.appendChild(d);
    return d;
  }
  function render(html, actions) {
    stopFollow();
    view.innerHTML = '<div class="screen">' + html + '</div>';
    var prog = document.getElementById('pProg');
    prog.hidden = true;
    var a = setActions(actions);
    window.scrollTo(0, 0);
    return a;
  }
  function busy(btn, on, label) {
    if (!btn) return;
    if (on) { btn.dataset.label = btn.innerHTML; btn.disabled = true; btn.innerHTML = '<span class="dots"><i></i><i></i><i></i></span> ' + (label || 'جارٍ الإرسال'); }
    else { btn.disabled = false; if (btn.dataset.label) btn.innerHTML = btn.dataset.label; }
  }
  function showErr(where, msg) {
    var box = view.querySelector('.err-box');
    if (!box) { box = document.createElement('div'); box.className = 'err-box'; (where || view.querySelector('.card') || view).appendChild(box); }
    box.textContent = msg || 'تعذّر الإرسال.. تأكد من اتصالك بالإنترنت وحاول مرة أخرى.';
  }
  function named() { return { 'الاسم': profile.name, 'جهة العمل': profile.org }; }
  function send(act, data, pub, anon) {
    var a = A[act];
    return API.submit({
      session: session, activity: act, sheet: a.sheet,
      pid: anon ? API.aid() : API.pid(),
      data: data, pub: Object.assign({ u: uFor(act, anon) }, pub)
    });
  }
  function head(act) {
    var a = A[act], p = pOf(a);
    return '<span class="tag pc" style="' + pv(p) + '">' + icon(a.icon) + (p ? esc(p.name) : esc(a.title)) + '</span>' +
      '<h1 class="p-h1">' + esc(a.prompt || a.title) + '</h1>';
  }
  function updateHeader() {
    var total = KIT.ACTIVITY_ORDER.length;
    var done = KIT.ACTIVITY_ORDER.filter(function (a) { return !!getDone(a); }).length;
    document.getElementById('pSub').textContent = profile ? ('أنجزت ' + done + ' من ' + total + ' أنشطة') : 'جلسة تفاعلية';
    var s = document.getElementById('pSess');
    if (session !== 'OPEN') { s.hidden = false; s.textContent = session; } else s.hidden = true;
  }

  /* ---------- متابعة المقدم ---------- */
  var followT = null, liveAct = null, lastSeenAct = API.get('lastSeen:' + session, null);
  function stopFollow() { if (followT) { clearInterval(followT); followT = null; } }
  function startFollow(onChange) {
    stopFollow();
    var tick = function () {
      if (document.hidden) return;
      API.getState(session).then(function (j) {
        var st = j && j.state;
        var act = (st && st.a && A[st.a] && st.at && (Date.now() - st.at < 6 * 3600 * 1000)) ? st.a : null;
        var changed = act !== liveAct;
        liveAct = act;
        if (changed) onChange(act);
      }).catch(function () { /* ignore */ });
    };
    tick();
    followT = setInterval(tick, API.mode === 'local' ? 2000 : 9000 + Math.floor(Math.random() * 3000));
  }
  function autoOpen(act) {
    if (!act || act === lastSeenAct) return false;
    lastSeenAct = act; API.set('lastSeen:' + session, act);
    var d = getDone(act);
    var a = A[act];
    if (d && (a.type === 'lpi' || a.type === 'checklist' || a.type === 'rating' || a.type === 'poll')) return false;
    toast('نشاط جديد: ' + a.title);
    setTimeout(function () { go(act); }, 700);
    return true;
  }
  function nowCard(act) {
    if (act) {
      var a = A[act];
      return '<div class="now"><small><i></i>يُعرض الآن على الشاشة</small><b>' + esc(a.title) + '</b><a class="btn btn-primary" href="#" data-go="' + act + '">' + icon('send') + 'شارك الآن</a></div>';
    }
    if (session === 'OPEN') return '';
    return '<div class="card wait">' + icon('presentation') + '<b>تابع الشاشة</b>سيظهر النشاط الحالي هنا تلقائياً عندما يبدأ.</div>';
  }
  function bindGo(root) {
    (root || view).querySelectorAll('[data-go]').forEach(function (el) {
      el.addEventListener('click', function (e) { e.preventDefault(); go(el.dataset.go || null); });
    });
  }
  function mountNow() {
    var slot = view.querySelector('#nowSlot');
    if (!slot) return;
    startFollow(function (act) {
      if (autoOpen(act)) return;
      slot.innerHTML = nowCard(act);
      bindGo(slot);
      view.querySelectorAll('.act-list a').forEach(function (a) { a.classList.toggle('is-now', a.dataset.go === act); });
    });
    slot.innerHTML = nowCard(null);
  }

  /* ---------- الانضمام ---------- */
  function showJoin(nextAct, editing) {
    setUrl(nextAct);
    var h = '<div class="card">' +
      (API.mode === 'local' ? '<div class="demo-note">وضع تجريبي: المشاركات تُحفظ في هذا الجهاز فقط حتى يُربط الموقع بـ Google Sheet.</div>' : '') +
      '<span class="tag">' + icon('users') + 'جلسة القيادة الملهمة</span>' +
      '<h1 class="p-h1">' + (editing ? 'تعديل بياناتك' : 'أهلاً بك! سجّل للمشاركة') + '</h1>' +
      '<p class="p-lead">اكتب اسمك وجهة عملك، ثم شارك في الأنشطة وتابع إجاباتك مع زملائك على الشاشة.</p>' +
      '<form id="joinForm" novalidate>' +
      '<div class="field"><label for="fName">الاسم</label><input class="input" id="fName" autocomplete="name" maxlength="60" placeholder="اسمك الكريم" value="' + esc(profile ? profile.name : '') + '"></div>' +
      '<div class="field"><label for="fOrg">جهة العمل</label><input class="input" id="fOrg" autocomplete="organization" maxlength="80" placeholder="الجهة التي تعمل بها" value="' + esc(profile ? profile.org : '') + '"></div>' +
      '<button type="submit" hidden></button></form>' +
      '<p class="p-muted" style="margin-top:14px">' + icon('lock') + ' اسمك يظهر مع مشاركاتك على الشاشة فقط إذا اخترت ذلك، ومقياس LPI وتقييم الجلسة دون اسم دائماً.</p></div>';
    var act = render(h, '<button class="btn btn-primary" id="joinBtn" type="button">' + icon('log-in') + (editing ? 'حفظ' : 'دخول الجلسة') + '</button>');
    var btn = act.querySelector('#joinBtn');
    var submit = function (e) {
      if (e) e.preventDefault();
      var name = view.querySelector('#fName').value.trim().replace(/\s+/g, ' ');
      var org = view.querySelector('#fOrg').value.trim().replace(/\s+/g, ' ');
      if (name.length < 2) { showErr(null, 'فضلاً اكتب اسمك.'); view.querySelector('#fName').focus(); return; }
      if (org.length < 2) { showErr(null, 'فضلاً اكتب جهة عملك.'); view.querySelector('#fOrg').focus(); return; }
      profile = { name: name, org: org };
      API.set('profile', profile);
      busy(btn, true, 'جارٍ الدخول');
      doJoin().then(function () {
        toast('أهلاً ' + first(name) + '، تم تسجيلك');
        go(nextAct || null);
      }).catch(function () { busy(btn, false); showErr(null); });
    };
    btn.addEventListener('click', submit);
    view.querySelector('#joinForm').addEventListener('submit', submit);
    if (!profile) setTimeout(function () { var f = view.querySelector('#fName'); if (f) f.focus(); }, 300);
  }
  function doJoin() {
    return send('join', named(), { n: first(profile.name) }, false).then(function () {
      API.set('joined:' + session, { at: Date.now(), name: profile.name });
    });
  }

  /* ---------- القائمة ---------- */
  var GROUPS = [
    { t: 'افتتاح', acts: ['traits'] },
    { t: 'نموذج القيادة الملهمة', acts: ['lpi', 'values', 'passion', 'tweet', 'empower', 'recognition'] },
    { t: 'أساسيات فريق العمل', acts: ['phrase', 'stage', 'teamcheck'] },
    { t: 'ختام', acts: ['commit', 'rating'] }
  ];
  function showHub() {
    setUrl(null);
    var h = '';
    if (API.mode === 'local') h += '<div class="demo-note">وضع تجريبي: المشاركات تُحفظ في هذا الجهاز فقط حتى يُربط الموقع بـ Google Sheet.</div>';
    h += '<div class="card hello"><span class="av">' + esc(first(profile.name).charAt(0)) + '</span><div><b>أهلاً ' + esc(first(profile.name)) + '</b><small>' + esc(profile.org) + '</small></div><a href="#" id="editMe">تعديل</a></div>';
    h += '<div id="nowSlot"></div>';
    GROUPS.forEach(function (g) {
      h += '<div class="sec-t">' + esc(g.t) + '</div><ul class="act-list">' + g.acts.map(function (k) {
        var a = A[k], p = pOf(a), d = getDone(k);
        return '<li><a href="#" data-go="' + k + '" style="' + pv(p) + '"><span class="ai">' + icon(a.icon) + '</span><span>' + esc(a.title) +
          '<small>' + (p ? esc(p.name) : (a.anonymous ? 'دون اسم' : 'نشاط تفاعلي')) + '</small></span>' +
          (d ? '<span class="st">' + icon('circle-check') + 'تم</span>' : icon('chevron-left')) + '</a></li>';
      }).join('') + '</ul>';
    });
    h += '<p class="foot-note"><a href="index.html' + (session !== 'OPEN' ? '?s=' + session : '') + '">تصفّح الحقيبة كاملة</a></p>';
    render(h, null);
    bindGo();
    view.querySelector('#editMe').addEventListener('click', function (e) { e.preventDefault(); showJoin(null, true); });
    mountNow();
  }

  /* ---------- شاشة النجاح ---------- */
  function showSuccess(act, opts) {
    opts = opts || {};
    var a = A[act];
    var h = '<div class="card ok-wrap"><div class="ok-ring">' + icon('check') + '</div><h2>' + (opts.title || 'وصلت مشاركتك') + '</h2>' +
      '<p>' + (opts.sub || 'شكراً لك! ستظهر الآن على الشاشة مع مشاركات زملائك.') + '</p></div><div id="nowSlot"></div>';
    var more = opts.again ? '<button class="btn btn-ghost" id="again" type="button">' + icon('pen-line') + 'أضف أخرى</button>' : '';
    var acts = render(h, more + '<button class="btn btn-navy" data-go="" type="button">' + icon('list') + 'كل الأنشطة</button>');
    bindGo(acts);
    var ag = acts.querySelector('#again');
    if (ag) ag.addEventListener('click', function () { go(act); });
    void a;
    mountNow();
  }

  /* ---------- الكلمات ---------- */
  function showWords(act) {
    var a = A[act], words = [];
    var h = '<div class="card">' + head(act) + '<p class="p-muted">' + esc(a.hint || '') + '</p>' +
      '<div class="word-row"><input class="input" id="wIn" maxlength="30" placeholder="اكتب هنا…" enterkeyhint="done"><button class="btn btn-navy" id="wAdd" type="button">' + icon('check') + 'إضافة</button></div>' +
      '<div class="chips" id="wChips"></div></div>';
    var acts = render(h, '<button class="btn btn-ghost" data-go="" type="button">' + icon('chevron-right') + '</button><button class="btn btn-primary" id="wSend" type="button">' + icon('send') + 'أرسل</button>');
    bindGo(acts);
    var inp = view.querySelector('#wIn'), chips = view.querySelector('#wChips'), sendBtn = acts.querySelector('#wSend');
    function draw() {
      chips.innerHTML = words.map(function (w, i) { return '<span class="chip">' + esc(w) + '<button type="button" data-i="' + i + '" aria-label="حذف">' + icon('x') + '</button></span>'; }).join('');
      chips.querySelectorAll('button').forEach(function (b) { b.addEventListener('click', function () { words.splice(+b.dataset.i, 1); draw(); }); });
      inp.disabled = words.length >= a.maxWords;
      inp.placeholder = words.length >= a.maxWords ? 'وصلت للحد الأعلى' : 'اكتب هنا…';
    }
    function add() {
      var w = inp.value.trim().replace(/\s+/g, ' ');
      if (!w) return false;
      if (words.length >= a.maxWords) return false;
      if (words.some(function (x) { return VIZ.normWord(x) === VIZ.normWord(w); })) { inp.value = ''; return false; }
      words.push(w.slice(0, 30)); inp.value = ''; draw(); inp.focus();
      return true;
    }
    view.querySelector('#wAdd').addEventListener('click', add);
    inp.addEventListener('keydown', function (e) { if (e.key === 'Enter') { e.preventDefault(); add(); } });
    sendBtn.addEventListener('click', function () {
      add();
      if (!words.length) { showErr(null, 'اكتب كلمة واحدة على الأقل.'); return; }
      busy(sendBtn, true);
      var data = named(); data['الكلمات'] = words.join('، ');
      send(act, data, { w: words.slice() }, false).then(function () {
        markDone(act);
        showSuccess(act, { again: true });
      }).catch(function () { busy(sendBtn, false); showErr(null); });
    });
    setTimeout(function () { inp.focus(); }, 350);
  }

  /* ---------- الجدار ---------- */
  function showWall(act) {
    var a = A[act], p = pOf(a);
    var tweet = a.variant === 'tweet';
    var h = '<div class="card" style="' + pv(p) + '">' + head(act) +
      (tweet ? '<div class="tweet-head"><span class="av">' + esc(first(profile.name).charAt(0)) + '</span><b>' + esc(first(profile.name)) + '</b></div>' : '') +
      '<div class="field"><textarea class="textarea" id="tIn" maxlength="' + a.max + '" placeholder="' + (tweet ? 'اكتب تغريدتك…' : 'اكتب هنا…') + '"></textarea><span class="counter" id="tCnt">0 / ' + a.max + '</span></div>' +
      '<label class="check"><input type="checkbox" id="tShow" checked> أظهر اسمي (' + esc(first(profile.name)) + ') مع المشاركة على الشاشة</label>' +
      (a.link ? '<a class="link-btn" href="' + a.link.href + '" target="_blank" rel="noopener">' + icon('circle-play') + esc(a.link.t) + '</a>' : '') + '</div>';
    var acts = render(h, '<button class="btn btn-ghost" data-go="" type="button">' + icon('chevron-right') + '</button><button class="btn btn-primary" id="tSend" type="button">' + icon('send') + (tweet ? 'غرّد' : 'أرسل') + '</button>');
    bindGo(acts);
    var ta = view.querySelector('#tIn'), cnt = view.querySelector('#tCnt'), sendBtn = acts.querySelector('#tSend');
    ta.addEventListener('input', function () { var n = ta.value.length; cnt.textContent = n + ' / ' + a.max; cnt.classList.toggle('warn', n > a.max * 0.9); });
    sendBtn.addEventListener('click', function () {
      var t = ta.value.trim();
      if (t.length < 3) { showErr(null, 'اكتب مشاركتك أولاً.'); ta.focus(); return; }
      var show = view.querySelector('#tShow').checked;
      busy(sendBtn, true);
      var data = named(); data['النص'] = t; data['إظهار الاسم'] = show ? 'نعم' : 'لا';
      send(act, data, { t: t, n: show ? first(profile.name) : null }, false).then(function () {
        markDone(act);
        showSuccess(act, { again: true });
      }).catch(function () { busy(sendBtn, false); showErr(null); });
    });
    setTimeout(function () { ta.focus(); }, 350);
  }

  /* ---------- الاستطلاع ---------- */
  function showPoll(act) {
    var a = A[act], d = getDone(act), sel = d && typeof d.c === 'number' ? d.c : -1;
    var h = '<div class="card">' + head(act) +
      (d ? '<p class="p-muted">' + icon('circle-check') + ' صوتك وصل، ويمكنك تغييره إن أردت.</p>' : '<p class="p-muted">اختر إجابة واحدة.</p>') +
      '<div class="opts">' + a.options.map(function (o, i) { return '<button class="opt' + (i === sel ? ' on' : '') + '" type="button" data-i="' + i + '"><span class="rd"></span><span>' + esc(o) + '</span></button>'; }).join('') + '</div></div>';
    var acts = render(h, '<button class="btn btn-ghost" data-go="" type="button">' + icon('chevron-right') + '</button><button class="btn btn-primary" id="pSend" type="button"' + (sel < 0 ? ' disabled' : '') + '>' + icon('send') + (d ? 'تحديث صوتي' : 'صوّت') + '</button>');
    bindGo(acts);
    var sendBtn = acts.querySelector('#pSend');
    view.querySelectorAll('.opt').forEach(function (b) {
      b.addEventListener('click', function () {
        sel = +b.dataset.i;
        view.querySelectorAll('.opt').forEach(function (x) { x.classList.toggle('on', x === b); });
        sendBtn.disabled = false;
      });
    });
    sendBtn.addEventListener('click', function () {
      if (sel < 0) return;
      busy(sendBtn, true);
      var data = named(); data['الاختيار'] = a.options[sel];
      send(act, data, { c: sel }, false).then(function () {
        markDone(act, { c: sel });
        showSuccess(act, { title: 'وصل صوتك', sub: 'النتائج تتحدث مباشرة على الشاشة.' });
      }).catch(function () { busy(sendBtn, false); showErr(null); });
    });
  }

  /* ---------- مقياس LPI ---------- */
  function lpiScores(ans) {
    var s = P.map(function (p) { return p.items.reduce(function (t, it) { return t + (ans[it - 1] || 0); }, 0); });
    var hi = 0, lo = 0;
    s.forEach(function (v, i) { if (v > s[hi]) hi = i; if (v < s[lo]) lo = i; });
    return { s: s, hi: hi, lo: lo };
  }
  function showLpiIntro() {
    var res = API.get('lpiRes:' + session, null);
    if (res) return showLpiResult(res, false);
    var prog = API.get('lpiProg:' + session, null);
    var answered = prog ? prog.filter(function (v) { return v; }).length : 0;
    var h = '<div class="card">' + head('lpi') +
      '<p class="p-lead">30 عبارة.. اختر لكل عبارة رقماً من 1 (أبداً) إلى 10 (دائماً) حسب ما تعمله فعلاً.</p>' +
      '<ul class="rules-p">' + KIT.LPI_RULES.map(function (r) { return '<li>' + icon(r.icon) + esc(r.t) + '</li>'; }).join('') + '</ul>' +
      '<p class="p-muted" style="margin-top:14px">' + icon('lock') + ' نتيجتك تظهر لك وحدك، وتُضاف لمتوسط المجموعة دون اسمك.</p></div>';
    var acts = render(h, '<button class="btn btn-ghost" data-go="" type="button">' + icon('chevron-right') + '</button><button class="btn btn-primary" id="lStart" type="button">' + icon('play') + (answered ? 'أكمل من حيث توقفت (' + answered + '/30)' : 'ابدأ المقياس') + '</button>');
    bindGo(acts);
    acts.querySelector('#lStart').addEventListener('click', function () {
      var ans = prog || new Array(30).fill(0);
      var startAt = ans.findIndex(function (v) { return !v; });
      showLpiItem(ans, startAt < 0 ? 29 : startAt);
    });
  }
  function showLpiItem(ans, i) {
    stopFollow();
    var N = KIT.LPI_ITEMS.length;
    var cur = ans[i] || 0;
    var h = '<div class="card lpi-item"><span class="lpi-num">العبارة ' + (i + 1) + ' من ' + N + '</span>' +
      '<div class="lpi-text">' + esc(KIT.LPI_ITEMS[i]) + '</div>' +
      '<div class="scale">' + KIT.LPI_SCALE.map(function (lbl, k) {
        var v = k + 1;
        return '<button type="button" data-v="' + v + '" class="' + (v === cur ? 'on' : '') + ((v <= 2 || v >= 9) ? ' edge' : '') + '" aria-label="' + v + ' ' + esc(lbl) + '">' + v + '</button>';
      }).join('') + '</div>' +
      '<div class="scale-lbl" id="sLbl">' + (cur ? cur + ' — ' + esc(KIT.LPI_SCALE[cur - 1]) : '&nbsp;') + '</div>' +
      '<div class="scale-ends"><span>1 أبداً</span><span>10 دائماً</span></div>' +
      '<div class="lpi-nav"><button type="button" id="lPrev"' + (i === 0 ? ' disabled' : '') + '>' + icon('chevron-right') + 'السابقة</button>' +
      '<button type="button" id="lNext"' + (cur ? '' : ' disabled') + '>' + (i === N - 1 ? 'إنهاء' : 'التالية') + icon('chevron-left') + '</button></div></div>';
    view.innerHTML = '<div class="screen">' + h + '</div>';
    setActions(null);
    var prog = document.getElementById('pProg');
    prog.hidden = false;
    var answered = ans.filter(function (v) { return v; }).length;
    prog.querySelector('i').style.width = (answered / N * 100) + '%';
    var lock = false;
    view.querySelectorAll('.scale button').forEach(function (b) {
      b.addEventListener('click', function () {
        if (lock) return;
        var v = +b.dataset.v;
        ans[i] = v;
        API.set('lpiProg:' + session, ans);
        view.querySelectorAll('.scale button').forEach(function (x) { x.classList.toggle('on', x === b); });
        view.querySelector('#sLbl').textContent = v + ' — ' + KIT.LPI_SCALE[v - 1];
        view.querySelector('#lNext').disabled = false;
        lock = true;
        setTimeout(function () { lock = false; if (i < N - 1) showLpiItem(ans, i + 1); else showLpiReview(ans); }, 320);
      });
    });
    view.querySelector('#lPrev').addEventListener('click', function () { if (i > 0) showLpiItem(ans, i - 1); });
    view.querySelector('#lNext').addEventListener('click', function () { if (!ans[i]) return; if (i < N - 1) showLpiItem(ans, i + 1); else showLpiReview(ans); });
  }
  function showLpiReview(ans) {
    var missing = ans.map(function (v, k) { return v ? -1 : k; }).filter(function (k) { return k >= 0; });
    if (missing.length) return showLpiItem(ans, missing[0]);
    var h = '<div class="card ok-wrap"><div class="ok-ring">' + icon('radar') + '</div><h2>أكملت العبارات الثلاثين</h2><p>أرسل إجاباتك لتظهر نتيجتك (ويُضاف رصيدك لمتوسط المجموعة دون اسمك).</p></div>';
    var acts = render(h, '<button class="btn btn-ghost" id="lBack" type="button">' + icon('chevron-right') + 'مراجعة</button><button class="btn btn-primary" id="lSend" type="button">' + icon('send') + 'أرسل واعرض نتيجتي</button>');
    acts.querySelector('#lBack').addEventListener('click', function () { showLpiItem(ans, 29); });
    var btn = acts.querySelector('#lSend');
    btn.addEventListener('click', function () {
      var r = lpiScores(ans);
      var data = {};
      ans.forEach(function (v, k) { data['س' + (k + 1)] = v; });
      P.forEach(function (p, k) { data[p.name] = r.s[k]; });
      data['الأعلى'] = P[r.hi].name; data['الأدنى'] = P[r.lo].name;
      busy(btn, true);
      var res = { s: r.s, hi: r.hi, lo: r.lo, ans: ans.slice(), at: Date.now() };
      send('lpi', data, { s: r.s, hi: r.hi, lo: r.lo }, true).then(function () {
        API.set('lpiRes:' + session, res);
        API.del('lpiProg:' + session);
        markDone('lpi');
        showLpiResult(res, true);
      }).catch(function () {
        busy(btn, false);
        showErr(view.querySelector('.card'), 'تعذّر إرسال النتيجة للمجموعة.. تحقق من الاتصال واضغط «أرسل» مرة أخرى.');
      });
    });
  }
  function showLpiResult(res, fresh) {
    var order = [0, 1, 2, 3, 4].sort(function (a, b) { return res.s[b] - res.s[a]; });
    var lo = P[res.lo], hi = P[res.hi];
    var h = (fresh ? '<div class="card ok-wrap" style="padding:18px"><h2>نتيجتك جاهزة</h2><p>هذه الصفحة لك وحدك، وتبقى محفوظة في جوالك.</p></div>' : '') +
      '<div class="card"><span class="tag">' + icon('radar') + 'نتيجتك في مقياس LPI</span>' +
      '<div class="res-radar">' + VIZ.radar(res.s, { min: 6, max: 60, label: 'نتيجتي' }) + '</div>' +
      '<div class="res-list">' + order.map(function (k) {
        var p = P[k];
        return '<div class="res-row"><span class="nm">' + badge(p) + esc(p.name) + '</span><span class="vl">' + res.s[k] + ' <small>/ 60</small></span><span class="tr" style="--c:' + p.color + '"><i style="width:' + ((res.s[k] - 6) / 54 * 100).toFixed(1) + '%"></i></span></div>';
      }).join('') + '</div></div>' +
      '<div class="card"><div class="hl-box hi" style="margin-top:0"><small>' + esc(KIT.LPI_READ.high.t) + ' (الأكثر شيوعاً لديك)</small><b>' + esc(hi.name) + '</b><p>' + esc(KIT.LPI_READ.high.d) + '.</p></div>' +
      '<div class="hl-box lo"><small>' + esc(KIT.LPI_READ.low.t) + ' (الأقل شيوعاً لديك)</small><b>' + esc(lo.name) + '</b><p>' + esc(KIT.LPI_READ.low.d) + '. ابدأ بسلوك واحد من هذه:</p>' +
      '<ul>' + lo.behaviors.map(function (b) { return '<li>' + esc(b) + '</li>'; }).join('') + '</ul></div></div>';
    var acts = render(h, '<button class="btn btn-navy" data-go="" type="button">' + icon('list') + 'كل الأنشطة</button>');
    bindGo(acts);
  }

  /* ---------- نشاط فريق العمل ---------- */
  function showChecklist(act) {
    var a = A[act];
    var res = API.get('chkRes:' + session, null);
    if (res) return showChecklistResult(res);
    var ans = API.get('chkProg:' + session, null) || new Array(a.statements.length).fill(-1);
    var h = '<div class="card">' + head(act) + '<p class="p-muted">' + icon('lock') + ' إجاباتك دون اسم، ونتيجتك تظهر لك وحدك.</p></div>' +
      a.statements.map(function (q, i) {
        return '<div class="card chk-q' + (ans[i] >= 0 ? ' done' : '') + '" data-q="' + i + '"><p><b>' + (i + 1) + '</b>' + esc(q) + '</p><div class="seg">' +
          a.options.map(function (o) { return '<button type="button" data-v="' + o.v + '" class="' + (ans[i] === o.v ? 'on' : '') + '">' + esc(o.t) + '</button>'; }).join('') + '</div></div>';
      }).join('');
    var acts = render(h, '<span class="meta" id="cMeta"></span><button class="btn btn-primary" id="cSend" type="button" disabled>' + icon('send') + 'أرسل</button>');
    var btn = acts.querySelector('#cSend'), meta = acts.querySelector('#cMeta');
    function upd() {
      var n = ans.filter(function (v) { return v >= 0; }).length;
      meta.textContent = n + ' / ' + ans.length;
      btn.disabled = n < ans.length;
    }
    view.querySelectorAll('.chk-q').forEach(function (card) {
      var i = +card.dataset.q;
      card.querySelectorAll('.seg button').forEach(function (b) {
        b.addEventListener('click', function () {
          ans[i] = +b.dataset.v;
          API.set('chkProg:' + session, ans);
          card.querySelectorAll('.seg button').forEach(function (x) { x.classList.toggle('on', x === b); });
          card.classList.add('done');
          upd();
          var next = view.querySelector('.chk-q[data-q="' + (i + 1) + '"]');
          if (next && ans[i + 1] < 0) setTimeout(function () { next.scrollIntoView({ behavior: 'smooth', block: 'center' }); }, 180);
        });
      });
    });
    upd();
    btn.addEventListener('click', function () {
      var sum = ans.reduce(function (t, v) { return t + v; }, 0);
      var pct = Math.round(sum / (3 * ans.length) * 100);
      var data = {};
      ans.forEach(function (v, k) { data['ع' + (k + 1)] = a.options.filter(function (o) { return o.v === v; })[0].t; });
      data['المجموع'] = sum; data['النسبة'] = pct + '%';
      busy(btn, true);
      send(act, data, { a: ans.slice() }, true).then(function () {
        var r = { ans: ans.slice(), pct: pct, at: Date.now() };
        API.set('chkRes:' + session, r);
        API.del('chkProg:' + session);
        markDone(act);
        showChecklistResult(r, true);
      }).catch(function () { busy(btn, false); showErr(view.querySelector('.card'), 'تعذّر الإرسال.. تحقق من الاتصال وحاول مرة أخرى.'); });
    });
  }
  function showChecklistResult(r, fresh) {
    var a = A.teamcheck;
    var strong = [], weak = [];
    r.ans.forEach(function (v, i) { if (v === 3) strong.push(i); if (v <= 1) weak.push(i); });
    var h = '<div class="card score-big">' + (fresh ? '<div class="ok-ring">' + icon('check') + '</div>' : '') +
      '<span class="tag">' + icon('clipboard-list') + 'نتيجتك في نشاط فريق العمل</span><b>' + r.pct + '%</b><p class="p-muted">مجموعك ' + r.ans.reduce(function (t, v) { return t + v; }, 0) + ' من ' + (3 * r.ans.length) + ' (دوماً = 3، غالباً = 2، نادراً = 1، لا = 0)</p></div>' +
      (strong.length ? '<div class="card"><div class="hl-box hi" style="margin-top:0"><small>تمارسها دوماً</small><ul>' + strong.slice(0, 5).map(function (i) { return '<li>' + esc(a.statements[i].replace(/^هل\s+/, '').replace(/؟$/, '')) + '</li>'; }).join('') + '</ul></div></div>' : '') +
      (weak.length ? '<div class="card"><div class="hl-box lo" style="margin-top:0"><small>فرص للتطوير</small><ul>' + weak.slice(0, 5).map(function (i) { return '<li>' + esc(a.statements[i].replace(/^هل\s+/, '').replace(/؟$/, '')) + '</li>'; }).join('') + '</ul></div></div>' : '');
    var acts = render(h, '<button class="btn btn-navy" data-go="" type="button">' + icon('list') + 'كل الأنشطة</button>');
    bindGo(acts);
    if (fresh) mountNow();
  }

  /* ---------- التقييم ---------- */
  function showRating(act) {
    var labels = ['ضعيفة', 'مقبولة', 'جيدة', 'جيدة جداً', 'ممتازة'];
    var d = getDone(act), r = 0;
    var h = '<div class="card">' + head(act) + (d ? '<p class="p-muted">' + icon('circle-check') + ' شكراً، وصل تقييمك. يمكنك إرسال تقييم محدّث.</p>' : '<p class="p-muted">تقييمك دون اسم.</p>') +
      '<div class="stars">' + [1, 2, 3, 4, 5].map(function (v) { return '<button type="button" data-v="' + v + '" aria-label="' + v + ' من 5">' + icon('star') + '</button>'; }).join('') + '</div>' +
      '<div class="star-lbl" id="sLbl">&nbsp;</div>' +
      '<div class="field"><label for="rCom">ملاحظة أو اقتراح (اختياري)</label><textarea class="textarea" id="rCom" maxlength="200" style="min-height:100px" placeholder="ما أكثر ما أعجبك؟ وما الذي نطوّره؟"></textarea></div></div>';
    var acts = render(h, '<button class="btn btn-ghost" data-go="" type="button">' + icon('chevron-right') + '</button><button class="btn btn-primary" id="rSend" type="button" disabled>' + icon('send') + 'أرسل التقييم</button>');
    bindGo(acts);
    var btn = acts.querySelector('#rSend');
    view.querySelectorAll('.stars button').forEach(function (b) {
      b.addEventListener('click', function () {
        r = +b.dataset.v;
        view.querySelectorAll('.stars button').forEach(function (x) { x.classList.toggle('on', +x.dataset.v <= r); });
        view.querySelector('#sLbl').textContent = labels[r - 1];
        btn.disabled = false;
      });
    });
    btn.addEventListener('click', function () {
      if (!r) return;
      var c = view.querySelector('#rCom').value.trim();
      busy(btn, true);
      send(act, { 'التقييم': r, 'الملاحظة': c }, { r: r, c: c }, true).then(function () {
        markDone(act);
        showSuccess(act, { title: 'شكراً لتقييمك', sub: 'رأيك يساعدنا على التطوير.' });
      }).catch(function () { busy(btn, false); showErr(null); });
    });
  }

  /* ---------- التوجيه ---------- */
  function go(act) {
    if (!profile) return showJoin(act);
    if (!API.get('joined:' + session)) {
      view.innerHTML = '<div class="screen"><div class="card wait"><span class="dots"><i></i><i></i><i></i></span><b>جارٍ تسجيل دخولك…</b></div></div>';
      return doJoin().then(function () { go(act); }).catch(function () { showJoin(act); });
    }
    updateHeader();
    if (!act || !A[act] || act === 'join') return showHub();
    setUrl(act);
    var t = A[act].type;
    if (t === 'words') return showWords(act);
    if (t === 'wall') return showWall(act);
    if (t === 'poll') return showPoll(act);
    if (t === 'lpi') return showLpiIntro();
    if (t === 'checklist') return showChecklist(act);
    if (t === 'rating') return showRating(act);
    return showHub();
  }

  document.addEventListener('visibilitychange', function () { /* المتابعة تتوقف تلقائياً عند الخفاء */ });
  updateHeader();
  go(params.get('a'));
})();
