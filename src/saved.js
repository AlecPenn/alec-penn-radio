// Songs a listener keeps on their own phone, to play with no signal.
// The MP3s live in the browser's Cache Storage (bucket "apr-saved-v1", same one sw.js reads);
// the list of what's saved lives in localStorage so it shows instantly.
import { audioUrl } from "./station.js";

const BUCKET = "apr-saved-v1";
const LIST = "aprSaved";
export const keyOf = (t) => `/saved-audio/${t.ia}/${encodeURIComponent(t.f)}`;

export function listSaved() {
  try { return JSON.parse(localStorage.getItem(LIST) || "[]"); } catch (e) { return []; }
}
function writeList(list) {
  try { localStorage.setItem(LIST, JSON.stringify(list)); } catch (e) {}
  window.dispatchEvent(new Event("apr-saved"));
}
export const isSaved = (t) => listSaved().some((s) => s.key === keyOf(t));
export const supported = () => typeof caches !== "undefined";

// Save one song: download it with a progress callback, keep the MP3 and its cover.
export async function saveSong(t, onProgress = () => {}) {
  const res = await fetch(audioUrl(t));
  if (!res.ok) throw new Error("download failed (" + res.status + ")");
  const total = Number(res.headers.get("content-length")) || 0;
  let blob;
  if (res.body && total) {
    const reader = res.body.getReader(); const parts = []; let got = 0;
    for (;;) {
      const { done, value } = await reader.read();
      if (done) break;
      parts.push(value); got += value.length; onProgress(Math.min(0.99, got / total));
    }
    blob = new Blob(parts, { type: "audio/mpeg" });
  } else {
    blob = new Blob([await res.arrayBuffer()], { type: "audio/mpeg" });
  }
  const cache = await caches.open(BUCKET);
  await cache.put(keyOf(t), new Response(blob, { headers: { "Content-Type": "audio/mpeg", "Content-Length": String(blob.size) } }));
  try { const c = await fetch(t.cover); if (c.ok) await cache.put(t.cover, c); } catch (e) {}
  try { await navigator.storage?.persist?.(); } catch (e) {}  // ask the phone not to clear it
  const entry = { key: keyOf(t), t: t.t, f: t.f, ia: t.ia, genre: t.genre, cover: t.cover, s: t.s, g: t.g, bytes: blob.size, at: Date.now() };
  writeList([entry, ...listSaved().filter((s) => s.key !== entry.key)]);
  onProgress(1);
  return entry;
}

export async function removeSong(entry) {
  try { const cache = await caches.open(BUCKET); await cache.delete(entry.key); } catch (e) {}
  writeList(listSaved().filter((s) => s.key !== entry.key));
}

// A playable link to a saved song, read straight from the phone (no internet needed).
export async function localUrl(entry) {
  const cache = await caches.open(BUCKET);
  const res = await cache.match(entry.key);
  if (!res) return null;
  return URL.createObjectURL(await res.blob());
}

export async function coverUrl(entry) {
  try {
    const res = await (await caches.open(BUCKET)).match(entry.cover);
    if (res) return URL.createObjectURL(await res.blob());
  } catch (e) {}
  return entry.cover;
}

// The list can drift from what's really on the phone (e.g. the phone cleared space); fix it up.
export async function reconcile() {
  if (!supported()) return;
  try {
    const cache = await caches.open(BUCKET);
    const keys = new Set((await cache.keys()).map((r) => new URL(r.url).pathname));
    const list = listSaved();
    const ok = list.filter((s) => keys.has(s.key));
    if (ok.length !== list.length) writeList(ok);
  } catch (e) {}
}

export async function storageInfo() {
  try { const e = await navigator.storage.estimate(); return { used: e.usage || 0, quota: e.quota || 0 }; } catch (e) { return null; }
}
