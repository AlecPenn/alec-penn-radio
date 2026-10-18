// Alec Penn Radio — offline support.
// 1. Keeps a copy of the app itself so it opens with no signal.
// 2. Serves songs the listener saved (stored under /saved-audio/...) straight from the phone.
const APP = "apr-app-v2";        // the app's own files
const SAVED = "apr-saved-v1";    // songs + covers the listener chose to keep (never auto-deleted)
const ART = "apr-art-v1";        // covers and fonts seen while browsing

self.addEventListener("install", (e) => {
  e.waitUntil((async () => {
    const cache = await caches.open(APP);
    const res = await fetch("/", { cache: "no-store" });
    const html = await res.clone().text();
    await cache.put("/", res);
    // cache every script/style the page loads so the app can start offline
    const assets = [...html.matchAll(/(?:src|href)="(\/assets\/[^"]+)"/g)].map((m) => m[1]);
    await cache.addAll([...new Set(["/station.json", "/favicon.svg", "/manifest.webmanifest", "/icons/icon-192.png", ...assets])]);
    self.skipWaiting();
  })());
});

self.addEventListener("activate", (e) => {
  e.waitUntil((async () => {
    for (const k of await caches.keys()) if (![APP, SAVED, ART].includes(k)) await caches.delete(k);
    await self.clients.claim();
  })());
});

async function savedSong(req) {
  const url = new URL(req.url);
  const cache = await caches.open(SAVED);
  const res = await cache.match(url.pathname);
  if (!res) return new Response("Not saved on this device", { status: 404 });
  const range = req.headers.get("range");
  if (!range) return res;
  // iPhones ask for audio in pieces ("range requests"); answer with just that piece
  const buf = await res.arrayBuffer();
  const size = buf.byteLength;
  const m = /bytes=(\d*)-(\d*)/.exec(range) || [];
  let start = m[1] ? parseInt(m[1], 10) : 0;
  let end = m[2] ? parseInt(m[2], 10) : size - 1;
  if (!m[1] && m[2]) { start = size - parseInt(m[2], 10); end = size - 1; }
  end = Math.min(end, size - 1);
  return new Response(buf.slice(start, end + 1), {
    status: 206,
    headers: { "Content-Type": "audio/mpeg", "Content-Range": `bytes ${start}-${end}/${size}`, "Content-Length": String(end - start + 1), "Accept-Ranges": "bytes" },
  });
}

async function networkFirst(req, cacheName, key) {
  const cache = await caches.open(cacheName);
  try {
    const res = await fetch(req);
    if (res.ok) cache.put(key || req, res.clone());
    return res;
  } catch (e) {
    const hit = await cache.match(key || req);
    if (hit) return hit;
    throw e;
  }
}

async function cacheFirst(req, cacheName) {
  const hit = (await caches.match(req));
  if (hit) return hit;
  const res = await fetch(req);
  if (res.ok || res.type === "opaque") (await caches.open(cacheName)).put(req, res.clone());
  return res;
}

self.addEventListener("fetch", (e) => {
  const req = e.request;
  if (req.method !== "GET") return;
  const url = new URL(req.url);
  if (url.origin === location.origin) {
    if (url.pathname.startsWith("/saved-audio/")) return e.respondWith(savedSong(req));
    if (req.mode === "navigate") {
      if (/\.html?$/.test(url.pathname) && url.pathname !== "/index.html") return;   // stand-alone pages (e.g. /soundtest.html): leave alone
      return e.respondWith(networkFirst(req, APP, "/"));   // every app page is the same app
    }
    if (url.pathname === "/station.json") return e.respondWith(networkFirst(req, APP));
    if (url.pathname.startsWith("/assets/") || url.pathname.startsWith("/icons/")) return e.respondWith(cacheFirst(req, APP));
    if (url.pathname.startsWith("/covers/")) return e.respondWith(cacheFirst(req, ART));
    return;
  }
  if (url.hostname === "fonts.googleapis.com" || url.hostname === "fonts.gstatic.com") return e.respondWith(cacheFirst(req, ART));
  // everything else (the live radio from archive.org, YouTube, analytics) goes straight to the internet
});
