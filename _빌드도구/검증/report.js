/* 오류제보 — 체크박스로 간소화한 뒤의 동작을 확인한다 */
const {boot,wait,scorer}=require('./harness');
const H=boot(); const {w,doc,$,click,key,btn,html}=H;
const {ok,done}=scorer();

/* 해설이 있는 카드 / 없는 카드를 가려 고른다 (해설 단추가 붙어 있는지로 안다) */
function cardWithSol(want){
  return [...doc.querySelectorAll('.card')].find(function(c){
    return !!btn(c,'해설')===want;
  });
}
function openRep(want){
  click(btn(cardWithSol(want===undefined?true:want),'오류제보'));
}
function tick(i){
  const c=$('rpK'+i); c.checked=true;
  c.dispatchEvent(new w.Event('change',{bubbles:true}));
}

(async()=>{
  await wait(150);
  key('1'); key('Enter'); await wait(120);   /* 의무 응답 1건 */
  $('q').value='둘러싸인 부분의 넓이'; $('q').dispatchEvent(new w.Event('input')); await wait(340);

  console.log('\n[1] 고를 거리');
  openRep(); await wait(80);
  ok('팝업 열림', $('modal').classList.contains('open'));
  ok('좁은 팝업', !$('mbox').classList.contains('wide'));
  const boxes=$('rpKinds').querySelectorAll('input[type=checkbox]');
  ok('일곱 가지', boxes.length===7, boxes.length);
  const vals=[...boxes].map(b=>b.value);
  ok('문제 잘림', vals.includes('문제 잘림'));
  ok('해설 잘림', vals.includes('해설 잘림'));
  ok('다른 내용 섞임', vals.includes('다른 내용 섞임'));
  ok('해설 짝 안 맞음', vals.includes('해설 짝 안 맞음'));
  ok('정답 틀림', vals.includes('정답 틀림'));
  ok('시험 정보 틀림', vals.includes('시험 정보 틀림'));
  ok('검색 엉뚱함', vals.includes('검색 엉뚱함'));
  ok('예전 드롭다운은 없앰', !$('rpKind'));
  ok('메모는 한 줄 칸', $('rpMemo') && $('rpMemo').tagName==='INPUT', $('rpMemo')&&$('rpMemo').tagName);
  ok('메모 길이 제한', $('rpMemo').getAttribute('maxlength')==='120');
  const t=$('mbox').textContent;
  ok('여러 개 고를 수 있다고 알림', /여러 개/.test(t));
  ok('어느 문항인지 보임', /\d+번|둘러/.test(t) || /\.png/.test(t));

  console.log('\n[2] 검색어 칸은 필요할 때만');
  ok('처음엔 숨김', $('rpQwrap').style.display==='none');
  const qi=[...boxes].findIndex(b=>b.value==='검색 엉뚱함');
  tick(qi); await wait(40);
  ok('«검색 엉뚱함»을 고르면 나타남', $('rpQwrap').style.display!=='none');
  $('rpK'+qi).checked=false;
  $('rpK'+qi).dispatchEvent(new w.Event('change',{bubbles:true})); await wait(40);
  ok('풀면 다시 숨음', $('rpQwrap').style.display==='none');

  console.log('\n[3] 고른 것 표시');
  tick(0); await wait(30);
  ok('고른 줄에 표시', $('rpL0').classList.contains('on'));
  $('rpK0').checked=false; $('rpK0').dispatchEvent(new w.Event('change',{bubbles:true})); await wait(30);
  ok('풀면 표시도 풀림', !$('rpL0').classList.contains('on'));

  console.log('\n[4] 하나도 안 고르면 안 보냄');
  const n0=(w.__reports||[]).length;
  click($('rpOk')); await wait(120);
  ok('팝업이 그대로 열려 있음', $('modal').classList.contains('open'));
  ok('알림이 뜸', /하나 이상/.test($('toast')?$('toast').textContent:''), $('toast')&&$('toast').textContent);

  console.log('\n[5] 여러 개 골라 보내기');
  tick(0); tick(4); await wait(30);
  $('rpMemo').value='선택지 ⑤가 안 보여요';
  click($('rpOk')); await wait(200);
  ok('팝업 닫힘', !$('modal').classList.contains('open'));
  const R=JSON.parse(w.localStorage.getItem('gich_reports')||'[]');
  ok('제보 1건 쌓임', R.length>=1, R.length);
  const r=R[0];
  ok('고른 것이 · 로 이어짐', r.kind==='문제 잘림 · 정답 틀림', r.kind);
  ok('메모 그대로', r.memo==='선택지 ⑤가 안 보여요', r.memo);
  ok('파일 경로', /\.png$/.test(r.path||''), r.path);
  ok('시험·문항 이름', !!r.label, r.label);

  console.log('\n[6] 검색어를 적으면 메모 앞에 붙는다');
  openRep(); await wait(80);
  const qi2=[...$('rpKinds').querySelectorAll('input')].findIndex(b=>b.value==='검색 엉뚱함');
  tick(qi2); await wait(30);
  $('rpQ').value='등비수열 극한';
  $('rpMemo').value='전혀 다른 단원이에요';
  click($('rpOk')); await wait(200);
  const R2=JSON.parse(w.localStorage.getItem('gich_reports')||'[]');
  ok('제보 2건', R2.length>=2, R2.length);
  ok('검색어가 메모에 담김', /검색어 「등비수열 극한」/.test(R2[0].memo), R2[0].memo);
  ok('덧붙인 말도 함께', /전혀 다른 단원이에요/.test(R2[0].memo), R2[0].memo);

  console.log('\n[7] 검색어를 안 고르면 안 붙는다');
  openRep(); await wait(80);
  tick(1);
  click($('rpOk')); await wait(200);
  const R3=JSON.parse(w.localStorage.getItem('gich_reports')||'[]');
  ok('메모 비어 있음', R3[0].memo==='', JSON.stringify(R3[0].memo));
  ok('유형은 해설 잘림', R3[0].kind==='해설 잘림', R3[0].kind);

  console.log('\n[8] 해설이 없는 문항에는 해설 항목을 안 보여 준다');
  const noSol=cardWithSol(false);
  ok('해설 없는 문항이 있음', !!noSol);
  click(btn(noSol,'오류제보')); await wait(90);
  const v2=[...$('rpKinds').querySelectorAll('input')].map(b=>b.value);
  ok('다섯 가지만', v2.length===5, v2.join(','));
  ok('«해설 잘림» 없음', !v2.includes('해설 잘림'));
  ok('«해설 짝 안 맞음» 없음', !v2.includes('해설 짝 안 맞음'));
  ok('나머지는 그대로', v2.includes('문제 잘림') && v2.includes('정답 틀림')
                        && v2.includes('시험 정보 틀림') && v2.includes('검색 엉뚱함'));
  key('Escape'); await wait(40);

  console.log('\n[9] 생김새');
  ok('세로로 쌓임', /#rpKinds\{[^}]*flex-direction:column/.test(html));
  ok('고른 줄 강조 규칙', /#rpKinds label\.on\{/.test(html));
  ok('네모 크기 지정', /#rpKinds input\{[^}]*width:16px/.test(html));

  done();
})();
