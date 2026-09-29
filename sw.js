// 하하 오락실 — 오프라인 저장(서비스 워커). ★ 98-13차
// ㆍ메뉴의 '게임 내려받기' 를 누른 기기에서만 등록됩니다(누르지 않으면 이 파일은 쓰이지 않음).
// ㆍ인터넷이 되면 항상 서버의 최신 index.html 을 먼저 받고(받은 것은 저장해 둠), 안 되면 저장본을 엽니다.
//   → 새 버전을 올리면 다음에 인터넷 될 때 자동으로 바뀝니다. 캐시 이름을 바꿀 필요는 없습니다.
const CACHE = 'haha-offline-v1';
const CORE = ['./', './index.html', './manifest.webmanifest', './icon-192.png', './icon-512.png', './apple-touch-icon.png'];

async function saveCore(){
  const c = await caches.open(CACHE);
  let ok = 0;
  for(const u of CORE){
    try{ const r = await fetch(u, { cache:'no-store' }); if(r.ok){ await c.put(u, r.clone()); ok++; } }catch(e){}
  }
  return ok;
}
self.addEventListener('install', e=>{ self.skipWaiting(); e.waitUntil(saveCore()); });
self.addEventListener('activate', e=>{
  e.waitUntil((async()=>{
    for(const k of await caches.keys()) if(k !== CACHE && k.startsWith('haha-offline')) await caches.delete(k);
    await self.clients.claim();
  })());
});
self.addEventListener('message', e=>{
  if(e.data === 'saveNow'){
    const port = e.ports && e.ports[0];
    saveCore().then(n=>port && port.postMessage({ ok:n >= 2, n }));
  }
});
self.addEventListener('fetch', e=>{
  const req = e.request;
  if(req.method !== 'GET') return;
  const url = new URL(req.url);
  if(url.origin === location.origin){
    // 같은 사이트 — 인터넷 먼저(4초 안에 안 오면 저장본), 받은 것은 저장
    e.respondWith((async()=>{
      const c = await caches.open(CACHE);
      try{
        const r = await Promise.race([ fetch(req), new Promise((_, no)=>setTimeout(()=>no(new Error('timeout')), 4000)) ]);
        if(r && r.ok) c.put(req.mode === 'navigate' ? './index.html' : req, r.clone());
        return r;
      }catch(err){
        return (await c.match(req, { ignoreSearch:true }))
            || (req.mode === 'navigate' ? (await c.match('./index.html')) || (await c.match('./')) : undefined)
            || Response.error();
      }
    })());
  }else if(/fonts\.(googleapis|gstatic)\.com$/.test(url.hostname)){
    // 글꼴 — 저장본을 먼저 보여 주고 뒤에서 새로 받아 둠
    e.respondWith((async()=>{
      const c = await caches.open(CACHE), hit = await c.match(req);
      const net = fetch(req).then(r=>{ if(r && (r.ok || r.type === 'opaque')) c.put(req, r.clone()); return r; }).catch(()=>null);
      return hit || (await net) || Response.error();
    })());
  }
  // 그 밖(가족 기록 클라우드 등)은 손대지 않음 — 인터넷이 없으면 원래처럼 '이 기기에만 저장'으로 동작
});
