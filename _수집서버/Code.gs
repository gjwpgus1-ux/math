/**
 * 기출문제 검색기 — 응답 수집기 (구글 Apps Script)
 *
 * 하는 일
 *   · 앱에서 보내온 «유사문항 비교»와 «성취기준» 응답을 이 스크립트가 붙어 있는
 *     구글 시트에 한 줄씩 쌓습니다.
 *   · 앱이 시트의 내용을 다시 받아 갈 수도 있습니다. 그래야 다른 사람이 답한 것까지
 *     합쳐서 추천이 좋아집니다.
 *   · 같은 응답이 두 번 들어오면(다시 보내기 등) id로 걸러 냅니다.
 *
 * 설치는 옆의 «설치 방법.md» 를 보세요.
 */

var SHEET_CMP = '비교';
var SHEET_STD = '성취기준';
var SHEET_NEG = '유사아님';
var SHEET_REP = '오류제보';
var SHEET_CRS = '교과목';
var SHEET_DEL = '지운응답';
var SHEET_USE = '사용기록';
var MAX_BACK  = 20000;          // 앱으로 돌려보낼 최대 줄 수
var MAX_USE   = 300000;         // 통계를 낼 때 훑는 최대 줄 수
var TOP_N     = 60;             // 순위표에 넣을 개수

var HEAD_CMP = ['id','기준','왼쪽','오른쪽','선택','검증쌍',
                '점수L','점수R','글자L','글자R','익명번호','시각','받은시각'];
var HEAD_STD = ['id','문항','성취기준','기타','이웃확인','익명번호','시각','받은시각'];
var HEAD_NEG = ['id','기준문항','제외할문항','익명번호','시각','받은시각'];
var HEAD_REP = ['id','파일','시험·문항','유형','메모','처리','익명번호','시각','받은시각'];
var HEAD_CRS = ['id','문항','교과목','익명번호','시각','받은시각'];
var HEAD_DEL = ['id','지운응답id','종류','익명번호','시각','받은시각'];
/* 사용기록 — 이름·주소·IP는 담지 않는다. 익명번호는 브라우저가 만든 무작위 번호다. */
var HEAD_USE = ['id','종류','값','수','기기','익명번호','시각','받은시각'];


function sheet_(name, head) {
  var ss = SpreadsheetApp.getActiveSpreadsheet();
  var sh = ss.getSheetByName(name);
  if (!sh) {
    sh = ss.insertSheet(name);
    sh.appendRow(head);
    sh.setFrozenRows(1);
    sh.getRange(1, 1, 1, head.length).setFontWeight('bold');
  }
  return sh;
}

function idSet_(sh) {
  var n = sh.getLastRow();
  var set = {};
  if (n < 2) return set;
  var vals = sh.getRange(2, 1, n - 1, 1).getValues();
  for (var i = 0; i < vals.length; i++) set[String(vals[i][0])] = 1;
  return set;
}

function kindOf_(r) {
  if (r.t === 'std') return 'std';
  if (r.t === 'neg') return 'neg';
  if (r.t === 'rep') return 'rep';
  if (r.t === 'crs') return 'crs';
  if (r.t === 'repdone') return 'repdone';
  if (r.t === 'del') return 'del';
  if (r.t === 'use') return 'use';
  return 'cmp';
}

function rowOf_(r, now) {
  var k = kindOf_(r);
  if (k === 'std') {
    return [r.id || '', r.p || '', (r.cs || []).join(' | '), r.k || '',
            r.near || '', r.who || '', r.at || '', now];
  }
  if (k === 'neg') {
    return [r.id || '', r.a || '', r.x || '', r.who || '', r.at || '', now];
  }
  if (k === 'crs') {
    return [r.id || '', r.p || '', r.c || '', r.who || '', r.at || '', now];
  }
  if (k === 'rep') {
    return [r.id || '', r.path || '', r.label || '', r.kind || '', r.memo || '',
            r.done ? '처리완료' : '', r.who || '', r.at || '', now];
  }
  if (k === 'del') {
    return [r.id || '', r.target || '', r.kind || '', r.who || '', r.at || '', now];
  }
  if (k === 'use') {
    return [r.id || '', r.kind || '', r.val || '', r.n || 0, r.dev || '',
            r.who || '', r.at || '', now];
  }
  return [r.id || '', r.a || '', r.x || '', r.y || '', r.c || '', r.chk ? '예' : '',
          r.sx, r.sy, r.bx, r.by, r.who || '', r.at || '', now];
}

