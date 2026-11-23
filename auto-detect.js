/* A2R auto edge detection: finds the bright paper quad in a photo. Pure JS, no deps, runs on a downscaled copy. */
(function(root){'use strict';
function detect(rgba,w,h){
 const n=w*h,p=new Float32Array(n);
 const lum=i=>rgba[i*4]*.299+rgba[i*4+1]*.587+rgba[i*4+2]*.114;
 // background model from a coarse grid of local blocks along the border
 const ring=[];const bw=Math.max(2,Math.round(Math.min(w,h)*0.03));for(let y=0;y<h;y++)for(let x=0;x<w;x++){if(x<bw||y<bw||x>=w-bw||y>=h-bw)ring.push(y*w+x);}
 const med=k=>{const a=ring.map(i=>rgba[i*4+k]).sort((x,y)=>x-y);return a[a.length>>1];};const BR=med(0),BG=med(1),BB=med(2),BL=BR*.299+BG*.587+BB*.114;
 // fit a plane L=a+bx+cy to the border luminance (uneven lighting), least squares
 let S=[0,0,0,0,0,0,0,0,0],T=[0,0,0];for(const i of ring){const x=(i%w)/w,y=((i/w)|0)/h,L=lum(i),v=[1,x,y];for(let r=0;r<3;r++){T[r]+=v[r]*L;for(let c=0;c<3;c++)S[r*3+c]+=v[r]*v[c];}}
 const det=m=>m[0]*(m[4]*m[8]-m[5]*m[7])-m[1]*(m[3]*m[8]-m[5]*m[6])+m[2]*(m[3]*m[7]-m[4]*m[6]);const D=det(S);let pl=[BL,0,0];
 if(Math.abs(D)>1e-9){pl=[0,1,2].map(k=>{const m=S.slice();for(let r=0;r<3;r++)m[r*3+k]=T[r];return det(m)/D;});}
 for(let i=0;i<n;i++){const r=rgba[i*4],g=rgba[i*4+1],b=rgba[i*4+2],mx=Math.max(r,g,b),mn=Math.min(r,g,b),L=lum(i),x=(i%w)/w,y=((i/w)|0)/h,base=pl[0]+pl[1]*x+pl[2]*y;const chroma=Math.hypot(r-BR-(L-BL),g-BG-(L-BL),b-BB-(L-BL));p[i]=Math.max(0,Math.min(255,(L-base)*1.6+chroma*0.5-0.6*(mx-mn)+60));}
 // local-contrast normalise against a coarse background estimate (handles uneven light)
 const hist=new Uint32Array(256);for(let i=0;i<n;i++)hist[Math.max(0,Math.min(255,p[i]|0))]++;
 let sum=0;for(let i=0;i<256;i++)sum+=i*hist[i];let sB=0,wB=0,best=0,t=128;
 for(let i=0;i<256;i++){wB+=hist[i];if(!wB)continue;const wF=n-wB;if(!wF)break;sB+=i*hist[i];const mB=sB/wB,mF=(sum-sB)/wF,v=wB*wF*(mB-mF)*(mB-mF);if(v>best){best=v;t=i;}}
 let m=new Uint8Array(n);for(let i=0;i<n;i++)m[i]=p[i]>t?1:0;
 const morph=(src,dil)=>{const o=new Uint8Array(n);for(let y=0;y<h;y++)for(let x=0;x<w;x++){let v=dil?0:1;for(let dy=-2;dy<=2&&(dil?!v:v);dy++)for(let dx=-2;dx<=2;dx++){const xx=x+dx,yy=y+dy;const s=(xx<0||yy<0||xx>=w||yy>=h)?0:src[yy*w+xx];if(dil&&s){v=1;break;}if(!dil&&!s){v=0;break;}}o[y*w+x]=v;}return o;};
 m=morph(morph(m,true),false);m=morph(morph(m,false),true);
 // largest component
 const lab=new Int32Array(n).fill(-1),st=new Int32Array(n);let bestL=-1,bestC=0,bestPix=null;
 for(let s=0;s<n;s++){if(!m[s]||lab[s]>=0)continue;let top=0,cnt=0;st[top++]=s;lab[s]=s;const pix=[];
  while(top){const i=st[--top];cnt++;pix.push(i);const x=i%w,y=(i/w)|0;const nb=[x>0?i-1:-1,x<w-1?i+1:-1,y>0?i-w:-1,y<h-1?i+w:-1];for(const j of nb)if(j>=0&&m[j]&&lab[j]<0){lab[j]=s;st[top++]=j;}}
  if(cnt>bestC){bestC=cnt;bestPix=pix;}}
 if(!bestPix||bestC<n*0.08)return null;
 // quad: try rotations, take extreme points in 4 diagonal directions, keep max-area quad
 let bq=null,ba=0;
 for(let deg=0;deg<90;deg+=3){const a=deg*Math.PI/180,c=Math.cos(a),s=Math.sin(a);const ext=[[1e9,0],[-1e9,0],[-1e9,0],[1e9,0]];
  for(const i of bestPix){const x=i%w,y=(i/w)|0,u=x*c+y*s,v=-x*s+y*c,d1=u+v,d2=u-v;
   if(d1<ext[0][0])ext[0]=[d1,i];if(d2>ext[1][0])ext[1]=[d2,i];if(d1>ext[2][0])ext[2]=[d1,i];if(d2<ext[3][0])ext[3]=[d2,i];}
  const q=ext.map(e=>({x:(e[1]%w+.5)/w,y:(((e[1]/w)|0)+.5)/h}));let A=0;for(let k=0;k<4;k++){const a1=q[k],b1=q[(k+1)%4];A+=a1.x*b1.y-b1.x*a1.y;}A=Math.abs(A)/2;if(A>ba){ba=A;bq=q;}}
 const fill=(bestC/n)/ba;
 // order TL,TR,BR,BL
 const cx=bq.reduce((a,p)=>a+p.x,0)/4,cy=bq.reduce((a,p)=>a+p.y,0)/4;let q=bq.slice().sort((a,b)=>Math.atan2(a.y-cy,a.x-cx)-Math.atan2(b.y-cy,b.x-cx));let s0=0;for(let i=1;i<4;i++)if(q[i].x+q[i].y<q[s0].x+q[s0].y)s0=i;q=q.slice(s0).concat(q.slice(0,s0));
 let conf=Math.max(0,Math.min(1,(fill-0.75)/0.2));if(ba>0.92)conf*=0.3;{const xs=bq.map(p=>p.x),ys=bq.map(p=>p.y),e=0.03;const L=xs.some(v=>v<e),R=xs.some(v=>v>1-e),T=ys.some(v=>v<e),B=ys.some(v=>v>1-e);if(L||R||(T&&B&&(L||R))||(L+R+T+B)>=3)conf*=0.3;}if(ba<0.12)conf*=0.3;return {quad:q,confidence:conf,area:ba};
}
function fromCanvasSource(img,max=360){const sc=Math.min(1,max/Math.max(img.width,img.height)),w=Math.max(8,Math.round(img.width*sc)),h=Math.max(8,Math.round(img.height*sc));const c=document.createElement('canvas');c.width=w;c.height=h;const x=c.getContext('2d',{willReadFrequently:true});x.drawImage(img,0,0,w,h);return detect(x.getImageData(0,0,w,h).data,w,h);}
root.A2RDetect={detect,fromCanvasSource};
})(typeof self!=='undefined'?self:this);
