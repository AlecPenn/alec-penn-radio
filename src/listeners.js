// Client side of the real listener count (see /api/listeners.js).
let id = null;
try { id = sessionStorage.getItem("aprListenerId"); } catch (e) {}
if (!id) { id = Math.random().toString(36).slice(2) + Date.now().toString(36); try { sessionStorage.setItem("aprListenerId", id); } catch (e) {} }

let count = null, timer = null;
const subs = new Set();
const emit = () => subs.forEach((f) => f(count));
async function call(method) {
  try {
    const r = await fetch(`/api/listeners?id=${id}`, { method, keepalive: method === "DELETE" });
    if (!r.ok) return;
    const j = await r.json();
    count = typeof j.count === "number" ? j.count : null; emit();
  } catch (e) {}
}
export function setListening(on) {
  clearInterval(timer); timer = null;
  if (on) { call("POST"); timer = setInterval(() => call("POST"), 30000); }
  else { call("DELETE"); }
}
export function subscribe(fn) { subs.add(fn); fn(count); return () => subs.delete(fn); }
if (typeof window !== "undefined") window.addEventListener("pagehide", () => { if (timer) call("DELETE"); });
