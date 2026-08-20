/* 출제의도 유사도 — sim.js 의 셋째 값과 W.intent 가 제대로 쓰이는지 본다 */
const fs=require('fs'), path=require('path');
const {boot,wait,scorer}=require('./harness');
const H=boot(); const {w,doc,$,click,key,btn,html}=H;
const {ok,done}=scorer();

const APP=path.join(__dirname,'..','..');
function readJs(p,head){
  const t=fs.readFileSync(path.join(APP,p),'utf8');
  return JSON.parse(t.slice(t.indexOf('=')+1).replace(/;\s*$/,''));
}

(async()=>{
  await wait(200);
  key('1'); key('Enter'); await wait(150);

  console.log('\n[1] sim.js 생김새');
  const SIM=readJs('data/sim.js');
  ok('문항 수만큼 있음', SIM.length===w.QDATA.items.length, SIM.length);
  let two=0, three=0, bad=0;
  SIM.forEach(r=>r.forEach(e=>{
    if(e.length===2) two++;
    else if(e.length===3) three++;
    else bad++;
    if(e.length===3 && !(e[2]>0)) bad++;
  }));
  ok('칸은 둘 아니면 셋', bad===0, bad);
  ok('출제의도 값이 붙은 짝이 있음', three>1000, three);
  ok('없는 짝은 셋째 값을 뺌', two>1000, two);
  let maxI=0, maxT=0;
  SIM.forEach(r=>r.forEach(e=>{
    if((e[2]||0)>maxI) maxI=e[2];
    if(e[1]>maxT) maxT=e[1];
  }));
  ok('출제의도 값은 1000 이하', maxI<=1000 && maxI>0, maxI);
  ok('문장 값도 1000 이하', maxT<=1000, maxT);

  console.log('\n[2] 화면 가중치');
  ok('W.intent 가 있음', /intent:0?\.\d+/.test(html));
  ok('점수에 더해짐', /W\.intent\*intent/.test(html));
  ok('출제의도가 없으면 0으로 봄', /\(pr\[2\]\|\|0\)/.test(html));
  ok('출제의도 파일은 안 실림', !/intent\.js/.test(html));

  console.log('\n[3] 출제의도만 닮은 짝이 실제로 후보에 있다');
  // 문장은 별로 안 닮았는데(<200) 출제의도가 많이 닮은(>=400) 짝 — 예전이라면 못 뽑혔을 것들
  let onlyIntent=0;
  SIM.forEach(r=>r.forEach(e=>{ if((e[2]||0)>=400 && e[1]<200) onlyIntent++; }));
  ok('문장은 안 닮았지만 출제의도로 걸린 짝', onlyIntent>500, onlyIntent);

  console.log('\n[4] 유사문항 목록이 그려진다');
  $('q').value='둘러싸인 부분의 넓이'; $('q').dispatchEvent(new w.Event('input')); await wait(360);
  const card=doc.querySelector('.card');
  const sim=btn(card,'비슷한 문항');
  ok('«비슷한 문항» 단추', !!sim);
  click(sim); await wait(400);
  ok('추천이 나옴', doc.querySelectorAll('.card').length>1, doc.querySelectorAll('.card').length);

  console.log('\n[5] 출제의도 자료');
  const INT=JSON.parse(fs.readFileSync(path.join(APP,'_빌드도구','출제의도.json'),'utf8')
                         .split('=')[1].replace(/;\s*$/,''));
  const n=Object.keys(INT).length;
  ok('4천 문항 넘게 있음', n>4000, n);
  ok('열쇠는 «시험#번호» 꼴', Object.keys(INT).every(k=>/#\d{1,2}$/.test(k)));
  ok('빈 글은 없음', Object.values(INT).every(v=>v && v.length>=4));
  // 고3 선택과목 세 갈래가 서로 다른 출제의도를 갖는지 (섞이면 안 된다)
  const trio=['확통','미적','기하'].map(s=>INT['2023년 10월 고3 '+s+'#30']).filter(Boolean);
  ok('선택과목 30번이 과목마다 다름', new Set(trio).size===trio.length && trio.length===3,
     trio.map(x=>x.slice(0,12)).join(' / '));

  done();
})();
