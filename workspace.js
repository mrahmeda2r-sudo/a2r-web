/* A single batch workspace. Image processing stays in the existing local pipeline. */
'use strict';
(() => {
 let exportKey='',wantedKey='',errorKey='',errorText='',timer=null,job=null,generation=0,thumbKey='',captionKey='',captureOptions=false,initialized=false;
 const metrics={exports:0,discarded:0,failures:0};
 const systemState=()=>window.A2RSystemPhoto?.state()||{busy:false,loading:false,added:false};
 const active=()=>mode==='batch'&&screen==='sendScreen';
 function imageKey(){if(!source||!image)return '';return JSON.stringify([photoKey(snapshot()),imageVersion,identity(),$('quality').value,$('showTag').checked,$('tagLayout').value,tagPos]);}
 function identityReady(){return !!($('employee').value.trim()&&$('unit').value.trim()&&$('tagDate').value);}
 function validNumbers(){return A2RBatch.integer($('batchCount').value)!==null&&A2RBatch.integer($('batchPiasters').value,true)!==null&&A2RBatch.integer($('batchCollected').value,true)!==null&&A2RBatch.cents($('batchTotal').value)!==null;}
 function checkSystemTotal(){
  const raw=$('systemTotal').value.trim(),err=$('systemTotalError');
  $('systemTotal').removeAttribute('aria-invalid');err.hidden=true;err.textContent='';
  if(!raw)return;
  const st=A2RBatch.cents($('systemTotal').value);
  if(st===null){$('systemTotal').setAttribute('aria-invalid','true');err.hidden=false;err.textContent='إجمالي السيستم مش رقم مظبوط. اكتبه زي 1234.56 أو سيب الخانة فاضية.';return;}
  const bt=A2RBatch.cents($('batchTotal').value);
  if(bt!==null&&st!==bt){$('systemTotal').setAttribute('aria-invalid','true');err.hidden=false;err.textContent='إجمالي السيستم ('+A2RBatch.money(st)+' جنيه) مش مطابق لإجمالي الباتش ('+A2RBatch.money(bt)+' جنيه). راجعهم قبل الإرسال.';}
 }
 function updateCaption(){
  const key=JSON.stringify([identity(),BATCH_FIELDS.map(id=>$(id).value)]);
  checkSystemTotal();
  if(captionKey===key)return;
  captionKey=key;window.A2RSystemPhoto?.clearConfirmation();
  const bad=[['batchCount',A2RBatch.integer($('batchCount').value)===null&&$('batchCount').value.trim()!==''],['batchTotal',A2RBatch.cents($('batchTotal').value)===null&&$('batchTotal').value.trim()!==''],['batchPiasters',A2RBatch.integer($('batchPiasters').value,true)===null],['batchCollected',A2RBatch.integer($('batchCollected').value,true)===null]];bad.forEach(([id,b])=>{if(b)$(id).setAttribute('aria-invalid','true');else $(id).removeAttribute('aria-invalid');});const badAny=bad.some(x=>x[1]);$('numbersError').hidden=!badAny;$('numbersError').textContent=badAny?'في خانة فيها رقم مش مظبوط (معلّمة بالأحمر). العدد والقروش والمجمعة أرقام صحيحة موجبة بس، والإجمالي رقم زي 1234.56. الوصف هيظهر لما تتظبط.':'';if(!validNumbers()){$('caption').value='';return;}
  const i={count:A2RBatch.integer($('batchCount').value),piasters:A2RBatch.integer($('batchPiasters').value,true),collected:A2RBatch.integer($('batchCollected').value,true),total:A2RBatch.money(A2RBatch.cents($('batchTotal').value))};
  $('caption').value=makeCaption(i);$('reviewSummary').textContent=i.count+' معاملة · '+i.total+' جنيه';
 }
 function canSend(){const s=systemState();return active()&&!busy&&!loadingDraft&&!pendingRestore&&!stageBInitializing&&!job&&!s.busy&&!s.loading&&identityReady()&&validNumbers()&&!cropPending&&!window.A2RTapCrop?.pending()&&!!exportFile&&exportFile.type==='image/jpeg'&&exportKey===imageKey();}
 function invalidateExport(){generation++;exportKey='';wantedKey='';errorKey='';errorText='';clearTimeout(timer);timer=null;}
 function schedule(force=false){
  if(!active()||busy||loadingDraft||pendingRestore||stageBInitializing||!source||!image||cropPending||window.A2RTapCrop?.pending()||!identityReady())return;
  const key=imageKey();if(exportFile&&exportKey===key)return;if(!force&&errorKey===key)return;
  if(force){errorKey='';errorText='';}wantedKey=key;
  if(job)return;
  clearTimeout(timer);timer=setTimeout(()=>{timer=null;startExport();},450);
 }
 async function startExport(){
  if(job||!active()||busy||loadingDraft||pendingRestore||!source||!identityReady()||cropPending||window.A2RTapCrop?.pending())return;
  const key=imageKey(),token=generation;
  if(exportFile&&exportKey===key)return;
  let resolveJob;job=new Promise(r=>{resolveJob=r;});refresh(false);
  let c=null,p=null;
  try{
   const limit=Number($('quality').value);
   if(!limit&&image.naturalWidth*image.naturalHeight>24000000)throw Error('الصورة أكبر من 24 ميجابكسل. اختار 4096 أو 2400 من خيارات الصورة');
   const r=await render(limit);c=r.c;
   if(token!==generation||key!==imageKey()||!active()){metrics.discarded++;return;}
   p=await composePreview(c,{receipt:false});
   const blob=await blobOf(p);
   if(token!==generation||key!==imageKey()||!active()){metrics.discarded++;return;}
   const name=$('unitNumber').value?safeName($('unitNumber').value)+'.jpg':'A2R_batch_'+stamp()+'.jpg';
   const file=new File([blob],name,{type:'image/jpeg'});
   exportKey=key;metrics.exports++;showPrepared(file,'صورة الباتش جاهزة',c.width+' × '+c.height+' px للصورة');
   $('finalImage').src=exportUrl;$('finalImage').hidden=false;$('finalCanvas').hidden=true;
  }catch(e){if(token===generation&&key===imageKey()){errorKey=key;errorText=e.message||'تجهيز الصورة ما اكتملش. جرّب تاني أو اختار دقة أقل';metrics.failures++;}}
  finally{for(const x of [c,p])if(x)x.width=x.height=1;job=null;resolveJob();refresh(false);if(wantedKey&&wantedKey!==key)schedule();}
 }
 function refresh(allowSchedule=true){
  if(!initialized)return;
  const on=active(),s=systemState(),photo=!!(source&&image);
  document.body.classList.add('simple-workspace');document.body.dataset.workspaceScreen=screen;
  $('batchMode').classList.toggle('active',mode==='batch');$('receiptMode').classList.toggle('active',mode==='receipt');
  for(const id of ['batchMode','receiptMode','workspaceArchive'])$(id).disabled=busy||s.busy;
  $('workspaceTabs').hidden=screen==='editScreen'||screen==='tagScreen'||screen==='startScreen';
  if(mode==='batch'){$('toTag').textContent='حفظ القص والفلتر والرجوع';$('toReview').textContent='حفظ البيانات والرجوع';}
  if(!on){if(screen==='queueScreen')$('backBtn').hidden=true;return;}
  $('screenTitle').textContent='الباتش';$('steps').hidden=true;$('draftActions').hidden=false;$('backBtn').hidden=true;
  const id=identity();$('workspaceIdentitySummary').textContent=id.employee&&id.unit?id.employee+' · '+id.unit:'أضف اسم الموظف والوحدة';
  $('workspaceIdentityHint').textContent=(photo?'مسودة · ':'')+(id.tagDate||'اختار التاريخ');
  $('workspaceBatchBadge').textContent=photo?'الصورة مضافة':'لسه مش مضافة';
  $('workspaceBatchEmpty').hidden=photo;$('reviewZoom').hidden=!photo;
  $('workspaceBatchCapture').hidden=photo&&!captureOptions;$('workspaceBatchReady').hidden=!photo||captureOptions;
  for(const x of ['workspaceCamera','workspaceGallery','workspaceBatchEdit','workspaceBatchChange'])$(x).disabled=busy||s.busy;
  // System attachment is source-bound, so the batch is chosen first.
  $('systemCameraBtn').disabled=$('systemGalleryBtn').disabled=!photo||!identityReady()||busy||s.busy;
  if(!photo)$('systemPhotoBadge').textContent='أضف الباتش أولاً';else if(!identityReady())$('systemPhotoBadge').textContent='كمّل الاسم والوحدة أولاً';
  $('systemCameraBtn').textContent='تصوير';$('systemGalleryBtn').textContent='الصور';
  if(photo&&!cropPending&&!window.A2RTapCrop?.pending()){
   const k=photoKey(snapshot());if(k!==thumbKey&&$('resultCanvas').width>1){thumbKey=k;showReview();}
  }
  updateCaption();
  const key=imageKey(),ready=photo&&exportFile&&exportKey===key;
  let label='إرسال واتساب',hint='الصورة والوصف بيتجهزوا تلقائيًا بعد حفظ التعديل.';
  if(!photo){label='أضف صورة الباتش';hint='صوّر الباتش، هيفتح القص والفلتر على طول.';}
  else if(!identityReady()){label='كمّل الاسم والوحدة';hint='البيانات بتتكتب أول مرة وبتفضل محفوظة.';}
  else if(job||!ready&&!errorKey){label='جارٍ تجهيز الصورة…';hint='تقدر تكمّل الأرقام وإحنا بنجهّز الصورة.';}
  else if(errorKey===key){label='إعادة تجهيز الصورة';hint=errorText;}
  else if(!validNumbers()){label='اكتب العدد والإجمالي';hint='العدد والقروش والمجمعة أعداد صحيحة، والإجمالي لحد خانتين عشريتين.';}
  else if(s.loading||s.busy){label='استنى صورة السيستم…';hint='بنجهز صورة السيستم، من غير قص أو فلاتر.';}
  else hint=s.added?'جاهز: صورتان مستقلتان والوصف.':'جاهز: صورة الباتش والوصف. هنفكّرك بصورة السيستم قبل المشاركة.';
  $('shareBtn').textContent=label;
  $('shareBtn').disabled=(!photo)||busy||s.busy||s.loading||!!job||(!identityReady()?false:!ready&&!errorKey)||(!validNumbers()&&identityReady()&&errorKey!==key);
  $('workspaceExportStatus').textContent=hint;$('workspaceExportStatus').classList.toggle('danger',errorKey===key);
  $('copyCaptionBig').hidden=!(shareKey&&shareKey===key&&$('caption').value.trim());
  $('downloadBtn').hidden=!ready;$('openBtn').hidden=!ready;
  if(allowSchedule)schedule();
 }
 window.A2RWorkspace={refresh,canSend,numbersChanged(){updateCaption();refresh();},captionChanged(){window.A2RSystemPhoto?.clearConfirmation();refresh();},metrics,ready:()=>!!initialized&&!stageBInitializing&&!pendingRestore,flush:async()=>{clearTimeout(timer);timer=null;await startExport();if(job)await job;return canSend();}};
 const oldSave=saveDraft;saveDraft=function(){const v=oldSave();refresh();return v;};
 const oldInvalidate=invalidate;invalidate=function(){invalidateExport();const v=oldInvalidate();refresh();return v;};
 const oldGo=go;go=function(id){if(id==='homeScreen')id=mode==='batch'?'sendScreen':'queueScreen';if(mode==='batch'&&id==='reviewScreen')id='sendScreen';if(screen==='sendScreen'&&id!=='sendScreen'){generation++;clearTimeout(timer);timer=null;}const v=oldGo(id);refresh();return v;};
 const oldPrepared=showPrepared;showPrepared=function(...args){if(mode==='batch'&&args[0]?.type==='image/jpeg')exportKey=imageKey();const v=oldPrepared(...args);refresh(false);return v;};
 const oldMode=updateMode;updateMode=function(){const v=oldMode();refresh();return v;};
 const oldOpen=openMode;openMode=async function(m){
  if(busy||systemState().busy)return;
  if(m!=='batch')return oldOpen(m);
  await stageBReady;if(pendingRestore)await pendingRestore();await cancelReceiptSearch();await stopOcr();
  storeActive();mode='batch';activeReceiptId=null;updateMode();$('restoreBtn').hidden=true;
  if(batchDraft){if(source!==batchDraft.source)await activatePhoto(batchDraft);}else{source=null;image=null;$('editor').hidden=true;invalidate();}
  captureOptions=false;go('sendScreen');
 };
 let shareKey='';
 const nativeShare=$('shareBtn').onclick;
 $('shareBtn').onclick=()=>{
  if(busy||systemState().busy)return;
  if(!identityReady()){go('tagScreen');$('employee').focus();return;}
  if(errorKey===imageKey()){schedule(true);refresh(false);return;}
  updateCaption();if(!canSend()){refresh();return;}
  shareKey=imageKey();refresh(false);
  return nativeShare();
 };
 $('copyCaptionBig').onclick=()=>$('copyCaption').click();
 $('workspaceIdentityEdit').onclick=()=>{if(busy||systemState().busy)return;if(!source)return openStartScreen();go('tagScreen');};
 $('workspaceCamera').onclick=()=>{if(!busy&&!systemState().busy)$('cameraInput').click();};
 $('workspaceGallery').onclick=()=>{if(!busy&&!systemState().busy)$('galleryInput').click();};
 $('workspaceBatchEdit').onclick=()=>{if(source&&!busy&&!systemState().busy)go('editScreen');};
 $('workspaceBatchChange').onclick=()=>{captureOptions=true;refresh();};
 $('workspaceArchive').onclick=()=>openArchive();
 const oldTag=$('toTag').onclick;$('toTag').onclick=async()=>{if(mode!=='batch')return oldTag();if(!source)return;if(window.A2RTapCrop?.pending()||!A2RCore.validQuad(quad))return say('كمل الأربع زوايا أو اختار الصورة كلها',true);if(cropPending)await preview();if(cropPending)return say('المعاينة لم تكتمل. جرّب تاني',true);storeActive();captureOptions=false;go('sendScreen');};
 const oldIdentityDone=$('toReview').onclick;$('toReview').onclick=()=>{if(mode!=='batch')return oldIdentityDone();if(!hasIdentity())return;storeActive();go('sendScreen');};
 const oldBack=$('backBtn').onclick;
 $('backBtn').onclick=()=>{if(busy||systemState().busy)return;if(mode!=='batch')return oldBack();if(mode==='batch'&&screen==='editScreen')return $('toTag').onclick();if(mode==='batch'&&screen==='tagScreen')return $('toReview').onclick();go(mode==='batch'?'sendScreen':'queueScreen');};
 const oldOcr=$('ocrRetry').onclick;$('ocrRetry').onclick=()=>{document.body.classList.add('workspace-ocr-used');return oldOcr();};
 // Keep the optional OCR control beside the number heading, not another stage.
 $('workspaceNumbers').querySelector('.section-head').append($('ocrRetry'));
 // Move generated retention controls into the secondary details.
 $('workspaceDetails').append(keepBatchLabel);
 $('workspaceExportStatus').after($('shareHint'));
 const legacyToSend=$('toSend');legacyToSend.hidden=true;
 stageBReady.then(async()=>{initialized=true;try{if(pendingRestore)await pendingRestore();if(!hasStartIdentity())openStartScreen();else if(mode==='receipt')go('queueScreen');else await openMode('batch');}catch(e){say('المسودة لم تفتح بالكامل. جرّب استرجاعها من المسودات',true);go('sendScreen');}refresh();});
 window.addEventListener('pageshow',()=>refresh());
 window.addEventListener('pagehide',()=>{generation++;clearTimeout(timer);});
})();
