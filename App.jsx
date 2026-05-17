import { useState, useEffect, useRef, useCallback } from "react";
import { getLatestVideos, getTopVideos, getTopShorts, formatViews } from "./youtube.js";

const C = {
  black: "#0A0806", gold: "#C2A24D", deepGold: "#9E7F35", warmGold: "#D4B96A",
  paleGold: "#EBD9A0", teal: "#2F6F6D", lazyTeal: "#3D7D7B", sageTeal: "#5E9E9C",
  mistTeal: "#A8C9C8", ghostTeal: "#D6EBEA", burgundy: "#5B2A3C",
  deepBurgundy: "#3D1827", roseMaroon: "#884055", dustyRose: "#C49AAA", cream: "#F4F1EC",
};

const YT = "https://www.youtube.com/@AlecPennRadio";
const GENRES = ["All","Lo-Fi","Hip Hop","Ambient","Jazz","Electronic","Soul","Classical","World"];

function WaveSeal({ size=44, color=C.gold, glow=false }) {
  return (
    <svg viewBox="0 0 1000 1000" width={size} height={size}
      style={{ display:"block", flexShrink:0,
        filter: glow ? `drop-shadow(0 0 10px ${color}88)` : "none",
        transition:"filter 0.6s ease" }}>
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

function AnimatedSeal({ size=120, color=C.gold, triggered=false }) {
  const [drawn, setDrawn] = useState(false);
  useEffect(() => {
    if (!triggered) return;
    const t = setTimeout(() => setDrawn(true), 300);
    return () => clearTimeout(t);
  }, [triggered]);
  const pathLen = 900;
  return (
    <svg viewBox="0 0 1000 1000" width={size} height={size} style={{ display:"block", flexShrink:0 }}>
      <circle cx="500" cy="500" r="440" fill="none" stroke={color} strokeWidth="22"
        style={{ opacity:drawn?1:0, transition:"opacity 0.5s ease 0.2s" }}/>
      <circle cx="500" cy="500" r="396" fill="none" stroke={color} strokeWidth="8"
        style={{ opacity:drawn?1:0, transition:"opacity 0.4s ease 0.5s" }}/>
      <path d="M 104 500 C 170 500, 210 340, 280 340 C 350 340, 390 660, 500 660 C 610 660, 650 340, 720 340 C 790 340, 830 500, 896 500"
        fill="none" stroke={color} strokeWidth="22" strokeLinecap="round" strokeLinejoin="round"
        strokeDasharray={pathLen} strokeDashoffset={drawn ? 0 : pathLen}
        style={{ transition: drawn ? "stroke-dashoffset 1.4s cubic-bezier(0.4,0,0.2,1) 0.6s" : "none" }}/>
      {[456,500,544].map((cx,i) => (
        <circle key={cx} cx={cx} cy="780" r="18" fill={color}
          style={{ opacity:drawn?1:0, transform:drawn?"scale(1)":"scale(0)",
            transformOrigin:`${cx}px 780px`,
            transition:`opacity 0.3s ease ${1.9+i*0.15}s, transform 0.5s cubic-bezier(0.34,1.56,0.64,1) ${1.9+i*0.15}s` }}/>
      ))}
    </svg>
  );
}

function ParticleField({ active }) {
  const canvasRef = useRef(null);
  const animRef = useRef(null);
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    const W = canvas.offsetWidth || 800;
    const H = canvas.offsetHeight || 400;
    canvas.width = W; canvas.height = H;
    const particles = Array.from({ length:55 }, () => ({
      x:Math.random()*W, y:Math.random()*H,
      vx:(Math.random()-0.5)*0.3, vy:(Math.random()-0.5)*0.3,
      size:Math.random()*1.4+0.3,
      opacity:Math.random()*0.35+0.05,
      color:[C.gold,C.sageTeal,C.dustyRose][Math.floor(Math.random()*3)],
    }));
    const tick = () => {
      ctx.clearRect(0,0,W,H);
      particles.forEach(p => {
        p.x += p.vx*(active?2:0.5); p.y += p.vy*(active?2:0.5);
        if (p.x<0) p.x=W; if (p.x>W) p.x=0;
        if (p.y<0) p.y=H; if (p.y>H) p.y=0;
        ctx.beginPath(); ctx.arc(p.x,p.y,p.size,0,Math.PI*2);
        ctx.fillStyle = p.color+Math.floor(p.opacity*255).toString(16).padStart(2,"0");
        ctx.fill();
      });
      animRef.current = requestAnimationFrame(tick);
    };
    tick();
    return () => cancelAnimationFrame(animRef.current);
  }, [active]);
  return <canvas ref={canvasRef} style={{ position:"absolute", inset:0, width:"100%", height:"100%", pointerEvents:"none" }}/>;
}

function VUMeter({ active }) {
  return (
    <div style={{ display:"flex", alignItems:"flex-end", gap:3, height:36 }}>
      {Array.from({length:14}).map((_,i) => (
        <div key={i} style={{ width:4, minHeight:4, borderRadius:2,
          background: i<8?C.teal:i<11?C.gold:C.roseMaroon,
          animation:active?`vu-bounce ${0.22+i*0.038}s ease-in-out infinite alternate`:"none",
          height:active?undefined:4 }}/>
      ))}
    </div>
  );
}

