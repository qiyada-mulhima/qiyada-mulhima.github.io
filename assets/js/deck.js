/* ============================================================
   حقيبة القيادة الملهمة — تطبيق العرض
   ============================================================ */
(function () {
  'use strict';
  var KIT = window.KIT, API = window.API, VIZ = window.VIZ, cfg = window.KIT_CONFIG || {};
  var P = KIT.PRACTICES, A = KIT.ACTIVITIES, SL = KIT.SLIDES, T = KIT.TEXT;
  var esc = VIZ.esc, icon = window.icon;
  var params = new URLSearchParams(window.location.search);
  var VIEW = params.get('view');
  var LOGO = 'assets/img/logo-qiyada.png';

  var TEXT_ON_LIGHT = { 1: '#D2412F', 2: '#A9740A', 3: '#0E8C68', 4: '#1878B8', 5: '#C22D70' };
  function hexA(hex, a) {
    var h = hex.replace('#', '');
    var n = parseInt(h.length === 3 ? h.replace(/./g, '$&$&') : h, 16);
    return 'rgba(' + ((n >> 16) & 255) + ',' + ((n >> 8) & 255) + ',' + (n & 255) + ',' + a + ')';
  }
  function pVars(p) {
    if (!p) return '';
    return '--pc:' + p.color + ';--pcg:' + hexA(p.color, .3) + ';--pcs:' + hexA(p.color, .14) + ';--pcs-d:' + hexA(p.color, .16) +
      ';--pcs2:' + hexA(p.color, .45) + ';--pct:' + TEXT_ON_LIGHT[p.n] + ';';
  }
  function pOf(s) { return s && s.p ? P[s.p - 1] : null; }
  function badge(p, cls) { return '<span class="p-badge ' + (cls || '') + '" style="--pc:' + p.color + '">' + icon(p.icon) + '</span>'; }

  var FACETS = '<svg class="facets" viewBox="0 0 400 900" preserveAspectRatio="xMinYMid slice" aria-hidden="true">' +
    '<polygon class="f1" points="0,0 250,0 120,900 0,900"/><polygon class="f2" points="0,0 140,0 300,900 0,900"/>' +
    '<polygon class="f3" points="0,560 215,900 0,900"/><polygon class="f4" points="0,0 80,0 0,280"/></svg>';

  /* ---------- الحالة ---------- */
  var st = {
    i: 0, step: 0,
    session: API.cleanSession(params.get('s') || API.get('presenterSession') || 'OPEN'),
    presenter: false, pin: null, read: false, entered: -1
  };
  try { var savedPin = window.sessionStorage.getItem('ilkit:pin'); if (savedPin) { st.pin = savedPin; st.presenter = true; } } catch (e) { /* ignore */ }

  /* ---------- QR ---------- */
  function qrSvg(text) {
    var qr = window.qrcode(0, 'M');
    qr.addData(text);
    qr.make();
    var n = qr.getModuleCount(), m = 1, d = '';
    for (var r = 0; r < n; r++) {
      for (var c = 0; c < n; c++) if (qr.isDark(r, c)) d += 'M' + (c + m) + ' ' + (r + m) + 'h1v1h-1z';
    }
    var size = n + m * 2;
    return '<svg viewBox="0 0 ' + size + ' ' + size + '" shape-rendering="crispEdges" role="img" aria-label="رمز QR"><rect width="' + size + '" height="' + size + '" fill="#fff"/><path d="' + d + '" fill="#0A1F44"/></svg>';
  }
  function shortUrl(u) { return u.replace(/^https?:\/\//, '').replace(/\?.*$/, ''); }
  function countLabel(act) { return act === 'join' ? 'مشارك' : (act === 'lpi' ? 'أكملوا المقياس' : 'مشارك'); }
  function qrCard(act, small) {
    var head = (act === 'join' || !act) ? 'امسح للانضمام' : 'امسح وشارك';
    return '<div class="qr-card' + (small ? ' qr-sm' : '') + '" data-qr="' + (act || '') + '">' +
      '<h4>' + icon('scan-line') + head + '</h4><div class="qr-svg"></div>' +
      '<div class="qr-meta"><span class="qr-count">' + icon('users') + '<b class="live-count" data-act="' + (act || 'join') + '">0</b> ' + countLabel(act) + '</span>' +
      (small ? '' : '<span class="qr-url"></span>') + '<span class="qr-session"></span></div></div>';
  }
  function readCta(act) {
    return '<a class="btn btn-primary read-cta" data-cta="' + act + '" href="#">' + icon('smartphone') + 'شارك الآن</a>';
  }
  function qrUrlFor(act) {
    if (act === 'home') return API.baseUrl();
    return API.participantUrl(st.session, act && act !== 'join' ? act : '');
  }
  function renderQRs(root) {
    (root || document).querySelectorAll('[data-qr]').forEach(function (card) {
      var act = card.dataset.qr || '';
      var url = qrUrlFor(act);
      var box = card.querySelector('.qr-svg');
      if (box && box.dataset.url !== url) { box.innerHTML = qrSvg(url); box.dataset.url = url; }
      var u = card.querySelector('.qr-url');
      if (u) u.textContent = shortUrl(url);
      var s = card.querySelector('.qr-session');
      if (s) s.innerHTML = st.session !== 'OPEN' ? 'رمز الجلسة: <span class="qr-code">' + st.session + '</span>' : '';
      var w = card.querySelector('.qr-warn');
      if (!card.classList.contains('qr-card')) return;
      if (!API.isPublicHost()) {
        if (!w) { w = document.createElement('div'); w.className = 'qr-warn'; w.textContent = 'ارفع الموقع على رابط عام ليعمل الرمز من الجوالات'; card.appendChild(w); }
      } else if (w) w.remove();
    });
    (root || document).querySelectorAll('[data-cta]').forEach(function (a) { a.href = API.participantUrl(st.session, a.dataset.cta); });
  }

  /* ---------- القوالب ---------- */
  var R = {};

  R.cover = function (s, i, ctx) {
    var orbit = P.map(function (p, k) {
      var ang = -90 + k * 72, rad = 42;
      var x = 50 + rad * Math.cos(ang * Math.PI / 180), y = 50 + rad * Math.sin(ang * Math.PI / 180);
      return '<span class="orbit-node" style="--pc:' + p.color + ';--d:' + k + ';left:' + x.toFixed(2) + '%;top:' + y.toFixed(2) + '%" title="' + esc(p.name) + '">' + icon(p.icon) + '</span>';
    }).join('');
    return {
      cls: 'dark', html:
        '<div class="cover-main">' +
        '<img class="cover-logo rise" src="' + LOGO + '" alt="' + esc(cfg.ORG_NAME || '') + '">' +
        '<div class="cover-prog rise" style="--d:1">' + esc(cfg.PROGRAM_NAME || '') + '</div>' +
        '<h1 class="cover-title rise" style="--d:2"><span>' + esc(T.title) + '</span></h1>' +
        '<p class="cover-sub rise" style="--d:3">' + esc(T.kit) + '</p>' +
        '<div class="cover-comp rise" style="--d:4"><span>الجدارة: ' + esc(T.competency1) + '</span><span>' + esc(T.competency2) + '</span></div>' +
        '<div class="cover-org rise" style="--d:5"><b>' + esc(cfg.ORG_NAME || '') + '</b><span>' + esc(cfg.YEAR_LABEL || '') + '</span></div>' +
        '</div>' +
        '<div class="cover-side">' +
        '<div class="orbit">' + orbit + '<div class="orbit-core">الممارسات الخمس للقيادة الملهمة</div></div>' +
        (ctx.thumb ? '' : '<div class="cover-join rise" data-qr="" style="--d:6"><div class="qr-svg"></div><p><b>انضم الآن</b>امسح الرمز بجوالك<br><span class="qr-count" style="background:none;padding:0;color:#fff">' + icon('users') + ' <b class="live-count" data-act="join">0</b> مشارك</span></p></div>') +
        '</div>' + readCta('')
    };
  };

  R.join = function (s) {
    return {
      cls: 'dark', html:
        '<div><span class="kicker rise">' + icon('smartphone') + 'جوالك هو أداة المشاركة</span>' +
        '<h2 class="title rise" style="--d:1">انضم للجلسة</h2>' +
        '<ol class="join-steps rise" style="--d:2"><li><b>1</b>امسح الرمز بكاميرا الجوال</li><li><b>2</b>اكتب اسمك وجهة عملك</li><li><b>3</b>تابع الأنشطة وشارك من مكانك</li></ol>' +
        '<div class="live rise" style="--d:3" data-act="join" data-viz="join"></div>' + readCta('') + '</div>' +
        '<div class="rise" style="--d:2">' + qrCard('join') + '</div>'
    };
  };

  R.goals = function () {
    return {
      cls: 'light', html:
        '<span class="kicker rise">' + icon('target') + 'الجدارة: ' + esc(T.competency1) + '</span>' +
        '<div class="goal-hero rise" style="--d:1"><span class="ic-wrap">' + icon('graduation-cap') + '</span><div><small>هدف البرنامج</small><p>' + esc(T.programGoal) + '</p></div></div>' +
        '<div class="obj-grid">' + T.objectives.map(function (o, k) {
          return '<div class="obj rise" style="--d:' + (k + 2) + '"><span class="n">0' + (k + 1) + icon(o.icon) + '</span><p>' + esc(o.t) + '</p></div>';
        }).join('') + '</div>'
    };
  };

  R.concept = function () {
    var cols = [{ c: '#F0604D', t: '#D2412F' }, { c: '#2F80D1', t: '#1B67B5' }, { c: '#1BAF84', t: '#0E8C68' }];
    var q = esc(T.concept);
    T.conceptParts.forEach(function (part, k) {
      q = q.replace(esc(part.k.replace(/^بين /, '')), '<mark data-mk="' + (k + 1) + '" style="--mk:' + cols[k].c + ';--mkt:' + cols[k].t + '">' + esc(part.k.replace(/^بين /, '')) + '</mark>');
    });
    return {
      cls: 'light', html:
        '<span class="kicker rise">' + icon('lightbulb') + 'مفهوم القيادة</span>' +
        '<p class="concept-quote rise" style="--d:1">' + q + '</p>' +
        '<div class="concept-cards">' + T.conceptParts.map(function (part, k) {
          return '<div class="concept-card" data-step="' + (k + 1) + '" style="--mk:' + cols[k].c + ';--mkt:' + cols[k].t + '"><b><i></i>' + esc(part.k) + '</b><p>' + esc(part.d) + '</p></div>';
        }).join('') + '</div>'
    };
  };

  R.activity = function (s) {
    var a = A[s.act], p = pOf(s);
    var viz = { words: 'wordcloud', wall: 'wall', poll: 'bars', checklist: 'checklist', rating: 'rating' }[a.type];
    var text = a.short || a.prompt;
    var extra = '';
    if (a.type === 'poll') {
      if (s.act === 'phrase') extra = ' data-sort="1" data-top="' + (a.top || 6) + '" data-color="#FFB020"';
      else if (s.act === 'stage') extra = ' data-color="#8EC5F0"';
      else extra = ' data-sort="1" data-color="' + (p ? p.color : '#FFB020') + '"';
    }
    var kick = '<span class="kicker pc">' + icon(a.icon) + 'نشاط تفاعلي' + (p ? ' · ' + esc(p.name) : ' · ' + esc(a.title)) + '</span>';
    return {
      cls: 'dark glow', html:
        '<div class="act-main"><div class="act-head rise">' + kick + '<h2 class="act-prompt' + (text.length > 72 ? ' long' : '') + '">' + esc(text) + '</h2></div>' +
        '<div class="act-viz live' + (a.type === 'poll' && (a.options.length > 6) ? ' bars-compact' : '') + '" data-act="' + s.act + '" data-viz="' + viz + '"' + extra + '></div>' +
        readCta(s.act) + '</div>' +
        '<aside class="act-side rise" style="--d:2">' + qrCard(s.act) +
        (a.link ? '<a class="act-link" href="' + a.link.href + '" target="_blank" rel="noopener">' + icon('external-link') + esc(a.link.t) + '</a>' : '') + '</aside>'
    };
  };

  R.gate = function () {
    return {
      cls: 'light', html:
        '<div><span class="kicker rise">' + icon('lock-open') + 'بوابة التغيير</span><p class="gate-quote rise" style="--d:1">' + esc(T.gate) + '</p></div>' +
        '<img class="gate-img rise" style="--d:2" src="assets/img/same-change.jpg" alt="Same / Change">'
    };
  };

  R.video = function (s, i, ctx) {
    var v = KIT.VIDEOS[s.video], p = pOf(s);
    var head = '<div class="vid-head rise">' + (p ? badge(p) : '<span class="p-badge" style="--pc:#005494">' + icon('circle-play') + '</span>') +
      '<div><h3>' + esc(v.title) + '</h3><p>' + esc(v.sub) + '</p></div><span class="dur">' + icon('clock') + v.min + '</span></div>';
    var frame = ctx.thumb ?
      '<div class="vid-frame"><img src="' + v.poster + '" alt="" style="width:100%;height:100%;object-fit:cover"></div>' :
      '<div class="vid-frame"><video preload="none" playsinline controls poster="' + v.poster + '" data-vid="' + esc(s.video) + '"' + (usesParts(v) ? '' : ' src="' + v.src + '"') + '></video>' +
      '<button class="vid-play" type="button" aria-label="تشغيل المقطع"><span>' + icon('play') + '</span><em class="vid-load"></em></button><span class="vid-hint">V للتشغيل والإيقاف</span></div>';
    var disc = s.discuss ? '<div class="discuss rise" style="--d:2"><h4>' + icon('messages-square') + 'للنقاش بعد المقطع</h4><ol>' +
      s.discuss.map(function (q) { return '<li>' + esc(q) + '</li>'; }).join('') + '</ol></div>' : '';
    return { cls: 'dark' + (p ? ' glow' : ''), html: head + '<div class="vid-body rise' + (disc ? ' has-discuss' : '') + '" style="--d:1">' + frame + disc + '</div>' };
  };

  R.unit = function (s) {
    if (s.unit === 1) {
      return {
        cls: 'dark', html:
          '<span class="unit-num">01</span><div class="unit-kicker rise">الجدارة</div><h2 class="unit-title rise" style="--d:1">' + esc(T.competency1) + '</h2>' +
          '<p class="unit-desc rise" style="--d:2">نبدأ بقياس ممارساتك القيادية، ثم نتعرّف على الممارسات الخمس واحدة تلو الأخرى.</p>' +
          '<div class="unit-chips rise" style="--d:3">' + P.map(function (p) { return '<span>' + badge(p) + esc(p.name) + '</span>'; }).join('') + '</div>'
      };
    }
    return {
      cls: 'dark', html:
        '<span class="unit-num">02</span><div class="unit-kicker rise">الجدارة</div><h2 class="unit-title rise" style="--d:1">' + esc(T.competency2) + '</h2>' +
        '<p class="unit-desc rise" style="--d:2">' + icon('target') + ' ' + esc(T.teamGoal) + '</p>' +
        '<div class="unit-chips rise" style="--d:3"><span>' + icon('messages-square') + 'لغة القائد</span><span>' + icon('route') + 'مراحل تشكيل الفريق</span><span>' + icon('users') + 'العمل بروح الفريق</span></div>'
    };
  };

  R.lpiIntro = function (s) {
    return {
      cls: 'dark', html:
        '<div><span class="kicker rise">' + icon('radar') + 'نشاط تفاعلي · مقياس ذاتي</span>' +
        '<h2 class="title rise" style="--d:1">مقياس الممارسات القيادية <span class="en">LPI</span></h2>' +
        '<div class="lpi-facts rise" style="--d:2"><span>' + icon('list') + '30 عبارة</span><span>' + icon('clock') + '5–7 دقائق</span><span>' + icon('lock') + 'النتيجة في جوالك فقط</span></div>' +
        '<p class="lead rise" style="--d:2;margin-top:1.4em">شروط القياس:</p>' +
        '<ul class="rules">' + KIT.LPI_RULES.map(function (r, k) { return '<li class="rise" style="--d:' + (k + 3) + '">' + icon(r.icon) + esc(r.t) + '</li>'; }).join('') + '</ul>' +
        readCta('lpi') + '</div>' +
        '<div class="rise" style="--d:3">' + qrCard('lpi') + '</div>'
    };
  };

  R.lpiKey = function () {
    return {
      cls: 'light', html:
        '<span class="kicker rise">' + icon('radar') + 'مقياس LPI</span><h2 class="title rise" style="--d:1">كيف تُحسب نتيجتك؟</h2>' +
        '<div class="key-grid">' + P.map(function (p, k) {
          return '<div class="key-col rise" style="--pc:' + p.color + ';--d:' + (k + 2) + '"><header>' + icon(p.icon) + esc(p.name) + '</header>' +
            '<div class="key-items">' + p.items.map(function (n) { return '<span>' + n + '</span>'; }).join('') + '</div><footer>مجموع البعد: 6 – 60</footer></div>';
        }).join('') + '</div>' +
        '<div class="key-note" data-step="1"><div>' + icon('arrow-right') + '<span><b>البعد الأكثر شيوعاً</b> لديك = أعلى مجموع</span></div><div>' + icon('arrow-left') + '<span><b>البعد الأقل شيوعاً</b> لديك = أدنى مجموع</span></div></div>'
    };
  };

  R.lpiGroup = function () {
    return {
      cls: 'dark', html:
        '<div class="lpig-head"><div><span class="kicker rise">' + icon('users') + 'نتائج مباشرة · بدون أسماء</span><h2 class="title rise" style="--d:1">صورة المجموعة في المقياس</h2></div>' +
        '<span class="qr-count rise" style="--d:2">' + icon('users') + '<b class="live-count" data-act="lpi">0</b> أكملوا المقياس</span></div>' +
        '<div class="live rise" style="--d:2" data-act="lpi" data-viz="lpiGroup"></div>'
    };
  };

  R.lpiRead = function () {
    return {
      cls: 'light', html:
        '<span class="kicker rise">' + icon('radar') + 'مقياس LPI</span><h2 class="title rise" style="--d:1">كيف تتعامل مع نتيجتك؟</h2>' +
        '<div class="read-grid">' +
        '<div class="read-card hi rise" style="--d:2"><span class="ic-big">' + icon('trophy') + '</span><h3>' + esc(KIT.LPI_READ.high.t) + '</h3><p>' + esc(KIT.LPI_READ.high.d) + '</p></div>' +
        '<div class="read-card lo rise" style="--d:3"><span class="ic-big">' + icon('rocket') + '</span><h3>' + esc(KIT.LPI_READ.low.t) + '</h3><p>' + esc(KIT.LPI_READ.low.d) + '</p></div>' +
        '</div><p class="read-tip rise" style="--d:4">' + icon('smartphone') + 'نتيجتك الشخصية وسلوكيات بعدك الأقل محفوظة في جوالك.</p>'
    };
  };

  R.source = function () {
    return {
      cls: 'light', html:
        '<div><span class="kicker rise">' + icon('book-open') + 'مصدر النموذج</span>' +
        '<h2 class="title rise" style="--d:1">نموذج الممارسات الخمس للقيادة الملهمة</h2>' +
        '<p class="lead rise" style="--d:2">من أعمال جيمس كوزيس وباري بوسنر في كتاب «تحديات القيادة» <span class="en" style="white-space:nowrap">(The Leadership Challenge)</span>، ويقوم على ممارسات قيادية يمكن ملاحظتها وتعلّمها ومراجعتها.</p>' +
        '<div class="stats">' +
        '<div class="stat rise" style="--d:3"><b>5</b><span>ممارسات</span><small>تشكّل النموذج</small></div>' +
        '<div class="stat rise" style="--d:4"><b>10</b><span>التزامات</span><small>التزامان لكل ممارسة</small></div>' +
        '<div class="stat rise" style="--d:5"><b>30</b><span>سلوكاً</span><small>6 سلوكيات لكل ممارسة</small></div>' +
        '</div></div>' +
        '<img class="book-3d rise" style="--d:2" src="assets/img/book-leadership-challenge.jpg" alt="غلاف كتاب تحديات القيادة">'
    };
  };

  R.five = function () {
    var pos = [[50, 12], [86.1, 38.3], [72.3, 80.7], [27.7, 80.7], [13.9, 38.3]];
    var nodes = P.map(function (p, k) {
      return '<button class="pent-node" type="button" data-pn="' + (k + 1) + '" style="left:' + pos[k][0] + '%;top:' + pos[k][1] + '%">' + badge(p) + '<span>' + esc(p.name) + '</span></button>';
    }).join('');
    var poly = pos.map(function (q) { return q[0] + ',' + q[1]; }).join(' ');
    return {
      cls: 'light', html:
        '<div class="five-panel"><div class="five-intro"><span class="kicker rise">' + icon('compass') + 'النموذج</span>' +
        '<h2 class="title rise" style="--d:1">الممارسات الخمس للقيادة الملهمة</h2>' +
        '<ul class="five-list">' + P.map(function (p, k) { return '<li class="rise" style="--d:' + (k + 2) + '">' + badge(p) + esc(p.name) + '</li>'; }).join('') + '</ul></div>' +
        P.map(function (p, k) {
          return '<div class="five-detail" data-pd="' + (k + 1) + '" style="' + pVars(p) + '"><span class="num">' + esc(p.ordinal) + '</span><h3>' + esc(p.name) + '</h3><span class="en">' + esc(p.en) + '</span><p>' + esc(p.def) + '</p></div>';
        }).join('') + '</div>' +
        '<div class="pent rise" style="--d:2"><svg class="pent-lines" viewBox="0 0 100 100" preserveAspectRatio="none"><polygon points="' + poly + '"/></svg>' +
        '<div class="pent-core"><span><b>5</b>ممارسات للقيادة الملهمة</span></div>' + nodes + '</div>'
    };
  };

  R.practice = function (s) {
    var p = pOf(s);
    return {
      cls: 'dark glow', html:

        '<div><span class="pr-ord rise">' + esc(p.ordinal) + '</span><h2 class="pr-name rise" style="--d:1">' + esc(p.name) + '</h2>' +
        '<div class="pr-en rise" style="--d:2"><span class="en">' + esc(p.en) + '</span></div>' +
        '<div class="pr-comm rise" style="--d:3">' + p.commitments.map(function (c) { return '<span>' + esc(c.t) + '</span>'; }).join('') + '</div></div>' +
        '<div class="pr-vis"><span class="pr-num">0' + p.n + '</span><div class="pr-icon">' + icon(p.icon) + '</div></div>'
    };
  };

  R.def = function (s) {
    var p = pOf(s);
    var d = esc(p.def);
    if (p.key_phrase) d = d.replace(esc(p.key_phrase), '<em>' + esc(p.key_phrase) + '</em>');
    return {
      cls: 'light', html:
        '<div class="def-mark">' + icon(p.icon) + '</div>' +
        '<span class="kicker pc rise">' + icon(p.icon) + esc(p.ordinal) + ' · ' + esc(p.name) + '</span>' +
        '<p class="def-text rise" style="--d:1">' + d + '</p>' +
        '<div class="def-foot rise" style="--d:2">' + badge(p) + '<span>' + esc(p.name) + ' — <span class="en">' + esc(p.en) + '</span></span></div>'
    };
  };

  R.map = function (s) {
    var p = pOf(s);
    var ys = [[12.5, 37.5], [62.5, 87.5]], cy = [25, 75];
    var paths = '';
    cy.forEach(function (y, k) {
      paths += '<path data-step="' + (k + 1) + '" d="M76 50 H71 V' + y + ' H66"/>';
      ys[k].forEach(function (ly) { paths += '<path data-step="' + (k + 1) + '" d="M34 ' + y + ' H32 V' + ly + ' H30"/>'; });
    });
    var nodes = '<div class="tn tn-root rise">' + icon(p.icon) + '<span>' + esc(p.name) + '</span></div>';
    p.commitments.forEach(function (c, k) {
      nodes += '<div class="tn tn-c" data-step="' + (k + 1) + '" style="top:' + cy[k] + '%">' + esc(c.t) + '</div>';
      c.items.forEach(function (it, j) { nodes += '<div class="tn tn-l" data-step="' + (k + 1) + '" style="top:' + ys[k][j] + '%">' + esc(it) + '</div>'; });
    });
    return {
      cls: 'light', html:
        '<span class="kicker pc rise">' + icon(p.icon) + esc(p.ordinal) + '</span><h2 class="title rise" style="--d:1">ملخص عام: <span class="hl">' + esc(p.name) + '</span></h2>' +
        '<div class="tree"><svg viewBox="0 0 100 100" preserveAspectRatio="none" aria-hidden="true">' + paths + '</svg>' + nodes + '</div>'
    };
  };

  R.behaviors = function (s) {
    var p = pOf(s);
    return {
      cls: 'light', html:
        '<div class="beh-main"><span class="kicker pc rise">' + icon(p.icon) + 'القيادة الملهمة</span><h2 class="title rise" style="--d:1">سلوكيات <span class="hl">' + esc(p.name) + '</span></h2>' +
        '<div class="beh-grid">' + p.behaviors.map(function (b, k) {
          return '<div class="beh rise" style="--d:' + (k + 2) + '"><span class="n">' + (k + 1) + '</span><p>' + esc(b) + '</p><span class="item">بند ' + p.items[k] + '</span></div>';
        }).join('') + '</div></div>' +
        '<aside class="beh-side rise" style="--d:3"><div class="live" data-act="lpi" data-viz="practiceAvg" data-p="' + p.n + '"></div></aside>'
    };
  };

  R.venn = function (s) {
    var p = pOf(s);
    return {
      cls: 'light', html:
        '<span class="kicker pc rise">' + icon(p.icon) + esc(p.name) + '</span><h2 class="title rise" style="--d:1">كيف تُلهم الآخرين برؤيتك؟</h2>' +
        '<div class="venn"><div class="venn-g">' + T.venn.map(function (t, k) { return '<div class="venn-c" data-step="' + (k + 1) + '"><span>' + esc(t) + '</span></div>'; }).join('') + '</div></div>'
    };
  };

  R.story = function (s) {
    var p = pOf(s);
    return {
      cls: 'light', html:
        '<div><span class="kicker pc rise">' + icon(p.icon) + esc(p.name) + '</span><h2 class="title rise" style="--d:1">حين يصبح المألوف مملاً</h2>' +
        '<p class="story-text rise" style="--d:2">' + esc(T.story) + '</p>' +
        '<blockquote class="story-quote" data-step="1"><p>«' + esc(T.quote) + '»</p><cite>— ' + esc(T.quoteBy) + '</cite></blockquote></div>' +
        '<img class="story-img rise" style="--d:2" src="' + KIT.VIDEOS.v4.poster + '" alt="">'
    };
  };

  R.books = function () {
    return {
      cls: 'light', html:
        '<span class="kicker rise">' + icon('book-open') + 'للاستزادة</span><h2 class="title rise" style="--d:1">ماذا أقرأ في القيادة؟</h2>' +
        '<div class="books">' + KIT.BOOKS.map(function (b, k) {
          return '<div class="book rise" style="--d:' + (k + 2) + '"><img src="' + b.img + '" alt="غلاف كتاب ' + esc(b.t) + '"><div><h3>' + esc(b.t) + '</h3><p>' + esc(b.sub) + '</p><small>' + esc(b.by) + '</small></div></div>';
        }).join('') + '</div>'
    };
  };

  R.phrases = function () {
    return {
      cls: 'light', html:
        '<span class="kicker rise">' + icon('messages-square') + esc(T.competency2) + '</span><h2 class="title rise" style="--d:1">لغة القائد في فريق العمل</h2>' +
        '<div class="phrases">' + KIT.LEADER_PHRASES.map(function (t, k) { return '<div class="phrase" style="--d:' + k + '">' + esc(t) + '</div>'; }).join('') + '</div>'
    };
  };

  R.stages = function () {
    var S = KIT.TEAM_STAGES;
    return {
      cls: 'light', html:
        '<span class="kicker rise">' + icon('route') + esc(T.competency2) + '</span><h2 class="title rise" style="--d:1">مراحل تشكيل فريق العمل</h2>' +
        '<div class="stg-track rise" style="--d:2">' + S.map(function (x, k) { return '<button class="stg" type="button" data-sg="' + (k + 1) + '">' + icon(x.icon) + '<span>' + esc(x.name) + '</span></button>'; }).join('') + '</div>' +
        '<div class="stg-panel"><div class="stg-intro"><p class="stg-cycle">' + icon('mouse-pointer-click') + ' لكل مرحلة دور مختلف للقائد — تقدّم لاستعراض المراحل</p></div>' +
        S.map(function (x, k) {
          return '<div class="stg-detail" data-sd="' + (k + 1) + '"><div class="stg-card">' + icon(x.icon) + '<h3>' + esc(x.name) + '</h3><p>' + esc(x.sub) + '</p></div>' +
            '<div class="stg-roles"><h4>' + icon('users-round') + 'دور القائد</h4>' + (x.lead ? '<p class="lead-line">' + esc(x.lead) + '</p>' : '') +
            '<ul>' + x.roles.map(function (r) { return '<li>' + icon('circle-check') + '<span>' + esc(r) + '</span></li>'; }).join('') + '</ul></div></div>';
        }).join('') + '</div>'
    };
  };

  R.teamSteps = function () {
    var cols = ['#005494', '#2F80D1', '#1BAF84', '#F6B92B', '#F0604D', '#E5488E'];
    return {
      cls: 'light', html:
        '<span class="kicker rise">' + icon('users') + esc(T.competency2) + '</span><h2 class="title rise" style="--d:1">كيف أعمل بروح الفريق؟</h2>' +
        '<div class="steps6">' + KIT.TEAM_STEPS.map(function (x, k) {
          return '<div class="step6" style="--i:' + k + ';--c:' + cols[k] + '"><span class="n">' + (k + 1) + '</span>' + (x.k ? '<b>' + esc(x.k) + '</b>' : '') + '<p>' + esc(x.t) + '</p></div>';
        }).join('') + '</div>'
    };
  };

  R.end = function () {
    return {
      cls: 'dark', html:
        '<div><span class="kicker rise">' + icon('sparkles') + esc(T.title) + '</span><h2 class="end-title rise" style="--d:1">شكراً لكم</h2>' +
        '<p class="end-sub rise" style="--d:2">القيادة سلوك يتكرر.. اختر ممارسة واحدة وابدأ بها هذا الأسبوع.</p>' +
        '<div class="end-practices rise" style="--d:3">' + P.map(function (p) { return '<span>' + badge(p) + esc(p.name) + '</span>'; }).join('') + '</div>' +
        '<div class="end-org rise" style="--d:4"><img src="' + LOGO + '" alt=""><span>' + esc(cfg.ORG_NAME || '') + ' · ' + esc(cfg.PROGRAM_NAME || '') + '</span></div></div>' +
        '<div class="rise" style="--d:3"><div class="qr-card" data-qr="home"><h4>' + icon('book-open') + 'احتفظ بالحقيبة</h4><div class="qr-svg"></div><div class="qr-meta"><span class="qr-url"></span></div></div></div>'
    };
  };

  function slideTitle(s) {
    var p = pOf(s);
    switch (s.type) {
      case 'cover': return 'الغلاف';
      case 'join': return 'انضم للجلسة';
      case 'goals': return 'الأهداف';
      case 'concept': return 'مفهوم القيادة';
      case 'activity': return 'نشاط: ' + A[s.act].title;
      case 'gate': return 'بوابة التغيير';
      case 'video': return 'مقطع: ' + KIT.VIDEOS[s.video].title;
      case 'unit': return 'الجدارة: ' + (s.unit === 1 ? T.competency1 : T.competency2);
      case 'lpiIntro': return 'مقياس LPI';
      case 'lpiKey': return 'تصحيح المقياس';
      case 'lpiGroup': return 'صورة المجموعة';
      case 'lpiRead': return 'قراءة النتيجة';
      case 'source': return 'مصدر النموذج';
      case 'five': return 'الممارسات الخمس';
      case 'practice': return p.ordinal + ': ' + p.name;
      case 'def': return 'تعريف ' + p.name;
      case 'map': return 'ملخص ' + p.name;
      case 'behaviors': return 'سلوكيات ' + p.name;
      case 'venn': return 'الإيمان بالرؤية';
      case 'story': return 'قصة التحدي';
      case 'books': return 'ماذا أقرأ؟';
      case 'phrases': return 'لغة القائد';
      case 'stages': return 'مراحل الفريق';
      case 'teamSteps': return 'العمل بروح الفريق';
      case 'end': return 'الختام';
      default: return s.id;
    }
  }

  function renderSlide(s, i, ctx) {
    var r = R[s.type](s, i, ctx || {});
    var p = pOf(s);
    var tag = (ctx && ctx.thumb) ? 'div' : 'section';
    return '<' + tag + ' class="slide t-' + s.type + ' ' + r.cls + '" data-i="' + i + '" style="' + pVars(p) + '" aria-roledescription="شريحة" aria-label="' + esc(slideTitle(s)) + '">' +
      FACETS + '<div class="si">' + r.html + '</div>' +
      '<footer class="sf"><span class="sf-brand"><i></i>' + esc(T.title) + (p ? ' · ' + esc(p.name) : (s.section ? ' · ' + esc(s.section) : '')) + '</span>' +
      '<span class="sf-meta"><span dir="ltr">' + (i + 1) + ' / ' + SL.length + '</span><img class="sf-logo" src="' + LOGO + '" alt=""></span></footer>' +
      '</' + tag + '>';
  }

  /* ---------- الخطوات الخاصة ---------- */
  var STEP_FX = {
    concept: function (el, step) {
      el.querySelectorAll('mark[data-mk]').forEach(function (m) { m.classList.toggle('on', +m.dataset.mk <= step); });
    },
    five: function (el, step) {
      var panel = el.querySelector('.five-panel'), pent = el.querySelector('.pent');
      panel.classList.toggle('sel', step > 0);
      pent.classList.toggle('has-sel', step > 0);
      el.querySelectorAll('.pent-node').forEach(function (n) { n.classList.toggle('on', +n.dataset.pn === step); });
      el.querySelectorAll('.five-detail').forEach(function (d) { d.style.display = +d.dataset.pd === step ? '' : 'none'; });
    },
    stages: function (el, step) {
      el.querySelector('.stg-panel').classList.toggle('sel', step > 0);
      el.querySelectorAll('.stg').forEach(function (b) { var k = +b.dataset.sg; b.classList.toggle('on', k === step); b.classList.toggle('done', k < step); });
      el.querySelectorAll('.stg-detail').forEach(function (d) { d.classList.toggle('on', +d.dataset.sd === step); });
    }
  };
  function applySteps(el, s, step) {
    el.querySelectorAll('[data-step]').forEach(function (n) { n.classList.toggle('is-shown', +n.dataset.step <= step); });
    if (STEP_FX[s.type]) STEP_FX[s.type](el, step);
  }

  /* ---------- البناء ---------- */
  var app, stage, slideEls = [];
  function build() {
    app = document.getElementById('app');
    stage = document.getElementById('stage');
    stage.innerHTML = SL.map(function (s, i) { return renderSlide(s, i, {}); }).join('');
    slideEls = Array.prototype.slice.call(stage.querySelectorAll('.slide'));

    // تفاعل النقر داخل الشرائح
    slideEls.forEach(function (el, i) {
      var s = SL[i];
      if (s.type === 'five') el.querySelectorAll('.pent-node').forEach(function (n) { n.addEventListener('click', function () { show(i, +n.dataset.pn); }); });
      if (s.type === 'stages') el.querySelectorAll('.stg').forEach(function (n) { n.addEventListener('click', function () { show(i, +n.dataset.sg); }); });
      if (s.type === 'concept') el.querySelectorAll('mark[data-mk]').forEach(function (m) { m.addEventListener('click', function () { show(i, +m.dataset.mk); }); });
      el.querySelectorAll('.vid-frame').forEach(setupVideo);
    });
  }

  /* المقاطع الكبيرة مجزّأة (assets/video/parts) لتناسب حدود الرفع، وتُجمع في المتصفح قبل التشغيل.
     عند فتح الملفات محلياً (file://) يُستخدم الملف الكامل مباشرة. */
  function usesParts(v) { return !!(v && v.parts) && location.protocol !== 'file:'; }
  var vidCache = {};
  function loadVideoSrc(key, onProgress) {
    var v = KIT.VIDEOS[key];
    if (!usesParts(v)) return Promise.resolve(v.src);
    var c = vidCache[key];
    if (c) { if (onProgress) { c.cbs.push(onProgress); onProgress(c.done, c.total); } return c.p; }
    c = vidCache[key] = { cbs: onProgress ? [onProgress] : [], done: 0, total: v.parts };
    var urls = [];
    for (var k = 1; k <= v.parts; k++) urls.push('assets/video/parts/' + key + '-' + k + '.bin');
    c.p = Promise.all(urls.map(function (u) {
      return fetch(u).then(function (r) {
        if (!r.ok) throw new Error('HTTP ' + r.status);
        return r.blob();
      }).then(function (b) {
        c.done++;
        c.cbs.forEach(function (f) { try { f(c.done, c.total); } catch (e) { /* ignore */ } });
        return b;
      });
    })).then(function (blobs) {
      c.url = URL.createObjectURL(new Blob(blobs, { type: 'video/mp4' }));
      return c.url;
    });
    c.p.catch(function () { if (vidCache[key] === c) delete vidCache[key]; });
    return c.p;
  }
  function ensureVideo(v) {
    if (!v) return Promise.reject(new Error('no video'));
    if (v.getAttribute('src')) return Promise.resolve(v);
    var frame = v.closest('.vid-frame'), lab = frame && frame.querySelector('.vid-load');
    if (frame) { frame.classList.remove('vid-error'); frame.classList.add('vid-loading'); }
    return loadVideoSrc(v.dataset.vid, function (d, n) {
      if (lab) lab.textContent = 'جاري تجهيز المقطع… ' + Math.round(d / n * 100) + '%';
    }).then(function (url) {
      if (!v.getAttribute('src')) v.src = url;
      if (frame) frame.classList.remove('vid-loading');
      return v;
    }, function (err) {
      if (frame) { frame.classList.remove('vid-loading'); frame.classList.add('vid-error'); }
      if (lab) lab.textContent = 'تعذّر تحميل المقطع — اضغط للمحاولة مرة أخرى';
      throw err;
    });
  }
  function playVideo(v) {
    ensureVideo(v).then(function () {
      var r = v.play();
      if (r && r.catch) r.catch(function () { /* ignore */ });
    }, function () { /* الرسالة ظاهرة على المقطع */ });
  }
  function prefetchVideos(i) {
    [i, i + 1, i + 2].forEach(function (k) {
      if (!SL[k] || SL[k].type !== 'video' || !slideEls[k]) return;
      var v = slideEls[k].querySelector('video');
      if (v) ensureVideo(v).catch(function () { /* ignore */ });
    });
  }

  function setupVideo(frame) {
    var v = frame.querySelector('video'), b = frame.querySelector('.vid-play');
    if (!v) return;
    if (b) b.addEventListener('click', function () { playVideo(v); });
    v.addEventListener('play', function () { frame.classList.add('playing'); setTimeout(function () { if (document.activeElement) document.activeElement.blur(); }, 50); });
    v.addEventListener('ended', function () { frame.classList.remove('playing'); });
    v.addEventListener('pause', function () { setTimeout(function () { if (document.activeElement === v) v.blur(); }, 50); });
  }
  function activeVideo() { var el = slideEls[st.i]; return el && el.querySelector('video'); }
  function toggleVideo() {
    var v = activeVideo();
    if (!v) return;
    if (v.paused) playVideo(v); else v.pause();
  }

  /* ---------- النتائج المباشرة ---------- */
  var unwatchers = [];
  function stopLive() { unwatchers.forEach(function (u) { u(); }); unwatchers = []; }
  function hideItem(act, key) {
    var k = 'hidden:' + st.session + ':' + act;
    var h = API.get(k, {}); h[key] = 1; API.set(k, h);
  }
  function renderLive(root, act, items, info) {
    var a = A[act];
    var hidden = API.get('hidden:' + st.session + ':' + act, {});
    root.querySelectorAll('.live[data-act="' + act + '"]').forEach(function (el) {
      var viz = el.dataset.viz;
      var opts = { hidden: hidden, onHide: st.read ? null : function (k) { hideItem(act, k); } };
      if (viz === 'wordcloud') VIZ.wordcloud(el, items, opts);
      else if (viz === 'wall') VIZ.wall(el, items, Object.assign(opts, { variant: a.variant }));
      else if (viz === 'bars') VIZ.bars(el, items, { options: a.options, sort: !!el.dataset.sort, top: +el.dataset.top || 0, color: el.dataset.color });
      else if (viz === 'lpiGroup') VIZ.lpiGroup(el, items);
      else if (viz === 'practiceAvg') VIZ.practiceAvg(el, items, { p: +el.dataset.p });
      else if (viz === 'checklist') VIZ.checklist(el, items, { statements: a.statements });
      else if (viz === 'rating') VIZ.rating(el, items);
      else if (viz === 'join') VIZ.join(el, items);
      var err = el.querySelector('.viz-err');
      if (info && info.error) {
        if (!err) { err = document.createElement('span'); err.className = 'viz-err'; err.innerHTML = icon('wifi-off') + 'تعذّر تحديث النتائج'; el.appendChild(err); }
      } else if (err) err.remove();
    });
    root.querySelectorAll('.live-count[data-act="' + act + '"]').forEach(function (el) { el.textContent = VIZ.fmt(VIZ.uniq(items).length); });
  }
  function watchIn(root) {
    var acts = {};
    root.querySelectorAll('[data-act]').forEach(function (el) { acts[el.dataset.act] = 1; });
    return Object.keys(acts).map(function (act) {
      return API.watch(st.session, act, function (items, info) { renderLive(root, act, items, info); });
    });
  }

  /* ---------- التنقل ---------- */
  function clamp(n, a, b) { return Math.max(a, Math.min(b, n)); }
  function stepsOf(i) { return SL[i].steps || 0; }
  function show(i, step, opts) {
    i = clamp(i, 0, SL.length - 1);
    step = clamp(step == null ? 0 : step, 0, stepsOf(i));
    var changed = i !== st.i || st.entered !== i;
    var prev = st.i;
    st.i = i; st.step = step;
    if (!st.read) {
      slideEls.forEach(function (el, k) { el.classList.toggle('is-active', k === i); });
      applySteps(slideEls[i], SL[i], step);
      if (changed) {
        var pv = slideEls[prev] && slideEls[prev].querySelector('video');
        if (pv && prev !== i) pv.pause();
        stopLive();
        renderQRs(slideEls[i]);
        unwatchers = watchIn(slideEls[i]);
        st.entered = i;
        prefetchVideos(i);
      }
    }
    updateChrome();
    if (!(opts && opts.noHash)) {
      try { history.replaceState(null, '', location.pathname + location.search + '#' + (i + 1)); } catch (e) { /* ignore */ }
    }
    broadcast();
    if (changed) pushPresenterState();
  }
  function next() { if (st.step < stepsOf(st.i)) show(st.i, st.step + 1); else if (st.i < SL.length - 1) show(st.i + 1, 0); }
  function prev() { if (st.step > 0) show(st.i, st.step - 1); else if (st.i > 0) show(st.i - 1, stepsOf(st.i - 1)); }

  function parseHash() {
    var h = decodeURIComponent((location.hash || '').replace('#', ''));
    if (!h) return 0;
    if (/^\d+$/.test(h)) return clamp(parseInt(h, 10) - 1, 0, SL.length - 1);
    var k = SL.findIndex(function (s) { return s.id === h; });
    return k >= 0 ? k : 0;
  }

  /* ---------- الحجم ---------- */
  function fit() {
    if (st.read) return;
    var W = window.innerWidth, H = window.innerHeight;
    var w = W, h = W * 9 / 16;
    if (h > H) { h = H; w = H * 16 / 9; }
    stage.style.setProperty('--sw', Math.floor(w) + 'px');
    stage.style.setProperty('--sh', Math.floor(h) + 'px');
  }

  /* ---------- الواجهة ---------- */
  var chrome = {};
  function updateChrome() {
    if (chrome.counter) chrome.counter.textContent = (st.i + 1) + ' / ' + SL.length;
    if (chrome.bar) chrome.bar.style.width = ((st.i + 1) / SL.length * 100) + '%';
    var p = pOf(SL[st.i]);
    if (chrome.bar) chrome.bar.style.background = p ? p.color : 'var(--amber)';
    if (chrome.session) chrome.session.textContent = st.session === 'OPEN' ? 'مفتوحة' : st.session;
    if (chrome.dot) chrome.dot.className = 'dot ' + (API.mode === 'local' ? 'local' : (chrome.err ? 'err' : 'ok'));
    if (chrome.pres) chrome.pres.hidden = !st.presenter;
    document.body.classList.toggle('presenter-mode', st.presenter);
  }

  var idleT;
  function wake() {
    app.classList.remove('idle');
    clearTimeout(idleT);
    idleT = setTimeout(function () { if (!document.querySelector('.overlay.open')) app.classList.add('idle'); }, 2600);
  }

  function openOv(id) { closeOv(); var o = document.getElementById(id); o.classList.add('open'); app.classList.remove('idle'); return o; }
  function closeOv() { document.querySelectorAll('.overlay.open').forEach(function (o) { o.classList.remove('open'); }); }
  function anyOv() { return !!document.querySelector('.overlay.open'); }

  /* شبكة الشرائح */
  var thumbsBuilt = false;
  function openOverview() {
    var o = openOv('ovOverview');
    var box = o.querySelector('.thumbs');
    if (!thumbsBuilt) {
      box.innerHTML = SL.map(function (s, i) {
        return '<div class="thumb" role="button" tabindex="0" data-go="' + i + '"><div class="thumb-stage" aria-hidden="true">' + renderSlide(s, i, { thumb: true }).replace(/<button\b/g, '<span').replace(/<\/button>/g, '</span>') + '</div><small><b>' + (i + 1) + '</b>' + esc(slideTitle(s)) + '</small></div>';
      }).join('');
      box.querySelectorAll('.thumb').forEach(function (b) {
        b.addEventListener('click', function () { closeOv(); show(+b.dataset.go, 0); });
        b.addEventListener('keydown', function (e) { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); e.stopPropagation(); closeOv(); show(+b.dataset.go, 0); } });
      });
      box.querySelectorAll('.thumb-stage .qr-card').forEach(function (c) { c.querySelector('.qr-svg').innerHTML = qrSvg(qrUrlFor(c.dataset.qr)); });
      thumbsBuilt = true;
    }
    box.querySelectorAll('.thumb').forEach(function (b) { b.classList.toggle('cur', +b.dataset.go === st.i); });
    var cur = box.querySelector('.thumb.cur');
    if (cur) cur.scrollIntoView({ block: 'center' });
  }

  /* QR كبير */
  function openQR() {
    var o = openOv('ovQR');
    var s = SL[st.i];
    var act = (s.act && s.type !== 'lpiGroup') ? s.act : '';
    var card = o.querySelector('.qr-card');
    card.dataset.qr = act;
    card.querySelector('h4').innerHTML = icon('scan-line') + (act && act !== 'join' ? 'امسح وشارك: ' + esc(A[act].title) : 'امسح للانضمام');
    renderQRs(o);
  }

  /* لوحة الجلسة */
  function setSession(code) {
    st.session = API.cleanSession(code);
    API.set('presenterSession', st.session);
    var u = new URL(window.location.href);
    if (st.session === 'OPEN') u.searchParams.delete('s'); else u.searchParams.set('s', st.session);
    try { history.replaceState(null, '', u.pathname + u.search + u.hash); } catch (e) { /* ignore */ }
    API.resetWatchers();
    stopLive();
    document.querySelectorAll('.live').forEach(function (el) { el.innerHTML = ''; });
    thumbsBuilt = false;
    st.entered = -1;
    show(st.i, st.step);
    renderQRs(document);
    renderLivePanel();
  }

  function renderLivePanel() {
    var o = document.getElementById('ovLive');
    var p = o.querySelector('.ov-panel');
    var pUrl = API.participantUrl(st.session, '');
    var modeNote = API.mode === 'local'
      ? '<div class="ov-note">' + icon('info') + ' <b>وضع تجريبي:</b> لم يُربط Google Sheet بعد، لذلك المشاركات تُحفظ في هذا المتصفح فقط (للتجربة والمعاينة). اتبع الخطوات في <a href="setup.html" target="_blank">setup.html</a> ثم ضع الرابط في <code>config.js</code>.</div>'
      : '<div class="ov-note ok" id="connNote">' + icon('wifi') + ' مرتبط بـ Google Sheet — <a href="#" id="pingBtn">اختبار الاتصال</a></div>';
    p.innerHTML =
      '<h2>لوحة الجلسة</h2><p>تحكّم في الجلسة المباشرة ورموز المشاركة.</p>' + modeNote +
      '<h3>' + icon('qr-code') + 'الجلسة الحالية</h3>' +
      '<div class="ov-row"><span>الرمز: <code>' + (st.session === 'OPEN' ? 'OPEN (مفتوحة للجميع)' : st.session) + '</code></span>' +
      '<button class="btn btn-primary btn-sm" id="newSess">' + icon('sparkles') + 'ابدأ جلسة جديدة</button>' +
      (st.session !== 'OPEN' ? '<button class="btn btn-ghost btn-sm" id="openSess">العودة للجلسة المفتوحة</button>' : '') + '</div>' +
      '<p>كل جلسة لها نتائجها المستقلة. «الجلسة المفتوحة» تجمع مشاركات من يتصفح الحقيبة في أي وقت.</p>' +
      '<div class="ov-row"><code style="max-width:100%;overflow:hidden;text-overflow:ellipsis;white-space:nowrap">' + esc(pUrl) + '</code>' +
      '<button class="btn btn-ghost btn-sm" id="copyLink">' + icon('copy') + 'نسخ رابط المشاركة</button></div>' +
      '<div class="ov-row" style="margin-top:8px"><span>انتقل لجلسة برمزها:</span><input id="sessInput" maxlength="12" placeholder="مثال: QX7K" style="width:140px;direction:ltr;text-transform:uppercase"><button class="btn btn-ghost btn-sm" id="goSess">انتقال</button></div>' +
      '<h3>' + icon('lock') + 'وضع المقدّم</h3>' +
      (st.presenter
        ? '<div class="ov-note ok">' + icon('check') + ' أنت المقدّم: جوالات المشاركين تنتقل تلقائياً للنشاط المعروض على الشاشة.</div><div class="ov-row" style="margin-top:10px"><button class="btn btn-ghost btn-sm" id="pinOff">إيقاف وضع المقدّم</button></div>'
        : '<p>أدخل الرقم السري (المحدد في السكربت) لتتبعك جوالات المشاركين تلقائياً من نشاط لآخر.</p><div class="ov-row"><input id="pinInput" type="password" inputmode="numeric" placeholder="الرقم السري" style="width:160px;direction:ltr"><button class="btn btn-primary btn-sm" id="pinBtn">تفعيل</button><span id="pinMsg"></span></div>') +
      '<h3>' + icon('eye-off') + 'إدارة المعروض</h3>' +
      '<p>اضغط على أي كلمة أو بطاقة على الشاشة لإخفائها فوراً (لهذا الجهاز فقط).</p>' +
      '<div class="ov-row"><button class="btn btn-ghost btn-sm" id="unhide">' + icon('eye') + 'إظهار كل ما أُخفي</button></div>' +
      (API.mode === 'local' ? '<h3>' + icon('sparkles') + 'معاينة بنتائج تجريبية</h3><p>تملأ الأنشطة بمشاركات وهمية لترى شكل النتائج (في هذا المتصفح فقط، ولا تُرسل لأي مكان).</p>' +
        '<div class="ov-row"><button class="btn btn-ghost btn-sm" id="demoFill">' + icon('sparkles') + 'إضافة بيانات تجريبية</button><button class="btn btn-ghost btn-sm" id="demoClear">' + icon('x') + 'مسح بيانات هذه الجلسة</button></div>' : '') +
      '<h3>' + icon('presentation') + 'عرض المقدّم</h3><p>نافذة جانبية فيها الملاحظات والشريحة التالية والمؤقت — افتحها على شاشة اللابتوب واعرض الحقيبة على البروجكتر.</p>' +
      '<div class="ov-row"><button class="btn btn-ghost btn-sm" id="presView">' + icon('monitor') + 'فتح عرض المقدّم</button></div>';

    function on(id, fn) { var b = p.querySelector('#' + id); if (b) b.addEventListener('click', function (e) { e.preventDefault(); fn(b); }); }
    on('newSess', function () { setSession(API.shortCode()); });
    on('openSess', function () { setSession('OPEN'); });
    on('copyLink', function (b) { copy(pUrl, b); });
    on('goSess', function () { var v = p.querySelector('#sessInput').value; if (v.trim()) setSession(v); });
    on('pinBtn', function () {
      var pin = p.querySelector('#pinInput').value.trim(), msg = p.querySelector('#pinMsg');
      if (!pin) return;
      msg.textContent = '…';
      API.checkPin(pin).then(function (r) {
        if (!r.ok) { msg.textContent = r.reason === 'pin_not_set' ? 'لم يُحدَّد رقم سري في السكربت بعد (PRESENTER_PIN)' : 'الرقم غير صحيح'; return; }
        st.presenter = true; st.pin = pin;
        try { window.sessionStorage.setItem('ilkit:pin', pin); } catch (e) { /* ignore */ }
        if (st.session === 'OPEN') setSession(API.shortCode()); else renderLivePanel();
        updateChrome(); pushPresenterState(true);
      }).catch(function () { msg.textContent = 'تعذّر الاتصال'; });
    });
    on('pinOff', function () { st.presenter = false; st.pin = null; try { window.sessionStorage.removeItem('ilkit:pin'); } catch (e) { /* ignore */ } updateChrome(); renderLivePanel(); });
    on('unhide', function () { Object.keys(A).forEach(function (a) { API.del('hidden:' + st.session + ':' + a); }); API.resetWatchers(); st.entered = -1; show(st.i, st.step); });
    on('demoFill', function (b) { window.KIT_DEMO.fill(st.session); b.textContent = 'تمت الإضافة ✓'; API.resetWatchers(); st.entered = -1; show(st.i, st.step); });
    on('demoClear', function (b) { API.localClear(st.session); b.textContent = 'تم المسح ✓'; API.resetWatchers(); document.querySelectorAll('.live').forEach(function (el) { el.innerHTML = ''; }); st.entered = -1; show(st.i, st.step); });
    on('presView', function () { openPresenterView(); });
    on('pingBtn', function () {
      var n = p.querySelector('#connNote');
      n.className = 'ov-note'; n.textContent = 'جارٍ الاختبار…';
      API.ping().then(function (j) { n.className = 'ov-note ok'; n.textContent = 'الاتصال سليم ✓ (' + (j.sheets != null ? j.sheets + ' ورقة' : 'Google Sheet') + ')'; })
        .catch(function (e) { n.className = 'ov-note err'; n.textContent = 'تعذّر الاتصال: تأكد من الرابط في config.js ومن نشر السكربت بصلاحية «أي شخص». (' + e.message + ')'; });
    });
  }
  function openLive() { renderLivePanel(); openOv('ovLive'); }

  function copy(text, btn) {
    var done = function () { if (btn) { var o = btn.innerHTML; btn.innerHTML = icon('check') + 'تم النسخ'; setTimeout(function () { btn.innerHTML = o; }, 1600); } };
    if (navigator.clipboard && navigator.clipboard.writeText) navigator.clipboard.writeText(text).then(done, function () { prompt('انسخ الرابط:', text); });
    else prompt('انسخ الرابط:', text);
  }

  /* حالة المقدم للمشاركين */
  var pushT;
  function pushPresenterState(now) {
    if (!st.presenter || VIEW === 'presenter') return;
    clearTimeout(pushT);
    pushT = setTimeout(function () {
      var s = SL[st.i];
      var act = (s.act && s.type !== 'lpiGroup' && s.act !== 'join') ? s.act : null;
      API.setState(st.session, { i: st.i, a: act, at: Date.now() }, st.pin).then(function () { chrome.err = false; updateChrome(); })
        .catch(function (e) {
          if (String(e.message).indexOf('pin') >= 0) { st.presenter = false; updateChrome(); }
          chrome.err = true; updateChrome();
        });
    }, now ? 0 : 450);
  }

  /* ملء الشاشة */
  function toggleFS() {
    var d = document;
    if (!d.fullscreenElement && !d.webkitFullscreenElement) {
      var el = d.documentElement;
      (el.requestFullscreen || el.webkitRequestFullscreen || function () { }).call(el);
    } else {
      (d.exitFullscreen || d.webkitExitFullscreen || function () { }).call(d);
    }
  }

  /* ---------- عرض المقدّم (نافذة ثانية) ---------- */
  var bc = null;
  try { bc = new BroadcastChannel('ilkit-deck'); } catch (e) { bc = null; }
  function broadcast() { if (bc && VIEW !== 'presenter') bc.postMessage({ type: 'state', i: st.i, step: st.step, session: st.session }); }
  function openPresenterView() {
    var u = new URL(window.location.href);
    u.searchParams.set('view', 'presenter');
    u.hash = '';
    window.open(u.toString(), 'ilkit-presenter', 'width=1180,height=760');
  }

  /* ---------- وضع القراءة ---------- */
  var readObs = null, readWatch = new Map();
  function setRead(on) {
    st.read = on;
    app.classList.toggle('read', on);
    document.body.classList.toggle('is-read', on);
    stopLive();
    if (on) {
      slideEls.forEach(function (el, k) { el.classList.add('is-active'); applySteps(el, SL[k], SL[k].type === 'five' ? 0 : stepsOf(k)); });
      renderQRs(document);
      readObs = new IntersectionObserver(function (entries) {
        entries.forEach(function (en) {
          var el = en.target;
          if (en.isIntersecting && !readWatch.has(el)) readWatch.set(el, watchIn(el));
          else if (!en.isIntersecting && readWatch.has(el)) { readWatch.get(el).forEach(function (u) { u(); }); readWatch.delete(el); }
        });
      }, { rootMargin: '200px 0px' });
      slideEls.forEach(function (el) { if (el.querySelector('[data-act]')) readObs.observe(el); });
      var target = slideEls[st.i];
      if (target && st.i > 0) setTimeout(function () { target.scrollIntoView({ block: 'start' }); window.scrollBy(0, -64); }, 50);
    } else {
      if (readObs) { readObs.disconnect(); readObs = null; }
      readWatch.forEach(function (arr) { arr.forEach(function (u) { u(); }); });
      readWatch.clear();
      slideEls.forEach(function (el) { el.classList.remove('is-active'); });
      window.scrollTo(0, 0);
      fit();
      st.entered = -1;
      show(st.i, st.step);
    }
  }
  function autoRead() { return window.innerWidth < 760 || (window.innerHeight > window.innerWidth * 1.15 && window.innerWidth < 1000); }

  /* ---------- لوحة المفاتيح واللمس ---------- */
  function onKey(e) {
    if (e.target && e.target.matches && e.target.matches('input, textarea, select, [contenteditable]')) return;
    if (e.metaKey || e.ctrlKey || e.altKey) return;
    if (anyOv()) { if (e.key === 'Escape') closeOv(); return; }
    if (st.read) return;
    var k = e.key, c = e.code;
    if (k === 'ArrowRight' || k === 'ArrowDown' || k === 'PageDown' || k === ' ' || k === 'Enter' || c === 'KeyN') { e.preventDefault(); next(); }
    else if (k === 'ArrowLeft' || k === 'ArrowUp' || k === 'PageUp' || k === 'Backspace') { e.preventDefault(); prev(); }
    else if (k === 'Home') show(0, 0);
    else if (k === 'End') show(SL.length - 1, 0);
    else if (c === 'KeyF') toggleFS();
    else if (c === 'KeyG' || c === 'KeyO') openOverview();
    else if (c === 'KeyQ') openQR();
    else if (c === 'KeyL') openLive();
    else if (c === 'KeyP') openPresenterView();
    else if (c === 'KeyV' || c === 'KeyK') toggleVideo();
    else if (c === 'KeyH' || k === '?') openOv('ovHelp');
    else if (c === 'KeyR') setRead(true);
    wake();
  }
  function setupTouch() {
    var x0 = null, y0 = null;
    stage.addEventListener('touchstart', function (e) { if (st.read) return; var t = e.touches[0]; x0 = t.clientX; y0 = t.clientY; }, { passive: true });
    stage.addEventListener('touchend', function (e) {
      if (st.read || x0 == null) return;
      var t = e.changedTouches[0], dx = t.clientX - x0, dy = t.clientY - y0;
      if (Math.abs(dx) > 50 && Math.abs(dx) > Math.abs(dy) * 1.4) { if (dx > 0) next(); else prev(); }
      x0 = null;
    }, { passive: true });
  }

  /* ---------- التشغيل ---------- */
  function initDeck() {
    build();
    chrome.counter = document.getElementById('counter');
    chrome.bar = document.getElementById('progressBar');
    chrome.session = document.getElementById('stSession');
    chrome.dot = document.getElementById('stDot');
    chrome.pres = document.getElementById('stPres');

    document.getElementById('btnPrev').addEventListener('click', prev);
    document.getElementById('btnNext').addEventListener('click', next);
    document.getElementById('btnGrid').addEventListener('click', openOverview);
    document.getElementById('btnQR').addEventListener('click', openQR);
    document.getElementById('btnLive').addEventListener('click', openLive);
    document.getElementById('btnFS').addEventListener('click', toggleFS);
    document.getElementById('btnRead').addEventListener('click', function () { setRead(true); });
    document.getElementById('btnHelp').addEventListener('click', function () { openOv('ovHelp'); });
    document.getElementById('stBtn').addEventListener('click', openLive);
    document.getElementById('readPresent').addEventListener('click', function () { setRead(false); });
    document.querySelectorAll('.ov-close').forEach(function (b) { b.addEventListener('click', closeOv); });
    document.querySelectorAll('.overlay').forEach(function (o) { o.addEventListener('click', function (e) { if (e.target === o) closeOv(); }); });

    document.addEventListener('keydown', onKey);
    document.addEventListener('mousemove', wake);
    window.addEventListener('resize', function () { fit(); });
    window.addEventListener('hashchange', function () { var k = parseHash(); if (k !== st.i) show(k, 0, { noHash: true }); });
    setupTouch();

    if (bc) bc.onmessage = function (m) {
      var d = m.data || {};
      if (d.type === 'nav') { if (d.dir === 'next') next(); else if (d.dir === 'prev') prev(); else if (typeof d.i === 'number') show(d.i, d.step || 0); }
      if (d.type === 'hello') broadcast();
    };

    fit();
    st.i = parseHash();
    if (autoRead()) { setRead(true); }
    else show(st.i, 0, { noHash: true });
    renderQRs(document);
    updateChrome();
    wake();
    if (st.presenter) pushPresenterState(true);
  }

  /* نافذة عرض المقدّم */
  function initPresenterView() {
    document.body.className = 'deck-body pv-body';
    var cur = 0, step = 0, t0 = Date.now();
    var root = document.getElementById('app');
    root.innerHTML = '<div class="pv">' +
      '<header class="pv-top"><b>عرض المقدّم</b><span id="pvTimer">00:00</span><button class="btn btn-sm btn-ghost" id="pvReset">تصفير المؤقت</button><span id="pvCount"></span></header>' +
      '<div class="pv-main"><div class="pv-cur"><div class="thumb-stage" id="pvCur"></div></div>' +
      '<div class="pv-side"><small>التالية</small><div class="thumb-stage" id="pvNext"></div><div class="pv-notes" id="pvNotes"></div></div></div>' +
      '<footer class="pv-nav"><button class="btn btn-ghost" id="pvPrev">' + icon('chevron-right') + 'السابق</button><button class="btn btn-primary" id="pvNextBtn">التالي' + icon('chevron-left') + '</button></footer></div>';
    function draw() {
      var s = SL[cur];
      root.querySelector('#pvCur').innerHTML = renderSlide(s, cur, { thumb: true });
      var ce = root.querySelector('#pvCur .slide');
      ce.querySelectorAll('[data-step]').forEach(function (n) { n.classList.toggle('is-shown', +n.dataset.step <= step); });
      if (STEP_FX[s.type]) STEP_FX[s.type](ce, step);
      root.querySelector('#pvNext').innerHTML = cur < SL.length - 1 ? renderSlide(SL[cur + 1], cur + 1, { thumb: true }) : '<div style="display:grid;place-items:center;height:100%;color:#94A3B8">نهاية العرض</div>';
      var notes = (s.notes || '').trim();
      var stepInfo = stepsOf(cur) ? '<p class="pv-step">الخطوة ' + step + ' من ' + stepsOf(cur) + '</p>' : '';
      root.querySelector('#pvNotes').innerHTML = '<h4>' + (cur + 1) + '. ' + esc(slideTitle(s)) + '</h4>' + stepInfo + (notes ? '<p>' + esc(notes) + '</p>' : '<p class="muted">لا توجد ملاحظات لهذه الشريحة.</p>');
      root.querySelector('#pvCount').textContent = (cur + 1) + ' / ' + SL.length;
      root.querySelectorAll('.qr-card').forEach(function (c) { var b = c.querySelector('.qr-svg'); if (b) b.innerHTML = qrSvg(qrUrlFor(c.dataset.qr)); });
    }
    function send(msg) { if (bc) bc.postMessage(msg); }
    root.querySelector('#pvPrev').addEventListener('click', function () { send({ type: 'nav', dir: 'prev' }); });
    root.querySelector('#pvNextBtn').addEventListener('click', function () { send({ type: 'nav', dir: 'next' }); });
    root.querySelector('#pvReset').addEventListener('click', function () { t0 = Date.now(); });
    document.addEventListener('keydown', function (e) {
      var k = e.key;
      if (k === 'ArrowRight' || k === 'ArrowDown' || k === 'PageDown' || k === ' ' || k === 'Enter') { e.preventDefault(); send({ type: 'nav', dir: 'next' }); }
      else if (k === 'ArrowLeft' || k === 'ArrowUp' || k === 'PageUp' || k === 'Backspace') { e.preventDefault(); send({ type: 'nav', dir: 'prev' }); }
    });
    setInterval(function () {
      var s = Math.floor((Date.now() - t0) / 1000);
      root.querySelector('#pvTimer').textContent = String(Math.floor(s / 60)).padStart(2, '0') + ':' + String(s % 60).padStart(2, '0');
    }, 1000);
    if (bc) {
      bc.onmessage = function (m) { var d = m.data || {}; if (d.type === 'state') { cur = d.i; step = d.step; if (d.session) st.session = d.session; draw(); } };
      send({ type: 'hello' });
    } else {
      root.querySelector('#pvNotes').innerHTML = '<p>المتصفح لا يدعم المزامنة بين النوافذ.</p>';
    }
    draw();
  }

  document.addEventListener('DOMContentLoaded', function () {
    if (VIEW === 'presenter') initPresenterView(); else initDeck();
  });

  window.DECK = { show: show, next: next, prev: prev, state: st, setSession: setSession, setRead: setRead, slides: SL };
})();
