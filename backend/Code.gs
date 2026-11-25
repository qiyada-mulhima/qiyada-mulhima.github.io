/**
 * ============================================================
 *  حقيبة «القيادة الملهمة» التفاعلية — خادم المشاركات
 *  Google Apps Script مربوط بجدول Google Sheet
 * ============================================================
 *  طريقة التركيب (التفاصيل في setup.html):
 *   1) أنشئ Google Sheet جديد ← الإضافات (Extensions) ← Apps Script
 *   2) احذف الكود الموجود والصق هذا الملف كاملاً
 *   3) غيّر الرقم السري للمقدّم في السطر التالي
 *   4) نشر (Deploy) ← نشر جديد ← تطبيق ويب (Web app)
 *      التنفيذ باسم: أنا (Me) — من لديه الوصول: أي شخص (Anyone)
 *   5) انسخ رابط تطبيق الويب (ينتهي بـ /exec) وضعه في config.js
 *
 *  كل نشاط يُحفظ في ورقة (تبويب) مستقلة داخل الجدول.
 *  العمود «_public» مخفي: يحوي فقط ما يجوز عرضه على الشاشة.
 *  البيانات الشخصية (الاسم والجهة) لا تخرج من الجدول أبداً.
 * ============================================================
 */

// الرقم السري لوضع المقدّم (يجعل جوالات المشاركين تتبع الشريحة المعروضة)
// اكتب رقماً سرياً بين علامتي التنصيص، مثال: '7391' — إذا تركته فارغاً يتعطل وضع المقدّم فقط
var PRESENTER_PIN = '';

// اتركه فارغاً إذا كان السكربت مفتوحاً من داخل الجدول (Extensions ← Apps Script)
var SPREADSHEET_ID = '';

var PUB = '_public';
var FIXED = ['الوقت', 'الجلسة', 'المعرّف'];

function doGet(e) {
  var p = (e && e.parameter) ? copy_(e.parameter) : {};
  if (p.payload) {
    try { var extra = JSON.parse(p.payload); for (var k in extra) if (has_(extra, k)) p[k] = extra[k]; } catch (err) { /* ignore */ }
  }
  return respond_(route_(p));
}

function doPost(e) {
  var p = {};
  try { p = JSON.parse((e && e.postData && e.postData.contents) || '{}') || {}; } catch (err) { p = {}; }
  if (e && e.parameter) { for (var k in e.parameter) if (has_(e.parameter, k) && !has_(p, k)) p[k] = e.parameter[k]; }
  return respond_(route_(p));
}

function route_(p) {
  try {
    switch (String(p.action || '')) {
      case '':
      case 'ping': return { ok: true, service: 'inspiring-leadership-kit', time: Date.now(), sheets: ss_().getSheets().length };
      case 'submit': return submit_(p);
      case 'results': return results_(p);
      case 'state': return getState_(p);
      case 'setState': return setState_(p);
      case 'checkPin': return pinOk_(p.pin) ? { ok: true, valid: true } : { ok: true, valid: false, reason: String(PRESENTER_PIN || '').trim() ? 'wrong' : 'pin_not_set' };
      default: return { ok: false, error: 'unknown_action' };
    }
  } catch (err) {
    return { ok: false, error: String((err && err.message) || err) };
  }
}

function respond_(obj) {
  return ContentService.createTextOutput(JSON.stringify(obj)).setMimeType(ContentService.MimeType.JSON);
}

/* ---------- حفظ مشاركة ---------- */
function submit_(p) {
  var session = cleanSession_(p.session);
  var id = cleanId_(p.activity);
  if (!id) return { ok: false, error: 'bad_activity' };
  var data = (p.data && typeof p.data === 'object') ? p.data : {};
  var pub = (p.pub && typeof p.pub === 'object') ? p.pub : {};
  var pubStr = JSON.stringify(pub);
  if (pubStr.length > 6000) return { ok: false, error: 'too_large' };

  var clean = {}, keys = [];
  Object.keys(data).slice(0, 60).forEach(function (k) {
    var label = cleanLabel_(k);
    if (!label || has_(clean, label)) return;
    var v = data[k];
    clean[label] = (typeof v === 'number' && isFinite(v)) ? v : cleanText_(v, 2000);
    keys.push(label);
  });

  var lock = LockService.getScriptLock();
  lock.waitLock(25000);
  try {
    var sh = sheetFor_(id, p.sheet, true);
    var lastCol = sh.getLastColumn();
    var header = sh.getRange(1, 1, 1, lastCol).getValues()[0];
    var pubCol = header.indexOf(PUB) + 1;
    if (pubCol < 1) { pubCol = lastCol + 1; sh.getRange(1, pubCol).setValue(PUB); header.push(PUB); }
    var added = 0;
    keys.forEach(function (k) {
      if (header.indexOf(k) !== -1) return;
      sh.insertColumnBefore(pubCol);
      var cell = sh.getRange(1, pubCol);
      cell.setValue(k);
      styleHeader_(cell);
      try { sh.showColumns(pubCol); } catch (e) { /* ignore */ }
      header.splice(pubCol - 1, 0, k);
      pubCol++;
      added++;
    });
    if (added) { try { sh.hideColumns(pubCol); } catch (e) { /* ignore */ } }
    var row = header.map(function (h) {
      if (h === 'الوقت') return new Date();
      if (h === 'الجلسة') return session;
      if (h === 'المعرّف') return cleanText_(p.pid, 40);
      if (h === PUB) return pubStr;
      return has_(clean, h) ? clean[h] : '';
    });
    sh.appendRow(row);
    return { ok: true };
  } finally {
    lock.releaseLock();
  }
}