function Oscilloscope({ active }) {
  const canvasRef = useRef(null);
  const animRef = useRef(null);
  const t = useRef(0);
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    const W = canvas.width, H = canvas.height;
    const draw = () => {
      ctx.clearRect(0,0,W,H);
      ctx.strokeStyle = active ? C.sageTeal : C.lazyTeal+"33";
      ctx.lineWidth = 1.5;
      ctx.shadowBlur = active ? 8 : 0;
      ctx.shadowColor = C.sageTeal;
      ctx.beginPath();
      for (let x=0;x<W;x++) {
        const amp = active ? H*0.36 : H*0.03;
        const y = H/2 + amp*(Math.sin(x*0.04+t.current)*0.5+Math.sin(x*0.09+t.current*1.4)*0.3+Math.sin(x*0.02+t.current*0.6)*0.2);
        x===0 ? ctx.moveTo(x,y) : ctx.lineTo(x,y);
      }
      ctx.stroke();
      t.current += active ? 0.065 : 0.008;
      animRef.current = requestAnimationFrame(draw);
    };
    draw();
    return () => cancelAnimationFrame(animRef.current);
  }, [active]);
  return <canvas ref={canvasRef} width={220} height={48}
    style={{ display:"block", borderRadius:4,
      border:`1px solid ${active?C.sageTeal+"44":C.deepGold+"18"}`,
      background:"#030201", transition:"border-color 0.5s" }}/>;
}

function Cursor() {
  const dot = useRef(null);
  const ring = useRef(null);
  const pos = useRef({x:0,y:0});
  const trail = useRef({x:0,y:0});
  useEffect(() => {
    const move = e => { pos.current = {x:e.clientX,y:e.clientY}; };
    window.addEventListener("mousemove", move);
    let raf;
    const loop = () => {
      trail.current.x += (pos.current.x - trail.current.x)*0.1;
      trail.current.y += (pos.current.y - trail.current.y)*0.1;
      if (dot.current) dot.current.style.transform=`translate(${pos.current.x-4}px,${pos.current.y-4}px)`;
      if (ring.current) ring.current.style.transform=`translate(${trail.current.x-13}px,${trail.current.y-13}px)`;
      raf = requestAnimationFrame(loop);
    };
    loop();
    return () => { window.removeEventListener("mousemove",move); cancelAnimationFrame(raf); };
  }, []);
  return (
    <>
      <div ref={ring} style={{ position:"fixed",top:0,left:0,width:26,height:26,borderRadius:"50%",
        border:`1px solid ${C.sageTeal}55`,pointerEvents:"none",zIndex:9998,willChange:"transform" }}/>
      <div ref={dot} style={{ position:"fixed",top:0,left:0,width:8,height:8,borderRadius:"50%",
        background:C.sageTeal,pointerEvents:"none",zIndex:9999,
        boxShadow:`0 0 6px ${C.sageTeal}`,willChange:"transform" }}/>
    </>
  );
}

function StaticFlash({ show }) {
  if (!show) return null;
  return <div style={{ position:"fixed",inset:0,zIndex:200,pointerEvents:"none",
    background:`repeating-linear-gradient(0deg,transparent,transparent 2px,rgba(194,162,77,0.04) 2px,rgba(194,162,77,0.04) 4px)`,
    animation:"static-flash 0.6s ease-out forwards" }}/>;
}

