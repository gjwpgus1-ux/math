const {boot,wait,scorer}=require('./harness');
const H=boot(); const {w,doc,$,click,key,btn,html}=H;
const {ok,done}=scorer();
/* jsPDF·html2canvas 를 흉내 낸다 (jsdom 은 캔버스를 못 그린다) */
const CALLS={shots:[], pages:0, saved:null, imgs:[]};
w.html2canvas=(el,opt)=>{ CALLS.shots.push({cls:el.className, scale:opt&&opt.scale, bg:opt&&opt.backgroundColor});
  return Promise.resolve({toDataURL:()=>'data:image/jpeg;base64,ZZZ'}); };
w.jspdf={ jsPDF: function(o){ CALLS.opt=o; CALLS.pages=1;
  this.addPage=()=>{CALLS.pages++;};
  this.addImage=(d,f,x,y,ww,hh)=>{CALLS.imgs.push([f,x,y,ww,hh]);};
  this.save=(n)=>{CALLS.saved=n;}; } };
(async()=>{
  await wait(180);
  key('1'); key('Enter'); await wait(140);

  console.log('\n[1] 단추를 누르면 물어본다');
  click($('modeStudy')); await wait(90);
  $('q').value='25 고3 3월 공통 1~6'; $('q').dispatchEvent(new w.Event('input')); await wait(340);
  click($('selAll')); await wait(120);
  ok('6문항 선택', $('selCnt').textContent==='선택 6개', $('selCnt').textContent);
  const before=w.__printed||0;
  click($('printWork')); await wait(80);
  ok('바로 인쇄되지 않음', (w.__printed||0)===before);
  ok('물어보는 창이 뜸', $('modal').classList.contains('open'));
  ok('제목에 «학습지»', /학습지 내보내기/.test($('mbox').textContent), $('mbox').textContent.slice(0,20));
  ok('고른 수 안내', /6문항/.test($('mbox').textContent));
  ok('PDF 단추', !!$('outPdf') && /PDF 파일로 저장/.test($('outPdf').textContent), $('outPdf').textContent);
  ok('인쇄 단추', !!$('outPrint') && $('outPrint').textContent==='바로 인쇄');
  ok('취소 단추', !!$('outCancel'));
  ok('PDF 단추가 켜져 있음', !$('outPdf').disabled);

  console.log('\n[2] 취소');
  click($('outCancel')); await wait(50);
  ok('닫힘', !$('modal').classList.contains('open'));
  ok('아무것도 안 함', (w.__printed||0)===before);

  console.log('\n[3] 바로 인쇄');
  click($('printWork')); await wait(80);
  click($('outPrint')); await wait(500);
  ok('인쇄창 열림', (w.__printed||0)>before);
  ok('6장 만들어짐 아님(학습지는 묶임)', doc.querySelectorAll('.sheet').length>0,
     doc.querySelectorAll('.sheet').length+'장');

  console.log('\n[4] PDF로 저장');
  CALLS.shots=[]; CALLS.imgs=[]; CALLS.pages=0; CALLS.saved=null;
  const p0=w.__printed||0;
  click($('printWork')); await wait(80);
  click($('outPdf')); await wait(1200);
  ok('인쇄창은 안 뜸', (w.__printed||0)===p0);
  ok('장마다 그림으로 떴음', CALLS.shots.length>0, CALLS.shots.length+'장');
  ok('.sheet 를 찍음', CALLS.shots.every(s=>/sheet/.test(s.cls)));
  ok('선명하게 (scale 2)', CALLS.shots.every(s=>s.scale===2));
  ok('바탕 흰색', CALLS.shots.every(s=>s.bg==='#ffffff'));
  ok('A4 세로', CALLS.opt && CALLS.opt.format==='a4' && CALLS.opt.orientation==='portrait' && CALLS.opt.unit==='mm',
     JSON.stringify(CALLS.opt));
  ok('쪽수가 장수와 같음', CALLS.pages===CALLS.shots.length, CALLS.pages+' vs '+CALLS.shots.length);
  ok('여백 10mm · 190×277 로 얹음',
     CALLS.imgs.every(a=>a[1]===10&&a[2]===10&&a[3]===190&&a[4]===277), JSON.stringify(CALLS.imgs[0]));
  ok('파일로 저장됨', !!CALLS.saved, CALLS.saved);
  ok('파일 이름에 학습지와 날짜', /^학습지_\d{8}_\d{4}\.pdf$/.test(CALLS.saved||''), CALLS.saved);
  ok('찍은 뒤 다시 숨김', !$('printArea').classList.contains('shoot'));

  console.log('\n[5] 오답노트도 같은 흐름');
  CALLS.shots=[]; CALLS.saved=null; CALLS.pages=0;
  click($('printNote')); await wait(80);
  ok('물어봄', $('modal').classList.contains('open') && /오답노트 내보내기/.test($('mbox').textContent));
  click($('outPdf')); await wait(1500);
  ok('6장 (한 장에 한 문항)', CALLS.shots.length===6, CALLS.shots.length);
  ok('파일 이름에 오답노트', /^오답노트_\d{8}_\d{4}\.pdf$/.test(CALLS.saved||''), CALLS.saved);

  console.log('\n[6] 라이브러리가 없으면');
  delete w.jspdf;
  click($('printWork')); await wait(80);
  ok('PDF 단추가 잠김', $('outPdf').disabled);
  ok('«준비 안 됨» 표시', /준비 안 됨/.test($('outPdf').textContent), $('outPdf').textContent);
  const p1=w.__printed||0;
  click($('outPrint')); await wait(500);
  ok('인쇄는 그대로 됨', (w.__printed||0)>p1);

  console.log('\n[7] 라이브러리 파일이 실려 있나');
  ok('jspdf 불러옴', /src="lib\/jspdf\.umd\.min\.js"/.test(html));
  ok('html2canvas 불러옴', /src="lib\/html2canvas\.min\.js"/.test(html));
  ok('인쇄할 때 화면은 숨김', /#printArea\.shoot\{display:block;position:fixed;left:-99999px/.test(html));
  done();
})();
