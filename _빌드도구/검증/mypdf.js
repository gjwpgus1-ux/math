/* 내 PDF로 오답노트 (mypdf.html)
   · 문항 경계 찾기를 실제 시험지 글자(시험지표본.json)로 겨루어 본다
   · 오답노트 양식이 index.html 과 어긋나지 않았는지 본다
   · 화면 구성과 «파일이 밖으로 안 나간다»는 약속을 확인한다 */
const fs=require('fs'), path=require('path');
const {JSDOM}=require('jsdom');
const {scorer,APP}=require('./harness.js');
const S=scorer();
const HTML=fs.readFileSync(path.join(APP,'mypdf.html'),'utf8');

/* ---------- 화면 ---------- */
const doc=new JSDOM(HTML).window.document;
S.ok('한국어 문서', doc.documentElement.lang==='ko');
S.ok('제목에 줍줍닷컴', /줍줍닷컴/.test(doc.title), doc.title);
S.ok('설명 메타가 있다', !!doc.querySelector('meta[name=description]'));
S.ok('검색기로 돌아가는 링크', !!doc.querySelector('a[href="index.html"]'));
['drop','pages','tools','printArea','busy','pick','file','mSel','mDraw','make','again','helpBtn',
 'prev','next','pgpos'].forEach(id=>S.ok('«'+id+'» 자리가 있다', !!doc.getElementById(id)));
S.ok('단계 표시가 셋', doc.querySelectorAll('.steps .st').length===3);
S.ok('PDF만 받는다', doc.getElementById('file').accept.indexOf('pdf')>=0);