function ChartRow({ item, rank }) {
  const [hov,setHov] = useState(false);
  const videoId = item.id;
  const title = item.snippet?.title || "—";
  const views = formatViews(item.statistics?.viewCount);
  const tags = item.snippet?.tags || [];
  const genre = tags[0] || "Music";
  return (
    <div onClick={()=>window.open(`https://youtube.com/watch?v=${videoId}`,"_blank")}
      onMouseEnter={()=>setHov(true)} onMouseLeave={()=>setHov(false)}
      style={{ display:"grid",gridTemplateColumns:"32px 1fr auto auto",alignItems:"center",
        gap:12,padding:"11px 16px",borderBottom:`1px solid ${C.deepBurgundy}44`,
        cursor:"pointer",background:hov?`${C.deepBurgundy}44`:"transparent",transition:"background 0.15s" }}>
      <span style={{ color:C.deepGold,fontSize:13,fontFamily:"monospace",fontWeight:600 }}>{String(rank).padStart(2,"0")}</span>
      <div>
        <div style={{ color:C.cream,fontSize:13,overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap",maxWidth:220 }}>{title}</div>
        <div style={{ color:C.sageTeal,fontSize:11,marginTop:2 }}>{genre}</div>
      </div>
      <span style={{ color:C.dustyRose,fontSize:11 }}>{views}</span>
      <span style={{ color:hov?C.gold:C.deepGold,fontSize:16,transition:"color 0.15s" }}>›</span>
    </div>
  );
}

function ShortCard({ item }) {
  const [hov,setHov] = useState(false);
  const videoId = item.id;
  const title = item.snippet?.title || "—";
  const likes = formatViews(item.statistics?.likeCount);
  return (
    <div onClick={()=>window.open(`https://youtube.com/watch?v=${videoId}`,"_blank")}
      onMouseEnter={()=>setHov(true)} onMouseLeave={()=>setHov(false)}
      style={{ background:`linear-gradient(160deg,${C.deepBurgundy},${C.black})`,
        border:`1px solid ${hov?C.roseMaroon:C.burgundy+"55"}`,borderRadius:8,
        padding:"20px 16px",cursor:"pointer",
        transform:hov?"translateY(-5px)":"translateY(0)",
        boxShadow:hov?`0 14px 36px ${C.deepBurgundy}99`:"none",
        transition:"all 0.22s cubic-bezier(0.34,1.56,0.64,1)",
        display:"flex",flexDirection:"column",gap:8 }}>
      <div style={{ fontSize:22,color:C.roseMaroon }}>▶</div>
      <div style={{ color:C.cream,fontSize:13,fontWeight:500,lineHeight:1.3,
        overflow:"hidden",textOverflow:"ellipsis",display:"-webkit-box",
        WebkitLineClamp:2,WebkitBoxOrient:"vertical" }}>{title}</div>
      <div style={{ display:"flex",alignItems:"center",gap:6 }}>
        <span style={{ color:C.gold,fontSize:11 }}>♥</span>
        <span style={{ color:C.dustyRose,fontSize:11 }}>{likes}</span>
      </div>
    </div>
  );
}

function FrequencyDial({ genre, onChange }) {
  const angle = (GENRES.indexOf(genre)/(GENRES.length-1))*180-90;
  return (
    <div style={{ display:"flex",flexDirection:"column",alignItems:"center",gap:8 }}>
      <div style={{ width:70,height:70,borderRadius:"50%",
        border:`2px solid ${C.gold}`,background:`radial-gradient(circle at 30% 30%,#1a1208,${C.black})`,
        position:"relative",cursor:"pointer",boxShadow:`0 0 22px ${C.deepGold}55` }}>
        <div style={{ width:2,height:28,background:C.gold,borderRadius:1,
          transformOrigin:"bottom center",transform:`rotate(${angle}deg)`,
          position:"absolute",bottom:"50%",left:"calc(50% - 1px)",
          transition:"transform 0.4s cubic-bezier(0.34,1.56,0.64,1)" }}/>
        <div style={{ width:8,height:8,borderRadius:"50%",background:C.gold,
          position:"absolute",bottom:"calc(50% - 4px)",left:"calc(50% - 4px)" }}/>
      </div>
      <select value={genre} onChange={e=>onChange(e.target.value)}
        style={{ background:"transparent",border:`1px solid ${C.deepGold}`,
          color:C.paleGold,fontSize:11,padding:"3px 8px",borderRadius:4,
          cursor:"pointer",fontFamily:"inherit",letterSpacing:"0.06em" }}>
        {GENRES.map(g=><option key={g} value={g} style={{ background:C.black }}>{g}</option>)}
      </select>
    </div>
  );
}

export default function AlecPennRadio() {
  const [tuned,setTuned] = useState(false);
  const [tuning,setTuning] = useState(false);
  const [showStatic,setShowStatic] = useState(false);
  const [genre,setGenre] = useState("All");
  const [freq,setFreq] = useState(111.1);
  const [sealReady,setSealReady] = useState(false);
  const [scrollY,setScrollY] = useState(0);
  const [topVideos,setTopVideos] = useState([]);
  const [latestVideo,setLatestVideo] = useState(null);
  const [shorts,setShorts] = useState([]);
  const [loadingYT,setLoadingYT] = useState(true);
  const freqRef = useRef(null);

  useEffect(() => { const t=setTimeout(()=>setSealReady(true),500); return ()=>clearTimeout(t); },[]);

  useEffect(() => {
    const fn = ()=>setScrollY(window.scrollY);
    window.addEventListener("scroll",fn,{passive:true});
    return ()=>window.removeEventListener("scroll",fn);
  },[]);

  useEffect(() => {
    if (!tuned) { setFreq(111.1); return; }
    const tick = () => {
      setFreq(f=>parseFloat((Math.min(111.6,Math.max(110.6,f+(Math.random()-0.48)*0.09))).toFixed(1)));
      freqRef.current = setTimeout(tick,140);
    };
    freqRef.current = setTimeout(tick,140);
    return ()=>clearTimeout(freqRef.current);
  },[tuned]);

  // Fetch real YouTube data
  useEffect(() => {
    async function fetchData() {
      setLoadingYT(true);
      try {
        const [top, latest, sh] = await Promise.all([
          getTopVideos(),
          getLatestVideos(),
          getTopShorts(),
        ]);
        setTopVideos(top);
        setLatestVideo(latest[0] || null);
        setShorts(sh);
      } catch(e) {
        console.error(e);
      }
      setLoadingYT(false);
    }
    fetchData();
  }, []);

  const handleTuneIn = useCallback(()=>{
    if (tuning) return;
    if (tuned) { setTuned(false); return; }
    setTuning(true); setShowStatic(true);
    let f=88.0;
    const sweep = setInterval(()=>{
      f+=2; setFreq(parseFloat(f.toFixed(1)));
      if (f>=111.1) {
        clearInterval(sweep); setFreq(111.1);
        setTimeout(()=>{ setTuned(true); setTuning(false); setShowStatic(false); },180);
      }
    },28);
  },[tuned,tuning]);

  const now = new Date();
  const timeStr = now.toLocaleTimeString([],{hour:"2-digit",minute:"2-digit"});
  const latestTitle = latestVideo?.snippet?.title || "Loading latest drop...";
  const latestId = latestVideo?.id?.videoId || "";

  return (
    <div style={{ minHeight:"100vh",background:C.black,color:C.cream,
      fontFamily:"'Georgia','Times New Roman',serif",cursor:"none" }}>

      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Bebas+Neue&family=DM+Serif+Display:ital@0;1&family=JetBrains+Mono:wght@400;500&display=swap');
        *{box-sizing:border-box;margin:0;padding:0;}
        ::-webkit-scrollbar{width:4px;}
        ::-webkit-scrollbar-track{background:${C.black};}
        ::-webkit-scrollbar-thumb{background:${C.deepGold};border-radius:2px;}
        @keyframes vu-bounce{from{height:4px;}to{height:34px;}}
        @keyframes pulse-dot{0%,100%{opacity:1}50%{opacity:0.15}}
        @keyframes freq-flicker{0%,100%{opacity:1}93%{opacity:0.82}95%{opacity:1}}
        @keyframes scanline{0%{transform:translateY(-100%)}100%{transform:translateY(100vh)}}
        @keyframes static-flash{0%{opacity:1}100%{opacity:0}}
        @keyframes on-air-blink{0%,49%{opacity:1}50%,99%{opacity:0}}
        @keyframes glow-pulse{0%,100%{box-shadow:0 0 20px ${C.teal}44}50%{box-shadow:0 0 44px ${C.teal}88}}
        @keyframes horizon-scroll{0%{transform:translateX(0)}100%{transform:translateX(-50%)}}
        .nav-link{color:${C.warmGold};text-decoration:none;font-size:12px;letter-spacing:0.1em;
          text-transform:uppercase;transition:color 0.15s;font-family:'JetBrains Mono',monospace;}
        .nav-link:hover{color:${C.gold};}
      `}</style>

      <Cursor/>
      <StaticFlash show={showStatic}/>

      <div style={{ position:"fixed",inset:0,pointerEvents:"none",zIndex:100,overflow:"hidden",opacity:0.022 }}>
        <div style={{ width:"100%",height:2,background:C.cream,animation:"scanline 9s linear infinite" }}/>
      </div>

      <div style={{ position:"fixed",inset:0,pointerEvents:"none",zIndex:0,
        background: tuned
          ? `radial-gradient(ellipse 80% 50% at 50% 0%,${C.teal}1a 0%,transparent 70%),radial-gradient(ellipse 50% 40% at 85% 100%,${C.deepBurgundy}28 0%,transparent 60%)`
          : `radial-gradient(ellipse 60% 40% at 50% 0%,${C.deepGold}0a 0%,transparent 70%)`,
        transition:"background 1.8s ease" }}/>

      {/* NAV */}
      <nav style={{ position:"sticky",top:0,zIndex:50,
        background:`${C.black}f2`,backdropFilter:"blur(14px)",
        borderBottom:`1px solid ${tuned?C.teal+"55":C.deepGold+"22"}`,
        padding:"0 32px",display:"flex",alignItems:"center",justifyContent:"space-between",
        height:60,transition:"border-color 0.7s" }}>
        <div style={{ display:"flex",alignItems:"center",gap:12 }}>
          <WaveSeal size={48} color={C.gold} glow={tuned}/>
          <div style={{ display:"flex",flexDirection:"column",gap:0,lineHeight:1 }}>
            <span style={{ fontFamily:"'Bebas Neue',sans-serif",fontSize:18,color:C.cream,letterSpacing:"0.14em" }}>ALEC PENN</span>
            <span style={{ fontFamily:"'Bebas Neue',sans-serif",fontSize:13,color:C.gold,letterSpacing:"0.3em" }}>RADIO</span>
          </div>
          <div style={{ width:7,height:7,borderRadius:"50%",marginLeft:4,
            background:tuned?C.sageTeal:C.roseMaroon,
            animation:tuned?"on-air-blink 1.4s step-end infinite":"none",
            boxShadow:tuned?`0 0 8px ${C.sageTeal}`:"none",
            transition:"background 0.5s,box-shadow 0.5s" }}/>
        </div>
        <div style={{ flex:1,margin:"0 28px",overflow:"hidden",height:18 }}>
          <div style={{ display:"flex",gap:36,whiteSpace:"nowrap",
            animation:"horizon-scroll 22s linear infinite",width:"max-content" }}>
            {[...GENRES,...GENRES].map((g,i)=>(
              <span key={i} onClick={()=>setGenre(g)}
                style={{ fontFamily:"'JetBrains Mono',monospace",fontSize:10,
                  color:g===genre?C.gold:C.deepGold+"55",letterSpacing:"0.14em",
                  cursor:"pointer",transition:"color 0.2s" }}>{g}</span>
            ))}
          </div>
        </div>
        <div style={{ display:"flex",gap:22,alignItems:"center" }}>
          <a href="#broadcast" className="nav-link">Broadcast</a>
          <a href="#charts" className="nav-link">Charts</a>
          <a href="#mission" className="nav-link">Mission</a>
          <a href={YT} target="_blank" rel="noreferrer"
            style={{ background:C.burgundy,color:C.cream,padding:"5px 14px",borderRadius:4,
              fontSize:11,letterSpacing:"0.08em",textDecoration:"none",textTransform:"uppercase",
              fontFamily:"'JetBrains Mono',monospace",border:`1px solid ${C.roseMaroon}` }}>
            YouTube ↗
          </a>
          <div style={{ display:"flex",gap:0,marginLeft:4 }}>
            {[{l:"─"},{l:"□"},{l:"✕"}].map((b,i)=>(
              <div key={i} style={{ width:32,height:24,display:"flex",alignItems:"center",
                justifyContent:"center",fontSize:i===2?11:13,color:C.warmGold,cursor:"default",
                borderLeft:`1px solid ${C.deepGold}22`,userSelect:"none",transition:"background 0.1s" }}
                onMouseEnter={e=>e.currentTarget.style.background=i===2?"#8B1A1A":`${C.deepGold}22`}
                onMouseLeave={e=>e.currentTarget.style.background="transparent"}>{b.l}</div>
            ))}
          </div>
        </div>
      </nav>

      {/* HERO */}
      <section id="broadcast" style={{ padding:"48px 32px 40px",maxWidth:1140,margin:"0 auto",position:"relative" }}>
        <div style={{
          border:`1px solid ${tuned?C.teal+"66":C.deepGold+"44"}`,borderRadius:14,
          overflow:"hidden",position:"relative",
          background:"linear-gradient(180deg,#141008 0%,#0A0806 100%)",
          boxShadow:tuned?`0 0 90px ${C.teal}20,inset 0 1px 0 ${C.teal}33`:`0 0 60px ${C.deepGold}12,inset 0 1px 0 ${C.gold}18`,
          transform:`translateY(${scrollY*0.018}px)`,
          transition:"border-color 0.9s,box-shadow 0.9s" }}>
          <div style={{ position:"absolute",inset:0,zIndex:0 }}><ParticleField active={tuned}/></div>

          {/* Title bar */}
          <div style={{ position:"relative",zIndex:2,
            background:`linear-gradient(90deg,${C.deepBurgundy}cc,#1a1208cc,${C.deepBurgundy}cc)`,
            borderBottom:`1px solid ${tuned?C.teal+"44":C.deepGold+"2a"}`,
            padding:"9px 18px",display:"flex",alignItems:"center",justifyContent:"space-between" }}>
            <div style={{ display:"flex",alignItems:"center",gap:8 }}>
              <div style={{ width:6,height:6,borderRadius:"50%",
                background:tuned?C.sageTeal:C.dustyRose,
                animation:tuned?"on-air-blink 1.4s step-end infinite":"none",
                boxShadow:tuned?`0 0 6px ${C.sageTeal}`:"none" }}/>
              <span style={{ fontFamily:"'JetBrains Mono',monospace",fontSize:10,
                color:tuned?C.sageTeal:C.dustyRose,letterSpacing:"0.15em" }}>
                {tuning?"TUNING...":tuned?"ON AIR":"STANDBY"}
              </span>
            </div>
            <span style={{ fontFamily:"'JetBrains Mono',monospace",fontSize:11,color:C.warmGold,letterSpacing:"0.15em" }}>
              APR BROADCAST CONSOLE v2.0 — {timeStr}
            </span>
            <div style={{ display:"flex",gap:0 }}>
              {[{l:"─"},{l:"□"},{l:"✕"}].map((b,i)=>(
                <div key={i} style={{ width:32,height:22,display:"flex",alignItems:"center",
                  justifyContent:"center",fontSize:i===2?10:12,color:C.warmGold,cursor:"default",
                  borderLeft:`1px solid ${C.deepGold}22`,userSelect:"none",transition:"background 0.1s" }}
                  onMouseEnter={e=>e.currentTarget.style.background=i===2?"#8B1A1A":`${C.deepGold}22`}
                  onMouseLeave={e=>e.currentTarget.style.background="transparent"}>{b.l}</div>
              ))}
            </div>
          </div>

          <div style={{ position:"relative",zIndex:2,padding:"36px 36px 32px",
            display:"grid",gridTemplateColumns:"1fr auto",gap:48,alignItems:"center" }}>
            <div>
              <div style={{ marginBottom:10 }}>
                <span style={{ fontFamily:"'JetBrains Mono',monospace",fontSize:11,color:C.sageTeal,letterSpacing:"0.15em" }}>BROADCASTING SINCE 2026</span>
              </div>
              <div style={{ display:"flex",alignItems:"center",gap:24,marginBottom:14 }}>
                <AnimatedSeal size={112} color={tuned?C.gold:C.warmGold} triggered={sealReady}/>
                <h1 style={{ fontFamily:"'Bebas Neue',sans-serif",fontSize:"clamp(50px,7vw,88px)",
                  color:C.gold,letterSpacing:"0.06em",lineHeight:0.88,
                  animation:tuned?"freq-flicker 5s ease infinite":"none" }}>
                  ALEC PENN<br/><span style={{ color:C.cream }}>RADIO</span>
                </h1>
              </div>
              <p style={{ fontFamily:"'DM Serif Display',serif",fontStyle:"italic",
                fontSize:16,color:C.dustyRose,marginBottom:28,lineHeight:1.5 }}>
                AI co-created. Multi-genre. Free for everyone.
              </p>
              <div style={{ display:"flex",alignItems:"center",gap:16,marginBottom:24 }}>
                <div style={{ display:"inline-flex",alignItems:"baseline",gap:4,
                  background:"#030201",border:`1px solid ${tuned?C.teal+"55":C.deepGold+"28"}`,
                  borderRadius:6,padding:"10px 18px",transition:"border-color 0.7s" }}>
                  <span style={{ fontFamily:"'JetBrains Mono',monospace",fontSize:32,fontWeight:500,
                    color:tuning?C.warmGold:C.gold,letterSpacing:"0.05em",
                    animation:tuned?"freq-flicker 3s ease infinite":"none",transition:"color 0.3s" }}>{freq.toFixed(1)}</span>
                  <span style={{ fontFamily:"'JetBrains Mono',monospace",fontSize:14,color:C.deepGold }}>IM</span>
                </div>
                <Oscilloscope active={tuned}/>
              </div>
              <div style={{ display:"flex",alignItems:"center",gap:20,marginBottom:24 }}>
                <VUMeter active={tuned}/>
                <button onClick={handleTuneIn} disabled={tuning}
                  style={{ background:tuned?C.burgundy:C.teal,border:"none",color:C.cream,
                    padding:"12px 32px",borderRadius:6,fontSize:13,fontWeight:600,
                    letterSpacing:"0.12em",textTransform:"uppercase",
                    cursor:tuning?"wait":"pointer",fontFamily:"'JetBrains Mono',monospace",
                    animation:tuned?"glow-pulse 2s ease infinite":"none",transition:"background 0.4s" }}>
                  {tuning?"▶ TUNING...":tuned?"■ OFF AIR":"▶ TUNE IN"}
                </button>
                {tuned && (
                  <a href={YT} target="_blank" rel="noreferrer"
                    style={{ color:C.warmGold,fontSize:12,fontFamily:"'JetBrains Mono',monospace",
                      letterSpacing:"0.08em",textDecoration:"none",borderBottom:`1px solid ${C.deepGold}` }}>
                    Open on YouTube ↗
                  </a>
                )}
              </div>
              <div style={{ display:"flex",gap:8,flexWrap:"wrap" }}>
                {GENRES.slice(1,7).map(g=>(
                  <button key={g} onClick={()=>setGenre(g===genre?"All":g)}
                    style={{ background:genre===g?C.teal:"transparent",
                      border:`1px solid ${genre===g?C.teal:C.deepGold+"44"}`,
                      color:genre===g?C.cream:C.warmGold,padding:"6px 16px",borderRadius:4,
                      fontSize:11,letterSpacing:"0.08em",textTransform:"uppercase",
                      cursor:"pointer",transition:"all 0.15s",fontFamily:"inherit" }}>{g}</button>
                ))}
              </div>
            </div>

            <div style={{ display:"flex",flexDirection:"column",alignItems:"center",gap:20 }}>
              <FrequencyDial genre={genre} onChange={setGenre}/>
              <div style={{ background:"#030201",border:`1px solid ${C.deepGold}22`,borderRadius:8,padding:"16px 20px",minWidth:172 }}>
                {[
                  {label:"SIGNAL",val:tuned?"████████░░":"███░░░░░░░",col:C.sageTeal},
                  {label:"NOISE", val:tuned?"██░░░░░░░░":"█░░░░░░░░░",col:C.dustyRose},
                  {label:"QUALITY",val:tuned?"█████████░":"████░░░░░░",col:C.gold},
                ].map(m=>(
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
              <a href="#" style={{ display:"block",width:"100%",textDecoration:"none",
                background:`linear-gradient(135deg,${C.deepBurgundy},${C.burgundy})`,
                border:`1px solid ${C.roseMaroon}`,borderRadius:8,padding:"14px 20px",
                textAlign:"center",boxShadow:`0 4px 22px ${C.deepBurgundy}66`,transition:"box-shadow 0.2s" }}
                onMouseEnter={e=>e.currentTarget.style.boxShadow=`0 8px 32px ${C.burgundy}88`}
                onMouseLeave={e=>e.currentTarget.style.boxShadow=`0 4px 22px ${C.deepBurgundy}66`}>
                <div style={{ fontFamily:"'Bebas Neue',sans-serif",fontSize:17,color:C.paleGold,letterSpacing:"0.15em" }}>EDEN'S GATE</div>
                <div style={{ fontFamily:"'JetBrains Mono',monospace",fontSize:10,color:C.dustyRose,marginTop:3 }}>Download the full library ↗</div>
              </a>
            </div>
          </div>
        </div>
      </section>

      {/* CHARTS */}
      <section id="charts" style={{ padding:"40px 32px",maxWidth:1140,margin:"0 auto" }}>
        <div style={{ display:"flex",alignItems:"baseline",gap:16,marginBottom:24 }}>
          <h2 style={{ fontFamily:"'Bebas Neue',sans-serif",fontSize:34,color:C.gold,letterSpacing:"0.1em" }}>TOP CHARTS</h2>
          <span style={{ fontFamily:"'JetBrains Mono',monospace",fontSize:11,color:C.sageTeal }}>
            {loadingYT ? "Loading from YouTube..." : "Most watched on YouTube"}
          </span>
        </div>
        <div style={{ display:"grid",gridTemplateColumns:"1fr 1fr",gap:24 }}>
          <div style={{ border:`1px solid ${C.deepGold}28`,borderRadius:8,overflow:"hidden",background:"#0d0b09" }}>
            <div style={{ padding:"10px 16px",background:`linear-gradient(90deg,${C.deepBurgundy}88,transparent)`,
              borderBottom:`1px solid ${C.deepGold}28`,fontFamily:"'JetBrains Mono',monospace",
              fontSize:10,color:C.warmGold,letterSpacing:"0.15em" }}>▶ TOP 5 — ALL TIME VIEWS</div>
            {loadingYT ? (
              <div style={{ padding:24,fontFamily:"'JetBrains Mono',monospace",fontSize:11,color:C.deepGold,textAlign:"center" }}>
                LOADING SIGNAL...
              </div>
            ) : topVideos.length > 0 ? (
              topVideos.map((item,i)=><ChartRow key={item.id} item={item} rank={i+1}/>)
            ) : (
              <div style={{ padding:24,fontFamily:"'JetBrains Mono',monospace",fontSize:11,color:C.dustyRose,textAlign:"center" }}>
                CHECK API KEY IN VERCEL ENV
              </div>
            )}
            <div style={{ padding:"12px 16px",textAlign:"center" }}>
              <a href={YT} target="_blank" rel="noreferrer"
                style={{ fontFamily:"'JetBrains Mono',monospace",fontSize:11,color:C.sageTeal,textDecoration:"none",letterSpacing:"0.08em" }}>
                Full chart on YouTube ↗
              </a>
            </div>
          </div>

          {/* Fresh Drop */}
          <div style={{ border:`1px solid ${C.teal}44`,borderRadius:8,overflow:"hidden",background:"#0d0b09",display:"flex",flexDirection:"column" }}>
            <div style={{ padding:"10px 16px",background:`linear-gradient(90deg,${C.teal}44,transparent)`,
              borderBottom:`1px solid ${C.teal}33`,fontFamily:"'JetBrains Mono',monospace",
              fontSize:10,color:C.sageTeal,letterSpacing:"0.15em",display:"flex",alignItems:"center",gap:8 }}>
              <div style={{ width:6,height:6,borderRadius:"50%",background:C.sageTeal,animation:"pulse-dot 1s infinite" }}/>
              FRESH DROP — LATEST UPLOAD
            </div>
            <div style={{ flex:1,padding:24,display:"flex",flexDirection:"column",justifyContent:"space-between" }}>
              <div>
                <div style={{ fontFamily:"'DM Serif Display',serif",fontSize:20,color:C.cream,marginBottom:8,lineHeight:1.3 }}>
                  {loadingYT ? "Loading..." : latestTitle}
                </div>
                <div style={{ fontFamily:"'JetBrains Mono',monospace",fontSize:11,color:C.sageTeal,marginBottom:16 }}>
                  AI co-created with Suno · Free to use
                </div>
                <div style={{ display:"flex",gap:8,flexWrap:"wrap",marginBottom:20 }}>
                  {["Lo-Fi","Ambient","Soul","Jazz"].map(tag=>(
                    <span key={tag} style={{ background:`${C.teal}22`,border:`1px solid ${C.teal}44`,
                      color:C.mistTeal,fontSize:10,padding:"3px 10px",borderRadius:20,
                      fontFamily:"'JetBrains Mono',monospace",letterSpacing:"0.06em" }}>{tag}</span>
                  ))}
                </div>
              </div>
              <a href={latestId ? `https://youtube.com/watch?v=${latestId}` : YT}
                target="_blank" rel="noreferrer"
                style={{ display:"block",background:C.teal,color:C.cream,padding:"12px 20px",
                  borderRadius:6,textAlign:"center",textDecoration:"none",
                  fontFamily:"'JetBrains Mono',monospace",fontSize:12,letterSpacing:"0.1em",fontWeight:500 }}>
                ▶ Watch Latest on YouTube
              </a>
            </div>
          </div>
        </div>
      </section>

      {/* SHORTS */}
      <section id="shorts" style={{ padding:"40px 32px",maxWidth:1140,margin:"0 auto" }}>
        <div style={{ display:"flex",alignItems:"baseline",gap:16,marginBottom:24 }}>
          <h2 style={{ fontFamily:"'Bebas Neue',sans-serif",fontSize:34,color:C.gold,letterSpacing:"0.1em" }}>SHORTS HALL OF FAME</h2>
          <span style={{ fontFamily:"'JetBrains Mono',monospace",fontSize:11,color:C.dustyRose }}>Most liked clips</span>
        </div>
        <div style={{ display:"grid",gridTemplateColumns:"repeat(auto-fit,minmax(180px,1fr))",gap:16 }}>
          {loadingYT ? (
            <div style={{ fontFamily:"'JetBrains Mono',monospace",fontSize:11,color:C.deepGold }}>LOADING SIGNAL...</div>
          ) : shorts.length > 0 ? (
            shorts.map(item=><ShortCard key={item.id} item={item}/>)
          ) : (
            [{ title:"1AM Vibes",likes:"—" },{ title:"Rain Loop #7",likes:"—" },
             { title:"Sunrise Set",likes:"—" },{ title:"Deep Focus",likes:"—" }].map(item=>(
              <div key={item.title} style={{ background:`linear-gradient(160deg,${C.deepBurgundy},${C.black})`,
                border:`1px solid ${C.burgundy}55`,borderRadius:8,padding:"20px 16px",
                display:"flex",flexDirection:"column",gap:8 }}>
                <div style={{ fontSize:22,color:C.roseMaroon }}>▶</div>
                <div style={{ color:C.cream,fontSize:13 }}>{item.title}</div>
              </div>
            ))
          )}
        </div>
        <div style={{ textAlign:"center",marginTop:20 }}>
          <a href={`${YT}/shorts`} target="_blank" rel="noreferrer"
            style={{ fontFamily:"'JetBrains Mono',monospace",fontSize:11,color:C.dustyRose,textDecoration:"none",letterSpacing:"0.08em" }}>
            All Shorts on YouTube ↗
          </a>
        </div>
      </section>

      {/* MISSION */}
      <section id="mission" style={{ padding:"80px 32px",maxWidth:1140,margin:"0 auto",
        borderTop:`1px solid ${C.deepGold}18`,position:"relative",overflow:"hidden" }}>
        <div style={{ position:"absolute",top:"50%",left:"50%",transform:"translate(-50%,-50%)",opacity:0.028,pointerEvents:"none" }}>
          <WaveSeal size={420} color={C.gold}/>
        </div>
        <div style={{ maxWidth:680,margin:"0 auto",textAlign:"center",position:"relative" }}>
          <div style={{ fontFamily:"'JetBrains Mono',monospace",fontSize:11,color:C.sageTeal,letterSpacing:"0.2em",marginBottom:16 }}>THE SIGNAL</div>
          <h2 style={{ fontFamily:"'DM Serif Display',serif",fontSize:"clamp(28px,5vw,48px)",color:C.cream,lineHeight:1.2,marginBottom:20 }}>
            Music made to be <em style={{ color:C.gold }}>given away.</em>
          </h2>
          <p style={{ fontFamily:"'Georgia',serif",fontSize:16,color:C.dustyRose,lineHeight:1.85,marginBottom:16 }}>
            Alec Penn Radio is a co-creation between human vision and AI — built with Suno,
            broadcast on YouTube, and offered to the world without cost, without gatekeepers, without strings.
          </p>
          <p style={{ fontFamily:"'Georgia',serif",fontSize:16,color:C.mistTeal,lineHeight:1.85,marginBottom:40 }}>
            Every track is free to use. Always has been. Always will be.
            The full catalog — 10,000+ songs and growing — lives at Eden's Gate.
          </p>
          <div style={{ display:"flex",gap:16,justifyContent:"center",flexWrap:"wrap" }}>
            <a href={YT} target="_blank" rel="noreferrer"
              style={{ background:C.burgundy,color:C.cream,padding:"14px 32px",borderRadius:6,
                textDecoration:"none",fontFamily:"'JetBrains Mono',monospace",fontSize:12,
                letterSpacing:"0.1em",border:`1px solid ${C.roseMaroon}`,
                boxShadow:`0 4px 20px ${C.deepBurgundy}66`,transition:"box-shadow 0.2s" }}
              onMouseEnter={e=>e.currentTarget.style.boxShadow=`0 8px 32px ${C.burgundy}88`}
              onMouseLeave={e=>e.currentTarget.style.boxShadow=`0 4px 20px ${C.deepBurgundy}66`}>
              ▶ Subscribe on YouTube
            </a>
            <a href="#" style={{ background:"transparent",color:C.paleGold,padding:"14px 32px",
              borderRadius:6,textDecoration:"none",fontFamily:"'JetBrains Mono',monospace",
              fontSize:12,letterSpacing:"0.1em",border:`1px solid ${C.deepGold}55`,transition:"all 0.2s" }}
              onMouseEnter={e=>{ e.currentTarget.style.borderColor=C.gold; e.currentTarget.style.color=C.gold; }}
              onMouseLeave={e=>{ e.currentTarget.style.borderColor=`${C.deepGold}55`; e.currentTarget.style.color=C.paleGold; }}>
              Eden's Gate — Full Library ↗
            </a>
          </div>
        </div>
      </section>

      {/* FOOTER */}
      <footer style={{ borderTop:`1px solid ${C.deepGold}18`,padding:"28px 32px",
        display:"flex",alignItems:"center",justifyContent:"space-between",flexWrap:"wrap",gap:12 }}>
        <div style={{ display:"flex",alignItems:"center",gap:10 }}>
          <WaveSeal size={34} color={C.deepGold}/>
          <div style={{ display:"flex",flexDirection:"column",lineHeight:1.1 }}>
            <span style={{ fontFamily:"'Bebas Neue',sans-serif",fontSize:13,color:C.deepGold,letterSpacing:"0.14em" }}>ALEC PENN</span>
            <span style={{ fontFamily:"'Bebas Neue',sans-serif",fontSize:10,color:C.warmGold,letterSpacing:"0.28em" }}>RADIO</span>
          </div>
        </div>
        <div style={{ fontFamily:"'JetBrains Mono',monospace",fontSize:10,color:C.roseMaroon,letterSpacing:"0.1em" }}>
          AI CO-CREATED · FREE TO USE · NO GATEKEEPERS
        </div>
        <div style={{ fontFamily:"'JetBrains Mono',monospace",fontSize:10,color:`${C.deepGold}77` }}>
          © 2026 ALEC PENN RADIO
        </div>
      </footer>
    </div>
  );
}
