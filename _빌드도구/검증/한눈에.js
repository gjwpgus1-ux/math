/* 문항칸 안에서 굴리지 않고, 긴 문항은 줄여서라도 한눈에 보이게 */
const fs=require('fs'),path=require('path');
const {boot,wait,scorer,APP}=require('./harness');
const {w,doc,$}=boot('fitCards:fitCards,IT:IT');
const {ok,done}=scorer();
const CSS=fs.readFileSync(path.join(APP,'index.html'),'utf8').replace(/ /g,'');

console.log('\n[1] 칸 안에서 굴리지 않는다');
ok('문항칸은 overflow:hidden', /\.card\.body\{[^}]*overflow:hidden/.test(CSS));
ok('예전 overflow:auto 는 없다', !/\.card\.body\{[^}]*overflow:auto/.test(CSS));

console.log('\n[2] 긴 문항은 칸 높이에 맞추어 줄인다');
ok('그림에 max-height 를 매긴다', /\.grid\.page4\.cardimg\{[^}]*max-height:calc\(var\(--cardh/.test(CSS));
ok('가로도 함께 줄인다(width:auto)', /\.grid\.page4\.cardimg\{[^}]*width:auto/.test(CSS));
ok('칸을 넘지 않는다(max-width:100%)', /\.grid\.page4\.cardimg\{[^}]*max-width:100%/.test(CSS));
ok('가운데로 모은다', /\.card\.body\{[^}]*justify-content:center/.test(CSS));

console.log('\n[3] 좁은 화면은 제 크기 그대로');
const nar=/@media\(max-width:820px\)\{([\s\S]*?)\n\}/.exec(CSS);
ok('높이 제한을 푼다', /max-height:none/.test(nar?nar[1]:''));
ok('그림 높이 제한도 푼다', /\.cardimg,\.grid\.page4\.cardimg\{max-height:none/.test(nar?nar[1]:''));

console.log('\n[4] 2열에서도 칸 높이를 깎지 않는다');
function setW(px){ Object.defineProperty(w,'innerWidth',{value:px,configurable:true}); }
Object.defineProperty(w,'innerHeight',{value:1000,configurable:true});
setW(1600); w.__T.fitCards();
const wide=parseInt(doc.documentElement.style.getPropertyValue('--cardh'),10);
setW(1100); w.__T.fitCards();
const two=parseInt(doc.documentElement.style.getPropertyValue('--cardh'),10);
ok('4열과 2열의 칸 높이가 같다', wide===two, wide+' vs '+two);
ok('높이가 넉넉하다', wide>400, wide);

console.log('\n[5] 얼마나 줄어드는가 (칸 너비 400 · 쓸 높이 '+wide+')');
const r=w.__T.IT.map(i=>i[4]/i[3]).sort((a,b)=>a-b);
const need=x=>400*x;
const fit=r.filter(x=>need(x)<=wide).length;
console.log('   줄이지 않아도 되는 문항 '+fit+' / '+r.length+' ('+Math.round(100*fit/r.length)+'%)');
console.log('   제일 긴 문항은 '+Math.round(100*wide/need(r[r.length-1]))+'% 로 줄어든다');
ok('열에 아홉은 그대로 들어간다', fit/r.length>0.85, Math.round(100*fit/r.length)+'%');
ok('제일 긴 것도 절반은 된다', wide/need(r[r.length-1])>0.45,
   Math.round(100*wide/need(r[r.length-1]))+'%');
setW(1600); w.__T.fitCards();
done();