/* 파일이 밖으로 안 나가는지 — 어디로도 보내지 않아야 한다 */
S.ok('보내는 코드가 없다', !/fetch\s*\(|XMLHttpRequest|navigator\.sendBeacon|new WebSocket/.test(HTML));
S.ok('바깥에서 받아오는 파일이 없다',
     ![...doc.querySelectorAll('script[src],link[href]')]
       .some(e=>/^https?:/.test(e.getAttribute('src')||e.getAttribute('href')||'')));
S.ok('«기기 밖으로 나가지 않습니다» 라고 적혀 있다',
     doc.body.textContent.indexOf('기기 밖으로 나가지 않습니다')>=0);
S.ok('PDF 부품을 처음부터 불러오지 않는다',
     ![...doc.querySelectorAll('script[src]')].some(e=>/pdf\.min\.js/.test(e.getAttribute('src'))));
S.ok('PDF 부품 파일이 있다', fs.existsSync(path.join(APP,'lib','pdf.min.js')));
S.ok('PDF 일꾼 파일이 있다', fs.existsSync(path.join(APP,'lib','pdf.worker.min.js')));

/* ---------- 오답노트 양식이 index.html 과 같은가 ---------- */
const IDX=fs.readFileSync(path.join(APP,'index.html'),'utf8');
function grab(src, name){
  const m=new RegExp('var '+name+'\\s*=\\s*([\\s\\S]*?);\\s*\\n').exec(src);
  return m? m[1].replace(/\s+/g,'') : null;
}
['NOTE_Q','NOTICE','MAKER','BOX3'].forEach(n=>{
  const a=grab(IDX,n), b=grab(HTML,n);
  S.ok('오답노트 «'+n+'» 이 두 파일에서 같다', a && b && a===b, (a||'?').slice(0,30));
});
S.ok('내 PDF 쪽으로 가는 단추가 검색기에 있다', /id="modeMine"/.test(IDX));
S.ok('그 단추가 mypdf.html 로 간다', /mypdf\.html/.test(IDX));

/* ---------- 문항 경계 찾기 ---------- */
let SRC=HTML.match(/<script>\s*\(function\(\)\{([\s\S]*?)\}\)\(\);\s*<\/script>/)[1];
SRC='(function(){'+SRC+'window.__T={detect:detect,findCols:findCols,toLines:toLines,bestChain:bestChain,'+
  'showPage:showPage,goPage:goPage,cur:function(){return CUR;},'+
  'setPages:function(n){PAGES=[];for(var i=0;i<n;i++){var w=document.createElement("div");w.className="pg";'+
  'document.getElementById("pages").appendChild(w);PAGES.push({pno:i+1,wrap:w,boxes:[]});}},'+
  'labelOf:labelOf};})();';
const ids=['toast','modal','mbox','drop','busy','busyMsg','bar','tools','cnt','pgpos','pages','printArea','st1','st2','st3'];
const btns=['pick','mSel','mDraw','allPage','none','again','make','helpBtn','prev','next'];
const dom2=new JSDOM(ids.map(i=>`<div id="${i}"></div>`).join('')+
  btns.map(i=>`<button id="${i}"></button>`).join('')+'<input id="file">',{runScripts:'outside-only'});
dom2.window.eval(SRC);
const T=dom2.window.__T;

/* ---------- 한 쪽씩 넘기기 ---------- */
S.ok('쪽 높이에 맞춰 보여 준다', /\.pg canvas\{[^}]*height:calc\(100vh/.test(HTML.replace(/\s+/g,' ')));
S.ok('쪽 하나만 보이게 되어 있다', /\.pg\{[^}]*display:none/.test(HTML.replace(/\s+/g,' ')) &&
     /\.pg\.on\{display:inline-block\}/.test(HTML.replace(/\s+/g,'')));
S.ok('가로는 넘치지 않게 막아 둔다', /max-width:100%/.test(HTML));

T.setPages(5);
T.showPage(0);
const $2=id=>dom2.window.document.getElementById(id);
S.ok('첫 쪽부터 보인다', T.cur()===0 && $2('pgpos').textContent==='1 / 5쪽', $2('pgpos').textContent);
S.ok('첫 쪽에서는 이전이 잠긴다', $2('prev').disabled===true);
S.ok('첫 쪽에서 다음은 열려 있다', $2('next').disabled===false);
S.ok('보이는 쪽에만 표시가 붙는다',
     [...dom2.window.document.querySelectorAll('.pg')].filter(e=>e.classList.contains('on')).length===1);
T.goPage(1);
S.ok('다음 쪽으로 넘어간다', T.cur()===1 && $2('pgpos').textContent==='2 / 5쪽', $2('pgpos').textContent);
T.goPage(-1);
S.ok('이전 쪽으로 돌아온다', T.cur()===0);
T.goPage(-1);
S.ok('첫 쪽에서 더 뒤로 가지 않는다', T.cur()===0);
T.showPage(4);
S.ok('마지막 쪽으로 간다', T.cur()===4 && $2('next').disabled===true);
T.goPage(1);
S.ok('마지막에서 더 앞으로 가지 않는다', T.cur()===4);
const key=k=>dom2.window.document.dispatchEvent(new dom2.window.KeyboardEvent('keydown',{key:k,bubbles:true}));
key('ArrowLeft');  S.ok('← 로 앞 쪽', T.cur()===3, T.cur());
key('ArrowRight'); S.ok('→ 로 뒤 쪽', T.cur()===4, T.cur());
key('Home');       S.ok('Home 으로 첫 쪽', T.cur()===0, T.cur());
key('End');        S.ok('End 로 마지막 쪽', T.cur()===4, T.cur());

/* ---------- 문항 번호는 쓰지 않는다 ---------- */
S.ok('오답노트 이름표는 쪽 수만 적는다',
     T.labelOf({rec:{pno:7}, n:23})==='7쪽', T.labelOf({rec:{pno:7}, n:23}));
S.ok('네모에 번호 딱지를 안 붙인다', HTML.indexOf('class="qn"')<0);
S.ok('번호 딱지 모양새도 지웠다', !/\.qbox \.qn\{/.test(HTML));
S.ok('도움말에 ← → 안내가 있다', /← → 키로 넘깁니다/.test(HTML));

/* ---------- 글자 자리를 제대로 읽는가 ---------- */
S.ok('뷰포트 변환을 거쳐 자리를 잡는다', /PDFJS\.Util\.transform\(vp1\.transform/.test(HTML));
S.ok('세로로 돌아간 글씨는 뺀다', /Math\.abs\(m\[1\]\)\s*>\s*Math\.abs\(m\[0\]\)\*0\.3/.test(HTML));
S.ok('글자 높이를 변환 뒤 값으로 잰다', /Math\.hypot\(m\[2\],m\[3\]\)/.test(HTML));

/* ---------- 교재의 문항코드로 자르기 ---------- */
(function(){
  /* «[26010-0007]» 코드가 문항마다 붙는 교재(EBS 수능특강 등) 흉내 */
  const ts=[];
  const put=(s,x,top,h)=>ts.push({s:s,x:x,top:top,w:s.length*(h*0.5),h:h});
  [0,1,2,3].forEach(i=>{
    const y=100+i*130;
    put('[26010-000'+(7+i)+']', 94, y, 7);
    put('가나다라마바사아자차카타파하', 62, y+10, 10);
    put('풀이에 이어지는 본문 줄입니다', 94, y+28, 10);
    put('①1②2③3④4⑤5', 94, y+46, 10);
  });
  const bs=T.detect(ts, 584, 737);
  S.ok('문항코드가 있으면 그것으로 넷을 가른다', bs.length===4, bs.length);
  S.ok('코드 자리부터 잘라 낸다', bs[0] && bs[0].t0 < 100, bs[0] && bs[0].t0.toFixed(0));
  S.ok('칸끼리 겹치지 않는다',
       bs.every((b,i)=> i===0 || b.t0 >= bs[i-1].t1 - 1));
})();

/* ---------- 번호가 수식과 붙어 버린 줄 ---------- */
(function(){
  /* «32P2n=64» 처럼 3번 문항의 번호와 수식이 붙는 경우 */
  const ts=[];
  const put=(s,x,top,h)=>ts.push({s:s,x:x,top:top,w:s.length*(h*0.5),h:h});
  put('1가나다라마바사아자차', 62, 100, 10);
  put('2가나다라마바사아자차', 62, 200, 10);
  put('32P2n=64를만족시키는', 62, 300, 10);
  put('4가나다라마바사아자차', 62, 400, 10);
  for(let k=0;k<10;k++) put('본문'+k, 94, 110+k*30, 10);
  const got=T.detect(ts,584,737).map(b=>b.n);
  S.ok('«32P2n» 을 3번으로 읽어 낸다', got.join(',')==='1,2,3,4', got.join(','));
})();
S.ok('같은 줄에서 나온 두 읽기를 함께 쓰지 않는다',
     T.bestChain([{n:3,top:10},{n:32,top:10},{n:4,top:20}]).map(c=>c.n).join(',')==='3,4',
     T.bestChain([{n:3,top:10},{n:32,top:10},{n:4,top:20}]).map(c=>c.n).join(','));

S.ok('빈 쪽은 아무것도 안 내놓는다', T.detect([],600,800).length===0);
S.ok('글자가 몇 개뿐이면 안 내놓는다',
     T.detect([{s:'1.가나다',x:60,top:100,w:40,h:10}],600,800).length===0);
S.ok('번호가 늘어나는 가장 긴 사슬을 고른다',
     T.bestChain([{n:5,top:1},{n:23,top:2},{n:24,top:3}]).map(c=>c.n).join(',')==='23,24',
     T.bestChain([{n:5,top:1},{n:23,top:2},{n:24,top:3}]).map(c=>c.n).join(','));
S.ok('사슬이 하나뿐이면 그것을 고른다',
     T.bestChain([{n:7,top:1}]).map(c=>c.n).join(',')==='7');
S.ok('후보가 없으면 빈 것', T.bestChain([]).length===0);

const F=path.join(__dirname,'시험지표본.json');
if(!fs.existsSync(F)){
  S.ok('시험지 표본이 있다 (없으면 경계 찾기는 건너뜁니다)', false, F);
}else{
  const data=JSON.parse(fs.readFileSync(F,'utf8'));
  let tp=0, fn=0, fp=0, pages=0, exact=0;
  Object.keys(data).forEach(key=>{
    data[key].forEach(r=>{
      const got=T.detect(r.ts, r.W, r.H).map(b=>b.n);
      const g=new Set(got), t=new Set(r.truth);
      const hit=r.truth.filter(n=>g.has(n)).length;
      tp+=hit; fn+=r.truth.length-hit; fp+=got.filter(n=>!t.has(n)).length;
      pages++; if(hit===r.truth.length && got.length===r.truth.length) exact++;
    });
  });
  const rate=tp/(tp+fn)*100, ex=exact/pages*100;
  S.ok('문항의 9할 넘게 찾는다', rate>=90, rate.toFixed(1)+'% ('+tp+'/'+(tp+fn)+')');
  S.ok('잘못 잡는 것이 문항 수의 5% 미만', fp < (tp+fn)*0.05, fp+'개');
  S.ok('쪽의 8할 넘게 통째로 맞힌다', ex>=80, ex.toFixed(1)+'% ('+exact+'/'+pages+')');

  /* 낱낱이 맞아야 하는 시험 셋 — 파이썬 정답과 완전히 같아야 한다 */
  ['2603g3','2706mp','2606g1'].forEach(key=>{
    if(!data[key]) return;
    let ok=true, detail=[];
    data[key].forEach(r=>{
      const got=T.detect(r.ts,r.W,r.H).map(b=>b.n).sort((a,b)=>a-b);
      if(got.join(',')!==r.truth.join(',')){ ok=false; detail.push('['+got+']≠['+r.truth+']'); }
    });
    S.ok('«'+key+'» 은 쪽마다 정답과 똑같다', ok, detail.join(' '));
  });

  /* 한 단짜리·두 단짜리를 모두 가려내는가 */
  let two=0;
  Object.keys(data).forEach(key=>data[key].forEach(r=>{
    const body=r.ts.filter(t=>t.s&&t.s.trim()&&t.top>r.H*0.055&&t.top+t.h<r.H*0.955);
    if(T.findCols(body,r.W,r.H).length===2) two++;
  }));
  S.ok('두 단짜리 시험지를 가려낸다', two>=pages*0.7, two+'/'+pages+'쪽');
}
S.done();
