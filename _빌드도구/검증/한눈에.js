/* 문항칸 안에서 굴리지 않는다 — 가로는 칸 너비 그대로, 세로가 늘어난다 */
const fs=require('fs'),path=require('path');
const {boot,wait,scorer,APP}=require('./harness');
const {w,doc,$}=boot('fitCards:fitCards,IT:IT');
const {ok,done}=scorer();
const CSS=fs.readFileSync(path.join(APP,'index.html'),'utf8').replace(/ /g,'');

console.log('\n[1] 칸 안에서 굴리지 않는다');
ok('문항칸은 overflow:visible', /\.card\.body\{[^}]*overflow:visible/.test(CSS));
ok('예전 overflow:auto 는 없다', !/\.card\.body\{[^}]*overflow:auto/.test(CSS));
ok('칸 높이를 묶지 않는다', !/\.card\.body\{[^}]*max-height/.test(CSS));

console.log('\n[2] 가로는 칸 너비 그대로');
ok('그림은 칸 너비에 꽉', /\.cardimg\{[^}]*width:100%/.test(CSS));
ok('세로는 내용만큼', /\.cardimg\{[^}]*height:auto/.test(CSS));
ok('그림을 줄이지 않는다', !/\.cardimg\{[^}]*max-height/.test(CSS));
ok('object-fit 으로 눌러 담지 않는다', !/\.cardimg\{[^}]*object-fit/.test(CSS));

console.log('\n[3] 칸마다 제 높이대로');
ok('4열 격자는 align-items:start', /\.grid\.page4\{[^}]*align-items:start/.test(CSS));
ok('넓은 격자도 align-items:start', /\.grid\{[^}]*align-items:start/.test(CSS));

console.log('\n[4] 칸 높이를 재던 일은 그만두었다');
function setW(px){ Object.defineProperty(w,'innerWidth',{value:px,configurable:true}); }
Object.defineProperty(w,'innerHeight',{value:1000,configurable:true});
setW(1600); w.__T.fitCards();
ok('--cardh 를 매기지 않는다', !doc.documentElement.style.getPropertyValue('--cardh'),
   doc.documentElement.style.getPropertyValue('--cardh'));
ok('--cardh 를 쓰는 규칙도 없다', CSS.indexOf('var(--cardh')<0);
setW(390); w.__T.fitCards();
ok('좁은 화면에서도 마찬가지', !doc.documentElement.style.getPropertyValue('--cardh'));
setW(1600);

console.log('\n[5] 문항이 얼마나 길어지는가 (칸 너비 400)');
const r=w.__T.IT.map(i=>i[4]/i[3]).sort((a,b)=>a-b);
const pc=p=>r[Math.floor(r.length*p)];
console.log('   중앙 '+Math.round(400*pc(.5))+'px · 90% '+Math.round(400*pc(.9))
            +'px · 제일 긴 것 '+Math.round(400*r[r.length-1])+'px');
ok('절반은 화면 한 눈에 들어온다', 400*pc(.5)<400, Math.round(400*pc(.5)));
done();
