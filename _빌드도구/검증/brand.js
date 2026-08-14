/* 사이트 이름·부제 · 모드 단추 */
const fs=require('fs'), path=require('path');
const {JSDOM}=require('jsdom');
const {boot,scorer,APP}=require('./harness.js');
const S=scorer();
const {w,doc,$}=boot('MODE:()=>MODE');

/* ---- 이름 ---- */
S.ok('탭 제목이 줍줍닷컴으로 시작', /^줍줍닷컴/.test(doc.title), doc.title);
S.ok('탭 제목에 검색 낱말이 남아 있다', /수학 기출문제 검색기/.test(doc.title), doc.title);
S.ok('설명 메타가 있다', !!doc.querySelector('meta[name=description]'));
S.ok('설명 메타에 줍줍닷컴', /줍줍닷컴/.test(doc.querySelector('meta[name=description]').content));
S.ok('설명 메타에 문항 수', /5,694/.test(doc.querySelector('meta[name=description]').content));
S.ok('공유용 제목이 있다', !!doc.querySelector('meta[property="og:title"]'));
S.ok('모바일 설정이 있다', !!doc.querySelector('meta[name=viewport]'));

const brand=$('title').querySelector('.brand');
S.ok('윗줄 이름이 줍줍닷컴', brand && brand.textContent==='줍줍닷컴', brand&&brand.textContent);
const tag=$('title').querySelector('.tagline');
S.ok('부제가 옆에 있다', !!tag && tag.textContent.length>10, tag&&tag.textContent);
S.ok('부제에 수능·모평·학평이 들어 있다', /수능·모평·학평/.test(tag.textContent));
S.ok('제작자 표시가 남아 있다', /제작자 : 허선생/.test($('title').textContent));
const css=fs.readFileSync(path.join(APP,'index.html'),'utf8').replace(/\s+/g,'');
S.ok('이름이 부제보다 크다', /h1\.brand\{[^}]*font-size:21px/.test(css));
S.ok('좁은 화면에서는 부제를 숨긴다', /h1\.tagline\{display:none\}/.test(css));

/* ---- 모드 단추 ---- */
const sw=doc.querySelector('.modesw');
const btns=[...sw.querySelectorAll('button')];
S.ok('모드 단추가 둘', btns.length===2, btns.length);
S.ok('왼쪽이 학습모드', btns[0].id==='modeStudy' && btns[0].textContent==='학습모드',
     btns[0].id+' / '+btns[0].textContent);
S.ok('오른쪽이 복붙모드', btns[1].id==='modeSearch' && btns[1].textContent==='복붙모드',
     btns[1].id+' / '+btns[1].textContent);
S.ok('처음에는 복붙모드가 켜져 있다', btns[1].className==='on' && btns[0].className!=='on',
     btns[0].className+' / '+btns[1].className);
S.ok('시작 모드가 search', T_mode()==='search', T_mode());
function T_mode(){ return w.__T.MODE(); }

/* 눌러서 바꿔도 잘 도는가 */
$('modeStudy').dispatchEvent(new w.Event('click',{bubbles:true}));
S.ok('학습모드로 바뀐다', T_mode()==='study', T_mode());
S.ok('학습모드 단추가 켜진다', $('modeStudy').className==='on');
S.ok('선택줄이 나타난다', $('studybar').classList.contains('on'));
$('modeSearch').dispatchEvent(new w.Event('click',{bubbles:true}));
S.ok('복붙모드로 되돌아온다', T_mode()==='search', T_mode());
S.ok('선택줄이 사라진다', !$('studybar').classList.contains('on'));

/* ---- 세 쪽에도 반영되었는가 ---- */
['about.html','privacy.html','contact.html'].forEach(f=>{
  const d=new JSDOM(fs.readFileSync(path.join(APP,f),'utf8')).window.document;
  S.ok(f+' 제목에 줍줍닷컴', /줍줍닷컴/.test(d.title), d.title);
  S.ok(f+' 윗줄에 줍줍닷컴', /줍줍닷컴/.test(d.querySelector('a.home').textContent));
  S.ok(f+' 윗줄 이름이 굵게', !!d.querySelector('a.home b'));
  S.ok(f+' 예전 이름이 안 남아 있다',
       !/수학 수능\/모평\/학평 기출문제 검색기/.test(d.body.innerHTML));
});
const ab=new JSDOM(fs.readFileSync(path.join(APP,'about.html'),'utf8')).window.document;
S.ok('소개에 «복붙 모드» 로 적혀 있다', ab.body.textContent.indexOf('복붙 모드')>=0);
S.ok('소개에 예전 «문항 검색 모드» 가 없다', ab.body.textContent.indexOf('문항 검색 모드')<0);

/* 단축키 창 설명도 따라 바뀌었는가 */
$('keysBtn').dispatchEvent(new w.Event('click',{bubbles:true}));
S.ok('단축키 창이 복붙모드로 적혀 있다', $('mbox').textContent.indexOf('복붙모드는 복사')>=0);
S.done();
