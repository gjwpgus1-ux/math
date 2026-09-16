/* 최소화 모드 — 로고·줍줍닷컴·검색창·탭만 남긴다 */
const {boot,wait,scorer}=require('./harness');
const H=boot('setMin:setMin,toggleMin:toggleMin');
const {w,doc,$,click,key}=H;
const {ok,done}=scorer();
const vis=id=>{ const el=$(id); return !!el && w.getComputedStyle(el).display!=='none'; };
const shown=sel=>{ const el=doc.querySelector(sel); return !!el && w.getComputedStyle(el).display!=='none'; };

(async()=>{
  await wait(250);

  console.log('\n[1] 처음에는 켜져 있지 않다');
  ok('최소화 아님', !doc.body.classList.contains('min'));
  ok('단추가 있다', !!$('minBtn'));
  ok('단추는 늘 보인다', vis('minBtn'));

  console.log('\n[2] 켜면 윗줄이 접힌다');
  click($('minBtn')); await wait(120);
  ok('body 에 표시', doc.body.classList.contains('min'));
  ['부제:.tagline','제작자:.by'].forEach(s=>{
    const [n,sel]=s.split(':');
    ok(n+' 감춤', !shown('h1 '+sel), sel);
  });
  ['sub','clear','helpBtn','keysBtn','fbar','filters','status','studybar'].forEach(id=>
    ok(id+' 감춤', !vis(id)));
  ok('모드 단추 감춤', !shown('.modesw'));

  console.log('\n[3] 남아야 할 것은 남는다');
  ok('로고', vis('logo'));
  ok('줍줍닷컴', shown('h1 .brand'));
  ok('검색창', vis('q'));
  ok('탭', vis('tabs'));
  ok('최소화 단추', vis('minBtn'));
  ok('문항이 그려져 있다', doc.querySelectorAll('#grid .card').length>0);

  console.log('\n[4] 되돌리기');
  ok('단추 모양이 바뀐다', $('minBtn').textContent.indexOf('▾')>=0, $('minBtn').textContent);
  ok('저장된다', w.localStorage.getItem('gich_min')==='1');
  click($('minBtn')); await wait(120);
  ok('원래대로', !doc.body.classList.contains('min'));
  ok('부제가 돌아온다', shown('h1 .tagline'));
  ok('필터줄도 돌아온다', vis('fbar'));
  ok('저장도 바뀐다', w.localStorage.getItem('gich_min')==='0');

  console.log('\n[5] m 키로도 된다');
  key('m'); await wait(120);
  ok('m 으로 켜짐', doc.body.classList.contains('min'));
  key('m'); await wait(120);
  ok('m 으로 꺼짐', !doc.body.classList.contains('min'));
  $('q').focus(); key('m'); await wait(80);
  ok('검색창에 커서가 있으면 안 듣는다', !doc.body.classList.contains('min'));
  $('q').blur();

  console.log('\n[6] 단축키 목록에 적혀 있다');
  click($('keysBtn')); await wait(150);
  ok('m 이 적혀 있다', /최소화/.test($('mbox').textContent));
  done();
})();
