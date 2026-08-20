/* 글쇠 하나짜리 단축키 — / · 1~4 · f · ? */
const {boot,scorer}=require('./harness.js');
const {w,doc,$,html}=boot('search:search,setMode:m=>{MODE=m;},MODE:()=>MODE,SEL:()=>SEL,'+
  'hits:()=>hits,setHits:h=>{hits=h;},render:render,page:()=>page,IT:IT,EX:EX');
const T=w.__T, S=scorer();
/* 시작 팝업이 떠 있으면 키를 다 삼킨다 */
['cmp','crs','std'].forEach(id=>{ const el=$(id); if(el) el.classList.remove('open','gate'); });
const key=(k,o)=>doc.dispatchEvent(new w.KeyboardEvent('keydown',
  Object.assign({key:k,bubbles:true},o||{})));

/* ---- 화면 표시 ---- */
S.ok('검색창 안내에 / 가 적혀 있다', /\//.test($('q').placeholder), $('q').placeholder);
S.ok('안내에 «검색어를 입력하세요» 가 남아 있다', /검색어를 입력하세요/.test($('q').placeholder));
S.ok('필터 단추에 f 표시', !!$('ftoggle').querySelector('.kb') &&
     $('ftoggle').querySelector('.kb').textContent==='f');
S.ok('도움말 단추에 ? 표시', !!$('helpBtn').querySelector('.kb') &&
     $('helpBtn').querySelector('.kb').textContent==='?');
S.ok('단축키 단추가 따로 있다', !!$('keysBtn'));
S.ok('단축키 단추가 도움말 오른쪽에', $('helpBtn').nextElementSibling===$('keysBtn'));
S.ok('단축키 단추에 k 표시', !!$('keysBtn').querySelector('.kb') &&
     $('keysBtn').querySelector('.kb').textContent==='k');
S.ok('필터 단추 글씨는 그대로', /필터 열기/.test($('ftoggle').textContent));

/* ---- 자리 번호 ---- */
$('q').value=''; T.render(true);
const nums=[...$('grid').querySelectorAll('.knum')].map(e=>e.textContent);
S.ok('문항마다 자리 번호가 붙는다', nums.join(',')==='1,2,3,4', nums.join(','));
S.ok('번호에 설명이 달려 있다',
     /숫자키/.test($('grid').querySelector('.knum').title), $('grid').querySelector('.knum').title);

/* ---- / 로 검색창 ---- */
$('q').blur();
key('/');
S.ok('/ 를 누르면 검색창으로 간다', doc.activeElement===$('q'), doc.activeElement&&doc.activeElement.id);
/* 검색창 안에서는 글자로 들어가야 한다 */
const before=$('q').value;
key('/');
S.ok('검색창 안에서는 / 가 단축키로 안 먹는다', $('q').value===before);
key('Escape');
S.ok('Esc 로 다시 빠져나온다', doc.activeElement!==$('q'));

/* 한글 자판(자판 위치로도) */
$('q').blur();
key('Process',{code:'Slash'});
S.ok('한글 자판에서도 / 가 듣는다', doc.activeElement===$('q'));
key('Escape');

/* ---- ? 로 도움말 ---- */
key('?');
S.ok('? 로 도움말이 열린다', $('modal').classList.contains('open'));
S.ok('도움말은 이제 단축키를 안 담는다', $('mbox').textContent.indexOf('학습모드는 선택/해제')<0);
S.ok('도움말이 단축키 단추를 가리킨다', $('mbox').textContent.indexOf('단축키')>=0);
$('helpOk').click();
S.ok('도움말이 닫힌다', !$('modal').classList.contains('open'));

/* ---- 단축키 창 ---- */
$('keysBtn').click();
S.ok('단축키 창이 열린다', $('modal').classList.contains('open'));
S.ok('넓은 창으로 뜬다', $('mbox').classList.contains('wide'));
['검색창으로 커서','학습모드는 선택/해제','필터 열기·접기','앞·뒤 탭으로 이동',
 '지금 보고 있는 탭 닫기','한글 자판'].forEach(t=>{
  S.ok('단축키 창에 «'+t.slice(0,12)+'» 이 있다', $('mbox').textContent.indexOf(t)>=0);
});
S.ok('키 표시가 그려졌다', $('mbox').querySelectorAll('kbd').length>=12,
     $('mbox').querySelectorAll('kbd').length);
S.ok('Ctrl 과 화살표가 따로 그려진다',
     [...$('mbox').querySelectorAll('kbd')].some(e=>e.textContent==='Ctrl'));
$('keysOk').click();
S.ok('단축키 창이 닫힌다', !$('modal').classList.contains('open'));
key('k');
S.ok('k 로도 열린다', $('modal').classList.contains('open'));
$('keysOk').click();
key('Process',{code:'KeyK'});
S.ok('한글 자판에서도 k 가 듣는다', $('modal').classList.contains('open'));
$('keysOk').click();
/* Shift+/ 로도 */
key('/',{code:'Slash',shiftKey:true});
S.ok('Shift+/ 로도 도움말이 열린다', $('modal').classList.contains('open'));
$('helpOk').click();

/* ---- f 로 필터 ---- */
const opened=$('filters').classList.contains('open');
key('f');
S.ok('f 로 필터가 열린다', $('filters').classList.contains('open')!==opened);
S.ok('단추 글씨도 바뀐다', /필터 접기|필터 열기/.test($('ftoggle').textContent), $('ftoggle').textContent.trim());
key('f');
S.ok('한 번 더 누르면 되돌아온다', $('filters').classList.contains('open')===opened);
key('Process',{code:'KeyF'});
S.ok('한글 자판에서도 f 가 듣는다', $('filters').classList.contains('open')!==opened);
key('Process',{code:'KeyF'});

/* ---- 1~4 로 문항 ---- */
T.setMode('study'); T.render(true);
const list=T.hits().slice(0,4);
key('2');
S.ok('학습모드에서 2 를 누르면 둘째 문항이 골라진다', !!T.SEL()[list[1][2]]);
S.ok('첫째는 안 골라졌다', !T.SEL()[list[0][2]]);
S.ok('카드에 표시가 난다', $('grid').children[1].classList.contains('sel'));
S.ok('체크상자도 켜진다', $('grid').children[1].querySelector('input[type=checkbox]').checked);
key('2');
S.ok('한 번 더 누르면 풀린다', !T.SEL()[list[1][2]]);
S.ok('카드 표시도 사라진다', !$('grid').children[1].classList.contains('sel'));
key('4');
S.ok('4 도 듣는다', !!T.SEL()[list[3][2]]);
key('Process',{code:'Digit1'});
S.ok('한글 자판에서도 숫자키가 듣는다', !!T.SEL()[list[0][2]]);
key('5');
S.ok('5 는 아무 일도 없다', Object.keys(T.SEL()).length===2, Object.keys(T.SEL()).length);

/* 검색모드에서는 복사 */
T.setMode('search'); T.render(true);
let copied=0;
const oldWrite=w.navigator.clipboard;
S.ok('검색모드에서 숫자키가 선택을 바꾸지 않는다', (function(){
  const n=Object.keys(T.SEL()).length; key('3');
  return Object.keys(T.SEL()).length===n;
})());

/* 화면에 문항이 없을 때 눌러도 안 깨진다 */
T.setHits([]); T.render(true);
key('1'); key('4');
S.ok('문항이 없을 때 눌러도 괜찮다', true);

/* ---- 글자를 치는 중에는 단축키가 자야 한다 ----
   관리자 암호나 오류제보를 칠 때 1·2·f·k·? 가 단축키로 먼저 먹혀
   글자가 제대로 안 들어가던 것을 막았는지 본다. */
(function(){
  const punch=(el,s)=>{ el.focus();
    for(const ch of s){ doc.dispatchEvent(new w.KeyboardEvent('keydown',{key:ch,bubbles:true})); el.value+=ch; } };

  S.ok('글자 치는 중인지 가리는 것이 있다', /function typing\(\)/.test(html));
  S.ok('입력칸·여러 줄 칸·고르기 칸을 모두 본다',
       /t==='input'[\s\S]{0,80}t==='textarea'[\s\S]{0,80}t==='select'/.test(html));
  S.ok('Esc 와 Ctrl 조합은 그래도 듣는다', /typing\(\) && e\.key!=='Escape' && !e\.ctrlKey/.test(html));

  /* 오류제보 메모칸 */
  T.setHits(T.IT.slice(0,4)); T.render(true);
  const card=doc.querySelector('.card');
  const rep=[...card.querySelectorAll('button')].find(b=>b.textContent==='오류제보');
  rep.dispatchEvent(new w.MouseEvent('click',{bubbles:true}));
  const memo=$('rpMemo');
  S.ok('오류제보 메모칸이 있다', !!memo);
  if(memo){
    memo.value=''; punch(memo,'12kf?/');
    S.ok('친 글자가 그대로 들어간다', memo.value==='12kf?/', JSON.stringify(memo.value));
    S.ok('제보 창이 딴 데로 안 넘어간다', /오류 제보/.test($('mbox').textContent));
  }
  doc.dispatchEvent(new w.KeyboardEvent('keydown',{key:'Escape',bubbles:true}));

  /* 관리자 암호칸 — 제목을 여러 번 눌러 연다 */
  for(let i=0;i<8;i++) $('title').dispatchEvent(new w.MouseEvent('click',{bubbles:true}));
  const pw=$('pwIn');
  S.ok('관리자 암호칸이 열린다', !!pw);
  if(pw){
    pw.value=''; punch(pw,'1234kf/?');
    S.ok('암호도 친 대로 들어간다', pw.value==='1234kf/?', JSON.stringify(pw.value));
    S.ok('암호 창이 그대로다', /관리자 모드/.test($('mbox').textContent));
  }
  doc.dispatchEvent(new w.KeyboardEvent('keydown',{key:'Escape',bubbles:true}));
})();

S.done();
