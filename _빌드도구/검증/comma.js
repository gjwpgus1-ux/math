const {boot,scorer}=require('./harness.js');
const {w}=boot('search:search,parseQuery:parseQuery,EX:EX,IT:IT');
const T=w.__T, S=scorer();
const n=q=>T.search(q).list.length;
const md=q=>T.search(q).mode;

S.ok('«lim, x^2» 은 모두포함 방식', md('lim, x^2')==='comma', md('lim, x^2'));
S.ok('둘 다 든 것만 나온다',
     T.search('lim, x^2').list.every(it=>it[6]&&it[6].indexOf('lim')>=0&&it[6].indexOf('x^2')>=0),
     n('lim, x^2'));
S.ok('lim 하나보다 적다', n('lim, x^2')<n('lim'), n('lim, x^2')+' < '+n('lim'));
S.ok('x^2 하나보다 적다', n('lim, x^2')<n('x^2'));
S.ok('띄어쓰기 있으나 없으나 같다', n('lim, x^2')===n('lim,x^2'));
S.ok('차례를 바꿔도 같다', n('lim, x^2')===n('x^2, lim'));
S.ok('셋도 된다', md('lim, x^2, sin')==='comma', n('lim, x^2, sin'));
S.ok('셋은 둘보다 적거나 같다', n('lim, x^2, sin')<=n('lim, x^2'));

S.ok('한글끼리도 된다', md('정규분포, 표준편차')==='comma', n('정규분포, 표준편차'));
S.ok('한글+수식 섞어도 된다', md('확률, x^2')==='comma', n('확률, x^2'));

/* 번호 늘어놓기는 예전 그대로 */
S.ok('«1,2,3» 은 번호로 읽는다', md('고3 3월 1,2,3')!=='comma', md('고3 3월 1,2,3'));
S.ok('«1,2,3» 결과가 있다', n('고3 3월 1,2,3')>0, n('고3 3월 1,2,3'));
S.ok('«26 고3 3월 1,2,3,7» 도 그대로', n('26 고3 3월 1,2,3,7')>0, n('26 고3 3월 1,2,3,7'));

/* 조건과 섞기 */
const r=T.search('고3 6월, x^2');
S.ok('«고3 6월, x^2» 은 조건 하나 + 문구 하나라 모두포함 아님', r.mode!=='comma', r.mode);
S.ok('«고3 6월, x^2» 결과가 있다', r.list.length>0, r.list.length);
S.ok('«고2, lim, sin» 도 걸러진다', T.search('고2, lim, sin').list.every(it=>T.EX[it[0]].g==='고2'),
     T.search('고2, lim, sin').list.length);

/* 쉼표 없으면 예전 그대로 */
S.ok('쉼표 없는 «정규분포» 그대로', md('정규분포')!=='comma');
S.ok('쉼표 없는 «x^2» 그대로', md('x^2')==='formula');
S.done();
