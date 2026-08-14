/* 도함수 프라임 — f'(x) · g''(x) */
const {boot,scorer}=require('./harness.js');
const {w}=boot('search:search,fconv:fconv,isF:isF,IT:IT,EX:EX,HELP:HELP');
const T=w.__T, S=scorer();
const n=q=>T.search(q).list.length;

/* ---- 색인이 한 가지로 모였는가 ---- */
const withF=T.IT.filter(it=>it[6]);
S.ok('색인에 ″ 가 남아 있지 않다', withF.every(it=>it[6].indexOf('″')<0));
S.ok('색인에 ’ 가 남아 있지 않다', withF.every(it=>it[6].indexOf('’')<0));
S.ok('색인에 자판 따옴표가 없다', withF.every(it=>it[6].indexOf("'")<0));
const prime=withF.filter(it=>it[6].indexOf('′')>=0);
S.ok('프라임이 든 문항이 400개 넘는다', prime.length>400, prime.length);
S.ok('2계도함수도 ′′ 로 들어 있다',
     withF.some(it=>it[6].indexOf('′′')>=0),
     withF.filter(it=>it[6].indexOf('′′')>=0).length);

/* ---- 바꿔쓰기 ---- */
[["f'","f′"],["f'(x)","f′(x)"],["f'(1)","f′(1)"],["g''(x)","g′′(x)"],
 ["f’(x)","f′(x)"],["f″(x)","f′′(x)"],["f`(x)","f′(x)"]].forEach(p=>{
  S.ok('바꿔쓰기 '+p[0]+' → '+p[1], T.fconv(p[0])===p[1], T.fconv(p[0]));
});
S.ok("f' 는 수식으로 본다", T.isF(T.fconv("f'")));

/* ---- 실제로 찾아지는가 ---- */
S.ok("f'(x) 가 50문항 넘는다", n("f'(x)")>50, n("f'(x)"));
S.ok("f'(1) 이 하나라도 있다", n("f'(1)")>0, n("f'(1)"));
S.ok("g'(x) 가 하나라도 있다", n("g'(x)")>0, n("g'(x)"));
/* 2계도함수는 «f′′(x)» 처럼 x 를 그대로 쓴 문항이 없다. 괄호까지만 쳐야 걸린다. */
S.ok("f''( 가 하나라도 있다", n("f''(")>0, n("f''("));
S.ok("h''( 도 있다", n("h''(")>0, n("h''("));
S.ok("f'' 가 f''( 이상", n("f''")>=n("f''("), n("f''")+' >= '+n("f''("));
S.ok("f’(x) (스마트 따옴표)도 같은 수", n("f’(x)")===n("f'(x)"), n("f’(x)")+' vs '+n("f'(x)"));
S.ok("f′(x) (프라임 직접)도 같은 수", n("f′(x)")===n("f'(x)"));
S.ok("f'(x) 결과는 모두 f′(x) 를 담고 있다",
     T.search("f'(x)").list.every(it=>it[6] && it[6].indexOf('f′(x)')>=0));
S.ok("f' 가 f'(x) 보다 많다", n("f'")>n("f'(x)"), n("f'")+' > '+n("f'(x)"));
S.ok("f''( 가 f'( 보다 적다", n("f''(")<n("f'("), n("f''(")+' < '+n("f'("));
S.ok("f''( 결과는 모두 f′′( 를 담고 있다",
     T.search("f''(").list.length>0 &&
     T.search("f''(").list.every(it=>it[6].indexOf('f′′(')>=0));

/* 쉼표와도 함께 */
S.ok("«f'(x), lim» 이 둘 다 든 것만", T.search("f'(x), lim").list.every(
     it=>it[6].indexOf('f′(x)')>=0 && it[6].indexOf('lim')>=0), n("f'(x), lim"));

/* 도움말에 적혀 있는가 */
S.ok('도움말에 도함수 예가 있다',
     JSON.stringify(T.HELP).indexOf("f'(x)")>=0);
S.done();
