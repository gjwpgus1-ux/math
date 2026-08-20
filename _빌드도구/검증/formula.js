/* 수식 검색 점검 — 바꿔쓰기·대소문자·색인 붙음 상태 */
const {boot,scorer}=require('./harness.js');
const {w,$}=boot('search:search,fconv:fconv,isF:isF,IT:IT,EX:EX,norm:norm');
const T=w.__T, S=scorer();

/* ---- 색인에 수식글이 제대로 붙었는가 ---- */
const withF=T.IT.filter(it=>it[6]);
const sm=T.IT.filter(it=>T.EX[it[0]].g==='수능·모평');
S.ok('수식글이 붙은 문항이 5,400개 이상', withF.length>=5400, withF.length);
S.ok('전 문항의 95% 넘게 수식글이 있다',
     withF.length/T.IT.length>0.95, (withF.length/T.IT.length*100).toFixed(1)+'%');
S.ok('수능·모평 문항의 9할 넘게 수식글이 있다',
     withF.length/sm.length>0.9, (withF.length/sm.length*100).toFixed(0)+'%');
/* 수식글이 없는 것은 글자가 아예 없는 스캔본뿐이어야 한다 */
const noF={};
T.IT.filter(it=>!it[6]).forEach(it=>{ noF[T.EX[it[0]].n]=1; });
S.ok('수식글 없는 시험이 10개 이하(스캔본)', Object.keys(noF).length<=10, Object.keys(noF).join(','));
S.ok('학년별로 고루 붙었다',
     ['고1','고2','고3','수능·모평'].every(g=>withF.some(it=>T.EX[it[0]].g===g)));
S.ok('수식글에 띄어쓰기가 없다', withF.every(it=>!/\s/.test(it[6])));
S.ok('수식글에 그림글자(PUA)가 남아 있지 않다',
     withF.every(it=>!/[-]/.test(it[6])));

/* ---- 바꿔쓰기 ---- */
[['sqrt2','√2'],['root3','√3'],['sum','Σ'],['int','∫'],['pi','π'],
 ['theta','θ'],['alpha','α'],['beta','β'],['abs','|'],['vert','|'],
 ['루트','√'],['시그마','Σ'],['적분','∫'],['파이','π'],['세타','θ'],
 ['극한','lim'],['무한대','∞'],
 ['x->0','x→0'],['SQRT','√']].forEach(p=>{
  S.ok('바꿔쓰기 '+p[0]+' → %s'.replace('%s',p[1]), T.fconv(p[0])===p[1], T.fconv(p[0]));
});
/* «절댓값» 은 일부러 기호로 안 바꾼다 — 아래 «절댓값» 묶음 참고 */
S.ok('절댓값은 기호로 안 바꾼다', T.fconv('절댓값')==='절댓값', T.fconv('절댓값'));
S.ok('절대값도 마찬가지', T.fconv('절대값')==='절대값', T.fconv('절대값'));
S.ok('abs 로 치면 여전히 기호', T.fconv('abs')==='|', T.fconv('abs'));
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

/* ---- 기호가 든 검색어가 옛 글로 새지 않는가 ----
   a_n 을 옛 글에서 찾으면 «an» 이 되어 아무 문항에나 걸린다. */
['2^3','x^2','a_n','sqrt2','pi','AB','f(x)','절댓값'].forEach(q=>{
  S.ok('«'+q+'» 은 수식글 있는 문항에서만',
       T.search(q).list.every(it=>it[6]), T.search(q).list.filter(it=>!it[6]).length);
});
S.ok('a_n 은 죄다 «a_» 가 실제로 있는 문항이다',
     T.search('a_n').list.every(it=>it[6].indexOf('a_n')>=0), T.search('a_n').list.length);
S.ok('a_n 이 전체의 1/10 을 넘지 않는다',
     T.search('a_n').list.length < T.IT.length/10, T.search('a_n').list.length);
S.ok('a_n 에 전국연합도 들어 있다',
     T.search('a_n').list.some(it=>T.EX[it[0]].g!=='수능·모평'));

