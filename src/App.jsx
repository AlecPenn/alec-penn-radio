import { useState, useEffect, useRef, useCallback } from "react";
import { getLatestVideos, getTopVideos, getTopShorts, formatViews } from "./youtube.js";
import { loadStation, onAir, audioUrl, gainMul, upcoming, offlineCoverage } from "./station.js";
import zineTexture from "./assets/zine.webp";
import { savedKeys, localUrlFor, keyOf, saveMany, pruneAuto, autoMinutes, setAutoMinutes, supported as offlineSupported } from "./saved.js";
import { canAnalyse, attach as attachAnalyser, resume as resumeAnalyser, detach as detachAnalyser, getWave, getBands, getBass, live as analyserLive } from "./analyser.js";

// ── VIBES: the whole page re-colors from these. "classic" is the original look. ──
const THEMES = {
  classic:{ name:"Classic", c:{
    black:"#0A0806",gold:"#C2A24D",deepGold:"#9E7F35",warmGold:"#D4B96A",
    paleGold:"#EBD9A0",teal:"#2F6F6D",lazyTeal:"#3D7D7B",sageTeal:"#5E9E9C",
    mistTeal:"#A8C9C8",ghostTeal:"#D6EBEA",burgundy:"#5B2A3C",
    deepBurgundy:"#3D1827",roseMaroon:"#884055",dustyRose:"#C49AAA",cream:"#F4F1EC",
    panel:"linear-gradient(180deg,#141008 0%,#0A0806 100%)",panelBar:"#1a1208" }, swatch:["#0A0806","#C2A24D","#5B2A3C"] },
  skyline:{ name:"Skyline", c:{
    black:"#120a2b",gold:"#FFB86B",deepGold:"#C08BFF",warmGold:"#FFD3A1",
    paleGold:"#FFE9F6",teal:"#4F7BFF",lazyTeal:"#6B93FF",sageTeal:"#8ED1FF",
    mistTeal:"#BFE3FF",ghostTeal:"#EAF4FF",burgundy:"#B4317A",
    deepBurgundy:"#3B1760",roseMaroon:"#E0569F",dustyRose:"#FF9DD6",cream:"#FFF7FC",
    panel:"linear-gradient(180deg,rgba(32,16,70,0.78) 0%,rgba(18,10,43,0.86) 100%)",panelBar:"#2a1658" }, swatch:["#3B1760","#FF9DD6","#FFB86B","#8ED1FF"] },
  neon:{ name:"Neon", c:{
    black:"#05010d",gold:"#FF2BD6",deepGold:"#9D4DFF",warmGold:"#FF7AE6",
    paleGold:"#FFD6F8",teal:"#0091B8",lazyTeal:"#00B3E0",sageTeal:"#00F0FF",
    mistTeal:"#7CF8FF",ghostTeal:"#DFFCFF",burgundy:"#5A0FB8",
    deepBurgundy:"#1C0640",roseMaroon:"#FF2E88",dustyRose:"#FF8AD8",cream:"#F6F0FF",
    panel:"linear-gradient(180deg,rgba(14,4,32,0.88) 0%,rgba(5,1,13,0.92) 100%)",panelBar:"#14052e" }, swatch:["#05010d","#FF2BD6","#00F0FF"] },
  graffiti:{ name:"Graffiti", c:{
    black:"#141414",gold:"#FFE600",deepGold:"#FF6A1F",warmGold:"#FFEE70",
    paleGold:"#FFFFFF",teal:"#00A651",lazyTeal:"#00C060",sageTeal:"#3EC1FF",
    mistTeal:"#9BE1FF",ghostTeal:"#E6F7FF",burgundy:"#D7263D",
    deepBurgundy:"#2A2A2A",roseMaroon:"#FF3D8B",dustyRose:"#FF8CBF",cream:"#FAFAFA",
    panel:"linear-gradient(180deg,rgba(28,28,28,0.9) 0%,rgba(18,18,18,0.94) 100%)",panelBar:"#242424" }, swatch:["#141414","#FFE600","#FF3D8B","#3EC1FF"] },
};
THEMES.static={ name:"Static", c:{
    black:"#2a1c21",gold:"#F2AFBF",deepGold:"#B57F8B",warmGold:"#F6CFD7",
    paleGold:"#FFF2E8",teal:"#5E8F8A",lazyTeal:"#74A6A0",sageTeal:"#9CCBC5",
    mistTeal:"#CDE5E1",ghostTeal:"#EEF6F5",burgundy:"#8E4A5A",
    deepBurgundy:"#3a242a",roseMaroon:"#C0687A",dustyRose:"#EAA9B7",cream:"#FBF3EA",
    panel:"linear-gradient(180deg,rgba(46,30,35,0.9) 0%,rgba(34,22,26,0.94) 100%)",panelBar:"#4a2f36" }, swatch:["#F2AFBF","#FBF3EA","#9CCBC5"] };
let C = THEMES.classic.c;
const readTheme=()=>{ try{ const t=localStorage.getItem("aprTheme"); return THEMES[t]?t:"classic"; }catch(e){ return "classic"; } };

const YT = "https://www.youtube.com/@AlecPennRadio";

// Channel look + feel. Songs come from /station.json (built from the APR MP3s library).
const STYLE = {
  "Full Station":      { glow:"#C2A24D", mood:"everything" },
  "Acoustic Folk":     { glow:"#D4B96A", mood:"campfire" },
  "Acoustic Pop":      { glow:"#EBD9A0", mood:"sunlit" },
  "Afrobeats":         { glow:"#C2A24D", mood:"sun-drenched" },
  "Blues":             { glow:"#3D7D7B", mood:"smoky" },
  "Chillstep":         { glow:"#A8C9C8", mood:"weightless" },
  "Experimental Dance":{ glow:"#5E9E9C", mood:"kinetic" },
  "Experimental Pop":  { glow:"#C49AAA", mood:"off-kilter" },
  "Experimental Rap":  { glow:"#884055", mood:"raw" },
  "House":             { glow:"#C2A24D", mood:"electric" },
  "Lo-Fi":             { glow:"#3D7D7B", mood:"late night" },
  "Meditation Zen":    { glow:"#D6EBEA", mood:"still" },
  "Neo-Classical":     { glow:"#A8C9C8", mood:"celestial" },
  "Phonk":             { glow:"#884055", mood:"after dark" },
  "Psychedelic Jazz":  { glow:"#C2A24D", mood:"transcendent" },
  "Slow Jams":         { glow:"#884055", mood:"midnight" },
  "Synthwave":         { glow:"#C49AAA", mood:"neon" },
  "Workout":           { glow:"#D4B96A", mood:"full send" },
  "The Revival Series":{ glow:"#EBD9A0", mood:"uplifted" },
  "YouTube Shorts":{ glow:"#FF5A6E", mood:"quick hits" },
};
const styleOf = (name) => STYLE[name] || { glow:"#C2A24D", mood:"on air" };
let GENRES = [{ name:"Full Station", slug:"all", ...styleOf("Full Station") }];
// Short links for QR codes / posters: alecpennradio.com/gym, /lofi, /workout, ?station=house ...
const STATION_ALIASES = { gym:"workout", fitness:"workout", lift:"workout", study:"lofi", "lo-fi":"lofi", focus:"lofi",
  yoga:"meditation-zen", zen:"meditation-zen", meditation:"meditation-zen", spa:"meditation-zen", jazz:"psychedelic-jazz",
  folk:"acoustic-folk", acoustic:"acoustic-pop", pop:"experimental-pop", rap:"experimental-rap", "hip-hop":"experimental-rap",
  dance:"experimental-dance", classical:"neo-classical", rnb:"slow-jams", afro:"afrobeats", gospel:"revival", church:"revival", radio:"all", full:"all" };
function linkedSlug(){
  try{
    const q=new URLSearchParams(window.location.search).get("station");
    const raw=(q||window.location.pathname.replace(/^\/+|\/+$/g,"")).toLowerCase().trim();
    if(!raw) return null;
    return STATION_ALIASES[raw]||raw;
  }catch(e){ return null; }
}

const EASTER_EGGS = {
  "ALECPENN": { msg:"YOU FOUND THE SIGNAL. WELCOME TO THE INNER CIRCLE.", playlist:"PLmNBbWRYKMij00GHXkVmWKWOkjGHvkZUO" },
  "EDENGATE": { msg:"THE GATE IS OPEN. IT ALWAYS WAS.", playlist:"PLmNBbWRYKMiijl7vg_jK_uV_dG8L6Nruh" },
  "FREEMUSI": { msg:"EVERY SONG. ZERO COST. FOREVER FREE.", playlist:"PLmNBbWRYKMiiqILu7MqJ1lXKOJwvx4f6u" },
  "TOMMY":    { msg:"TOMMY WAS HERE. HE DOESN'T PAY RENT EITHER.", fx:"cat" },
};
// Match a typed code (from the keyboard or the secret-code box). Accepts "FREEMUSIC" too.
function findEgg(text){
  const t=String(text||"").toUpperCase().replace(/[^A-Z]/g,"");
  for(const k of Object.keys(EASTER_EGGS)) if(t.endsWith(k)||t===k+"C") return EASTER_EGGS[k];
  return null;
}
const KONAMI=["ArrowUp","ArrowUp","ArrowDown","ArrowDown","ArrowLeft","ArrowRight","ArrowLeft","ArrowRight","b","a"];

const TICKER_ITEMS = [
  "NOW BROADCASTING · ALEC PENN RADIO · 111.1 IM",
  "EVERY TRACK FREE · ALL YOURS",
  "AI CO-CREATED WITH SUNO · HUMAN VISION · MACHINE SOUL",
  "DOWNLOAD THE FULL LIBRARY AT EDENSGATE.ART",
  "NO GATEKEEPERS · NO PAYWALLS · NO STRINGS",
  "MUSIC MADE TO BE GIVEN AWAY",
  "TUNE IN · TURN UP · STAY FREE",
];

const fmtTime=(s)=>{ s=Math.max(0,Math.floor(s||0)); return Math.floor(s/60)+":"+String(s%60).padStart(2,"0"); };

function useIsMobile() {
  const [m,setM]=useState(window.innerWidth<768);
  useEffect(()=>{const f=()=>setM(window.innerWidth<768);window.addEventListener("resize",f);return()=>window.removeEventListener("resize",f);},[]);
  return m;
}

/* ── WAVE SEAL ── */
function WaveSeal({ size=44, color=C.gold, glow=false }) {
  return (
    <svg viewBox="0 0 1000 1000" width={size} height={size}
      style={{ display:"block",flexShrink:0,filter:glow?`drop-shadow(0 0 10px ${color}88)`:"none",transition:"filter 0.6s" }}>
      <circle cx="500" cy="500" r="440" fill="none" stroke={color} strokeWidth="22"/>
      <circle cx="500" cy="500" r="396" fill="none" stroke={color} strokeWidth="8"/>
      <path d="M 104 500 C 170 500, 210 340, 280 340 C 350 340, 390 660, 500 660 C 610 660, 650 340, 720 340 C 790 340, 830 500, 896 500"
        fill="none" stroke={color} strokeWidth="22" strokeLinecap="round" strokeLinejoin="round"/>
      <circle cx="456" cy="780" r="18" fill={color}/>
      <circle cx="500" cy="780" r="18" fill={color}/>
      <circle cx="544" cy="780" r="18" fill={color}/>
    </svg>
  );
}

/* ── ANIMATED SEAL ── */
function AnimatedSeal({ size=120, color=C.gold, triggered=false }) {
  const [drawn,setDrawn]=useState(false);
  useEffect(()=>{if(!triggered)return;const t=setTimeout(()=>setDrawn(true),300);return()=>clearTimeout(t);},[triggered]);
  const L=900;
  return (
    <svg viewBox="0 0 1000 1000" width={size} height={size} style={{ display:"block",flexShrink:0 }}>
      <circle cx="500" cy="500" r="440" fill="none" stroke={color} strokeWidth="22" style={{ opacity:drawn?1:0,transition:"opacity 0.5s ease 0.2s" }}/>
      <circle cx="500" cy="500" r="396" fill="none" stroke={color} strokeWidth="8" style={{ opacity:drawn?1:0,transition:"opacity 0.4s ease 0.5s" }}/>
      <path d="M 104 500 C 170 500, 210 340, 280 340 C 350 340, 390 660, 500 660 C 610 660, 650 340, 720 340 C 790 340, 830 500, 896 500"
        fill="none" stroke={color} strokeWidth="22" strokeLinecap="round" strokeLinejoin="round"
        strokeDasharray={L} strokeDashoffset={drawn?0:L}
        style={{ transition:drawn?"stroke-dashoffset 1.4s cubic-bezier(0.4,0,0.2,1) 0.6s":"none" }}/>
      {[456,500,544].map((cx,i)=>(
        <circle key={cx} cx={cx} cy="780" r="18" fill={color}
          style={{ opacity:drawn?1:0,transform:drawn?"scale(1)":"scale(0)",transformOrigin:`${cx}px 780px`,
            transition:`opacity 0.3s ease ${1.9+i*0.15}s,transform 0.5s cubic-bezier(0.34,1.56,0.64,1) ${1.9+i*0.15}s` }}/>
      ))}
    </svg>
  );
}

