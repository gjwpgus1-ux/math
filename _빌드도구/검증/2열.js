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

/* 칸 높이는 이제 재지 않는다. 칸이 문항 길이만큼 늘어나기 때문이다.
   자세한 것은 «한눈에.js» 에서 본다. */
done();