/** 오류제보의 «처리» 칸을 고친다 */
function markDone_(sh, id, done) {
  var n = sh.getLastRow();
  if (n < 2 || !id) return false;
  var vals = sh.getRange(2, 1, n - 1, 1).getValues();
  for (var i = 0; i < vals.length; i++) {
    if (String(vals[i][0]) === String(id)) {
      sh.getRange(i + 2, 6).setValue(done ? '처리완료' : '');
      return true;
    }
  }
  return false;
}

/** 지운 응답을 실제 줄에서도 없앤다 (없으면 조용히 넘어간다) */
function eraseRow_(sh, id) {
  var n = sh.getLastRow();
  if (n < 2 || !id) return false;
  var vals = sh.getRange(2, 1, n - 1, 1).getValues();
  for (var i = vals.length - 1; i >= 0; i--) {
    if (String(vals[i][0]) === String(id)) { sh.deleteRow(i + 2); return true; }
  }
  return false;
}

function doPost(e) {
  var out = { ok: false, saved: 0, skipped: 0 };
  try {
    var body = JSON.parse(e.postData.contents);
    var list = body.records || (body.length !== undefined ? body : [body]);
    var now = Utilities.formatDate(new Date(), 'Asia/Seoul', 'yyyy-MM-dd HH:mm:ss');

    var sh = { cmp: sheet_(SHEET_CMP, HEAD_CMP), std: sheet_(SHEET_STD, HEAD_STD),
               neg: sheet_(SHEET_NEG, HEAD_NEG), rep: sheet_(SHEET_REP, HEAD_REP),
               crs: sheet_(SHEET_CRS, HEAD_CRS), del: sheet_(SHEET_DEL, HEAD_DEL),
               use: sheet_(SHEET_USE, HEAD_USE) };
    var head = { cmp: HEAD_CMP, std: HEAD_STD, neg: HEAD_NEG, rep: HEAD_REP,
                 crs: HEAD_CRS, del: HEAD_DEL, use: HEAD_USE };
    /* 사용기록은 줄이 많아 id를 다 훑으면 느려진다. 새 id로만 만들어 보내므로 겹칠 일이 없다. */
    var seen = { cmp: idSet_(sh.cmp), std: idSet_(sh.std), neg: idSet_(sh.neg),
                 rep: idSet_(sh.rep), crs: idSet_(sh.crs), del: idSet_(sh.del),
                 use: {}, repdone: {} };
    var add = { cmp: [], std: [], neg: [], rep: [], crs: [], del: [], use: [], repdone: [] };
    var erased = 0;

    for (var i = 0; i < list.length; i++) {
      var r = list[i];
      var kind = kindOf_(r);
      var id = String(r.id || '');
      if (id && seen[kind][id]) { out.skipped++; continue; }
      if (id) seen[kind][id] = 1;
      /* 처리완료 표시만 바꾸는 것은 새 줄을 만들지 않고 원래 줄을 고친다 */
      if (kind === 'repdone') {
        if (markDone_(sh.rep, r.target, r.done)) out.marked = (out.marked || 0) + 1;
        continue;
      }
      add[kind].push(rowOf_(r, now));
      /* 지움 표시가 오면 원래 줄도 없앤다 */
      if (kind === 'del') {
        var from = (r.kind === 'std') ? sh.std
                 : (r.kind === 'neg') ? sh.neg
                 : (r.kind === 'rep') ? sh.rep
                 : (r.kind === 'crs') ? sh.crs : sh.cmp;
        if (eraseRow_(from, r.target)) erased++;
      }
    }
    ['cmp', 'std', 'neg', 'rep', 'crs', 'del', 'use'].forEach(function (k) {
      if (add[k].length) {
        sh[k].getRange(sh[k].getLastRow() + 1, 1, add[k].length, head[k].length).setValues(add[k]);
      }
    });

    out.ok = true;
    out.saved = add.cmp.length + add.std.length + add.neg.length + add.rep.length
              + add.crs.length + add.del.length + add.use.length;
    out.erased = erased;
  } catch (err) {
    out.error = String(err);
  }
  return ContentService.createTextOutput(JSON.stringify(out))
    .setMimeType(ContentService.MimeType.JSON);
}

