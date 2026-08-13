const {boot,wait,scorer}=require('./harness');
const H=boot(); const {w,doc,$,click,key,html}=H;
const {ok,done}=scorer();
const css=re=>re.test(html);
(async()=>{
  await wait(180);

  console.log('\n[1] 유사문항 비교 — B안 (오른쪽 안내판)');
  ok('비교 화면 열림', $('cmp').classList.contains('open'));
  ok('안내판이 오른쪽 칸', $('cmpOk').parentElement.className==='crail');
  ok('질문이 안내판 안', !!doc.querySelector('#cmp .crail .rq'));
  const rq=doc.querySelector('#cmp .crail .rq').textContent;
  ok('질문 문구', /비슷한 것.*고르세요/.test(rq), rq.trim());
  const tag=doc.querySelector('#cmp .crail .rtag').textContent;
  ok('AI 문구 들어감', /함께 만들어가는 AI 유사문항 추천 시스템/.test(tag), tag.trim().slice(0,40));
  ok('완성도 문구', /정확한 응답이 모여 완성도가 올라갑니다/.test(tag));
  ok('질문 글씨 17px', css(/\.crail \.rq\{[^}]*font-size:17px/));
  ok('가운데 질문줄은 없어짐', !doc.querySelector('#cmp .cq'));
  ok('문항 높이 40vh', css(/#cmp \.ci\{[^}]*max-height:40vh/));
  ok('3칸 배치', css(/#cmp \.cb\{[^}]*grid-template-columns:1fr 2fr 230px/));

  console.log('\n[2] 성취기준 — 왼쪽 문항 40% · 오른쪽 한 단');
  key('1'); key('Enter'); await wait(140);
  click($('stdBtn')); await wait(200);
  ok('성취기준 화면 열림', $('std').classList.contains('open'));
  ok('두 칸 · 왼쪽 40%', css(/#std \.sb\{[^}]*grid-template-columns:40% 1fr/));
  const sp2=doc.querySelector('#std .sp2');
  ok('질문이 오른쪽 단 안', sp2.contains(doc.querySelector('#std .rq')));
  ok('목록도 같은 단', sp2.contains($('stdCands')));
  ok('검색창도 같은 단', sp2.contains($('stdQ')));
  ok('저장 단추도 같은 단', sp2.contains($('stdOk')));
  ok('잘 모르겠음도 같은 단', sp2.contains($('stdUnsure')));
  ok('해당 없음도 같은 단', sp2.contains($('stdNone')));
  ok('오른쪽 별도 안내판 없음', !doc.querySelector('#std .crail'));
  const srq=doc.querySelector('#std .rq').textContent;
  ok('질문 문구', /성취기준.*고르세요/.test(srq), srq.trim());
  const stag=doc.querySelector('#std .rtag').textContent;
  ok('AI 문구', /함께 만들어가는 AI 유사문항 추천 시스템/.test(stag));
  ok('완성도 문구', /정확한 응답이 모여 완성도가 올라갑니다/.test(stag));
  ok('질문 글씨 19px', css(/#std \.stop \.rq\{[^}]*font-size:19px/));

  console.log('\n[3] 성취기준 글씨와 후보 수');
  ok('본문 15px', css(/\.scand \.bd\{[^}]*font-size:15px/));
  ok('카드 자체도 15px', css(/\.scand\{[^}]*font-size:15px/));
  const cands=[...$('stdCands').querySelectorAll('.scand')];
  ok('후보 4개 이하', cands.length<=4 && cands.length>0, cands.length);
  ok('코드는 작게 12px', css(/\.scand \.cd\{[^}]*font-size:12px/));
  ok('문항 그림 있음', !!$('stdImg').querySelector('img'));

  console.log('\n[4] 고르고 저장하기');
  ok('처음엔 잠김', $('stdOk').disabled);
  ok('«아직 고르지 않았습니다»', /아직 고르지 않았습니다/.test($('stdSel').textContent));
  key('1'); await wait(40);
  ok('1키로 켜짐', cands[0].classList.contains('on'));
  ok('단추 열림', !$('stdOk').disabled);
  ok('단추 문구', $('stdOk').textContent==='이 1개로 저장', $('stdOk').textContent);
  ok('고른 것 알약', $('stdSel').querySelectorAll('.stag').length===1);
  if(cands.length>1){
    key('2'); await wait(40);
    ok('두 개', $('stdOk').textContent==='이 2개로 저장', $('stdOk').textContent);
    key('2'); await wait(40);
  }
  const n0=JSON.parse(w.localStorage.getItem('gich_std')||'[]').length;
  key('Enter'); await wait(120);
  ok('저장됨', JSON.parse(w.localStorage.getItem('gich_std')).length===n0+1);
  ok('저장 뒤 다시 잠김', $('stdOk').disabled);

  console.log('\n[5] 검색은 그대로');
  $('stdQ').value='등차수열'; $('stdQ').dispatchEvent(new w.Event('input')); await wait(80);
  const hits=[...$('stdHits').querySelectorAll('.scand')];
  ok('검색 결과', hits.length>0, hits.length);
  ok('검색 결과도 큰 글씨', css(/\.scand \.bd\{[^}]*font-size:15px/));
  click(hits[0]); await wait(40);
  ok('검색 결과 고르기', $('stdSel').querySelectorAll('.stag').length>=1);
  click($('stdOk')); await wait(100);
  ok('저장', JSON.parse(w.localStorage.getItem('gich_std')).length===n0+2);
  click($('stdClose')); await wait(40);
  ok('닫힘', !$('std').classList.contains('open'));
  done();
})();
