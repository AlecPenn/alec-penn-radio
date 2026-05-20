import { useState, useEffect, useRef, useCallback } from "react";
import { getLatestVideos, getTopVideos, getTopShorts, formatViews } from "./youtube.js";

const C = {
  black:"#0A0806",gold:"#C2A24D",deepGold:"#9E7F35",warmGold:"#D4B96A",
  paleGold:"#EBD9A0",teal:"#2F6F6D",lazyTeal:"#3D7D7B",sageTeal:"#5E9E9C",
  mistTeal:"#A8C9C8",ghostTeal:"#D6EBEA",burgundy:"#5B2A3C",
  deepBurgundy:"#3D1827",roseMaroon:"#884055",dustyRose:"#C49AAA",cream:"#F4F1EC",
};

const YT = "https://www.youtube.com/@AlecPennRadio";

const GENRES = [
  { name:"Lo-Fi",           id:"PLmNBbWRYKMiijl7vg_jK_uV_dG8L6Nruh", glow:"#3D7D7B", mood:"late night" },
  { name:"Psychedelic Jazz",id:"PLmNBbWRYKMij00GHXkVmWKWOkjGHvkZUO", glow:"#C2A24D", mood:"transcendent" },
  { name:"Acoustic",        id:"PLmNBbWRYKMiilylZojuyYPs_t4akMjjwl", glow:"#D4B96A", mood:"intimate" },
  { name:"Slow Jams",       id:"PLmNBbWRYKMiiqILu7MqJ1lXKOJwvx4f6u", glow:"#884055", mood:"midnight" },
  { name:"House",           id:"PLmNBbWRYKMig_sMtbb1pYP2onNhNM80Qi", glow:"#C2A24D", mood:"electric" },
  { name:"Neo-Classical",   id:"PLmNBbWRYKMiiJ_TVVlnOLJTV2V8sUdfCw", glow:"#A8C9C8", mood:"celestial" },
];

const EASTER_EGGS = {
  "ALECPENN": { msg:"YOU FOUND THE SIGNAL. WELCOME TO THE INNER CIRCLE.", playlist:"PLmNBbWRYKMij00GHXkVmWKWOkjGHvkZUO" },
  "EDENGATE": { msg:"THE GATE IS OPEN. IT ALWAYS WAS.", playlist:"PLmNBbWRYKMiijl7vg_jK_uV_dG8L6Nruh" },
  "FREEMUSI": { msg:"10,000 SONGS. ZERO COST. FOREVER FREE.", playlist:"PLmNBbWRYKMiiqILu7MqJ1lXKOJwvx4f6u" },
};

const TICKER_ITEMS = [
  "NOW BROADCASTING · ALEC PENN RADIO · 111.1 IM",
  "10,000+ TRACKS · ALL FREE · ALL YOURS",
  "AI CO-CREATED WITH SUNO · HUMAN VISION · MACHINE SOUL",
  "DOWNLOAD THE FULL LIBRARY AT EDENSGATE.ART",
  "NO GATEKEEPERS · NO PAYWALLS · NO STRINGS",
  "MUSIC MADE TO BE GIVEN AWAY",
  "TUNE IN · TURN UP · STAY FREE",
];

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

