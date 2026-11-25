/* ============================================================
   عرض النتائج المباشرة: سحابة كلمات، جدار مشاركات، أشرطة، رادار…
   ============================================================ */
(function () {
  'use strict';
  var KIT = window.KIT;
  var P = KIT.PRACTICES;

  function esc(s) {
    return String(s == null ? '' : s).replace(/[&<>"']/g, function (c) {
      return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c];
    });
  }
  function hash(s) { var h = 0; s = String(s); for (var i = 0; i < s.length; i++) { h = (h * 31 + s.charCodeAt(i)) | 0; } return Math.abs(h); }
  function fmt(n, d) { return Number(n).toLocaleString('en-US', { maximumFractionDigits: d == null ? 0 : d, minimumFractionDigits: d == null ? 0 : d }); }
  function lastBy(items, keyFn) {
    var map = {}, order = [];
    items.forEach(function (it) {
      var k = keyFn(it);
      if (k == null || k === '') { order.push(it); return; }
      if (!(k in map)) order.push(k);
      map[k] = it;
    });
    return order.map(function (k) { return typeof k === 'string' ? map[k] : k; });
  }
  function uniq(items) { return lastBy(items, function (it) { return it.pub && it.pub.u; }); }
  function itemKey(it) { return (it.ts || '') + ':' + ((it.pub && it.pub.u) || ''); }

  /* تطبيع الكلمات العربية للعدّ */
  function normWord(w) {
    return String(w || '')
      .replace(/[ً-ٰٟـ]/g, '')
      .replace(/[أإآٱ]/g, 'ا')
      .replace(/ى(?=\s|$)/g, 'ي')
      .replace(/ة(?=\s|$)/g, 'ه')
      .replace(/[.,،؛;:!؟?"'«»()\[\]{}\-_/\\|*#@~`^%$+=<>]/g, ' ')
      .replace(/^ال(?=\S{3,})/, '')
      .replace(/\s+/g, ' ')
      .trim()
      .toLowerCase();
  }

  function emptyState(el, msg) {
    if (el.querySelector('.viz-empty')) return;
    el.innerHTML = '<div class="viz-empty"><span class="dots"><i></i><i></i><i></i></span><span>' + esc(msg || 'بانتظار المشاركات…') + '</span></div>';
  }
  function clearEmpty(el) { var e = el.querySelector('.viz-empty'); if (e) e.remove(); }

  /* FLIP لتحريك العناصر بسلاسة عند إعادة الترتيب */
  function flip(container, selector, mutate) {
    var before = {};
    container.querySelectorAll(selector).forEach(function (n) { before[n.dataset.k] = n.getBoundingClientRect(); });
    mutate();
    container.querySelectorAll(selector).forEach(function (n) {
      var b = before[n.dataset.k];
      if (!b) return;
      var a = n.getBoundingClientRect();
      var dx = b.left - a.left, dy = b.top - a.top;
      if (!dx && !dy) return;
      n.style.transition = 'none';
      n.style.transform = 'translate(' + dx + 'px,' + dy + 'px)';
      requestAnimationFrame(function () {
        requestAnimationFrame(function () { n.style.transition = ''; n.style.transform = ''; });
      });
    });
  }

  var WORD_COLORS_DARK = ['#FFFFFF', '#8EC5F0', '#FFC94D', '#7FE0C0', '#FF9C8F', '#F49AC4', '#BFE0FF'];
  var WORD_COLORS_LIGHT = ['#0A1F44', '#005494', '#E08E0B', '#13906C', '#D9483A', '#C23A79', '#2F80D1'];

  var V = {};

  /* ---------- سحابة الكلمات ---------- */
  V.wordcloud = function (el, items, opts) {
    opts = opts || {};
    var hidden = opts.hidden || {};
    var counts = {}, forms = {};
    items.forEach(function (it) {
      var ws = (it.pub && it.pub.w) || [];
      ws.forEach(function (w) {
        var k = normWord(w);
        if (!k || hidden[k]) return;
        counts[k] = (counts[k] || 0) + 1;
        forms[k] = forms[k] || {};
        var f = String(w).trim();
        forms[k][f] = (forms[k][f] || 0) + 1;
      });
    });
    var arr = Object.keys(counts).map(function (k) {
      var fs = forms[k], best = Object.keys(fs).sort(function (a, b) { return fs[b] - fs[a]; })[0];
      return { k: k, n: counts[k], t: best };
    }).sort(function (a, b) { return b.n - a.n || a.k.localeCompare(b.k); }).slice(0, opts.max || 40);
    if (!arr.length) return emptyState(el, 'بانتظار الكلمات…');
    clearEmpty(el);
    var box = el.querySelector('.wc');
    if (!box) { box = document.createElement('div'); box.className = 'wc'; el.appendChild(box); }
    var ordered = [];
    arr.forEach(function (x, i) { if (i % 2 === 0) ordered.push(x); else ordered.unshift(x); });
    var max = arr[0].n, min = arr[arr.length - 1].n;
    var boost = arr.length < 8 ? 1.55 : (arr.length < 16 ? 1.25 : 1);
    var minS = (opts.minSize || 1.1) * boost, maxS = (opts.maxSize || 4.2) * boost;
    var colors = opts.light ? WORD_COLORS_LIGHT : WORD_COLORS_DARK;
    flip(box, '.wc-word', function () {
      var existing = {};
      box.querySelectorAll('.wc-word').forEach(function (s) { existing[s.dataset.k] = s; });
      ordered.forEach(function (x) {
        var s = existing[x.k];
        if (!s) {
          s = document.createElement('span');
          s.className = 'wc-word is-new';
          s.dataset.k = x.k;
          setTimeout(function () { s.classList.remove('is-new'); }, 900);
          if (opts.onHide) s.addEventListener('click', function () { opts.onHide(x.k); s.remove(); });
        }
        var t = max === min ? 0.55 : (x.n - min) / (max - min);
        s.style.fontSize = (minS + (maxS - minS) * Math.sqrt(t)).toFixed(2) + 'em';
        s.style.color = colors[hash(x.k) % colors.length];
        s.style.fontWeight = t > 0.5 ? 700 : 600;
        s.textContent = x.t;
        s.title = x.n + ' مشاركة';
        box.appendChild(s);
        delete existing[x.k];
      });
      Object.keys(existing).forEach(function (k) { existing[k].remove(); });
    });
  };

  /* ---------- جدار المشاركات ---------- */
  V.wall = function (el, items, opts) {
    opts = opts || {};
    var hidden = opts.hidden || {};
    var list = items.filter(function (it) { return it.pub && it.pub.t && !hidden[itemKey(it)]; }).slice(-(opts.max || 30)).reverse();
    if (!list.length) return emptyState(el, 'بانتظار المشاركات…');
    clearEmpty(el);
    var box = el.querySelector('.wall');
    if (!box) { box = document.createElement('div'); box.className = 'wall' + (opts.variant === 'tweet' ? ' wall--tweet' : ''); el.appendChild(box); }
    var existing = {};
    box.querySelectorAll('.wall-card').forEach(function (c) { existing[c.dataset.k] = c; });
    var frag = document.createDocumentFragment();
    list.forEach(function (it, i) {
      var k = itemKey(it);
      var c = existing[k];
      if (!c) {
        c = document.createElement('article');
        c.className = 'wall-card is-new';
        c.dataset.k = k;
        var name = it.pub.n ? esc(it.pub.n) : 'مشارك';
        var initial = it.pub.n ? esc(String(it.pub.n).trim().charAt(0)) : window.icon('user-round');
        if (opts.variant === 'tweet') {
          c.innerHTML = '<header><span class="av">' + initial + '</span><span class="nm">' + name + '</span><span class="tw">' + window.icon('feather') + '</span></header><p>' + esc(it.pub.t) + '</p>';
        } else {
          c.innerHTML = '<p>' + esc(it.pub.t) + '</p><footer><span class="av">' + initial + '</span>' + name + '</footer>';
        }
        if (opts.onHide) c.addEventListener('click', function () { opts.onHide(k); c.remove(); });
        setTimeout(function () { c.classList.remove('is-new'); }, 1400);
      }
      c.style.setProperty('--i', i);
      frag.appendChild(c);
      delete existing[k];
    });
    Object.keys(existing).forEach(function (k) { existing[k].remove(); });
    box.innerHTML = '';
    box.appendChild(frag);
  };

  /* ---------- أشرطة التصويت ---------- */
  V.bars = function (el, items, opts) {
    opts = opts || {};
    var options = opts.options || [];
    var votes = uniq(items).filter(function (it) { return it.pub && typeof it.pub.c === 'number'; });
    var counts = options.map(function () { return 0; });
    votes.forEach(function (it) { if (it.pub.c >= 0 && it.pub.c < counts.length) counts[it.pub.c]++; });
    var total = votes.length;
    if (!total) return emptyState(el, 'بانتظار الأصوات…');
    clearEmpty(el);
    var rows = options.map(function (t, i) { return { i: i, t: t, n: counts[i] }; });
    if (opts.sort) rows.sort(function (a, b) { return b.n - a.n || a.i - b.i; });
    if (opts.top) rows = rows.slice(0, opts.top);
    var max = Math.max.apply(null, rows.map(function (r) { return r.n; }).concat([1]));
    var box = el.querySelector('.bars');
    if (!box) { box = document.createElement('div'); box.className = 'bars'; el.appendChild(box); }
    flip(box, '.bar', function () {
      var existing = {};
      box.querySelectorAll('.bar').forEach(function (b) { existing[b.dataset.k] = b; });
      rows.forEach(function (r, idx) {
        var k = String(r.i);
        var b = existing[k];
        if (!b) {
          b = document.createElement('div');
          b.className = 'bar';
          b.dataset.k = k;
          b.innerHTML = '<div class="bar-label"></div><div class="bar-track"><div class="bar-fill"></div></div><div class="bar-val"><b></b><small></small></div>';
        }
        var color = opts.colors ? opts.colors[r.i % opts.colors.length] : (opts.color || 'var(--amber)');
        b.style.setProperty('--c', color);
        b.querySelector('.bar-label').textContent = r.t;
        b.querySelector('.bar-fill').style.width = (r.n / max * 100).toFixed(1) + '%';
        b.querySelector('.bar-val b').textContent = fmt(Math.round(r.n / total * 100)) + '%';
        b.querySelector('.bar-val small').textContent = fmt(r.n);
        b.classList.toggle('is-top', idx === 0 && r.n > 0);
        box.appendChild(b);
        delete existing[k];
      });
      Object.keys(existing).forEach(function (k) { existing[k].remove(); });
    });
    var tot = el.querySelector('.viz-total');
    if (!tot) { tot = document.createElement('div'); tot.className = 'viz-total'; el.appendChild(tot); }
    tot.innerHTML = window.icon('users') + '<span>' + fmt(total) + ' صوت</span>';
  };

  function splitLabel(t) {
    var w = String(t).split(' ');
    if (w.length < 2) return [t];
    var best = 1, bd = 1e9;
    for (var k = 1; k < w.length; k++) {
      var d = Math.abs(w.slice(0, k).join(' ').length - w.slice(k).join(' ').length);
      if (d < bd) { bd = d; best = k; }
    }
    return [w.slice(0, best).join(' '), w.slice(best).join(' ')];
  }

  /* ---------- رادار ---------- */
  V.radar = function (values, opts) {
    opts = opts || {};
    var max = opts.max || 60, min = opts.min == null ? 0 : opts.min;
    var cx = 50, cy = 52, R = opts.r || 34;
    var n = values.length;
    function pt(i, v) {
      var a = -Math.PI / 2 + (2 * Math.PI * i / n);
      var rr = R * Math.max(0, Math.min(1, (v - min) / (max - min)));
      return [cx + rr * Math.cos(a), cy + rr * Math.sin(a)];
    }
    var s = '<svg class="radar" viewBox="-15 0 130 100" role="img" aria-label="' + esc(opts.label || 'رادار الممارسات') + '">';
    [0.25, 0.5, 0.75, 1].forEach(function (f) {
      var ring = [];
      for (var i = 0; i < n; i++) ring.push(pt(i, min + (max - min) * f).map(function (x) { return x.toFixed(2); }).join(','));
      s += '<polygon class="radar-ring" points="' + ring.join(' ') + '"/>';
    });
    for (var i = 0; i < n; i++) {
      var e = pt(i, max);
      s += '<line class="radar-axis" x1="' + cx + '" y1="' + cy + '" x2="' + e[0].toFixed(2) + '" y2="' + e[1].toFixed(2) + '"/>';
    }
    var poly = values.map(function (v, i) { return pt(i, v).map(function (x) { return x.toFixed(2); }).join(','); }).join(' ');
    s += '<polygon class="radar-area" points="' + poly + '"/>';
    values.forEach(function (v, i) {
      var p = pt(i, v);
      s += '<circle class="radar-dot" cx="' + p[0].toFixed(2) + '" cy="' + p[1].toFixed(2) + '" r="1.6" style="fill:' + P[i].color + '"/>';
    });
    if (opts.labels !== false) {
      for (var j = 0; j < n; j++) {
        var a = -Math.PI / 2 + (2 * Math.PI * j / n);
        var ca = Math.cos(a), sa = Math.sin(a);
        var lx = cx + (R + 6) * ca, ly = cy + (R + 6) * sa;
        var anchor = Math.abs(ca) < 0.2 ? 'middle' : (ca > 0 ? 'start' : 'end');
        var lines = splitLabel(P[j].name), nl = lines.length;
        var firstDy = sa < -0.6 ? (-(nl - 1) * 1.15) + 'em' : (sa > 0.6 ? '0.95em' : (0.35 - (nl - 1) * 0.575).toFixed(3) + 'em');
        s += '<text class="radar-label" direction="ltr" x="' + lx.toFixed(2) + '" y="' + ly.toFixed(2) + '" text-anchor="' + anchor + '" style="fill:' + (opts.labelColor || P[j].color) + '">' +
          lines.map(function (l, k) { return '<tspan x="' + lx.toFixed(2) + '" dy="' + (k === 0 ? firstDy : '1.15em') + '">' + esc(l) + '</tspan>'; }).join('') + '</text>';
      }
    }
    s += '</svg>';
    return s;
  };

  function lpiStats(items) {
    var list = uniq(items).filter(function (it) { return it.pub && Array.isArray(it.pub.s) && it.pub.s.length === 5; });
    var n = list.length;
    var avg = [0, 0, 0, 0, 0], hi = [0, 0, 0, 0, 0], lo = [0, 0, 0, 0, 0];
    list.forEach(function (it) {
      it.pub.s.forEach(function (v, i) { avg[i] += Number(v) || 0; });
      if (typeof it.pub.hi === 'number') hi[it.pub.hi]++;
      if (typeof it.pub.lo === 'number') lo[it.pub.lo]++;
    });
    if (n) avg = avg.map(function (v) { return v / n; });
    return { n: n, avg: avg, hi: hi, lo: lo };
  }
  V.lpiStats = lpiStats;
  function argmax(a) { var m = 0; a.forEach(function (v, i) { if (v > a[m]) m = i; }); return m; }

  /* ---------- نتائج المقياس للمجموعة ---------- */
  V.lpiGroup = function (el, items) {
    var st = lpiStats(items);
    if (!st.n) return emptyState(el, 'بانتظار إجابات المقياس…');
    clearEmpty(el);
    var order = [0, 1, 2, 3, 4].sort(function (a, b) { return st.avg[b] - st.avg[a]; });
    var hiI = argmax(st.hi), loI = argmax(st.lo);
    var html = '<div class="lpig">' +
      '<div class="lpig-radar">' + V.radar(st.avg, { min: 6, max: 60, label: 'متوسط المجموعة' }) + '</div>' +
      '<div class="lpig-side">' +
      '<div class="lpig-bars">' + order.map(function (i) {
        var v = st.avg[i];
        return '<div class="lpig-row" style="--c:' + P[i].color + '"><span class="lpig-name">' + window.icon(P[i].icon) + esc(P[i].name) + '</span>' +
          '<span class="lpig-track"><i style="width:' + ((v - 6) / 54 * 100).toFixed(1) + '%"></i></span><b>' + fmt(v, 1) + '</b></div>';
      }).join('') + '</div>' +
      '<div class="lpig-modes">' +
      '<div class="lpig-mode" style="--c:' + P[hiI].color + '"><small>الأكثر شيوعاً كنمط أعلى</small><b>' + esc(P[hiI].name) + '</b><span>' + fmt(st.hi[hiI]) + ' من ' + fmt(st.n) + '</span></div>' +
      '<div class="lpig-mode" style="--c:' + P[loI].color + '"><small>الأكثر شيوعاً كنمط أقل</small><b>' + esc(P[loI].name) + '</b><span>' + fmt(st.lo[loI]) + ' من ' + fmt(st.n) + '</span></div>' +
      '</div></div></div>';
    el.innerHTML = html;
  };

  /* ---------- متوسط المجموعة في ممارسة واحدة ---------- */
  V.practiceAvg = function (el, items, opts) {
    var i = (opts && opts.p ? opts.p : 1) - 1;
    var st = lpiStats(items);
    if (!st.n) {
      el.innerHTML = '<div class="pavg pavg--empty">' + window.icon('radar') + '<span>شارك في مقياس LPI ليظهر هنا متوسط المجموعة في هذه الممارسة</span></div>';
      return;
    }
    var v = st.avg[i], pct = (v - 6) / 54;
    var rank = [0, 1, 2, 3, 4].sort(function (a, b) { return st.avg[b] - st.avg[a]; }).indexOf(i) + 1;
    var C = 2 * Math.PI * 40;
    el.innerHTML = '<div class="pavg">' +
      '<svg viewBox="0 0 100 100" class="pavg-ring"><circle cx="50" cy="50" r="40" class="pavg-bg"/>' +
      '<circle cx="50" cy="50" r="40" class="pavg-fg" style="stroke:' + P[i].color + ';stroke-dasharray:' + (C * pct).toFixed(1) + ' ' + C.toFixed(1) + '"/></svg>' +
      '<div class="pavg-num"><b>' + fmt(v, 1) + '</b><small>من 60</small></div>' +
      '<div class="pavg-meta"><span>متوسط المجموعة</span><span>الترتيب ' + fmt(rank) + ' من 5 · ' + fmt(st.n) + ' مشارك</span></div>' +
      '</div>';
  };

  /* ---------- نشاط فريق العمل (12 عبارة) ---------- */
  V.checklist = function (el, items, opts) {
    var statements = (opts && opts.statements) || KIT.TEAM_CHECK;
    var list = uniq(items).filter(function (it) { return it.pub && Array.isArray(it.pub.a); });
    if (!list.length) return emptyState(el, 'بانتظار الإجابات…');
    clearEmpty(el);
    var sums = statements.map(function () { return 0; });
    list.forEach(function (it) { it.pub.a.forEach(function (v, i) { if (i < sums.length) sums[i] += Number(v) || 0; }); });
    var avg = sums.map(function (s) { return s / list.length; });
    var total = avg.reduce(function (a, b) { return a + b; }, 0) / (3 * statements.length) * 100;
    var sorted = avg.map(function (v, i) { return i; }).sort(function (a, b) { return avg[b] - avg[a]; });
    var top = sorted.slice(0, 2), bottom = sorted.slice(-2);
    el.innerHTML = '<div class="chk">' +
      '<div class="chk-score"><b>' + fmt(total) + '%</b><span>متوسط المجموعة</span><small>' + fmt(list.length) + ' مشارك</small></div>' +
      '<div class="chk-rows">' + statements.map(function (t, i) {
        var cls = top.indexOf(i) >= 0 ? ' is-top' : (bottom.indexOf(i) >= 0 ? ' is-low' : '');
        return '<div class="chk-row' + cls + '"><span class="chk-n">' + fmt(i + 1) + '</span><span class="chk-t">' + esc(t.replace(/^هل\s+/, '').replace(/؟$/, '')) + '</span>' +
          '<span class="chk-track"><i style="width:' + (avg[i] / 3 * 100).toFixed(1) + '%"></i></span><b>' + fmt(avg[i], 1) + '</b></div>';
      }).join('') + '</div></div>';
  };

  /* ---------- التقييم ---------- */
  V.rating = function (el, items) {
    var list = uniq(items).filter(function (it) { return it.pub && it.pub.r >= 1 && it.pub.r <= 5; });
    if (!list.length) return emptyState(el, 'بانتظار التقييمات…');
    clearEmpty(el);
    var dist = [0, 0, 0, 0, 0], sum = 0;
    list.forEach(function (it) { dist[it.pub.r - 1]++; sum += it.pub.r; });
    var avg = sum / list.length, max = Math.max.apply(null, dist.concat([1]));
    var stars = '';
    for (var s = 1; s <= 5; s++) {
      var fill = Math.max(0, Math.min(1, avg - (s - 1)));
      stars += '<span class="st">' + window.icon('star') + '<span class="st-fill" style="width:' + (fill * 100).toFixed(0) + '%">' + window.icon('star') + '</span></span>';
    }
    var comments = items.filter(function (it) { return it.pub && it.pub.c && String(it.pub.c).trim(); }).slice(-4).reverse();
    el.innerHTML = '<div class="rate">' +
      '<div class="rate-main"><b>' + fmt(avg, 1) + '</b><div class="rate-stars">' + stars + '</div><small>' + fmt(list.length) + ' تقييم</small></div>' +
      '<div class="rate-dist">' + [5, 4, 3, 2, 1].map(function (r) {
        return '<div class="rate-row"><span>' + r + ' ' + window.icon('star') + '</span><span class="rate-track"><i style="width:' + (dist[r - 1] / max * 100).toFixed(1) + '%"></i></span><b>' + fmt(dist[r - 1]) + '</b></div>';
      }).join('') + '</div>' +
      (comments.length ? '<div class="rate-comments">' + comments.map(function (it) { return '<q>' + esc(it.pub.c) + '</q>'; }).join('') + '</div>' : '') +
      '</div>';
  };

  /* ---------- المنضمّون ---------- */
  V.join = function (el, items, opts) {
    var list = uniq(items).filter(function (it) { return it.pub; });
    var n = list.length;
    var box = el.querySelector('.joined');
    if (!box) {
      el.innerHTML = '<div class="joined"><div class="joined-count"><b>0</b><span>مشارك انضم</span></div><div class="joined-names"></div></div>';
      box = el.querySelector('.joined');
    }
    box.querySelector('.joined-count b').textContent = fmt(n);
    var names = box.querySelector('.joined-names');
    var existing = {};
    names.querySelectorAll('.chip').forEach(function (c) { existing[c.dataset.k] = c; });
    var show = list.slice(-(opts && opts.max || 40)).reverse();
    var frag = document.createDocumentFragment();
    show.forEach(function (it) {
      var k = it.pub.u || itemKey(it);
      var c = existing[k];
      if (!c) {
        c = document.createElement('span');
        c.className = 'chip is-new';
        c.dataset.k = k;
        c.textContent = it.pub.n || 'مشارك';
        setTimeout(function () { c.classList.remove('is-new'); }, 1200);
      }
      frag.appendChild(c);
      delete existing[k];
    });
    Object.keys(existing).forEach(function (k) { existing[k].remove(); });
    names.innerHTML = '';
    names.appendChild(frag);
    if (!n) names.innerHTML = '<span class="joined-wait">بانتظار أول مشارك…</span>';
  };

  V.count = function (el, items) {
    el.textContent = fmt(uniq(items).length);
  };

  V.esc = esc;
  V.fmt = fmt;
  V.normWord = normWord;
  V.uniq = uniq;
  V.itemKey = itemKey;
  window.VIZ = V;
})();
