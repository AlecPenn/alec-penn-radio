import { useState, useEffect, useRef, useMemo, useCallback } from "react";
import { loadStation } from "./station.js";
import { listSaved, saveSong, removeSong, localUrl, reconcile, storageInfo, keyOf, supported } from "./saved.js";

const C = { black:"#0A0806", panel:"#141008", line:"#9E7F3533", gold:"#C2A24D", warm:"#D4B96A", pale:"#EBD9A0",
  teal:"#2F6F6D", sage:"#5E9E9C", cream:"#F4F1EC", rose:"#C49AAA", burg:"#5B2A3C" };
const mono = "'JetBrains Mono', ui-monospace, monospace", bebas = "'Bebas Neue', Impact, sans-serif";
const fmt = (s) => { s = Math.max(0, Math.floor(s || 0)); return Math.floor(s / 60) + ":" + String(s % 60).padStart(2, "0"); };
const mb = (b) => b >= 1e9 ? (b / 1e9).toFixed(1) + " GB" : b >= 1e6 ? Math.round(b / 1e6) + " MB" : Math.max(1, Math.round(b / 1e3)) + " KB";
const PAGE = 60;

function Seal({ size = 32 }) {
  return (
    <svg viewBox="0 0 1000 1000" width={size} height={size} aria-hidden="true" style={{ display: "block", flex: "none" }}>
      <circle cx="500" cy="500" r="440" fill="none" stroke={C.gold} strokeWidth="44" />
      <path d="M 104 500 C 170 500, 210 340, 280 340 C 350 340, 390 660, 500 660 C 610 660, 650 340, 720 340 C 790 340, 830 500, 896 500" fill="none" stroke={C.gold} strokeWidth="44" strokeLinecap="round" />
    </svg>
  );
}

const btn = (extra = {}) => ({ fontFamily: mono, fontSize: 14, fontWeight: 700, letterSpacing: "0.06em", minHeight: 44, padding: "0 16px",
  borderRadius: 8, cursor: "pointer", border: `1px solid ${C.gold}66`, background: "transparent", color: C.warm, ...extra });