/** 받은시각을 «날짜·시·요일»로 나눈다. 시트가 글자로 두든 날짜로 바꾸든 둘 다 받는다. */
function when_(v) {
  var d;
  if (v instanceof Date) d = v;
  else {
    var s = String(v || '');
    if (s.length < 13) return null;
    d = new Date(s.replace(' ', 'T'));
    if (isNaN(d.getTime())) return null;
  }
  var p = function (x) { return (x < 10 ? '0' : '') + x; };
  return { d: d.getFullYear() + '-' + p(d.getMonth() + 1) + '-' + p(d.getDate()),
           h: d.getHours(), w: d.getDay() };
}

/** 세어 둔 것을 많은 차례로 줄 세워 앞의 n개만 돌려준다 */
function top_(map, n) {
  var out = [];
  for (var k in map) if (map.hasOwnProperty(k)) out.push([k, map[k]]);
  out.sort(function (a, b) { return b[1] - a[1]; });
  return out.slice(0, n);
}

/** 사용기록을 훑어 통계를 낸다. 줄을 그대로 돌려보내지 않고 여기서 다 세어 보낸다. */
function stats_() {
  var sh = sheet_(SHEET_USE, HEAD_USE);
  var out = { ok: true, days: [], hours: [], dows: [], dev: {}, top: {},
              tot: { visit: 0, uniq: 0, first: 0, back: 0, search: 0, print: 0,
                     copy: 0, sim: 0, rows: 0 } };
  var i, h = [], w = [];
  for (i = 0; i < 24; i++) h.push(0);
  for (i = 0; i < 7; i++) w.push(0);

  var n = sh.getLastRow();
  if (n < 2) { out.hours = h; out.dows = w; return out; }
  var from = Math.max(2, n - MAX_USE + 1);
  var v = sh.getRange(from, 1, n - from + 1, HEAD_USE.length).getValues();

  var day = {}, dayU = {}, who = {}, dev = {};
  var qCnt = {}, qZero = {}, exCnt = {}, itCnt = {}, prCnt = {};
  out.tot.rows = v.length;

  for (i = 0; i < v.length; i++) {
    var kind = String(v[i][1] || ''), val = String(v[i][2] || '');
    var num = Number(v[i][3] || 0), device = String(v[i][4] || '');
    var uid = String(v[i][5] || '');
    var t = when_(v[i][7]) || when_(v[i][6]);

    if (kind === '방문') {
      out.tot.visit++;
      if (val === '예') out.tot.first++;
      if (device) dev[device] = (dev[device] || 0) + 1;
      if (uid) who[uid] = (who[uid] || 0) + 1;
      if (t) {
        day[t.d] = (day[t.d] || 0) + 1;
        if (!dayU[t.d]) dayU[t.d] = {};
        if (uid) dayU[t.d][uid] = 1;
        h[t.h]++; w[t.w]++;
      }
    } else if (kind === '검색') {
      out.tot.search++;
      if (val) {
        qCnt[val] = (qCnt[val] || 0) + 1;
        if (!num) qZero[val] = (qZero[val] || 0) + 1;
      }
    } else if (kind === '인쇄') {
      out.tot.print++;
      if (val) prCnt[val] = (prCnt[val] || 0) + 1;
    } else if (kind === '복사' || kind === '담기' || kind === '유사') {
      if (kind === '복사') out.tot.copy++;
      if (kind === '유사') out.tot.sim++;
      if (val) {
        itCnt[val] = (itCnt[val] || 0) + 1;
        var ex = val.replace(/\s*\d+번\s*$/, '');
        if (ex) exCnt[ex] = (exCnt[ex] || 0) + 1;
      }
    }
  }

  var keys = [];
  for (var d in day) if (day.hasOwnProperty(d)) keys.push(d);
  keys.sort();
  for (i = 0; i < keys.length; i++) {
    var u = 0, m = dayU[keys[i]] || {};
    for (var k in m) if (m.hasOwnProperty(k)) u++;
    out.days.push([keys[i], day[keys[i]], u]);
  }
  var uc = 0, bc = 0;
  for (var q in who) if (who.hasOwnProperty(q)) { uc++; if (who[q] > 1) bc++; }
  out.tot.uniq = uc;
  out.tot.back = bc;

  out.hours = h;
  out.dows = w;
  out.dev = dev;
  out.top = { q: top_(qCnt, TOP_N), zero: top_(qZero, TOP_N),
              ex: top_(exCnt, TOP_N), it: top_(itCnt, TOP_N), pr: top_(prCnt, 12) };
  return out;
}

