/* Quick mode: fewer steps and the A2R app's alerts.
   - A new batch photo that was cropped automatically goes straight to the review screen (no crop screen).
     If auto-crop is not sure, the crop screen still opens (tap the 4 corners) exactly as before.
   - Alerts use the app's wording and the app's rules; they never block sending, they only ask «متابعة برضه».
   - No terminal / machine-number alerts. Image crop, filter, tag, OCR and share code are untouched. */
'use strict';
(() => {
 const B=document.body;
 const mk=(tag,cls,text)=>{const e=document.createElement(tag);if(cls)e.className=cls;if(text)e.textContent=text;return e;};
 const isBatch=()=>mode==='batch';
 const tapPending=()=>!!window.A2RTapCrop?.pending();
 let fresh=false,freshAt=0,quality={msg:null,key:''},banner=null,bannerT=null;

 /* ---------- 1. New photo: skip the crop screen when auto-crop worked ---------- */
 for(const id of ['cameraInput','galleryInput'])$(id).addEventListener('change',()=>{if(isBatch()){fresh=true;freshAt=Date.now();quality={msg:null,key:''};}},true);
 setInterval(()=>{
  if(!fresh)return;
  if(Date.now()-freshAt>90000||!isBatch()){fresh=false;return;}
  if(screen!=='editScreen'||busy||loadingDraft||!source||!image||cropPending)return;
  if(tapPending()){if(!window.A2RTapCrop?.isLoading&&window.A2RTapCrop?.lastAuto!=='ok')fresh=false;return;}
  if(window.A2RTapCrop?.isLoading||$('resultCanvas').width<2)return;
  if(window.A2RTapCrop?.lastAuto!=='ok'){fresh=false;return;}
  fresh=false;
  Promise.resolve($('toTag').onclick()).catch(()=>{});
 },350);

 /* ---------- 2. Photo quality check (same rules as the app's qualityVerdict) ---------- */
 function qualityJob(px,w,h){
  const lum=new Float32Array(w*h),hist=new Array(256).fill(0);
  for(let i=0;i<w*h;i++){const l=(px[i*4]*54+px[i*4+1]*183+px[i*4+2]*19)>>8;lum[i]=l;hist[l]++;}
  let acc=0,p90=255;for(let t=0;t<256;t++){acc+=hist[t];if(acc>=w*h*0.9){p90=t;break;}}
  const x0=Math.floor(w*.15),y0=Math.floor(h*.15),x1=Math.floor(w*.85),y1=Math.floor(h*.85),tile=48,ratios=[];let ex=0,ey=0;
  for(let ty=y0;ty+tile<=y1;ty+=tile)for(let tx=x0;tx+tile<=x1;tx+=tile){
   let s=0,s2=0;for(let y=ty;y<ty+tile;y++)for(let x=tx;x<tx+tile;x++){const v=lum[y*w+x];s+=v;s2+=v*v;}
   const n=tile*tile,sd=Math.sqrt(Math.max(0,s2/n-(s/n)*(s/n)));if(sd<14)continue;
   let dx2=0,dy2=0,dxx2=0,dyy2=0,ndx=0,ndy=0,ndxx=0,ndyy=0;
   for(let y=ty;y<ty+tile;y++){const r=y*w;for(let x=tx;x<tx+tile;x++){const c=lum[r+x];
    if(x+1<tx+tile){const d=lum[r+x+1]-c;dx2+=d*d;ndx++;}
    if(y+1<ty+tile){const d=lum[r+w+x]-c;dy2+=d*d;ndy++;}
    if(x>tx&&x+1<tx+tile){const d=2*c-lum[r+x-1]-lum[r+x+1];dxx2+=d*d;ndxx++;}
    if(y>ty&&y+1<ty+tile){const d=2*c-lum[r-w+x]-lum[r+w+x];dyy2+=d*d;ndyy++;}}}
   const mdx=dx2/ndx,mdy=dy2/ndy;ex+=mdx;ey+=mdy;
   ratios.push(Math.min((dxx2/ndxx)/Math.max(1e-6,mdx),(dyy2/ndyy)/Math.max(1e-6,mdy)));
  }
  let sharp=null,aniso=null;
  if(ratios.length>=4){ratios.sort((a,b)=>a-b);sharp=ratios[Math.floor(ratios.length*.75)];aniso=Math.min(ex,ey)/Math.max(1e-6,Math.max(ex,ey));}
  const rh=new Array(256).fill(0);let rn=0,sat=0;
  for(let y=y0;y<y1;y++)for(let x=x0;x<x1;x++){const v=lum[y*w+x]|0;rh[v]++;rn++;if(v>=250)sat++;}
  let p75=255;acc=0;for(let t=0;t<256;t++){acc+=rh[t];if(acc>=rn*.75){p75=t;break;}}
  return {p90,sharp,aniso,sat:rn?sat/rn:0,p75};
 }
 function verdict(r){
  if(r.p90<130)return 'الإضاءة ضعيفة، صوّر في مكان أنور';
  if(r.sharp!==null&&r.sharp<0.42)return 'الصورة مش حادة (مهزوزة أو الفوكس مش مظبوط). ثبّت إيدك واضغط على الورقة للفوكس وصوّر تاني';
  if(r.aniso!==null&&r.aniso<0.26)return 'الصورة مهزوزة (الإيد اتحركت وقت التصوير). ثبّت الموبايل وصوّر تاني';
  if(r.sat>=0.01&&r.sat<0.6&&r.p75<240)return 'في لمعة على الورقة ممكن تمسح أرقام. ميّل الموبايل شوية أو اطفي الكشاف وصوّر تاني';
  return null;
 }
 function checkImage(img){
  try{
   const sw=img.naturalWidth||img.width,sh=img.naturalHeight||img.height;if(!sw||!sh)return null;
   const k=sw>1200?1200/sw:1,w=Math.max(16,Math.round(sw*k)),h=Math.max(16,Math.round(sh*k));
   const c=document.createElement('canvas');c.width=w;c.height=h;const x=c.getContext('2d',{willReadFrequently:true});x.drawImage(img,0,0,w,h);
   const px=x.getImageData(0,0,w,h).data;c.width=c.height=1;
   return verdict(qualityJob(px,w,h));
  }catch{return null;}
 }
 function showBanner(msg){
  if(!banner){banner=mk('div','q-banner');banner.setAttribute('role','alert');banner.onclick=()=>{banner.hidden=true;};document.body.append(banner);}
  banner.textContent='⚠ '+msg;banner.hidden=false;clearTimeout(bannerT);bannerT=setTimeout(()=>{banner.hidden=true;},9000);
 }
 const baseLoad=loadSource;
 loadSource=async function(file,draft=null){
  const v=await baseLoad.apply(this,arguments);
  if(isBatch()&&!draft&&!loadingDraft&&image){
   const key=imageVersion+':'+(file&&file.size);
   setTimeout(()=>{const m=checkImage(image);quality={msg:m,key};if(m)showBanner(m);},60);
  }
  return v;
 };

 /* ---------- 3. Alerts: app wording, no terminal alerts ---------- */
 const SHEET=[
  [/SUMMARY REPORT/i,'الورقة دي SUMMARY REPORT (سمري) ومش إغلاق باتش صحيح!'],
  [/REPRINT/i,'الورقة مكتوب عليها REPRINT (إعادة طباعة) وليست إغلاق باتش أصلي!'],
  [/BATCH CLOSED/i,'لم يتم العثور على جملة "BATCH CLOSED SUCCESSFULLY" — اتأكد إن الورقة إغلاق باتش صحيح'],
  [/تاريخ الباتش/,'تاريخ الباتش في الصورة مختلف عن تاريخ النهارده']
 ];
 let sheetAlerts=[];
 const baseSet=setWarnings;
 setWarnings=function(items){
  const out=[];sheetAlerts=[];
  for(const x of items||[]){
   const t=String(x);
   if(/رقم الماكينة|الترمنل|TID/i.test(t))continue; // no terminal alerts in the web
   let hit=null;for(const [re,txt] of SHEET)if(re.test(t)){hit=txt;break;}
   if(hit){out.push(hit);sheetAlerts.push(hit);continue;}
   if(/ورقة البيانات مخفية/.test(t)){out.push('ورقة البيانات (الاسم والوحدة) مخفية في صورة الباتش');continue;}
   if(/سبق تأكيد إرسال باتش/.test(t)){out.push('الباتش اتبعت النهارده قبل كده. لو بتبعت نسخة معدّلة تمام، غير كده اتأكد إنه مش مكرر');continue;}
   out.push(t);
  }
  baseSet.call(this,out);
  const el=$('ocrWarnings');el.classList.add('q-alerts');el.classList.remove('q-open');
  el.querySelectorAll('div').forEach(d=>{d.textContent=d.textContent.replace(/^⚠\s*/,'');});
  if(out.length>1){const c=mk('button','q-more','▾ '+out.length);c.type='button';c.onclick=()=>el.classList.toggle('q-open');el.append(c);}
  if(out.length&&navigator.vibrate)try{navigator.vibrate(60);}catch{}
 };
 if(typeof ocrResult==='object'&&ocrResult){try{showOcrResult(ocrResult,false);}catch{}}

 /* ---------- 4. Dialogs before sending (like the app's confirmWarnings) ---------- */
 let dlg=null;
 function confirmWarnings(list,title,go){
  if(!list.length)return Promise.resolve(true);
  return new Promise(res=>{
   if(!dlg){dlg=mk('div','q-dim');document.body.append(dlg);}
   dlg.replaceChildren();dlg.hidden=false;
   const box=mk('div','q-dlg');box.setAttribute('role','alertdialog');box.setAttribute('aria-modal','true');
   const h=mk('h3');h.append(mk('span','q-warn','⚠'),mk('span','',title));
   const ul=mk('ul');for(const w of list)ul.append(mk('li','',w));
   const acts=mk('div','q-acts'),ok=mk('button','q-go',go),back=mk('button','q-back','رجوع');ok.type=back.type='button';
   const done=v=>{dlg.hidden=true;res(v);};ok.onclick=()=>done(true);back.onclick=()=>done(false);
   dlg.onclick=e=>{if(e.target===dlg)done(false);};
   acts.append(ok,back);box.append(h,ul,acts);dlg.append(box);back.focus();
  });
 }
 let passed=false;
 const baseShare=$('shareBtn').onclick;
 $('shareBtn').onclick=async function(...a){
  if(passed||!isBatch()||busy||!window.A2RSystemPhoto?.state?.().added)return baseShare.apply(this,a);
  const pre=[];
  if(quality.msg)pre.push('صورة الباتش: '+quality.msg);
  if(!$('showTag').checked)pre.push('ورقة البيانات (الاسم والوحدة) مخفية في صورة الباتش');
  try{if(sentHistory.batch&&new Date(sentHistory.batch.at).toDateString()===new Date().toDateString())pre.push('الباتش اتبعت النهارده قبل كده. لو بتبعت نسخة معدّلة تمام، غير كده اتأكد إنه مش مكرر');}catch{}
  if(sheetAlerts.length&&!await confirmWarnings(sheetAlerts,'تنبيه في ورقة الباتش','متابعة برضه'))return;
  const rest=pre.filter(x=>!sheetAlerts.includes(x));
  if(rest.length&&!await confirmWarnings(rest,'راجع قبل الإرسال','ابعت برضه'))return;
  passed=true;try{return baseShare.apply(this,a);}finally{setTimeout(()=>{passed=false;},400);}
 };

 /* ---------- 5. Receipts: same pre-send check (quality per receipt, no tag, sent today) ---------- */
 async function receiptWarnings(){
  const w=[],blur=new Map(),hidden=[];
  for(let i=0;i<receiptItems.length;i++){
   const it=receiptItems[i];
   try{const src=it.source||it.file||it.blob;if(src){const bmp=await createImageBitmap(src);const m=checkImage(bmp);if(bmp.close)bmp.close();if(m){if(!blur.has(m))blur.set(m,[]);blur.get(m).push(i+1);}}}catch{}
   if(it.showTag===false)hidden.push(i+1);
  }
  blur.forEach((n,m)=>w.push('إيصال رقم '+n.join('، ')+': '+m));
  if(hidden.length)w.push('إيصال رقم '+hidden.join('، ')+': من غير ورقة البيانات (الاسم والوحدة)');
  try{if(sentHistory.receipts&&new Date(sentHistory.receipts.at).toDateString()===new Date().toDateString())w.push('إيصالات الدفع اتبعتت النهارده قبل كده. لو بتبعت نسخة معدّلة تمام، غير كده اتأكد إنها مش مكررة');}catch{}
  return w;
 }
 for(const id of ['queueSharePdf','queueSharePhotos']){
  const el=$(id),base=el.onclick;let ok=false;
  el.onclick=async function(...a){
   if(ok)return base.apply(this,a);
   setBusy?.(true,'بنراجع الإيصالات…');let w=[];try{w=await receiptWarnings();}catch{}finally{setBusy?.(false);}
   if(!await confirmWarnings(w,'راجع قبل الإرسال','ابعت برضه'))return;
   ok=true;try{return base.apply(this,a);}finally{setTimeout(()=>{ok=false;},400);}
  };
 }
})();
