const {boot,wait,scorer}=require('./harness');
const H=boot(); const {w,doc,$,click,key,btn,html}=H;
const {ok,done}=scorer();
(async()=>{
  await wait(150);
  key('1'); key('Enter'); await wait(120);   /* 의무 응답 1건 */

  console.log('\n[1] 팁 단추');
  ok('단추 있음', !!$('tipBtn'), $('tipBtn')&&$('tipBtn').textContent);
  ok('학습 도구줄 안에', $('studybar').contains($('tipBtn')));
  ok('«오답노트 인쇄» 옆', $('printNote').nextElementSibling===$('tipBtn'));
  click($('modeStudy')); await wait(80);
  ok('학습 모드에서 보임', $('studybar').classList.contains('on'));

  console.log('\n[2] 팝업 내용');
  click($('tipBtn')); await wait(60);
  ok('팝업 열림', $('modal').classList.contains('open'));
  ok('넓은 팝업', $('mbox').classList.contains('wide'));
  const t=$('mbox').textContent;
  ok('제목', /오답노트 쉽게 만드는 법/.test(t));
  const items=$('mbox').querySelectorAll('.tip h4');
  ok('아홉 가지', items.length===9, items.length);
  ok('번호 매김', [...items].map(h=>h.querySelector('i').textContent).join()==='1,2,3,4,5,6,7,8,9');
  ok('쉼표 검색 예시', /1,2,3,7,10,30/.test(t));
  ok('배경 그래픽 주의', /배경 그래픽/.test(t) && !!$('mbox').querySelector('.warn2'));
  ok('PDF로 저장 안내', /PDF로 저장/.test(t));
  ok('풀이 횟수 칸 설명', /1회/.test(t)&&/2회/.test(t));
  ok('비슷한 문항 연계', /비슷한 문항/.test(t));
  ok('예시 상자 3개', $('mbox').querySelectorAll('.ex').length===3, $('mbox').querySelectorAll('.ex').length);
  ok('팝업이 화면 밖으로 안 나가게', /\.mbox\.wide\{[^}]*max-height:86vh/.test(html));

  console.log('\n[3] 닫기');
  click($('tipOk')); await wait(40);
  ok('닫힘', !$('modal').classList.contains('open'));
  ok('넓은 상태 풀림', !$('mbox').classList.contains('wide'));
  click($('tipBtn')); await wait(60);
  key('Escape'); await wait(40);
  ok('Esc로도 닫힘', !$('modal').classList.contains('open'));
  ok('Esc 뒤에도 넓은 상태 풀림', !$('mbox').classList.contains('wide'));
  click($('tipBtn')); await wait(60);
  click($('modal')); await wait(40);
  ok('바깥을 눌러도 닫힘', !$('modal').classList.contains('open'));

  console.log('\n[4] 다른 팝업은 좁게');
  click($('modeSearch')); await wait(80);
  $('q').value='둘러싸인 부분의 넓이'; $('q').dispatchEvent(new w.Event('input')); await wait(320);
  click(btn(doc.querySelector('.card'),'오류제보')); await wait(60);
  ok('오류제보 팝업은 좁게', $('modal').classList.contains('open') && !$('mbox').classList.contains('wide'));
  key('Escape'); await wait(40);

  console.log('\n[5] 팁대로 해 보기 — 쉼표 검색 → 전체 선택 → 오답노트');
  click($('modeStudy')); await wait(80);
  $('q').value='25 고3 3월 1,2,3,7,10,30'; $('q').dispatchEvent(new w.Event('input')); await wait(340);
  ok('8문항 검색', /8<\/b>문항/.test($('status').innerHTML), $('status').textContent.slice(-18));
  click($('selAll')); await wait(90);
  ok('8개 선택', $('selCnt').textContent==='선택 8개', $('selCnt').textContent);
  const before=w.__printed||0;
  click($('printNote')); await wait(500);
  ok('오답노트 인쇄됨', (w.__printed||0)>before);
  ok('8장', doc.querySelectorAll('.sheet').length===8, doc.querySelectorAll('.sheet').length);
  ok('장마다 풀이 횟수 칸', doc.querySelectorAll('.sheet .sbox').length===8);
  ok('쪽 번호', /1 \/ 8/.test(doc.querySelector('.sheet').textContent));
  ok('가운데 구분선', !!doc.querySelector('.sheet .divider, .sheet .nleft, .sheet .nright')
     || /border-left/.test(html));
  done();
})();