export default function Saved() {
  const [online, setOnline] = useState(navigator.onLine);
  const [tab, setTab] = useState(() => (listSaved().length ? "saved" : "find"));
  const [saved, setSaved] = useState(listSaved);
  const [all, setAll] = useState([]);
  const [stations, setStations] = useState([]);
  const [q, setQ] = useState("");
  const [station, setStation] = useState("all");
  const [shown, setShown] = useState(PAGE);
  const [busy, setBusy] = useState({});          // key -> progress 0..1, or "err"
  const [store, setStore] = useState(null);
  const [confirm, setConfirm] = useState(null);
  const [installEvt, setInstallEvt] = useState(null);
  const standalone = window.matchMedia?.("(display-mode: standalone)").matches || navigator.standalone;
  const ios = /iphone|ipad|ipod/i.test(navigator.userAgent);

  // player
  const audio = useRef(null);
  const [queue, setQueue] = useState([]);
  const [idx, setIdx] = useState(-1);
  const [playing, setPlaying] = useState(false);
  const [time, setTime] = useState([0, 0]);
  const [shuffle, setShuffle] = useState(false);
  const urlRef = useRef(null);
  const current = idx >= 0 ? queue[idx] : null;

  useEffect(() => {
    const on = () => setOnline(true), off = () => setOnline(false);
    const upd = () => { setSaved(listSaved()); storageInfo().then(setStore); };
    const inst = (e) => { e.preventDefault(); setInstallEvt(e); };
    window.addEventListener("online", on); window.addEventListener("offline", off);
    window.addEventListener("apr-saved", upd); window.addEventListener("beforeinstallprompt", inst);
    reconcile().then(upd);
    loadStation().then((d) => {
      setStations(d.channels.map((c) => ({ slug: c.slug, name: c.name })));
      setAll(d.channels.flatMap((c) => c.tracks).sort((a, b) => a.t.localeCompare(b.t)));
    }).catch(() => {});
    return () => { window.removeEventListener("online", on); window.removeEventListener("offline", off);
      window.removeEventListener("apr-saved", upd); window.removeEventListener("beforeinstallprompt", inst); };
  }, []);

  const savedKeys = useMemo(() => new Set(saved.map((s) => s.key)), [saved]);
  const results = useMemo(() => {
    const ql = q.trim().toLowerCase();
    return all.filter((t) => (station === "all" || t.key.startsWith(station + "/")) && (!ql || t.t.toLowerCase().includes(ql)));
  }, [all, q, station]);

  const save = async (t) => {
    const k = keyOf(t);
    setBusy((b) => ({ ...b, [k]: 0 }));
    try {
      await saveSong(t, (p) => setBusy((b) => ({ ...b, [k]: p })));
      setBusy((b) => { const n = { ...b }; delete n[k]; return n; });
    } catch (e) {
      setBusy((b) => ({ ...b, [k]: "err" }));
    }
  };

  const playAt = useCallback(async (list, i) => {
    const entry = list[i]; if (!entry) return;
    const url = await localUrl(entry);
    if (!url) { reconcile(); return; }
    if (urlRef.current) URL.revokeObjectURL(urlRef.current);
    urlRef.current = url;
    setQueue(list); setIdx(i);
    const a = audio.current; a.src = url; a.volume = Math.min(1, Math.pow(10, ((entry.g || 0) - 3) / 20));
    a.play().catch(() => {});
    if ("mediaSession" in navigator) {
      navigator.mediaSession.metadata = new window.MediaMetadata({ title: entry.t, artist: "Alec Penn Radio", album: entry.genre,
        artwork: [{ src: entry.cover, sizes: "320x320", type: "image/webp" }] });
    }
  }, []);

  const order = (list) => {
    if (!shuffle) return list;
    const a = list.slice();
    for (let i = a.length - 1; i > 0; i--) { const j = Math.floor(Math.random() * (i + 1)); [a[i], a[j]] = [a[j], a[i]]; }
    return a;
  };
  const next = useCallback(() => { if (queue.length) playAt(queue, (idx + 1) % queue.length); }, [queue, idx, playAt]);
  const prev = useCallback(() => {
    const a = audio.current;
    if (a.currentTime > 4) { a.currentTime = 0; return; }
    if (queue.length) playAt(queue, (idx - 1 + queue.length) % queue.length);
  }, [queue, idx, playAt]);
  const toggle = () => { const a = audio.current; if (!current) { if (saved.length) playAt(order(saved), 0); return; } a.paused ? a.play() : a.pause(); };

  useEffect(() => {
    if (!("mediaSession" in navigator)) return;
    navigator.mediaSession.setActionHandler("nexttrack", next);
    navigator.mediaSession.setActionHandler("previoustrack", prev);
  }, [next, prev]);

  const header = (
    <header style={{ position: "sticky", top: 0, zIndex: 5, background: `${C.black}f2`, backdropFilter: "blur(12px)", borderBottom: `1px solid ${C.line}`,
      padding: "calc(10px + env(safe-area-inset-top)) 16px 10px", display: "flex", alignItems: "center", gap: 12 }}>
      <a href="/" style={{ ...btn(), display: "flex", alignItems: "center", textDecoration: "none", padding: "0 12px" }} aria-label="Back to the live radio">← RADIO</a>
      <Seal size={30} />
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ fontFamily: bebas, fontSize: 24, letterSpacing: "0.08em", color: C.cream, lineHeight: 1 }}>SAVED SONGS</div>
        <div style={{ fontFamily: mono, fontSize: 11, letterSpacing: "0.12em", color: online ? C.sage : C.rose }}>{online ? "● ONLINE" : "● NO SIGNAL · PLAYING FROM YOUR PHONE"}</div>
      </div>
    </header>
  );

  if (!supported()) return (
    <div style={{ minHeight: "100vh", background: C.black, color: C.cream, fontFamily: mono }}>{header}
      <p style={{ padding: 24, fontSize: 16, lineHeight: 1.6 }}>This browser can't keep songs offline. Open alecpennradio.com in Safari (iPhone) or Chrome (Android).</p></div>
  );

  const row = (t, entry) => {
    const k = entry ? entry.key : keyOf(t);
    const isOn = current && current.key === k;
    const p = busy[k];
    const has = savedKeys.has(k);
    return (
      <li key={entry ? entry.key : t.key} style={{ display: "grid", gridTemplateColumns: "48px minmax(0,1fr) auto", gap: 12, alignItems: "center", padding: "10px 0", borderBottom: `1px solid ${C.line}` }}>
        <img src={(entry || t).cover} alt="" width="48" height="48" loading="lazy" style={{ borderRadius: 6, display: "block", background: C.panel }} />
        <div style={{ minWidth: 0 }}>
          <div style={{ fontSize: 16, fontWeight: 700, color: isOn ? C.gold : C.cream, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{(entry || t).t}</div>
          <div style={{ fontSize: 12, color: C.sage, marginTop: 2 }}>{(entry || t).genre} · {fmt((entry || t).s)}{entry ? ` · ${mb(entry.bytes)}` : ""}</div>
        </div>
        <div style={{ display: "flex", gap: 8 }}>
          {entry ? (<>
            <button onClick={() => isOn ? toggle() : playAt(saved, saved.indexOf(entry))} aria-label={`Play ${entry.t}`}
              style={btn({ width: 48, padding: 0, fontSize: 16, color: C.black, background: C.gold, border: "none" })}>{isOn && playing ? "❚❚" : "▶"}</button>
            {confirm === k
              ? <button onClick={() => { removeSong(entry); setConfirm(null); }} style={btn({ color: C.cream, background: C.burg, border: "none", fontSize: 12 })}>REMOVE</button>
              : <button onClick={() => setConfirm(k)} aria-label={`Remove ${entry.t} from this phone`} style={btn({ width: 48, padding: 0, fontSize: 18 })}>✕</button>}
          </>) : has ? (
            <span style={{ ...btn({ border: "none", color: C.sage, display: "flex", alignItems: "center", cursor: "default" }) }}>✓ SAVED</span>
          ) : p === "err" ? (
            <button onClick={() => save(t)} style={btn({ color: C.rose, borderColor: C.rose })}>RETRY</button>
          ) : p !== undefined ? (
            <span style={{ ...btn({ display: "flex", alignItems: "center", cursor: "default", minWidth: 96, justifyContent: "center",
              background: `linear-gradient(90deg, ${C.teal} ${Math.round(p * 100)}%, transparent ${Math.round(p * 100)}%)`, color: C.cream }) }}>{Math.round(p * 100)}%</span>
          ) : (
            <button onClick={() => save(t)} disabled={!online} aria-label={`Save ${t.t} to this phone`}
              style={btn({ opacity: online ? 1 : 0.4, minWidth: 96 })}>↓ SAVE</button>
          )}
        </div>
      </li>
    );
  };

  const total = saved.reduce((a, s) => a + (s.bytes || 0), 0);

  return (
    <div style={{ minHeight: "100vh", background: C.black, color: C.cream, fontFamily: mono, paddingBottom: current ? 150 : 40 }}>
      <style>{`@import url('https://fonts.googleapis.com/css2?family=Bebas+Neue&family=JetBrains+Mono:wght@400;700&display=swap');
        body{margin:0;background:${C.black}} button:focus-visible,a:focus-visible,input:focus-visible,select:focus-visible{outline:2px solid ${C.pale};outline-offset:2px}`}</style>
      {header}
      <main style={{ maxWidth: 760, margin: "0 auto", padding: "16px" }}>
        {!standalone && (
          <div style={{ border: `1px solid ${C.gold}55`, borderRadius: 12, padding: 16, marginBottom: 16, background: C.panel, display: "flex", gap: 14, alignItems: "center", flexWrap: "wrap" }}>
            <div style={{ flex: "1 1 260px", fontSize: 14, lineHeight: 1.5 }}>
              <b style={{ color: C.gold }}>Put APR on your home screen.</b>{" "}
              {installEvt ? "One tap and it opens like an app, even with no signal."
                : ios ? "In Safari, tap the Share button, then “Add to Home Screen”."
                : "Open your browser menu and choose “Install app” or “Add to Home screen”."}
            </div>
            {installEvt && <button onClick={async () => { installEvt.prompt(); await installEvt.userChoice; setInstallEvt(null); }} style={btn({ background: C.gold, color: C.black, border: "none" })}>INSTALL APP</button>}
          </div>
        )}

        <div role="tablist" style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8, marginBottom: 16 }}>
          {[["saved", `ON MY PHONE (${saved.length})`], ["find", "FIND SONGS"]].map(([id, label]) => (
            <button key={id} role="tab" aria-selected={tab === id} onClick={() => setTab(id)}
              style={btn({ background: tab === id ? C.gold : "transparent", color: tab === id ? C.black : C.warm, border: `1px solid ${C.gold}66`, fontSize: 13 })}>{label}</button>
          ))}
        </div>

        {tab === "saved" && (
          <section>
            {saved.length ? (<>
              <div style={{ display: "flex", gap: 8, flexWrap: "wrap", alignItems: "center", marginBottom: 8 }}>
                <button onClick={() => playAt(order(saved), 0)} style={btn({ background: C.gold, color: C.black, border: "none" })}>▶ PLAY ALL</button>
                <button onClick={() => setShuffle((s) => !s)} aria-pressed={shuffle} style={btn({ color: shuffle ? C.black : C.warm, background: shuffle ? C.sage : "transparent" })}>⤮ SHUFFLE {shuffle ? "ON" : "OFF"}</button>
                <span style={{ fontSize: 12, color: C.sage, marginLeft: "auto" }}>{saved.length} songs · {mb(total)}{store && store.quota ? ` · ${mb(store.quota - store.used)} free` : ""}</span>
              </div>
              <ul style={{ listStyle: "none", margin: 0, padding: 0 }}>{saved.map((e) => row(null, e))}</ul>
            </>) : (
              <div style={{ textAlign: "center", padding: "48px 16px", lineHeight: 1.6 }}>
                <Seal size={64} />
                <p style={{ fontSize: 16, margin: "18px auto 18px", maxWidth: 380 }}>Nothing saved yet. Save songs here and they’ll play anywhere: the gym basement, a flight, a road trip with no signal.</p>
                <button onClick={() => setTab("find")} style={btn({ background: C.gold, color: C.black, border: "none" })}>FIND SONGS TO SAVE</button>
              </div>
            )}
          </section>
        )}

        {tab === "find" && (
          <section>
            {!online && <p style={{ fontSize: 14, color: C.rose, marginTop: 0 }}>No signal right now. Connect to Wi-Fi or data to save new songs.</p>}
            <div style={{ display: "grid", gridTemplateColumns: "minmax(0,1fr)", gap: 8, marginBottom: 8 }}>
              <label style={{ fontSize: 12, color: C.sage }}>Search all songs
                <input type="search" value={q} onChange={(e) => { setQ(e.target.value); setShown(PAGE); }} placeholder="Song name"
                  style={{ display: "block", width: "100%", boxSizing: "border-box", marginTop: 4, minHeight: 48, fontSize: 17, fontFamily: mono, padding: "0 14px",
                    background: C.panel, color: C.cream, border: `1px solid ${C.gold}55`, borderRadius: 8 }} />
              </label>
              <label style={{ fontSize: 12, color: C.sage }}>Station
                <select value={station} onChange={(e) => { setStation(e.target.value); setShown(PAGE); }}
                  style={{ display: "block", width: "100%", marginTop: 4, minHeight: 48, fontSize: 16, fontFamily: mono, padding: "0 10px",
                    background: C.panel, color: C.cream, border: `1px solid ${C.gold}55`, borderRadius: 8 }}>
                  <option value="all">All stations</option>
                  {stations.map((s) => <option key={s.slug} value={s.slug}>{s.name}</option>)}
                </select>
              </label>
            </div>
            <div style={{ fontSize: 12, color: C.sage, margin: "8px 0" }}>{results.length.toLocaleString()} songs · about 4–5 MB each</div>
            <ul style={{ listStyle: "none", margin: 0, padding: 0 }}>{results.slice(0, shown).map((t) => row(t, null))}</ul>
            {results.length > shown && <button onClick={() => setShown((n) => n + PAGE)} style={btn({ width: "100%", marginTop: 12 })}>SHOW MORE</button>}
          </section>
        )}
      </main>

      <audio ref={audio} onPlay={() => setPlaying(true)} onPause={() => setPlaying(false)} onEnded={next}
        onTimeUpdate={(e) => setTime([e.currentTarget.currentTime, e.currentTarget.duration || 0])} />

      {current && (
        <div style={{ position: "fixed", left: 0, right: 0, bottom: 0, zIndex: 6, background: "#120E08f5", backdropFilter: "blur(12px)", borderTop: `1px solid ${C.gold}66`,
          padding: "10px 16px calc(10px + env(safe-area-inset-bottom))" }}>
          <div style={{ maxWidth: 760, margin: "0 auto", display: "flex", flexDirection: "column", gap: 8 }}>
            <input type="range" min="0" max={time[1] || 0} step="1" value={time[0]} aria-label="Position in song"
              onChange={(e) => { audio.current.currentTime = Number(e.target.value); }} style={{ width: "100%", accentColor: C.gold }} />
            <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
              <img src={current.cover} alt="" width="44" height="44" style={{ borderRadius: 6 }} />
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontSize: 15, fontWeight: 700, color: C.gold, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{current.t}</div>
                <div style={{ fontSize: 11, color: C.sage }}>{fmt(time[0])} / {fmt(time[1])} · {current.genre}</div>
              </div>
              <button onClick={prev} aria-label="Previous song" style={btn({ width: 46, padding: 0 })}>⏮</button>
              <button onClick={toggle} aria-label={playing ? "Pause" : "Play"} style={btn({ width: 52, padding: 0, background: C.gold, color: C.black, border: "none", fontSize: 16 })}>{playing ? "❚❚" : "▶"}</button>
              <button onClick={next} aria-label="Next song" style={btn({ width: 46, padding: 0 })}>⏭</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
