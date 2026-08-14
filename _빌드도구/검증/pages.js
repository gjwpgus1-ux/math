/* 소개·개인정보·문의 세 쪽과 검색기 꼬리말 */
const fs=require('fs'), path=require('path');
const {JSDOM}=require('jsdom');
const {boot,scorer,APP}=require('./harness.js');
const S=scorer();
const PAGES=['about.html','privacy.html','contact.html'];
const NAMES={'about.html':'소개','privacy.html':'개인정보 처리방침','contact.html':'문의'};

/* 파일이 다 있나 */
S.ok('page.css 가 있다', fs.existsSync(path.join(APP,'page.css')));
PAGES.forEach(p=>S.ok(p+' 가 있다', fs.existsSync(path.join(APP,p))));

const doms={};
PAGES.forEach(p=>{
  const html=fs.readFileSync(path.join(APP,p),'utf8');
  const d=new JSDOM(html).window.document;
  doms[p]=d;
  const t=d.title, txt=d.body.textContent;

  S.ok(p+' — 한국어 문서', d.documentElement.lang==='ko', d.documentElement.lang);
  S.ok(p+' — 제목에 «'+NAMES[p]+'»', t.indexOf(NAMES[p])>=0, t);
  S.ok(p+' — 설명 메타가 있다', !!d.querySelector('meta[name=description]'));
  S.ok(p+' — 모바일 설정이 있다', !!d.querySelector('meta[name=viewport]'));
  S.ok(p+' — 같은 모양새 파일을 쓴다',
       !!d.querySelector('link[href="page.css"]'));
  S.ok(p+' — 검색기로 돌아가는 링크', !!d.querySelector('a[href="index.html"]'));

  /* 세 쪽이 서로 다 이어지는가 */
  PAGES.forEach(q=>{
    S.ok(p+' → '+q+' 링크', !!d.querySelector('a[href="'+q+'"]'), q);
  });
  /* 지금 보고 있는 쪽은 표시 */
  const on=d.querySelector('nav a.on');
  S.ok(p+' — 현재 쪽 표시', on && on.getAttribute('href')===p, on&&on.getAttribute('href'));

  /* 밖에서 받아오는 것 없나 (글꼴·스크립트) */
  S.ok(p+' — 밖에서 받아오는 파일이 없다',
       [...d.querySelectorAll('link[href],script[src],img[src]')]
         .every(e=>!/^https?:/.test(e.getAttribute('href')||e.getAttribute('src')||'')));
  S.ok(p+' — 스크립트가 없다', d.querySelectorAll('script').length===0);
  /* 저작권 안내는 소개·문의 쪽에 둔다 (처리방침에는 넣을 자리가 아니다) */
  if(p!=='privacy.html') S.ok(p+' — 저작권 안내가 있다', /평가원|저작권/.test(txt));
  S.ok(p+' — 내용이 충분하다', txt.replace(/\s+/g,'').length>500, txt.replace(/\s+/g,'').length);
});

/* 개인정보 처리방침이 실제 하는 일과 맞는가 */
const pv=doms['privacy.html'].body.textContent;
[['방문','방문 기록'],['검색어','검색어 수집'],['익명번호','익명번호 설명'],
 ['localStorage','기기 저장 설명'],['IP','IP 안내'],['쿠키','쿠키 안내'],
 ['광고','광고 안내'],
 ['시행일','시행일'],['만 14세','나이 안내'],['시크릿','기록 안 남기는 법']].forEach(p=>{
  S.ok('방침에 «'+p[1]+'» 이 있다', pv.indexOf(p[0])>=0);
});
S.ok('방침이 «개인정보를 모으지 않는다»고 밝힌다', /이름[,·\s]*이메일/.test(pv));
S.ok('방침에 구글 광고 설정 링크가 걸려 있다',
     !!doms['privacy.html'].querySelector('a[href*="adssettings.google.com"]'));
S.ok('방침의 바깥 링크는 새 창으로 안전하게 열린다',
     [...doms['privacy.html'].querySelectorAll('a[href^="http"]')]
       .every(a=>a.getAttribute('rel')==='noopener'));
S.ok('방침에 시행일이 오늘 날짜', pv.indexOf('2026년 8월 14일')>=0);

/* 문의 쪽 */
const ct=doms['contact.html'].body.textContent;
S.ok('문의에 이메일이 있다', /heojh\.business@gmail\.com/.test(ct));
S.ok('이메일이 누를 수 있게 되어 있다',
     !!doms['contact.html'].querySelector('a[href^="mailto:"]'));
S.ok('문의에 오류제보 안내가 있다', ct.indexOf('오류제보')>=0);
S.ok('문의에 저작권 연락 안내가 있다', ct.indexOf('저작권자')>=0);

/* 소개 쪽 숫자가 실제와 같은가 */
const ab=doms['about.html'].body.textContent;
const {w}=boot('IT:IT,EX:EX');
const T=w.__T;
S.ok('소개의 문항 수가 실제와 같다',
     ab.indexOf(T.IT.length.toLocaleString())>=0, T.IT.length.toLocaleString());
S.ok('소개의 시험 수가 실제와 같다',
     ab.indexOf(T.EX.length+'개')>=0, T.EX.length+'개');
S.ok('소개의 수식글 수가 실제와 같다',
     ab.indexOf(T.IT.filter(i=>i[6]).length.toLocaleString())>=0,
     T.IT.filter(i=>i[6]).length.toLocaleString());

/* 검색기 꼬리말 */
const {doc,$}=boot('');
S.ok('검색기에 꼬리말이 있다', !!$('foot'));
PAGES.forEach(p=>{
  S.ok('꼬리말에 '+p+' 링크', !!$('foot').querySelector('a[href="'+p+'"]'));
});
S.ok('꼬리말이 본문 안에 있다', $('foot').closest('main')!==null);
S.ok('꼬리말에 저작권 안내가 있다', /평가원/.test($('foot').textContent));
const html=fs.readFileSync(path.join(APP,'index.html'),'utf8');
S.ok('인쇄할 때 꼬리말은 안 나온다', /#foot\{display:none|,#foot\{display:none|#foot[^}]*display:none/.test(
     html.replace(/\s+/g,'')) || /#cmp,#std,#crs,#foot\{display:none!important\}/.test(html.replace(/\s+/g,'')),
     '인쇄 CSS');
S.done();
