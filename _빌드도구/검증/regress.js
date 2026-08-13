/* 지금까지 만든 기능이 아직 살아 있는지 한 번에 훑는다 */
const {boot,wait,scorer}=require('./harness');
const H=boot('search:search,parseQuery:parseQuery,heldAt:heldAt,label:label,IT:IT,EX:EX,stdDraft:stdDraft,stdLevelOf:stdLevelOf,stdAdjust:stdAdjust,stdConfirmed:stdConfirmed,STDVset:function(v){STDV=v;STDMAP=null;stdSave();},recommend:recommend,PAIRSset:function(v){PAIRS=v;prefClear();pairSave();},prefAdjust:prefAdjust,WPREF:WPREF,PREF_CAP:PREF_CAP');
const {w,doc,$,click,key,btn,html}=H;
const {ok,done}=scorer();
const T=()=>w.__T;
const n=q=>T().search(q).list.length;
const lab=q=>T().search(q).list.map(it=>T().label(it));
(async()=>{
  await wait(150);

  console.log('\n[0] 수집이 안 되는 환경에서도 앱은 멀쩡해야 한다');
  ok('fetch 없이도 첫 화면이 뜸', $('cmp').classList.contains('open'), 'fetch='+typeof w.fetch);
  ok('문항이 그려짐', doc.querySelectorAll('.card').length>0 || $('cmp').classList.contains('gate'));

  console.log('\n[1] 첫 화면 의무 응답 — 비교와 태깅을 번갈아');
  ok('비교부터', $('cmp').classList.contains('gate'));
  key('1'); key('Enter'); await wait(140);
  ok('한 건이면 통과', !$('cmp').classList.contains('open')&&!$('std').classList.contains('open'));
  key('0'); await wait(20);
  ok('닫힌 뒤엔 키가 안 먹음', !$('cmp').classList.contains('open'));

  console.log('\n[2] 검색');
  ok('쉼표 목록', n('25 고3 3월 1,2,3,7,10,30')===8, n('25 고3 3월 1,2,3,7,10,30'));
  ok('범위', n('25 고3 3월 공통 1~5')===5);
  ok('고3 6·9월 = 모평', lab('고3 6월, 9월 22번').length===30);
  ok('숫자 합집합 (12 12 → 3갈래)', T().parseQuery('12 12').specs.length===3);
  ok('24 6 14 → 한 갈래', T().parseQuery('24 6 14').specs.length===1);
  ok('문구 검색', n('둘러싸인 부분의 넓이')>0);
  ok('과목 별칭', n('확통 정규분포')>0);

  console.log('\n[3] 학년도 · 시행 연월');
  const EX=T().EX;
  ok('26학년도 수능 → 2025년 11월', T().heldAt(EX.find(e=>e.n==='26학년도 수능 공통'))==='2025년 11월 시행');
  ok('전국연합은 없음', T().heldAt(EX.find(e=>e.g==='고3'))==='');

  console.log('\n[4] 두 모드 · 4문항 넘겨보기');
  $('q').value='둘러싸인 부분의 넓이'; $('q').dispatchEvent(new w.Event('input')); await wait(320);
  ok('문항검색 모드 4문항', doc.querySelectorAll('.card').length===4);
  ok('클릭하면 복사 안내', doc.querySelector('.cue').textContent==='클릭하면 복사');
  key('ArrowRight'); await wait(80);
  ok('화살표로 쪽 넘김', $('pageNow').textContent==='2');
  click($('modeStudy')); await wait(90);
  ok('학습 모드도 4문항', doc.querySelectorAll('.card').length===4);
  ok('클릭하면 선택 안내', doc.querySelector('.cue').textContent==='클릭하면 선택');
  click(doc.querySelector('.card .body')); await wait(60);
  ok('그림 클릭 = 선택', $('selCnt').textContent==='선택 1개', $('selCnt').textContent);
  click($('selNone')); await wait(40);

  console.log('\n[5] 필터');
  ok('범위 칩 3개', $('scopebar').querySelectorAll('.chip').length===3);
  ok('필터 접기/열기 문구', $('ftoggle').childNodes[0].nodeValue==='필터 열기');
  click($('ftoggle')); await wait(40);
  const g0=$('filters').querySelector('.fgroup');
  ok('구분 문구', [...g0.querySelectorAll('.chip')].map(c=>c.textContent).join()==='수능,9월모평,6월모평,고1전국,고2전국,고3전국',
     [...g0.querySelectorAll('.chip')].map(c=>c.textContent).join());
  const g1=$('filters').querySelectorAll('.fgroup')[1];
  ok('시행은 3월부터 차례대로', [...g1.querySelectorAll('.chip')].map(c=>c.textContent).join()==='3월,4월,5월,6월,7월,9월,10월,11월',
     [...g1.querySelectorAll('.chip')].map(c=>c.textContent).join());
  click($('ftoggle')); await wait(40);
  ok('화살표 안내', /키로/.test($('keyhint').textContent));

  console.log('\n[6] 성취기준');
  const S=w.QSTD;
  ok('173개 · 8과목', S.items.length===173 && S.subjects.length===8);
  const IT=T().IT, EX2=T().EX;
  let bad=0;
  for(let t=0;t<200;t++){
    const k=Math.floor(Math.random()*IT.length);
    const want=T().stdLevelOf(IT[k]);
    if(T().stdDraft(k,6).some(o=>S.subjects[S.items[o.i][1]][1]!==want)) bad++;
  }
  ok('표본 200문항 학교급 어긋남 0', bad===0, bad);
  const p1=IT[10][2], p2=IT[11][2];
  T().STDVset([{p:p1,cs:['12대수03-01'],who:'uA'},{p:p1,cs:['12대수03-01'],who:'uB'},
               {p:p2,cs:['12확통02-01'],who:'uA'},{p:p2,cs:['12확통02-01'],who:'uB'}]);
  ok('둘 다 확정', T().stdConfirmed(p1).length===1 && T().stdConfirmed(p2).length===1);
  ok('과목 다르면 감점', T().stdAdjust(p1,p2)<0, T().stdAdjust(p1,p2));
  T().STDVset([{p:p1,cs:['12대수03-01','12확통02-01'],who:'uA'},{p:p1,cs:['12대수03-01','12확통02-01'],who:'uB'},
               {p:p2,cs:['12확통02-01'],who:'uA'},{p:p2,cs:['12확통02-01'],who:'uB'}]);
  ok('복수 선택 — 하나만 겹쳐도 가점', T().stdAdjust(p1,p2)>0, T().stdAdjust(p1,p2));
  T().STDVset([]);

  console.log('\n[6-2] 비교 응답이 추천을 움직인다 (약하게)');
  const a0=3, r0=T().recommend(a0,30), j0=r0[0].j;
  const pa=T().IT[a0][2], pb=T().IT[j0][2];
  const s0=r0[0].sc;
  T().PAIRSset([{id:'p1',a:pa,x:pb,y:'zz',c:'x',who:'uA'}]);
  const s1=T().recommend(a0,30).find(x=>x.j===j0).sc;
  ok('«더 비슷» 한 표 → 점수 오름', s1>s0, s0.toFixed(3)+' → '+s1.toFixed(3));
  ok('한 표는 딱 '+T().WPREF+'만큼', Math.abs((s1-s0)-T().WPREF)<1e-9, (s1-s0).toFixed(4));
  T().PAIRSset([{id:'p1',a:pa,x:'zz',y:pb,c:'x',who:'uA'}]);
  const s2=T().recommend(a0,30).find(x=>x.j===j0).sc;
  ok('«덜 비슷» 한 표 → 점수 내림', s2<s0, s0.toFixed(3)+' → '+s2.toFixed(3));
  const many=[]; for(let i=0;i<50;i++) many.push({id:'p'+i,a:pa,x:pb,y:'zz',c:'x',who:'u'+i});
  T().PAIRSset(many);
  const s3=T().recommend(a0,30).find(x=>x.j===j0).sc;
  ok('아무리 쌓여도 한도 '+T().PREF_CAP+'을 안 넘음', Math.abs((s3-s0)-T().PREF_CAP)<1e-9, (s3-s0).toFixed(4));
  ok('한도가 성취기준 가점(0.30)보다 작음', T().PREF_CAP<0.30);
  T().PAIRSset([]);
  ok('응답이 없으면 영향 0', T().prefAdjust(pa,pb)===0);
  // 관리자 화면을 보기 위해 표본 응답을 되돌려 놓는다
  T().PAIRSset([{id:'z1',a:pa,x:pb,y:T().IT[j0+1][2],c:'x',sx:1,sy:1,bx:1,by:1,who:'uA',at:'2026-01-01'}]);

  console.log('\n[7] 관리자');
  for(let i=0;i<3;i++) click($('title'));
  await wait(30);
  $('pwIn').value='gich2026'; click($('pwOk')); await wait(60);
  ok('진입', $('admin').classList.contains('open'));
  ok('전체 폭', /\.drawer\{[^}]*right:0;left:0/.test(html));
  click($('atabCmp')); await wait(60);
  ok('비교데이터 이미지 바로 보임', doc.querySelectorAll('#adminList .cmprow .cmpimgs img').length>0);
  click($('atabStd')); await wait(60);
  ok('성취기준 탭', /성취기준 응답/.test($('adminList').textContent));
  click($('adminClose')); await wait(40);

  console.log('\n[8] 인쇄');
  click($('modeStudy')); await wait(60);
  $('q').value='25 고3 3월 공통 1~4'; $('q').dispatchEvent(new w.Event('input')); await wait(340);
  click($('selAll')); await wait(80);
  const b=w.__printed||0;
  click($('printWork')); await wait(400);
  ok('학습지 인쇄', (w.__printed||0)>b);
  ok('풀이 횟수 칸', doc.querySelectorAll('.sheet .sbox').length>0);
  ok('1회 문구', /1회/.test(doc.querySelector('.sheet').textContent));
  done();
})();
