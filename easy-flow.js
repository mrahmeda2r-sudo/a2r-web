/* Easy batch flow: صوّر ← راجع القص ← راجع وابعت. Every image stage (crop, filter, tag) stays reachable. */
'use strict';
(() => {
 const B=document.body;
 const mk=(tag,cls,text,attrs={})=>{const e=document.createElement(tag);if(cls)e.className=cls;if(text)e.textContent=text;for(const [k,v] of Object.entries(attrs))e.setAttribute(k,v);return e;};
 const isBatch=()=>mode==='batch';
 const hasPhoto=()=>!!(source&&image);
 const tapPending=()=>!!window.A2RTapCrop?.pending();
 let manualOpen=false,filterOpen=false,prevPend=false,finalKey='',finalToken=0,frame=0;

 /* ---------- Edit screen: preview first, tools behind «تعديل يدوي» ---------- */
 const editScreen=$('editScreen'),editor=$('editor'),cropCard=document.querySelector('#editScreen .tap-crop-card'),paperCard=$('filters').closest('.card'),captureCard=document.querySelector('#editScreen .capture-card');
 paperCard.classList.add('easy-paper');cropCard.classList.add('easy-crop');captureCard.classList.add('easy-capture');
 const paperTitle=paperCard.querySelector('.section-head h2'),paperTitleOrig=paperTitle.textContent;
 const autoNote=mk('p','easy-note','',{id:'easyAutoNote',role:'status','aria-live':'polite'});paperCard.querySelector('.section-head').after(autoNote);
 const filterToggle=mk('button','secondary full easy-toggle','',{id:'easyFilterToggle',type:'button'});paperCard.append(filterToggle);
 const manualToggle=mk('button','secondary full easy-toggle','',{id:'easyManualToggle',type:'button'});cropCard.before(manualToggle);
 const pop=mk('div','easy-pop','',{id:'easyFilterPop',role:'dialog','aria-modal':'true','aria-label':'اختيار الفلتر',hidden:''}),sheet=mk('div','easy-pop-sheet');pop.append(sheet);document.body.append(pop);
 const closePop=()=>{pop.hidden=true;};
 pop.addEventListener('click',e=>{if(e.target===pop)closePop();});document.addEventListener('keydown',e=>{if(e.key==='Escape'&&!pop.hidden)closePop();});
 function openPop(){if(busy)return;sheet.replaceChildren(mk('h3','','اختار الفلتر'));for(const k of ['auto','receipt','thermal','photocopy','original']){const on=choice===k,b=mk('button','secondary easy-pop-opt'+(on?' on':''),LABELS[k]+(on?' ✓':''),{type:'button','data-pick':k});b.onclick=()=>{closePop();const t=document.querySelector('[data-filter="'+k+'"]');if(t&&!busy)t.click();};sheet.append(b);}const x=mk('button','text-button','إلغاء',{type:'button'});x.onclick=closePop;sheet.append(x);pop.hidden=false;}
 filterToggle.onclick=openPop;
 manualToggle.onclick=()=>{if(tapPending())return;manualOpen=!manualOpen;applyEdit();if(manualOpen){drawCrop();cropCard.scrollIntoView({block:'start',behavior:'smooth'});}};
 const LABELS={auto:'تلقائي',receipt:'إيصال',thermal:'حراري باهت',photocopy:'فوتوكوبي',original:'الأصل'};
 function applyEdit(){
  const batch=isBatch(),pend=tapPending();
  B.classList.toggle('easy-batch',batch);
  if(!batch){prevPend=false;paperTitle.textContent=paperTitleOrig;B.classList.remove('easy-manual-open','easy-filter-open','easy-pending');return;}
  if(pend&&!busy&&!window.A2RTapCrop?.isLoading)manualOpen=true;
  if(prevPend&&!pend&&screen==='editScreen')setTimeout(()=>paperCard.scrollIntoView({block:'start',behavior:'smooth'}),60);
  prevPend=pend;
  const open=pend||manualOpen;
  B.classList.toggle('easy-manual-open',open);B.classList.toggle('easy-filter-open',filterOpen);B.classList.toggle('easy-pending',pend);
  paperTitle.textContent='الورقة بعد القص والفلتر';
  const auto=window.A2RTapCrop?.lastAuto;
  autoNote.classList.toggle('warn',pend);
  autoNote.textContent=pend?'مقدرناش نحدد حدود الورقة لوحدنا. اضغط على الأربع زوايا في الصورة تحت.':(auto==='ok'?'✓ اتقصت تلقائي. راجع إن الورقة كلها ظاهرة والأرقام واضحة.':'راجع إن الورقة كلها ظاهرة والأرقام واضحة.');
  manualToggle.hidden=pend;manualToggle.textContent=manualOpen?'إخفاء أدوات القص':'✎ تعديل القص يدوي (زوايا، تدوير، الصورة كلها)';
  const ch=(typeof choice==='string'&&LABELS[choice])||'تلقائي';
  filterToggle.textContent='الفلتر: '+ch+' ‹';
  filterToggle.hidden=pend;
 }
 // Fresh photo: open tools only if auto-crop failed. Restored drafts keep tools folded unless the crop is incomplete.
 for(const id of ['cameraInput','galleryInput'])$(id).addEventListener('change',()=>{if(isBatch()){manualOpen=false;filterOpen=false;tagPos={x:.5,y:1,s:1};}},true);
 const baseDrawCrop=drawCrop;drawCrop=function(...a){const v=baseDrawCrop.apply(this,a);applyEdit();return v;};
 // Manual edits refresh the preview by themselves (no need to press «معاينة التحديد»).
 let autoPrev=null;
 const baseCropChanged=cropChanged;cropChanged=function(...a){const v=baseCropChanged.apply(this,a);clearTimeout(autoPrev);autoPrev=setTimeout(()=>{if(screen==='editScreen'&&!busy&&image&&!tapPending()&&cropPending&&!window.A2RTapCrop?.isLoading&&A2RCore.validQuad(quad))preview();},380);return v;};
 $('cropCanvas').addEventListener('pointerup',()=>{clearTimeout(autoPrev);autoPrev=setTimeout(()=>{if(screen==='editScreen'&&!busy&&image&&!tapPending()&&cropPending&&A2RCore.validQuad(quad))preview();},420);});
 $('cornerInputs').addEventListener('change',()=>{clearTimeout(autoPrev);autoPrev=setTimeout(()=>{if(!busy&&image&&!tapPending()&&cropPending&&A2RCore.validQuad(quad))preview();},300);});

 /* ---------- Batch workspace: big start button, then «راجع وابعت» ---------- */
 const card=$('workspaceCard'),idRow=$('workspaceIdentity');
 const start=mk('section','easy-start','',{id:'easyStart'});
 start.append(mk('div','easy-start-mark','◉',{'aria-hidden':'true'}),mk('h2','','صوّر الباتش'),mk('p','hint','حط الإيصال على سطح غامق وصوّره. هنقصّه ونقرا الأرقام لوحدنا، وانت تراجع قبل الإرسال.'));
 const bigCam=mk('button','primary full easy-big','◉ صوّر الباتش',{id:'easyCamera',type:'button'}),gal=mk('button','secondary full','اختار صورة من المعرض',{id:'easyGallery',type:'button'});
 start.append(bigCam,gal);idRow.after(start);
 bigCam.onclick=()=>{if(!busy)$('cameraInput').click();};gal.onclick=()=>{if(!busy)$('galleryInput').click();};

 const fin=mk('section','easy-final','',{id:'easyFinal'});
 const fh=mk('div','section-head');fh.append(mk('h2','','الصورة اللي هتتبعت'),mk('span','quiet','',{id:'easyFinalInfo'}));
 const wrap=mk('div','easy-final-wrap');const fc=mk('canvas','',null,{id:'easyFinalCanvas','aria-label':'معاينة صورة الباتش النهائية بورقة البيانات'});wrap.append(fc);
 const acts=mk('div','easy-final-actions');
 const bCrop=mk('button','secondary','✎ القص والفلتر',{id:'easyEditCrop',type:'button'}),bTag=mk('button','secondary','مكان الورقة',{id:'easyEditTag',type:'button'}),bRe=mk('button','secondary','صوّر تاني',{id:'easyRetake',type:'button'});
 acts.append(bCrop,bTag,bRe);
 const zoom=mk('a','text-button','افتح الصورة النهائية بالحجم الكامل',{id:'easyZoom',target:'_blank',rel:'noopener'});zoom.hidden=true;
 fin.append(fh,mk('p','hint easy-final-hint','راجع إن ورقة البيانات مش مغطية العدد أو الإجمالي.'),wrap,acts,zoom);
 start.after(fin);
 bCrop.onclick=()=>{if(!busy&&hasPhoto()){manualOpen=false;go('editScreen');}};
 bTag.onclick=()=>{if(!busy&&hasPhoto())go('tagScreen');};
 bRe.onclick=()=>{if(!busy)$('cameraInput').click();};

 let paperKey='';
 async function drawFinal(){
  if(!(isBatch()&&screen==='sendScreen'&&hasPhoto()))return;
  const src=$('resultCanvas');if(src.width<2||cropPending||tapPending())return;
  const key=JSON.stringify([photoKey(snapshot()),$('showTag').checked,$('tagLayout').value,identity(),src.width,src.height,imageVersion]);
  if(key===paperKey)return;paperKey=key;
  try{await drawTag();}catch{paperKey='';}
 }
 /* Paper preview lives on the batch screen: on the image, at the bottom by default (a new photo starts there); it can be moved/resized from the review viewer (review-viewer.js). Receipts mode keeps the separate paper screen. */
 const tagScr=$('tagScreen'),card1=tagScr.children[0],card2=tagScr.children[1];
 for(const id of ['employee','unit'])$(id).closest('label').classList.add('easy-id-hidden');
 const holder=mk('div','easy-paper-merge','',{id:'easyPaperMerge'});fin.after(holder);
 const lockTag=e=>{if(isBatch()&&screen==='sendScreen'&&!B.classList.contains('rv-paper-on')){e.stopImmediatePropagation();e.preventDefault();}};
 for(const t of ['pointerdown','pointermove','pointerup','touchstart'])$('tagCanvas').addEventListener(t,lockTag,true);
 function placePaper(){
  if(isBatch()){
   if(card2.parentNode!==holder)holder.append(card2);
   if(!$('tagDate').value)$('tagDate').value=localDate();
   if(source&&image&&screen==='sendScreen'&&$('tagLayout').value!=='overlay'){$('tagLayout').value='overlay';tagPos={x:.5,y:1,s:1};invalidate();saveDraft();}
  }else if(card2.parentNode!==tagScr)tagScr.insertBefore(card2,$('toReview'));
 }
 $('workspaceIdentityEdit').onclick=()=>{if(!busy)openStartScreen();};
 function applyWorkspace(){
  placePaper();
  const batch=isBatch(),photo=hasPhoto();
  B.classList.toggle('easy-batch',batch);
  B.classList.toggle('easy-empty',batch&&screen==='sendScreen'&&!photo);
  B.classList.toggle('easy-review',batch&&screen==='sendScreen'&&photo);
  if(batch&&screen==='sendScreen'&&photo){
   drawFinal();
   const ready=$('downloadBtn')&&!$('downloadBtn').hidden&&exportUrl;zoom.hidden=!ready;if(ready)zoom.href=exportUrl;
  }
  if(batch&&screen==='editScreen')$('screenTitle').textContent='راجع القص';
  if(batch&&screen==='tagScreen')$('screenTitle').textContent='مكان الورقة والبيانات';
  applyEdit();
 }
 function schedule(){cancelAnimationFrame(frame);frame=requestAnimationFrame(applyWorkspace);}
 const baseGo=go;go=function(...a){let toPaper=false;if(isBatch()&&a[0]==='tagScreen'){if(!hasIdentity()){openStartScreen();return;}a[0]='sendScreen';toPaper=true;}const v=baseGo.apply(this,a);applyWorkspace();if(toPaper)setTimeout(()=>holder.scrollIntoView({block:'start',behavior:'smooth'}),80);return v;};
 const baseSave=saveDraft;saveDraft=function(...a){const v=baseSave.apply(this,a);schedule();return v;};
 const baseInv=invalidate;invalidate=function(...a){const v=baseInv.apply(this,a);schedule();return v;};
 const basePrep=showPrepared;showPrepared=function(...a){const v=basePrep.apply(this,a);schedule();return v;};
 const baseUpd=updateMode;updateMode=function(...a){const v=baseUpd.apply(this,a);schedule();return v;};

 /* ---------- Numbers: OCR highlights what needs a second look ---------- */
 const NUM=[['batchCount','count'],['batchTotal','total']];
 const notes={};
 for(const [id] of NUM){const n=mk('small','easy-ocr-note','',{id:id+'Note'});$(id).after(n);notes[id]=n;}
 function words(data){const out=[];for(const b of data?.blocks||[])for(const p of b.paragraphs||[])for(const l of p.lines||[])for(const w of l.words||[])out.push({t:String(w.text||''),c:Number(w.confidence)});return out;}
 function confFor(kind,val,r){
  if(val===null||val===undefined||val==='')return null;
  if(r.parts>1||r.fallback)return 0;
  const ws=words(window.A2ROcrData);if(!ws.length)return 0;
  const want=kind==='count'?String(Number(val)):String(val).replace(/\D/g,'');
  // Printed more than once (Sale/Total lines) and read clearly at least once, or read very clearly once.
  let best=0,hits=0;
  for(const w of ws){const d=w.t.replace(/\D/g,'');if(!d)continue;
   if(kind==='count'?(d.length<=5&&String(Number(d))===want):d===want){hits++;best=Math.max(best,w.c||0);}}
  return (hits>=2&&best>=75)||best>=90?100:best;
 }
 function mark(id,state,text){const i=$(id);i.classList.remove('ocr-low','ocr-ok','ocr-missing');if(state)i.classList.add(state);notes[id].textContent=text||'';notes[id].className='easy-ocr-note'+(state?' '+state:'');}
 const baseShow=showOcrResult;showOcrResult=function(r,fill=true){
  const v=baseShow.apply(this,[r,fill]);
  if(isBatch()&&fill&&r){
   for(const [id,k] of NUM){
    if(ocrDirty[k==='count'?'count':'total'])continue;
    const val=r[k];
    if(val===null||val===undefined){mark(id,'ocr-missing','مقريناش الرقم ده. اكتبه من الصورة.');continue;}
    const c=confFor(k,val,r);
    if(c!==null&&c>=100)mark(id,'ocr-ok','✓ اتقرا من الصورة. بص عليه بسرعة.');
    else mark(id,'ocr-low',r.parts>1?'مجموع أكتر من ورقة. راجعه من الصورة.':'القراءة مش متأكدة. راجع الرقم ده من الصورة كويس.');
   }
  }
  return v;
 };
 for(const [id,k] of NUM)$(id).addEventListener('input',()=>mark(id,null,''));
 // A new photo clears old highlights.
 for(const id of ['cameraInput','galleryInput'])$(id).addEventListener('change',()=>{if(isBatch())for(const [f] of NUM)mark(f,null,'');},true);
 $('ocrRetry').textContent='اقرا الأرقام تاني';$('ocrRetry').classList.remove('secondary');$('ocrRetry').classList.add('text-button');
 $('ocrStatus').textContent='الأرقام بتتقري لوحدها بعد التصوير. تقدر تكتبها بإيدك في أي وقت.';

 /* ---------- Offline reading: download once by itself on Wi‑Fi ---------- */
 async function ocrCached(){try{const c=await caches.open('a2r-web-ocr-v1');for(const u of OCR_FILES)if(!await c.match(new URL(u,location.href).href))return false;return true;}catch{return true;}}
 let autoOcrBusy=false;
 async function maybeAutoOcr(){
  const n=navigator.connection;
  if(autoOcrBusy||!navigator.onLine||!('caches' in window)||!n||n.saveData||!(n.type==='wifi'||n.type==='ethernet'))return;
  if(await ocrCached())return;
  autoOcrBusy=true;
  try{$('ocrOfflineStatus').textContent='بنجهز القراءة للأوف لاين على الواي فاي…';await $('cacheOcr').onclick();}catch{}finally{autoOcrBusy=false;}
 }
 window.A2REasy={maybeAutoOcr,applyWorkspace};
 stageBReady.then(()=>setTimeout(maybeAutoOcr,5000));
 navigator.connection?.addEventListener?.('change',()=>setTimeout(maybeAutoOcr,2000));
 window.addEventListener('online',()=>setTimeout(maybeAutoOcr,2000));

 applyWorkspace();
})();