/* ---- 수식글 없는 문항도 안 사라지는가 ---- */
const r=T.search('sin');
const 전국=r.list.filter(it=>T.EX[it[0]].g!=='수능·모평').length;
S.ok('sin 검색에 전국연합 문항도 들어 있다', 전국>0, 전국);

/* ---- 절댓값 ----
   세로줄 | 은 절댓값 말고도 P(A|B), {x|…}, 구간별 함수의 큰 괄호에 쓰인다.
   낱말을 기호 하나로 바꾸면 그 모두가 걸려 695문항이 나왔다. */
const A=T.search('절댓값');
S.ok('절댓값은 따로 가려서 찾는다', A.mode==='abs', A.mode);
S.ok('695개(세로줄 전부)보다 훨씬 적다', A.list.length<450 && A.list.length>250, A.list.length);
S.ok('절대값(옛 표기)도 같게 나온다', T.search('절대값').list.length===A.list.length);
S.ok('고른 문항은 모두 짝을 이룬 세로줄을 갖는다',
     A.list.every(it=>/\|[^|{}=]{1,25}\|/.test(it[6]||'')), 'x');
/* P(A|B)·집합만 있는 문항은 안 걸려야 한다 */
const bar=T.IT.filter(it=>(it[6]||'').indexOf('|')>=0);
const only=bar.filter(it=>!/\|[^|{}=]{1,25}\|/.test(it[6]));
S.ok('세로줄이 홀로 있는 문항은 빠진다', only.length>0 && !A.list.some(it=>only.indexOf(it)>=0), only.length);
S.ok('|x| 로 치면 그대로 수식 검색', T.search('|x|').mode==='formula');
S.ok('쉼표로 묶어도 된다 — 절댓값, 수열',
     T.search('절댓값, 수열').list.length>0 && T.search('절댓값, 수열').list.length<A.list.length,
     T.search('절댓값, 수열').list.length);
/* 낱말이 섞이면 수식으로는 못 찾으니 글자로 내려가야 한다 */
S.ok('«절댓값 함수» 가 결과 없음으로 끝나지 않는다', T.search('절댓값 함수').list.length>0,
     T.search('절댓값 함수').list.length);
/* 다른 낱말은 예전 그대로 */
S.ok('시그마는 여전히 기호로 찾는다', T.search('시그마').mode==='formula');
S.ok('적분도 그대로', T.search('적분').mode==='formula');

/* ---- <보기> ㄱㄴㄷ 유형 ----
   «옳은 것만을 있는 대로 고른 것은?» 으로 찾으면, 같은 유형이면서
   다르게 쓴 문항(보기의 각 명제에 대하여 / 보기에서 참인 명제만을 /
   옳은 것만을 보기에서 …)까지 함께 나와야 한다. */
const B=T.search('옳은 것만을 있는 대로 고른 것은');
S.ok('보기 유형으로 따로 찾는다', B.mode==='bogi', B.mode);
const bn=new Set(B.list.map(it=>T.EX[it[0]].n+'#'+it[1]));
[['24학년도 6월 공통',21],['17학년도 6월 나형',16],['2025년 6월 고1',20],
 ['2022년 6월 고1',21],['2018년 4월 고3 나형',15]].forEach(p=>{
  S.ok('다르게 쓴 «'+p[0]+' '+p[1]+'번» 도 나온다', bn.has(p[0]+'#'+p[1]));
});
S.ok('말 일부만 쳐도 같다', T.search('있는 대로 고른 것은').list.length===B.list.length);
S.ok('«알아보기 위하여» 는 안 섞인다',
     !B.list.some(it=>/알아보기/.test(it[5]) && !/보기의|보기에서|옳은것만을/.test(it[5])));
S.ok('«보기» 만 치면 예전대로 글자 찾기', T.search('보기').mode!=='bogi');
S.ok('보기 유형이 130개는 넘는다', B.list.length>130, B.list.length);

S.done();
