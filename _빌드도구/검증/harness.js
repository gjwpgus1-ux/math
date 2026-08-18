/* 앱을 가상 브라우저에 띄우는 공통 준비 */
const fs=require('fs'),path=require('path');
const {JSDOM,VirtualConsole}=require('jsdom');
const APP='/sessions/serene-festive-hamilton/mnt/클로드 코워크/기출문제검색기 제작/기출문제_검색기';
function boot(expose){
  const html=fs.readFileSync(path.join(APP,'index.html'),'utf8');
  const dom=new JSDOM(html,{runScripts:'outside-only',pretendToBeVisual:true,url:'https://x/',
                            virtualConsole:new VirtualConsole()});
  const w=dom.window, doc=w.document;
  w.HTMLCanvasElement.prototype.getContext=()=>({fillStyle:'',fillRect(){},drawImage(){}});
  w.HTMLCanvasElement.prototype.toDataURL=()=>'data:image/png;base64,T';
  w.HTMLCanvasElement.prototype.toBlob=cb=>cb({type:'image/png'});
  Object.defineProperty(w.Image.prototype,'src',{set(v){this._src=v;setTimeout(()=>this.onload&&this.onload(),0);},get(){return this._src;}});
  Object.defineProperty(w.Image.prototype,'naturalWidth',{get(){return 800;}});
  Object.defineProperty(w.Image.prototype,'naturalHeight',{get(){return 400;}});
  /* jsdom은 그림을 실제로 내려받지 않아 load 이벤트가 오지 않는다.
     인쇄가 «그림 다 실릴 때까지» 기다리므로, 이미 실린 것으로 보이게 한다. */
  Object.defineProperty(w.Image.prototype,'complete',{get(){return true;}});
  w.indexedDB=undefined;
  w.print=function(){ w.__printed=(w.__printed||0)+1; };
  w.HTMLElement.prototype.click=function(){ this.dispatchEvent(new w.Event('click',{bubbles:true})); };
  w.eval(fs.readFileSync(APP+'/data/index.js','utf8'));
  w.eval(fs.readFileSync(APP+'/data/sim.js','utf8'));
  w.eval(fs.readFileSync(APP+'/data/std.js','utf8'));
  if(fs.existsSync(APP+'/data/ans.js')) w.eval(fs.readFileSync(APP+'/data/ans.js','utf8'));
  if(fs.existsSync(APP+'/data/sol.js')) w.eval(fs.readFileSync(APP+'/data/sol.js','utf8'));
  let SRC=html.match(/<script>([\s\S]*?)<\/script>/)[1];
  if(expose){
    SRC=SRC.replace(/\}\)\(\);\s*$/,'window.__T={'+expose+'};})();');
    if(!/__T=/.test(SRC)) throw new Error('IIFE 끝을 못 찾음');
  }
  w.eval(SRC);
  return {w,doc,html,APP,
    $:id=>doc.getElementById(id),
    click:el=>el.dispatchEvent(new w.Event('click',{bubbles:true})),
    key:k=>doc.dispatchEvent(new w.KeyboardEvent('keydown',{key:k})),
    btn:(root,t)=>[...root.querySelectorAll('button')].find(b=>b.textContent===t)};
}
const wait=ms=>new Promise(r=>setTimeout(r,ms));
function scorer(){
  let pass=0,fail=0;
  return {ok:(n,c,e)=>{ if(c){pass++;console.log('  OK   '+n);} else {fail++;console.log('  FAIL '+n+(e!==undefined?'  → '+e:''));} },
          done:()=>{ console.log('\n결과: 통과 '+pass+' · 실패 '+fail); process.exit(fail?1:0); }};
}
module.exports={boot,wait,scorer,APP};
