/* App-style home chooser (two tiles), like the A2R Android home screen. Uses the existing mode switches. */
'use strict';
(() => {
 const home=document.createElement('section');home.id='appChooser';home.hidden=true;
 home.innerHTML='<div class="ah-card"><div class="ah-row"><span class="ah-ic"><svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="8" r="4"/><path d="M4 21c0-4.4 3.6-7 8-7s8 2.6 8 7"/></svg></span><strong id="ahName"></strong></div><div class="ah-row"><span class="ah-ic"><svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M12 21s7-6.2 7-11.5A7 7 0 0 0 5 9.5C5 14.8 12 21 12 21z"/><circle cx="12" cy="9.5" r="2.5"/></svg></span><span id="ahUnit"></span></div><div class="ah-row ah-date"><span class="ah-ic"><svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><rect x="3.5" y="5" width="17" height="15.5" rx="2.5"/><path d="M3.5 10h17M8 3v4M16 3v4"/></svg></span><b id="ahDate" dir="ltr"></b><small>تاريخ التليفون، اتأكد إنه صح</small></div></div>'+
  '<div class="ah-tiles"><button type="button" class="ah-tile" id="ahBatch"><span class="ah-box"><svg viewBox="0 0 24 24" width="28" height="28" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M6 3h12v18l-3-2-3 2-3-2-3 2z"/><path d="M9 8h6M9 12h6"/></svg></span><strong>الباتش</strong></button><button type="button" class="ah-tile" id="ahReceipts"><span class="ah-box"><svg viewBox="0 0 24 24" width="28" height="28" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><rect x="2.5" y="5" width="19" height="14" rx="3"/><path d="M2.5 10h19M6.5 15h4"/></svg></span><strong>إيصالات الدفع</strong></button></div>';
 $('workspaceTabs').before(home);
 const homeTab=document.createElement('button');homeTab.type='button';homeTab.className='workspace-tab';homeTab.id='ahHomeTab';homeTab.textContent='الرئيسية';
 $('workspaceTabs').prepend(homeTab);
 let on=false;
 function fill(){$('ahName').textContent=$('employee').value.trim();$('ahUnit').textContent=$('unit').value.trim();const d=new Date(),z=n=>String(n).padStart(2,'0');$('ahDate').textContent=d.getFullYear()+'-'+z(d.getMonth()+1)+'-'+z(d.getDate());}
 function show(){if(!hasStartIdentity())return;on=true;fill();home.hidden=false;document.body.classList.add('app-chooser');window.scrollTo(0,0);}
 function hide(){on=false;home.hidden=true;document.body.classList.remove('app-chooser');}
 homeTab.onclick=()=>{if(busy)return;show();};
 $('ahBatch').onclick=()=>{hide();$('batchMode').click();};
 $('ahReceipts').onclick=()=>{hide();$('receiptMode').click();};
 $('startBtn').addEventListener('click',()=>{setTimeout(()=>{if(screen!=='startScreen')show();},0);});
 const baseGo=go;go=function(...a){if(a[0]==='startScreen')hide();return baseGo.apply(this,a);};
 function addToggle(tries=0){const m=$('easyPaperMerge');if(!m){if(tries<40)setTimeout(()=>addToggle(tries+1),250);return;}const t=document.createElement('button');t.type='button';t.id='ahPreviewToggle';t.className='secondary full';const lab=()=>{t.textContent=(m.classList.contains('ah-open')?'▴ ':'▾ ')+'معاينة الباتش وورقة البيانات';};lab();t.onclick=()=>{m.classList.toggle('ah-open');lab();};m.before(t);}
 addToggle();
 stageBReady.then(()=>setTimeout(()=>{if(screen!=='startScreen')show();},50));
})();
