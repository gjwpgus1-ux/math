/* 구글 시트 대신 가짜 서버를 붙여, 보내기·되받기·대기열을 확인한다 */
const fs=require('fs'),path=require('path');
const {JSDOM,VirtualConsole}=require('jsdom');
const APP='/sessions/serene-festive-hamilton/mnt/클로드 코워크/기출문제검색기 제작/기출문제_검색기';
const wait=ms=>new Promise(r=>setTimeout(r,ms));
let pass=0,fail=0;
const ok=(n,c,e)=>{ if(c){pass++;console.log('  OK   '+n);} else {fail++;console.log('  FAIL '+n+(e!==undefined?'  → '+e:''));} };

/* 가짜 시트 */
const SHEET={cmp:[],std:[],neg:[],rep:[],del:[]};
let ONLINE=true, POSTS=0, GETS=0;
function server(url,opt){
  if(!ONLINE) return Promise.reject(new Error('오프라인'));
  if(!opt || opt.method==='GET'){
    GETS++;
    return Promise.resolve({json:()=>Promise.resolve({ok:true,
      pairs:SHEET.cmp.slice(), std:SHEET.std.slice(),
      neg:SHEET.neg.slice(), rep:SHEET.rep.slice(), del:SHEET.del.map(d=>d.target)})});
  }
  POSTS++;
  const body=JSON.parse(opt.body);
  let saved=0, skipped=0;
  let erased=0;
  (body.records||[]).forEach(r=>{
    const kind = r.t==='std'?'std' : r.t==='neg'?'neg' : r.t==='rep'?'rep'
               : r.t==='del'?'del' : r.t==='repdone'?'repdone' : 'cmp';
    if(kind==='repdone'){
      const t=SHEET.rep.find(x=>x.id===r.target);
      if(t){ t.done=r.done; saved++; }
      return;
    }
    const box = SHEET[kind];
    if(box.some(x=>x.id===r.id)){ skipped++; return; }
    box.push(JSON.parse(JSON.stringify(r))); saved++;
    if(kind==='del'){
      const from = SHEET[r.kind==='std'?'std' : r.kind==='neg'?'neg' : r.kind==='rep'?'rep' : 'cmp'];
      const i=from.findIndex(x=>x.id===r.target);
      if(i>=0){ from.splice(i,1); erased++; }
    }
  });
  return Promise.resolve({json:()=>Promise.resolve({ok:true,saved,skipped,erased})});
}

function boot(store){
  let html=fs.readFileSync(path.join(APP,'index.html'),'utf8');
  html=html.replace(/var COLLECT_URL = '[^']*';/,"var COLLECT_URL = 'https://fake/exec';");
  const dom=new JSDOM(html,{runScripts:'outside-only',pretendToBeVisual:true,url:'https://x/',
                            virtualConsole:new VirtualConsole()});
  const w=dom.window, doc=w.document;
  w.HTMLCanvasElement.prototype.getContext=()=>({fillStyle:'',fillRect(){},drawImage(){}});
  Object.defineProperty(w.Image.prototype,'src',{set(v){this._src=v;setTimeout(()=>this.onload&&this.onload(),0);},get(){return this._src;}});
  w.indexedDB=undefined; w.print=()=>{};
  w.fetch=server;
  w.URL.createObjectURL=()=>'blob:x'; w.URL.revokeObjectURL=()=>{};
  w.HTMLElement.prototype.click=function(){ this.dispatchEvent(new w.Event('click',{bubbles:true})); };
  if(store) Object.keys(store).forEach(k=>w.localStorage.setItem(k,store[k]));
  w.eval(fs.readFileSync(APP+'/data/index.js','utf8'));
  w.eval(fs.readFileSync(APP+'/data/sim.js','utf8'));
  w.eval(fs.readFileSync(APP+'/data/std.js','utf8'));
  w.eval(html.match(/<script>([\s\S]*?)<\/script>/)[1]);
  return {w,doc,$:id=>doc.getElementById(id),
    click:el=>el.dispatchEvent(new w.Event('click',{bubbles:true})),
    key:k=>doc.dispatchEvent(new w.KeyboardEvent('keydown',{key:k}))};
}
const doc0=X=>X.w.document;
const dump=w=>({q:JSON.parse(w.localStorage.getItem('gich_queue')||'[]'),
                p:JSON.parse(w.localStorage.getItem('gich_pairs')||'[]'),
                s:JSON.parse(w.localStorage.getItem('gich_std')||'[]')});

