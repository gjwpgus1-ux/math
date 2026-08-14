const {boot,wait,scorer}=require('./harness');
const H=boot('IT:IT,EX:EX,crsMap:crsMap,crsOf:crsOf,crsAdjust:crsAdjust,CRS_OPT:CRS_OPT,CRSset:function(v){CRSV=v;CRSMAP=null;crsSave();},WCRS:WCRS');
const {w,doc,$,click,key,html}=H;
const {ok,done}=scorer();
const T=()=>w.__T;
const open=id=>$(id).classList.contains('open');
(async()=>{
  await wait(180);

  console.log('\n[1] 첫 화면 — 비교 다음은 교과목');
  ok('비교부터', open('cmp')&&$('cmp').classList.contains('gate'));
  key('0'); await wait(100);
  ok('교과목 화면이 뜸', open('crs'), 'cmp='+open('cmp')+' crs='+open('crs')+' std='+open('std'));
  ok('성취기준은 안 뜸', !open('std'));
  ok('게이트 안내 이어짐', /하나만 더 부탁/.test($('crsGateMsg').textContent), $('crsGateMsg').textContent);

  console.log('\n[2] 고를 것 여덟 가지');
  const bs=[...$('crsBtns').querySelectorAll('button')];
  ok('단추 8개', bs.length===8, bs.length);
  const names=bs.map(b=>b.children[1].textContent);
  ok('여덟 갈래가 순서대로',
     names.join(',')==='중학교,고1,대수,미적분Ⅰ,미적분Ⅱ,기하,확률과 통계,22개정에 해당 없음', names.join(','));
  const subs=bs.map(b=>{const s=b.querySelector('.sub'); return s?s.textContent:'';});
  ok('15개정 표기', subs[2]==='15개정 수학Ⅰ'&&subs[3]==='15개정 수학Ⅱ'&&subs[4]==='15개정 미적분',
     subs.filter(Boolean).join(' / '));
  ok('번호 붙음', bs.map(b=>b.querySelector('.k').textContent).join(',')==='1,2,3,4,5,6,7,8');
  ok('문항 그림', !!$('crsImg').querySelector('img'));
  ok('질문 문구', /교과목/.test(doc.querySelector('#crs .rq').textContent));
  ok('AI 문구', /함께 만들어가는 AI/.test(doc.querySelector('#crs .rtag').textContent));

  console.log('\n[3] 답하면 저장되고 통과');
  click(bs[2]); await wait(130);
  const V=JSON.parse(w.localStorage.getItem('gich_crs')||'[]');
  ok('1건 저장', V.length===1, V.length);
  ok('«대수»로 기록', V[0].c==='대수', V[0].c);
  ok('종류 표시', V[0].t==='crs');
  ok('익명번호', /^u[a-z0-9]{6}$/.test(V[0].who), V[0].who);
  ok('게이트 닫힘', !open('cmp')&&!open('crs'));

  console.log('\n[4] 단추로 열고 키보드로');
  click($('crsBtn')); await wait(130);
  ok('열림', open('crs'));
  ok('게이트 아님', !$('crs').classList.contains('gate'));
  key('7'); await wait(110);
  let L=JSON.parse(w.localStorage.getItem('gich_crs'));
  ok('7키 → 확률과 통계', L[L.length-1].c==='확률과 통계', L[L.length-1].c);
  key('8'); await wait(110);
  L=JSON.parse(w.localStorage.getItem('gich_crs'));
  ok('8키 → 해당없음', L[L.length-1].c==='해당없음', L[L.length-1].c);
  key('0'); await wait(110);
  L=JSON.parse(w.localStorage.getItem('gich_crs'));
  ok('0키 → 잘 모르겠음', L[L.length-1].c==='', JSON.stringify(L[L.length-1].c));
  const n0=L.length;
  click($('crsSkip')); await wait(90);
  ok('건너뛰기는 답 아님', JSON.parse(w.localStorage.getItem('gich_crs')).length===n0);
  key('Escape'); await wait(40);
  ok('Esc로 닫힘', !open('crs'));

  console.log('\n[5] 확정 판정');
  const p1=T().IT[10][2], p2=T().IT[11][2];
  T().CRSset([{p:p1,c:'대수',who:'uA'}]);
  ok('1명이면 미확정', !T().crsOf(p1));
  T().CRSset([{p:p1,c:'대수',who:'uA'},{p:p1,c:'대수',who:'uB'}]);
  ok('2명이 같으면 확정', T().crsOf(p1)==='대수', T().crsOf(p1));
  T().CRSset([{p:p1,c:'대수',who:'uA'},{p:p1,c:'기하',who:'uB'}]);
  ok('갈리면 미확정', !T().crsOf(p1));
  T().CRSset([{p:p1,c:'',who:'uA'},{p:p1,c:'',who:'uB'}]);
  ok('잘 모르겠음은 확정 안 됨', !T().crsOf(p1));

  console.log('\n[6] 추천에 주는 영향');
  T().CRSset([{p:p1,c:'대수',who:'uA'},{p:p1,c:'대수',who:'uB'},
              {p:p2,c:'대수',who:'uA'},{p:p2,c:'대수',who:'uB'}]);
  ok('같은 교과목 → 가점', T().crsAdjust(p1,p2)===T().WCRS.same, T().crsAdjust(p1,p2));
  T().CRSset([{p:p1,c:'대수',who:'uA'},{p:p1,c:'대수',who:'uB'},
              {p:p2,c:'기하',who:'uA'},{p:p2,c:'기하',who:'uB'}]);
  ok('다른 교과목 → 감점', T().crsAdjust(p1,p2)===T().WCRS.diff, T().crsAdjust(p1,p2));
  T().CRSset([{p:p1,c:'해당없음',who:'uA'},{p:p1,c:'해당없음',who:'uB'},
              {p:p2,c:'기하',who:'uA'},{p:p2,c:'기하',who:'uB'}]);
  ok('«해당 없음»은 견주지 않음', T().crsAdjust(p1,p2)===0);
  T().CRSset([{p:p1,c:'대수',who:'uA'},{p:p1,c:'대수',who:'uB'}]);
  ok('한쪽만 확정이면 영향 없음', T().crsAdjust(p1,p2)===0);
  T().CRSset([]);
  ok('응답 없으면 영향 없음', T().crsAdjust(p1,p2)===0);
  // 관리자 화면을 보기 위해 표본을 되돌려 놓는다
  T().CRSset([{id:'z1',p:p1,c:'대수',who:'uA',at:'2026-01-01'},
              {id:'z2',p:p2,c:'',who:'uB',at:'2026-01-01'}]);

  console.log('\n[7] 성취기준 기능은 그대로');
  ok('성취기준 단추 있음', !!$('stdBtn'));
  click($('stdBtn')); await wait(220);
  ok('성취기준 화면 열림', open('std'));
  ok('후보가 뜸', $('stdCands').querySelectorAll('.scand').length>0);
  click($('stdClose')); await wait(40);

  console.log('\n[8] 관리자 교과목 탭');
  for(let i=0;i<3;i++) click($('title'));
  await wait(30);
  $('pwIn').value='gich2026'; click($('pwOk')); await wait(60);
  ok('탭 있음', !!$('atabCrs'));
  click($('atabCrs')); await wait(90);
  const t=$('adminList').textContent;
  ok('응답 수 표시', /교과목 응답 \d+건/.test(t), t.slice(0,28));
  ok('확정 표시', /확정/.test(t));
  ok('추천 영향 설명', /같은 교과목/.test(t));
  ok('응답 목록', doc.querySelectorAll('#adminList .cmprow').length>0);
  ok('CSV 단추 2개', ['교과목 응답 CSV로 저장','확정 목록 CSV로 저장']
     .every(x=>[...$('adminFoot').querySelectorAll('button')].some(b=>b.textContent===x)));
  ok('시트로도 보냄', /t:'crs'/.test(html));
  done();
})();