function doGet(e) {
  /* ?what=stat 이면 통계만 보낸다 — 여느 받아오기를 느리게 하지 않으려고 나눠 두었다 */
  if (e && e.parameter && e.parameter.what === 'stat') {
    var st;
    try { st = stats_(); } catch (err) { st = { ok: false, error: String(err) }; }
    return ContentService.createTextOutput(JSON.stringify(st))
      .setMimeType(ContentService.MimeType.JSON);
  }
  var out = { ok: false, pairs: [], std: [], neg: [], rep: [], crs: [], del: [] };
  try {
    var shC = sheet_(SHEET_CMP, HEAD_CMP), shS = sheet_(SHEET_STD, HEAD_STD);
    var shN = sheet_(SHEET_NEG, HEAD_NEG), shD = sheet_(SHEET_DEL, HEAD_DEL);
    var shR = sheet_(SHEET_REP, HEAD_REP), shX = sheet_(SHEET_CRS, HEAD_CRS);
    var n, v, i;

    n = shC.getLastRow();
    if (n > 1) {
      var from = Math.max(2, n - MAX_BACK + 1);
      v = shC.getRange(from, 1, n - from + 1, HEAD_CMP.length).getValues();
      for (i = 0; i < v.length; i++) {
        out.pairs.push({ id: String(v[i][0]), a: v[i][1], x: v[i][2], y: v[i][3], c: v[i][4],
                         chk: v[i][5] === '예' ? 1 : 0, sx: v[i][6], sy: v[i][7],
                         bx: v[i][8], by: v[i][9], who: v[i][10], at: String(v[i][11]) });
      }
    }
    n = shS.getLastRow();
    if (n > 1) {
      var f2 = Math.max(2, n - MAX_BACK + 1);
      v = shS.getRange(f2, 1, n - f2 + 1, HEAD_STD.length).getValues();
      for (i = 0; i < v.length; i++) {
        out.std.push({ id: String(v[i][0]), p: v[i][1],
                       cs: String(v[i][2]) ? String(v[i][2]).split(' | ') : [],
                       k: v[i][3], near: v[i][4], who: v[i][5], at: String(v[i][6]) });
      }
    }
    n = shN.getLastRow();
    if (n > 1) {
      var f3 = Math.max(2, n - MAX_BACK + 1);
      v = shN.getRange(f3, 1, n - f3 + 1, HEAD_NEG.length).getValues();
      for (i = 0; i < v.length; i++) {
        out.neg.push({ id: String(v[i][0]), a: v[i][1], x: v[i][2],
                       who: v[i][3], at: String(v[i][4]) });
      }
    }
    n = shR.getLastRow();
    if (n > 1) {
      var f5 = Math.max(2, n - MAX_BACK + 1);
      v = shR.getRange(f5, 1, n - f5 + 1, HEAD_REP.length).getValues();
      for (i = 0; i < v.length; i++) {
        out.rep.push({ id: String(v[i][0]), path: v[i][1], label: v[i][2], kind: v[i][3],
                       memo: v[i][4], done: String(v[i][5]) === '처리완료',
                       who: v[i][6], at: String(v[i][7]) });
      }
    }
    n = shX.getLastRow();
    if (n > 1) {
      var f6 = Math.max(2, n - MAX_BACK + 1);
      v = shX.getRange(f6, 1, n - f6 + 1, HEAD_CRS.length).getValues();
      for (i = 0; i < v.length; i++) {
        out.crs.push({ id: String(v[i][0]), p: v[i][1], c: v[i][2],
                       who: v[i][3], at: String(v[i][4]) });
      }
    }
    n = shD.getLastRow();
    if (n > 1) {
      var f4 = Math.max(2, n - MAX_BACK + 1);
      v = shD.getRange(f4, 1, n - f4 + 1, 2).getValues();
      for (i = 0; i < v.length; i++) out.del.push(String(v[i][1]));
    }
    out.ok = true;
  } catch (err) {
    out.error = String(err);
  }
  return ContentService.createTextOutput(JSON.stringify(out))
    .setMimeType(ContentService.MimeType.JSON);
}