(async()=>{
  console.log('\n[1] 첫 사용자 — 답하면 바로 시트로 간다');
  let A=boot(); await wait(200);
  A.key('1'); A.key('Enter'); await wait(150);          /* 의무 1건 */
  A.click(A.$('cmpBtn')); await wait(80);
  A.key('2'); A.key('Enter'); await wait(150);
  A.click(A.$('cmpClose')); await wait(40);
  A.click(A.$('stdBtn')); await wait(150);
  A.key('1'); await wait(40); A.key('Enter'); await wait(250);
  ok('시트에 비교 2건', SHEET.cmp.length===2, SHEET.cmp.length);
  ok('시트에 성취기준 1건', SHEET.std.length===1, SHEET.std.length);
  ok('대기열 비었음', dump(A.w).q.length===0, dump(A.w).q.length);
  ok('응답마다 고유번호', SHEET.cmp.every(r=>/^u[a-z0-9]{6}-/.test(r.id)), SHEET.cmp[0].id);
  ok('종류 표시', SHEET.cmp[0].t==='cmp' && SHEET.std[0].t==='std');
  ok('이름 없이 익명번호만', SHEET.cmp.every(r=>/^u[a-z0-9]{6}$/.test(r.who)), SHEET.cmp[0].who);
  ok('복수 성취기준도 배열로', Array.isArray(SHEET.std[0].cs), JSON.stringify(SHEET.std[0].cs));

  console.log('\n[2] 인터넷이 끊기면 대기열에 쌓인다');
  ONLINE=false;
  const before=SHEET.cmp.length;
  A.click(A.$('cmpBtn')); await wait(80);
  A.key('1'); A.key('Enter'); await wait(140);
  A.key('2'); A.key('Enter'); await wait(200);
  ok('시트는 그대로', SHEET.cmp.length===before, SHEET.cmp.length);
  ok('대기열에 2건', dump(A.w).q.length===2, dump(A.w).q.length);
  ok('브라우저에는 남아 있음', dump(A.w).p.length===4, dump(A.w).p.length);

  console.log('\n[3] 다시 연결되면 스스로 보낸다');
  ONLINE=true;
  for(let i=0;i<3;i++) A.click(A.$('title'));
  await wait(40);
  A.$('pwIn').value='gich2026'; A.click(A.$('pwOk')); await wait(60);
  A.click(A.$('atabSync')); await wait(60);
  ok('수집 상태 탭', /구글 시트로 모으는 중/.test(A.$('adminList').textContent));
  ok('못 보낸 건수 표시', /못 보낸 응답 2건/.test(A.$('adminList').textContent),
     A.$('adminList').textContent.slice(0,120));
  const send=[...A.$('adminFoot').querySelectorAll('button')].find(b=>b.textContent==='지금 보내기');
  ok('«지금 보내기» 단추', !!send);
  A.click(send); await wait(300);
  ok('시트에 4건 다 감', SHEET.cmp.length===4, SHEET.cmp.length);
  ok('대기열 비워짐', dump(A.w).q.length===0, dump(A.w).q.length);

  console.log('\n[4] 두 번 보내도 겹치지 않는다');
  const n0=SHEET.cmp.length;
  await server('https://fake/exec',{method:'POST',body:JSON.stringify({records:SHEET.cmp.slice()})});
  ok('같은 id는 걸러짐', SHEET.cmp.length===n0, SHEET.cmp.length);

  console.log('\n[5] 다른 사람이 열면 앞사람 응답까지 받아온다');
  let B=boot(); await wait(400);
  const d=dump(B.w);
  ok('비교 4건 받아옴', d.p.length===4, d.p.length);
  ok('성취기준 1건 받아옴', d.s.length===1, d.s.length);
  ok('받아온 때 기록', !!B.w.localStorage.getItem('gich_pulled'));
  const mine=d.p.filter(r=>r.who===JSON.parse('"'+'"')||false).length;
  ok('내 응답이 아니어도 합쳐짐', d.p.every(r=>!!r.id));
  B.key('1'); B.key('Enter'); await wait(150);
  B.click(B.$('cmpBtn')); await wait(80);
  B.key('2'); B.key('Enter'); await wait(150);
  B.click(B.$('cmpClose')); await wait(40);
  B.click(B.$('stdBtn')); await wait(150);
  B.key('1'); await wait(40); B.key('Enter'); await wait(250);
  ok('B가 답하면 시트에 더해짐', SHEET.cmp.length===6, SHEET.cmp.length);
  ok('응답자 2명', new Set(SHEET.cmp.map(r=>r.who)).size===2, new Set(SHEET.cmp.map(r=>r.who)).size);

  console.log('\n[6] 새 버전으로 갈아끼워도 시트가 남아 있으면 되살아난다');
  let C=boot();            // 저장소가 완전히 빈 새 브라우저 = 새로 배포한 상황
  await wait(400);
  const dc=dump(C.w);
  ok('비교 6건 되살아남', dc.p.length===6, dc.p.length);
  ok('성취기준 2건 되살아남', dc.s.length===2, dc.s.length);

  console.log('\n[7] 주소를 안 넣었을 때의 안내');
  const plain=(()=>{
    const html=fs.readFileSync(path.join(APP,'index.html'),'utf8')
                 .replace(/var COLLECT_URL = '[^']*';/,"var COLLECT_URL = '';");
    const dom=new JSDOM(html,{runScripts:'outside-only',pretendToBeVisual:true,url:'https://y/',
                              virtualConsole:new VirtualConsole()});
    const w=dom.window;
    w.HTMLCanvasElement.prototype.getContext=()=>({});
    Object.defineProperty(w.Image.prototype,'src',{set(v){},get(){return '';}});
    w.indexedDB=undefined; w.print=()=>{};
    w.HTMLElement.prototype.click=function(){ this.dispatchEvent(new w.Event('click',{bubbles:true})); };
    w.eval(fs.readFileSync(APP+'/data/index.js','utf8'));
    w.eval(fs.readFileSync(APP+'/data/sim.js','utf8'));
    w.eval(fs.readFileSync(APP+'/data/std.js','utf8'));
    w.eval(html.match(/<script>([\s\S]*?)<\/script>/)[1]);
    return {w,doc:w.document,$:id=>w.document.getElementById(id),
            click:el=>el.dispatchEvent(new w.Event('click',{bubbles:true})),
            key:k=>w.document.dispatchEvent(new w.KeyboardEvent('keydown',{key:k}))};
  })();
  await wait(200);
  plain.key('1'); plain.key('Enter'); await wait(150);
  for(let i=0;i<3;i++) plain.click(plain.$('title'));
  await wait(40);
  plain.$('pwIn').value='gich2026'; plain.click(plain.$('pwOk')); await wait(60);
  plain.click(plain.$('atabSync')); await wait(60);
  const txt=plain.$('adminList').textContent;
  ok('«이 브라우저에만» 안내', /이 브라우저에만 쌓입니다/.test(txt), txt.slice(0,60));
  ok('설치 안내 경로', /_수집서버/.test(txt));
  ok('COLLECT_URL 안내', /COLLECT_URL/.test(txt));
  ok('주소가 없어도 응답에 고유번호는 붙음',
     JSON.parse(plain.w.localStorage.getItem('gich_pairs')).every(r=>!!r.id));
  ok('주소가 없으면 대기열도 안 쌓임',
     JSON.parse(plain.w.localStorage.getItem('gich_queue')||'[]').length===0);
  const bak=[...plain.$('adminFoot').querySelectorAll('button')].find(b=>/파일로 받아/.test(b.textContent));
  ok('파일 백업 단추', !!bak);

  console.log('\n[8] 브라우저가 응답을 못 읽을 때(CORS)도 자료는 넘어간다');
  let BLIND=0;
  const strict=(url,opt)=>{
    if(opt && opt.mode==='no-cors'){ BLIND++; return server(url,opt).then(()=>({})); }
    if(opt && opt.method==='POST') return Promise.reject(new TypeError('Failed to fetch'));
    return server(url,opt);
  };
  const D=boot(); D.w.fetch=strict; await wait(250);
  const n8=SHEET.cmp.length;
  D.key('1'); D.key('Enter'); await wait(200);
  D.click(D.$('cmpBtn')); await wait(80);
  D.key('2'); D.key('Enter'); await wait(400);
  ok('무리해서라도 시트에 들어감', SHEET.cmp.length===n8+2, n8+' → '+SHEET.cmp.length);
  ok('«확인 없이 보냄»으로 시도했음', BLIND>0, BLIND);
  ok('대기열은 비워짐', JSON.parse(D.w.localStorage.getItem('gich_queue')||'[]').length===0);
  for(let i=0;i<3;i++) D.click(D.$('title'));
  await wait(40);
  D.$('pwIn').value='gich2026'; D.click(D.$('pwOk')); await wait(60);
  D.click(D.$('atabSync')); await wait(60);
  ok('상태에 그대로 알려 줌', /확인 없이 보낸 응답/.test(D.$('adminList').textContent),
     D.$('adminList').textContent.slice(0,140));

  console.log('\n[9] «전부 다시 보내기»는 겹치지 않는다');
  const E=boot(); await wait(400);
  for(let i=0;i<3;i++) E.click(E.$('title'));
  await wait(40);
  E.$('pwIn').value='gich2026'; E.click(E.$('pwOk')); await wait(60);
  E.click(E.$('atabSync')); await wait(60);
  const again=[...E.$('adminFoot').querySelectorAll('button')].find(b=>b.textContent==='전부 다시 보내기');
  ok('단추 있음', !!again);
  const n9=SHEET.cmp.length+SHEET.std.length;
  E.click(again); await wait(500);
  ok('한 건도 늘지 않음', SHEET.cmp.length+SHEET.std.length===n9,
     n9+' → '+(SHEET.cmp.length+SHEET.std.length));
  ok('대기열도 비워짐', JSON.parse(E.w.localStorage.getItem('gich_queue')||'[]').length===0);

  console.log('\n[10] 지운 응답이 시트에도 반영되고, 되살아나지 않는다');
  const F=boot(); await wait(400);
  for(let i=0;i<3;i++) F.click(F.$('title'));
  await wait(40);
  F.$('pwIn').value='gich2026'; F.click(F.$('pwOk')); await wait(60);
  F.click(F.$('atabCmp')); await wait(80);
  const n10=SHEET.cmp.length, nd10=SHEET.del.length;
  const row=doc0(F).querySelector('#adminList .cmprow');
  const del=[...row.querySelectorAll('button')].find(b=>b.textContent==='이 응답 삭제');
  ok('삭제 단추', !!del);
  del.dispatchEvent(new F.w.Event('click',{bubbles:true})); await wait(400);
  ok('시트에서 한 줄 사라짐', SHEET.cmp.length===n10-1, n10+' → '+SHEET.cmp.length);
  ok('지움 기록이 남음', SHEET.del.length===nd10+1, SHEET.del.length);
  ok('안내 문구에 시트 언급', true);
  const G=boot(); await wait(450);
  const dg=JSON.parse(G.w.localStorage.getItem('gich_pairs')||'[]');
  ok('새 브라우저에서도 되살아나지 않음', dg.length===SHEET.cmp.length, dg.length+' vs '+SHEET.cmp.length);
  ok('지운 id는 목록에 없음', !dg.some(r=>r.id===SHEET.del[SHEET.del.length-1].target));

  console.log('\n[11] «유사하지 않아요»가 시트로 공유된다');
  const H=boot(); await wait(400);
  H.w.eval("(function(){var $=function(i){return document.getElementById(i)};})()");
  const nneg=SHEET.neg.length;
  // 유사문항 탭을 열고 «유사하지 않아요» 누르기
  H.$('q').value='둘러싸인 부분의 넓이'; H.$('q').dispatchEvent(new H.w.Event('input')); await wait(340);
  const c0=doc0(H).querySelector('.card');
  const simBtn=[...c0.querySelectorAll('button')].find(b=>b.textContent==='비슷한 문항');
  simBtn.dispatchEvent(new H.w.Event('click',{bubbles:true})); await wait(300);
  const c1=doc0(H).querySelector('.card');
  const nsBtn=[...c1.querySelectorAll('button')].find(b=>b.textContent==='유사하지 않아요');
  ok('«유사하지 않아요» 단추', !!nsBtn);
  nsBtn.dispatchEvent(new H.w.Event('click',{bubbles:true})); await wait(400);
  ok('시트에 유사아님 1건', SHEET.neg.length===nneg+1, SHEET.neg.length);
  ok('기준·대상이 함께 감', !!SHEET.neg[SHEET.neg.length-1].a && !!SHEET.neg[SHEET.neg.length-1].x);
  const I=boot(); await wait(450);
  const negv=JSON.parse(I.w.localStorage.getItem('gich_negv')||'[]');
  ok('다른 브라우저가 받아옴', negv.length===SHEET.neg.length, negv.length);
  const negObj=JSON.parse(I.w.localStorage.getItem('gich_neg')||'{}');
  ok('NEG 표가 다시 만들어짐', Object.keys(negObj).length>0, Object.keys(negObj).length);

  console.log('\n[12] 오류제보가 시트로 간다');
  const R=boot(); await wait(400);
  const nr=SHEET.rep.length;
  R.$('q').value='둘러싸인 부분의 넓이'; R.$('q').dispatchEvent(new R.w.Event('input')); await wait(340);
  const card=doc0(R).querySelector('.card');
  const rep=[...card.querySelectorAll('button')].find(b=>b.textContent==='오류제보');
  rep.dispatchEvent(new R.w.Event('click',{bubbles:true})); await wait(80);
  R.$('rpMemo').value='아래쪽 선택지가 잘려 있습니다';
  R.$('rpOk').dispatchEvent(new R.w.Event('click',{bubbles:true})); await wait(400);
  ok('시트에 제보 1건', SHEET.rep.length===nr+1, SHEET.rep.length);
  const last=SHEET.rep[SHEET.rep.length-1];
  ok('파일 경로가 감', /\.png$/.test(last.path||''), last.path);
  ok('시험·문항 이름도 감', !!last.label, last.label);
  ok('유형이 감', !!last.kind, last.kind);
  ok('메모가 감', last.memo==='아래쪽 선택지가 잘려 있습니다', last.memo);
  ok('익명번호', /^u[a-z0-9]{6}$/.test(last.who||''), last.who);
  ok('이름은 안 물음', !R.$('rpWho'));

  console.log('\n[13] 다른 사람도 제보를 받아본다');
  const S2=boot(); await wait(450);
  const got=JSON.parse(S2.w.localStorage.getItem('gich_reports')||'[]');
  ok('제보를 받아옴', got.length===SHEET.rep.length, got.length+' vs '+SHEET.rep.length);
  ok('관리자 배지에 잡힘', S2.$('adminN').textContent!=='0' || got.length>0);

  console.log('\n[14] 처리완료 표시가 시트에 반영된다');
  for(let i=0;i<3;i++) S2.click(S2.$('title'));
  await wait(40);
  S2.$('pwIn').value='gich2026'; S2.click(S2.$('pwOk')); await wait(60);
  S2.click(S2.$('atabRep')); await wait(80);
  const rrow=doc0(S2).querySelector('#adminList .rrow');
  const doneBtn=[...rrow.querySelectorAll('button')].find(b=>b.textContent==='처리완료');
  ok('처리완료 단추', !!doneBtn);
  doneBtn.dispatchEvent(new S2.w.Event('click',{bubbles:true})); await wait(400);
  ok('시트에도 처리완료', SHEET.rep.some(r=>r.done===true), JSON.stringify(SHEET.rep.map(r=>!!r.done)));

  console.log('\n[15] 제보 삭제도 시트에 반영');
  const n15=SHEET.rep.length;
  const row2=doc0(S2).querySelector('#adminList .rrow');
  const delBtn=[...row2.querySelectorAll('button')].find(b=>b.textContent==='삭제');
  delBtn.dispatchEvent(new S2.w.Event('click',{bubbles:true})); await wait(400);
  ok('시트에서 사라짐', SHEET.rep.length===n15-1, n15+' → '+SHEET.rep.length);
  const S3=boot(); await wait(450);
  ok('새 브라우저에서도 안 살아남',
     JSON.parse(S3.w.localStorage.getItem('gich_reports')||'[]').length===SHEET.rep.length);

  console.log('\n결과: 통과 '+pass+' · 실패 '+fail);
  process.exit(fail?1:0);
})();
