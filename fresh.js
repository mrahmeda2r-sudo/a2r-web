/* Fresh sections + saved work («ملفاتي»).
   - Every tap on الباتش / إيصالات الدفع (home tiles or tabs) opens that section empty.
   - Work that was open is saved first (never dropped) and listed on home; tapping it reopens it as it was.
   - Opening the site always lands on home; nothing is restored until the user picks it.
   Image/crop/paper/export code is untouched: reopening uses the same draft objects and activatePhoto path. */
'use strict';
(() => {
 const KEY = 'savedWork';
 let list = [],
  loaded = false,
  armed = null,
  armTimer = null;
 const sysBusy = () => !!window.A2RSystemPhoto?.state()?.busy;
 const newId = () => 's' + Date.now().toString(36) + Math.random().toString(16).slice(2, 7);
 const emptyFields = () => ({
  batchCount: '',
  batchTotal: '',
  batchPiasters: '0',
  batchCollected: '0',
  systemTotal: ''
 });
 const sentAtOf = s => s.kind === 'batch' ? (s.batch?.sentAt || s.sent?.at || null) : (s.items?.find(p => Number.isFinite(p.sentAt))?.sentAt || s.sent?.at || null);

 function upsert(s) {
  const i = list.findIndex(x => x.sid === s.sid);
  if (i >= 0) list[i] = s;
  else list.push(s);
 }

 const FULL_MSG = 'مساحة التخزين على الموبايل قربت تخلص. امسح الملفات القديمة اللي مش محتاجها من «ملفاتي» (زرار ✕).';
 let warnedAt = 0;
 async function checkSpace() {
  try {
   const e = await navigator.storage?.estimate?.();
   if (e && e.quota && e.usage / e.quota > 0.85 && Date.now() - warnedAt > 60000) {
    warnedAt = Date.now();
    say(FULL_MSG, true);
   }
  } catch {}
 }
 async function persist() {
  if (!db) return true; /* no storage at all on this browser: nothing could be kept anyway */
  try {
   if (!loaded) {
    const saved = await dbOp('readonly', st => st.get(KEY));
    const old = Array.isArray(saved?.list) ? saved.list : [];
    for (const x of old)
     if (!list.some(y => y.sid === x.sid)) list.push(x);
   }
   await dbOp('readwrite', st => st.put({
    v: 1,
    list
   }, KEY));
   loaded = true;
   checkSpace();
   return true;
  } catch {
   say('الشغل ما اتحفظش لأن مساحة التخزين مليانة أو المتصفح منع الحفظ. امسح الملفات القديمة من «ملفاتي» وجرّب تاني. الشغل المفتوح لسه موجود.', true);
   return false;
  }
 }

 function batchSession(b, extra) {
  return {
   sid: b.sid || newId(),
   kind: 'batch',
   savedAt: Date.now(),
   ...extra,
   batch: b
  };
 }

 /* Move the open batch into the saved list and empty the batch section. */
 function parkBatch() {
  if (batchDraft?.source) {
   batchDraft.sid = batchDraft.sid || newId();
   upsert(batchSession(batchDraft, {
    identity: identity(),
    fields: Object.fromEntries(BATCH_FIELDS.map(id => [id, $(id).value])),
    ocrResult,
    ocrImageKey,
    ocrDirty: {
     ...ocrDirty
    },
    sent: sentHistory.batch || null,
    quality: $('quality').value
   }));
  }
  batchDraft = null;
  for (const [id, v] of Object.entries(emptyFields())) $(id).value = v;
  $('caption').value = '';
  ocrResult = null;
  ocrImageKey = '';
  ocrDirty = {
   count: false,
   total: false
  };
  sentHistory.batch = null;
  if ($('sentState')) $('sentState').textContent = '';
 }

 function parkReceipts() {
  if (receiptItems.length) {
   const sid = receiptItems.find(p => p.sessionId)?.sessionId || newId();
   receiptItems.forEach(p => p.sessionId = sid);
   upsert({
    sid,
    kind: 'receipt',
    savedAt: Date.now(),
    identity: identity(),
    sent: sentHistory.receipts || null,
    items: receiptItems
   });
  }
  receiptItems = [];
  activeReceiptId = null;
  if (typeof queueInvalidate === 'function') queueInvalidate();
  sentHistory.receipts = null;
 }

 function dropOpenImage() {
  if (typeof resetCropCache === 'function') resetCropCache();
  source = null;
  image = null;
  lastPreviewKey = '';
  if (imageUrl) URL.revokeObjectURL(imageUrl);
  imageUrl = null;
  $('editor').hidden = true;
  invalidate();
 }

 function hideChooser() {
  const c = $('appChooser');
  if (c) c.hidden = true;
  document.body.classList.remove('app-chooser');
 }

 /* Save first; empty the sections only if the save worked, so nothing is ever dropped. */
 async function parkAll() {
  storeActive();
  const before = list.slice();
  const keep = {
   batchDraft,
   receiptItems,
   activeReceiptId,
   fields: Object.fromEntries(BATCH_FIELDS.map(id => [id, $(id).value])),
   caption: $('caption').value,
   ocrResult,
   ocrImageKey,
   ocrDirty,
   sent: {
    ...sentHistory
   }
  };
  parkBatch();
  parkReceipts();
  if (!await persist()) {
   list = before;
   batchDraft = keep.batchDraft;
   receiptItems = keep.receiptItems;
   activeReceiptId = keep.activeReceiptId;
   for (const id of BATCH_FIELDS) $(id).value = keep.fields[id];
   $('caption').value = keep.caption;
   ocrResult = keep.ocrResult;
   ocrImageKey = keep.ocrImageKey;
   ocrDirty = keep.ocrDirty;
   sentHistory.batch = keep.sent.batch;
   sentHistory.receipts = keep.sent.receipts;
   return false;
  }
  await stopOcr('');
  dropOpenImage();
  return true;
 }

 /* Tap on a section: save what was open, then open the section empty. */
 async function openFresh(kind) {
  if (busy || sysBusy()) return;
  await stageBReady;
  if (pendingRestore) await pendingRestore();
  if (!await parkAll()) return;
  hideChooser();
  $('tagDate').value = localDate();
  await openMode(kind);
  saveDraft();
 }

 /* Reopen saved work exactly as it was (photos, crop, filter, paper position, numbers, system photo). */
 async function reopen(sid) {
  if (busy || sysBusy()) return;
  await stageBReady;
  const s = list.find(x => x.sid === sid);
  if (!s) return;
  if (!await parkAll()) return;
  const t = list.find(x => x.sid === sid) || s;
  hideChooser();
  if (t.identity?.tagDate) $('tagDate').value = t.identity.tagDate;
  if (t.kind === 'batch') {
   batchDraft = t.batch;
   batchDraft.sid = t.sid;
   const f = {
    ...emptyFields(),
    ...(t.fields || {})
   };
   for (const id of BATCH_FIELDS) $(id).value = f[id] ?? '';
   ocrResult = t.ocrResult || null;
   ocrImageKey = t.ocrImageKey || '';
   ocrDirty = t.ocrDirty || {
    count: !!f.batchCount,
    total: !!f.batchTotal
   };
   sentHistory.batch = t.sent || null;
   if (t.quality !== undefined) $('quality').value = t.quality;
   if ($('keepBatch')) $('keepBatch').checked = !!batchDraft.kept;
   try {
    await openMode('batch');
   } catch {
    say('الباتش ما اتفتحش بالكامل. جرّب تاني من ملفاتي', true);
   }
  } else {
   receiptItems = t.items || [];
   receiptItems.forEach(p => p.sessionId = t.sid);
   activeReceiptId = null;
   sentHistory.receipts = t.sent || null;
   await openMode('receipt');
  }
  saveDraft();
  fillAll();
 }

 async function remove(sid) {
  list = list.filter(x => x.sid !== sid);
  await persist();
  fillAll();
 }

 /* ---------- list rows (home «ملفاتي» and the drafts screen) ---------- */
 const z = n => String(n).padStart(2, '0');
 const hm = t => {
  const d = new Date(t);
  return z(d.getHours()) + ':' + z(d.getMinutes());
 };
 const dmy = v => {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(v || '');
  return m ? '\u2066' + m[3] + '-' + m[2] + '-' + m[1] + '\u2069' : '';
 };
 const today = t => !!t && new Date(t).toDateString() === new Date().toDateString();

 function describe(s, open) {
  const sentAt = sentAtOf(s);
  let name, sub;
  if (s.kind === 'batch') {
   const f = s.fields || {};
   const c = A2RBatch.integer(f.batchCount || ''),
    t = A2RBatch.cents(f.batchTotal || '');
   name = 'باتش' + (s.identity?.tagDate ? ' · ' + dmy(s.identity.tagDate) : '');
   sub = (c !== null && t !== null) ? c + ' معاملة · ' + A2RBatch.money(t) + ' جنيه' : 'الأرقام لسه متكتبتش';
  } else {
   name = 'إيصالات الدفع (' + (s.items?.length || 0) + ' صورة)' + (s.identity?.tagDate ? ' · ' + dmy(s.identity.tagDate) : '');
   sub = '';
  }
  const st = sentAt ? '✓ اتبعت ' + (today(sentAt) ? 'النهارده ' : dmy((d => d.getFullYear() + '-' + z(d.getMonth() + 1) + '-' + z(d.getDate()))(new Date(sentAt))) + ' ') + hm(sentAt) : 'لسه متبعتش';
  return {
   name: (open ? 'مفتوح دلوقتي · ' : '') + name,
   sub: [sub, st].filter(Boolean).join(' · '),
   ok: !!sentAt
  };
 }

 function openSessions() {
  const out = [];
  if (batchDraft?.source) out.push({
   sid: batchDraft.sid || 'open-batch',
   kind: 'batch',
   open: true,
   batch: batchDraft,
   identity: identity(),
   fields: Object.fromEntries(BATCH_FIELDS.map(id => [id, $(id).value])),
   sent: sentHistory.batch
  });
  if (receiptItems.length) out.push({
   sid: receiptItems.find(p => p.sessionId)?.sessionId || 'open-receipt',
   kind: 'receipt',
   open: true,
   items: receiptItems,
   identity: identity(),
   sent: sentHistory.receipts
  });
  return out;
 }

 function rows() {
  const open = openSessions(),
   openIds = new Set(open.map(s => s.sid));
  const saved = list.filter(s => !openIds.has(s.sid)).sort((a, b) => (b.savedAt || 0) - (a.savedAt || 0));
  return [...open, ...saved];
 }

 function row(s) {
  const d = describe(s, s.open);
  const wrap = document.createElement('div');
  wrap.className = 'fr-row';
  const r = document.createElement('button');
  r.type = 'button';
  r.className = 'as-file' + (d.ok ? ' ok' : '');
  r.dataset.sid = s.sid;
  const ic = document.createElement('span');
  ic.className = 'as-file-ic';
  ic.textContent = d.ok ? '✓' : (s.kind === 'batch' ? '▤' : '▧');
  const tx = document.createElement('span');
  tx.className = 'as-file-text';
  const a = document.createElement('strong'),
   b = document.createElement('small');
  a.textContent = d.name;
  b.textContent = d.sub;
  tx.append(a, b);
  const go_ = document.createElement('span');
  go_.className = 'as-file-go';
  go_.textContent = '‹';
  r.append(ic, tx, go_);
  r.onclick = () => {
   if (busy || sysBusy()) return;
   if (s.open) {
    hideChooser();
    openMode(s.kind);
   } else reopen(s.sid);
  };
  wrap.append(r);
  if (!s.open) {
   const del = document.createElement('button');
   del.type = 'button';
   del.className = 'fr-del';
   del.setAttribute('aria-label', 'حذف');
   del.textContent = '✕';
   del.onclick = e => {
    e.stopPropagation();
    if (armed !== s.sid) {
     armed = s.sid;
     del.textContent = 'اضغط تاني للحذف';
     del.classList.add('armed');
     clearTimeout(armTimer);
     armTimer = setTimeout(() => {
      armed = null;
      fillAll();
     }, 5000);
     return;
    }
    armed = null;
    remove(s.sid);
   };
   wrap.append(del);
  }
  return wrap;
 }

 function fill(container) {
  if (!container) return 0;
  container.replaceChildren();
  const rs = rows();
  for (const s of rs) container.append(row(s));
  return rs.length;
 }

 /* Drafts screen («المسودات» tab): the saved work on top of the local archive. */
 const box = document.createElement('section');
 box.className = 'card fr-saved';
 box.id = 'savedWork';
 box.innerHTML = '<div class="section-head"><h2>الشغل المحفوظ</h2></div><p class="hint">كل باتش أو إيصالات اتقفلت بتتحفظ هنا. دوس عليها تفتح زي ما كانت للتعديل أو إعادة الإرسال.</p><div class="as-files-list" id="savedWorkList"></div>';
 const arch = $('archiveScreen');
 if (arch) arch.prepend(box);

 function fillAll() {
  if (!box.isConnected && $('archiveScreen')) $('archiveScreen').prepend(box);
  const n = fill($('savedWorkList'));
  box.hidden = !n;
  window.A2RShell?.sync?.();
 }

 /* ---------- startup: whatever was open becomes saved work; the site opens on home ---------- */
 /* Runs before the old start-up step, so its 12-hour cleanup never touches work saved here. */
 const baseInit = initStageB;
 initStageB = async function(...a) {
  try {
   if (!db) db = await openDb();
  } catch {}
  if (db) await parkSavedDraft();
  return baseInit.apply(this, a);
 };
 async function parkSavedDraft() {
  try {
   const saved = await dbOp('readonly', st => st.get(KEY));
   list = Array.isArray(saved?.list) ? saved.list : [];
   loaded = true;
   const d = await dbOp('readonly', st => st.get('current'));
   if (d?.stageB) {
    const b = d.stageB;
    archiveItems = b.archive || [];
    sentHistory = b.sentHistory || {
     batch: null,
     receipts: null
    };
    if (b.batch?.source) {
     b.batch.sid = b.batch.sid || newId();
     upsert(batchSession(b.batch, {
      identity: b.identity || {},
      fields: b.fields || emptyFields(),
      ocrResult: b.ocrResult || null,
      ocrImageKey: b.ocrImageKey || '',
      ocrDirty: b.ocrDirty || {
       count: !!b.fields?.batchCount,
       total: !!b.fields?.batchTotal
      },
      sent: sentHistory.batch || null,
      quality: d.quality
     }));
    }
    if (b.receipts?.length) {
     const sid = b.receipts.find(p => p.sessionId)?.sessionId || newId();
     b.receipts.forEach(p => p.sessionId = sid);
     upsert({
      sid,
      kind: 'receipt',
      savedAt: d.saved || Date.now(),
      identity: b.identity || {},
      sent: sentHistory.receipts || null,
      items: b.receipts
     });
    }
    sentHistory.batch = null;
    sentHistory.receipts = null;
    if (d.quality !== undefined) $('quality').value = d.quality;
   } else if (d?.source) {
    /* very old single-photo draft */
    upsert(batchSession({
     source: d.source,
     name: d.name,
     quad: d.quad,
     turns: d.turns,
     choice: d.choice,
     showTag: d.showTag,
     tagLayout: d.tagLayout,
     tagPos: d.tagPos
    }, {
     identity: {},
     fields: emptyFields(),
     sent: null
    }));
   }
   if (!await persist()) {
    loaded = false;
    return;
   }
   if (d?.stageB || d?.source) {
    const clean = {
     employee: d.employee,
     unit: d.unit,
     quality: d.quality,
     stageB: {
      archive: archiveItems,
      mode: 'batch',
      screen: 'homeScreen',
      batch: null,
      receipts: [],
      activeReceiptId: null,
      identity: d.stageB?.identity || {},
      tagPos: {
       x: .5,
       y: .9,
       s: 1
      },
      fields: emptyFields(),
      ocrResult: null,
      ocrImageKey: '',
      ocrDirty: {
       count: false,
       total: false
      },
      sentHistory: {
       batch: null,
       receipts: null
      }
     },
     saved: Date.now()
    };
    await dbOp('readwrite', st => st.put(clean, 'current'));
   }
  } catch {
   /* storage problems: keep the old behaviour (draft restore button) */
  }
 }

 /* Section taps open fresh. Internal calls to openMode (startup, reopen) are unchanged. */
 const fresh = kind => () => openFresh(kind);
 $('batchMode').onclick = fresh('batch');
 $('receiptMode').onclick = fresh('receipt');

 function hookTiles(tries = 0) {
  const a = $('ahBatch'),
   b = $('ahReceipts');
  if (!a || !b) {
   if (tries < 40) setTimeout(() => hookTiles(tries + 1), 100);
   return;
  }
  a.onclick = fresh('batch');
  b.onclick = fresh('receipt');
 }
 hookTiles();

 /* Opening the site (or the installed app) always lands on home with the buttons. */
 stageBReady.then(() => setTimeout(() => {
  if (screen !== 'startScreen' && hasStartIdentity() && $('ahHomeTab')) $('ahHomeTab').click();
  fillAll();
 }, 80));
 const baseGo = go;
 go = function(...a) {
  const v = baseGo.apply(this, a);
  if (a[0] === 'archiveScreen') fillAll();
  return v;
 };
 /* Keep saved system photos when the cleaner runs. */
 window.A2RFresh = {
  refIds: () => loaded ? list.filter(s => s.kind === 'batch').map(s => s.batch?.systemPhoto?.id).filter(Boolean) : null,
  fill,
  sentToday: kind => [...openSessions(), ...list].some(s => s.kind === kind && today(sentAtOf(s))),
  openFresh,
  reopen,
  list: () => list.slice(),
  loaded: () => loaded
 };
})();