/* ── ARCHIVE RADIO (streams the APR library from archive.org on a shared clock) ── */
function ArchiveRadio({ playing, channel, volume, onTrack, onProgress }) {
  const audioRef=useRef(null);
  const skewRef=useRef(0);        // personal skips push you ahead on the schedule
  const infoRef=useRef(null);
  const volRef=useRef(volume);
  const playingRef=useRef(playing);
  const chanRef=useRef(channel);

  const applyVolume=()=>{
    const a=audioRef.current, info=infoRef.current;
    if(a) a.volume=Math.max(0,Math.min(1,(volRef.current/100)*(info?gainMul(info.track):0.7)));
  };

  const urlRef=useRef(null);
  const tokenRef=useRef(0);
  const tune=useCallback(async()=>{
    const a=audioRef.current, ch=chanRef.current;
    if(!a||!ch||!ch.tracks?.length) return;
    const token=++tokenRef.current;
    const has=savedKeys();
    const now=()=>Date.now()/1000+skewRef.current;
    let info=onAir(ch,now());
    if(info.remaining<2){ skewRef.current+=info.remaining+0.1; info=onAir(ch,now()); }
    if(!navigator.onLine&&!has.has(keyOf(info.track))){
      // No signal and this song isn't on the phone: jump ahead to the next one that is.
      let guard=0;
      while(guard++<600&&!has.has(keyOf(info.track))){ skewRef.current+=info.remaining+0.1; info=onAir(ch,now()); }
      if(!has.has(keyOf(info.track))){ a.pause(); onTrack?.({...info,unavailable:true}); return; }
    }
    infoRef.current=info;
    const local=has.has(keyOf(info.track))?await localUrlFor(info.track):null;  // saved songs play from the phone
    if(token!==tokenRef.current) return;
    if(urlRef.current){ URL.revokeObjectURL(urlRef.current); urlRef.current=null; }
    if(local) urlRef.current=local;
    if(!local&&!navigator.onLine){ a.pause(); onTrack?.({...info,unavailable:true}); return; }
    a.src=local||audioUrl(info.track);
    a.dataset.offset=String(info.offset);
    applyVolume();
    onTrack?.(info);
    if("mediaSession" in navigator){
      try{ navigator.mediaSession.metadata=new window.MediaMetadata({ title:info.track.t, artist:"Alec Penn Radio", album:info.track.genre,
        artwork:[{ src:info.track.cover, sizes:"320x320", type:"image/webp" }] }); }catch(e){}
    }
    if(playingRef.current){
      if(corsModeRef.current){ attachAnalyser(a); resumeAnalyser(); }
      a.play().catch(()=>{});
    }
  },[onTrack]);

  // Real visualizer: load audio "cross-origin" so the browser lets us read the sound.
  // If archive.org ever refuses that, we quietly switch to plain playback (music first).
  const corsModeRef=useRef(canAnalyse());
  const playedOkRef=useRef(false);
  const makeAudio=useCallback((cors)=>{
    const old=audioRef.current; if(old){ old.pause(); old.removeAttribute("src"); old.load(); }
    const a=new Audio(); a.preload="auto"; if(cors) a.crossOrigin="anonymous"; audioRef.current=a;
    a.addEventListener("loadedmetadata",()=>{ const off=parseFloat(a.dataset.offset||"0"); if(off>1&&off<a.duration-2) a.currentTime=off; });
    a.addEventListener("playing",()=>{ playedOkRef.current=true; });
    a.addEventListener("ended",()=>tune());
    a.addEventListener("error",()=>{
      if(corsModeRef.current&&!playedOkRef.current){ // probably blocked from reading the sound: fall back
        corsModeRef.current=false; detachAnalyser(); makeAudio(false); tune(); return;
      }
      const info=infoRef.current; if(!info) return; // a song that won't load: move on to the next one
      setTimeout(()=>{ skewRef.current+=info.remaining+0.1; tune(); },1500);
    });
    a.addEventListener("timeupdate",()=>onProgress?.(a.currentTime,infoRef.current?.track?.s||a.duration||0));
    return a;
  },[]);

  useEffect(()=>{
    makeAudio(corsModeRef.current);
    if("mediaSession" in navigator){ try{ navigator.mediaSession.setActionHandler("nexttrack",()=>window._aprSkip?.()); }catch(e){} }
    return()=>{ const a=audioRef.current; if(a){ a.pause(); a.src=""; } };
  },[]);

  useEffect(()=>{ chanRef.current=channel; skewRef.current=0; if(playingRef.current) tune(); },[channel]);

  useEffect(()=>{
    playingRef.current=playing;
    const a=audioRef.current; if(!a) return;
    if(playing) tune();            // (re)joining always lands you live, like real radio
    else a.pause();
  },[playing]);

  useEffect(()=>{ volRef.current=volume; applyVolume(); },[volume]);

  useEffect(()=>{
    window._aprSkip=()=>{ const info=infoRef.current; if(!info||!playingRef.current) return;
      const a=audioRef.current; const left=(info.track.s)-(a?.currentTime||info.offset);
      skewRef.current+=Math.max(0,left)+0.1; tune(); };
    // spinning the record by hand bends the song like real vinyl: drag slow and it drags, flick it and it races
    window._aprScratch=(v)=>{ const a=audioRef.current; if(!a||!playingRef.current) return;
      try{ a.preservesPitch=false; a.mozPreservesPitch=false; a.webkitPreservesPitch=false; }catch(e){}
      if(v===null){ a.playbackRate=1; return; }
      a.playbackRate=Math.max(0.25,Math.min(2.5,Math.abs(v)/3.49||0.25)); };
  },[tune]);

  return null;
}


/* ── OFFLINE: save the next few hours of a station so the live radio keeps going with no signal ── */
const BYTES_PER_SEC=23000;   // ~180 kbps MP3s
const fmtMB=(b)=>b>=1e9?(b/1e9).toFixed(1)+" GB":Math.max(1,Math.round(b/1e6))+" MB";
const fmtUntil=(sec)=>new Date(Date.now()+sec*1000).toLocaleTimeString([], { hour:"numeric", minute:"2-digit" });
function useOfflineCoverage(channel){
  const [cover,setCover]=useState(0);
  useEffect(()=>{
    if(!channel||!offlineSupported()) return;
    const calc=()=>{ const has=savedKeys(); setCover(offlineCoverage(channel,(t)=>has.has(keyOf(t)))); };
    calc(); const iv=setInterval(calc,30000);
    window.addEventListener("apr-saved",calc);
    return()=>{ clearInterval(iv); window.removeEventListener("apr-saved",calc); };
  },[channel]);
  return cover;
}

// While someone is listening, quietly keep the next stretch of the station saved on the phone,
// so if the signal (or the power) drops, the radio just keeps going. Songs then play from the phone,
// so this costs about the same data as streaming, plus the lead you keep ahead.
function useAutoBuffer(channel, listening){
  const busy=useRef(false), ctrl=useRef(null);
  useEffect(()=>{
    if(!channel||!listening||!offlineSupported()) return;
    let alive=true;
    const run=async()=>{
      const mins=autoMinutes();
      if(!alive||busy.current||!navigator.onLine||mins<=0) return;
      const conn=navigator.connection;
      const lead=conn&&conn.saveData?Math.min(mins,15):mins;      // respect "data saver" phones
      const ahead=upcoming(channel,Date.now()/1000,lead*60).map(u=>u.track);
      busy.current=true; const c=new AbortController(); ctrl.current=c;
      try{ await saveMany(ahead,()=>{},c.signal,"auto"); await pruneAuto(new Set(ahead.map(keyOf))); }catch(e){}
      busy.current=false;
    };
    const t=setTimeout(run,4000);          // let the song start first
    const iv=setInterval(run,90000);       // top up as the schedule moves on
    const on=()=>run(); window.addEventListener("online",on);
    return()=>{ alive=false; clearTimeout(t); clearInterval(iv); window.removeEventListener("online",on); ctrl.current?.abort(); busy.current=false; };
  },[channel,listening]);
}

