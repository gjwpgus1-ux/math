const {boot,wait,scorer}=require('./harness');
const H=boot('IT:IT,EX:EX,packColumns:packColumns,unitOf:unitOf,ptsOf:ptsOf,SELset:function(v){SEL=v;updateSel();},selectedItems:selectedItems,printWork:printWork,label:label');
const {w,doc,$,click,key,html}=H;
const {ok,done}=scorer();
const T=()=>w.__T;

/* 인쇄 단추를 누르면 묻는 창이 뜬다 — «바로 인쇄»까지 눌러 주는 도우미 */
async function doPrint(H, id){
  H.click(H.$(id)); await wait(90);
  const b=H.doc.getElementById('outPrint');
  if(b) H.click(b);
  await wait(600);
}

(async()=>{
  await wait(180);
  key('1'); key('Enter'); await wait(140);

  console.log('\n[1] 한 문항이 몇 칸을 쓰는가');
  const IT=T().IT;
  const p4=IT.find(it=>T().ptsOf(it)===4), p3=IT.find(it=>T().ptsOf(it)===3), p2=IT.find(it=>T().ptsOf(it)===2);
  ok('4점 → 2칸', T().unitOf(p4)===2, T().unitOf(p4));
  ok('3점 → 1칸', T().unitOf(p3)===1, T().unitOf(p3));
  ok('2점 → 1칸', T().unitOf(p2)===1, T().unitOf(p2));
  const unk=IT.find(it=>T().ptsOf(it)===0);
  ok('배점을 못 읽어도 칸 수는 나옴', [1,2].includes(T().unitOf(unk)), T().unitOf(unk));

  console.log('\n[2] 단 채우기 — 규칙대로인가');
  const mk=(...ps)=>ps.map(p=>IT.find(it=>T().ptsOf(it)===p));
  let cols=T().packColumns(mk(3,3,4,3,3,4,4));
  const sig=c=>c.map(x=>x.u).join('+');
  ok('4점은 언제나 혼자', cols.every(c=>!c.some(x=>x.u===2)||c.length===1),
     cols.map(sig).join(' | '));
  ok('2·3점은 둘씩', cols.filter(c=>c.every(x=>x.u===1)).every(c=>c.length===2),
     cols.map(sig).join(' | '));
  ok('모든 단이 꽉 참', cols.every(c=>c.reduce((s,x)=>s+x.u,0)===2), cols.map(sig).join(' | '));

  console.log('\n[3] 예전에 어긋나던 차례 — 3점 하나가 단을 통째로 먹던 문제');
  cols=T().packColumns(mk(3,4,3,4));
  ok('3점이 혼자 남지 않음', !cols.some(c=>c.length===1&&c[0].u===1), cols.map(sig).join(' | '));
  ok('단 3개 (3+3 · 4 · 4)', cols.length===3, cols.length);
  ok('짜임새', cols.map(sig).sort().join(',')==='1+1,2,2', cols.map(sig).join(' | '));
  cols=T().packColumns(mk(2,4,4,4));
  ok('2점 하나 + 4점 셋', cols.length===4 && cols.filter(c=>sig(c)==='2').length===3,
     cols.map(sig).join(' | '));

  console.log('\n[4] 실제 인쇄 결과');
  click($('modeStudy')); await wait(80);
  $('q').value='25 고3 3월 공통 1~22'; $('q').dispatchEvent(new w.Event('input')); await wait(360);
  click($('selAll')); await wait(120);
  const n=+$('selCnt').textContent.replace(/[^0-9]/g,'');
  ok('22문항 선택', n===22, n);
  ok('4점 문항이 섞여 있음', T().selectedItems().some(it=>T().unitOf(it)===2));
  const b=w.__printed||0;
  await doPrint(H,'printWork');
  ok('인쇄됨', (w.__printed||0)>b);
  const sheets=[...doc.querySelectorAll('.sheet')];
  ok('장이 만들어짐', sheets.length>0, sheets.length);
  let bad=0, colsSeen=0;
  sheets.forEach(sh=>{
    sh.querySelectorAll('.scol').forEach(c=>{
      const slots=[...c.querySelectorAll('.sslot')];
      if(!slots.length) return;
      colsSeen++;
      const units=slots.map(s=>parseFloat(s.style.flex));
      const tot=units.reduce((a,x)=>a+x,0);
      if(units.includes(2) && slots.length>1) bad++;      // 4점인데 짝이 있음
      if(tot>2) bad++;                                     // 한 단을 넘김
    });
  });
  ok('단 규칙 어긋남 0', bad===0, bad+'건 / 단 '+colsSeen+'개');
  ok('4점 슬롯은 두 칸 높이', [...doc.querySelectorAll('.sslot')].some(s=>parseFloat(s.style.flex)===2));
  ok('2·3점 슬롯은 한 칸 높이', [...doc.querySelectorAll('.sslot')].some(s=>parseFloat(s.style.flex)===1));

  console.log('\n[5] 하단 우측 안내 문구');
  const pgn=sheets[0].querySelector('.pgn');
  ok('쪽 번호 있음', /1 \/ /.test(pgn.querySelector('.pn').textContent), pgn.querySelector('.pn').textContent);
  const cpr=pgn.querySelector('.cpr');
  ok('안내 문구 있음', !!cpr);
  ok('문구 내용', cpr.textContent==='영리적인 목적을 위하여 사용을 금합니다. · 줍줍닷컴', cpr.textContent);
  ok('모든 장에 들어감', sheets.every(s=>!!s.querySelector('.pgn .cpr')), sheets.length+'장');
  ok('오른쪽에 붙음', /\.pgn \.cpr\{[^}]*right:0/.test(html));
  ok('한 줄로 유지', /\.pgn \.cpr\{[^}]*white-space:nowrap/.test(html));

  console.log('\n[5-3] 장 사이에 빈 쪽이 끼지 않는다');
  /* A4(297) − 위아래 여백 20 = 277mm 가 쓸 수 있는 높이.
     한 장을 꽉 채우면 1px만 넘쳐도 장마다 빈 쪽이 하나씩 생긴다. */
  const mh=/\.sheet\{[^}]*height:(\d+)mm/.exec(html);
  ok('한 장 높이를 재어 볼 수 있다', !!mh, mh && mh[1]);
  const SH=mh ? +mh[1] : 999;
  ok('한 장 높이가 277mm 보다 작다 (여유가 있다)', SH < 277, SH+'mm');
  ok('그래도 260mm 는 넘는다 (너무 줄이지 않았다)', SH > 260, SH+'mm');
  ok('넘치면 잘라 낸다 (overflow:hidden)', /\.sheet\{[^}]*overflow:hidden/.test(html));
  ok('요즘 쓰는 break-after:page 도 함께 적었다', /\.sheet\{[^}]*break-after:page/.test(html));
  ok('마지막 장은 뒤에서 쪽을 넘기지 않는다',
     /\.sheet:last-child\{[^}]*page-break-after:auto/.test(html) &&
     /\.sheet:last-child\{[^}]*break-after:auto/.test(html));
  ok('인쇄할 때 body 여백을 없앤다',
     /@media print\{[\s\S]*?html,body\{[^}]*margin:0/.test(html));
  ok('인쇄할 때 printArea 여백도 없앤다',
     /@media print\{[\s\S]*?#printArea\{[^}]*margin:0/.test(html));
  /* PDF 로 얹는 크기가 장 크기와 같아야 그림이 안 늘어난다 */
  const mm=/var SHEET_MM=\{w:(\d+), *h:(\d+)\}/.exec(html);
  ok('PDF 크기를 한 곳에 적어 두었다', !!mm, mm && mm[0]);
  ok('PDF 크기가 장 크기와 같다', mm && +mm[2]===SH, mm && (mm[2]+' ↔ '+SH));
  ok('PDF 도 그 값을 쓴다', /addImage\([\s\S]{0,80}SHEET_MM\.w, *SHEET_MM\.h\)/.test(html));

  console.log('\n[5-2] 그림이 다 실린 뒤에 인쇄한다');
  ok('printWhenReady 씀', /printWhenReady\(P\)/.test(html));
  ok('0.3초 타이머는 없어짐', !/setTimeout\(function\(\)\{ window\.print\(\); \},300\)/.test(html));
  ok('load·error 둘 다 기다림', /addEventListener\('load', one\)/.test(html) && /addEventListener\('error', one\)/.test(html));
  ok('늦으면 20초 뒤 그냥 인쇄', /\}, 20000\)/.test(html));
  ok('그림칸이 따로 생김', /\.simg\{[^}]*flex:1;min-height:0/.test(html));
  /* 맨 뒤 «빠른 정답» 장에는 그림이 없다 — 그 장은 빼고 본다 */
  ok('슬롯마다 .simg',
     [...doc.querySelectorAll('.sslot')].filter(s=>!s.querySelector('.qa')).every(s=>!!s.querySelector('.simg')));

  console.log('\n[6] 오답노트에도 같은 문구');
  await doPrint(H,'printNote');
  const ns=[...doc.querySelectorAll('.sheet')];
  ok('오답노트 인쇄됨', ns.length===22, ns.length);
  ok('모든 장에 문구', ns.every(s=>!!s.querySelector('.pgn .cpr')), ns.length+'장');
  ok('문구 내용 같음',
     ns[0].querySelector('.pgn .cpr').textContent==='영리적인 목적을 위하여 사용을 금합니다. · 줍줍닷컴',
     ns[0].querySelector('.pgn .cpr').textContent);
  ok('쪽 번호도 그대로', /1 \/ 22/.test(ns[0].querySelector('.pn').textContent));
  ok('오답노트도 그림칸 분리', !!ns[0].querySelector('.sslot .simg'));

  console.log('\n[7] 오답노트 질문 네 가지');
  const qs=[...ns[0].querySelectorAll('.nq')].map(q=>q.textContent);
  ok('질문 4개', qs.length===4, qs.length);
  ok('1. 구하고자 하는 것', qs[0]==='1. 구하고자 하는 것은 무엇인가', qs[0]);
  ok('2. 활용된 지식', qs[1]==='2. 문제해결에 활용된 지식은 무엇인가', qs[1]);
  ok('3. 막힌 지점', qs[2]==='3. 어느 지점에서 막혔고, 그때 무엇을 시도했는가', qs[2]);
  ok('4. 다음에 할 일', qs[3]==='4. 다음에 같은 유형을 만나면 무엇부터 할 것인가', qs[3]);
  const lc=[...ns[0].querySelectorAll('.nlines')].map(l=>l.children.length);
  ok('1번은 3줄, 나머지는 6줄', lc.join(',')==='3,6,6,6', lc.join(','));
  const fw=[...ns[0].querySelectorAll('.nblk')].map(b=>parseFloat(b.style.flex));
  ok('1번 칸이 절반', fw.join(',')==='0.5,1,1,1', fw.join(','));
  ok('네 묶음이 자리를 나눠 가짐', fw.every(v=>v>0));
  ok('줄 높이도 남는 자리에 맞춤', /\.nlines div\{[^}]*flex:1/.test(html));
  ok('모든 장에 질문 4개', ns.every(s=>s.querySelectorAll('.nq').length===4));

  console.log('\n[8] 맨 위 왼쪽에 만든이');
  ok('오답노트 머리말', ns[0].querySelector('.shd').textContent==='줍줍닷컴 · 만든이 : 허선생',
     ns[0].querySelector('.shd').textContent);
  ok('오답노트 모든 장', ns.every(s=>s.querySelector('.shd')));
  ok('머리말이 맨 위', ns[0].firstElementChild.className==='shd', ns[0].firstElementChild.className);
  await doPrint(H,'printWork');
  const ws=[...doc.querySelectorAll('.sheet')];
  ok('학습지에도 머리말', ws.every(s=>s.querySelector('.shd')&&s.querySelector('.shd').textContent==='줍줍닷컴 · 만든이 : 허선생'),
     ws[0].querySelector('.shd').textContent);
  ok('학습지도 맨 위', ws[0].firstElementChild.className==='shd');
  ok('아래 문구는 그대로', ws.every(s=>!!s.querySelector('.pgn .cpr')));
  done();
})();
