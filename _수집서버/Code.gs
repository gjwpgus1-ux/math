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
var SHEET_DEL = '지운응답';
var MAX_BACK  = 20000;          // 앱으로 돌려보낼 최대 줄 수

var HEAD_CMP = ['id','기준','왼쪽','오른쪽','선택','검증쌍',
                '점수L','점수R','글자L','글자R','익명번호','시각','받은시각'];
var HEAD_STD = ['id','문항','성취기준','기타','이웃확인','익명번호','시각','받은시각'];
var HEAD_NEG = ['id','기준문항','제외할문항','익명번호','시각','받은시각'];
var HEAD_DEL = ['id','지운응답id','종류','익명번호','시각','받은시각'];


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
  if (r.t === 'del') return 'del';
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
  if (k === 'del') {
    return [r.id || '', r.target || '', r.kind || '', r.who || '', r.at || '', now];
  }
  return [r.id || '', r.a || '', r.x || '', r.y || '', r.c || '', r.chk ? '예' : '',
          r.sx, r.sy, r.bx, r.by, r.who || '', r.at || '', now];
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
               neg: sheet_(SHEET_NEG, HEAD_NEG), del: sheet_(SHEET_DEL, HEAD_DEL) };
    var head = { cmp: HEAD_CMP, std: HEAD_STD, neg: HEAD_NEG, del: HEAD_DEL };
    var seen = { cmp: idSet_(sh.cmp), std: idSet_(sh.std),
                 neg: idSet_(sh.neg), del: idSet_(sh.del) };
    var add = { cmp: [], std: [], neg: [], del: [] };
    var erased = 0;

    for (var i = 0; i < list.length; i++) {
      var r = list[i];
      var kind = kindOf_(r);
      var id = String(r.id || '');
      if (id && seen[kind][id]) { out.skipped++; continue; }
      if (id) seen[kind][id] = 1;
      add[kind].push(rowOf_(r, now));
      /* 지움 표시가 오면 원래 줄도 없앤다 */
      if (kind === 'del') {
        var from = (r.kind === 'std') ? sh.std : (r.kind === 'neg' ? sh.neg : sh.cmp);
        if (eraseRow_(from, r.target)) erased++;
      }
    }
    ['cmp', 'std', 'neg', 'del'].forEach(function (k) {
      if (add[k].length) {
        sh[k].getRange(sh[k].getLastRow() + 1, 1, add[k].length, head[k].length).setValues(add[k]);
      }
    });

    out.ok = true;
    out.saved = add.cmp.length + add.std.length + add.neg.length + add.del.length;
    out.erased = erased;
  } catch (err) {
    out.error = String(err);
  }
  return ContentService.createTextOutput(JSON.stringify(out))
    .setMimeType(ContentService.MimeType.JSON);
}

function doGet(e) {
  var out = { ok: false, pairs: [], std: [], neg: [], del: [] };
  try {
    var shC = sheet_(SHEET_CMP, HEAD_CMP), shS = sheet_(SHEET_STD, HEAD_STD);
    var shN = sheet_(SHEET_NEG, HEAD_NEG), shD = sheet_(SHEET_DEL, HEAD_DEL);
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
