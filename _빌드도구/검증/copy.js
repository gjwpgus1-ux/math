/* 웹 주소에서 복사가 되는지 — b64 폴더가 없는 상황을 흉내 낸다 */
const fs=require('fs'),path=require('path');
const {JSDOM,VirtualConsole}=require('jsdom');
const APP='/sessions/serene-festive-hamilton/mnt/클로드 코워크/기출문제검색기 제작/기출문제_검색기';
const html=fs.readFileSync(path.join(APP,'index.html'),'utf8');
const wait=ms=>new Promise(r=>setTimeout(r,ms));
let pass=0,fail=0;
const ok=(n,c,e)=>{ if(c){pass++;console.log('  OK   '+n);} else {fail++;console.log('  FAIL '+n+(e!==undefined?'  → '+e:''));} };

function boot(url){
  const dom=new JSDOM(html,{runScripts:'outside-only',pretendToBeVisual:true,url:url,
                            virtualConsole:new VirtualConsole()});
  const w=dom.window, doc=w.document;
  w.HTMLCanvasElement.prototype.getContext=()=>({fillStyle:'',fillRect(){},drawImage(){}});
  w.HTMLCanvasElement.prototype.toBlob=cb=>cb({type:'image/png',size:123});
  Object.defineProperty(w.Image.prototype,'src',{set(v){this._src=v;setTimeout(()=>this.onload&&this.onload(),0);},get(){return this._src;}});
  Object.defineProperty(w.Image.prototype,'naturalWidth',{get(){return 800;}});
  Object.defineProperty(w.Image.prototype,'naturalHeight',{get(){return 400;}});
  Object.defineProperty(w.Image.prototype,'complete',{get(){return true;}});
  w.indexedDB=undefined; w.print=()=>{};
  w.__copied=[];
  w.navigator.clipboard={ write:async(items)=>{ w.__copied.push(items); } };
  w.ClipboardItem=function(o){ return o; };
  w.HTMLElement.prototype.click=function(){ this.dispatchEvent(new w.Event('click',{bubbles:true})); };
  /* b64 조각은 서버에 없다 — script 를 붙이면 실패하도록 */
  w.__b64calls=[];
  const realAppend=w.document.head.appendChild.bind(w.document.head);
  w.document.head.appendChild=function(el){
    if(el.tagName==='SCRIPT' && /(^|\/)b64\//.test(el.getAttribute('src')||el.src||'')){
      w.__b64calls.push(el.getAttribute('src'));
      setTimeout(()=>el.onerror&&el.onerror(new w.Event('error')),0);
      return el;
    }
    return realAppend(el);
  };
  w.eval(fs.readFileSync(APP+'/data/index.js','utf8'));
  w.eval(fs.readFileSync(APP+'/data/sim.js','utf8'));
  w.eval(fs.readFileSync(APP+'/data/std.js','utf8'));
  w.eval(html.match(/<script>([\s\S]*?)<\/script>/)[1]);
  return {w,doc,$:id=>doc.getElementById(id),
          click:el=>el.dispatchEvent(new w.Event('click',{bubbles:true})),
          key:k=>doc.dispatchEvent(new w.KeyboardEvent('keydown',{key:k}))};
}

(async()=>{
  console.log('\n[1] GitHub 주소에서 (b64 없음)');
  const H=boot('https://gjwpgus1-ux.github.io/math/');
  const {w,doc,$,click,key}=H;
  await wait(200);
  key('1'); key('Enter'); await wait(150);
  $('q').value='둘러싸인 부분의 넓이'; $('q').dispatchEvent(new w.Event('input')); await wait(340);
  ok('문항검색 모드', $('modeSearch').className==='on');
  const card=doc.querySelector('.card');
  ok('문항이 나옴', !!card);
  ok('«클릭하면 복사» 안내', card.querySelector('.cue').textContent==='클릭하면 복사');
  const t=()=>$('toast').textContent;
  $('toast').textContent='';
  click(card.querySelector('.body')); await wait(300);
  ok('오류가 나지 않음', !/복사하지 못했습니다/.test(t()), t());
  ok('복사됨 알림', /복사했습니다/.test(t()), t());
  ok('클립보드에 들어감', w.__copied.length===1, w.__copied.length);
  ok('b64 를 부르지 않음', w.__b64calls.length===0, w.__b64calls.join(', '));

  console.log('\n[2] 여러 문항을 눌러도');
  const cards=[...doc.querySelectorAll('.card')];
  for(let i=1;i<cards.length;i++){
    $('toast').textContent='';
    click(cards[i].querySelector('.body')); await wait(250);
    if(/복사하지 못했습니다/.test(t())){ ok('문항 '+(i+1)+' 복사', false, t()); break; }
  }
  ok('네 문항 모두 복사됨', w.__copied.length===cards.length, w.__copied.length+' / '+cards.length);

  console.log('\n[3] 학습 모드의 «복사» 단추도');
  click($('modeStudy')); await wait(150);
  const c2=doc.querySelector('.card');
  const btn=[...c2.querySelectorAll('button')].find(b=>b.textContent==='복사');
  ok('복사 단추 있음', !!btn);
  const before=w.__copied.length;
  $('toast').textContent='';
  click(btn); await wait(300);
  ok('복사됨', w.__copied.length===before+1 && /복사했습니다/.test(t()), t());

  console.log('\n[4] 컴퓨터에서 파일을 직접 열었을 때는 b64 를 쓴다');
  const F=boot('file:///C:/math/index.html');
  await wait(200);
  F.key('1'); F.key('Enter'); await wait(150);
  F.$('q').value='둘러싸인 부분의 넓이'; F.$('q').dispatchEvent(new F.w.Event('input')); await wait(340);
  F.$('toast').textContent='';
  F.click(F.doc.querySelector('.card .body')); await wait(800);
  ok('b64 를 부름', F.w.__b64calls.length>0, F.w.__b64calls.join(', ')||'없음');
  ok('없으면 안내가 뜸', /b64 폴더가 있어야/.test(F.$('toast').textContent),
     JSON.stringify(F.$('toast').textContent)+' / class='+F.$('toast').className);

  console.log('\n결과: 통과 '+pass+' · 실패 '+fail);
  process.exit(fail?1:0);
})();
