const {boot,wait,scorer}=require('./harness');
const H=boot('IT:IT,EX:EX,heldYear:heldYear,search:search,parseQuery:parseQuery,label:label');
const {w,doc,$,click,key}=H;
const {ok,done}=scorer();
const T=()=>w.__T;
const names=q=>T().search(q).list.map(it=>T().label(it));
const uniqEx=q=>[...new Set(T().search(q).list.map(it=>T().EX[it[0]].n))];
(async()=>{
  await wait(180); key('1'); key('Enter'); await wait(140);

  console.log('\n[1] 실시 연도 계산');
  const EX=T().EX;
  ok('26학년도 수능 → 2025년', T().heldYear(EX.find(e=>e.n==='26학년도 수능 공통'))==='2025');
  ok('26학년도 6월 → 2025년', T().heldYear(EX.find(e=>e.g==='수능·모평'&&e.r==='6월'&&e.y==='2026'))==='2025');
  ok('26학년도 9월 → 2025년', T().heldYear(EX.find(e=>e.g==='수능·모평'&&e.r==='9월'&&e.y==='2026'))==='2025');
  ok('2025년 3월 고1 → 2025년', T().heldYear(EX.find(e=>e.g==='고1'&&e.r==='3월'&&e.y==='2025'))==='2025');

  console.log('\n[2] 연도 필터 — 2025를 고르면 26학년도 수능·모평이 들어와야');
  click($('ftoggle')); await wait(80);
  const gYear=[...doc.querySelectorAll('#filters .fgroup')].find(g=>g.querySelector('b').textContent==='연도');
  const chips=[...gYear.querySelectorAll('.chip')].map(c=>c.textContent);
  const held=[...new Set(EX.map(e=>T().heldYear(e)))].sort().reverse();
  ok('연도 칩이 실시 연도', chips.join(',')===held.join(','), chips.slice(0,4).join(','));
  ok('학년도 그대로인 칩은 없음', !chips.includes(String(Math.max(...EX.map(e=>+e.y)))),
     '가장 큰 학년도='+Math.max(...EX.map(e=>+e.y)));
  ok('2016년도 생김 (17학년도 수능)', chips.includes('2016'));
  const c25=[...gYear.querySelectorAll('.chip')].find(c=>c.textContent==='2025');
  click(c25); await wait(320);
  const shown=[...new Set([...doc.querySelectorAll('.card .tag')].map(t=>t.textContent.replace(/ \d+번.*$/,'')))];
  ok('26학년도 수능이 들어옴', shown.some(x=>/26학년도 수능/.test(x)), shown.slice(0,4).join(' / '));
  click(c25); await wait(250);

  console.log('\n[3] 필터로 걸린 시험 전부 확인');
  const held25=EX.filter(e=>T().heldYear(e)==='2025').map(e=>e.n);
  ok('26학년도 수능·9월·6월 포함', ['수능','9월','6월'].every(r=>held25.some(n=>n.indexOf('26학년도 '+r)===0)),
     held25.filter(n=>/^26/.test(n)).slice(0,3).join(', '));
  ok('2025년 전국연합도 포함', held25.some(n=>/^2025년/.test(n)));
  ok('25학년도 수능은 빠짐 (2024년 시행)', !held25.some(n=>/^25학년도/.test(n)));

  console.log('\n[4] 검색 — «학년도»라고 적으면 학년도 그대로');
  ok('26학년도 수능', uniqEx('26학년도 수능').every(n=>/^26학년도 수능/.test(n)), uniqEx('26학년도 수능')[0]);
  ok('24학년도 수능 14번', names('24학년도 수능 14번').every(x=>/^24학년도 수능/.test(x)));

  console.log('\n[5] 검색 — 그냥 연도면 둘 다 찾아 준다');
  const y25=uniqEx('2025년 수능');
  ok('«2025년 수능» 에 26학년도 수능이 나옴', y25.some(n=>/^26학년도 수능/.test(n)), y25.join(' / '));
  ok('25학년도 수능도 함께 나옴', y25.some(n=>/^25학년도 수능/.test(n)), y25.join(' / '));
  const yrs=[...new Set(y25.map(n=>n.slice(0,2)))].sort();
  ok('두 학년도만 (25·26)', yrs.join(',')==='25,26', yrs.join(',')+' · 시험 '+y25.length+'개');
  ok('2025년 3월 고1', uniqEx('2025년 3월 고1').every(n=>/^2025년 3월 고1/.test(n)));

  console.log('\n[6] 예전 검색이 깨지지 않았나');
  ok('고2 6월 14번', T().search('고2 6월 14번').list.length>0);
  ok('25 고3 3월 1,2,3', T().search('25 고3 3월 1,2,3').list.length===3, T().search('25 고3 3월 1,2,3').list.length);
  const y69=T().search('고3 6월, 9월 22번').list;
  ok('고3 6월, 9월 22번', y69.length>0 && y69.every(it=>T().EX[it[0]].g==='수능·모평'), y69.length+'문항');
  ok('2020년 4월 고3', T().search('2020년 4월 고3').list.length>0);
  ok('확통 정규분포', T().search('확통 정규분포').list.length>0);

  console.log('\n[7] 상태줄 표시');
  $('q').value='26학년도 수능'; $('q').dispatchEvent(new w.Event('input')); await wait(320);
  ok('«학년도»로 표시', /26학년도/.test($('status').textContent), $('status').textContent.slice(0,40));
  $('q').value='2025년 수능'; $('q').dispatchEvent(new w.Event('input')); await wait(320);
  ok('«년»으로 표시', /2025년/.test($('status').textContent), $('status').textContent.slice(0,40));
  done();
})();
