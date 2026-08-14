/* 탭 — 폭 고정 · 닫기 · 모두 닫으면 처음으로 */
const {boot,scorer}=require('./harness.js');
const {w,doc,$}=boot('setTabs:t=>{TABS=t;drawTabs();},TABS:()=>TABS,act:()=>activeTab,'+
  'openTab:openTab,closeTab:closeTab,hits:()=>hits,IT:IT,drawTabs:drawTabs');
const T=w.__T, S=scorer();
['cmp','crs','std'].forEach(id=>{ const el=$(id); if(el) el.classList.remove('open','gate'); });
const key=(k)=>doc.dispatchEvent(new w.KeyboardEvent('keydown',{key:k,bubbles:true}));
const html=require('fs').readFileSync(require('./harness.js').APP+'/index.html','utf8')
  .replace(/\s+/g,'');

/* ---- 폭이 고정인가 ---- */
S.ok('탭에 고정 폭이 지정돼 있다', /\.tab\{[^}]*width:186px/.test(html));
S.ok('탭이 줄어들지 않게 되어 있다', /\.tab\{[^}]*flex:none/.test(html));
S.ok('긴 이름은 …으로 줄인다', /\.tab\.nm\{[^}]*text-overflow:ellipsis/.test(html));
S.ok('이름 칸이 남는 자리를 채운다', /\.tab\.nm\{[^}]*flex:1/.test(html));
S.ok('이름 칸이 줄어들 수 있다', /\.tab\.nm\{[^}]*min-width:0/.test(html));
S.ok('닫기 표시는 안 줄어든다', /\.tab\.x\{[^}]*flex:none/.test(html));

T.setTabs([
  {t:'q',k:'lim',label:'lim',n:579},
  {t:'q',k:'아주아주 긴 검색어 25 고3 3월 1,2,3,7,10,30 확률과 통계 정규분포',
   label:'아주아주 긴 검색어 25 고3 3월 1,2,3,7,10,30 확률과 통계 정규분포',n:3},
  {t:'sim',k:'suneung/000_01.png',label:'26학년도 수능 공통 1번',n:24}]);
const tabs=[...$('tabs').children];
S.ok('탭이 셋 그려졌다', tabs.length===3, tabs.length);
S.ok('탭마다 이름 칸이 있다', tabs.every(t=>!!t.querySelector('.nm')));
S.ok('긴 이름도 글자는 그대로 담긴다',
     tabs[1].querySelector('.nm').textContent.indexOf('정규분포')>=0);
S.ok('갖다 대면 전체 이름이 나온다',
     tabs[1].querySelector('.nm').title.indexOf('정규분포')>=0);
S.ok('비슷한 문항 탭은 «유사 ·» 로 시작', /^유사 ·/.test(tabs[2].querySelector('.nm').textContent));
S.ok('닫기 표시에 단축키 안내가 있다', /Delete/.test(tabs[0].querySelector('.x').title));

/* ---- 하나 닫기 ---- */
T.openTab(1);
S.ok('둘째 탭을 보고 있다', T.act()===1, T.act());
T.closeTab(1);
S.ok('탭이 둘로 줄었다', T.TABS().length===2, T.TABS().length);
S.ok('보고 있던 탭을 닫으면 고른 탭이 없어진다', T.act()===-1, T.act());
S.ok('남은 것은 lim 과 유사 탭',
     T.TABS().map(t=>t.k).join(',')==='lim,suneung/000_01.png', T.TABS().map(t=>t.k).join(','));

/* 앞쪽 탭을 닫으면 보고 있던 자리가 한 칸 당겨진다 */
T.setTabs([{t:'q',k:'a',label:'a',n:1},{t:'q',k:'b',label:'b',n:2},{t:'q',k:'c',label:'c',n:3}]);
T.openTab(2);
T.closeTab(0);
S.ok('앞 탭을 닫으면 보던 탭이 그대로 따라온다', T.TABS()[T.act()].k==='c', T.act());

/* ---- 모두 닫으면 처음 화면으로 ---- */
$('q').value='lim';
T.setTabs([{t:'q',k:'lim',label:'lim',n:579}]);
T.openTab(0);
S.ok('검색어가 들어 있다', $('q').value==='lim', $('q').value);
T.closeTab(0);
S.ok('탭이 하나도 안 남았다', T.TABS().length===0, T.TABS().length);
S.ok('검색어가 비워졌다', $('q').value==='', $('q').value);
S.ok('결과가 전체로 돌아왔다', T.hits().length===T.IT.length, T.hits().length);
S.ok('안내 문구가 사라졌다', $('status').style.display==='none' || !$('status').innerHTML,
     $('status').innerHTML.slice(0,30));
S.ok('빈 탭줄 안내가 보인다', /탭으로 쌓입니다/.test($('tabs').textContent));

/* ---- Delete 단축키 ---- */
T.setTabs([{t:'q',k:'a',label:'a',n:1},{t:'q',k:'b',label:'b',n:2}]);
T.openTab(1);
key('Delete');
S.ok('Delete 로 보던 탭이 닫힌다', T.TABS().length===1 && T.TABS()[0].k==='a',
     T.TABS().map(t=>t.k).join(','));
key('Delete');
S.ok('Delete 로 마지막 탭까지 닫힌다', T.TABS().length===0, T.TABS().length);
S.ok('마지막까지 닫으면 검색어도 비워진다', $('q').value==='', $('q').value);
key('Delete');
S.ok('탭이 없을 때 눌러도 괜찮다', T.TABS().length===0);

/* 고른 탭이 없으면 맨 앞 탭을 닫는다 */
T.setTabs([{t:'q',k:'a',label:'a',n:1},{t:'q',k:'b',label:'b',n:2}]);
key('Delete');
S.ok('고른 탭이 없으면 맨 앞 탭을 닫는다', T.TABS().map(t=>t.k).join(',')==='b',
     T.TABS().map(t=>t.k).join(','));

/* 검색창에 커서가 있으면 Delete 는 글자 지우기여야 한다 */
T.setTabs([{t:'q',k:'a',label:'a',n:1}]);
$('q').focus();
key('Delete');
S.ok('검색창 안에서는 Delete 가 탭을 안 닫는다', T.TABS().length===1, T.TABS().length);
$('q').blur();

/* 단축키 창에도 적혀 있는가 */
$('keysBtn').click();
S.ok('단축키 창에 Delete 설명이 있다', $('mbox').textContent.indexOf('지금 보고 있는 탭 닫기')>=0);
S.ok('마지막 탭 안내까지 적혀 있다', $('mbox').textContent.indexOf('처음 화면으로')>=0);
$('keysOk').click();
S.done();
