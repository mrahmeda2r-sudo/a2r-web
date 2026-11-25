/* App shell: makes the site open and behave like the A2R Android app.
   Top bar (logo, ⚙, ⋯), install button + splash, home status and «ملفاتي», Android back button,
   no pull-to-refresh / accidental zoom, light vibration, screen transitions, offline message.
   Uses the existing handlers only (go, tabs, backBtn, step-back); nothing in the image or export path. */
'use strict';
(() => {
 const VERSION='v23';
 const B=document.body,H=document.documentElement;
 const mk=(tag,cls,text,attrs={})=>{const e=document.createElement(tag);if(cls)e.className=cls;if(text)e.textContent=text;for(const [k,v] of Object.entries(attrs))e.setAttribute(k,v);return e;};
 const standalone=()=>matchMedia('(display-mode: standalone)').matches||matchMedia('(display-mode: fullscreen)').matches||navigator.standalone===true;
 const isIOS=/iphone|ipad|ipod/i.test(navigator.userAgent)||(navigator.platform==='MacIntel'&&navigator.maxTouchPoints>1);
 const buzz=(ms=8)=>{if(navigator.vibrate&&matchMedia('(pointer:coarse)').matches)try{navigator.vibrate(ms);}catch{}};
 B.classList.add('app-shell');if(standalone())B.classList.add('app-installed');

 /* ---------- sheets (bottom sheet like the app) ---------- */
 const sheets=[];
 function sheet(id,titleText){const ov=mk('div','as-sheet','',{id,role:'dialog','aria-modal':'true'});ov.hidden=true;const p=mk('div','as-sheet-panel');const h=mk('div','as-sheet-head');h.append(mk('span','as-grab','',{'aria-hidden':'true'}),mk('h3','',titleText));const body=mk('div','as-sheet-body');p.append(h,body);ov.append(p);B.append(ov);ov.addEventListener('click',e=>{if(e.target===ov)closeSheet(ov);});sheets.push(ov);return {ov,body};}
 function openSheet(ov){for(const o of sheets)if(o!==ov)o.hidden=true;ov.hidden=false;buzz();pushGuard(true);}
 function closeSheet(ov){ov.hidden=true;}
 const openOverlay=()=>sheets.find(o=>!o.hidden)||[$('easyFilterPop'),$('systemReminder')].find(o=>o&&!o.hidden)||null;
 function closeOverlay(o){if(sheets.includes(o))closeSheet(o);else if(o.id==='systemReminder'){const c=$('systemReminderCancel');if(c)c.click();else o.hidden=true;}else o.hidden=true;}
 document.addEventListener('keydown',e=>{if(e.key==='Escape'){const o=openOverlay();if(o&&sheets.includes(o))closeSheet(o);}});

 /* ---------- top bar like the app: ⚙ · logo / title · ⋯ ---------- */
 const top=document.querySelector('header.top'),brand=top.querySelector('.brand'),title=$('screenTitle'),back=$('backBtn');
 const logo=mk('img','as-logo','',{src:'./assets/logo.png',alt:'A2R Ahmed Ramadan',width:'260',height:'148',decoding:'async'});
 brand.prepend(logo);brand.removeAttribute('href');brand.setAttribute('role','img');brand.setAttribute('aria-label','A2R');
 const gear=mk('button','as-icon','',{id:'asSettings',type:'button','aria-label':'الإعدادات'});gear.innerHTML='<svg viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="3.2"/><path d="M19.4 15a1.7 1.7 0 0 0 .3 1.8l.1.1a2 2 0 1 1-2.8 2.8l-.1-.1a1.7 1.7 0 0 0-1.8-.3 1.7 1.7 0 0 0-1 1.5V21a2 2 0 1 1-4 0v-.1a1.7 1.7 0 0 0-1.1-1.5 1.7 1.7 0 0 0-1.8.3l-.1.1a2 2 0 1 1-2.8-2.8l.1-.1a1.7 1.7 0 0 0 .3-1.8 1.7 1.7 0 0 0-1.5-1H3a2 2 0 1 1 0-4h.1a1.7 1.7 0 0 0 1.5-1.1 1.7 1.7 0 0 0-.3-1.8l-.1-.1a2 2 0 1 1 2.8-2.8l.1.1a1.7 1.7 0 0 0 1.8.3H9a1.7 1.7 0 0 0 1-1.5V3a2 2 0 1 1 4 0v.1a1.7 1.7 0 0 0 1 1.5 1.7 1.7 0 0 0 1.8-.3l.1-.1a2 2 0 1 1 2.8 2.8l-.1.1a1.7 1.7 0 0 0-.3 1.8V9a1.7 1.7 0 0 0 1.5 1H21a2 2 0 1 1 0 4h-.1a1.7 1.7 0 0 0-1.5 1z"/></svg>';
 const more=mk('button','as-icon','⋯',{id:'asMore',type:'button','aria-label':'المزيد'});
 const startSide=mk('div','as-side as-start'),endSide=mk('div','as-side as-end');
 back.before(startSide);startSide.append(back,gear);
 const mid=mk('div','as-mid');brand.before(mid);mid.append(brand,title);
 top.append(endSide);endSide.append(more);
 const net=$('network'),sw=$('switchAccountBtn');

 /* ⋯ menu: الأرشيف، سجل الإرسال، تغيير الحساب (+ offline state) */
 const menu=mk('div','as-menu','',{id:'asMenu',role:'menu'});menu.hidden=true;
 const mItem=(text,id,fn)=>{const b=mk('button','as-menu-item',text,{type:'button',role:'menuitem',id});b.onclick=()=>{menu.hidden=true;if(busy)return;buzz();fn();};menu.append(b);return b;};
 mItem('الأرشيف','asMenuArchive',()=>$('workspaceArchive').click());
 mItem('سجل الإرسال','asMenuLog',()=>openLog());
 mItem('تغيير الحساب','asMenuAccount',()=>sw.onclick?sw.onclick():sw.click());
 const netRow=mk('div','as-menu-net');netRow.append(net);menu.append(netRow);sw.classList.add('as-moved');
 B.append(menu);
 more.onclick=e=>{e.stopPropagation();if(menu.hidden){menu.hidden=false;buzz();pushGuard();}else menu.hidden=true;};
 document.addEventListener('click',e=>{if(!menu.hidden&&!menu.contains(e.target)&&e.target!==more)menu.hidden=true;});

 /* ⚙ settings sheet: install, offline reading, version, site notes */
 const set=sheet('asSettingsSheet','الإعدادات');
 const instRow=mk('div','as-row');const instBtn=mk('button','primary full','ثبّت التطبيق على الشاشة الرئيسية',{id:'asInstallSet',type:'button'});instRow.append(instBtn,mk('p','hint','بيفتح زي التطبيق: ملء الشاشة وبأيقونة A2R.'));
 const ocrRow=mk('div','as-row');const ocrBtn=mk('button','secondary full','تجهيز قراءة الأرقام من غير نت',{id:'asOcr',type:'button'});const ocrSt=mk('p','hint','',{id:'asOcrStatus'});ocrRow.append(ocrBtn,ocrSt);
 const notes=document.querySelector('main>section.note');const notesRow=mk('div','as-row as-notes');if(notes)notesRow.append(notes);
 const ver=mk('p','as-version','A2R · '+VERSION,{id:'asVersion'});
 set.body.append(instRow,ocrRow,notesRow,ver);
 gear.onclick=()=>{if(busy)return;ocrSt.textContent=$('ocrOfflineStatus')?.textContent||'';instRow.hidden=standalone();openSheet(set.ov);};
 ocrBtn.onclick=async()=>{if(busy)return;const c=$('cacheOcr');if(!c)return;ocrBtn.disabled=true;try{await c.onclick?.();}catch{}finally{ocrBtn.disabled=false;ocrSt.textContent=$('ocrOfflineStatus')?.textContent||'';}};

 /* سجل الإرسال sheet */
 const logS=sheet('asLogSheet','سجل الإرسال');
 const fmt=t=>{const d=new Date(t),z=n=>String(n).padStart(2,'0');return z(d.getDate())+'-'+z(d.getMonth()+1)+'-'+d.getFullYear()+' · '+z(d.getHours())+':'+z(d.getMinutes());};
 function openLog(){const b=logS.body;b.replaceChildren();const sh=(typeof sentHistory==='object'&&sentHistory)||{};
  const row=(name,h,extra)=>{const r=mk('div','as-log-row');r.append(mk('strong','',name),mk('span',h?'ok':'no',h?'✓ اتأكد إرساله '+fmt(h.at)+(extra||''):'لسه ما اتأكدش إرساله'));b.append(r);};
  row('الباتش',sh.batch);row('إيصالات الدفع',sh.receipts,sh.receipts&&sh.receipts.count?' · '+sh.receipts.count+' صورة':'');
  b.append(mk('p','hint','التأكيد بيتسجل لما تدوس «بعت الملف وراجعت وصوله» بعد المشاركة. الملفات اللي اخترت تحتفظ بيها في الأرشيف.'));
  const a=mk('button','secondary full','افتح الأرشيف',{type:'button'});a.onclick=()=>{closeSheet(logS.ov);$('workspaceArchive').click();};b.append(a);openSheet(logS.ov);}

 /* ---------- install button (Android one tap, iPhone steps) ---------- */
 let deferred=null;
 const ios=sheet('asIosSheet','تثبيت A2R على الآيفون');
 ios.body.innerHTML='<ol class="as-steps"><li>افتح الموقع من <b>Safari</b>.</li><li>دوس زرار المشاركة <span class="as-share" aria-hidden="true">⬆︎</span> اللي تحت.</li><li>اختار <b>«إضافة إلى الشاشة الرئيسية»</b>.</li><li>دوس <b>«إضافة»</b>، وافتح A2R من الأيقونة.</li></ol>';
 const andr=sheet('asAndroidSheet','تثبيت A2R');
 andr.body.innerHTML='<ol class="as-steps"><li>افتح قايمة المتصفح <b>⋮</b> فوق.</li><li>اختار <b>«تثبيت التطبيق»</b> أو <b>«إضافة إلى الشاشة الرئيسية»</b>.</li><li>افتح A2R من الأيقونة اللي ظهرت.</li></ol>';
 async function install(){buzz();if(deferred){const d=deferred;deferred=null;try{await d.prompt();const r=await d.userChoice;if(r&&r.outcome==='accepted')say('اتثبت. افتح A2R من الشاشة الرئيسية');}catch{}refreshInstall();return;}openSheet((isIOS?ios:andr).ov);}
 instBtn.onclick=()=>{closeSheet(set.ov);install();};
 addEventListener('beforeinstallprompt',e=>{e.preventDefault();deferred=e;refreshInstall();});
 addEventListener('appinstalled',()=>{deferred=null;B.classList.add('app-installed');refreshInstall();});

 /* ---------- home like the app: status on tiles, «ملفاتي», install card, version ---------- */
 const chooser=$('appChooser');
 const tileState=(id)=>{const t=$(id);if(!t)return null;let s=t.querySelector('.as-tile-state');if(!s){s=mk('span','as-tile-state');t.append(s);}return s;};
 const instCard=mk('div','as-install','',{id:'asInstallCard'});instCard.hidden=true;
 const instText=mk('div','as-install-text');instText.append(mk('strong','','ثبّت A2R على الشاشة الرئيسية'),mk('small','','يفتح زي التطبيق، ملء الشاشة'));
 const instGo=mk('button','primary','ثبّت',{type:'button',id:'asInstallBtn'}),instLater=mk('button','text-button','مش دلوقتي',{type:'button',id:'asInstallLater'});
 instCard.append(instText,instGo,instLater);
 instGo.onclick=install;instLater.onclick=()=>{try{localStorage.setItem('a2r-install-later',String(Date.now()));}catch{}refreshInstall();};
 const files=mk('section','as-files','',{id:'asFiles'});const filesHead=mk('h2','','ملفاتي');const filesList=mk('div','as-files-list');files.append(filesHead,filesList);
 const homeVer=mk('p','as-home-version','v'+VERSION.replace(/^v/,''),{id:'asHomeVersion'});
 if(chooser){chooser.append(instCard,files,homeVer);}
 function laterActive(){try{const t=Number(localStorage.getItem('a2r-install-later')||0);return Date.now()-t<7*864e5;}catch{return false;}}
 function refreshInstall(){const show=!standalone()&&!laterActive()&&(!!deferred||isIOS);instCard.hidden=!show;}
 const today=t=>t&&new Date(t).toDateString()===new Date().toDateString();
 function fileRow(name,sub,ok,fn){const r=mk('button','as-file','',{type:'button'});const ic=mk('span','as-file-ic',ok?'✓':'•');const tx=mk('span','as-file-text');tx.append(mk('strong','',name),mk('small','',sub));r.append(ic,tx,mk('span','as-file-go','‹'));r.classList.toggle('ok',!!ok);r.onclick=()=>{if(busy)return;buzz();fn();};filesList.append(r);}
 function fillHome(){if(!chooser||chooser.hidden)return;const sh=(typeof sentHistory==='object'&&sentHistory)||{};
  const bs=tileState('ahBatch'),rs=tileState('ahReceipts');const F=window.A2RFresh;const bSent=F?F.sentToday('batch'):today(sh.batch?.at),rSent=F?F.sentToday('receipt'):today(sh.receipts?.at);
  if(bs){bs.textContent=bSent?'✓ تم الإرسال':'لم يُرسل';bs.classList.toggle('ok',bSent);}
  if(rs){rs.textContent=rSent?'✓ تم الإرسال':'لم يُرسل';rs.classList.toggle('ok',rSent);}
  filesList.replaceChildren();
  if(F)F.fill(filesList);else{const hasBatch=typeof source!=='undefined'&&!!source;const n=(typeof receiptItems!=='undefined'&&receiptItems)?receiptItems.length:0;
  if(hasBatch)fileRow('صورة الباتش',sh.batch?'اتأكد إرسالها '+fmt(sh.batch.at):'لسه متبعتتش',!!sh.batch,()=>$('ahBatch').click());
  if(n)fileRow('إيصالات الدفع ('+n+' صورة)',sh.receipts?'اتأكد إرسالها '+fmt(sh.receipts.at):'لسه متبعتتش',!!sh.receipts,()=>$('ahReceipts').click());}
  const na=(typeof archiveItems!=='undefined'&&archiveItems)?archiveItems.length:0;
  if(na)fileRow('الأرشيف ('+na+')','الصور اللي اخترت تحتفظ بيها',false,()=>$('workspaceArchive').click());
  if(!filesList.children.length)filesList.append(mk('p','as-files-empty','مفيش ملفات لسه. ابدأ بالباتش أو إيصالات الدفع.'));
  refreshInstall();}

 /* ---------- sync header with the current screen ---------- */
 let lastScreen=null;
 const topH=()=>H.style.setProperty('--as-top',top.offsetHeight+'px');new ResizeObserver(topH).observe(top);topH();
 function sync(){const onHome=!!chooser&&!chooser.hidden;B.classList.toggle('as-home',onHome||screen==='startScreen'||screen==='homeScreen');
  const backShown=!back.hidden&&getComputedStyle(back).display!=='none';gear.hidden=backShown;
  if(onHome)fillHome();
  const key=onHome?'chooser':screen;if(key!==lastScreen){lastScreen&&animate(onHome?chooser:$(screen));lastScreen=key;zoomPolicy();}}
 function animate(el){if(!el||matchMedia('(prefers-reduced-motion: reduce)').matches)return;el.classList.remove('as-in');void el.offsetWidth;el.classList.add('as-in');setTimeout(()=>el.classList.remove('as-in'),260);}
 let frame=0;const schedule=()=>{cancelAnimationFrame(frame);frame=requestAnimationFrame(sync);};
 const baseGo=go;go=function(...a){const v=baseGo.apply(this,a);schedule();return v;};
 const baseSave=saveDraft;saveDraft=function(...a){const v=baseSave.apply(this,a);schedule();return v;};
 new MutationObserver(schedule).observe(B,{attributes:true,attributeFilter:['class']});
 if(chooser)new MutationObserver(schedule).observe(chooser,{attributes:true,attributeFilter:['hidden']});

 /* ---------- no accidental page zoom; the crop step keeps its own zoom ---------- */
 const vp=document.querySelector('meta[name=viewport]'),vpBase='width=device-width, initial-scale=1, viewport-fit=cover';
 function zoomPolicy(){const allow=screen==='editScreen';const want=allow?vpBase:vpBase+', maximum-scale=1, user-scalable=no';if(vp&&vp.content!==want)vp.content=want;}

 /* ---------- Android back button: close sheet → previous screen → exit from home ---------- */
 /* Chrome skips history entries added without a tap, so the guard entry is (re)added on the next touch too */
 let guard=false,guardTap=false;
 function pushGuard(tap=false){if(!guard||(tap&&!guardTap)){try{history.pushState({a2r:1},'');guard=true;guardTap=tap;}catch{}}}
 function backAction(){
  if(!menu.hidden){menu.hidden=true;return true;}
  const o=openOverlay();if(o){closeOverlay(o);return true;}
  if(busy||window.A2RSystemPhoto?.state()?.busy)return true;
  if(B.classList.contains('rv-paper-on')){window.A2RReviewViewer?.setPaper(false);return true;}
  const onHome=!!chooser&&!chooser.hidden;if(onHome)return false;
  const ht=$('ahHomeTab'),goHome=()=>{if(ht&&hasStartIdentity()){ht.click();return true;}return false;};
  /* batch crop screen: save the crop exactly like «رجوع لمراجعة الإرسال (يحفظ القص)», then go home (like leaving the app's crop screen) — avoids a review ↔ crop loop */
  if(mode==='batch'&&screen==='editScreen'&&source){Promise.resolve($('toTag').onclick()).then(()=>{if(screen==='sendScreen')goHome();}).catch(()=>{});return true;}
  const sb=$('stepBack');if(sb&&!sb.hidden){const b=sb.querySelector('button');if(b){b.click();return true;}}
  if(!back.hidden&&back.onclick){back.onclick();return true;}
  if(screen==='startScreen'&&!hasStartIdentity())return false;
  return goHome();}
 addEventListener('popstate',()=>{guard=false;guardTap=false;const handled=backAction();if(handled){buzz(6);pushGuard();}else{/* on home: leave like the app */history.back();}});
 stageBReady.then(()=>{pushGuard();schedule();});
 document.addEventListener('pointerdown',()=>pushGuard(true),{capture:true,passive:true});

 /* ---------- light vibration on main actions (Android only) ---------- */
 document.addEventListener('click',e=>{const t=e.target.closest('button.primary,.ah-tile,.workspace-tab,.as-file,#easyCamera');if(t&&!t.disabled)buzz();},true);

 /* ---------- offline message like the app ---------- */
 addEventListener('offline',()=>say('مفيش نت. تقدر تكمل وتجهز، والإرسال لما النت يرجع',true));
 addEventListener('online',()=>say('النت رجع'));

 /* ---------- splash: logo while the app starts (once per launch) ---------- */
 const splash=$('appSplash');
 if(splash){const t0=performance.now();let shown=true;try{shown=!sessionStorage.getItem('a2r-splash');sessionStorage.setItem('a2r-splash','1');}catch{}
  const hide=()=>{splash.classList.add('gone');setTimeout(()=>splash.remove(),400);};
  if(!shown)splash.remove();else stageBReady.then(()=>setTimeout(hide,Math.max(0,650-(performance.now()-t0)))).catch(hide);
  setTimeout(()=>{if(splash.isConnected)hide();},3500);}

 window.A2RShell={version:VERSION,install,backAction,sync};
 refreshInstall();schedule();
})();
