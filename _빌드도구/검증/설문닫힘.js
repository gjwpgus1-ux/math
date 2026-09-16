/* 시작 설문을 닫아 둔 상태(GATE_QUOTA=0)에서 앱이 제대로 열리는지 */
const {boot,wait,scorer}=require('./harness');
const H=boot('IT:IT');            // 옵션 없이 = 앱에 적힌 그대로
const {w,doc,$,click,key}=H;
const {ok,done}=scorer();
(async()=>{
  await wait(300);
  console.log('\n[1] 설문이 안 뜬다');
  ['cmp','crs','std'].forEach(id=>
    ok(id+' 안 열림', !$(id).classList.contains('open')));
  ok('문항이 바로 그려진다', doc.querySelectorAll('#grid .card').length>0,
     doc.querySelectorAll('#grid .card').length);

  console.log('\n[2] 커서가 검색창에 붙어 있지 않다');
  ok('검색창에 커서 없음', doc.activeElement!==$('q'),
     doc.activeElement && doc.activeElement.id);
  key('ArrowRight'); await wait(120);
  ok('바로 ← → 로 쪽이 넘어간다', $('pageNow').textContent==='2', $('pageNow').textContent);
  key('/'); await wait(60);
  ok('/ 를 누르면 검색창으로', doc.activeElement===$('q'),
     doc.activeElement && doc.activeElement.id);

  console.log('\n[3] 단추로는 여전히 열 수 있다');
  click($('cmpBtn')); await wait(250);
  ok('유사문항 비교 열림', $('cmp').classList.contains('open'));
  ok('의무 응답 꼴은 아님', !$('cmp').classList.contains('gate'));
  key('Escape'); await wait(60);
  click($('crsBtn')); await wait(250);
  ok('교과목 고르기 열림', $('crs').classList.contains('open'));
  done();
})();
