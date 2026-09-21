/* 과목 아래 단원 — 필터·자료·관리자 고치기 */
const {boot,wait,scorer}=require('./harness');
const H=boot('IT:IT,EX:EX,courseOf:courseOf,unitOf:unitOf,passItem:passItem,F:F,'+
             'UNITS:UNITS,CRS_ORDER:CRS_ORDER,FIX:FIX,search:search');
const {w,doc,$,click,key}=H;
const {ok,done}=scorer();
const T=()=>w.__T;
const grp=t=>[...doc.querySelectorAll('#filters .fgroup')]
               .find(g=>g.querySelector('b') && g.querySelector('b').textContent===t);

(async()=>{
  await wait(300);

  console.log('\n[1] 과목마다 단원이 정해져 있다');
  const U=T().UNITS;
  ok('일곱 과목에 단원이 있다', Object.keys(U).length===7, Object.keys(U).join(','));
  ok('공통수학1은 넷', U['공통수학1'].join(',')==='다항식,방정식과 부등식,경우의 수,행렬', U['공통수학1'].join(','));
  ok('기하는 셋', U['기하'].join(',')==='이차곡선,공간도형과 공간좌표,벡터', U['기하'].join(','));
  ok('중학교수학·교육과정 밖에는 단원이 없다', !U['중학교수학'] && !U['교육과정 밖']);

  console.log('\n[2] 문항마다 단원이 붙어 있다');
  let n=0, bad=0;
  T().IT.forEach(it=>{
    const c=T().courseOf(it), u=T().unitOf(it);
    if(!u) return;
    n++;
    if(!(U[c]||[]).includes(u)) bad++;
  });
  console.log('   단원이 붙은 문항 '+n+' / '+T().IT.length);
  ok('열에 아홉은 단원이 붙어 있다', n/T().IT.length>0.9, Math.round(100*n/T().IT.length)+'%');
  ok('과목에 없는 단원은 없다', bad===0, bad);

  console.log('\n[3] 필터 — 과목을 고르면 단원이 나온다');
  click($('sideBtn')); await wait(120);
  ok('단원 안내가 먼저 보인다', /과목을 고르면/.test($('unitbox').textContent));
  const sub=grp('과목');
  const 대수=[...sub.querySelectorAll('.chip')].find(c=>c.textContent==='대수');
  click(대수); await wait(250);
  const us=[...doc.querySelectorAll('#unitbox .chip')].map(c=>c.textContent);
  ok('대수의 단원 셋', us.join(',')==='지수함수와 로그함수,삼각함수,수열', us.join(','));
  const 수열=[...doc.querySelectorAll('#unitbox .chip')].find(c=>c.textContent==='수열');
  click(수열); await wait(250);
  const left=T().IT.filter(it=>T().passItem(it));
  ok('대수·수열만 걸린다', left.length>0 &&
     left.every(it=>T().courseOf(it)==='대수' && T().unitOf(it)==='수열'), left.length);
  ok('요약에 단원이 보인다', /수열/.test($('fsummary').textContent), $('fsummary').textContent);

  console.log('\n[4] 과목을 끄면 단원도 접힌다');
  click(대수); await wait(250);
  ok('단원 안내로 돌아온다', /과목을 고르면/.test($('unitbox').textContent));
  ok('걸러진 것이 없다', T().IT.filter(it=>T().passItem(it)).length===T().IT.length,
     T().IT.filter(it=>T().passItem(it)).length);
  click($('sideClose')); await wait(80);

  console.log('\n[5] 관리자가 고치면 그것이 이긴다');
  const it0=T().IT.find(it=>T().courseOf(it)==='대수');
  const was=T().courseOf(it0)+'/'+T().unitOf(it0);
  T().FIX[it0[2]]=['기하','벡터'];
  ok('고친 값이 나온다', T().courseOf(it0)==='기하' && T().unitOf(it0)==='벡터',
     was+' → '+T().courseOf(it0)+'/'+T().unitOf(it0));
  delete T().FIX[it0[2]];
  ok('지우면 자동값으로 돌아온다', T().courseOf(it0)+'/'+T().unitOf(it0)===was);

  console.log('\n[6] 관리자 화면 — 못 가린 문항을 모아 준다');
  for(let i=0;i<3;i++) click($('title'));
  await wait(60); $('pwIn').value='gich2026'; click($('pwOk')); await wait(120);
  click($('atabFix')); await wait(300);
  ok('탭이 있다', !!$('atabFix'));
  ok('문항 수가 보인다', /문항 [\d,]+개/.test($('adminList').textContent));
  ok('못 가린 수가 보인다', /단원을 못 가린 문항/.test($('adminList').textContent));
  ok('내려받기 단추', [...$('adminFoot').querySelectorAll('button')]
       .some(b=>/JSON으로 저장/.test(b.textContent)));
  const pick=[...doc.querySelectorAll('#adminList .rb button')].find(b=>b.textContent==='단원 고르기');
  ok('바로 고칠 수 있다', !!pick);
  click(pick); await wait(220);
  ok('고치는 창이 열린다', $('modal').classList.contains('open'));
  ok('과목 칩 아홉', doc.querySelectorAll('#fixC .chip').length===9,
     doc.querySelectorAll('#fixC .chip').length);
  ok('단원 칩도 나온다', doc.querySelectorAll('#fixU .chip').length>1,
     doc.querySelectorAll('#fixU .chip').length);
  done();
})();
