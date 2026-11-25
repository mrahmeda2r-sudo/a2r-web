/* Fresh sections + saved work («ملفاتي»).
   - Every tap on الباتش / إيصالات الدفع (home tiles or tabs) opens that section empty.
   - Work that was open is saved first (never dropped) and listed on home; tapping it reopens it as it was.
   - Opening the site always lands on home; nothing is restored until the user picks it.
   Image/crop/paper/export code is untouched: reopening uses the same draft objects and activatePhoto path. */
'use strict';
(() => {
 /* Reading numbers uses only ONE of the four OCR engine files (the "lstm" one that fits this phone).
    The offline download used to fetch all four (~17 MB); now it fetches only the one that is used
    and frees the others if they were downloaded before. Same engine, same reading. */
 try {
  const simd = WebAssembly.validate(new Uint8Array([0, 97, 115, 109, 1, 0, 0, 0, 1, 5, 1, 96, 0, 1, 123, 3, 2, 1, 0, 10, 10, 1, 8, 0, 65, 0, 253, 15, 253, 98, 11]));
  const unused = ['tesseract-core.wasm.js', 'tesseract-core-simd.wasm.js', simd ? 'tesseract-core-lstm.wasm.js' : 'tesseract-core-simd-lstm.wasm.js'];
  for (let i = OCR_FILES.length - 1; i >= 0; i--)
   if (unused.some(u => OCR_FILES[i].endsWith('/' + u))) OCR_FILES.splice(i, 1);
  if ('caches' in window) caches.open('a2r-web-ocr-v1').then(c => Promise.all(unused.map(u => c.delete(new URL('vendor/ocr/' + u, location.href).href, {
   ignoreSearch: true
  })))).catch(() => {});
 } catch {}
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
  dirty.add(s.sid);
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

 /* ---------- storage v2 ----------
    v21 kept the whole saved list (with every photo) in ONE record and rewrote all of it on every save.
    Now: one small record per saved item ('sw:<sid>'), each photo stored ONCE as plain bytes ('img:<key>'),
    never rewritten. Photos read back are rebuilt as in-memory files, so later saves never have to copy
    a file that lives inside the database (that copy is what Safari refuses). */
 const SP = 'sw:', IP = 'img:', GONE = 'savedWorkGone';
 const blobKey = new WeakMap();
 let dirty = new Set(), gone = new Set(), v1 = new Set();
 window.A2RFresh_lastError = null;
 const isLost = e => e && (e.name === 'InvalidStateError' || e.name === 'TransactionInactiveError' || (e.name === 'UnknownError' && !/quota|space|disk/i.test(e.message || '')) || /connection|closing|lost/i.test(e.message || ''));
 const isFull = e => e && (e.name === 'QuotaExceededError' || /quota|space|disk/i.test(e.message || ''));
 /* iPhone Safari drops the database connection when the site goes to the background (e.g. after sharing
    to WhatsApp). Every later save then fails. Reconnect once and retry, for every part of the site. */
 const baseDbOp = dbOp;
 async function reconnect() {
  try { db?.close?.(); } catch {}
  db = await openDb();
  watchDb();
 }
 function watchDb() {
  try {
   if (db && !db.__a2rWatched) {
    db.__a2rWatched = true;
    db.onclose = () => { db.__a2rClosed = true; };
    db.onversionchange = () => { try { db.close(); } catch {} db.__a2rClosed = true; };
   }
  } catch {}
 }
 dbOp = async function(mode, action) {
  try {
   if (db?.__a2rClosed) await reconnect();
   return await baseDbOp(mode, action);
  } catch (e) {
   if (!window.indexedDB || !isLost(e)) throw e;
   await reconnect();
   return baseDbOp(mode, action);
  }
 };
 function txRun(fn) {
  return new Promise((yes, no) => {
   let tx;
   try {
    tx = db.transaction('drafts', 'readwrite');
   } catch (e) {
    return no(e);
   }
   fn(tx.objectStore('drafts'));
   tx.oncomplete = () => yes();
   tx.onerror = () => no(tx.error);
   tx.onabort = () => no(tx.error || Error('لم يكتمل الحفظ'));
  });
 }
 async function tx(fn) {
  try {
   if (db?.__a2rClosed) await reconnect();
   return await txRun(fn);
  } catch (e) {
   if (!isLost(e)) throw e;
   await reconnect();
   return txRun(fn);
  }
 }
 const newKey = () => 'i' + Date.now().toString(36) + Math.random().toString(16).slice(2, 8);
 const plain = o => {
  const pr = Object.getPrototypeOf(o);
  return pr === Object.prototype || pr === null;
 };
 /* Copy a session for storage: photos become {__img:key}; things a database can't keep are left out. */
 function pack(v, imgs, local) {
  if (v === null || typeof v !== 'object') return typeof v === 'function' ? undefined : v;
  if (v instanceof Blob) {
   let k = blobKey.get(v) || local.get(v);
   if (!k) {
    k = newKey();
    local.set(v, k);
    imgs.push([k, v]);
   }
   return {
    __img: k,
    file: v instanceof File,
    name: v.name || '',
    type: v.type || '',
    lastModified: v.lastModified || 0
   };
  }
  if (Array.isArray(v)) return v.map(x => {
   const y = pack(x, imgs, local);
   return y === undefined ? null : y;
  });
  if (v instanceof Date || ArrayBuffer.isView(v) || v instanceof ArrayBuffer) return v;
  if (!plain(v)) return undefined;
  const out = {};
  for (const [k, x] of Object.entries(v)) {
   const y = pack(x, imgs, local);
   if (y !== undefined) out[k] = y;
  }
  return out;
 }
 function refsOf(v, set = new Set()) {
  if (!v || typeof v !== 'object') return set;
  if (v.__img) set.add(v.__img);
  else if (v instanceof Blob) {
   const k = blobKey.get(v);
   if (k) set.add(k);
  } else if (Array.isArray(v) || plain(v))
   for (const x of Object.values(v)) refsOf(x, set);
  return set;
 }
 const hasLive = v => {
  if (!v || typeof v !== 'object') return false;
  if (v instanceof Blob) return true;
  if (Array.isArray(v) || plain(v)) return Object.values(v).some(hasLive);
  return false;
 };
 /* Rebuild a stored session with its photos as fresh in-memory files. */
 async function unpack(s) {
  if (!hasRefs(s)) return s;
  const keys = [...refsOf(s)];
  const recs = {};
  for (const k of keys) recs[k] = await dbOp('readonly', st => st.get(IP + k));
  const made = new Map();
  const build = v => {
   if (v === null || typeof v !== 'object') return v;
   if (v.__img) {
    if (made.has(v.__img)) return made.get(v.__img);
    const r = recs[v.__img];
    if (!r?.buf) return null;
    const b = v.file ? new File([r.buf], v.name || 'image.jpg', {
     type: v.type || r.type || '',
     lastModified: v.lastModified || Date.now()
    }) : new Blob([r.buf], {
     type: v.type || r.type || ''
    });
    blobKey.set(b, v.__img);
    made.set(v.__img, b);
    return b;
   }
   if (Array.isArray(v)) return v.map(build);
   if (!plain(v)) return v;
   const o = {};
   for (const [k, x] of Object.entries(v)) o[k] = build(x);
   return o;
  };
  return build(s);
 }
 const hasRefs = v => !!v && typeof v === 'object' && (v.__img ? true : (Array.isArray(v) || plain(v)) && Object.values(v).some(hasRefs));

 function failMsg(e) {
  const name = e?.name || 'Error';
  window.A2RFresh_lastError = name + ': ' + (e?.message || '');
  try { console.warn('A2R save failed', name, e?.message); } catch {}
  if (isFull(e)) return 'الشغل ما اتحفظش لأن مساحة التخزين على الموبايل مليانة. امسح الملفات القديمة من «ملفاتي» وجرّب تاني. الشغل المفتوح لسه موجود.';
  return 'الشغل ما اتحفظش: المتصفح رفض الحفظ (' + name + '). اقفل الموقع وافتحه تاني وجرّب. الشغل المفتوح لسه موجود.';
 }

 /* Write only what changed: the changed items, and each new photo once. */
 async function persist() {
  if (!db) return true; /* no storage at all on this browser: nothing could be kept anyway */
  try {
   if (!loaded) await loadList();
   const ids = [...dirty];
   const imgs = [], local = new Map(), packed = [];
   for (const sid of ids) {
    const s = list.find(x => x.sid === sid);
    if (s) packed.push(pack(s, imgs, local));
   }
   const bytes = [];
   for (const [k, b] of imgs) bytes.push([k, await b.arrayBuffer(), b.type || '']);
   const goneNow = [...gone];
   await tx(st => {
    for (const [k, buf, type] of bytes) st.put({ buf, type, size: buf.byteLength }, IP + k);
    for (const p of packed) st.put(p, SP + p.sid);
    for (const sid of ids)
     if (!list.some(x => x.sid === sid)) st.delete(SP + sid);
    if (goneNow.length) st.put({ sids: goneNow }, GONE);
   });
   for (const [b, k] of local) blobKey.set(b, k);
   /* keep only the small stored copy in memory */
   for (const p of packed) {
    const i = list.findIndex(x => x.sid === p.sid);
    if (i >= 0) list[i] = p;
   }
   dirty = new Set();
   loaded = true;
   gc();
   checkSpace();
   return true;
  } catch (e) {
   say(failMsg(e), true);
   return false;
  }
 }

 /* Delete photos no saved item uses any more (never touches saved items themselves). */
 async function gc() {
  try {
   if (!loaded) return;
   const used = new Set();
   for (const s of list) refsOf(s, used);
   for (const s of openSessions()) refsOf(s, used);
   if (v1.size) return; /* old list not fully moved yet: keep everything */
   const keys = await dbOp('readonly', st => st.getAllKeys());
   const drop = keys.filter(k => typeof k === 'string' && k.startsWith(IP) && !used.has(k.slice(IP.length)));
   if (drop.length) await tx(st => drop.forEach(k => st.delete(k)));
  } catch {}
 }

 /* Read the saved list: v2 records, plus anything still in the old one-record list (moved over here). */
 async function loadList() {
  const keys = await dbOp('readonly', st => st.getAllKeys());
  const out = [];
  for (const k of keys)
   if (typeof k === 'string' && k.startsWith(SP)) {
    const r = await dbOp('readonly', st => st.get(k));
    if (r?.sid) out.push(r);
   }
  const g = await dbOp('readonly', st => st.get(GONE)).catch(() => null);
  gone = new Set(g?.sids || []);
  const old = await dbOp('readonly', st => st.get(KEY)).catch(() => null);
  v1 = new Set();
  for (const x of (Array.isArray(old?.list) ? old.list : []))
   if (x?.sid && !gone.has(x.sid) && !out.some(y => y.sid === x.sid)) {
    out.push(x);
    v1.add(x.sid);
   }
  for (const x of list)
   if (!out.some(y => y.sid === x.sid)) out.push(x);
  list = out;
  loaded = true;
 }
 /* Move items from the old single record into v2, one by one. The old record is removed only when
    every item is safely moved, so his saved batch is never lost on the way. */
 async function migrate() {
  if (!v1.size) return;
  for (const sid of [...v1]) {
   dirty = new Set([sid]);
   try {
    const s = list.find(x => x.sid === sid);
    const imgs = [], local = new Map(), p = pack(s, imgs, local), bytes = [];
    for (const [k, b] of imgs) bytes.push([k, await b.arrayBuffer(), b.type || '']);
    await tx(st => {
     for (const [k, buf, type] of bytes) st.put({ buf, type, size: buf.byteLength }, IP + k);
     st.put(p, SP + sid);
    });
    const i = list.findIndex(x => x.sid === sid);
    if (i >= 0) list[i] = p;
    v1.delete(sid);
   } catch (e) {
    window.A2RFresh_lastError = 'migrate ' + (e?.name || '') + ': ' + (e?.message || '');
   }
  }
  dirty = new Set();
  if (!v1.size) {
   try {
    await tx(st => {
     st.delete(KEY);
     st.delete(GONE);
    });
    gone = new Set();
   } catch {}
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
  const before = list.slice(), beforeDirty = new Set(dirty);
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
   dirty = beforeDirty;
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
  let t = list.find(x => x.sid === sid) || s;
  try {
   t = await unpack(t);
  } catch {
   return say('الملف ده ما اتفتحش. جرّب تاني', true);
  }
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
  const before = list.slice();
  list = list.filter(x => x.sid !== sid);
  dirty.add(sid);
  if (v1.has(sid)) {
   v1.delete(sid);
   gone.add(sid);
  }
  if (!await persist()) list = before;
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
   watchDb();
   list = [];
   await loadList();
   await migrate();
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
   if (dirty.size && !await persist()) {
    loaded = false;
    return;
   }
   gc();
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
