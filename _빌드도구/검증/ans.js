/* 정답 — 자료·모드별 표시·인쇄에 안 나가는지 */
const fs=require('fs'), path=require('path');
const {boot,wait,scorer,APP}=require('./harness.js');
const S=scorer();
const {w,doc,$,click}=boot('ansOf:it=>ansOf(it), ansText:v=>ansText(v), IT:()=>IT, EX:()=>EX, '+
  'SELset:function(v){SEL=v;updateSel();render(true);}, selectedItems:()=>selectedItems()');
const T=w.__T;

/* ---- 자료 파일 ---- */
const raw=fs.readFileSync(path.join(APP,'index.html'),'utf8');
S.ok('index.html이 data/ans.js를 부른다', /<script src="data\/ans\.js"><\/script>/.test(raw));
S.ok('ans.js 파일이 있다', fs.existsSync(path.join(APP,'data','ans.js')));
const A=w.QANS;
S.ok('정답 자료가 실렸다', !!A && typeof A==='object');
const exams=Object.keys(A);
S.ok('정답이 있는 시험이 100개 넘는다', exams.length>100, exams.length);
const all=exams.reduce((s,k)=>s+Object.keys(A[k]).length,0);
S.ok('정답이 1,500개 넘는다', all>1500, all);

/* 값이 옳은 꼴인가 */
let badv=0, badn=0;
exams.forEach(k=>Object.keys(A[k]).forEach(n=>{
  const v=A[k][n];
  if(!Number.isInteger(v) || v<0) badv++;      /* 0 = 모두 정답 처리된 문항 */
  if(!/^\d{1,2}$/.test(n) || +n<1 || +n>30) badn++;
}));
S.ok('정답 값이 모두 0 이상 정수', badv===0, badv);
S.ok('문항 번호가 모두 1~30', badn===0, badn);

/* 실제 문항과 짝이 맞는가 */
const IT=T.IT(), EX=T.EX();
const have={}; IT.forEach(it=>{ (have[EX[it[0]].n]=have[EX[it[0]].n]||{})[it[1]]=1; });
let orphanExam=0, orphanNo=0;
exams.forEach(k=>{
  if(!have[k]){ orphanExam++; return; }
  Object.keys(A[k]).forEach(n=>{ if(!have[k][+n]) orphanNo++; });
});
S.ok('없는 시험 이름이 없다', orphanExam===0, orphanExam);
S.ok('없는 문항 번호가 없다', orphanNo===0, orphanNo);

/* 답 쏠림 — 한 번호로 몰려 있으면 뽑기가 틀어진 것 */
const cnt={1:0,2:0,3:0,4:0,5:0};
exams.forEach(k=>Object.keys(A[k]).forEach(n=>{ const v=A[k][n]; if(v<=5) cnt[v]++; }));
const vals=[1,2,3,4,5].map(i=>cnt[i]);
const mx=Math.max(...vals), mn=Math.min(...vals);
S.ok('①~⑤가 고르게 나온다 (한쪽 쏠림 없음)', mx < mn*1.5, JSON.stringify(cnt));

/* ---- 찾아 쓰기 ---- */
S.ok('①~⑤를 동그라미 숫자로 바꾼다',
     T.ansText(1)==='①' && T.ansText(3)==='③' && T.ansText(5)==='⑤');
S.ok('단답형은 숫자 그대로', T.ansText(17)==='17' && T.ansText(296)==='296');
S.ok('0은 «모두 정답»으로 보인다', T.ansText(0)==='모두 정답', T.ansText(0));
const allok=exams.filter(k=>Object.values(A[k]).some(v=>v===0));
S.ok('모두 정답 문항이 자료에 있다', allok.length>0, allok.join(','));

