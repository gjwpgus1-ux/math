/* 모바일 — 단추 정리 · 글씨 크기 통일 · 한 번에 굴러가는 화면 */
const fs=require('fs'), path=require('path');
const {boot,scorer,APP}=require('./harness.js');
const S=scorer();
const {w,doc,$}=boot('fitCards:fitCards,setMode:setMode,perPage:perPage,render:render,'+
  'hits:function(){return hits;},pick:function(n){SEL={};hits.slice(0,n).forEach(function(it){SEL[it[2]]=true;});updateSel();}');
const CSS=fs.readFileSync(path.join(APP,'index.html'),'utf8').replace(/\s+/g,' ');
const RAW=fs.readFileSync(path.join(APP,'index.html'),'utf8');

/* ---- 세 단추 감추기 ---- */
S.ok('유사문항 비교·교과목·성취기준 단추가 감춰졌다',
     /h1#cmpBtn,h1#stdBtn,h1#crsBtn\{display:none\}/.test(CSS.replace(/ /g,'')));
['cmpBtn','crsBtn','stdBtn'].forEach(id=>{
  S.ok('«'+id+'» 은 자리에 남아 있다(속 기능이 쓴다)', !!$(id));
});
S.ok('모드 단추는 그대로 셋', doc.querySelectorAll('.modesw button').length===3);

/* ---- 글씨 크기 ---- */
function size(sel){
  const flat=CSS.replace(/ /g,'');
  const i=flat.indexOf(sel+'{');
  if(i<0) return null;
  const body=flat.slice(i+sel.length+1, flat.indexOf('}', i));
  const m=/font-size:([0-9.]+)px/.exec(body);
  return m? +m[1] : null;
}
const BASE=13.5;
[['.modeswbutton','모드 단추'],['button','여느 단추'],['#keyhint','화살표 안내'],
 ['#scopebarb','범위 이름표'],['.chip','범위 알약'],['.filters','필터'],
 ['h1.by','제작자'],['h1.tagline','부제'],['#status','결과 줄'],['#q','검색창']].forEach(p=>{
  S.ok(p[1]+' 글씨가 '+BASE+'px', size(p[0])===BASE, size(p[0]));
});
S.ok('사이트 이름만 크게 남는다', size('h1.brand')===21, size('h1.brand'));
S.ok('좁은 화면에서는 검색창만 16px (아이폰 자동확대 막기)',
     /@media\(max-width:620px\)\{#q\{font-size:16px\}\}/.test(CSS.replace(/ /g,'')));

/* ---- 한 번에 굴러가는 화면 ---- */
const m=/@media\s*\(max-width:820px\)\{([\s\S]*?)\n  \}/.exec(RAW);
S.ok('좁은 화면 규칙이 있다', !!m);
const M=(m?m[1]:'').replace(/\s+/g,'');
S.ok('윗줄을 붙박지 않는다', /header\{position:static\}/.test(M));
S.ok('한 줄에 한 문항', /\.grid\.page4\{grid-template-columns:1fr/.test(M));
S.ok('문항칸 안에서 따로 굴리지 않는다', /overflow:visible/.test(M) && /max-height:none/.test(M));
S.ok('좌우 큰 화살표는 감춘다', /\.nav\{display:none\}/.test(M));

/* 넓은 화면에서는 예전대로 */
S.ok('넓은 화면은 붙박이 윗줄 그대로', /header\{position:sticky/.test(CSS.replace(/ /g,'')));
S.ok('넓은 화면은 네 칸 그대로', /\.grid\.page4\{grid-template-columns:repeat\(4,1fr\)/.test(CSS.replace(/ /g,'')));

/* 높이 묶기를 좁은 화면에서 푸는가 */
function setW(px){ Object.defineProperty(w,'innerWidth',{value:px,configurable:true}); }
setW(1400); w.__T.fitCards();
S.ok('넓은 화면에서는 문항칸 높이를 매긴다',
     !!doc.documentElement.style.getPropertyValue('--cardh'),
     doc.documentElement.style.getPropertyValue('--cardh'));
setW(390); w.__T.fitCards();
S.ok('좁은 화면에서는 높이를 풀어 준다',
     !doc.documentElement.style.getPropertyValue('--cardh'),
     doc.documentElement.style.getPropertyValue('--cardh'));

/* ---- 아래 고정 막대 ---- */
S.ok('아래 막대 자리가 있다', !!$('mbar'));
['mCnt','mWork','mNote','mTop'].forEach(id=>S.ok('«'+id+'» 이 있다', !!$(id)));
S.ok('아래 막대는 붙박이', /#mbar\{[^}]*position:fixed/.test(CSS.replace(/ /g,'')));
S.ok('아이폰 아래 여백을 감안한다', /env\(safe-area-inset-bottom/.test(RAW));
S.ok('넓은 화면에서는 안 나온다',
     /@media\(min-width:821px\)\{#mbar\{display:none!important\}\}/.test(CSS.replace(/ /g,'')));

const T2=w.__T;
function setW(px){ Object.defineProperty(w,'innerWidth',{value:px,configurable:true}); }
setW(390); T2.setMode('study');
S.ok('좁은 화면 학습모드에서 아래 막대가 나온다', $('mbar').classList.contains('on'));
S.ok('바닥 여백을 비워 준다', doc.body.classList.contains('mbar'));
T2.setMode('search');
S.ok('복붙모드에서는 안 나온다', !$('mbar').classList.contains('on'));
setW(1400); T2.setMode('study');
S.ok('넓은 화면 학습모드에서도 안 나온다', !$('mbar').classList.contains('on'));

setW(390); T2.setMode('study');
S.ok('고른 것이 없으면 단추가 잠긴다', $('mWork').disabled===true && $('mNote').disabled===true);
S.ok('숫자가 0개', $('mCnt').textContent==='0개', $('mCnt').textContent);
T2.pick(3);
S.ok('세 개 고르면 숫자가 따라온다', $('mCnt').textContent==='3개', $('mCnt').textContent);
S.ok('단추가 열린다', $('mWork').disabled===false && $('mNote').disabled===false);
S.ok('위쪽 도구줄과 숫자가 같다', $('selCnt').textContent==='선택 3개', $('selCnt').textContent);

/* ---- 한 쪽에 몇 문항 ---- */
setW(1400); S.ok('넓은 화면은 한 쪽에 4문항', T2.perPage()===4, T2.perPage());
setW(820);  S.ok('820px 이하는 2문항', T2.perPage()===2, T2.perPage());
setW(390);  S.ok('휴대전화도 2문항', T2.perPage()===2, T2.perPage());
setW(1400); T2.setMode('search'); T2.render(true);
S.ok('넓은 화면에서 카드가 4장', doc.querySelectorAll('#grid .card').length===4,
     doc.querySelectorAll('#grid .card').length);
setW(390); T2.render(true);
S.ok('좁은 화면에서 카드가 2장', doc.querySelectorAll('#grid .card').length===2,
     doc.querySelectorAll('#grid .card').length);
S.ok('쪽 수도 2문항 기준으로 센다',
     $('pageAll').textContent===String(Math.ceil(T2.hits().length/2)), $('pageAll').textContent);
S.done();
