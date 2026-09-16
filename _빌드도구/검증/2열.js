/* 화면 너비에 따라 4열 → 2열 → 1열 */
const fs=require('fs'),path=require('path');
const {boot,wait,scorer,APP}=require('./harness');
const {w,doc,$}=boot('fitCards:fitCards,perPage:perPage');
const {ok,done}=scorer();
const RAW=fs.readFileSync(path.join(APP,'index.html'),'utf8');
const CSS=RAW.replace(/ /g,'');

console.log('\n[1] 세 단계가 다 있다');
ok('넓은 화면 4열', /\.grid\.page4\{grid-template-columns:repeat\(4,1fr\)/.test(CSS));
const mid=/@media\(min-width:821px\)and\(max-width:1240px\)\{([\s\S]*?)\n\}/.exec(CSS);
ok('중간 너비 규칙이 있다', !!mid);
ok('중간은 2열', /\.grid\.page4\{grid-template-columns:repeat\(2,1fr\)/.test(mid?mid[1]:''));
const nar=/@media\(max-width:820px\)\{([\s\S]*?)\n\}/.exec(CSS);
ok('좁은 화면 1열', /\.grid\.page4\{grid-template-columns:1fr/.test(nar?nar[1]:''));

console.log('\n[2] 한 쪽에 넣는 문항은 그대로 넷');
ok('4문항 그대로', w.__T.perPage()===4, w.__T.perPage());

/* 칸 높이는 열 수와 상관없이 같게 둔다.
   칸 안에서 굴리지 않고 그림을 줄여 보여 주기 때문에, 2열이라고 높이를 깎으면
   문항이 절반 크기로 쪼그라든다. 아랫줄은 쪽을 조금 내려 보면 된다.
   (자세한 것은 «한눈에.js») */
console.log('\n[3] 칸 높이는 열 수와 상관없이 같다');
function setW(px){ Object.defineProperty(w,'innerWidth',{value:px,configurable:true}); }
Object.defineProperty(w,'innerHeight',{value:1000,configurable:true});
setW(1600); w.__T.fitCards();
const wide=parseInt(doc.documentElement.style.getPropertyValue('--cardh'),10);
setW(1100); w.__T.fitCards();
const two=parseInt(doc.documentElement.style.getPropertyValue('--cardh'),10);
ok('넓은 화면 높이가 잡힌다', wide>0, wide);
ok('2열도 같은 높이', two===wide, wide+' vs '+two);
setW(700); w.__T.fitCards();
ok('좁은 화면에서는 높이를 안 매긴다',
   !doc.documentElement.style.getPropertyValue('--cardh'));
setW(1600); w.__T.fitCards();
done();
