/* ============================================================
   بيانات تجريبية للمعاينة (الوضع التجريبي فقط — لا تُرسل لأي مكان)
   ============================================================ */
(function () {
  'use strict';
  var NAMES = ['محمد', 'أحمد', 'عبدالله', 'خالد', 'فهد', 'سلطان', 'ناصر', 'تركي', 'فيصل', 'ماجد', 'بدر', 'يوسف', 'عمر', 'سعود', 'نواف', 'مشعل', 'راكان', 'هند', 'نورة', 'ريم', 'سارة', 'عبدالرحمن', 'إبراهيم', 'صالح'];
  var TRAITS = ['التأثير', 'الثقة', 'الرؤية', 'التواصل', 'القدوة', 'المسؤولية', 'التحفيز', 'الإنصات', 'المبادرة', 'التعاون', 'الحكمة', 'الإلهام', 'الشجاعة', 'الوضوح', 'التمكين', 'المرونة'];
  var VALUES = ['الأمانة', 'الالتزام', 'العدل', 'الاحترام', 'الإتقان', 'الصدق', 'الوفاء', 'التواضع', 'الشفافية', 'المبادرة', 'الانضباط'];
  var WALL = {
    passion: ['أن أرى فريقي يكبر ويتعلّم كل يوم — وهذا يدفعني لأخصص وقتاً أسبوعياً للتطوير.', 'خدمة المستفيد بكرامة؛ وأريد أن يشعر كل فرد في فريقي أن عمله يصنع فرقاً حقيقياً.', 'تحويل الأفكار إلى مبادرات ملموسة، وأن نصبح الجمعية الأولى في منطقتنا.', 'الأثر المستدام: أن يبقى العمل ناجحاً حتى لو غبت.'],
    tweet: ['الحبل لا يخيف من قرر أن يمشي.. التحدي يبدأ بخطوة صغيرة اليوم.', 'كل مألوف كان يوماً تحدياً لأحدهم. #تحدي_طرق_العمل', 'لن أنتظر الفرصة.. سأصنعها ولو بمكسب صغير كل أسبوع.', 'الخوف من الفشل أكبر من الفشل نفسه.'],
    empower: ['قائدي فوّضني بقرار كامل في مشروع ودعمني أمام الإدارة حين أخطأت.', 'طلب رأيي في اجتماع مهم ثم أخذ به وذكر اسمي أمام الجميع.', 'أعطاني مساحة لأجرّب طريقتي، وراجع معي النتائج دون لوم.'],
    commit: ['سأبدأ كل اجتماع بالتأكيد على قيمتين نتفق عليهما.', 'أشكر شخصاً من فريقي يومياً على عمل محدد.', 'أطلب ملاحظة صريحة عن أدائي بعد كل اجتماع.']
  };
  function pick(a) { return a[Math.floor(Math.random() * a.length)]; }
  function wpick(weights) { var s = weights.reduce(function (a, b) { return a + b; }, 0), r = Math.random() * s; for (var i = 0; i < weights.length; i++) { r -= weights[i]; if (r <= 0) return i; } return weights.length - 1; }
  function clamp(v, a, b) { return Math.max(a, Math.min(b, v)); }

  window.KIT_DEMO = {
    fill: function (session) {
      var API = window.API, KIT = window.KIT, P = KIT.PRACTICES;
      var n = 22;
      for (var i = 0; i < n; i++) {
        var u = 'demo' + i + API.rand(4);
        var name = NAMES[i % NAMES.length];
        API.localSubmitRaw(session, 'join', { u: u, n: name });
        API.localSubmitRaw(session, 'traits', { u: u, w: [pick(TRAITS), pick(TRAITS)].filter(function (v, k, a) { return a.indexOf(v) === k; }) });
        API.localSubmitRaw(session, 'values', { u: u, w: [pick(VALUES)] });
        var bias = [1.2, 0.2, -0.6, 0.8, 0.4];
        var items = [];
        for (var q = 0; q < 30; q++) items.push(clamp(Math.round(6 + bias[q % 5] + (Math.random() * 3 - 1.5)), 1, 10));
        var s = P.map(function (p) { return p.items.reduce(function (a, it) { return a + items[it - 1]; }, 0); });
        var hi = s.indexOf(Math.max.apply(null, s)), lo = s.indexOf(Math.min.apply(null, s));
        API.localSubmitRaw(session, 'lpi', { u: u, s: s, hi: hi, lo: lo });
        API.localSubmitRaw(session, 'recognition', { u: u, c: wpick([5, 3, 2, 4, 3]) });
        API.localSubmitRaw(session, 'phrase', { u: u, c: wpick([1, 2, 1, 3, 2, 1, 2, 1, 2, 2, 3, 1, 1, 4, 3]) });
        API.localSubmitRaw(session, 'stage', { u: u, c: wpick([2, 4, 3, 2, 1]) });
        var a = KIT.TEAM_CHECK.map(function (t, k) { return clamp(Math.round(2 + (k % 4 === 0 ? 0.6 : -0.3) + (Math.random() * 1.6 - 0.8)), 0, 3); });
        API.localSubmitRaw(session, 'teamcheck', { u: u, a: a });
        API.localSubmitRaw(session, 'rating', { u: u, r: wpick([0, 0, 1, 5, 9]) + 1, c: i % 6 === 0 ? 'جلسة ثرية والأنشطة ممتعة' : '' });
      }
      ['passion', 'tweet', 'empower', 'commit'].forEach(function (act) {
        WALL[act].forEach(function (t, k) { API.localSubmitRaw(session, act, { u: 'demow' + k + act, t: t, n: k % 3 === 2 ? null : NAMES[(k * 5 + 3) % NAMES.length] }); });
      });
    }
  };
})();
