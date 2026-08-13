const {boot,wait,scorer}=require('./harness');
const H=boot(); const {w,doc,$,click,key,btn,html}=H;
const {ok,done}=scorer();
const open=id=>$(id).classList.contains('open');
(async()=>{
  await wait(180);

  console.log('\n[1] 의무 응답은 딱 한 건');
  ok('비교 화면이 열림', open('cmp') && $('cmp').classList.contains('gate'));
  ok('안내가 «한 문제»', /딱 한 문제만/.test($('cmpGateMsg').textContent), $('cmpGateMsg').textContent);
  ok('닫기 단추는 숨김', /#cmp\.gate #cmpClose\{display:none\}/.test(html));
  key('1'); await wait(40);
  ok('아직 안 닫힘 (고르기만 함)', open('cmp'));
  key('Enter'); await wait(90);
  ok('한 건 답하면 통과', !open('cmp') && !open('std'));
  const P=JSON.parse(w.localStorage.getItem('gich_pairs')||'[]');
  ok('응답 1건만 저장', P.length===1, P.length);
  ok('«왼쪽»으로 기록', P[0].c==='x', P[0].c);

  console.log('\n[2] 새 화면 짜임새');
  click($('cmpBtn')); await wait(90);
  ok('기준 · 후보2 · 단추 3칸', /#cmp \.cb\{[^}]*grid-template-columns:1fr 2fr 230px/.test(html));
  ok('가운데에 후보 둘', $('cmpP1').parentElement.className==='cmid' &&
     $('cmpP2').parentElement.className==='cmid');
  ok('오른쪽에 확정·잘모름', $('cmpOk').parentElement.className==='crail' &&
     $('cmpUnsure').parentElement.className==='crail');
  ok('예전 4개 단추는 없어짐', !$('cmpA') && !$('cmpB') && !$('cmpBoth'));

  console.log('\n[3] 골랐다 풀었다');
  ok('처음엔 아무것도 안 골림', !$('cmpP1').classList.contains('on') && !$('cmpP2').classList.contains('on'));
  ok('확정 문구 «둘 다 다름»', $('cmpOk').textContent==='둘 다 다름으로 확정', $('cmpOk').textContent);
  click($('cmpP1')); await wait(30);
  ok('1번 켜짐', $('cmpP1').classList.contains('on'));
  ok('문구 «이것으로»', $('cmpOk').textContent==='이것으로 확정', $('cmpOk').textContent);
  click($('cmpP2')); await wait(30);
  ok('둘 다 켜짐', $('cmpP1').classList.contains('on') && $('cmpP2').classList.contains('on'));
  ok('문구 «둘 다 비슷»', $('cmpOk').textContent==='둘 다 비슷으로 확정', $('cmpOk').textContent);
  click($('cmpP1')); await wait(30);
  ok('다시 누르면 취소', !$('cmpP1').classList.contains('on'));
  click($('cmpP2')); await wait(30);
  ok('둘 다 취소됨', !$('cmpP2').classList.contains('on'));
  ok('살짝 확대 + 테두리', /#cmp \.cc\.pick\.on\{[^}]*transform:scale\(1\.015\)/.test(html) &&
     /#cmp \.cc\.pick\.on\{[^}]*border-color:var\(--accent\)/.test(html));
  ok('체크 표시', !!$('cmpP1').querySelector('.tick'));

  console.log('\n[4] 네 가지 답이 다 나온다');
  const n0=JSON.parse(w.localStorage.getItem('gich_pairs')).length;
  const last=()=>JSON.parse(w.localStorage.getItem('gich_pairs')).slice(-1)[0].c;
  click($('cmpOk')); await wait(80);
  ok('아무것도 안 고르면 «둘 다 다름»', last()==='none', last());
  click($('cmpP1')); click($('cmpOk')); await wait(80);
  ok('1번만 → «왼쪽»', last()==='x', last());
  click($('cmpP2')); click($('cmpOk')); await wait(80);
  ok('2번만 → «오른쪽»', last()==='y', last());
  click($('cmpP1')); click($('cmpP2')); click($('cmpOk')); await wait(80);
  ok('둘 다 → «둘 다 비슷»', last()==='both', last());
  click($('cmpUnsure')); await wait(80);
  ok('잘 모르겠음', last()==='unsure');
  ok('5건 늘어남', JSON.parse(w.localStorage.getItem('gich_pairs')).length===n0+5);

  console.log('\n[5] 키보드');
  key('1'); await wait(30);
  ok('1키로 고르기', $('cmpP1').classList.contains('on'));
  key('1'); await wait(30);
  ok('1키로 취소', !$('cmpP1').classList.contains('on'));
  key('2'); key('Enter'); await wait(80);
  ok('Enter로 확정', last()==='y', last());
  key('0'); await wait(80);
  ok('0키는 잘 모르겠음', last()==='unsure');
  key('Escape'); await wait(40);
  ok('Esc로 닫힘 (의무가 아닐 때)', !open('cmp'));
  done();
})();
