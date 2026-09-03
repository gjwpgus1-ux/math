/* 과목 필터 — 시험이 아니라 문항마다 가린다 */
const {boot,wait,scorer}=require('./harness');
const H=boot('IT:IT,EX:EX,courseOf:courseOf,passItem:passItem,search:search,CRSset:function(v){CRSV=v;CRSMAP=null;crsSave();},F:F');
const {w,doc,$,click}=H;
const {ok,done}=scorer();
const T=()=>w.__T;
const grp=()=>[...doc.querySelectorAll('#filters .fgroup')].find(x=>x.querySelector('b').textContent==='과목');
const chips=()=>[...grp().querySelectorAll('.chip')];

(async()=>{
  await wait(250);

  console.log('\n[1] 칩 차례');
  const names=chips().map(c=>c.textContent);
  ok('배우는 차례대로 앞에 온다',
     names.slice(0,7).join(',')==='중학교수학,공통수학,대수,미적분Ⅰ,미적분Ⅱ,확통,기하', names.join(','));
  ok('못 가린 것은 시험 이름으로 뒤에 남는다',
     names.slice(7).every(n=>['가형','나형','공통','확통','미적','기하','그 밖'].indexOf(n)>=0), names.slice(7).join(','));

  console.log('\n[2] 시험 하나에 여러 과목이 섞여 있다');
  const 가형=T().IT.filter(it=>T().EX[it[0]].s==='가형');
  const kinds=new Set(가형.map(it=>T().courseOf(it)));
  ok('가형에 과목이 여럿', kinds.size>=4, [...kinds].join(','));
  const 고1=T().IT.filter(it=>T().EX[it[0]].g==='고1' && T().EX[it[0]].r!=='3월');
  ok('고1(3월 제외)은 모두 공통수학', 고1.every(it=>T().courseOf(it)==='공통수학'), 고1.length);
  const 고1삼월=T().IT.filter(it=>T().EX[it[0]].g==='고1' && T().EX[it[0]].r==='3월');
  ok('고1 3월은 모두 중학교수학', 고1삼월.every(it=>T().courseOf(it)==='중학교수학'), 고1삼월.length);
  const 미적=T().IT.filter(it=>T().EX[it[0]].s==='미적');
  ok('선택과목 미적분은 모두 미적분Ⅱ', 미적.every(it=>T().courseOf(it)==='미적분Ⅱ'), 미적.length);

  console.log('\n[3] 설문에서 확정되면 그것이 이긴다');
  const it0=T().IT.find(it=>T().courseOf(it)==='대수');
  const p=it0[2];
  const rows=[]; for(let i=0;i<4;i++) rows.push({t:'crs',p:p,c:'기하',who:'u'+i,at:'x'});
  T().CRSset(rows);
  ok('설문 확정값으로 바뀐다', T().courseOf(it0)==='기하', T().courseOf(it0));
  T().CRSset([]);
  ok('설문을 지우면 자동값으로 돌아온다', T().courseOf(it0)==='대수', T().courseOf(it0));

  console.log('\n[4] 칩을 누르면 그 과목만');
  const c1=chips().find(c=>c.textContent==='미적분Ⅱ');
  click(c1); await wait(300);
  const left=T().IT.filter(it=>T().passItem(it));
  ok('걸러진 것이 모두 미적분Ⅱ', left.length>0 && left.every(it=>T().courseOf(it)==='미적분Ⅱ'), left.length);
  ok('선택과목 미적분 시험만이 아니다',
     new Set(left.map(it=>T().EX[it[0]].s)).size>1, [...new Set(left.map(it=>T().EX[it[0]].s))].join(','));
  const c2=chips().find(c=>c.textContent==='대수');
  click(c2); await wait(300);
  const two=T().IT.filter(it=>T().passItem(it));
  ok('둘을 켜면 둘 다 나온다', two.length>left.length &&
     two.every(it=>['미적분Ⅱ','대수'].indexOf(T().courseOf(it))>=0), two.length);
  click(c1); click(c2); await wait(300);
  ok('다 끄면 모두 나온다', T().IT.filter(it=>T().passItem(it)).length===T().IT.length);

  console.log('\n[5] 검색어로도 찾힌다');
  ok('«대수»', T().search('대수').list.length>1000, T().search('대수').list.length);
  ok('«미적분2» 와 «미적분Ⅱ» 가 같다',
     T().search('미적분2').list.length===T().search('미적분Ⅱ').list.length,
     T().search('미적분2').list.length+' vs '+T().search('미적분Ⅱ').list.length);
  ok('«미적분1» 은 «미적분2» 와 다르다',
     T().search('미적분1').list.length!==T().search('미적분2').list.length);
  ok('«가형» 은 그대로 시험으로 찾힌다', T().search('가형').list.length===1050,
     T().search('가형').list.length);
  done();
})();
