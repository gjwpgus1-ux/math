const {boot,wait,scorer}=require('./harness');
const {ok,done}=scorer();
const open=(H,id)=>H.$(id).classList.contains('open');
(async()=>{
  console.log('\n[1] 잘 모르겠음이면 다른 것으로 한 번 더');
  let H=boot(); await wait(180);
  ok('비교부터', open(H,'cmp'));
  H.key('0'); await wait(90);                       // 잘 모르겠음
  ok('안 닫힘', open(H,'cmp')||open(H,'std'));
  ok('이번엔 성취기준 화면', open(H,'std'), 'cmp='+open(H,'cmp')+' std='+open(H,'std'));
  ok('안내가 바뀜', /하나만 더 부탁/.test(H.$('stdGateMsg').textContent), H.$('stdGateMsg').textContent);
  H.key('0'); await wait(90);                       // 또 잘 모르겠음
  ok('다시 비교로', open(H,'cmp'), 'cmp='+open(H,'cmp')+' std='+open(H,'std'));
  H.key('1'); H.key('Enter'); await wait(100);
  ok('제대로 답하니 통과', !open(H,'cmp') && !open(H,'std'));
  const P=JSON.parse(H.w.localStorage.getItem('gich_pairs')||'[]');
  const S=JSON.parse(H.w.localStorage.getItem('gich_std')||'[]');
  ok('잘 모르겠음도 기록됨', P.filter(r=>r.c==='unsure').length===1, P.length);
  ok('성취기준 잘 모르겠음도', S.filter(r=>r.k==='unsure').length===1, S.length);
  ok('마지막은 제대로 된 답', P.slice(-1)[0].c==='x', P.slice(-1)[0].c);

  console.log('\n[2] 성취기준으로 답해도 통과한다');
  let G=boot(); await wait(180);
  G.key('0'); await wait(90);                       // 비교를 모르겠음 → 성취기준으로
  ok('성취기준 화면', open(G,'std'));
  G.key('1'); await wait(40); G.key('Enter'); await wait(110);
  ok('성취기준 하나로 통과', !open(G,'cmp') && !open(G,'std'));
  ok('성취기준 응답이 남음',
     JSON.parse(G.w.localStorage.getItem('gich_std')).some(r=>r.cs && r.cs.length));

  console.log('\n[3] 계속 모르겠다고 해도 붙잡아 두지 않는다');
  let K=boot(); await wait(180);
  for(let i=0;i<6 && (open(K,'cmp')||open(K,'std')); i++){
    K.key('0'); await wait(90);
  }
  ok('다섯 번쯤이면 보내 줌', !open(K,'cmp') && !open(K,'std'));

  console.log('\n[4] 같은 창에서는 다시 안 묻는다');
  ok('표시 남김', K.w.sessionStorage.getItem('gich_gate')==='1');

  console.log('\n[5] 건너뛰기는 답으로 치지 않는다');
  let J=boot(); await wait(180);
  J.click(J.$('cmpSkip')); await wait(80);
  ok('여전히 열려 있음', open(J,'cmp'));
  ok('응답은 안 쌓임', JSON.parse(J.w.localStorage.getItem('gich_pairs')||'[]').length===0);
  done();
})();
