/* Elevate — service worker
 *
 * الهدف: يفتح الموقع على الموبايل حتى مع شبكة ضعيفة أو من غير نت.
 * القاعدة: بيانات الفرص والأعضاء لا تُخزَّن أبدًا — كل طلبات /api/ تمر كما هي.
 * الباقي: الشبكة أولًا، ولو الشبكة وقعت نرجع للنسخة المحفوظة من آخر زيارة.
 */
const CACHE = "elevate-v1";
const SHELL = [
  "/",
  "/site/index.html",
  "/manifest.webmanifest",
  "/icons/icon-192.png",
  "/icons/icon-512.png",
];

self.addEventListener("install", (event) => {
  event.waitUntil(
    caches
      .open(CACHE)
      .then((cache) => Promise.allSettled(SHELL.map((url) => cache.add(url))))
      .then(() => self.skipWaiting()),
  );
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) => Promise.all(keys.filter((k) => k !== CACHE).map((k) => caches.delete(k))))
      .then(() => self.clients.claim()),
  );
});

self.addEventListener("fetch", (event) => {
  const request = event.request;
  if (request.method !== "GET") return;

  const url = new URL(request.url);
  if (url.origin !== self.location.origin) return;
  // البيانات تتغير لحظة بلحظة: لا نخزّن أي نداء على السيرفر.
  if (url.pathname.startsWith("/api/")) return;

  if (request.mode === "navigate") {
    event.respondWith(
      fetch(request)
        .then((response) => {
          const copy = response.clone();
          caches.open(CACHE).then((cache) => cache.put("/", copy));
          return response;
        })
        .catch(() =>
          caches
            .match(request)
            .then(
              (hit) => hit || caches.match("/site/index.html").then((h) => h || caches.match("/")),
            ),
        ),
    );
    return;
  }

  event.respondWith(
    fetch(request)
      .then((response) => {
        if (response && response.ok) {
          const copy = response.clone();
          caches.open(CACHE).then((cache) => cache.put(request, copy));
        }
        return response;
      })
      .catch(() => caches.match(request)),
  );
});