function OfflineSaver({ channel, name, mobile, glow }){
  const cover=useOfflineCoverage(channel);
  const [auto,setAuto]=useState(autoMinutes);
  const [job,setJob]=useState(null);     // {done,total,bytes,failed,label}
  const ctrl=useRef(null);
  const [online,setOnline]=useState(navigator.onLine);
  useEffect(()=>{const on=()=>setOnline(true),off=()=>setOnline(false);window.addEventListener("online",on);window.addEventListener("offline",off);return()=>{window.removeEventListener("online",on);window.removeEventListener("offline",off);};},[]);
  useEffect(()=>()=>ctrl.current?.abort(),[]);
  if(!channel||!offlineSupported()) return null;
  const isAll=channel.slug==="all";
  const ahead=upcoming(channel,Date.now()/1000,3*3600).map(u=>u.track);
  const has=savedKeys();
  const aheadNeed=ahead.filter(t=>!has.has(keyOf(t)));
  const aheadMB=aheadNeed.reduce((a,t)=>a+t.s*BYTES_PER_SEC,0);
  const allNeed=isAll?[]:channel.tracks.filter(t=>!has.has(keyOf(t)));
  const allMB=allNeed.reduce((a,t)=>a+t.s*BYTES_PER_SEC,0);
  const run=async(tracks,label)=>{
    ctrl.current?.abort(); const c=new AbortController(); ctrl.current=c;
    setJob({done:0,total:tracks.length,bytes:0,failed:0,label});
    try{ await navigator.storage?.persist?.(); }catch(e){}
    const r=await saveMany(tracks,(st)=>setJob({...st,label}),c.signal);
    setJob(c.signal.aborted?null:{...r,label,finished:true});
  };
  const mono="'JetBrains Mono',monospace";
  const btn=(primary)=>({ fontFamily:mono,fontSize:mobile?13:11,fontWeight:700,letterSpacing:"0.08em",minHeight:mobile?46:36,padding:"0 14px",borderRadius:6,cursor:"pointer",
    border:`1px solid ${primary?glow:C.deepGold+"66"}`,background:primary?glow:"transparent",color:primary?C.black:C.warmGold });
  const wholeSaved=!isAll&&allNeed.length===0;
  return (
    <div style={{ marginTop:14,border:`1px solid ${C.deepGold}44`,borderRadius:8,padding:mobile?"12px":"10px 14px",background:`${C.black}aa` }}>
      <div style={{ fontFamily:mono,fontSize:mobile?11:9,color:C.sageTeal,letterSpacing:"0.18em",marginBottom:8 }}>OFFLINE RADIO · {name.toUpperCase()}</div>
      {job&&!job.finished?(
        <div style={{ display:"flex",flexDirection:"column",gap:8 }}>
          <div style={{ fontFamily:mono,fontSize:mobile?13:11,color:C.cream }}>Saving {job.label}: {job.done} / {job.total} songs · {fmtMB(job.bytes)}</div>
          <div style={{ height:8,borderRadius:4,background:`${C.deepGold}33`,overflow:"hidden" }}><div style={{ height:8,width:`${job.total?Math.round(job.done/job.total*100):0}%`,background:glow,transition:"width 0.3s" }}/></div>
          <div style={{ fontFamily:mono,fontSize:mobile?11:9,color:C.deepGold }}>Keep this page open until it finishes. Wi-Fi recommended.</div>
          <button onClick={()=>{ctrl.current?.abort();setJob(null);}} style={{...btn(false),alignSelf:"flex-start"}}>CANCEL</button>
        </div>
      ):(
        <div style={{ display:"flex",flexDirection:"column",gap:10 }}>
          <div style={{ fontFamily:mono,fontSize:mobile?13:11,lineHeight:1.5,color:cover>60?C.paleGold:C.cream }}>
            {wholeSaved?"✓ The whole station is on this phone. It plays live with no signal, any time."
              :cover>=3600?`✓ Ready offline until ${fmtUntil(cover)}. Lose signal and the radio keeps playing, live and in sync.`
              :cover>60?`On this phone until ${fmtUntil(cover)}. Save more to stay covered longer.`
              :auto>0?`Tune in and the next ${auto===60?"hour":"3 hours"} saves itself in the background, so a dropped signal won’t stop the music. Or save ahead now:`
              :"Save the songs coming up next and this station keeps playing live with no signal: planes, basements, road trips."}
            {job?.finished&&job.failed>0&&<span style={{ color:C.dustyRose }}> {job.failed} songs didn’t download; tap save again to retry.</span>}
          </div>
          {!wholeSaved&&(
            <div style={{ display:"flex",gap:8,flexWrap:"wrap" }}>
              <button disabled={!online||aheadNeed.length===0} onClick={()=>run(ahead,"the next 3 hours")} style={{...btn(true),opacity:online&&aheadNeed.length?1:0.45}}>
                {aheadNeed.length?`⬇ SAVE NEXT 3 HOURS · ${fmtMB(aheadMB)}`:"✓ NEXT 3 HOURS SAVED"}
              </button>
              {!isAll&&(
                <button disabled={!online} onClick={()=>run(channel.tracks,"the whole station")} style={{...btn(false),opacity:online?1:0.45}}>
                  ⬇ WHOLE STATION · {allNeed.length} SONGS · {fmtMB(allMB)}
                </button>
              )}
            </div>
          )}
          {!online&&cover<60&&<div style={{ fontFamily:mono,fontSize:mobile?11:9,color:C.dustyRose }}>No signal right now. Save while you’re on Wi-Fi.</div>}
          <div style={{ display:"flex",alignItems:"center",gap:8,flexWrap:"wrap",borderTop:`1px solid ${C.deepGold}33`,paddingTop:10 }}>
            <span style={{ fontFamily:mono,fontSize:mobile?11:9,color:C.sageTeal,letterSpacing:"0.12em",flex:"1 1 160px" }}>AUTO-SAVE AHEAD WHILE YOU LISTEN</span>
            {[[0,"OFF"],[60,"1 HR"],[180,"3 HRS"]].map(([m,l])=>(
              <button key={m} aria-pressed={auto===m} onClick={()=>{ setAutoMinutes(m); setAuto(m); }}
                style={{ ...btn(auto===m), minHeight:mobile?40:30, padding:"0 12px", fontSize:mobile?12:10 }}>{l}</button>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}


/* ── VIBE BACKDROPS (only for the non-classic themes) ── */
function ThemeBackdrop({ theme }){
  if(theme==="classic") return null;
  const layer={ position:"fixed",inset:0,zIndex:-1,pointerEvents:"none",overflow:"hidden" };
  if(theme==="skyline") return (
    <div aria-hidden="true" style={{ ...layer,background:"linear-gradient(180deg,#140b33 0%,#2b1563 30%,#7b2d8f 55%,#e0569f 74%,#ffb86b 90%,#ffd9a0 100%)" }}>
      {[["8%","6%",520,"#ff9dd6"],["55%","2%",620,"#c08bff"],["30%","20%",480,"#8ed1ff"],["70%","26%",560,"#ffb86b"],["-5%","34%",500,"#ffe9f6"]].map(([l,t,w,c],i)=>(
        <div key={i} style={{ position:"absolute",left:l,top:t,width:w,height:w*0.42,borderRadius:"50%",background:`radial-gradient(closest-side,${c}cc,${c}55 60%,transparent)`,filter:"blur(28px)",animation:`cloud-drift ${38+i*9}s ease-in-out ${-i*7}s infinite alternate`,opacity:0.75 }}/>
      ))}
      {Array.from({length:40}).map((_,i)=>(<div key={"s"+i} style={{ position:"absolute",left:`${(i*37)%100}%`,top:`${(i*53)%38}%`,width:2,height:2,borderRadius:2,background:"#fff",opacity:0.5+((i*7)%5)/10,animation:`pulse-dot ${3+(i%5)}s ease-in-out ${i%4}s infinite` }}/>))}
      <svg viewBox="0 0 1200 220" preserveAspectRatio="xMidYMax slice" style={{ position:"absolute",left:0,right:0,bottom:0,width:"100%",height:"34vh" }}>
        <path d="M0 220 V150 H40 V110 H70 V150 H95 V80 H130 V150 H160 V120 H190 V60 H215 V40 H240 V60 H265 V150 H300 V100 H340 V150 H370 V70 H400 V30 H425 V70 H450 V150 H490 V115 H520 V150 H560 V90 H600 V150 H630 V55 H660 V20 H680 V55 H705 V150 H740 V105 H780 V150 H810 V75 H850 V150 H880 V120 H910 V150 H945 V65 H980 V35 H1000 V65 H1030 V150 H1070 V100 H1110 V150 H1140 V125 H1200 V220 Z" fill="#120a2b" opacity="0.92"/>
        {Array.from({length:70}).map((_,i)=>{ const x=50+((i*61)%1110), y=60+((i*29)%85); return <rect key={i} x={x} y={y} width="5" height="7" fill={i%3?"#FFD3A1":"#FF9DD6"} opacity={0.35+((i*13)%6)/10}/>; })}
      </svg>
    </div>
  );
  if(theme==="neon") return (
    <div aria-hidden="true" style={{ ...layer,background:"radial-gradient(ellipse 80% 50% at 50% 0%,#3a0a6e 0%,#0b0220 55%,#05010d 100%)" }}>
      <div style={{ position:"absolute",left:"-50%",right:"-50%",bottom:"-10%",height:"55vh",transform:"perspective(500px) rotateX(62deg)",transformOrigin:"bottom",
        backgroundImage:"linear-gradient(#ff2bd6aa 2px,transparent 2px),linear-gradient(90deg,#00f0ffaa 2px,transparent 2px)",backgroundSize:"70px 70px",animation:"grid-move 3s linear infinite",maskImage:"linear-gradient(transparent,#000 40%)",WebkitMaskImage:"linear-gradient(transparent,#000 40%)" }}/>
      <div style={{ position:"absolute",left:0,right:0,bottom:"45vh",height:3,background:"#ff2bd6",boxShadow:"0 0 18px #ff2bd6,0 0 50px #ff2bd6" }}/>
      <div style={{ position:"absolute",inset:0,backgroundImage:"repeating-linear-gradient(0deg,rgba(255,255,255,0.03) 0 1px,transparent 1px 3px)" }}/>
    </div>
  );
  if(theme==="graffiti") return (
    <div aria-hidden="true" style={{ ...layer,background:"#1c1c1c",backgroundImage:"linear-gradient(#0e0e0e 3px,transparent 3px),linear-gradient(90deg,#0e0e0e 3px,transparent 3px),linear-gradient(90deg,#0e0e0e 3px,transparent 3px)",backgroundSize:"120px 48px,120px 48px,120px 96px",backgroundPosition:"0 0,0 0,60px 48px" }}>
      {[["6%","8%",360,"#FFE600"],["70%","4%",420,"#FF3D8B"],["40%","38%",380,"#3EC1FF"],["-6%","58%",420,"#00C060"],["74%","62%",360,"#FF6A1F"]].map(([l,t,w,c],i)=>(
        <div key={i} style={{ position:"absolute",left:l,top:t,width:w,height:w,borderRadius:"50%",background:`radial-gradient(closest-side,${c}55,${c}22 55%,transparent 72%)`,filter:"blur(6px)" }}/>
      ))}
      {[["12%","#FFE600"],["33%","#FF3D8B"],["58%","#3EC1FF"],["81%","#00C060"]].map(([l,c],i)=>(
        <div key={"d"+i} style={{ position:"absolute",left:l,top:0,width:6,height:`${90+i*40}px`,borderRadius:"0 0 6px 6px",background:c,opacity:0.55,boxShadow:`14px 0 0 -1px ${c}aa, 26px 0 0 -2px ${c}66` }}/>
      ))}
    </div>
  );
  if(theme==="static") return (
    <div aria-hidden="true" style={{ ...layer,backgroundColor:"#3a242a",backgroundImage:`linear-gradient(rgba(42,22,30,0.62),rgba(42,22,30,0.74)),url(${zineTexture})`,backgroundSize:"auto,700px 700px" }}>
      <div style={{ position:"absolute",inset:0,backgroundImage:"repeating-linear-gradient(0deg,rgba(0,0,0,0.06) 0 1px,transparent 1px 3px)" }}/>
      <CrtTv style={{ left:"2%",bottom:"4%",width:150 }}/>
      <CrtTv style={{ left:"2%",bottom:"calc(4% + 128px)",width:130 }} tilt={-3}/>
      <CrtTv style={{ right:"2%",top:"18%",width:140 }} tilt={4}/>
    </div>
  );
  return null;
}

// An old TV playing live static (the "Static" vibe). Hidden on phones to keep the screen clear.
function CrtTv({ style, tilt=2 }){
  const ref=useRef(null);
  useEffect(()=>{
    const cv=ref.current; if(!cv) return; const ctx=cv.getContext("2d"); const img=ctx.createImageData(cv.width,cv.height);
    if(window.matchMedia?.("(prefers-reduced-motion: reduce)").matches){ for(let i=0;i<img.data.length;i+=4){ const v=Math.random()*255; img.data[i]=v*0.8;img.data[i+1]=v;img.data[i+2]=v;img.data[i+3]=255; } ctx.putImageData(img,0,0); return; }
    let raf, last=0;
    const draw=(t)=>{ raf=requestAnimationFrame(draw); if(t-last<70) return; last=t;
      for(let i=0;i<img.data.length;i+=4){ const v=Math.random()*255; img.data[i]=v*0.75; img.data[i+1]=v*0.98; img.data[i+2]=v; img.data[i+3]=255; }
      ctx.putImageData(img,0,0); };
    raf=requestAnimationFrame(draw); return()=>cancelAnimationFrame(raf);
  },[]);
  return (
    <div className="apr-tv" style={{ position:"absolute",padding:"10px 10px 16px",borderRadius:14,transform:`rotate(${tilt}deg)`,
      backgroundImage:`linear-gradient(rgba(242,175,191,0.35),rgba(242,175,191,0.35)),url(${zineTexture})`,backgroundSize:"auto,300px",boxShadow:"0 10px 30px rgba(0,0,0,0.45)",...style }}>
      <canvas ref={ref} width="80" height="60" style={{ width:"100%",aspectRatio:"4 / 3",display:"block",borderRadius:"14px / 18px",imageRendering:"pixelated",boxShadow:"inset 0 0 18px rgba(0,0,0,0.8)",background:"#222" }}/>
    </div>
  );
}

function VibePicker({ theme, setTheme, mobile }){
  const [open,setOpen]=useState(false);
  const mono="'JetBrains Mono',monospace";
  const chips=(
    <div role="radiogroup" aria-label="Page style" style={{ display:"flex",gap:8,flexWrap:"wrap" }}>
      {Object.entries(THEMES).map(([k,t])=>(
        <button key={k} role="radio" aria-checked={theme===k} onClick={()=>{ setTheme(k); setOpen(false); }}
          style={{ display:"flex",alignItems:"center",gap:8,minHeight:mobile?44:34,padding:"0 12px",borderRadius:999,cursor:"pointer",fontFamily:mono,fontSize:mobile?12:11,letterSpacing:"0.08em",
            background:theme===k?C.gold:"transparent",color:theme===k?C.black:C.warmGold,border:`1px solid ${theme===k?C.gold:C.deepGold+"66"}` }}>
          <span style={{ display:"flex" }}>{t.swatch.map((c,i)=><span key={i} style={{ width:10,height:10,borderRadius:"50%",background:c,border:"1px solid #ffffff55",marginLeft:i?-3:0 }}/>)}</span>
          {t.name.toUpperCase()}
        </button>
      ))}
    </div>
  );
  if(mobile) return chips;
  return (
    <div style={{ position:"relative" }}>
      <button onClick={()=>setOpen(o=>!o)} aria-expanded={open} className="nav-link" style={{ background:"transparent",border:`1px solid ${C.deepGold}55`,borderRadius:4,padding:"4px 10px",cursor:"pointer" }}>◐ Vibe</button>
      {open&&<div style={{ position:"absolute",right:0,top:"calc(100% + 10px)",zIndex:60,background:`${C.black}f5`,border:`1px solid ${C.deepGold}55`,borderRadius:10,padding:12,width:420,backdropFilter:"blur(10px)" }}>{chips}</div>}
    </div>
  );
}

/* ── PARTICLES ── */
function ParticleField({ active, glowColor }) {
  const canvasRef=useRef(null);
  const animRef=useRef(null);
  const colorRef=useRef(glowColor);
  useEffect(()=>{colorRef.current=glowColor;},[glowColor]);
  useEffect(()=>{
    const canvas=canvasRef.current;
    if(!canvas) return;
    const ctx=canvas.getContext("2d");
    const W=canvas.offsetWidth||800,H=canvas.offsetHeight||400;
    canvas.width=W;canvas.height=H;
    const pts=Array.from({length:50},()=>({
      x:Math.random()*W,y:Math.random()*H,
      vx:(Math.random()-0.5)*0.3,vy:(Math.random()-0.5)*0.3,
      size:Math.random()*1.6+0.3,opacity:Math.random()*0.4+0.05,
      color:[C.gold,C.sageTeal,C.dustyRose][Math.floor(Math.random()*3)],
    }));
    const tick=()=>{
      ctx.clearRect(0,0,W,H);
      pts.forEach(p=>{
        p.x+=p.vx*(active?2.5:0.5);p.y+=p.vy*(active?2.5:0.5);
        if(p.x<0)p.x=W;if(p.x>W)p.x=0;if(p.y<0)p.y=H;if(p.y>H)p.y=0;
        ctx.beginPath();ctx.arc(p.x,p.y,p.size,0,Math.PI*2);
        ctx.fillStyle=p.color+Math.floor(p.opacity*255).toString(16).padStart(2,"0");
        ctx.fill();
      });
      animRef.current=requestAnimationFrame(tick);
    };
    tick();
    return()=>cancelAnimationFrame(animRef.current);
  },[active]);
  return <canvas ref={canvasRef} style={{ position:"absolute",inset:0,width:"100%",height:"100%",pointerEvents:"none" }}/>;
}

/* ── VU METER (real levels when available) ── */
function VUMeter({ active }) {
  const bars=useRef([]);
  useEffect(()=>{
    let raf; const n=14, cur=new Array(n).fill(0);
    const tick=(now)=>{
      const b=active?getBands(n):null;
      for(let i=0;i<n;i++){
        const target=!active?0:b?Math.pow(b[i],0.8):(0.35+0.35*Math.sin(now/(160+i*30)+i));
        cur[i]+=(target-cur[i])*(target>cur[i]?0.5:0.12);
        const el=bars.current[i]; if(el) el.style.height=`${4+cur[i]*30}px`;
      }
      raf=requestAnimationFrame(tick);
    };
    raf=requestAnimationFrame(tick); return()=>cancelAnimationFrame(raf);
  },[active]);
  return (
    <div style={{ display:"flex",alignItems:"flex-end",gap:3,height:36 }}>
      {Array.from({length:14}).map((_,i)=>(
        <div key={i} ref={el=>bars.current[i]=el} style={{ width:4,height:4,borderRadius:2,background:i<8?C.teal:i<11?C.gold:C.roseMaroon }}/>
      ))}
    </div>
  );
}

/* ── SONG CARD: tap the record and its sleeve flips over to show what's playing ── */
function SongCard({ song, glow, mobile, onClose }) {
  const [flip,setFlip]=useState(false);
  useEffect(()=>{ const t=setTimeout(()=>setFlip(true),550); return()=>clearTimeout(t); },[song.t]);
  const W=mobile?210:230;
  const face={ position:"absolute",inset:0,backfaceVisibility:"hidden",WebkitBackfaceVisibility:"hidden",borderRadius:6,overflow:"hidden",boxShadow:`0 18px 50px #000c, 0 0 0 1px ${glow}55, 0 0 34px ${glow}33` };
  return (
    <div onClick={onClose} style={{ position:"absolute",inset:0,display:"flex",alignItems:"center",justifyContent:"center",background:"radial-gradient(circle, #0008 0%, #0000 70%)",zIndex:3,perspective:900,animation:"sc-in .45s cubic-bezier(.2,.9,.3,1.2)" }}>
      <style>{"@keyframes sc-in{from{opacity:0;transform:translateY(40px) scale(.85)}to{opacity:1;transform:none}}"}</style>
      <div onClick={e=>e.stopPropagation()} style={{ position:"relative",width:W,height:W,transformStyle:"preserve-3d",transition:"transform .8s cubic-bezier(.3,1.3,.5,1)",transform:flip?"rotateY(180deg)":"rotateY(0deg)",cursor:"pointer" }} onDoubleClick={()=>setFlip(f=>!f)}>
        <div style={{ ...face,background:"#111" }} onClick={()=>setFlip(true)}>
          {song.cover?<img src={song.cover} alt="" style={{ width:"100%",height:"100%",objectFit:"cover",display:"block" }}/>:null}
        </div>
        <div onClick={()=>setFlip(false)} style={{ ...face,transform:"rotateY(180deg)",background:`linear-gradient(160deg,#1a1410 0%,#0c0907 100%)`,border:`1px solid ${glow}66`,padding:mobile?"16px 16px":"18px 18px",display:"flex",flexDirection:"column",boxSizing:"border-box" }}>
          <div style={{ display:"flex",justifyContent:"space-between",alignItems:"center" }}>
            <span style={{ fontFamily:"'JetBrains Mono',monospace",fontSize:9,letterSpacing:"0.18em",color:glow }}>● NOW SPINNING</span>
            <button onClick={onClose} aria-label="Close" style={{ background:"none",border:"none",color:C.deepGold,fontSize:16,cursor:"pointer",padding:0,lineHeight:1 }}>×</button>
          </div>
          <div style={{ fontFamily:"'Bebas Neue',sans-serif",fontSize:song.t.length>22?24:30,lineHeight:0.95,color:C.cream,letterSpacing:"0.03em",marginTop:12,wordBreak:"break-word" }}>{song.t}</div>
          <div style={{ fontFamily:"'JetBrains Mono',monospace",fontSize:10,letterSpacing:"0.14em",color:C.warmGold,marginTop:8,textTransform:"uppercase" }}>{song.station} · 111.1 IM</div>
          <div style={{ fontFamily:"'JetBrains Mono',monospace",fontSize:9,letterSpacing:"0.12em",color:C.deepGold,marginTop:4 }}>ALEC PENN · CC0 · FREE FOREVER</div>
          <div style={{ flex:1 }}/>
          <a href={`https://edensgate.art/?q=${encodeURIComponent(song.t)}`} target="_blank" rel="noreferrer" onClick={e=>e.stopPropagation()}
            style={{ display:"block",textAlign:"center",background:glow,color:C.black,borderRadius:4,padding:"9px 8px",fontFamily:"'JetBrains Mono',monospace",fontSize:10,fontWeight:700,letterSpacing:"0.12em",textDecoration:"none" }}>↓ FREE AT EDEN'S GATE</a>
          <div style={{ fontFamily:"'JetBrains Mono',monospace",fontSize:8,color:C.deepGold+"aa",textAlign:"center",marginTop:7,letterSpacing:"0.1em" }}>TAP THE SLEEVE TO FLIP IT BACK</div>
        </div>
      </div>
    </div>
  );
}

/* ── 3D TURNTABLE ── */
let _webgl=null;
function hasWebGL(){ if(_webgl!==null) return _webgl; try{ const c=document.createElement("canvas"); const gl=window.WebGLRenderingContext&&(c.getContext("webgl2")||c.getContext("webgl")); _webgl=!!gl; gl?.getExtension("WEBGL_lose_context")?.loseContext(); }catch(e){ _webgl=false; } return _webgl; }
function Turntable({ playing, cover, glow, progress, mobile, height, song }) {
  const [card,setCard]=useState(false);
  const songRef=useRef(song); songRef.current=song;
  useEffect(()=>{ if(!card) return; const t=setTimeout(()=>setCard(false),12000); return()=>clearTimeout(t); },[card,song?.t]);
  const canvasRef=useRef(null), ttRef=useRef(null);
  const [failed,setFailed]=useState(()=>!hasWebGL());
  useEffect(()=>{
    if(failed) return; let alive=true;
    import("./turntable.js").then(m=>{
      if(!alive||!canvasRef.current) return;
      try{ ttRef.current=m.createTurntable(canvasRef.current,{ mobile, getBass, getBands, onScratch:(v)=>window._aprScratch?.(v), onTap:()=>{ if(songRef.current) setCard(c=>!c); } });
        ttRef.current.setGlow(glow); ttRef.current.setPlaying(playing); ttRef.current.setVisualizer(vizRef.current); if(cover) ttRef.current.setCover(cover);
      }catch(e){ console.error(e); setFailed(true); }
    }).catch(()=>setFailed(true));
    return()=>{ alive=false; ttRef.current?.dispose(); ttRef.current=null; };
  },[failed]);
  useEffect(()=>{ ttRef.current?.setPlaying(playing); },[playing]);
  useEffect(()=>{ if(cover) ttRef.current?.setCover(cover); },[cover]);
  useEffect(()=>{ ttRef.current?.setGlow(glow); },[glow]);
  const [viz,setViz]=useState(()=>{ try{ return localStorage.getItem("aprViz")!=="0"; }catch(e){ return true; } });
  const vizRef=useRef(viz); vizRef.current=viz;
  useEffect(()=>{ ttRef.current?.setVisualizer(viz); try{ localStorage.setItem("aprViz",viz?"1":"0"); }catch(e){} },[viz]);
  useEffect(()=>{ ttRef.current?.setProgress(progress); },[progress]);
  if(failed) return null;
  return (
    <div style={{ position:"relative",width:"100%" }}>
      <canvas ref={canvasRef} aria-label="Record player showing the song that's playing. Drag the record to spin it, tap it to see the song." style={{ display:"block",width:"100%",height,touchAction:"pan-y" }}/>
      <button onClick={()=>setViz(v=>!v)} aria-pressed={viz} title="Turn the visualizer ring on or off"
        style={{ position:"absolute",top:mobile?8:6,right:mobile?16:8,background:viz?glow+"22":"transparent",border:`1px solid ${viz?glow:C.deepGold+"55"}`,color:viz?glow:C.deepGold,borderRadius:20,padding:mobile?"7px 12px":"4px 10px",fontFamily:"'JetBrains Mono',monospace",fontSize:mobile?10:9,letterSpacing:"0.14em",cursor:"pointer" }}>
        {viz?"◉ VISUALIZER":"○ VISUALIZER"}
      </button>
      {card&&song&&<SongCard song={song} glow={glow} mobile={mobile} onClose={()=>setCard(false)}/>}
    </div>
  );
}

/* ── OSCILLOSCOPE (real waveform when available) ── */
function Oscilloscope({ active, color=C.sageTeal }) {
  const canvasRef=useRef(null);
  const animRef=useRef(null);
  const t=useRef(0);
  useEffect(()=>{
    const canvas=canvasRef.current;if(!canvas)return;
    const ctx=canvas.getContext("2d");const W=canvas.width,H=canvas.height;
    const draw=()=>{
      ctx.clearRect(0,0,W,H);
      ctx.strokeStyle=active?color:C.lazyTeal+"33";ctx.lineWidth=1.5;ctx.shadowBlur=active?8:0;ctx.shadowColor=color;
      ctx.beginPath();
      const w=active?getWave():null;
      if(w){
        // find a rising zero-crossing so the wave stands still instead of jittering
        let st=0; for(let i=1;i<w.length/2;i++){ if(w[i-1]<128&&w[i]>=128){st=i;break;} }
        const span=Math.min(w.length-st,W*3);
        for(let x=0;x<W;x++){ const v=(w[st+Math.floor(x/W*span)]-128)/128; const y=H/2+v*H*0.46; x===0?ctx.moveTo(x,y):ctx.lineTo(x,y); }
      }else{
        for(let x=0;x<W;x++){const amp=active?H*0.36:H*0.03;const y=H/2+amp*(Math.sin(x*0.04+t.current)*0.5+Math.sin(x*0.09+t.current*1.4)*0.3+Math.sin(x*0.02+t.current*0.6)*0.2);x===0?ctx.moveTo(x,y):ctx.lineTo(x,y);}
      }
      ctx.stroke();t.current+=active?0.065:0.008;animRef.current=requestAnimationFrame(draw);
    };
    draw();return()=>cancelAnimationFrame(animRef.current);
  },[active,color]);
  return <canvas ref={canvasRef} width={180} height={44} style={{ display:"block",borderRadius:4,border:`1px solid ${active?color+"44":C.deepGold+"18"}`,background:"#030201",transition:"border-color 0.5s",maxWidth:"100%" }}/>;
}

/* ── VOLUME DIAL ── */
function VolumeDial({ volume, onChange }) {
  const angle=(volume/100)*240-120;
  const handleDrag=useRef(false);
  const startY=useRef(0);
  const startVol=useRef(volume);
  return (
    <div style={{ display:"flex",flexDirection:"column",alignItems:"center",gap:4 }}>
      <div
        style={{ width:44,height:44,borderRadius:"50%",border:`2px solid ${C.deepGold}`,
          background:`radial-gradient(circle at 30% 30%,#2a1f08,${C.black})`,
          position:"relative",cursor:"ns-resize",userSelect:"none",
          boxShadow:`0 0 12px ${C.deepGold}33` }}
        onMouseDown={e=>{handleDrag.current=true;startY.current=e.clientY;startVol.current=volume;}}
        onMouseMove={e=>{ if(!handleDrag.current)return; const delta=(startY.current-e.clientY)*0.8; onChange(Math.min(100,Math.max(0,Math.round(startVol.current+delta)))); }}
        onMouseUp={()=>{handleDrag.current=false;}}
        onMouseLeave={()=>{handleDrag.current=false;}}>
        <div style={{ width:2,height:16,background:C.gold,borderRadius:1,
          transformOrigin:"bottom center",transform:`rotate(${angle}deg)`,
          position:"absolute",bottom:"50%",left:"calc(50% - 1px)" }}/>
        <div style={{ width:5,height:5,borderRadius:"50%",background:C.gold,position:"absolute",bottom:"calc(50% - 2.5px)",left:"calc(50% - 2.5px)" }}/>
      </div>
      <span style={{ fontFamily:"'JetBrains Mono',monospace",fontSize:8,color:C.deepGold,letterSpacing:"0.1em" }}>VOL</span>
    </div>
  );
}

/* ── ALBUM ART ── */
function AlbumArt({ thumb, active }) {
  return (
    <div style={{ width:64,height:64,borderRadius:6,overflow:"hidden",flexShrink:0,
      border:`1px solid ${active?C.deepGold+"66":C.deepGold+"22"}`,
      background:C.deepBurgundy,position:"relative",transition:"border-color 0.5s" }}>
      {thumb?(
        <img src={thumb} alt="Now playing" style={{ width:"100%",height:"100%",objectFit:"cover",
          filter:active?"none":"grayscale(80%) brightness(0.4)",transition:"filter 0.8s" }}/>
      ):(
        <div style={{ width:"100%",height:"100%",display:"flex",alignItems:"center",justifyContent:"center" }}>
          <WaveSeal size={28} color={active?C.deepGold:C.deepGold+"44"}/>
        </div>
      )}
      {active&&thumb&&<div style={{ position:"absolute",inset:0,background:`linear-gradient(135deg,transparent 60%,${C.black}44)` }}/>}
    </div>
  );
}

/* ── BROADCAST TICKER ── */
function BroadcastTicker({ active, nowPlaying }) {
  const items=[...(nowPlaying?[`NOW PLAYING: ${nowPlaying.toUpperCase()}`]:[]),...TICKER_ITEMS];
  const text=items.join("  ·  ")+"  ·  "+items.join("  ·  ");
  return (
    <div style={{ background:`${C.deepBurgundy}66`,borderTop:`1px solid ${C.deepGold}22`,
      padding:"6px 0",overflow:"hidden",position:"relative" }}>
      <div style={{ display:"flex",alignItems:"center",gap:0,whiteSpace:"nowrap",
        animation:active?"ticker-scroll 40s linear infinite":"none",
        color:active?C.warmGold:C.deepGold+"55",
        fontFamily:"'JetBrains Mono',monospace",fontSize:9,letterSpacing:"0.12em" }}>
        {text}
      </div>
    </div>
  );
}

/* ── EASTER EGG DISPLAY ── */
// Tommy in 3D (black cat, wizard hat) trots along the bottom of the screen. Falls back to the emoji if 3D can't run.
function TommyCat({ onDone }){
  const ref=useRef(null); const [flat,setFlat]=useState(false);
  useEffect(()=>{
    let stop=null, gone=false;
    import("./tommy3d.js").then(m=>{ if(gone) return; try{ stop=m.tommyAppears(ref.current,{ calm:!!window.matchMedia?.("(prefers-reduced-motion: reduce)").matches, onDone:(e)=>{ if(e) setFlat(true); else onDone?.(); } }); }catch(e){ setFlat(true); } }).catch(()=>setFlat(true));
    return()=>{ gone=true; stop?.(); };
  },[]);
  useEffect(()=>{ if(!flat) return; const t=setTimeout(()=>onDone?.(),6500); return()=>clearTimeout(t); },[flat]);
  if(flat) return <div aria-hidden="true" style={{ position:"fixed",bottom:18,left:0,zIndex:499,fontSize:54,pointerEvents:"none",filter:"brightness(0) drop-shadow(0 0 6px #c2a24d)",animation:"cat-walk 6s linear forwards" }}>🐈</div>;
  return <canvas ref={ref} aria-hidden="true" style={{ position:"fixed",left:0,bottom:0,width:"100vw",height:"min(34vh,280px)",zIndex:499,pointerEvents:"none" }}/>;
}
function EasterEggMsg({ egg, onClose }) {
  const { msg, playlist, fx }=egg;
  useEffect(()=>{const t=setTimeout(onClose,playlist?9000:fx==="cat"?30000:6000);return()=>clearTimeout(t);},[]);
  return (
    <>
    {fx==="cat"&&<TommyCat onDone={onClose}/>}
    {(fx==="sparkle"||fx==="burst")&&<div aria-hidden="true" style={{ position:"fixed",inset:0,zIndex:499,pointerEvents:"none",overflow:"hidden" }}>
      {Array.from({length:28}).map((_,i)=>{ const a=i/28*Math.PI*2, d=180+(i%5)*50;
        return <span key={i} style={{ position:"absolute",left:"50%",top:"50%",fontSize:14+(i%4)*6,color:i%3?C.gold:C.cream,"--dx":`${Math.cos(a)*d}px`,"--dy":`${Math.sin(a)*d}px`,animation:`egg-burst ${1.4+(i%3)*0.4}s ease-out forwards` }}>{fx==="sparkle"?"✦":"★"}</span>; })}
    </div>}
    <div role="dialog" onClick={onClose} style={{ cursor:"pointer", position:"fixed",top:"50%",left:"50%",transform:"translate(-50%,-50%)",
      zIndex:500,background:`${C.black}ee`,border:`1px solid ${C.gold}`,borderRadius:12,
      padding:"24px 32px",textAlign:"center",maxWidth:360,
      boxShadow:`0 0 60px ${C.gold}44`,animation:"float-in 0.4s ease" }}>
      <WaveSeal size={48} color={C.gold} glow={true}/>
      <div style={{ fontFamily:"'JetBrains Mono',monospace",fontSize:11,color:C.gold,
        letterSpacing:"0.14em",marginTop:16,lineHeight:1.8 }}>{msg}</div>
      {playlist&&<a href={`https://www.youtube.com/playlist?list=${playlist}`} target="_blank" rel="noreferrer" onClick={e=>e.stopPropagation()}
        style={{ display:"inline-block",marginTop:14,padding:"9px 16px",borderRadius:6,background:C.burgundy,color:C.cream,textDecoration:"none",fontFamily:"'JetBrains Mono',monospace",fontSize:11,letterSpacing:"0.1em",border:`1px solid ${C.roseMaroon}` }}>▶ OPEN THE SECRET PLAYLIST</a>}
      <div style={{ fontFamily:"'JetBrains Mono',monospace",fontSize:9,color:C.deepGold,marginTop:12 }}>
        — TAP TO CLOSE —
      </div>
    </div>
    </>
  );
}

/* ── CURSOR ── */
function Cursor() {
  const dot=useRef(null),ring=useRef(null),pos=useRef({x:0,y:0}),trail=useRef({x:0,y:0});
  useEffect(()=>{
    const move=e=>{pos.current={x:e.clientX,y:e.clientY};};
    window.addEventListener("mousemove",move);
    let raf;
    const loop=()=>{
      trail.current.x+=(pos.current.x-trail.current.x)*0.1;
      trail.current.y+=(pos.current.y-trail.current.y)*0.1;
      if(dot.current) dot.current.style.transform=`translate(${pos.current.x-4}px,${pos.current.y-4}px)`;
      if(ring.current) ring.current.style.transform=`translate(${trail.current.x-13}px,${trail.current.y-13}px)`;
      raf=requestAnimationFrame(loop);
    };
    loop();
    return()=>{window.removeEventListener("mousemove",move);cancelAnimationFrame(raf);};
  },[]);
  return (
    <>
      <div ref={ring} style={{ position:"fixed",top:0,left:0,width:26,height:26,borderRadius:"50%",border:`1px solid ${C.sageTeal}55`,pointerEvents:"none",zIndex:9998,willChange:"transform" }}/>
      <div ref={dot} style={{ position:"fixed",top:0,left:0,width:8,height:8,borderRadius:"50%",background:C.sageTeal,pointerEvents:"none",zIndex:9999,boxShadow:`0 0 6px ${C.sageTeal}`,willChange:"transform" }}/>
    </>
  );
}

function StaticFlash({ show }) {
  if(!show) return null;
  return <div style={{ position:"fixed",inset:0,zIndex:200,pointerEvents:"none",background:`repeating-linear-gradient(0deg,transparent,transparent 2px,rgba(194,162,77,0.04) 2px,rgba(194,162,77,0.04) 4px)`,animation:"static-flash 0.6s ease-out forwards" }}/>;
}

function ChartRow({ item, rank }) {
  const [hov,setHov]=useState(false);
  const videoId=item.id;
  const title=item.snippet?.title||"—";
  const views=formatViews(item.statistics?.viewCount);
  const genre=(item.snippet?.tags||[])[0]||"Music";
  return (
    <div onClick={()=>window.open(`https://youtube.com/watch?v=${videoId}`,"_blank")}
      onMouseEnter={()=>setHov(true)} onMouseLeave={()=>setHov(false)}
      style={{ display:"grid",gridTemplateColumns:"28px 1fr auto auto",alignItems:"center",gap:10,padding:"11px 14px",
        borderBottom:`1px solid ${C.deepBurgundy}44`,cursor:"pointer",background:hov?`${C.deepBurgundy}44`:"transparent",transition:"background 0.15s" }}>
      <span style={{ color:C.deepGold,fontSize:12,fontFamily:"monospace",fontWeight:600 }}>{String(rank).padStart(2,"0")}</span>
      <div style={{ minWidth:0 }}>
        <div style={{ color:C.cream,fontSize:12,overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap" }}>{title}</div>
        <div style={{ color:C.sageTeal,fontSize:10,marginTop:2 }}>{genre}</div>
      </div>
      <span style={{ color:C.dustyRose,fontSize:10 }}>{views}</span>
      <span style={{ color:hov?C.gold:C.deepGold,fontSize:16,transition:"color 0.15s" }}>›</span>
    </div>
  );
}

function ShortCard({ item }) {
  const [hov,setHov]=useState(false);
  return (
    <div onClick={()=>window.open(`https://youtube.com/watch?v=${item.id}`,"_blank")}
      onMouseEnter={()=>setHov(true)} onMouseLeave={()=>setHov(false)}
      style={{ background:`linear-gradient(160deg,${C.deepBurgundy},${C.black})`,border:`1px solid ${hov?C.roseMaroon:C.burgundy+"55"}`,borderRadius:8,padding:"18px 14px",cursor:"pointer",transform:hov?"translateY(-4px)":"translateY(0)",boxShadow:hov?`0 12px 30px ${C.deepBurgundy}99`:"none",transition:"all 0.22s cubic-bezier(0.34,1.56,0.64,1)",display:"flex",flexDirection:"column",gap:8 }}>
      <div style={{ fontSize:20,color:C.roseMaroon }}>▶</div>
      <div style={{ color:C.cream,fontSize:12,fontWeight:500,lineHeight:1.3,overflow:"hidden",textOverflow:"ellipsis",display:"-webkit-box",WebkitLineClamp:2,WebkitBoxOrient:"vertical" }}>{item.snippet?.title||"—"}</div>
      <div style={{ display:"flex",alignItems:"center",gap:6 }}>
        <span style={{ color:C.gold,fontSize:11 }}>♥</span>
        <span style={{ color:C.dustyRose,fontSize:11 }}>{formatViews(item.statistics?.likeCount)}</span>
      </div>
    </div>
  );
}

function FrequencyDial({ genre, onChange }) {
  const idx=GENRES.findIndex(g=>g.name===genre);
  const angle=(Math.max(0,idx)/Math.max(1,GENRES.length-1))*180-90;
  return (
    <div style={{ display:"flex",flexDirection:"column",alignItems:"center",gap:8 }}>
      <div style={{ width:60,height:60,borderRadius:"50%",border:`2px solid ${C.gold}`,background:`radial-gradient(circle at 30% 30%,#1a1208,${C.black})`,position:"relative",cursor:"pointer",boxShadow:`0 0 18px ${C.deepGold}55` }}>
        <div style={{ width:2,height:22,background:C.gold,borderRadius:1,transformOrigin:"bottom center",transform:`rotate(${angle}deg)`,position:"absolute",bottom:"50%",left:"calc(50% - 1px)",transition:"transform 0.4s cubic-bezier(0.34,1.56,0.64,1)" }}/>
        <div style={{ width:6,height:6,borderRadius:"50%",background:C.gold,position:"absolute",bottom:"calc(50% - 3px)",left:"calc(50% - 3px)" }}/>
      </div>
      <select value={genre} onChange={e=>onChange(e.target.value)}
        style={{ background:"transparent",border:`1px solid ${C.deepGold}`,color:C.paleGold,fontSize:10,padding:"3px 6px",borderRadius:4,cursor:"pointer",fontFamily:"inherit",letterSpacing:"0.06em" }}>
        {GENRES.map(g=><option key={g.name} value={g.name} style={{ background:C.black }}>{g.name}</option>)}
      </select>
    </div>
  );
}

/* ══════════════════════════════════════
   MAIN
══════════════════════════════════════ */
export default function AlecPennRadio() {
  const [theme,setThemeState]=useState(readTheme);
  C=THEMES[theme].c;   // every part of the page reads its colors from C
  const setTheme=useCallback((t)=>{ setThemeState(t); try{ localStorage.setItem("aprTheme",t); }catch(e){} },[]);
  const mobile=useIsMobile();
  const [tuned,setTuned]=useState(false);
  const [tuning,setTuning]=useState(false);
  const [showStatic,setShowStatic]=useState(false);
  const [station,setStation]=useState(null);
  const [genre,setGenre]=useState(GENRES[0].name);
  const [linked,setLinked]=useState(null);
  const [online,setOnline]=useState(navigator.onLine);
  useEffect(()=>{const on=()=>setOnline(true),off=()=>setOnline(false);window.addEventListener("online",on);window.addEventListener("offline",off);return()=>{window.removeEventListener("online",on);window.removeEventListener("offline",off);};},[]);
  const [activeGlow,setActiveGlow]=useState(GENRES[0].glow);
  const [onAirInfo,setOnAirInfo]=useState(null);
  const [progress,setProgress]=useState([0,0]);
  const [freq,setFreq]=useState(111.1);
  const [sealReady,setSealReady]=useState(false);
  const [scrollY,setScrollY]=useState(0);
  const [topVideos,setTopVideos]=useState([]);
  const [latestVideo,setLatestVideo]=useState(null);
  const [shorts,setShorts]=useState([]);
  const [loadingYT,setLoadingYT]=useState(true);
  const [menuOpen,setMenuOpen]=useState(false);
  const [nowPlaying,setNowPlaying]=useState(null);
  const [thumb,setThumb]=useState(null);
  const [volume,setVolume]=useState(80);
  const [easterEgg,setEasterEgg]=useState(null);
  const [keyBuffer,setKeyBuffer]=useState("");
  const konami=useRef([]);
  const sealTaps=useRef([]);
  const pressTimer=useRef(null);
  const [codeBox,setCodeBox]=useState(false);
  const [code,setCode]=useState("");
  const [codeMiss,setCodeMiss]=useState(false);
  const freqRef=useRef(null);

  useEffect(()=>{const t=setTimeout(()=>setSealReady(true),500);return()=>clearTimeout(t);},[]);
  useEffect(()=>{ loadStation().then(d=>{
    GENRES=[{ name:"Full Station", slug:"all", ...styleOf("Full Station") },...d.channels.map(c=>({ name:c.name, slug:c.slug, separate:!!c.separate, ...styleOf(c.name) }))];
    setStation(d);
    const want=linkedSlug(), g=want&&GENRES.find(x=>x.slug===want);
    if(g){ setGenre(g.name); setActiveGlow(g.glow); setLinked(g.name); }
  }).catch(e=>console.error("station.json",e)); },[]);
  const activeChannel=station?(genre==="Full Station"?station.all:station.channels.find(c=>c.name===genre)||station.all):null;
  useAutoBuffer(activeChannel,tuned);
  const [offlineEmpty,setOfflineEmpty]=useState(false);
  const handleTrack=useCallback((info)=>{ if(info.unavailable){ setOfflineEmpty(true); return; } setOfflineEmpty(false); setOnAirInfo(info); setNowPlaying(info.track.t); setThumb(info.track.cover); },[]);
  const handleProgress=useCallback((cur,dur)=>setProgress([cur,dur]),[]);
  useEffect(()=>{const f=()=>setScrollY(window.scrollY);window.addEventListener("scroll",f,{passive:true});return()=>window.removeEventListener("scroll",f);},[]);

  useEffect(()=>{
    if(!tuned){setFreq(111.1);return;}
    const tick=()=>{setFreq(f=>parseFloat((Math.min(111.6,Math.max(110.6,f+(Math.random()-0.48)*0.09))).toFixed(1)));freqRef.current=setTimeout(tick,140);};
    freqRef.current=setTimeout(tick,140);
    return()=>clearTimeout(freqRef.current);
  },[tuned]);

  useEffect(()=>{
    async function fetchData(){
      setLoadingYT(true);
      try{const[top,latest,sh]=await Promise.all([getTopVideos(),getLatestVideos(),getTopShorts()]);setTopVideos(top);setLatestVideo(latest[0]||null);setShorts(sh);}catch(e){console.error(e);}
      setLoadingYT(false);
    }
    // No signal: don't reach for YouTube (iPhones nag about Wi-Fi); try again when the signal comes back.
    if(navigator.onLine) fetchData();
    else { setLoadingYT(false); const on=()=>fetchData(); window.addEventListener("online",on,{once:true}); return()=>window.removeEventListener("online",on); }
  },[]);

  // Easter egg keyboard listener
  useEffect(()=>{
    const handler=(e)=>{
      if(e.key.length===1&&e.key.match(/[A-Za-z]/)){
        if(e.target.tagName==="INPUT") return;
        const next=(keyBuffer+e.key.toUpperCase()).slice(-8);
        setKeyBuffer(next);
        const egg=findEgg(next);
        if(egg){ setEasterEgg(egg); setKeyBuffer(""); }
      }
      // Konami code: ↑ ↑ ↓ ↓ ← → ← → B A
      const k=e.key.length===1?e.key.toLowerCase():e.key;
      konami.current=[...konami.current,k].slice(-10);
      if(konami.current.join()===KONAMI.join()){ konami.current=[]; setEasterEgg({ msg:"CHEAT CODE ACCEPTED. +30 LIVES. UNLIMITED SKIPS. (THEY WERE ALREADY UNLIMITED.)", fx:"burst" }); }
    };
    window.addEventListener("keydown",handler);
    return()=>window.removeEventListener("keydown",handler);
  },[keyBuffer]);

  // Keyboard shortcuts
  useEffect(()=>{
    const handler=(e)=>{
      if(e.target.tagName==="INPUT"||e.target.tagName==="SELECT") return;
      if(e.code==="Space"){e.preventDefault();handleTuneIn();}
      if(e.code==="ArrowRight"&&tuned){window._aprSkip?.();}
      if(e.code==="ArrowUp"){setVolume(v=>Math.min(100,v+5));}
      if(e.code==="ArrowDown"){setVolume(v=>Math.max(0,v-5));}
    };
    window.addEventListener("keydown",handler);
    return()=>window.removeEventListener("keydown",handler);
  },[tuned]);

  const handleTuneIn=useCallback(()=>{
    if(tuning)return;
    if(tuned){setTuned(false);setNowPlaying(null);setThumb(null);setOnAirInfo(null);return;}
    setTuning(true);setShowStatic(true);
    let f=88.0;
    const sweep=setInterval(()=>{
      f+=2;setFreq(parseFloat(f.toFixed(1)));
      if(f>=111.1){clearInterval(sweep);setFreq(111.1);setTimeout(()=>{setTuned(true);setTuning(false);setShowStatic(false);},180);}
    },28);
  },[tuned,tuning]);

  const handleGenre=useCallback((g)=>{
    setGenre(g.name);setActiveGlow(g.glow);
    if(!tuned) handleTuneIn();
  },[tuned,handleTuneIn]);

  // Egg: tap the logo in the top corner 7 times quickly.
  const tapSeal=()=>{
    const t=Date.now(); sealTaps.current=[...sealTaps.current.filter(x=>t-x<4000),t];
    if(sealTaps.current.length>=7){ sealTaps.current=[]; setEasterEgg({ msg:"SEVEN TAPS. THE SEAL IS BROKEN. YOU'RE ONE OF US NOW.", fx:"burst" }); }
  };
  // Egg: press and hold the 111.1 dial for a pirate broadcast (jumps to a random station).
  const holdStart=()=>{ clearTimeout(pressTimer.current); pressTimer.current=setTimeout(()=>{
    const pool=GENRES.filter(g=>g.name!==genre); const g=pool[Math.floor(Math.random()*pool.length)]; if(!g) return;
    handleGenre(g); setEasterEgg({ msg:`📡 PIRATE BROADCAST. HIJACKING THE SIGNAL… NOW PLAYING: ${g.name.toUpperCase()}.` });
  },900); };
  const holdEnd=()=>clearTimeout(pressTimer.current);
  // Egg: be tuned in when the clock says 11:11.
  useEffect(()=>{
    if(!tuned) return;
    let shown="";
    const check=()=>{ const d=new Date(), key=d.toDateString()+d.getHours();
      if((d.getHours()%12)===11&&d.getMinutes()===11&&shown!==key){ shown=key; setEasterEgg({ msg:"IT'S 11:11 ON 111.1. MAKE A WISH. ✦", fx:"sparkle" }); } };
    check(); const id=setInterval(check,15000); return()=>clearInterval(id);
  },[tuned]);
  const submitCode=(e)=>{ e.preventDefault(); const egg=findEgg(code);
    if(egg){ setEasterEgg(egg); setCode(""); setCodeBox(false); setCodeMiss(false); } else setCodeMiss(true); };

  const shareStation=()=>{
    const text=`🎵 Tuned into ${genre} on Alec Penn Radio · 111.1 IM · Free music, no gatekeepers · alecpennradio.com`;
    if(navigator.share){navigator.share({title:"Alec Penn Radio",text,url:`https://alecpennradio.com/${currentGenreObj.slug==="all"?"":currentGenreObj.slug}`});}
    else{navigator.clipboard.writeText(text).then(()=>alert("Copied to clipboard!"));}
  };

  const now=new Date();
  const timeStr=now.toLocaleTimeString([],{hour:"2-digit",minute:"2-digit"});
  const latestTitle=latestVideo?.snippet?.title||"Loading latest drop...";
  const latestId=latestVideo?.id?.videoId||"";
  const pad=mobile?"16px":"32px";
  const currentGenreObj=GENRES.find(g=>g.name===genre)||GENRES[0];

  return (
    <div className={`apr theme-${theme}`} style={{ minHeight:"100vh",background:C.black,color:C.cream,fontFamily:"'Georgia','Times New Roman',serif",cursor:mobile?"auto":"none",overflowX:"hidden",position:"relative",isolation:"isolate",transition:"background 0.6s" }}>
      <ThemeBackdrop theme={theme}/>
      <style>{`
        *{box-sizing:border-box;margin:0;padding:0;}
        html,body{width:100%;overflow-x:hidden;background:#0A0806;}
        ::-webkit-scrollbar{width:3px;}::-webkit-scrollbar-track{background:#0A0806;}::-webkit-scrollbar-thumb{background:#9E7F35;border-radius:2px;}
        @keyframes vu-bounce{from{height:4px;}to{height:34px;}}
        @keyframes pulse-dot{0%,100%{opacity:1}50%{opacity:0.15}}
        @keyframes freq-flicker{0%,100%{opacity:1}93%{opacity:0.82}95%{opacity:1}}
        @keyframes scanline{0%{transform:translateY(-100%)}100%{transform:translateY(100vh)}}
        @keyframes static-flash{0%{opacity:1}100%{opacity:0}}
        @keyframes on-air-blink{0%,49%{opacity:1}50%,99%{opacity:0}}
        @keyframes cloud-drift{from{transform:translateX(-6%)}to{transform:translateX(8%)}}
        @keyframes grid-move{from{background-position:0 0}to{background-position:0 70px}}
        html,body{background:${C.black}!important;}
        .theme-skyline h1,.theme-skyline h2[style*="Bebas"]{background:linear-gradient(90deg,#FFB86B,#FF9DD6 45%,#C08BFF 75%,#8ED1FF);-webkit-background-clip:text;background-clip:text;color:transparent!important;}
        .theme-neon h1,.theme-neon h2,.theme-neon [style*="Bebas Neue"]:not(button){text-shadow:0 0 6px currentColor,0 0 20px currentColor;}
        .theme-neon button{box-shadow:0 0 12px rgba(255,43,214,0.28);}
        .theme-graffiti h1,.theme-graffiti h2{font-family:'Permanent Marker',cursive!important;letter-spacing:0.02em!important;text-shadow:4px 4px 0 #000,-1px -1px 0 #000;transform:rotate(-2deg);}
        .theme-graffiti h1{color:#FFE600!important;}
        .theme-static h1{font-family:'Special Elite','Courier New',monospace!important;background:#FBF3EA;color:#2a1c21!important;padding:6px 14px;display:inline-block;transform:rotate(-1.5deg);box-shadow:4px 4px 0 rgba(0,0,0,0.35);letter-spacing:0.02em!important;}
        .theme-static h1 span{color:#8E4A5A!important;}
        .theme-static h2{font-family:'Special Elite','Courier New',monospace!important;letter-spacing:0.04em!important;}
        @media (max-width: 900px){.apr-tv{display:none;}}
        @media (prefers-reduced-motion: reduce){.apr *{animation:none!important;}}
        @keyframes glow-pulse{0%,100%{box-shadow:0 0 20px #2F6F6D44}50%{box-shadow:0 0 44px #2F6F6D88}}
        @keyframes horizon-scroll{0%{transform:translateX(0)}100%{transform:translateX(-50%)}}
        @keyframes ticker-scroll{0%{transform:translateX(0)}100%{transform:translateX(-50%)}}
        @keyframes cat-walk{from{transform:translateX(-80px) scaleX(-1)}to{transform:translateX(calc(100vw + 80px)) scaleX(-1)}}
        @keyframes egg-burst{from{transform:translate(-50%,-50%) scale(0.4);opacity:1}to{transform:translate(calc(-50% + var(--dx)),calc(-50% + var(--dy))) scale(1);opacity:0}}
        @keyframes float-in{from{opacity:0;transform:translate(-50%,-60%)}to{opacity:1;transform:translate(-50%,-50%)}}
        .nav-link{color:#D4B96A;text-decoration:none;font-size:12px;letter-spacing:0.1em;text-transform:uppercase;transition:color 0.15s;font-family:'JetBrains Mono',monospace;}
        .nav-link:hover{color:#C2A24D;}
      `}</style>

      {!mobile&&<Cursor/>}
      <StaticFlash show={showStatic}/>
      {easterEgg&&<EasterEggMsg key={easterEgg.msg} egg={easterEgg} onClose={()=>setEasterEgg(null)}/>}

      <div style={{ position:"fixed",inset:0,pointerEvents:"none",zIndex:100,overflow:"hidden",opacity:0.02 }}>
        <div style={{ width:"100%",height:2,background:C.cream,animation:"scanline 9s linear infinite" }}/>
      </div>

      {/* Ambient glow — changes color with genre */}
      <div style={{ position:"fixed",inset:0,pointerEvents:"none",zIndex:0,
        background:tuned
          ?`radial-gradient(ellipse 80% 50% at 50% 0%,${activeGlow}22 0%,transparent 70%),radial-gradient(ellipse 40% 30% at 85% 100%,${C.deepBurgundy}22 0%,transparent 60%)`
          :`radial-gradient(ellipse 60% 40% at 50% 0%,${C.deepGold}08 0%,transparent 70%)`,
        transition:"background 1.5s ease" }}/>

      {/* NAV */}
      <nav style={{ position:"sticky",top:0,zIndex:50,background:`${C.black}f5`,backdropFilter:"blur(14px)",
        borderBottom:`1px solid ${tuned?activeGlow+"44":C.deepGold+"22"}`,
        padding:`0 ${pad}`,display:"flex",alignItems:"center",justifyContent:"space-between",
        height:mobile?52:60,transition:"border-color 0.7s" }}>
        <div style={{ display:"flex",alignItems:"center",gap:10 }}>
          <span onClick={tapSeal} style={{ display:"inline-flex",WebkitTapHighlightColor:"transparent" }}><WaveSeal size={mobile?38:46} color={tuned?activeGlow:C.gold} glow={tuned}/></span>
          <div style={{ display:"flex",flexDirection:"column",gap:0,lineHeight:1 }}>
            <span style={{ fontFamily:"'Bebas Neue',sans-serif",fontSize:mobile?15:18,color:C.cream,letterSpacing:"0.14em" }}>ALEC PENN</span>
            <span style={{ fontFamily:"'Bebas Neue',sans-serif",fontSize:mobile?11:13,color:tuned?activeGlow:C.gold,letterSpacing:"0.28em",transition:"color 0.8s" }}>RADIO</span>
          </div>
          <div style={{ width:6,height:6,borderRadius:"50%",marginLeft:4,background:tuned?C.sageTeal:C.roseMaroon,animation:tuned?"on-air-blink 1.4s step-end infinite":"none",boxShadow:tuned?`0 0 7px ${C.sageTeal}`:"none",transition:"background 0.5s,box-shadow 0.5s" }}/>
        </div>
        {!mobile&&(
          <>
            <div style={{ flex:1,margin:"0 28px",overflow:"hidden",height:18 }}>
              <div style={{ display:"flex",gap:36,whiteSpace:"nowrap",animation:"horizon-scroll 22s linear infinite",width:"max-content" }}>
                {[...GENRES,...GENRES].map((g,i)=>(
                  <span key={i} onClick={()=>handleGenre(g)}
                    style={{ fontFamily:"'JetBrains Mono',monospace",fontSize:10,color:g.name===genre?C.gold:C.deepGold+"55",letterSpacing:"0.14em",cursor:"pointer",transition:"color 0.2s" }}>{g.name}</span>
                ))}
              </div>
            </div>
            <div style={{ display:"flex",gap:16,alignItems:"center" }}>
              
              <VibePicker theme={theme} setTheme={setTheme} mobile={false}/>
              <a href="/saved" className="nav-link" style={{ color:C.gold }}>♥ Saved</a>
              <a href="#broadcast" className="nav-link">Broadcast</a>
              <a href="#charts" className="nav-link">Charts</a>
              <a href="#mission" className="nav-link">Mission</a>
              {tuned&&<button onClick={()=>window._aprSkip?.()} style={{ background:"transparent",border:`1px solid ${C.deepGold}44`,color:C.warmGold,padding:"4px 10px",borderRadius:4,fontSize:11,cursor:"pointer",fontFamily:"'JetBrains Mono',monospace",letterSpacing:"0.08em" }}>⏭ SKIP</button>}
              {tuned&&<button onClick={shareStation} style={{ background:"transparent",border:`1px solid ${C.sageTeal}66`,color:C.sageTeal,padding:"4px 10px",borderRadius:4,fontSize:11,cursor:"pointer",fontFamily:"'JetBrains Mono',monospace",letterSpacing:"0.08em" }}>↗ SHARE</button>}
              <a href={YT} target="_blank" rel="noreferrer" style={{ background:C.burgundy,color:C.cream,padding:"5px 14px",borderRadius:4,fontSize:11,letterSpacing:"0.08em",textDecoration:"none",textTransform:"uppercase",fontFamily:"'JetBrains Mono',monospace",border:`1px solid ${C.roseMaroon}` }}>YouTube ↗</a>
              <div style={{ display:"flex",gap:0,marginLeft:4 }}>
                {[{l:"─"},{l:"□"},{l:"✕"}].map((b,i)=>(
                  <div key={i} style={{ width:32,height:24,display:"flex",alignItems:"center",justifyContent:"center",fontSize:i===2?11:13,color:C.warmGold,cursor:"default",borderLeft:`1px solid ${C.deepGold}22`,userSelect:"none",transition:"background 0.1s" }}
                    onMouseEnter={e=>e.currentTarget.style.background=i===2?"#8B1A1A":`${C.deepGold}22`}
                    onMouseLeave={e=>e.currentTarget.style.background="transparent"}>{b.l}</div>
                ))}
              </div>
            </div>
          </>
        )}
        {mobile&&(
          <div style={{ display:"flex",alignItems:"center",gap:10 }}>
            <a href="/saved" aria-label="Saved songs, play offline" style={{ color:C.gold,border:`1px solid ${C.gold}66`,padding:"8px 10px",borderRadius:4,fontSize:11,letterSpacing:"0.08em",textDecoration:"none",fontFamily:"'JetBrains Mono',monospace" }}>♥ SAVED</a>
            
            <a href={YT} target="_blank" rel="noreferrer" style={{ background:C.burgundy,color:C.cream,padding:"4px 12px",borderRadius:4,fontSize:10,letterSpacing:"0.08em",textDecoration:"none",fontFamily:"'JetBrains Mono',monospace",border:`1px solid ${C.roseMaroon}` }}>YT ↗</a>
            <button onClick={()=>setMenuOpen(o=>!o)} style={{ background:"transparent",border:`1px solid ${C.deepGold}44`,color:C.warmGold,padding:"6px 10px",borderRadius:4,cursor:"pointer",fontFamily:"'JetBrains Mono',monospace",fontSize:14 }}>{menuOpen?"✕":"≡"}</button>
          </div>
        )}
      </nav>
      {!online&&(
        <a href="/saved" style={{ display:"block",position:"relative",zIndex:48,background:C.burgundy,color:C.cream,textDecoration:"none",textAlign:"center",padding:"12px 16px",fontFamily:"'JetBrains Mono',monospace",fontSize:13,letterSpacing:"0.06em" }}>
          {offlineEmpty
            ?<>NO SIGNAL · NOTHING FROM {genre.toUpperCase()} IS SAVED ON THIS PHONE. <b style={{ color:C.paleGold }}>PLAY YOUR SAVED SONGS →</b></>
            :<>NO SIGNAL · STATIONS YOU SAVED STILL PLAY LIVE. <b style={{ color:C.paleGold }}>SAVED SONGS →</b></>}
        </a>
      )}

      {mobile&&menuOpen&&(
        <div style={{ background:`${C.black}f8`,backdropFilter:"blur(14px)",borderBottom:`1px solid ${C.deepGold}22`,padding:"16px",display:"flex",flexDirection:"column",gap:12,position:"relative",zIndex:49 }}>
          <div style={{ fontFamily:"'JetBrains Mono',monospace",fontSize:11,color:C.sageTeal,letterSpacing:"0.16em" }}>VIBE</div>
          <VibePicker theme={theme} setTheme={setTheme} mobile={true}/>
          {["#broadcast","#charts","#mission"].map((href,i)=>(
            <a key={href} href={href} onClick={()=>setMenuOpen(false)} style={{ color:C.warmGold,textDecoration:"none",fontFamily:"'JetBrains Mono',monospace",fontSize:12,letterSpacing:"0.12em",textTransform:"uppercase",padding:"8px 0",borderBottom:`1px solid ${C.deepGold}18` }}>
              {["Broadcast","Charts","Mission"][i]}
            </a>
          ))}
          {tuned&&<button onClick={()=>window._aprSkip?.()} style={{ background:"transparent",border:`1px solid ${C.deepGold}44`,color:C.warmGold,padding:"8px 0",borderRadius:4,fontSize:11,cursor:"pointer",fontFamily:"'JetBrains Mono',monospace",letterSpacing:"0.08em",textAlign:"left" }}>⏭ SKIP TRACK</button>}
          {tuned&&<button onClick={shareStation} style={{ background:"transparent",border:`1px solid ${C.sageTeal}66`,color:C.sageTeal,padding:"8px 0",borderRadius:4,fontSize:11,cursor:"pointer",fontFamily:"'JetBrains Mono',monospace",letterSpacing:"0.08em",textAlign:"left" }}>↗ SHARE STATION</button>}
        </div>
      )}

      {/* HERO */}
      <section id="broadcast" style={{ padding:mobile?`24px ${pad} 0`:`48px ${pad} 0`,maxWidth:1140,margin:"0 auto",position:"relative" }}>
        <div style={{
          border:`1px solid ${tuned?activeGlow+"66":C.deepGold+"44"}`,borderRadius:mobile?10:14,
          overflow:"hidden",position:"relative",background:C.panel,
          boxShadow:tuned?`0 0 80px ${activeGlow}22,inset 0 1px 0 ${activeGlow}33`:`0 0 40px ${C.deepGold}10,inset 0 1px 0 ${C.gold}14`,
          transform:mobile?"none":`translateY(${scrollY*0.018}px)`,transition:"border-color 0.9s,box-shadow 0.9s" }}>

          <div style={{ position:"absolute",inset:0,zIndex:0 }}><ParticleField active={tuned} glowColor={activeGlow}/></div>

          {/* Title bar */}
          <div style={{ position:"relative",zIndex:2,background:`linear-gradient(90deg,${C.deepBurgundy}cc,${C.panelBar}cc,${C.deepBurgundy}cc)`,borderBottom:`1px solid ${tuned?activeGlow+"33":C.deepGold+"2a"}`,padding:mobile?"7px 14px":"9px 18px",display:"flex",alignItems:"center",justifyContent:"space-between" }}>
            <div style={{ display:"flex",alignItems:"center",gap:8 }}>
              <div style={{ width:6,height:6,borderRadius:"50%",background:tuned?C.sageTeal:C.dustyRose,animation:tuned?"on-air-blink 1.4s step-end infinite":"none" }}/>
              <span style={{ fontFamily:"'JetBrains Mono',monospace",fontSize:mobile?11:9,color:tuned?C.sageTeal:C.dustyRose,letterSpacing:"0.12em" }}>{tuning?"TUNING...":tuned?"ON AIR":"STANDBY"}</span>
              {tuned&&<span style={{ fontFamily:"'JetBrains Mono',monospace",fontSize:mobile?11:9,color:activeGlow,letterSpacing:"0.1em",marginLeft:8 }}>· {genre.toUpperCase()} · {currentGenreObj.mood.toUpperCase()}</span>}
            </div>
            <span style={{ fontFamily:"'JetBrains Mono',monospace",fontSize:mobile?10:11,color:C.warmGold,letterSpacing:"0.1em" }}>{timeStr}</span>
            {!mobile&&(
              <div style={{ display:"flex",gap:0 }}>
                {[{l:"─"},{l:"□"},{l:"✕"}].map((b,i)=>(
                  <div key={i} style={{ width:32,height:22,display:"flex",alignItems:"center",justifyContent:"center",fontSize:i===2?10:12,color:C.warmGold,cursor:"default",borderLeft:`1px solid ${C.deepGold}22`,userSelect:"none",transition:"background 0.1s" }}
                    onMouseEnter={e=>e.currentTarget.style.background=i===2?"#8B1A1A":`${C.deepGold}22`}
                    onMouseLeave={e=>e.currentTarget.style.background="transparent"}>{b.l}</div>
                ))}
              </div>
            )}
          </div>

          {/* Console body */}
          <div style={{ position:"relative",zIndex:2,padding:mobile?"20px 16px 24px":"36px 36px 28px",display:"grid",gridTemplateColumns:mobile?"1fr":"1fr auto",gap:mobile?24:48,alignItems:"center" }}>
            <div>
              <div style={{ marginBottom:8 }}>
                <span style={{ fontFamily:"'JetBrains Mono',monospace",fontSize:10,color:C.sageTeal,letterSpacing:"0.15em" }}>BROADCASTING SINCE 2026</span>
              </div>

              <div style={{ display:"flex",alignItems:"center",gap:mobile?16:24,marginBottom:12 }}>
                <AnimatedSeal size={mobile?72:112} color={tuned?activeGlow:C.warmGold} triggered={sealReady}/>
                <div>
                  <h1 style={{ fontFamily:"'Bebas Neue',sans-serif",fontSize:mobile?"clamp(40px,12vw,64px)":"clamp(50px,7vw,88px)",color:tuned?activeGlow:C.gold,letterSpacing:"0.06em",lineHeight:0.88,animation:tuned?"freq-flicker 5s ease infinite":"none",transition:"color 0.8s" }}>
                    ALEC PENN<br/><span style={{ color:C.cream }}>RADIO</span>
                  </h1>
                </div>
              </div>

              <p style={{ fontFamily:"'DM Serif Display',serif",fontStyle:"italic",fontSize:mobile?14:16,color:C.dustyRose,marginBottom:20,lineHeight:1.5 }}>
                AI co-created. Multi-genre. Free for everyone.
              </p>

              {mobile&&<div style={{ margin:"0 -16px 14px" }}><Turntable playing={tuned} cover={thumb} glow={activeGlow} progress={progress[1]?progress[0]/progress[1]:0} mobile={true} height={250} song={onAirInfo?{ t:onAirInfo.track.t, station:onAirInfo.track.genre||genre, cover:onAirInfo.track.cover||thumb }:null}/></div>}

              {/* Freq + oscilloscope + album art */}
              <div style={{ display:"flex",alignItems:"center",gap:12,marginBottom:20,flexWrap:"wrap" }}>
                <div onPointerDown={holdStart} onPointerUp={holdEnd} onPointerLeave={holdEnd} onPointerCancel={holdEnd} onContextMenu={e=>e.preventDefault()} style={{ userSelect:"none",WebkitUserSelect:"none",WebkitTouchCallout:"none",display:"inline-flex",alignItems:"baseline",gap:4,background:"#030201",border:`1px solid ${tuned?activeGlow+"55":C.deepGold+"28"}`,borderRadius:6,padding:mobile?"8px 14px":"10px 18px",transition:"border-color 0.7s" }}>
                  <span style={{ fontFamily:"'JetBrains Mono',monospace",fontSize:mobile?24:32,fontWeight:500,color:tuning?C.warmGold:tuned?activeGlow:C.gold,letterSpacing:"0.05em",animation:tuned?"freq-flicker 3s ease infinite":"none",transition:"color 0.8s" }}>{freq.toFixed(1)}</span>
                  <span style={{ fontFamily:"'JetBrains Mono',monospace",fontSize:mobile?11:14,color:C.deepGold }}>IM</span>
                </div>
                {!mobile&&<Oscilloscope active={tuned} color={tuned?activeGlow:C.sageTeal}/>}
                <AlbumArt thumb={thumb} active={tuned}/>
              </div>

              {/* VU + controls */}
              <div style={{ display:"flex",alignItems:"center",gap:16,marginBottom:20,flexWrap:"wrap" }}>
                <div style={{ display:"flex",flexDirection:"column",gap:4 }}>
                  <VUMeter active={tuned}/>
                  {tuned&&analyserLive()&&<span style={{ fontFamily:"'JetBrains Mono',monospace",fontSize:mobile?10:8,color:activeGlow,letterSpacing:"0.14em" }}>● LIVE SIGNAL</span>}
                </div>
                <button onClick={handleTuneIn} disabled={tuning}
                  style={{ background:tuned?C.burgundy:C.teal,border:"none",color:C.cream,padding:mobile?"14px 24px":"12px 32px",minHeight:mobile?48:undefined,borderRadius:6,fontSize:mobile?12:13,fontWeight:600,letterSpacing:"0.12em",textTransform:"uppercase",cursor:tuning?"wait":"pointer",fontFamily:"'JetBrains Mono',monospace",animation:tuned?"glow-pulse 2s ease infinite":"none",transition:"background 0.4s" }}>
                  {tuning?"▶ TUNING...":tuned?"■ OFF AIR":linked?`▶ TUNE IN · ${genre.toUpperCase()}`:"▶ TUNE IN"}
                </button>
                {tuned&&(
                  <button onClick={()=>window._aprSkip?.()}
                    style={{ background:"transparent",border:`1px solid ${C.deepGold}44`,color:C.warmGold,padding:"10px 16px",borderRadius:6,fontSize:mobile?11:12,cursor:"pointer",fontFamily:"'JetBrains Mono',monospace",letterSpacing:"0.08em",transition:"all 0.15s" }}
                    onMouseEnter={e=>{e.currentTarget.style.borderColor=C.gold;e.currentTarget.style.color=C.gold;}}
                    onMouseLeave={e=>{e.currentTarget.style.borderColor=`${C.deepGold}44`;e.currentTarget.style.color=C.warmGold;}}>
                    ⏭
                  </button>
                )}
                {tuned&&(
                  <button onClick={shareStation}
                    style={{ background:"transparent",border:`1px solid ${C.sageTeal}44`,color:C.sageTeal,padding:"10px 16px",borderRadius:6,fontSize:mobile?11:12,cursor:"pointer",fontFamily:"'JetBrains Mono',monospace",letterSpacing:"0.08em",transition:"all 0.15s" }}>
                    ↗
                  </button>
                )}
                {!mobile&&<VolumeDial volume={volume} onChange={setVolume}/>}
              </div>

              {/* Now playing */}
              {tuned&&onAirInfo&&(
                <div style={{ marginBottom:16,maxWidth:440 }}>
                  <div style={{ display:"flex",alignItems:"center",gap:6 }}>
                    <div style={{ width:5,height:5,borderRadius:"50%",background:activeGlow,animation:"pulse-dot 1s infinite",flexShrink:0 }}/>
                    <span style={{ fontFamily:"'JetBrains Mono',monospace",fontSize:mobile?11:9,color:C.sageTeal,letterSpacing:"0.14em" }}>NOW PLAYING · {onAirInfo.track.genre.toUpperCase()}</span>
                  </div>
                  <div style={{ fontFamily:"'Bebas Neue',sans-serif",fontSize:mobile?24:30,color:C.cream,letterSpacing:"0.05em",lineHeight:1.05,marginTop:4,overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap" }}>{onAirInfo.track.t}</div>
                  <div style={{ height:3,background:`${C.deepGold}22`,borderRadius:2,marginTop:8,overflow:"hidden" }}>
                    <div style={{ height:"100%",width:`${progress[1]?Math.min(100,progress[0]/progress[1]*100):0}%`,background:`linear-gradient(90deg,${C.teal},${activeGlow})`,transition:"width 0.3s linear" }}/>
                  </div>
                  <div style={{ display:"flex",justifyContent:"space-between",marginTop:5,fontFamily:"'JetBrains Mono',monospace",fontSize:mobile?11:9,color:C.deepGold }}>
                    <span>{fmtTime(progress[0])} / {fmtTime(progress[1])}</span>
                    <span style={{ color:C.mistTeal,overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap",maxWidth:"65%" }}>UP NEXT · {onAirInfo.next.t}</span>
                  </div>
                  <a href={`https://edensgate.art/?q=${encodeURIComponent(onAirInfo.track.t)}`} target="_blank" rel="noreferrer"
                    style={{ display:"inline-block",marginTop:8,fontFamily:"'JetBrains Mono',monospace",fontSize:mobile?11:9,letterSpacing:"0.12em",color:C.paleGold,textDecoration:"none",borderBottom:`1px solid ${C.deepGold}66`,paddingBottom:1 }}>
                    ↓ DOWNLOAD THIS SONG FREE AT EDEN'S GATE
                  </a>
                </div>
              )}
              {tuned&&!onAirInfo&&(
                <div style={{ fontFamily:"'JetBrains Mono',monospace",fontSize:mobile?11:9,color:C.deepGold,marginBottom:16,letterSpacing:"0.1em" }}>LOCKING ONTO SIGNAL...</div>
              )}

              {/* Genre buttons */}
              <div style={mobile?{ display:"grid",gridTemplateColumns:"1fr 1fr",gap:8 }:{ display:"flex",gap:6,flexWrap:"wrap" }}>
                {GENRES.filter(g=>!g.separate).map(g=>(
                  <button key={g.name} onClick={()=>handleGenre(g)}
                    style={{ background:genre===g.name?g.glow:"transparent",border:`1px solid ${genre===g.name?g.glow:C.deepGold+"44"}`,color:genre===g.name?C.black:C.warmGold,padding:mobile?"12px 8px":"6px 16px",minHeight:mobile?46:undefined,borderRadius:mobile?6:4,fontSize:mobile?14:10,lineHeight:1.15,letterSpacing:"0.06em",textTransform:"uppercase",cursor:"pointer",transition:"all 0.2s",fontFamily:"inherit",fontWeight:genre===g.name?700:400 }}>{g.name}</button>
                ))}
              </div>
              {GENRES.some(g=>g.separate)&&(
                <div style={{ marginTop:14 }}>
                  <div style={{ fontFamily:"'JetBrains Mono',monospace",fontSize:mobile?11:9,color:C.sageTeal,letterSpacing:"0.18em",marginBottom:6 }}>SPECIAL BROADCASTS</div>
                  <div style={{ display:"flex",gap:6,flexWrap:"wrap" }}>
                    {GENRES.filter(g=>g.separate).map(g=>(
                      <button key={g.name} onClick={()=>handleGenre(g)}
                        style={{ background:genre===g.name?g.glow:`${C.deepBurgundy}88`,border:`1px solid ${genre===g.name?g.glow:C.roseMaroon}`,color:genre===g.name?C.black:C.paleGold,padding:mobile?"14px 16px":"8px 18px",width:mobile?"100%":undefined,minHeight:mobile?50:undefined,borderRadius:mobile?6:4,fontSize:mobile?20:11,letterSpacing:"0.1em",textTransform:"uppercase",cursor:"pointer",transition:"all 0.2s",fontFamily:"'Bebas Neue',sans-serif",fontWeight:400 }}>★ {g.name}</button>
                    ))}
                  </div>
                </div>
              )}

              <OfflineSaver channel={activeChannel} name={genre} mobile={mobile} glow={activeGlow}/>

              {/* Keyboard hints */}
              {!mobile&&(
                <div style={{ marginTop:12,display:"flex",gap:16 }}>
                  {[["SPACE","tune in/out"],["→","skip"],["↑↓","volume"]].map(([key,label])=>(
                    <div key={key} style={{ display:"flex",alignItems:"center",gap:4 }}>
                      <span style={{ fontFamily:"'JetBrains Mono',monospace",fontSize:mobile?10:8,color:C.black,background:C.deepGold,padding:"1px 5px",borderRadius:3 }}>{key}</span>
                      <span style={{ fontFamily:"'JetBrains Mono',monospace",fontSize:mobile?10:8,color:C.deepGold+"88" }}>{label}</span>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* Right panel */}
            <div style={{ display:"flex",flexDirection:mobile?"row":"column",alignItems:"center",gap:mobile?16:20,justifyContent:mobile?"space-between":"center",flexWrap:mobile?"wrap":"nowrap" }}>
              {!mobile&&(
                <div style={{ width:420,display:"flex",flexDirection:"column",alignItems:"center",gap:6 }}>
                  <Turntable playing={tuned} cover={thumb} glow={activeGlow} progress={progress[1]?progress[0]/progress[1]:0} mobile={false} height={330} song={onAirInfo?{ t:onAirInfo.track.t, station:onAirInfo.track.genre||genre, cover:onAirInfo.track.cover||thumb }:null}/>
                  <div style={{ display:"flex",gap:18,alignItems:"baseline",fontFamily:"'JetBrains Mono',monospace" }}>
                    <span style={{ fontSize:18,color:C.gold }}>{station?station.total.toLocaleString():"—"}</span>
                    <span style={{ fontSize:mobile?11:9,color:C.sageTeal,letterSpacing:"0.14em" }}>TRACKS ON AIR</span>
                    
                  </div>
                </div>
              )}
              {mobile&&(
                <div style={{ background:"#030201",border:`1px solid ${C.deepGold}22`,borderRadius:8,padding:"12px 16px",textAlign:"center" }}>
                  <div style={{ fontFamily:"'JetBrains Mono',monospace",fontSize:18,color:C.gold }}>{station?station.total.toLocaleString():"—"}</div>
                  <div style={{ fontFamily:"'JetBrains Mono',monospace",fontSize:mobile?10:8,color:C.sageTeal }}>TRACKS ON AIR</div>
                </div>
              )}
              <a href="https://edensgate.art" target="_blank" rel="noreferrer"
                style={{ display:"block",width:"100%",textDecoration:"none",background:`linear-gradient(135deg,${C.deepBurgundy},${C.burgundy})`,border:`1px solid ${C.roseMaroon}`,borderRadius:8,padding:mobile?"12px 16px":"14px 20px",textAlign:"center",boxShadow:`0 4px 22px ${C.deepBurgundy}66`,transition:"box-shadow 0.2s" }}
                onMouseEnter={e=>e.currentTarget.style.boxShadow=`0 8px 32px ${C.burgundy}88`}
                onMouseLeave={e=>e.currentTarget.style.boxShadow=`0 4px 22px ${C.deepBurgundy}66`}>
                <div style={{ fontFamily:"'Bebas Neue',sans-serif",fontSize:mobile?15:17,color:C.paleGold,letterSpacing:"0.15em" }}>EDEN'S GATE</div>
                <div style={{ fontFamily:"'JetBrains Mono',monospace",fontSize:mobile?11:9,color:C.dustyRose,marginTop:3 }}>Download the full library ↗</div>
              </a>
            </div>
          </div>

          {/* Broadcast ticker */}
          <BroadcastTicker active={tuned} nowPlaying={nowPlaying}/>
        </div>
      </section>

      {/* CHARTS */}
      <section id="charts" style={{ padding:`40px ${pad}`,maxWidth:1140,margin:"0 auto" }}>
        <div style={{ display:"flex",alignItems:"baseline",gap:12,marginBottom:20,flexWrap:"wrap" }}>
          <h2 style={{ fontFamily:"'Bebas Neue',sans-serif",fontSize:mobile?28:34,color:C.gold,letterSpacing:"0.1em" }}>TOP CHARTS</h2>
          <span style={{ fontFamily:"'JetBrains Mono',monospace",fontSize:10,color:C.sageTeal }}>{loadingYT?"Loading...":"Most watched on YouTube"}</span>
        </div>
        <div style={{ display:"grid",gridTemplateColumns:mobile?"1fr":"1fr 1fr",gap:16 }}>
          <div style={{ border:`1px solid ${C.deepGold}28`,borderRadius:8,overflow:"hidden",background:"#0d0b09" }}>
            <div style={{ padding:"10px 14px",background:`linear-gradient(90deg,${C.deepBurgundy}88,transparent)`,borderBottom:`1px solid ${C.deepGold}28`,fontFamily:"'JetBrains Mono',monospace",fontSize:mobile?11:9,color:C.warmGold,letterSpacing:"0.15em" }}>▶ TOP 5 — ALL TIME VIEWS</div>
            {loadingYT?<div style={{ padding:20,fontFamily:"'JetBrains Mono',monospace",fontSize:10,color:C.deepGold,textAlign:"center" }}>LOADING SIGNAL...</div>
              :topVideos.length>0?topVideos.map((item,i)=><ChartRow key={item.id} item={item} rank={i+1}/>)
              :<div style={{ padding:20,fontFamily:"'JetBrains Mono',monospace",fontSize:10,color:C.dustyRose,textAlign:"center" }}>NO DATA</div>}
            <div style={{ padding:"10px 14px",textAlign:"center" }}>
              <a href={YT} target="_blank" rel="noreferrer" style={{ fontFamily:"'JetBrains Mono',monospace",fontSize:10,color:C.sageTeal,textDecoration:"none" }}>Full chart on YouTube ↗</a>
            </div>
          </div>
          <div style={{ border:`1px solid ${C.teal}44`,borderRadius:8,overflow:"hidden",background:"#0d0b09",display:"flex",flexDirection:"column" }}>
            <div style={{ padding:"10px 14px",background:`linear-gradient(90deg,${C.teal}44,transparent)`,borderBottom:`1px solid ${C.teal}33`,fontFamily:"'JetBrains Mono',monospace",fontSize:mobile?11:9,color:C.sageTeal,letterSpacing:"0.15em",display:"flex",alignItems:"center",gap:8 }}>
              <div style={{ width:5,height:5,borderRadius:"50%",background:C.sageTeal,animation:"pulse-dot 1s infinite" }}/>
              FRESH DROP — LATEST UPLOAD
            </div>
            <div style={{ flex:1,padding:mobile?16:24,display:"flex",flexDirection:"column",justifyContent:"space-between",gap:16 }}>
              <div>
                <div style={{ fontFamily:"'DM Serif Display',serif",fontSize:mobile?16:20,color:C.cream,marginBottom:8,lineHeight:1.3 }}>{loadingYT?"Loading...":latestTitle}</div>
                <div style={{ fontFamily:"'JetBrains Mono',monospace",fontSize:10,color:C.sageTeal,marginBottom:12 }}>AI co-created with Suno · Free to use</div>
                <div style={{ display:"flex",gap:6,flexWrap:"wrap" }}>
                  {["Lo-Fi","Ambient","Soul","Jazz"].map(tag=>(
                    <span key={tag} style={{ background:`${C.teal}22`,border:`1px solid ${C.teal}44`,color:C.mistTeal,fontSize:mobile?11:9,padding:"2px 8px",borderRadius:20,fontFamily:"'JetBrains Mono',monospace" }}>{tag}</span>
                  ))}
                </div>
              </div>
              <a href={latestId?`https://youtube.com/watch?v=${latestId}`:YT} target="_blank" rel="noreferrer"
                style={{ display:"block",background:C.teal,color:C.cream,padding:"11px 16px",borderRadius:6,textAlign:"center",textDecoration:"none",fontFamily:"'JetBrains Mono',monospace",fontSize:11,letterSpacing:"0.1em",fontWeight:500 }}>
                ▶ Watch Latest on YouTube
              </a>
            </div>
          </div>
        </div>
      </section>

      {/* SHORTS */}
      <section id="shorts" style={{ padding:`40px ${pad}`,maxWidth:1140,margin:"0 auto" }}>
        <div style={{ display:"flex",alignItems:"baseline",gap:12,marginBottom:20,flexWrap:"wrap" }}>
          <h2 style={{ fontFamily:"'Bebas Neue',sans-serif",fontSize:mobile?28:34,color:C.gold,letterSpacing:"0.1em" }}>SHORTS HALL OF FAME</h2>
          <span style={{ fontFamily:"'JetBrains Mono',monospace",fontSize:10,color:C.dustyRose }}>Most liked clips</span>
        </div>
        <div style={{ display:"grid",gridTemplateColumns:mobile?"repeat(2,1fr)":"repeat(auto-fit,minmax(180px,1fr))",gap:12 }}>
          {loadingYT?<div style={{ fontFamily:"'JetBrains Mono',monospace",fontSize:10,color:C.deepGold }}>LOADING...</div>
            :shorts.length>0?shorts.map(item=><ShortCard key={item.id} item={item}/>)
            :["1AM Vibes","Rain Loop #7","Sunrise Set","Deep Focus"].map(title=>(
              <div key={title} style={{ background:`linear-gradient(160deg,${C.deepBurgundy},${C.black})`,border:`1px solid ${C.burgundy}55`,borderRadius:8,padding:"16px 14px",display:"flex",flexDirection:"column",gap:8 }}>
                <div style={{ fontSize:18,color:C.roseMaroon }}>▶</div>
                <div style={{ color:C.cream,fontSize:12 }}>{title}</div>
              </div>
            ))}
        </div>
        <div style={{ textAlign:"center",marginTop:16 }}>
          <a href={`${YT}/shorts`} target="_blank" rel="noreferrer" style={{ fontFamily:"'JetBrains Mono',monospace",fontSize:10,color:C.dustyRose,textDecoration:"none",letterSpacing:"0.08em" }}>All Shorts on YouTube ↗</a>
        </div>
      </section>

      {/* MISSION */}
      <section id="mission" style={{ padding:mobile?`48px ${pad}`:`80px ${pad}`,maxWidth:1140,margin:"0 auto",borderTop:`1px solid ${C.deepGold}18`,position:"relative",overflow:"hidden" }}>
        {!mobile&&<div style={{ position:"absolute",top:"50%",left:"50%",transform:"translate(-50%,-50%)",opacity:0.025,pointerEvents:"none" }}><WaveSeal size={400} color={C.gold}/></div>}
        <div style={{ maxWidth:640,margin:"0 auto",textAlign:"center",position:"relative" }}>
          <div style={{ fontFamily:"'JetBrains Mono',monospace",fontSize:10,color:C.sageTeal,letterSpacing:"0.2em",marginBottom:14 }}>THE SIGNAL</div>
          <h2 style={{ fontFamily:"'DM Serif Display',serif",fontSize:mobile?"clamp(24px,7vw,36px)":"clamp(28px,5vw,48px)",color:C.cream,lineHeight:1.2,marginBottom:16 }}>
            Music made to be <em style={{ color:C.gold }}>given away.</em>
          </h2>
          <p style={{ fontFamily:"'Georgia',serif",fontSize:mobile?14:16,color:C.dustyRose,lineHeight:1.8,marginBottom:14 }}>
            Alec Penn Radio is a co-creation between human vision and AI — built with Suno, broadcast on YouTube, and offered to the world without cost, without gatekeepers, without strings.
          </p>
          <p style={{ fontFamily:"'Georgia',serif",fontSize:mobile?14:16,color:C.mistTeal,lineHeight:1.8,marginBottom:32 }}>
            Every track is free to use. Always has been. Always will be. The full catalog lives at Eden's Gate.
          </p>
          <div style={{ display:"flex",gap:12,justifyContent:"center",flexWrap:"wrap" }}>
            <a href={YT} target="_blank" rel="noreferrer" style={{ background:C.burgundy,color:C.cream,padding:mobile?"12px 20px":"14px 32px",borderRadius:6,textDecoration:"none",fontFamily:"'JetBrains Mono',monospace",fontSize:mobile?11:12,letterSpacing:"0.1em",border:`1px solid ${C.roseMaroon}` }}>▶ Subscribe on YouTube</a>
            <a href="https://edensgate.art" target="_blank" rel="noreferrer" style={{ background:"transparent",color:C.paleGold,padding:mobile?"12px 20px":"14px 32px",borderRadius:6,textDecoration:"none",fontFamily:"'JetBrains Mono',monospace",fontSize:mobile?11:12,letterSpacing:"0.1em",border:`1px solid ${C.deepGold}55` }}>Eden's Gate ↗</a>
          </div>
          {!codeBox?(
            <button onClick={()=>setCodeBox(true)} style={{ marginTop:24,background:"none",border:"none",cursor:"pointer",padding:8,fontFamily:"'JetBrains Mono',monospace",fontSize:mobile?11:9,color:C.deepGold+"88",letterSpacing:"0.1em" }}>
              {mobile?"PSST — GOT A SECRET CODE? TAP HERE":"PSST — TRY TYPING A SECRET CODE ON YOUR KEYBOARD (OR CLICK HERE)"}
            </button>
          ):(
            <form onSubmit={submitCode} style={{ marginTop:24,display:"flex",gap:8,justifyContent:"center",flexWrap:"wrap" }}>
              <input autoFocus value={code} onChange={e=>{setCode(e.target.value);setCodeMiss(false);}} placeholder="SECRET CODE" maxLength={16} autoCapitalize="characters" autoComplete="off"
                style={{ background:"#030201",border:`1px solid ${codeMiss?C.roseMaroon:C.deepGold+"66"}`,borderRadius:6,color:C.gold,padding:"10px 12px",fontFamily:"'JetBrains Mono',monospace",fontSize:16,letterSpacing:"0.15em",width:200,textTransform:"uppercase" }}/>
              <button type="submit" style={{ background:C.burgundy,color:C.cream,border:`1px solid ${C.roseMaroon}`,borderRadius:6,padding:"10px 16px",fontFamily:"'JetBrains Mono',monospace",fontSize:12,letterSpacing:"0.1em",cursor:"pointer" }}>ENTER</button>
              {codeMiss&&<div style={{ width:"100%",fontFamily:"'JetBrains Mono',monospace",fontSize:10,color:C.dustyRose,letterSpacing:"0.1em" }}>NOTHING ON THAT FREQUENCY. KEEP TRYING.</div>}
            </form>
          )}
        </div>
      </section>

      {/* FOOTER */}
      <footer style={{ borderTop:`1px solid ${C.deepGold}18`,padding:mobile?`20px ${pad}`:`28px ${pad}`,display:"flex",alignItems:"center",justifyContent:"space-between",flexWrap:"wrap",gap:10 }}>
        <div style={{ display:"flex",alignItems:"center",gap:8 }}>
          <WaveSeal size={28} color={C.deepGold}/>
          <div style={{ display:"flex",flexDirection:"column",lineHeight:1.1 }}>
            <span style={{ fontFamily:"'Bebas Neue',sans-serif",fontSize:11,color:C.deepGold,letterSpacing:"0.14em" }}>ALEC PENN</span>
            <span style={{ fontFamily:"'Bebas Neue',sans-serif",fontSize:mobile?11:9,color:C.warmGold,letterSpacing:"0.28em" }}>RADIO</span>
          </div>
        </div>
        {!mobile&&<div style={{ fontFamily:"'JetBrains Mono',monospace",fontSize:mobile?11:9,color:C.roseMaroon,letterSpacing:"0.1em" }}>AI CO-CREATED · FREE TO USE · NO GATEKEEPERS</div>}
        <div style={{ fontFamily:"'JetBrains Mono',monospace",fontSize:mobile?11:9,color:`${C.deepGold}66` }}>© 2026 ALEC PENN RADIO</div>
      </footer>

      <ArchiveRadio playing={tuned} channel={activeChannel} volume={volume} onTrack={handleTrack} onProgress={handleProgress}/>
    </div>
  );
}
