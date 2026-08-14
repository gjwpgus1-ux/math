/* 모바일 — 단추 정리 · 글씨 크기 통일 · 한 번에 굴러가는 화면 */
const fs=require('fs'), path=require('path');
const {boot,scorer,APP}=require('./harness.js');
const S=scorer();
const {w,doc,$}=boot('fitCards:fitCards');
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
S.done();
