/* Review screen («راجع الأرقام»): the batch image with its data paper on top, like the Android «بيانات الباتش» screen.
   Zoom (two fingers, double tap, + / −) to compare the numbers with the slip, and move / resize the paper in the same place.
   It moves the existing paper preview (#tagCanvas, same drawing and drag code) here; nothing in the export path changes. */
'use strict';
(() => {
 const B=document.body;
 const mk=(tag,cls,text,attrs={})=>{const e=document.createElement(tag);if(cls)e.className=cls;if(text)e.textContent=text;for(const [k,v] of Object.entries(attrs))e.setAttribute(k,v);return e;};
 const wrap=document.querySelector('.tag-wrap'),cv=$('tagCanvas');if(!wrap||!cv)return;
 const home={parent:wrap.parentNode,next:wrap.nextSibling};

 const rv=mk('section','rv','',{id:'rvViewer'});
 const head=mk('div','rv-head');
 const title=mk('h2','','صورة الباتش');
 const info=mk('span','rv-info','كبّر بصباعين أو دوس مرتين على الرقم',{id:'rvInfo'});
 const fold=mk('button','text-button rv-fold','إخفاء ▴',{id:'rvFold',type:'button'});
 head.append(title,info,fold);
 const stage=mk('div','rv-stage','',{id:'rvStage'});
 const pan=mk('div','rv-pan','',{id:'rvPan'});
 const zoomBox=mk('div','rv-zoom');
 const zIn=mk('button','','+',{type:'button',id:'rvZoomIn','aria-label':'تكبير الصورة'});
 const zOut=mk('button','','−',{type:'button',id:'rvZoomOut','aria-label':'تصغير الصورة'});
 const zWide=mk('button','','↔',{type:'button',id:'rvZoomWide','aria-label':'الصورة بعرض الشاشة'});
 const zFit=mk('button','','⤢',{type:'button',id:'rvZoomFit','aria-label':'الصورة كلها'});
 zoomBox.append(zIn,zOut,zWide,zFit);
 const badge=mk('div','rv-badge','حرّك الورقة بصباع، وكبّرها أو صغّرها بصباعين',{id:'rvBadge'});badge.hidden=true;
 stage.append(pan,zoomBox,badge);
 const bar=mk('div','rv-bar');
 const paperBtn=mk('button','secondary','✥ تحريك الورقة وحجمها',{id:'rvPaperBtn',type:'button'});
 bar.append(paperBtn);
 const tools=mk('div','rv-paper','',{id:'rvPaper'});tools.hidden=true;
 const smaller=mk('button','secondary','− أصغر',{id:'rvSmaller',type:'button'});
 const bigger=mk('button','secondary','+ أكبر',{id:'rvBigger',type:'button'});
 const reset=mk('button','secondary','تحت بعرض الصورة',{id:'rvReset',type:'button'});
 const done=mk('button','primary','تم',{id:'rvDone',type:'button'});
 tools.append(smaller,bigger,reset,done);
 rv.append(head,stage,bar,tools);
 $('workspaceCard').prepend(rv);

 /* ---------- view zoom (CSS transform only; the canvas pixels are untouched) ---------- */
 let s=1,tx=0,ty=0,paper=false,folded=false,on=false;
 const box=()=>{const W=stage.clientWidth,H=stage.clientHeight,cw=cv.offsetWidth,ch=cv.offsetHeight;return {W,H,cw,ch,ox:(W-cw)/2,oy:(H-ch)/2};};
 const wideScale=()=>{const b=box();return b.cw?Math.max(1,b.W/b.cw):1;};
 const maxScale=()=>Math.max(6,wideScale()*3);
 function clamp(){const b=box();s=Math.min(maxScale(),Math.max(1,s));
  const L=tx+s*b.ox,R=tx+s*(b.ox+b.cw),T=ty+s*b.oy,Bt=ty+s*(b.oy+b.ch);
  if(s*b.cw<=b.W)tx=b.W/2-s*(b.ox+b.cw/2);else{if(L>0)tx-=L;if(R<b.W)tx+=b.W-R;}
  if(s*b.ch<=b.H)ty=b.H/2-s*(b.oy+b.ch/2);else{if(T>0)ty-=T;if(Bt<b.H)ty+=b.H-Bt;}}
 function apply(){clamp();pan.style.transform='translate('+tx+'px,'+ty+'px) scale('+s+')';zOut.disabled=s<=1.001;zIn.disabled=s>=maxScale()-.001;}
 function zoomAt(ns,px,py){const k=Math.min(maxScale(),Math.max(1,ns))/s;tx=px-(px-tx)*k;ty=py-(py-ty)*k;s*=k;apply();}
 function fit(){s=1;tx=0;ty=0;apply();}
 function wide(){const b=box();s=wideScale();tx=0;/* show the bottom of the slip first: totals and the paper are usually there */ty=b.H-s*(b.oy+b.ch);apply();}
 zIn.onclick=()=>{const b=box();zoomAt(s*1.6,b.W/2,b.H/2);};
 zOut.onclick=()=>{const b=box();zoomAt(s/1.6,b.W/2,b.H/2);};
 zFit.onclick=fit;zWide.onclick=wide;
 const pts=new Map();let g=null,lastTap=null;
 const local=e=>{const r=stage.getBoundingClientRect();return {x:e.clientX-r.left,y:e.clientY-r.top};};
 stage.addEventListener('pointerdown',e=>{if(paper||e.target.closest('.rv-zoom'))return;pts.set(e.pointerId,local(e));try{stage.setPointerCapture(e.pointerId);}catch{}
  if(pts.size===1){const p=local(e);g={p,tx,ty,moved:false,t:performance.now()};}
  else if(pts.size===2){const [a,b]=[...pts.values()];g={d:Math.hypot(a.x-b.x,a.y-b.y),m:{x:(a.x+b.x)/2,y:(a.y+b.y)/2},s,tx,ty,moved:true};}
  e.preventDefault();},true);
 stage.addEventListener('pointermove',e=>{if(paper||!pts.has(e.pointerId)||!g)return;pts.set(e.pointerId,local(e));
  if(pts.size>=2&&g.d){const [a,b]=[...pts.values()],d=Math.hypot(a.x-b.x,a.y-b.y),m={x:(a.x+b.x)/2,y:(a.y+b.y)/2};const ns=Math.min(maxScale(),Math.max(1,g.s*d/Math.max(1,g.d))),k=ns/g.s;s=ns;tx=m.x-(g.m.x-g.tx)*k;ty=m.y-(g.m.y-g.ty)*k;apply();}
  else if(g.p){const p=local(e),dx=p.x-g.p.x,dy=p.y-g.p.y;if(Math.hypot(dx,dy)>6)g.moved=true;if(g.moved){tx=g.tx+dx;ty=g.ty+dy;apply();}}},true);
 function up(e){if(!pts.has(e.pointerId))return;const p=local(e);pts.delete(e.pointerId);
  if(g&&g.p&&!g.moved&&pts.size===0&&e.type==='pointerup'){const now=performance.now();
   if(lastTap&&now-lastTap.t<320&&Math.hypot(p.x-lastTap.x,p.y-lastTap.y)<30){lastTap=null;if(s>1.05)fit();else zoomAt(Math.max(2.5,wideScale()),p.x,p.y);}
   else lastTap={t:now,x:p.x,y:p.y};}
  if(pts.size===1){const q=[...pts.values()][0];g={p:q,tx,ty,moved:true};}else if(!pts.size)g=null;}
 /* capture phase: the paper canvas blocks its own events on this screen unless «تحريك الورقة» is on */
 stage.addEventListener('pointerup',up,true);stage.addEventListener('pointercancel',up,true);
 stage.addEventListener('wheel',e=>{if(paper)return;e.preventDefault();const p=local(e);zoomAt(s*(e.deltaY<0?1.15:1/1.15),p.x,p.y);},{passive:false});

 /* ---------- paper move / size (same tagPos + drawTag path as the paper screen) ---------- */
 const canPaper=()=>$('showTag').checked&&$('tagLayout').value==='overlay';
 function setPaper(v){paper=!!v&&canPaper();B.classList.toggle('rv-paper-on',paper);tools.hidden=!paper;badge.hidden=!paper;bar.hidden=paper;info.textContent=paper?'اسحب الورقة لمكان فاضي، ماتغطيش العدد أو الإجمالي':'كبّر بصباعين أو دوس مرتين على الرقم';if(navigator.vibrate&&v)try{navigator.vibrate(8);}catch{}}
 function scalePaper(k){if(busy||!canPaper())return;tagPos.s=Math.max(.1,Math.min(1,Math.round((tagPos.s+k)*100)/100));$('tagScale').value=tagPos.s;drawTag();invalidate();saveDraft();}
 paperBtn.onclick=()=>{if(busy)return;if(!canPaper()){say('ورقة البيانات مخفية. فعّل «إظهار ورقة البيانات» تحت الأول',true);return;}setPaper(true);};
 smaller.onclick=()=>scalePaper(-.08);bigger.onclick=()=>scalePaper(.08);
 reset.onclick=()=>{if(busy)return;$('tagReset').onclick();};
 done.onclick=()=>setPaper(false);
 fold.onclick=()=>{folded=!folded;B.classList.toggle('rv-folded',folded);fold.textContent=folded?'إظهار ▾':'إخفاء ▴';if(!folded)requestAnimationFrame(apply);};

 /* ---------- size like the app: image takes the top part, numbers stay reachable under it ---------- */
 function size(){const vv=window.visualViewport,h=vv?vv.height:innerHeight,kb=vv&&vv.height<innerHeight*.8;
  const H=Math.round(Math.max(150,Math.min(460,h*(kb?.30:.37))));rv.style.setProperty('--rv-h',H+'px');
  const sb=$('stepBack'),top=document.querySelector('header.top'),th=top&&getComputedStyle(top).position==='sticky'?top.offsetHeight:0;rv.style.setProperty('--rv-top',(th+(sb&&!sb.hidden?sb.offsetHeight:0))+'px');requestAnimationFrame(apply);}
 window.visualViewport?.addEventListener('resize',size);addEventListener('resize',size);
 new ResizeObserver(()=>{if(on)apply();}).observe(cv);

 /* ---------- show only on the batch review screen ---------- */
 function sync(){const want=B.classList.contains('easy-batch')&&B.classList.contains('easy-review');
  if(want===on){if(on)size();return;}on=want;B.classList.toggle('rv-on',on);
  if(on){pan.append(wrap);fit();size();}
  else{setPaper(false);if(wrap.parentNode!==home.parent)home.parent.insertBefore(wrap,home.next&&home.next.parentNode===home.parent?home.next:null);pan.style.transform='';}}
 new MutationObserver(sync).observe(B,{attributes:true,attributeFilter:['class']});
 $('showTag').addEventListener('change',()=>{if(!canPaper())setPaper(false);});
 window.A2RReviewViewer={state:()=>({on,paper,s,tx,ty}),fit,wide,setPaper,zoomAt};
 sync();
})();
