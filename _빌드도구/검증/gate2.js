const {boot,wait,scorer}=require('./harness');
const {ok,done}=scorer();
const open=(H,id)=>H.$(id).classList.contains('open');
(async()=>{
  /* 비교를 모르겠다고 하면 교과목으로 한 번 더 묻는다.
     그런데 교과목까지 모르겠다고 하면 더 붙잡지 않고 그냥 들여보낸다 —
     여기서 또 되물으면 앱에 들어가지도 못하고 맴돌게 되기 때문이다. */
  console.log('\n[1] 비교를 모르겠으면 교과목으로, 거기서도 모르겠으면 통과');
  let H=boot(); await wait(180);
  ok('비교부터', open(H,'cmp'));
  H.key('0'); await wait(90);                       // 잘 모르겠음
  ok('안 닫힘', open(H,'cmp')||H.$('crs').classList.contains('open'));
  ok('이번엔 교과목 화면', H.$('crs').classList.contains('open'),
     'cmp='+open(H,'cmp')+' crs='+H.$('crs').classList.contains('open')+' std='+open(H,'std'));
  ok('안내가 바뀜', /하나만 더 부탁/.test(H.$('crsGateMsg').textContent), H.$('crsGateMsg').textContent);
  H.key('0'); await wait(90);                       // 교과목도 잘 모르겠음
  ok('붙잡지 않고 통과', !open(H,'cmp') && !H.$('crs').classList.contains('open'),
     'cmp='+open(H,'cmp')+' crs='+H.$('crs').classList.contains('open'));
  const P=JSON.parse(H.w.localStorage.getItem('gich_pairs')||'[]');
  const S=JSON.parse(H.w.localStorage.getItem('gich_crs')||'[]');
  ok('잘 모르겠음도 기록됨', P.filter(r=>r.c==='unsure').length===1, P.length);
  ok('교과목 잘 모르겠음도', S.filter(r=>!r.c).length===1, S.length);

  console.log('\n[2] 성취기준으로 답해도 통과한다');
  let G=boot(); await wait(180);
  G.key('0'); await wait(90);                       // 비교를 모르겠음 → 성취기준으로
  ok('교과목 화면', G.$('crs').classList.contains('open'));
  G.key('3'); await wait(120);
  ok('교과목 하나로 통과', !open(G,'cmp') && !G.$('crs').classList.contains('open'));
  ok('교과목 응답이 남음',
     JSON.parse(G.w.localStorage.getItem('gich_crs')).some(r=>r.c));

  console.log('\n[3] 계속 모르겠다고 해도 붙잡아 두지 않는다');
  let K=boot(); await wait(180);
  for(let i=0;i<6 && (open(K,'cmp')||K.$('crs').classList.contains('open')); i++){
    K.key('0'); await wait(100);
  }
  ok('다섯 번쯤이면 보내 줌', !open(K,'cmp') && !K.$('crs').classList.contains('open'));

  console.log('\n[4] 같은 창에서는 다시 안 묻는다');
  ok('표시 남김', K.w.sessionStorage.getItem('gich_gate')==='1');

  console.log('\n[5] 건너뛰기는 답으로 치지 않는다');
  let J=boot(); await wait(180);
  J.click(J.$('cmpSkip')); await wait(80);
  ok('여전히 열려 있음', open(J,'cmp'));
  ok('응답은 안 쌓임', JSON.parse(J.w.localStorage.getItem('gich_pairs')||'[]').length===0);
  done();
})();
