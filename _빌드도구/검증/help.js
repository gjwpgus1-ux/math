/* 검색 도움말 팝업 · 단축키 점검 */
const {boot,scorer}=require('./harness.js');
const {w,doc,$,click,key}=boot('goTab:goTab,TABS:()=>TABS,setTabs:t=>{TABS=t;drawTabs();},act:()=>activeTab,openTab:openTab,HELP:HELP,search:search');
const T=w.__T, S=scorer();

/* ---- 검색창 ---- */
S.ok('검색창 안내글이 짧아졌다', $('q').placeholder==='검색어를 입력하세요', $('q').placeholder);
S.ok('도움말 단추가 있다', !!$('helpBtn'));
S.ok('도움말 단추가 초기화 오른쪽에',
     $('clear').nextElementSibling===$('helpBtn'), $('clear').nextElementSibling&&$('clear').nextElementSibling.id);
S.ok('셋 다 검색줄 안에 있다',
     $('q').parentNode===$('clear').parentNode && $('clear').parentNode===$('helpBtn').parentNode);

/* ---- 도움말 내용 ---- */
S.ok('도움말이 여덟 꼭지', T.HELP.length===8, T.HELP.length);
click($('helpBtn'));
const box=$('mbox'), txt=box.textContent;
S.ok('팝업이 열린다', $('modal').classList.contains('open'));
S.ok('넓은 창으로 뜬다', box.classList.contains('wide'));
['수식','쉼표','단축키','대문자','sqrt','Σ','lim, x^2','a_n','x^2'].forEach(k=>{
  S.ok('«'+k+'» 설명이 있다', txt.indexOf(k)>=0);
});
S.ok('단축키 표시가 그려졌다', box.querySelectorAll('kbd').length>=4, box.querySelectorAll('kbd').length);
S.ok('표가 그려졌다', box.querySelectorAll('table td').length>=40, box.querySelectorAll('table td').length);
S.ok('닫기 단추가 있다', !!$('helpOk'));
click($('helpOk'));
S.ok('닫힌다', !$('modal').classList.contains('open'));
S.ok('닫으면 넓은 창 표시도 지워진다', !box.classList.contains('wide'));

/* 도움말에 적힌 검색 예가 실제로 그 수인지 */
const say={};
T.HELP[3][2].forEach(r=>{ const m=/^(\d[\d,]*)문항/.exec(r[1]); if(m) say[r[0]]=+m[1].replace(/,/g,''); });
Object.keys(say).forEach(q=>{
  const real=T.search(q).list.length;
  S.ok('도움말에 적힌 «'+q+' → '+say[q]+'문항» 이 실제와 같다', real===say[q], real);
});

/* ---- 탭 단축키 ---- */
T.setTabs([{t:'q',k:'lim',label:'lim',n:1},{t:'q',k:'x^2',label:'x^2',n:2},{t:'q',k:'sin',label:'sin',n:3}]);
T.openTab(0);
S.ok('첫 탭에서 시작', T.act()===0, T.act());
T.goTab(1);  S.ok('Ctrl+→ 로 다음 탭', T.act()===1, T.act());
T.goTab(1);  S.ok('한 번 더', T.act()===2, T.act());
T.goTab(1);  S.ok('끝에서 처음으로 돌아온다', T.act()===0, T.act());
T.goTab(-1); S.ok('Ctrl+← 로 끝 탭으로', T.act()===2, T.act());
T.goTab(-1); S.ok('뒤로 한 칸', T.act()===1, T.act());

/* 시작 팝업(교과목·유사문항)이 떠 있으면 키를 다 삼킨다 — 닫고 나서 본다 */
['cmp','crs','std'].forEach(id=>{ const el=$(id); if(el) el.classList.remove('open','gate'); });
function ctrl(k){ doc.dispatchEvent(new w.KeyboardEvent('keydown',{key:k,ctrlKey:true,bubbles:true})); }
ctrl('ArrowRight'); S.ok('키 눌림이 실제로 먹는다', T.act()===2, T.act());
ctrl('ArrowLeft');  S.ok('반대쪽도 먹는다', T.act()===1, T.act());

/* 검색창에 커서가 있어도 탭 이동은 되어야 한다 */
$('q').focus();
ctrl('ArrowRight');
S.ok('검색창에 커서가 있어도 탭이 옮겨진다', T.act()===2, T.act());

/* 탭이 하나뿐이면 아무 일도 없어야 한다 */
T.setTabs([{t:'q',k:'lim',label:'lim',n:1}]); T.openTab(0);
ctrl('ArrowRight'); S.ok('탭이 하나면 그대로', T.act()===0, T.act());

/* Esc 로 검색창에서 빠져나오기 */
$('q').focus();
key('Escape');
S.ok('Esc 로 검색창에서 커서가 빠진다', doc.activeElement!==$('q'), doc.activeElement&&doc.activeElement.id);

S.ok('안내 문구에 Ctrl 이 적혀 있다', $('keyhint').textContent.indexOf('Ctrl')>=0, $('keyhint').textContent);
S.done();