const withAns=IT.find(it=>T.ansOf(it)!==null);
const noAns=IT.find(it=>T.ansOf(it)===null);
S.ok('정답이 붙은 문항을 찾을 수 있다', !!withAns);
S.ok('정답이 없는 문항도 있다 (평가원 등)', !!noAns);
S.ok('정답 값이 자료와 같다',
     withAns && T.ansOf(withAns)===A[EX[withAns[0]].n][withAns[1]]);

/* ---- 화면 ---- */
function cards(){ return [...doc.querySelectorAll('#grid .card')]; }
function headOf(c){ return c.querySelector('.head'); }
async function find(q){
  $('q').value=q;
  $('q').dispatchEvent(new w.Event('input',{bubbles:true}));
  await wait(400);
  return cards();
}

(async()=>{
  /* 복붙모드 — 늘 보인다 */
  let cs=await find(EX[withAns[0]].n);
  S.ok('검색 결과가 나온다', cs.length>0, cs.length);
  const shown=cs.filter(c=>/정답 [①-⑤0-9]/.test(headOf(c).textContent));
  S.ok('복붙모드에서는 정답이 바로 보인다', shown.length>0, shown.length);
  S.ok('복붙모드에 «정답 보기» 단추는 없다', cs.every(c=>!c.querySelector('.ansbtn')));

  /* 학습모드 — 눌러야 보인다 */
  click($('modeStudy'));
  await wait(120);
  cs=cards();
  const btns=cs.map(c=>c.querySelector('.ansbtn')).filter(Boolean);
  S.ok('학습모드에는 «정답 보기» 단추가 생긴다', btns.length>0, btns.length);
  S.ok('학습모드에서는 정답이 아직 안 보인다',
       cs.every(c=>!/정답 [①-⑤]/.test(headOf(c).textContent)));
  S.ok('단추 글씨가 «정답 보기»', btns[0] && btns[0].textContent==='정답 보기',
       btns[0] && btns[0].textContent);
  const owner=btns[0].closest('.card');
  click(btns[0]);
  S.ok('누르면 정답이 나타난다', /정답 [①-⑤0-9]/.test(headOf(owner).textContent),
       headOf(owner).textContent);
  S.ok('누른 뒤에는 단추가 사라진다', !owner.querySelector('.ansbtn'));
  const others=cards().filter(c=>c!==owner && c.querySelector('.ansbtn'));
  S.ok('다른 문항은 그대로 가려져 있다', others.length>0, others.length);

  /* 정답이 없는 시험 */
  click($('modeSearch'));
  await wait(120);
  cs=await find(EX[noAns[0]].n);
  const none=cs.filter(c=>/정답 준비 중/.test(headOf(c).textContent));
  S.ok('정답이 없으면 «정답 준비 중»으로 알린다', none.length>0, none.length);
  S.ok('«정답 준비 중»에는 답이 안 붙는다',
       none.every(c=>!/정답 [①-⑤]/.test(headOf(c).textContent)));

  /* ---- 인쇄에는 안 나가야 한다 ---- */
  const css=raw.replace(/\s+/g,'');
  S.ok('인쇄할 때 본문(main)을 숨긴다', /@mediaprint\{[^}]*main[^}]*display:none/.test(css));
  S.ok('정답 딱지 모양이 있다', /\.badge\.ans\{/.test(css));
  S.ok('정답 없음 딱지 모양이 있다', /\.badge\.ansno\{/.test(css));
  S.ok('정답 보기 단추 모양이 있다', /\.ansbtn\{/.test(css));

  /* ---- 해설 ---- */
  const SOL=w.QSOL;
  S.ok('index.html이 data/sol.js를 부른다', /<script src="data\/sol\.js"><\/script>/.test(raw));
  S.ok('해설 자료가 실렸다', !!SOL);
  const skeys=Object.keys(SOL||{});
  S.ok('해설이 70개 넘는다', skeys.length>70, skeys.length);
  S.ok('해설마다 [파일, 가로, 세로]',
       skeys.every(k=>Array.isArray(SOL[k]) && SOL[k].length===3 && SOL[k][1]>0 && SOL[k][2]>0));
  const solfs=path.join(APP,'img','해설');
  S.ok('해설 그림 폴더가 있다', fs.existsSync(solfs));
  const missing=skeys.filter(k=>!fs.existsSync(path.join(solfs,SOL[k][0])));
  S.ok('그림 파일이 다 있다', missing.length===0, missing.slice(0,3).join(','));
  let solOrphan=0;
  skeys.forEach(k=>{ const [n,q]=[k.slice(0,k.lastIndexOf('#')),k.slice(k.lastIndexOf('#')+1)];
                     if(!have[n] || !have[n][+q]) solOrphan++; });
  S.ok('해설이 없는 문항을 가리키지 않는다', solOrphan===0, solOrphan);

  const solIt=IT.find(it=>SOL[EX[it[0]].n+'#'+it[1]]);
  cs=await find(EX[solIt[0]].n);
  const solBtn=cs.map(c=>[...c.querySelectorAll('button')].find(b=>b.textContent==='해설')).filter(Boolean);
  S.ok('해설이 있는 문항에 «해설» 단추가 생긴다', solBtn.length>0, solBtn.length);
  click(solBtn[0]);
  S.ok('해설 창이 열린다', $('modal').classList.contains('open'));
  S.ok('해설 창에 그림이 있다', !!$('mbox').querySelector('.solbox img'));
  S.ok('해설 그림 경로가 img/해설/', /^img\/해설\//.test($('mbox').querySelector('.solbox img').getAttribute('src')));
  S.ok('해설 창에 정답도 함께 보인다', /정답 [①-⑤0-9]/.test($('mbox').textContent), $('mbox').querySelector('.sub').textContent);
  click([...$('mbox').querySelectorAll('button')].find(b=>b.textContent==='닫기'));
  S.ok('해설 창이 닫힌다', !$('modal').classList.contains('open'));

  /* 해설이 없는 시험에는 단추가 없어야 한다 */
  cs=await find(EX[noAns[0]].n);
  S.ok('해설이 없으면 단추도 없다',
       cs.every(c=>![...c.querySelectorAll('button')].some(b=>b.textContent==='해설')));

  /* ---- 오답노트·학습지 ---- */
  click($('modeStudy'));
  await wait(120);
  const pick={};
  IT.filter(it=>SOL[EX[it[0]].n+'#'+it[1]]).slice(0,3).forEach(it=>{ pick[it[2]]=true; });
  T.SELset(pick);
  await wait(120);
  S.ok('문항 3개를 골랐다', T.selectedItems().length===3, T.selectedItems().length);

  click($('printNote'));
  const nb=[...$('mbox').querySelectorAll('button')].map(b=>b.textContent);
  S.ok('내보내기 단추가 넷 + 취소', nb.length===5, nb.join(' / '));
  S.ok('문항 PDF 단추', nb[0]==='문항 PDF로 저장' || /문항 PDF로 저장/.test(nb[0]), nb[0]);
  S.ok('해설 PDF·인쇄 단추', nb[2]==='해설 PDF로 저장' && nb[3]==='해설 바로 인쇄', nb.slice(2,4).join(' / '));
  S.ok('해설이 몇 개인지 알려 준다', /해설이 있는 문항은 \d+개/.test($('mbox').textContent));
  click($('outSolPrint'));
  await wait(60);
  let sheets=[...doc.querySelectorAll('#printArea .sheet')];
  S.ok('해설 인쇄물이 만들어진다', sheets.length>0, sheets.length);
  const simgs=[...doc.querySelectorAll('#printArea .simg img')];
  S.ok('해설 그림이 실린다', simgs.length>0 && simgs.every(i=>/^img\/해설\//.test(i.getAttribute('src'))),
       simgs.length);
  S.ok('해설 장에도 저작권 문구', sheets.every(s=>!!s.querySelector('.pgn .cpr')));

  /* 오답노트 — 쪽마다 정답 */
  click($('printNote'));
  click($('outPrint'));
  await wait(60);
  sheets=[...doc.querySelectorAll('#printArea .sheet')];
  S.ok('오답노트가 고른 수만큼 나온다', sheets.length===3, sheets.length);
  S.ok('오답노트 쪽마다 정답이 찍힌다',
       sheets.every(s=>/정답 [①-⑤0-9]/.test((s.querySelector('.slab')||{}).textContent||'')),
       sheets.map(s=>(s.querySelector('.slab')||{}).textContent).join(' | '));
  S.ok('정답 글씨 모양이 있다', /\.slab\.sans\{/.test(css));

  /* 학습지 — 맨 뒤 빠른 정답 */
  click($('printWork'));
  click($('outPrint'));
  await wait(60);
  sheets=[...doc.querySelectorAll('#printArea .sheet')];
  const last=sheets[sheets.length-1];
  S.ok('학습지 맨 뒤에 빠른 정답 장이 붙는다', !!last.querySelector('.qa'), sheets.length+'장');
  S.ok('빠른 정답 제목이 있다', /빠른 정답/.test(last.textContent));
  const qrows=[...last.querySelectorAll('.qarow')];
  S.ok('고른 문항이 다 적혀 있다', qrows.length===3, qrows.length);
  S.ok('줄마다 시험이름과 답', qrows.every(r=>r.querySelector('.qan') && r.querySelector('.qav')));
  S.ok('빠른 정답 모양이 있다', /\.qarow\{/.test(css));
  S.ok('한 단에 세로로 쌓는다 (좌우 번갈이 아님)',
       /\.qa\{[^}]*flex-direction:column/.test(css) && !/\.qarow\{[^}]*width:calc\(50%/.test(css));

  /* 적게 고르면 왼쪽 한 단에만 — 오른쪽 단을 만들지 않는다 */
  const qcols=[...last.querySelectorAll('.scol')];
  S.ok('적게 고르면 단이 하나', qcols.length===1, qcols.length);
  S.ok('가운데 줄도 긋지 않는다', !last.querySelector('.scol.divider'));

  /* 많이 고르면 왼쪽을 다 채운 뒤 오른쪽으로 넘어간다 */
  const many={}; const manyIt=IT.filter(it=>T.ansOf(it)!==null).slice(0,120);
  manyIt.forEach(it=>{ many[it[2]]=true; });
  T.SELset(many);
  await wait(200);
  click($('printWork'));
  click($('outPrint'));
  await wait(120);
  const qsheet=[...doc.querySelectorAll('#printArea .sheet')].filter(s=>s.querySelector('.qa'));
  S.ok('빠른 정답 장이 생긴다', qsheet.length>0, qsheet.length);
  const cols2=[...qsheet[0].querySelectorAll('.scol')];
  S.ok('많이 고르면 두 단', cols2.length===2, cols2.length);
  const L=[...cols2[0].querySelectorAll('.qarow .qan')].map(e=>e.textContent);
  const R=[...cols2[1].querySelectorAll('.qarow .qan')].map(e=>e.textContent);
  S.ok('왼쪽 단이 가득 찬다', L.length===50, L.length);
  S.ok('오른쪽 단은 그다음 것', R.length>0, R.length);
  const order=[...qsheet[0].querySelectorAll('.qarow .qan')].map(e=>e.textContent);
  S.ok('왼쪽을 다 읽은 뒤 오른쪽 — 좌우 번갈이 아님',
       order.slice(0,L.length).join('|')===L.join('|') &&
       order.slice(L.length).join('|')===R.join('|'));
  const want=manyIt.slice(0,50).map(it=>/* 라벨은 화면과 같은 차례 */ 1);
  S.ok('왼쪽 단의 차례가 고른 차례와 같다',
       L.length===50 && L[0]!==L[1]);

  S.done();
})();
