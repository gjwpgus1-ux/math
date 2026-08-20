/* 잠가 둔 보조 자료 — 열쇠말로만 열리는지, 밖으로 새지 않는지 본다.
   파이썬 build_secret.py 가 잠근 파일을 브라우저 쪽 코드가 그대로 푸는지까지 확인한다. */
const fs=require('fs'), path=require('path'), cp=require('child_process');
const {boot,wait,scorer}=require('./harness');
const {ok,done}=scorer();

const APP=path.join(__dirname,'..','..');
const TOOL=path.join(APP,'_빌드도구');
const AUX=path.join(APP,'data','aux.bin');
const PW='테스트암호1234';
const WORK='/tmp/검증_비공개';

/* 맞추는 자료를 만들고 파이썬으로 잠근다 */
function makeFixture(){
  const w=path.join(WORK,'t01');
  fs.mkdirSync(path.join(w,'img'),{recursive:true});
  /* 1×1 흰 점 PNG */
  const png=Buffer.from(
    'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==','base64');
  const qs=[];
  for(let n=1;n<=3;n++){
    fs.writeFileSync(path.join(w,'img',`000_0${n}.png`),png);
    qs.push({num:n,text:`잠근자료 문항 ${n} 사인법칙`});
  }
  fs.writeFileSync(path.join(w,'q.json'),JSON.stringify({file:'t01.pdf',exams:[
    {name:'검증비공개 1회',year:'2026',round:'1회',subject:'공통',grade:'고3',questions:qs}]}),'utf8');
  fs.writeFileSync(path.join(w,'manifest.jsonl'),
    JSON.stringify(qs.map(q=>({exam:0,num:q.num,img:`000_0${q.num}.png`,w:600,h:220})))+'\n','utf8');
  cp.execFileSync('python3',[path.join(TOOL,'build_secret.py'),WORK,'t01'],
                  {env:{...process.env,AUX_PW:PW},stdio:'pipe'});
}

(async()=>{
  const had=fs.existsSync(AUX) ? fs.readFileSync(AUX) : null;
  makeFixture();

  console.log('\n[1] 잠근 파일 생김새');
  const blob=fs.readFileSync(AUX);
  ok('data/aux.bin 이 생겼다', blob.length>100, blob.length+'바이트');
  ok('머리표가 JJ1', blob.slice(0,3).toString()==='JJ1');
  ok('안이 글자로 안 보인다', !blob.toString('latin1').includes('검증비공개'));
  ok('시험 이름도 안 보인다', !blob.toString('utf8').includes('사인법칙'));
  /* 같은 내용을 두 번 잠그면 소금·nonce 가 달라 결과가 달라야 한다 */
  const first=Buffer.from(blob); makeFixture();
  ok('다시 잠그면 바이트가 달라진다', !first.equals(fs.readFileSync(AUX)));

  const H=boot(); const {w,doc,$,key}=H;
  /* harness 의 key() 는 document 로 보낸다. 검색창 Enter 는 검색창에 직접 보내야 한다. */
  const enter=()=>$('q').dispatchEvent(new w.KeyboardEvent('keydown',{key:'Enter',bubbles:true}));
  await wait(250);
  key('1'); key('Enter'); await wait(150);

  /* jsdom 에는 fetch·crypto.subtle 이 없으니 node 것을 빌려 준다 */
  const bin=fs.readFileSync(AUX);
  w.fetch=(u)=>Promise.resolve({ok:/aux\.bin$/.test(u),
    arrayBuffer:()=>Promise.resolve(bin.buffer.slice(bin.byteOffset,bin.byteOffset+bin.length))});
  /* jsdom 의 window.crypto 는 바꿔 끼울 수 없게 막혀 있어 새로 정의해 준다 */
  if(!w.crypto || !w.crypto.subtle){
    Object.defineProperty(w,'crypto',{value:require('crypto').webcrypto,
                                      writable:true,configurable:true});
  }
  w.TextEncoder=TextEncoder; w.TextDecoder=TextDecoder;

  const N0=w.QDATA.items.length;

  console.log('\n[2] 틀린 말로는 안 열린다');
  $('q').value='아무거나긴말이지만틀림';
  $('q').dispatchEvent(new w.Event('input')); await wait(300);
  ok('결과가 없다', /결과 없음/.test($('status').textContent), $('status').textContent.slice(0,20));
  enter(); await wait(1500);
  ok('문항이 늘지 않았다', w.QDATA.items.length===N0, w.QDATA.items.length);
  ok('아무 알림도 없다', !/열렸|잠금|암호/.test($('toast').textContent||''), $('toast').textContent);

  console.log('\n[3] 맞는 말이면 조용히 열린다');
  $('q').value=PW;
  $('q').dispatchEvent(new w.Event('input')); await wait(300);
  enter(); await wait(2500);
  ok('문항 3개가 늘었다', w.QDATA.items.length===N0+3, w.QDATA.items.length-N0);
  ok('검색창이 비워졌다', $('q').value==='', JSON.stringify($('q').value));
  const ex=w.QDATA.exams.filter(e=>e.n==='검증비공개 1회');
  ok('시험이 들어왔다', ex.length===1);
  ok('비공개 표시(x)가 붙어 있다', ex[0] && ex[0].x===1, ex[0]&&ex[0].x);

  console.log('\n[4] 열린 뒤 검색된다');
  $('q').value='사인법칙';
  $('q').dispatchEvent(new w.Event('input')); await wait(400);
  const txt=doc.querySelector('#list') ? doc.querySelector('#list').textContent : doc.body.textContent;
  ok('잠근 문항이 목록에 나온다', /검증비공개/.test(txt));
  /* 잠근 문항 카드의 그림은 서버 주소가 아니라 글자로 박힌 그림이어야 한다.
     (harness 가 Image.src 를 가로채므로 속성이 아니라 값으로 읽는다) */
  const card=[...doc.querySelectorAll('.card')].find(c=>/검증비공개/.test(c.textContent));
  const im=card && card.querySelector('img');
  ok('잠근 문항 카드를 찾았다', !!im);
  ok('그림은 글자로 박혀 있다 (서버에 안 올린다)',
     im && /^data:image\/png/.test(im.src||''), im && String(im.src).slice(0,24));

  console.log('\n[5] 밖으로 새지 않는다');
  const src=fs.readFileSync(path.join(APP,'index.html'),'utf8');
  ok('열쇠말은 코드에 없다', !src.includes(PW));
  ok('시험 이름도 코드에 없다', !src.includes('검증비공개'));
  ok('사용기록에서 막는다', /statLog[\s\S]{0,400}EX\[i\]\.x/.test(src));
  ok('시트로 보낼 때도 막는다', /function auxTouch/.test(src) && /if\(auxTouch\(rec\)\) return;/.test(src));
  ok('못 찾은 긴 검색어는 글자로 안 남긴다', /긴 검색어 · 결과 없음/.test(src));
  ok('새로고침하면 잠긴다 (어디에도 안 담는다)',
     !/localStorage[^\n]*aux|sessionStorage[^\n]*aux/i.test(src));
  ok('풀 때 25만 번 늘린다', /iterations:AUX_ROUNDS/.test(src) && /AUX_ROUNDS=250000/.test(src));

  /* 원래대로 되돌린다 */
  if(had) fs.writeFileSync(AUX,had); else fs.unlinkSync(AUX);
  fs.rmSync(WORK,{recursive:true,force:true});
  done();
})();
