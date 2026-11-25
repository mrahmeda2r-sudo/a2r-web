/* Previous-step button for the batch review screen and the receipts flow. Uses the existing navigation handlers. */
'use strict';
(() => {
 const bar=document.createElement('div');bar.id='stepBack';bar.hidden=true;
 const btn=document.createElement('button');btn.type='button';btn.className='secondary full';bar.append(btn);
 $('workspaceTabs').after(bar);
 let frame=0,act=null;
 const sysBusy=()=>!!window.A2RSystemPhoto?.state()?.busy;
 function target(){
  if(screen==='archiveScreen'||(screen==='startScreen'&&!$('backBtn').hidden)){const dest=mode==='receipt'?'لإيصالات الدفع':'للباتش';return {label:'‹ رجوع '+dest,run:()=>$('backBtn').onclick()};}
  if(mode==='batch'&&screen==='sendScreen'&&source&&image)return {label:'‹ رجوع لتعديل الباتش',run:()=>go('editScreen')};
  if(mode==='batch'&&screen==='editScreen'&&source)return {label:'‹ رجوع لمراجعة الإرسال (يحفظ القص)',run:()=>$('toTag').onclick()};
  if(mode==='receipt'&&screen==='queueResultScreen')return {label:'‹ رجوع لقائمة الإيصالات',run:()=>go('queueScreen')};
  if(mode==='receipt'&&screen==='editScreen')return {label:'‹ رجوع لقائمة الإيصالات',run:()=>$('backBtn').onclick()};
  if(mode==='receipt'&&screen==='tagScreen')return {label:'‹ رجوع لتعديل الإيصال',run:()=>$('backBtn').onclick()};
  return null;
 }
 function apply(){const t=target();act=t;bar.hidden=!t;document.body.classList.toggle('step-back-on',!!t);if(t)btn.textContent=t.label;}
 const schedule=()=>{cancelAnimationFrame(frame);frame=requestAnimationFrame(apply);};
 btn.onclick=()=>{if(busy||sysBusy()||!act)return;act.run();};
 const baseGo=go;go=function(...a){const v=baseGo.apply(this,a);schedule();return v;};
 const baseSave=saveDraft;saveDraft=function(...a){const v=baseSave.apply(this,a);schedule();return v;};
 const baseMode=updateMode;updateMode=function(...a){const v=baseMode.apply(this,a);schedule();return v;};
 for(const id of ['employee','unit']){const el=$(id);if(el){el.readOnly=true;el.title='للتعديل استخدم تغيير الحساب';}}
 stageBReady.then(schedule);schedule();
})();
