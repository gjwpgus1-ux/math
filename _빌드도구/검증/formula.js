/* 수식 검색 점검 — 바꿔쓰기·대소문자·색인 붙음 상태 */
const {boot,scorer}=require('./harness.js');
const {w,$}=boot('search:search,fconv:fconv,isF:isF,IT:IT,EX:EX,norm:norm');
const T=w.__T, S=scorer();

/* ---- 색인에 수식글이 제대로 붙었는가 ---- */
const withF=T.IT.filter(it=>it[6]);
const sm=T.IT.filter(it=>T.EX[it[0]].g==='수능·모평');
S.ok('수식글이 붙은 문항이 1,500개 이상', withF.length>=1500, withF.length);
S.ok('수식글은 수능·모평에만 붙었다',
     withF.every(it=>T.EX[it[0]].g==='수능·모평'), withF.length);
S.ok('수능·모평 문항의 9할 넘게 수식글이 있다',
     withF.length/sm.length>0.9, (withF.length/sm.length*100).toFixed(0)+'%');
S.ok('수식글에 띄어쓰기가 없다', withF.every(it=>!/\s/.test(it[6])));
S.ok('수식글에 그림글자(PUA)가 남아 있지 않다',
     withF.every(it=>!/[-]/.test(it[6])));

/* ---- 바꿔쓰기 ---- */
[['sqrt2','√2'],['root3','√3'],['sum','Σ'],['int','∫'],['pi','π'],
 ['theta','θ'],['alpha','α'],['beta','β'],['abs','|'],['vert','|'],
 ['루트','√'],['시그마','Σ'],['적분','∫'],['파이','π'],['세타','θ'],
 ['절댓값','|'],['절대값','|'],['극한','lim'],['무한대','∞'],
 ['x->0','x→0'],['SQRT','√']].forEach(p=>{
  S.ok('바꿔쓰기 '+p[0]+' → '+p[1], T.fconv(p[0])===p[1], T.fconv(p[0]));
});
S.ok('낱말 속 int 는 안 바꾼다', T.fconv('point')==='point', T.fconv('point'));
S.ok('낱말 속 pi 는 안 바꾼다', T.fconv('pig')==='pig', T.fconv('pig'));
S.ok('띄어쓰기는 없앤다', T.fconv('sin x')==='sinx', T.fconv('sin x'));

/* ---- 수식으로 볼지 가르기 ---- */
[['x^2',true],['a_n',true],['f(x)',true],['sqrt2',true],['lim',true],
 ['sin',true],['AB',true],['2^3',true],['x->0',true],
 ['정규분포',false],['둘러싸인부분의넓이',false],['확률',false]].forEach(p=>{
  S.ok('«'+p[0]+'» 수식으로 '+(p[1]?'봄':'안 봄'), T.isF(T.fconv(p[0]))===p[1]);
});

/* ---- 실제로 찾아지는가 ---- */
function n(q){ return T.search(q).list.length; }
function mode(q){ return T.search(q).mode; }
S.ok('x^2 가 100문항 이상', n('x^2')>=100, n('x^2'));
S.ok('a_n 이 100문항 이상', n('a_n')>=100, n('a_n'));
S.ok('sqrt 가 50문항 이상', n('sqrt')>=50, n('sqrt'));
/* 한글 이름은 수식글 없는 문항에서 «시그마»라는 낱말 자체로도 걸리므로,
   수식글이 붙은 문항끼리만 견준다. */
function nf(q){ return T.search(q).list.filter(it=>it[6]).length; }
S.ok('루트 도 sqrt 와 같은 수', nf('루트')===nf('sqrt'), nf('루트')+' vs '+nf('sqrt'));
S.ok('시그마 도 sum 과 같은 수', nf('시그마')===nf('sum'), nf('시그마')+' vs '+nf('sum'));
S.ok('세타 도 theta 와 같은 수', nf('세타')===nf('theta'), nf('세타')+' vs '+nf('theta'));
S.ok('pi 가 30문항 이상', n('pi')>=30, n('pi'));
S.ok('수식 검색은 formula 방식으로', mode('x^2')==='formula', mode('x^2'));
S.ok('한글 검색은 예전 방식 그대로', mode('정규분포')!=='formula', mode('정규분포'));

/* ---- 대소문자 ---- */
const big=n('AB'), small=n('ab');
S.ok('AB 와 ab 는 다른 결과', big!==small, big+' vs '+small);
S.ok('AB 가 하나라도 있다', big>0, big);

/* ---- 예전 검색이 그대로인가 ---- */
S.ok('정규분포 결과가 그대로 나온다', n('정규분포')>0, n('정규분포'));
S.ok('필터·번호 검색이 그대로', T.search('고3 6월 22').list.length>0);
S.ok('빈 검색은 전체', T.search('').list.length===T.IT.length);

/* ---- 기호를 떼면 숫자만 남는 검색어는 옛 글로 새지 않는가 ---- */
S.ok('2^3 은 수식글 있는 문항에서만',
     T.search('2^3').list.every(it=>it[6]), T.search('2^3').list.filter(it=>!it[6]).length);
S.ok('x^2 도 수식글 있는 문항에서만',
     T.search('x^2').list.every(it=>it[6]));
S.ok('2^3 이 x^2 보다 헐렁하지 않다',
     T.search('2^3').list.length < T.search('f(x)').list.length);

/* ---- 수식글 없는 문항도 안 사라지는가 ---- */
const r=T.search('sin');
const 전국=r.list.filter(it=>T.EX[it[0]].g!=='수능·모평').length;
S.ok('sin 검색에 전국연합 문항도 들어 있다', 전국>0, 전국);

S.done();
