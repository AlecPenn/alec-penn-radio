// Real-time audio analysis for the visualizers.
// Desktop only: on phones, routing audio through Web Audio can go silent when the
// screen locks, so phones keep the animated (non-reactive) visuals instead.

let ctx = null, analyser = null, wave = null, freq = null, attached = null;
let ok = false;

export const canAnalyse = () => {
  if (typeof window === "undefined") return false;
  const ua = navigator.userAgent || "";
  const ios = /iPad|iPhone|iPod/.test(ua) || (navigator.platform === "MacIntel" && navigator.maxTouchPoints > 1);
  const coarse = window.matchMedia?.("(pointer: coarse)").matches;
  return !!(window.AudioContext || window.webkitAudioContext) && !ios && !coarse;
};

// Route an <audio> element (loaded with crossOrigin="anonymous") through an analyser.
export function attach(audio) {
  try {
    if (!ctx) ctx = new (window.AudioContext || window.webkitAudioContext)();
    if (attached !== audio) {
      const src = ctx.createMediaElementSource(audio);
      analyser = ctx.createAnalyser();
      analyser.fftSize = 2048;
      analyser.smoothingTimeConstant = 0.82;
      src.connect(analyser);
      analyser.connect(ctx.destination);
      wave = new Uint8Array(analyser.fftSize);
      freq = new Uint8Array(analyser.frequencyBinCount);
      attached = audio;
    }
    if (ctx.state === "suspended") ctx.resume();
    ok = true;
  } catch (e) { ok = false; }
  return ok;
}
export function resume() { if (ctx && ctx.state === "suspended") ctx.resume(); }
export function detach() { ok = false; }

export const live = () => ok && !!analyser;

// waveform: Uint8Array of samples centred on 128
export function getWave() { if (!live()) return null; analyser.getByteTimeDomainData(wave); return wave; }

// n bands from bass to treble, each 0..1 (log-spaced)
export function getBands(n) {
  if (!live()) return null;
  analyser.getByteFrequencyData(freq);
  const out = new Array(n), bins = freq.length, lo = 2, hi = Math.floor(bins * 0.7);
  for (let i = 0; i < n; i++) {
    const a = Math.floor(lo * Math.pow(hi / lo, i / n)), b = Math.max(a + 1, Math.floor(lo * Math.pow(hi / lo, (i + 1) / n)));
    let s = 0; for (let k = a; k < b; k++) s += freq[k];
    out[i] = s / (b - a) / 255;
  }
  return out;
}

// overall bass energy 0..1 (for lights / pulses)
export function getBass() {
  if (!live()) return 0;
  analyser.getByteFrequencyData(freq);
  let s = 0; for (let k = 1; k < 12; k++) s += freq[k];
  return s / 11 / 255;
}
