const {boot,wait,scorer}=require('./harness');
const H=boot('IT:IT,EX:EX,divOf:divOf,search:search,passFilter:passFilter,F:F');
const {w,doc,$,click,key}=H;
const {ok,done}=scorer();
const T=()=>w.__T;
const chips=g=>[...doc.querySelectorAll('#filters .fgroup')[g].querySelectorAll('.chip')].map(c=>c.textContent);
(async()=>{
  await wait(180);
  key('1'); key('Enter'); await wait(140);
  click($('ftoggle')); await wait(80);

  console.log('\n[1] 구분 — 여섯 갈래, 정한 차례대로');
  const g0=doc.querySelectorAll('#filters .fgroup')[0];
  ok('이름표 «구분»', g0.querySelector('b').textContent==='구분');
  ok('수능·9월모평·6월모평·고1전국·고2전국·고3전국',
     chips(0).join(',')==='수능,9월모평,6월모평,고1전국,고2전국,고3전국', chips(0).join(','));

  console.log('\n[2] 시행 — 3월부터 차례대로, 수능 없음');
  const g1=doc.querySelectorAll('#filters .fgroup')[1];
  ok('이름표 «시행»', g1.querySelector('b').textContent==='시행');
  ok('3,4,5,6,7,9,10,11월 순서',
     chips(1).join(',')==='3월,4월,5월,6월,7월,9월,10월,11월', chips(1).join(','));
  ok('10월 들어 있음', chips(1).includes('10월'));
  ok('수능은 빠짐', !chips(1).includes('수능'));

  console.log('\n[3] 눌러 보면 실제로 걸러지나');
  const lab=()=>[...doc.querySelectorAll('.card .tag')].map(t=>t.textContent);
  const pick=(g,t)=>{ const c=[...doc.querySelectorAll('#filters .fgroup')[g].querySelectorAll('.chip')]
                        .find(x=>x.textContent===t); click(c); return c; };
  let c=pick(0,'9월모평'); await wait(300);
  ok('9월모평만', lab().length>0 && lab().every(x=>/학년도 9월/.test(x)), lab()[0]);
  ok('요약에 표시', /9월모평/.test($('fsummary').textContent), $('fsummary').textContent);
  click(c); await wait(250);
  c=pick(0,'수능'); await wait(300);
  ok('수능만', lab().every(x=>/학년도 수능/.test(x)), lab()[0]);
  click(c); await wait(250);
  c=pick(0,'고3전국'); await wait(300);
  ok('고3 전국연합만', lab().every(x=>/년 \d+월 고3/.test(x)), lab()[0]);
  ok('수능·모평은 안 섞임', !lab().some(x=>/학년도/.test(x)));
  click(c); await wait(250);
  c=pick(1,'10월'); await wait(300);
  ok('10월만', lab().length>0 && lab().every(x=>/년 10월/.test(x)), lab()[0]);
  ok('10월 문항이 실제로 있음', doc.querySelectorAll('.card').length>0,
     doc.querySelectorAll('.card').length+'개 보임');
  ok('자료에 10월 530문항', T().IT.filter(it=>T().EX[it[0]].r==='10월').length===530,
     T().IT.filter(it=>T().EX[it[0]].r==='10월').length);
  click(c); await wait(250);

  console.log('\n[4] 구분 + 시행을 같이');
  const a=pick(0,'고3전국'), b=pick(1,'3월'); await wait(320);
  ok('고3 3월만', lab().length>0 && lab().every(x=>/년 3월 고3/.test(x)), lab()[0]);
  click($('fclear')); await wait(280);
  ok('필터 해제되면 다시 전체', doc.querySelectorAll('#filters .chip.on').length===0);

  console.log('\n[5] 갈래별 문항 수가 맞나');
  const IT=T().IT, EX=T().EX;
  const cnt={};
  IT.forEach(it=>{ const k=T().divOf(EX[it[0]]); cnt[k]=(cnt[k]||0)+1; });
  ok('수능 530', cnt['수능']===530, cnt['수능']);
  ok('9월모평 530', cnt['9월모평']===530, cnt['9월모평']);
  ok('6월모평 530', cnt['6월모평']===530, cnt['6월모평']);
  ok('고1전국 960', cnt['고1전국']===960, cnt['고1전국']);
  ok('고2전국 1200', cnt['고2전국']===1200, cnt['고2전국']);
  ok('고3전국 1640', cnt['고3전국']===1640, cnt['고3전국']);
  ok('여섯 갈래가 전부', Object.keys(cnt).length===6, Object.keys(cnt).join(','));
  ok('합이 5390', Object.values(cnt).reduce((s,x)=>s+x,0)===5390);

  console.log('\n[6] 검색은 그대로');
  ok('고3 6·9월 = 모평', T().search('고3 6월, 9월 22번').list.length===30);
  ok('24학년도 수능 14번', T().search('24학년도 수능 14번').list.length>0);
  ok('25 고3 3월 1,2,3', T().search('25 고3 3월 1,2,3').list.length>0);
  done();
})();
