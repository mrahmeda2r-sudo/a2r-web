'use strict';
const CACHE='a2r-web-stage-a-v1';
const FILES=['./','./index.html','./style.css','./app.js','./core.js','./worker.js','./vendor/pdf-lib.min.js','./assets/arabic.ttf','./assets/icon.svg','./assets/icon-192.png','./assets/icon-512.png','./manifest.webmanifest'];
self.addEventListener('install',e=>e.waitUntil(caches.open(CACHE).then(c=>c.addAll(FILES))));
self.addEventListener('activate',e=>e.waitUntil(Promise.all([caches.keys().then(keys=>Promise.all(keys.filter(k=>k.startsWith('a2r-web-stage-a-')&&k!==CACHE).map(k=>caches.delete(k)))),self.clients.claim()])));
self.addEventListener('fetch',e=>{const u=new URL(e.request.url);if(e.request.method!=='GET'||u.origin!==self.location.origin)return;e.respondWith(caches.open(CACHE).then(async c=>{const match=await c.match(e.request,{ignoreSearch:true});if(match)return match;try{return await fetch(e.request);}catch(err){if(e.request.mode==='navigate')return c.match('./index.html');throw err;}}));});
