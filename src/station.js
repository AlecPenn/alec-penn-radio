// APR STATION ENGINE
// Every listener computes the same schedule from the clock, so everyone tuned to a
// channel hears the same song at the same moment — like real radio, no server needed.
// Each channel plays its whole library in a shuffled order before any song repeats;
// the order reshuffles every cycle.

export const AUDIO_BASE = import.meta.env.VITE_AUDIO_BASE || "https://archive.org/download";
const EPOCH = Date.UTC(2026, 0, 1) / 1000; // the station's "day one"

let _data = null;
export async function loadStation() {
  if (_data) return _data;
  const res = await fetch("/station.json");
  const raw = await res.json();
  // a station marked "hidden" is waiting for its songs to finish uploading to archive.org
  const channels = raw.channels.filter((c) => !c.hidden).map((c) => ({
    ...c,
    tracks: c.tracks.map((t, i) => ({ ...t, ia: c.ia, genre: c.name, cover: `/covers/${c.slug}/${t.c ?? i}.webp`, key: `${c.slug}/${i}` })),
  }));
  // "FULL STATION": every channel mixed together
  // Separate stations (like The Revival Series) only play when picked — never in the mix.
  const all = { slug: "all", name: "Full Station", tracks: channels.filter((c) => !c.separate).flatMap((c) => c.tracks) };
  _data = { channels, all, total: all.tracks.length };
  return _data;
}

function hashStr(s) {
  let h = 2166136261;
  for (let i = 0; i < s.length; i++) { h ^= s.charCodeAt(i); h = Math.imul(h, 16777619); }
  return h >>> 0;
}
function rng(seed) { // mulberry32
  return () => {
    seed |= 0; seed = (seed + 0x6d2b79f5) | 0;
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
function order(channel, cycle) {
  const r = rng(hashStr(channel.slug) + cycle * 7919);
  const idx = channel.tracks.map((_, i) => i);
  for (let i = idx.length - 1; i > 0; i--) { const j = Math.floor(r() * (i + 1)); [idx[i], idx[j]] = [idx[j], idx[i]]; }
  return idx;
}
const cache = new Map();
function cycleInfo(channel, cycle) {
  const k = channel.slug + ":" + cycle;
  if (!cache.has(k)) {
    let o = order(channel, cycle);
    if (cycle > 0 && o.length > 1) { // never play the same song twice in a row across cycles
      const prev = order(channel, cycle - 1);
      if (o[0] === prev[prev.length - 1]) [o[0], o[1]] = [o[1], o[0]];
    }
    const starts = []; let acc = 0;
    for (const i of o) { starts.push(acc); acc += channel.tracks[i].s; }
    cache.set(k, { o, starts });
    if (cache.size > 40) cache.delete(cache.keys().next().value);
  }
  return cache.get(k);
}
const total = (ch) => ch._len || (ch._len = ch.tracks.reduce((a, t) => a + t.s, 0));

// What's on air on this channel at time `now` (seconds)?
export function onAir(channel, now = Date.now() / 1000) {
  const L = total(channel);
  const t = now - EPOCH;
  const cycle = Math.floor(t / L);
  const pos = t - cycle * L;
  const { o, starts } = cycleInfo(channel, cycle);
  let lo = 0, hi = o.length - 1;
  while (lo < hi) { const mid = (lo + hi + 1) >> 1; if (starts[mid] <= pos) lo = mid; else hi = mid - 1; }
  const track = channel.tracks[o[lo]];
  const offset = pos - starts[lo];
  const nextIdx = lo + 1 < o.length ? o[lo + 1] : cycleInfo(channel, cycle + 1).o[0];
  return { track, offset, remaining: track.s - offset, next: channel.tracks[nextIdx] };
}

export function audioUrl(track) {
  return `${AUDIO_BASE}/${track.ia}/${encodeURIComponent(track.f)}`;
}

// Turn the per-song loudness correction (dB) into a volume multiplier.
// 3 dB of headroom lets quiet songs come up a little.
export function gainMul(track) {
  return Math.pow(10, ((track.g || 0) - 3) / 20);
}

// Everything scheduled on this channel from `now` for the next `seconds` (for saving ahead).
export function upcoming(channel, now, seconds) {
  const out = []; let t = now; const end = now + seconds; let guard = 0;
  while (t < end && guard++ < 3000) {
    const info = onAir(channel, t);
    out.push({ track: info.track, start: t - info.offset });
    t += info.remaining + 0.01;
  }
  return out;
}

// How long the radio can keep playing from songs already on the phone, starting now (seconds).
export function offlineCoverage(channel, has, now = Date.now() / 1000, limit = 7 * 86400) {
  let t = now, guard = 0;
  while (t < now + limit && guard++ < 20000) {
    const info = onAir(channel, t);
    if (!has(info.track)) return t - now;
    t += info.remaining + 0.01;
  }
  return limit;
}
