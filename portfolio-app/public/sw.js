// 간단한 오프라인 캐시. 시세 함수 호출(/.netlify/functions/)은 항상 네트워크 우선.
const CACHE = "portfolio-v1";
const APP_SHELL = ["/", "/index.html", "/manifest.webmanifest"];

self.addEventListener("install", (e) => {
  e.waitUntil(caches.open(CACHE).then((c) => c.addAll(APP_SHELL)).catch(() => {}));
  self.skipWaiting();
});

self.addEventListener("activate", (e) => {
  e.waitUntil(
    caches.keys().then((keys) => Promise.all(keys.filter((k) => k !== CACHE).map((k) => caches.delete(k))))
  );
  self.clients.claim();
});

self.addEventListener("fetch", (e) => {
  const url = new URL(e.request.url);
  if (e.request.method !== "GET") return;

  // 시세 API는 캐시하지 않고 항상 네트워크
  if (url.pathname.startsWith("/.netlify/functions/")) {
    e.respondWith(fetch(e.request));
    return;
  }

  // 그 외: 캐시 우선, 없으면 네트워크 후 캐시에 저장
  e.respondWith(
    caches.match(e.request).then((cached) => {
      if (cached) return cached;
      return fetch(e.request)
        .then((res) => {
          if (res && res.status === 200 && url.origin === location.origin) {
            const copy = res.clone();
            caches.open(CACHE).then((c) => c.put(e.request, copy));
          }
          return res;
        })
        .catch(() => caches.match("/index.html"));
    })
  );
});
