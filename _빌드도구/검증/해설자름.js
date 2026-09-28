/* 해설 그림이 제대로 잘렸는지 — 2026년 9월 오류제보로 드러난 세 가지 */
const {boot,wait,scorer}=require('./harness');
const H=boot('IT:IT,EX:EX,solOf:solOf');
const {w,doc,$,click,html}=H;
const {ok,done}=scorer();
const T=()=>w.__T;
const SOL=()=>w.QSOL;

(async()=>{
  await wait(200);
  const Q=SOL();
  ok('해설이 실려 있다', Object.keys(Q).length>3800, Object.keys(Q).length);

  /* ① 단을 못 나눠 쪽 너비를 통째로 잘라 오던 것.
        해설지에 세로줄이 그어져 있으면 그것으로 단을 나눈다(rule_cols).
        2019년 10월 고3만 남는다 — 그 해설지는 애초에 단이 하나다. */
  console.log('\n[1] 가로로 길게 붙은 해설');
  const wide=Object.keys(Q).filter(k=>Q[k][1]>1200);
  const wideEx=[...new Set(wide.map(k=>k.split('#')[0]))].sort();
  console.log('   너비 1200 넘는 해설 '+wide.length+'개 · '+wideEx.join(', '));
  ok('스무 개 아래로 줄었다', wide.length<=20, wide.length);
  ok('2019년 10월 고3만 남았다',
     wideEx.every(e=>/^2019년 10월 고3/.test(e)), wideEx.join(', '));

  /* ② 확통·미적·기하 해설이 한 그림에 다 들어가던 것.
        셋이 똑같은 크기면 같은 그림을 세 번 저장했다는 뜻이다. */
  console.log('\n[2] 선택과목 해설이 갈라졌는가');
  const by={};
  for(const k of Object.keys(Q)){
    const [ex,no]=k.split('#');
    const m=/^(.*) (확통|미적|기하)$/.exec(ex);
    if(!m) continue;
    (by[m[1]+'#'+no]=by[m[1]+'#'+no]||{})[m[2]]=Q[k][1]+'x'+Q[k][2];
  }
  const same=Object.keys(by).filter(k=>{
    const v=Object.values(by[k]);
    return v.length>=2 && new Set(v).size===1;
  });
  console.log('   셋이 똑같은 것 '+same.length+'개'+(same.length?' · '+same.slice(0,4).join(', '):''));
  ok('세 과목 해설이 저마다 다르다', same.length===0, same.slice(0,6).join(', '));

  /* 2025년 7월 고3 23번 — 제보가 들어온 바로 그 문항 */
  const t3=['확통','미적','기하'].map(s=>Q['2025년 7월 고3 '+s+'#23']);
  ok('2025년 7월 고3 23번 셋 다 있다', t3.every(Boolean));
  ok('셋의 크기가 다르다', new Set(t3.map(v=>v&&v[1]+'x'+v[2])).size===3,
     t3.map(v=>v&&v[1]+'x'+v[2]).join(' / '));

  /* ③ 가로로 긴 해설은 원래 크기로 펼쳐 볼 수 있어야 한다 */
  console.log('\n[3] 원래 크기로 보기');
  ok('규칙이 있다', /\.solbox\.raw img\{max-width:none\}/.test(html));
  const it=T().IT.find(x=>{ const s=T().solOf(x); return s&&s[1]>1200; });
  ok('가로로 긴 해설이 붙은 문항이 있다', !!it);
  const narrow=T().IT.find(x=>{ const s=T().solOf(x); return s&&s[1]<=1200; });
  ok('폭이 알맞은 해설도 있다', !!narrow);
  ok('단추는 너비를 보고 붙인다', /s\[1\]>1200 \? '<button id="solZoom">/.test(html));
  ok('누르면 raw 로 바뀐다', /classList\.toggle\('raw'\)/.test(html));
  ok('글귀가 바뀐다', /폭 맞추기/.test(html) && /원래 크기로/.test(html));

  /* ④ 문항 그림 꼬리 — 글이 끝난 뒤 단 아래까지 잘려 오던 것 */
  console.log('\n[4] 문항 그림이 너무 길지 않은가');
  const tall=T().IT.filter(x=>x[4]>1900);
  console.log('   높이 1900 넘는 문항 '+tall.length+'개');
  ok('백 개 아래로 줄었다', tall.length<100, tall.length);
  const rep=[['go3/002_30.png',2010],['go1x/004_30.png',2114],['go2m/009_21.png',577]];
  rep.forEach(([p,was])=>{
    const x=T().IT.find(i=>i[2]===p);
    ok(p+' 가 짧아졌다', x && x[4]<was, x && x[4]);
  });
  done();
})();