/* ---------- النتائج العامة (للشاشة) ---------- */
function results_(p) {
  var session = cleanSession_(p.session);
  var id = cleanId_(p.activity);
  var sh = id ? sheetFor_(id, null, false) : null;
  if (!sh) return { ok: true, items: [], next: 1 };
  var last = sh.getLastRow();
  var since = parseInt(p.since, 10);
  var reset = false;
  if (!(since >= 1)) since = 1;
  if (since > last) { since = 1; reset = true; }
  if (since >= last) return { ok: true, items: [], next: last, reset: reset };
  var lastCol = sh.getLastColumn();
  var header = sh.getRange(1, 1, 1, lastCol).getValues()[0];
  var pubI = header.indexOf(PUB), sesI = header.indexOf('الجلسة'), tsI = header.indexOf('الوقت');
  if (pubI < 0 || sesI < 0) return { ok: true, items: [], next: last, reset: reset };
  var start = since + 1, MAX = 1500;
  if (last - start + 1 > MAX) start = last - MAX + 1;
  var rows = sh.getRange(start, 1, last - start + 1, lastCol).getValues();
  var items = [];
  rows.forEach(function (r) {
    if (String(r[sesI]) !== session) return;
    var pub = null;
    try { pub = JSON.parse(r[pubI] || 'null'); } catch (e) { pub = null; }
    if (!pub || typeof pub !== 'object') return;
    var ts = (r[tsI] instanceof Date) ? r[tsI].getTime() : 0;
    items.push({ ts: ts, pub: pub });
  });
  return { ok: true, items: items, next: last, reset: reset };
}

/* ---------- حالة العرض (أي نشاط على الشاشة الآن) ---------- */
function getState_(p) {
  var session = cleanSession_(p.session);
  var k = 'st:' + session;
  var cache = CacheService.getScriptCache();
  var v = cache.get(k);
  if (v === null || v === undefined) {
    v = PropertiesService.getScriptProperties().getProperty(k) || 'null';
    cache.put(k, v, 30);
  }
  var state = null;
  try { state = JSON.parse(v); } catch (e) { state = null; }
  return { ok: true, state: state };
}

function setState_(p) {
  if (!pinOk_(p.pin)) return { ok: false, error: 'bad_pin' };
  var session = cleanSession_(p.session);
  var s = (p.state && typeof p.state === 'object') ? p.state : {};
  var state = { i: Math.max(0, parseInt(s.i, 10) || 0), a: s.a ? (cleanId_(s.a) || null) : null, at: Date.now() };
  var v = JSON.stringify(state);
  PropertiesService.getScriptProperties().setProperty('st:' + session, v);
  CacheService.getScriptCache().put('st:' + session, v, 30);
  return { ok: true, state: state };
}

/* ---------- أدوات ---------- */
function ss_() {
  return SPREADSHEET_ID ? SpreadsheetApp.openById(SPREADSHEET_ID) : SpreadsheetApp.getActiveSpreadsheet();
}

function sheetFor_(id, title, create) {
  var props = PropertiesService.getScriptProperties();
  var ss = ss_();
  var key = 'sheet:' + id;
  var name = props.getProperty(key);
  var sh = name ? ss.getSheetByName(name) : null;
  if (sh || !create) return sh;
  var base = cleanText_(title || id, 90).replace(/^'/, '').replace(/[\[\]\*\?\/\\:]/g, ' ').replace(/\s+/g, ' ').trim() || id;
  name = base;
  var n = 2;
  while (ss.getSheetByName(name)) { name = base + ' ' + n; n++; }
  sh = ss.insertSheet(name);
  var hdr = FIXED.concat([PUB]);
  sh.getRange(1, 1, 1, hdr.length).setValues([hdr]);
  styleHeader_(sh.getRange(1, 1, 1, hdr.length));
  sh.setFrozenRows(1);
  try { sh.setRightToLeft(true); } catch (e) { /* ignore */ }
  try { sh.hideColumns(hdr.length); } catch (e) { /* ignore */ }
  try { sh.setColumnWidth(1, 150); } catch (e) { /* ignore */ }
  props.setProperty(key, name);
  return sh;
}

function styleHeader_(range) {
  try {
    range.setFontWeight('bold').setFontColor('#FFFFFF').setBackground('#0A1F44').setWrap(true).setVerticalAlignment('middle');
  } catch (e) { /* ignore */ }
}

function cleanSession_(s) {
  s = String(s || '').toUpperCase().replace(/[^A-Z0-9_-]/g, '').slice(0, 24);
  return s || 'OPEN';
}

function cleanId_(s) {
  s = String(s || '').toLowerCase().replace(/[^a-z0-9_-]/g, '').slice(0, 32);
  return s;
}

function cleanLabel_(k) {
  var s = String(k || '').replace(/[\u0000-\u001F\u007F]/g, '').replace(/\s+/g, ' ').trim().slice(0, 60);
  if (!s || s === PUB || FIXED.indexOf(s) !== -1) return '';
  if (/^[=+\-@]/.test(s)) s = '\u200F' + s;
  return s;
}

function cleanText_(v, max) {
  if (v === null || v === undefined) return '';
  var s = String(v).replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F\u007F]/g, '').slice(0, max || 2000);
  if (/^[=+\-@]/.test(s)) s = "'" + s; // منع تنفيذ الصيغ داخل الجدول
  return s;
}

function pinOk_(pin) {
  var real = String(PRESENTER_PIN || '').trim();
  return !!real && String(pin || '').trim() === real;
}

function copy_(o) { var r = {}; for (var k in o) if (has_(o, k)) r[k] = o[k]; return r; }

function has_(o, k) { return Object.prototype.hasOwnProperty.call(o, k); }
