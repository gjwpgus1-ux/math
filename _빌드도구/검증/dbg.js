const fs=require('fs'), path=require('path');
const {boot,wait}=require('./harness');
const APP="/sessions/serene-festive-hamilton/mnt/클로드 코워크/기출문제검색기 제작/기출문제_검색기";
(async()=>{
  const H=boot(); const {w,doc,$,key}=H;
  await wait(250); key('1'); key('Enter'); await wait(150);
  const bins={}; for(const n of ['aux.bin','aux2.bin','aux3.bin']) bins[n]=fs.readFileSync(path.join(APP,'data',n));
  w.fetch=(u)=>{ const m=/data\/(aux\d*\.bin)$/.exec(u); if(!m||!bins[m[1]]) return Promise.resolve({ok:false});
    const b=bins[m[1]]; return Promise.resolve({ok:true,arrayBuffer:()=>Promise.resolve(b.buffer.slice(b.byteOffset,b.byteOffset+b.length))}); };
  if(!w.crypto||!w.crypto.subtle) Object.defineProperty(w,'crypto',{value:require('crypto').webcrypto,writable:true,configurable:true});
  w.TextEncoder=TextEncoder; w.TextDecoder=TextDecoder;
  const N0=w.QDATA.items.length;
  $('q').value='충북모의고사'; $('q').dispatchEvent(new w.Event('input')); await wait(300);
  $('q').dispatchEvent(new w.KeyboardEvent('keydown',{key:'Enter',bubbles:true}));
  await wait(5000);
  console.log('푼 뒤 문항 '+w.QDATA.items.length+' (늘어난 것 '+(w.QDATA.items.length-N0)+')');
  const mine=w.QDATA.items.slice(N0);
  console.log('보기 it[5]:', JSON.stringify(mine[0][5]).slice(0,70));
  console.log('시험:', JSON.stringify(w.QDATA.exams.filter(e=>/충북/.test(e.n))[0]));
  for(const term of ['충북','충북모의고사','충북 모의평가','2027 충북','기하']){
    $('q').value=term; $('q').dispatchEvent(new w.Event('input')); await wait(600);
    const cards=[...doc.querySelectorAll('.card')];
    const cb=cards.filter(c=>/충북/.test(c.textContent)).length;
    const st=($('status')||{}).textContent||'';
    console.log('  «'+term+'» → 카드 '+cards.length+'장 (충북 '+cb+'장) · '+st.replace(/\s+/g,' ').slice(0,50));
  }
  process.exit(0);
})();
