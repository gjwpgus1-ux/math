/* 접속할 때마다 질문이 뜨는지 확인 — 같은 저장소를 물려받은 새 창을 흉내 낸다 */
const fs=require('fs'),path=require('path');
const {JSDOM,VirtualConsole}=require('jsdom');
const APP='/sessions/serene-festive-hamilton/mnt/클로드 코워크/기출문제검색기 제작/기출문제_검색기';
const html=fs.readFileSync(path.join(APP,'index.html'),'utf8');
const wait=ms=>new Promise(r=>setTimeout(r,ms));
let pass=0,fail=0;
const ok=(n,c,e)=>{ if(c){pass++;console.log('  OK   '+n);} else {fail++;console.log('  FAIL '+n+(e!==undefined?'  → '+e:''));} };

/* 브라우저 저장소를 흉내 내 여러 «접속»에 걸쳐 이어 준다 */
const LS={}, SS={};
function store(box){
  return { getItem:k=>k in box?box[k]:null, setItem:(k,v)=>{box[k]=String(v);},
           removeItem:k=>{delete box[k];}, clear:()=>{Object.keys(box).forEach(k=>delete box[k]);},
           get length(){return Object.keys(box).length;}, key:i=>Object.keys(box)[i] };
}
function visit(keepSession){
  const dom=new JSDOM(html,{runScripts:'outside-only',pretendToBeVisual:true,url:'https://x/',
                            virtualConsole:new VirtualConsole()});
  const w=dom.window, doc=w.document;
  w.HTMLCanvasElement.prototype.getContext=()=>({fillStyle:'',fillRect(){},drawImage(){}});
  Object.defineProperty(w.Image.prototype,'src',{set(v){this._src=v;setTimeout(()=>this.onload&&this.onload(),0);},get(){return this._src;}});
  Object.defineProperty(w.Image.prototype,'complete',{get(){return true;}});
  w.indexedDB=undefined; w.print=()=>{};
  Object.defineProperty(w,'localStorage',{value:store(LS)});
  Object.defineProperty(w,'sessionStorage',{value:store(keepSession?SS:{})});
  w.HTMLElement.prototype.click=function(){ this.dispatchEvent(new w.Event('click',{bubbles:true})); };
  w.eval(fs.readFileSync(APP+'/data/index.js','utf8'));
  w.eval(fs.readFileSync(APP+'/data/sim.js','utf8'));
  w.eval(fs.readFileSync(APP+'/data/std.js','utf8'));
  w.eval(html.match(/<script>([\s\S]*?)<\/script>/)[1]);
  return {w,doc,$:id=>doc.getElementById(id),
          key:k=>doc.dispatchEvent(new w.KeyboardEvent('keydown',{key:k}))};
}
const open=(H)=>H.$('cmp').classList.contains('open')||H.$('std').classList.contains('open');

(async()=>{
  console.log('\n[1] 첫 접속');
  let A=visit(true); await wait(200);
  ok('질문이 뜸', open(A));
  A.key('1'); A.key('Enter'); await wait(140);
  ok('답하면 닫힘', !open(A));
  ok('응답이 쌓임', JSON.parse(LS['gich_pairs']||'[]').length===1);

  console.log('\n[2] 같은 창에서 새로고침 (예전엔 여기서 안 떴음)');
  let B=visit(true); await wait(200);
  ok('다시 뜸', open(B), 'sessionStorage gich_gate='+SS['gich_gate']);
  B.key('2'); B.key('Enter'); await wait(140);
  ok('두 번째 응답도 쌓임', JSON.parse(LS['gich_pairs']).length===2);

  console.log('\n[3] 또 새로고침');
  let C=visit(true); await wait(200);
  ok('세 번째도 뜸', open(C));
  C.key('0'); await wait(120);
  ok('잘 모르겠음이면 다른 것으로 한 번 더', open(C));
  C.key('1'); await wait(60); C.key('Enter'); await wait(140);
  ok('제대로 답하면 닫힘', !open(C));

  console.log('\n[4] 창을 완전히 닫았다 다시 열어도');
  let D=visit(false); await wait(200);
  ok('뜸', open(D));

  console.log('\n[5] 설정으로 끌 수 있나');
  ok('GATE_EVERY 설정이 있음', /var GATE_EVERY = true;/.test(html));
  ok('설명이 붙어 있음', /접속할 때마다 묻습니다/.test(html));
  const off=html.replace('var GATE_EVERY = true;','var GATE_EVERY = false;');
  const dom=new JSDOM(off,{runScripts:'outside-only',pretendToBeVisual:true,url:'https://y/',virtualConsole:new VirtualConsole()});
  const w2=dom.window;
  w2.HTMLCanvasElement.prototype.getContext=()=>({});
  Object.defineProperty(w2.Image.prototype,'src',{set(v){},get(){return '';}});
  Object.defineProperty(w2.Image.prototype,'complete',{get(){return true;}});
  w2.indexedDB=undefined; w2.print=()=>{};
  const SS2={'gich_gate':'1'};
  Object.defineProperty(w2,'localStorage',{value:store({})});
  Object.defineProperty(w2,'sessionStorage',{value:store(SS2)});
  w2.eval(fs.readFileSync(APP+'/data/index.js','utf8'));
  w2.eval(fs.readFileSync(APP+'/data/sim.js','utf8'));
  w2.eval(fs.readFileSync(APP+'/data/std.js','utf8'));
  w2.eval(off.match(/<script>([\s\S]*?)<\/script>/)[1]);
  await wait(200);
  ok('false 로 두면 안 뜸',
     !w2.document.getElementById('cmp').classList.contains('open') &&
     !w2.document.getElementById('std').classList.contains('open'));

  console.log('\n결과: 통과 '+pass+' · 실패 '+fail);
  process.exit(fail?1:0);
})();
