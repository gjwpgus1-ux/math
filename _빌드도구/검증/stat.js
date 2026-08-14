/* 방문 통계 — 기록 쌓기 · 그래프 · 개인정보 */
const {boot,scorer,wait}=require('./harness.js');
const {w,doc,$,click}=boot('statLog:statLog,statVisit:statVisit,QUEUE:()=>QUEUE,setQ:x=>{QUEUE=x;},'+
  'barSvg:barSvg,rankTable:rankTable,setStat:s=>{STAT=s;},drawAdmin:drawAdmin,'+
  'setTab:t=>{adminTab=t;},UID:UID,DEVICE:DEVICE,search:search,COLLECT_URL:COLLECT_URL');
const T=w.__T, S=scorer();

/* ---- 기록이 쌓이는가 ---- */
T.setQ([]);
/* 앱이 뜰 때 이미 한 번 방문을 남긴다 — 첫 방문 표시를 보려고 그 자국을 지운다 */
try{ w.localStorage.removeItem('gich_seen'); }catch(e){}
T.statVisit();
let q=T.QUEUE();
S.ok('방문이 한 줄 쌓인다', q.length===1, q.length);
const v=q[0];
S.ok('종류가 «방문»', v.kind==='방문', v.kind);
S.ok('보내는 갈래가 use', v.t==='use', v.t);
S.ok('익명번호가 들어 있다', !!v.who);
S.ok('기기가 PC 또는 모바일', ['PC','모바일'].indexOf(v.dev)>=0, v.dev);
S.ok('시각이 있다', !!v.at);
S.ok('첫 방문 표시가 «예»', v.val==='예', v.val);
T.statVisit();
S.ok('두 번째는 첫 방문이 아니다', T.QUEUE()[1].val==='', T.QUEUE()[1].val);

/* 개인정보가 안 담기는지 */
const keys=Object.keys(v).sort().join(',');
S.ok('담긴 칸이 정해진 것뿐', keys==='at,dev,id,kind,n,t,val,who', keys);
['name','email','ip','ua','agent','url','ref'].forEach(k=>{
  S.ok('«'+k+'» 은 담기지 않는다', !(k in v));
});

/* ---- 검색이 기록되는가 ---- */
T.setQ([]);
$('q').value='lim, x^2';
doc.getElementById('q').dispatchEvent(new w.KeyboardEvent('keydown',{key:'Enter',bubbles:true}));
q=T.QUEUE().filter(r=>r.kind==='검색');
S.ok('검색이 기록된다', q.length===1, T.QUEUE().length);
S.ok('검색어가 그대로', q[0] && q[0].val==='lim, x^2', q[0]&&q[0].val);
S.ok('결과 수가 함께 담긴다', q[0] && q[0].n===T.search('lim, x^2').list.length, q[0]&&q[0].n);

/* 긴 검색어는 잘린다 */
T.setQ([]);
T.statLog('검색','가'.repeat(300),0);
S.ok('아주 긴 검색어는 120자로 자른다', T.QUEUE()[0].val.length===120, T.QUEUE()[0].val.length);

/* ---- 그래프 ---- */
const svg=T.barSvg([['월',3],['화',7],['수',5]],{});
S.ok('막대그래프가 SVG로 나온다', /^<svg/.test(svg));
S.ok('막대가 셋', (svg.match(/<rect/g)||[]).length===3, (svg.match(/<rect/g)||[]).length);
S.ok('밖에서 받아오는 것이 없다', !/http/.test(svg));
const svg2=T.barSvg([['월',3,1],['화',7,4]],{two:true});
S.ok('두 겹 그래프는 막대가 넷', (svg2.match(/<rect/g)||[]).length===4);
S.ok('빈 자료는 안내글', /아직 기록이 없습니다/.test(T.barSvg([],{})));
S.ok('순위표가 그려진다', /<table/.test(T.rankTable([['가',3],['나',1]],'회')));
S.ok('빈 순위표는 안내글', /아직 기록이 없습니다/.test(T.rankTable([],'회')));
S.ok('순위표는 글자를 그대로 넣지 않는다',
     T.rankTable([['<b>x</b>',1]]).indexOf('<b>x</b>')<0);

/* ---- 관리자 화면 ---- */
S.ok('통계 탭 단추가 있다', !!$('atabUse'));
T.setStat({ok:true,
  tot:{visit:120,uniq:44,first:44,back:19,search:88,print:12,copy:31,sim:9,rows:300},
  days:[['2026-08-12',10,7],['2026-08-13',22,15],['2026-08-14',18,12]],
  hours:new Array(24).fill(0).map((_,i)=>i===9?30:i),
  dows:[3,20,18,15,17,19,8],
  dev:{PC:90,'모바일':30},
  top:{q:[['lim, x^2',12],['정규분포',9]],zero:[['없는말',4]],
       ex:[['26학년도 수능 공통',31]],it:[['26학년도 수능 공통 10번',9]],
       pr:[['학습지·PDF',8],['오답노트·인쇄',4]]}});
T.setTab('use'); T.drawAdmin();
const L=$('adminList'), txt=L.textContent;
S.ok('통계 화면이 그려진다', L.innerHTML.length>500, L.innerHTML.length);
['오늘 방문','어제 방문','최근 7일','전체 방문','다녀간 사람','두 번 이상 온 사람',
 '날짜별 방문','시간대별 방문','요일별 방문','기기','많이 한 검색','결과가 없던 검색',
 '많이 쓴 시험','많이 쓴 문항','내보내기'].forEach(k=>{
  S.ok('«'+k+'» 이 있다', txt.indexOf(k)>=0);
});
S.ok('그래프가 넷 그려졌다', L.querySelectorAll('svg').length===3, L.querySelectorAll('svg').length);
S.ok('숫자 카드가 여섯', L.querySelectorAll('.stcard').length===6, L.querySelectorAll('.stcard').length);
S.ok('전체 방문 120이 보인다', txt.indexOf('120')>=0);
S.ok('개인정보 안내가 적혀 있다', txt.indexOf('이름·주소·IP는 담기지 않습니다')>=0);
S.ok('새로 고침 단추가 있다', !![...$('adminFoot').querySelectorAll('button')].find(b=>b.textContent==='새로 고침'));
S.ok('검색어 순위가 표에 있다', txt.indexOf('lim, x^2')>=0);
S.ok('결과 없던 검색이 표에 있다', txt.indexOf('없는말')>=0);

/* 기록이 아예 없을 때도 안 깨지는가 */
T.setStat({ok:true,tot:{},days:[],hours:new Array(24).fill(0),dows:[0,0,0,0,0,0,0],dev:{},
           top:{q:[],zero:[],ex:[],it:[],pr:[]}});
T.drawAdmin();
S.ok('기록이 없어도 화면이 그려진다', $('adminList').innerHTML.length>200);
S.ok('없을 때 안내글이 보인다', $('adminList').textContent.indexOf('아직 기록이 없습니다')>=0);

S.done();