/* ── YOUTUBE RADIO ── */
function YouTubeRadio({ playing, onTrackChange, onThumbChange, playlistId, volume }) {
  const containerRef=useRef(null);
  const playerRef=useRef(null);
  const readyRef=useRef(false);
  const volRef=useRef(volume);

  const buildPlayer=(pid)=>{
    if(!containerRef.current) return;
    try { playerRef.current?.destroy?.(); } catch(e){}
    playerRef.current=null; readyRef.current=false;
    containerRef.current.innerHTML="";
    const div=document.createElement("div");
    containerRef.current.appendChild(div);
    const randomIndex=Math.floor(Math.random()*15);
    const randomStart=Math.floor(Math.random()*1200)+60;
    playerRef.current=new window.YT.Player(div,{
      height:"1",width:"1",
      playerVars:{ listType:"playlist",list:pid,autoplay:1,controls:0,enablejsapi:1,origin:window.location.origin,index:randomIndex,start:randomStart },
      events:{
        onReady:(e)=>{
          readyRef.current=true;
          e.target.setShuffle(true);
          e.target.setVolume(volRef.current);
          if(playing) e.target.playVideo();
        },
        onStateChange:(e)=>{
          if(e.data===window.YT?.PlayerState?.PLAYING){
            const d=playerRef.current?.getVideoData?.();
            if(d?.title) onTrackChange(d.title);
            if(d?.video_id) onThumbChange(`https://img.youtube.com/vi/${d.video_id}/mqdefault.jpg`);
          }
          if(e.data===window.YT?.PlayerState?.ENDED) playerRef.current?.nextVideo?.();
        },
      },
    });
  };

  useEffect(()=>{
    if(!window.YT){const tag=document.createElement("script");tag.src="https://www.youtube.com/iframe_api";document.head.appendChild(tag);}
    if(window.YT?.Player){buildPlayer(playlistId);}else{window.onYouTubeIframeAPIReady=()=>buildPlayer(playlistId);}
    return()=>{try{playerRef.current?.destroy?.();}catch(e){}};
  },[]);

  useEffect(()=>{if(window.YT?.Player) buildPlayer(playlistId);},[playlistId]);

  useEffect(()=>{
    if(!readyRef.current||!playerRef.current) return;
    if(playing){playerRef.current.setShuffle?.(true);playerRef.current.playVideo?.();}
    else playerRef.current.pauseVideo?.();
  },[playing]);

  useEffect(()=>{
    volRef.current=volume;
    if(readyRef.current&&playerRef.current) playerRef.current.setVolume?.(volume);
  },[volume]);

  const skip=()=>{if(readyRef.current&&playerRef.current){playerRef.current.nextVideo?.();}};
  useEffect(()=>{window._aprSkip=skip;},[]);

  return <div style={{ position:"fixed",bottom:0,left:0,width:1,height:1,opacity:0,pointerEvents:"none",zIndex:-1 }}><div ref={containerRef}/></div>;
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

/* ── VU METER ── */
function VUMeter({ active }) {
  return (
    <div style={{ display:"flex",alignItems:"flex-end",gap:3,height:36 }}>
      {Array.from({length:14}).map((_,i)=>(
        <div key={i} style={{ width:4,minHeight:4,borderRadius:2,background:i<8?C.teal:i<11?C.gold:C.roseMaroon,
          animation:active?`vu-bounce ${0.22+i*0.038}s ease-in-out infinite alternate`:"none",height:active?undefined:4 }}/>
      ))}
    </div>
  );
}

/* ── OSCILLOSCOPE ── */
function Oscilloscope({ active }) {
  const canvasRef=useRef(null);
  const animRef=useRef(null);
  const t=useRef(0);
  useEffect(()=>{
    const canvas=canvasRef.current;if(!canvas)return;
    const ctx=canvas.getContext("2d");const W=canvas.width,H=canvas.height;
    const draw=()=>{
      ctx.clearRect(0,0,W,H);
      ctx.strokeStyle=active?C.sageTeal:C.lazyTeal+"33";ctx.lineWidth=1.5;ctx.shadowBlur=active?8:0;ctx.shadowColor=C.sageTeal;
      ctx.beginPath();
      for(let x=0;x<W;x++){const amp=active?H*0.36:H*0.03;const y=H/2+amp*(Math.sin(x*0.04+t.current)*0.5+Math.sin(x*0.09+t.current*1.4)*0.3+Math.sin(x*0.02+t.current*0.6)*0.2);x===0?ctx.moveTo(x,y):ctx.lineTo(x,y);}
      ctx.stroke();t.current+=active?0.065:0.008;animRef.current=requestAnimationFrame(draw);
    };
    draw();return()=>cancelAnimationFrame(animRef.current);
  },[active]);
  return <canvas ref={canvasRef} width={180} height={44} style={{ display:"block",borderRadius:4,border:`1px solid ${active?C.sageTeal+"44":C.deepGold+"18"}`,background:"#030201",transition:"border-color 0.5s",maxWidth:"100%" }}/>;
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

/* ── LISTENERS COUNTER ── */
function ListenersCounter({ active }) {
  const [count,setCount]=useState(0);
  const baseRef=useRef(Math.floor(Math.random()*180)+120);
  useEffect(()=>{
    if(!active){setCount(0);return;}
    setCount(baseRef.current);
    const interval=setInterval(()=>{
      const drift=Math.floor((Math.random()-0.45)*3);
      baseRef.current=Math.max(80,Math.min(400,baseRef.current+drift));
      setCount(baseRef.current);
    },4000);
    return()=>clearInterval(interval);
  },[active]);
  if(!active) return null;
  return (
    <div style={{ display:"flex",alignItems:"center",gap:5 }}>
      <div style={{ width:5,height:5,borderRadius:"50%",background:C.sageTeal,animation:"pulse-dot 1.5s infinite" }}/>
      <span style={{ fontFamily:"'JetBrains Mono',monospace",fontSize:9,color:C.sageTeal,letterSpacing:"0.1em" }}>
        {count.toLocaleString()} LISTENING
      </span>
    </div>
  );
}

/* ── ALBUM ART ── */
function AlbumArt({ thumb, active }) {
  return (
    <div style={{ width:72,height:54,borderRadius:6,overflow:"hidden",flexShrink:0,
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
function EasterEggMsg({ msg, onClose }) {
  useEffect(()=>{const t=setTimeout(onClose,5000);return()=>clearTimeout(t);},[]);
  return (
    <div style={{ position:"fixed",top:"50%",left:"50%",transform:"translate(-50%,-50%)",
      zIndex:500,background:`${C.black}ee`,border:`1px solid ${C.gold}`,borderRadius:12,
      padding:"24px 32px",textAlign:"center",maxWidth:360,
      boxShadow:`0 0 60px ${C.gold}44`,animation:"float-in 0.4s ease" }}>
      <WaveSeal size={48} color={C.gold} glow={true}/>
      <div style={{ fontFamily:"'JetBrains Mono',monospace",fontSize:11,color:C.gold,
        letterSpacing:"0.14em",marginTop:16,lineHeight:1.8 }}>{msg}</div>
      <div style={{ fontFamily:"'JetBrains Mono',monospace",fontSize:9,color:C.deepGold,marginTop:12 }}>
        — CLICK TO DISMISS —
      </div>
    </div>
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
  const angle=(Math.max(0,idx)/(GENRES.length-1))*180-90;
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
  const mobile=useIsMobile();
  const [tuned,setTuned]=useState(false);
  const [tuning,setTuning]=useState(false);
  const [showStatic,setShowStatic]=useState(false);
  const [genre,setGenre]=useState(GENRES[0].name);
  const [activePlaylist,setActivePlaylist]=useState(GENRES[0].id);
  const [activeGlow,setActiveGlow]=useState(GENRES[0].glow);
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
  const freqRef=useRef(null);

  useEffect(()=>{const t=setTimeout(()=>setSealReady(true),500);return()=>clearTimeout(t);},[]);
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
    fetchData();
  },[]);

  // Easter egg keyboard listener
  useEffect(()=>{
    const handler=(e)=>{
      if(e.key.length===1&&e.key.match(/[A-Za-z]/)){
        const next=(keyBuffer+e.key.toUpperCase()).slice(-8);
        setKeyBuffer(next);
        const egg=EASTER_EGGS[next];
        if(egg){ setEasterEgg(egg); setKeyBuffer(""); }
      }
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
    if(tuned){setTuned(false);setNowPlaying(null);setThumb(null);return;}
    setTuning(true);setShowStatic(true);
    let f=88.0;
    const sweep=setInterval(()=>{
      f+=2;setFreq(parseFloat(f.toFixed(1)));
      if(f>=111.1){clearInterval(sweep);setFreq(111.1);setTimeout(()=>{setTuned(true);setTuning(false);setShowStatic(false);},180);}
    },28);
  },[tuned,tuning]);

  const handleGenre=useCallback((g)=>{
    setGenre(g.name);setActivePlaylist(g.id);setActiveGlow(g.glow);
    if(!tuned) handleTuneIn();
  },[tuned,handleTuneIn]);

  const shareStation=()=>{
    const text=`🎵 Tuned into ${genre} on Alec Penn Radio · 111.1 IM · Free music, no gatekeepers · alecpennradio.com`;
    if(navigator.share){navigator.share({title:"Alec Penn Radio",text,url:"https://alecpennradio.com"});}
    else{navigator.clipboard.writeText(text).then(()=>alert("Copied to clipboard!"));}
  };

  const now=new Date();
  const timeStr=now.toLocaleTimeString([],{hour:"2-digit",minute:"2-digit"});
  const latestTitle=latestVideo?.snippet?.title||"Loading latest drop...";
  const latestId=latestVideo?.id?.videoId||"";
  const pad=mobile?"16px":"32px";
  const currentGenreObj=GENRES.find(g=>g.name===genre)||GENRES[0];

  return (
    <div style={{ minHeight:"100vh",background:C.black,color:C.cream,fontFamily:"'Georgia','Times New Roman',serif",cursor:mobile?"auto":"none",overflowX:"hidden" }}>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Bebas+Neue&family=DM+Serif+Display:ital@0;1&family=JetBrains+Mono:wght@400;500&display=swap');
        *{box-sizing:border-box;margin:0;padding:0;}
        html,body{width:100%;overflow-x:hidden;background:#0A0806;}
        ::-webkit-scrollbar{width:3px;}::-webkit-scrollbar-track{background:#0A0806;}::-webkit-scrollbar-thumb{background:#9E7F35;border-radius:2px;}
        @keyframes vu-bounce{from{height:4px;}to{height:34px;}}
        @keyframes pulse-dot{0%,100%{opacity:1}50%{opacity:0.15}}
        @keyframes freq-flicker{0%,100%{opacity:1}93%{opacity:0.82}95%{opacity:1}}
        @keyframes scanline{0%{transform:translateY(-100%)}100%{transform:translateY(100vh)}}
        @keyframes static-flash{0%{opacity:1}100%{opacity:0}}
        @keyframes on-air-blink{0%,49%{opacity:1}50%,99%{opacity:0}}
        @keyframes glow-pulse{0%,100%{box-shadow:0 0 20px #2F6F6D44}50%{box-shadow:0 0 44px #2F6F6D88}}
        @keyframes horizon-scroll{0%{transform:translateX(0)}100%{transform:translateX(-50%)}}
        @keyframes ticker-scroll{0%{transform:translateX(0)}100%{transform:translateX(-50%)}}
        @keyframes float-in{from{opacity:0;transform:translate(-50%,-60%)}to{opacity:1;transform:translate(-50%,-50%)}}
        .nav-link{color:#D4B96A;text-decoration:none;font-size:12px;letter-spacing:0.1em;text-transform:uppercase;transition:color 0.15s;font-family:'JetBrains Mono',monospace;}
        .nav-link:hover{color:#C2A24D;}
      `}</style>

      {!mobile&&<Cursor/>}
      <StaticFlash show={showStatic}/>
      {easterEgg&&<EasterEggMsg msg={easterEgg.msg} onClose={()=>setEasterEgg(null)}/>}

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
          <WaveSeal size={mobile?38:46} color={tuned?activeGlow:C.gold} glow={tuned}/>
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
              <ListenersCounter active={tuned}/>
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
            <ListenersCounter active={tuned}/>
            <a href={YT} target="_blank" rel="noreferrer" style={{ background:C.burgundy,color:C.cream,padding:"4px 12px",borderRadius:4,fontSize:10,letterSpacing:"0.08em",textDecoration:"none",fontFamily:"'JetBrains Mono',monospace",border:`1px solid ${C.roseMaroon}` }}>YT ↗</a>
            <button onClick={()=>setMenuOpen(o=>!o)} style={{ background:"transparent",border:`1px solid ${C.deepGold}44`,color:C.warmGold,padding:"6px 10px",borderRadius:4,cursor:"pointer",fontFamily:"'JetBrains Mono',monospace",fontSize:14 }}>{menuOpen?"✕":"≡"}</button>
          </div>
        )}
      </nav>

      {mobile&&menuOpen&&(
        <div style={{ background:`${C.black}f8`,backdropFilter:"blur(14px)",borderBottom:`1px solid ${C.deepGold}22`,padding:"16px",display:"flex",flexDirection:"column",gap:12,position:"relative",zIndex:49 }}>
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
          overflow:"hidden",position:"relative",background:"linear-gradient(180deg,#141008 0%,#0A0806 100%)",
          boxShadow:tuned?`0 0 80px ${activeGlow}22,inset 0 1px 0 ${activeGlow}33`:`0 0 40px ${C.deepGold}10,inset 0 1px 0 ${C.gold}14`,
          transform:mobile?"none":`translateY(${scrollY*0.018}px)`,transition:"border-color 0.9s,box-shadow 0.9s" }}>

          <div style={{ position:"absolute",inset:0,zIndex:0 }}><ParticleField active={tuned} glowColor={activeGlow}/></div>

          {/* Title bar */}
          <div style={{ position:"relative",zIndex:2,background:`linear-gradient(90deg,${C.deepBurgundy}cc,#1a1208cc,${C.deepBurgundy}cc)`,borderBottom:`1px solid ${tuned?activeGlow+"33":C.deepGold+"2a"}`,padding:mobile?"7px 14px":"9px 18px",display:"flex",alignItems:"center",justifyContent:"space-between" }}>
            <div style={{ display:"flex",alignItems:"center",gap:8 }}>
              <div style={{ width:6,height:6,borderRadius:"50%",background:tuned?C.sageTeal:C.dustyRose,animation:tuned?"on-air-blink 1.4s step-end infinite":"none" }}/>
              <span style={{ fontFamily:"'JetBrains Mono',monospace",fontSize:9,color:tuned?C.sageTeal:C.dustyRose,letterSpacing:"0.12em" }}>{tuning?"TUNING...":tuned?"ON AIR":"STANDBY"}</span>
              {tuned&&<span style={{ fontFamily:"'JetBrains Mono',monospace",fontSize:9,color:activeGlow,letterSpacing:"0.1em",marginLeft:8 }}>· {genre.toUpperCase()} · {currentGenreObj.mood.toUpperCase()}</span>}
            </div>
            <span style={{ fontFamily:"'JetBrains Mono',monospace",fontSize:mobile?8:11,color:C.warmGold,letterSpacing:"0.1em" }}>APR v2.0 — {timeStr}</span>
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
                  {tuned&&<div style={{ marginTop:8 }}><ListenersCounter active={tuned}/></div>}
                </div>
              </div>

              <p style={{ fontFamily:"'DM Serif Display',serif",fontStyle:"italic",fontSize:mobile?14:16,color:C.dustyRose,marginBottom:20,lineHeight:1.5 }}>
                AI co-created. Multi-genre. Free for everyone.
              </p>

              {/* Freq + oscilloscope + album art */}
              <div style={{ display:"flex",alignItems:"center",gap:12,marginBottom:20,flexWrap:"wrap" }}>
                <div style={{ display:"inline-flex",alignItems:"baseline",gap:4,background:"#030201",border:`1px solid ${tuned?activeGlow+"55":C.deepGold+"28"}`,borderRadius:6,padding:mobile?"8px 14px":"10px 18px",transition:"border-color 0.7s" }}>
                  <span style={{ fontFamily:"'JetBrains Mono',monospace",fontSize:mobile?24:32,fontWeight:500,color:tuning?C.warmGold:tuned?activeGlow:C.gold,letterSpacing:"0.05em",animation:tuned?"freq-flicker 3s ease infinite":"none",transition:"color 0.8s" }}>{freq.toFixed(1)}</span>
                  <span style={{ fontFamily:"'JetBrains Mono',monospace",fontSize:mobile?11:14,color:C.deepGold }}>IM</span>
                </div>
                {!mobile&&<Oscilloscope active={tuned}/>}
                <AlbumArt thumb={thumb} active={tuned}/>
              </div>

              {/* VU + controls */}
              <div style={{ display:"flex",alignItems:"center",gap:16,marginBottom:20,flexWrap:"wrap" }}>
                <VUMeter active={tuned}/>
                <button onClick={handleTuneIn} disabled={tuning}
                  style={{ background:tuned?C.burgundy:C.teal,border:"none",color:C.cream,padding:mobile?"10px 24px":"12px 32px",borderRadius:6,fontSize:mobile?12:13,fontWeight:600,letterSpacing:"0.12em",textTransform:"uppercase",cursor:tuning?"wait":"pointer",fontFamily:"'JetBrains Mono',monospace",animation:tuned?"glow-pulse 2s ease infinite":"none",transition:"background 0.4s" }}>
                  {tuning?"▶ TUNING...":tuned?"■ OFF AIR":"▶ TUNE IN"}
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
              {tuned&&nowPlaying&&(
                <div style={{ display:"flex",alignItems:"center",gap:6,marginBottom:16,maxWidth:400 }}>
                  <div style={{ width:5,height:5,borderRadius:"50%",background:activeGlow,animation:"pulse-dot 1s infinite",flexShrink:0 }}/>
                  <span style={{ fontFamily:"'JetBrains Mono',monospace",fontSize:9,color:C.mistTeal,letterSpacing:"0.06em",overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap" }}>{nowPlaying}</span>
                </div>
              )}

              {/* Genre buttons */}
              <div style={{ display:"flex",gap:6,flexWrap:"wrap" }}>
                {GENRES.map(g=>(
                  <button key={g.name} onClick={()=>handleGenre(g)}
                    style={{ background:genre===g.name?g.glow:"transparent",border:`1px solid ${genre===g.name?g.glow:C.deepGold+"44"}`,color:genre===g.name?C.black:C.warmGold,padding:mobile?"5px 12px":"6px 16px",borderRadius:4,fontSize:10,letterSpacing:"0.08em",textTransform:"uppercase",cursor:"pointer",transition:"all 0.2s",fontFamily:"inherit",fontWeight:genre===g.name?700:400 }}>{g.name}</button>
                ))}
              </div>

              {/* Keyboard hints */}
              {!mobile&&(
                <div style={{ marginTop:12,display:"flex",gap:16 }}>
                  {[["SPACE","tune in/out"],["→","skip"],["↑↓","volume"]].map(([key,label])=>(
                    <div key={key} style={{ display:"flex",alignItems:"center",gap:4 }}>
                      <span style={{ fontFamily:"'JetBrains Mono',monospace",fontSize:8,color:C.black,background:C.deepGold,padding:"1px 5px",borderRadius:3 }}>{key}</span>
                      <span style={{ fontFamily:"'JetBrains Mono',monospace",fontSize:8,color:C.deepGold+"88" }}>{label}</span>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* Right panel */}
            <div style={{ display:"flex",flexDirection:mobile?"row":"column",alignItems:"center",gap:mobile?16:20,justifyContent:mobile?"space-between":"center",flexWrap:mobile?"wrap":"nowrap" }}>
              <FrequencyDial genre={genre} onChange={(name)=>{const g=GENRES.find(x=>x.name===name);if(g)handleGenre(g);}}/>
              {!mobile&&(
                <div style={{ background:"#030201",border:`1px solid ${C.deepGold}22`,borderRadius:8,padding:"16px 20px",minWidth:172 }}>
                  {[{label:"SIGNAL",val:tuned?"████████░░":"███░░░░░░░",col:C.sageTeal},{label:"NOISE",val:tuned?"██░░░░░░░░":"█░░░░░░░░░",col:C.dustyRose},{label:"QUALITY",val:tuned?"█████████░":"████░░░░░░",col:C.gold}].map(m=>(
                    <div key={m.label} style={{ marginBottom:10 }}>
                      <span style={{ fontFamily:"'JetBrains Mono',monospace",fontSize:9,color:C.warmGold,letterSpacing:"0.15em" }}>{m.label}</span>
                      <div style={{ fontFamily:"monospace",fontSize:11,color:m.col,letterSpacing:1,marginTop:3,transition:"color 0.6s" }}>{m.val}</div>
                    </div>
                  ))}
                  <div style={{ borderTop:`1px solid ${C.deepGold}22`,paddingTop:10,marginTop:4 }}>
                    <div style={{ fontFamily:"'JetBrains Mono',monospace",fontSize:9,color:C.warmGold,letterSpacing:"0.1em",marginBottom:4 }}>CATALOG</div>
                    <div style={{ fontFamily:"'JetBrains Mono',monospace",fontSize:22,color:C.gold }}>10,000+</div>
                    <div style={{ fontFamily:"'JetBrains Mono',monospace",fontSize:9,color:C.sageTeal }}>TRACKS · GROWING</div>
                  </div>
                </div>
              )}
              {mobile&&(
                <div style={{ background:"#030201",border:`1px solid ${C.deepGold}22`,borderRadius:8,padding:"12px 16px",textAlign:"center" }}>
                  <div style={{ fontFamily:"'JetBrains Mono',monospace",fontSize:18,color:C.gold }}>10,000+</div>
                  <div style={{ fontFamily:"'JetBrains Mono',monospace",fontSize:8,color:C.sageTeal }}>TRACKS</div>
                </div>
              )}
              <a href="https://edensgate.art" target="_blank" rel="noreferrer"
                style={{ display:"block",width:"100%",textDecoration:"none",background:`linear-gradient(135deg,${C.deepBurgundy},${C.burgundy})`,border:`1px solid ${C.roseMaroon}`,borderRadius:8,padding:mobile?"12px 16px":"14px 20px",textAlign:"center",boxShadow:`0 4px 22px ${C.deepBurgundy}66`,transition:"box-shadow 0.2s" }}
                onMouseEnter={e=>e.currentTarget.style.boxShadow=`0 8px 32px ${C.burgundy}88`}
                onMouseLeave={e=>e.currentTarget.style.boxShadow=`0 4px 22px ${C.deepBurgundy}66`}>
                <div style={{ fontFamily:"'Bebas Neue',sans-serif",fontSize:mobile?15:17,color:C.paleGold,letterSpacing:"0.15em" }}>EDEN'S GATE</div>
                <div style={{ fontFamily:"'JetBrains Mono',monospace",fontSize:9,color:C.dustyRose,marginTop:3 }}>Download the full library ↗</div>
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
            <div style={{ padding:"10px 14px",background:`linear-gradient(90deg,${C.deepBurgundy}88,transparent)`,borderBottom:`1px solid ${C.deepGold}28`,fontFamily:"'JetBrains Mono',monospace",fontSize:9,color:C.warmGold,letterSpacing:"0.15em" }}>▶ TOP 5 — ALL TIME VIEWS</div>
            {loadingYT?<div style={{ padding:20,fontFamily:"'JetBrains Mono',monospace",fontSize:10,color:C.deepGold,textAlign:"center" }}>LOADING SIGNAL...</div>
              :topVideos.length>0?topVideos.map((item,i)=><ChartRow key={item.id} item={item} rank={i+1}/>)
              :<div style={{ padding:20,fontFamily:"'JetBrains Mono',monospace",fontSize:10,color:C.dustyRose,textAlign:"center" }}>NO DATA</div>}
            <div style={{ padding:"10px 14px",textAlign:"center" }}>
              <a href={YT} target="_blank" rel="noreferrer" style={{ fontFamily:"'JetBrains Mono',monospace",fontSize:10,color:C.sageTeal,textDecoration:"none" }}>Full chart on YouTube ↗</a>
            </div>
          </div>
          <div style={{ border:`1px solid ${C.teal}44`,borderRadius:8,overflow:"hidden",background:"#0d0b09",display:"flex",flexDirection:"column" }}>
            <div style={{ padding:"10px 14px",background:`linear-gradient(90deg,${C.teal}44,transparent)`,borderBottom:`1px solid ${C.teal}33`,fontFamily:"'JetBrains Mono',monospace",fontSize:9,color:C.sageTeal,letterSpacing:"0.15em",display:"flex",alignItems:"center",gap:8 }}>
              <div style={{ width:5,height:5,borderRadius:"50%",background:C.sageTeal,animation:"pulse-dot 1s infinite" }}/>
              FRESH DROP — LATEST UPLOAD
            </div>
            <div style={{ flex:1,padding:mobile?16:24,display:"flex",flexDirection:"column",justifyContent:"space-between",gap:16 }}>
              <div>
                <div style={{ fontFamily:"'DM Serif Display',serif",fontSize:mobile?16:20,color:C.cream,marginBottom:8,lineHeight:1.3 }}>{loadingYT?"Loading...":latestTitle}</div>
                <div style={{ fontFamily:"'JetBrains Mono',monospace",fontSize:10,color:C.sageTeal,marginBottom:12 }}>AI co-created with Suno · Free to use</div>
                <div style={{ display:"flex",gap:6,flexWrap:"wrap" }}>
                  {["Lo-Fi","Ambient","Soul","Jazz"].map(tag=>(
                    <span key={tag} style={{ background:`${C.teal}22`,border:`1px solid ${C.teal}44`,color:C.mistTeal,fontSize:9,padding:"2px 8px",borderRadius:20,fontFamily:"'JetBrains Mono',monospace" }}>{tag}</span>
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
            Every track is free to use. Always has been. Always will be. The full catalog — 10,000+ songs and growing — lives at Eden's Gate.
          </p>
          <div style={{ display:"flex",gap:12,justifyContent:"center",flexWrap:"wrap" }}>
            <a href={YT} target="_blank" rel="noreferrer" style={{ background:C.burgundy,color:C.cream,padding:mobile?"12px 20px":"14px 32px",borderRadius:6,textDecoration:"none",fontFamily:"'JetBrains Mono',monospace",fontSize:mobile?11:12,letterSpacing:"0.1em",border:`1px solid ${C.roseMaroon}` }}>▶ Subscribe on YouTube</a>
            <a href="https://edensgate.art" target="_blank" rel="noreferrer" style={{ background:"transparent",color:C.paleGold,padding:mobile?"12px 20px":"14px 32px",borderRadius:6,textDecoration:"none",fontFamily:"'JetBrains Mono',monospace",fontSize:mobile?11:12,letterSpacing:"0.1em",border:`1px solid ${C.deepGold}55` }}>Eden's Gate ↗</a>
          </div>
          {!mobile&&(
            <div style={{ marginTop:24,fontFamily:"'JetBrains Mono',monospace",fontSize:9,color:C.deepGold+"55",letterSpacing:"0.1em" }}>
              PSST — TRY TYPING A SECRET CODE ON YOUR KEYBOARD
            </div>
          )}
        </div>
      </section>

      {/* FOOTER */}
      <footer style={{ borderTop:`1px solid ${C.deepGold}18`,padding:mobile?`20px ${pad}`:`28px ${pad}`,display:"flex",alignItems:"center",justifyContent:"space-between",flexWrap:"wrap",gap:10 }}>
        <div style={{ display:"flex",alignItems:"center",gap:8 }}>
          <WaveSeal size={28} color={C.deepGold}/>
          <div style={{ display:"flex",flexDirection:"column",lineHeight:1.1 }}>
            <span style={{ fontFamily:"'Bebas Neue',sans-serif",fontSize:11,color:C.deepGold,letterSpacing:"0.14em" }}>ALEC PENN</span>
            <span style={{ fontFamily:"'Bebas Neue',sans-serif",fontSize:9,color:C.warmGold,letterSpacing:"0.28em" }}>RADIO</span>
          </div>
        </div>
        {!mobile&&<div style={{ fontFamily:"'JetBrains Mono',monospace",fontSize:9,color:C.roseMaroon,letterSpacing:"0.1em" }}>AI CO-CREATED · FREE TO USE · NO GATEKEEPERS</div>}
        <div style={{ fontFamily:"'JetBrains Mono',monospace",fontSize:9,color:`${C.deepGold}66` }}>© 2026 ALEC PENN RADIO</div>
      </footer>

      <YouTubeRadio playing={tuned} onTrackChange={setNowPlaying} onThumbChange={setThumb} playlistId={activePlaylist} volume={volume}/>
    </div>
  );
}
