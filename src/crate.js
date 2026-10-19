// APR RECORD CRATE — every station is a record sleeve standing in a wooden crate.
// Flip through them (drag / swipe / scroll / arrow keys) like digging for vinyl; tap the front record to pull it
// out and put it on. Loaded lazily; the page keeps its plain station buttons if 3D can't run.
import * as THREE from "three";
import { RoomEnvironment } from "three/examples/jsm/environments/RoomEnvironment.js";

const GOLD = 0xc2a24d;

function woodTexture() {
  const c = document.createElement("canvas"); c.width = 512; c.height = 128; const g = c.getContext("2d");
  g.fillStyle = "#5a3a22"; g.fillRect(0, 0, 512, 128);
  for (let i = 0; i < 60; i++) {   // grain
    g.strokeStyle = `rgba(${30 + Math.random() * 30},${18 + Math.random() * 14},${8},${0.25 + Math.random() * 0.3})`;
    g.lineWidth = 1 + Math.random() * 2; g.beginPath();
    const y = Math.random() * 128; g.moveTo(0, y);
    for (let x = 0; x <= 512; x += 32) g.lineTo(x, y + Math.sin(x / 70 + i) * 3 + (Math.random() - 0.5) * 2);
    g.stroke();
  }
  const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; t.wrapS = t.wrapT = THREE.RepeatWrapping; return t;
}
function brandTexture() {   // stencilled on the front of the crate
  const c = document.createElement("canvas"); c.width = 512; c.height = 128; const g = c.getContext("2d");
  g.fillStyle = "rgba(0,0,0,0)"; g.fillRect(0, 0, 512, 128);
  g.font = "bold 44px 'Bebas Neue', Impact, sans-serif"; g.textAlign = "center"; g.textBaseline = "middle";
  g.fillStyle = "rgba(225,196,120,0.85)"; g.fillText("ALEC PENN RADIO · 111.1", 256, 66);
  const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; return t;
}

export function createCrate(canvas, { stations = [], current = "", mobile = false, onPick = () => {}, onFocus = () => {} } = {}) {
  const renderer = new THREE.WebGLRenderer({ canvas, antialias: true, alpha: true });
  renderer.setPixelRatio(Math.min(devicePixelRatio || 1, mobile ? 1.5 : 2));
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  const scene = new THREE.Scene();
  const pmrem = new THREE.PMREMGenerator(renderer);
  scene.environment = pmrem.fromScene(new RoomEnvironment(), 0.04).texture; scene.environmentIntensity = 0.55;
  const key = new THREE.DirectionalLight(0xfff0d8, 1.8); key.position.set(2, 5, 5); scene.add(key);
  const rim = new THREE.PointLight(GOLD, 8, 10, 1.6); rim.position.set(-2.5, 2, -1.5); scene.add(rim);
  const camera = new THREE.PerspectiveCamera(30, 1, 0.1, 50);

  // ── the crate ──
  const W = 2.0, D = 2.7, H = 1.05, T = 0.08;           // a little wider than a sleeve (1.8), deep enough for every station
  const wood = woodTexture(), woodMat = new THREE.MeshStandardMaterial({ map: wood, roughness: 0.8, metalness: 0 });
  const crate = new THREE.Group(); scene.add(crate);
  const slat = (w, h, d, x, y, z) => { const m = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), woodMat); m.position.set(x, y, z); crate.add(m); return m; };
  slat(W + 2 * T, T, D + 2 * T, 0, -T / 2, 0);                                // floor
  for (const s of [-1, 1]) {                                                  // sides with a hand-hole gap
    slat(T, H * 0.42, D + 2 * T, s * (W / 2 + T / 2), H * 0.21, 0);
    slat(T, H * 0.38, D + 2 * T, s * (W / 2 + T / 2), H * 0.78, 0);
  }
  slat(W + 2 * T, H * 0.55, T, 0, H * 0.275, -D / 2 - T / 2);                // back
  const front = slat(W + 2 * T, H * 0.5, T, 0, H * 0.25, D / 2 + T / 2);     // front (lower, so you can see in)
  const brand = new THREE.Mesh(new THREE.PlaneGeometry(W * 0.9, W * 0.225), new THREE.MeshBasicMaterial({ map: brandTexture(), transparent: true, depthWrite: false }));
  brand.position.set(0, H * 0.25, D / 2 + T + 0.002); crate.add(brand);
  for (const s of [-1, 1]) {   // gold corner caps
    const cap = new THREE.Mesh(new THREE.BoxGeometry(T * 1.4, H * 0.5, T * 1.4), new THREE.MeshStandardMaterial({ color: GOLD, metalness: 1, roughness: 0.3 }));
    cap.position.set(s * (W / 2 + T / 2), H * 0.25, D / 2 + T / 2); crate.add(cap);
  }

  // ── the records ──
  const loader = new THREE.TextureLoader();
  const SW = 1.8, GAP = (D - 0.25) / Math.max(1, stations.length);
  const sleeveGeo = new THREE.BoxGeometry(SW, SW, 0.035);
  const edgeMat = new THREE.MeshStandardMaterial({ color: 0x14100c, roughness: 0.7 });
  const sleeves = stations.map((st, i) => {
    const tex = loader.load(st.art); tex.colorSpace = THREE.SRGBColorSpace; tex.anisotropy = 8;
    const face = new THREE.MeshStandardMaterial({ map: tex, roughness: 0.55, metalness: 0.05 });
    const back = new THREE.MeshStandardMaterial({ map: tex, roughness: 0.6, color: 0x8a8070 });
    const m = new THREE.Mesh(sleeveGeo, [edgeMat, edgeMat, edgeMat, edgeMat, face, back]);
    const pivot = new THREE.Group(); pivot.add(m); m.position.y = SW / 2;   // hinge at the bottom edge, like real records leaning in a crate
    const z = D / 2 - 0.15 - i * GAP; pivot.position.set(0, 0.02, z); crate.add(pivot);
    // a vinyl disc peeking out of the top of the playing one
    const disc = new THREE.Mesh(new THREE.CylinderGeometry(SW * 0.46, SW * 0.46, 0.012, 64), new THREE.MeshPhysicalMaterial({ color: 0x0b0a09, roughness: 0.35, clearcoat: 1 }));
    disc.rotation.x = Math.PI / 2; disc.position.set(0, SW * 0.5, -0.04); disc.visible = false; m.add(disc);
    return { ...st, pivot, m, disc, z, tilt: 0, lift: 0 };
  });

  // which record is at the front of the "dig": records in front of it are flipped forward against the crate
  let focus = Math.max(0, stations.findIndex((s) => s.slug === current)), focusF = focus;
  let playing = current, pullT = -1, pullIdx = -1, raf = 0, visible = true, dead = false;

  function size() {
    const w = canvas.clientWidth || 400, h = canvas.clientHeight || 260;
    renderer.setSize(w, h, false); camera.aspect = w / h;
    const far = w / h < 1.2 ? 6.6 : 6.0;
    camera.position.set(0.6, 4.6, far); camera.lookAt(0, 0.95, -0.2); camera.updateProjectionMatrix();
  }
  const ro = new ResizeObserver(size); ro.observe(canvas); size();
  const io = new IntersectionObserver((e) => { visible = e[0].isIntersecting; if (visible) loop(); }); io.observe(canvas);

  function setFocus(i) {
    focus = Math.max(0, Math.min(sleeves.length - 1, i)); onFocus(sleeves[focus]); loop();
  }

  // ── input: drag / swipe / wheel to flip, tap the front record to play it ──
  const ray = new THREE.Raycaster(), ndc = new THREE.Vector2();
  let drag = null, wheelAcc = 0;
  const hitIndex = (e) => {
    const r = canvas.getBoundingClientRect();
    ndc.set(((e.clientX - r.left) / r.width) * 2 - 1, -((e.clientY - r.top) / r.height) * 2 + 1);
    ray.setFromCamera(ndc, camera);
    const hits = ray.intersectObjects(sleeves.map((s) => s.m), false);
    return hits.length ? sleeves.findIndex((s) => s.m === hits[0].object) : -1;
  };
  const onDown = (e) => { drag = { y: e.clientY, x: e.clientX, start: focus, moved: false }; canvas.setPointerCapture?.(e.pointerId); };
  const onMove = (e) => {
    if (!drag) { canvas.style.cursor = hitIndex(e) >= 0 ? "pointer" : "grab"; return; }
    const dy = e.clientY - drag.y, dx = e.clientX - drag.x;
    if (Math.abs(dy) > 6 || Math.abs(dx) > 6) drag.moved = true;
    const step = mobile ? 34 : 42;
    setFocus(drag.start + Math.round((dy + dx * 0.6) / step));
  };
  const onUp = (e) => {
    if (!drag) return; const d = drag; drag = null;
    if (d.moved) return;
    const i = hitIndex(e); if (i < 0) return;
    if (i === focus) pull(i); else setFocus(i);
  };
  const onWheel = (e) => {
    e.preventDefault(); wheelAcc += e.deltaY;
    if (Math.abs(wheelAcc) > 60) { setFocus(focus + Math.sign(wheelAcc)); wheelAcc = 0; }
  };
  const onTouch = (e) => e.preventDefault();   // a finger on the crate digs through it instead of scrolling the page
  canvas.addEventListener("pointerdown", onDown); canvas.addEventListener("pointermove", onMove);
  canvas.addEventListener("pointerup", onUp); canvas.addEventListener("pointercancel", () => (drag = null));
  canvas.addEventListener("wheel", onWheel, { passive: false });
  canvas.addEventListener("touchmove", onTouch, { passive: false });

  function pull(i) { pullIdx = i; pullT = 0; loop(); }

  let last = performance.now();
  function frame(now) {
    raf = 0; if (dead || !visible || document.hidden) return;
    const dt = Math.min(0.05, (now - last) / 1000); last = now; const t = now / 1000;
    focusF += (focus - focusF) * Math.min(1, dt * 9);
    let busy = Math.abs(focus - focusF) > 0.002;
    sleeves.forEach((s, i) => {
      // records before the focused one lean forward against the front of the crate; the focused one stands up for you
      const rel = i - focusF;
      // the record you're on rises out of the crate so you can see it; the ones you've flipped past fan forward
      const near = Math.max(0, 1 - Math.abs(rel));
      // flipped-past records drop forward onto the front of the crate; the rest lean back a touch
      const target = rel < 0 ? Math.min(1.32, -rel * 1.32) - Math.min(0.1, (-rel - 1) * 0.01) * (rel < -1 ? 1 : 0) : -0.05 - Math.min(0.1, rel * 0.015);
      const liftT = near * 0.55;
      s.tilt += (target * (1 - near) + 0.05 * near - s.tilt) * Math.min(1, dt * 10);
      s.lift += (liftT - s.lift) * Math.min(1, dt * 10);
      if (Math.abs(target - s.tilt) > 0.002 || Math.abs(liftT - s.lift) > 0.002) busy = true;
      s.pivot.rotation.x = s.tilt; s.pivot.position.y = 0.02 + s.lift;
      const isPlaying = s.slug === playing;
      s.disc.visible = isPlaying && rel > -0.5;
      if (isPlaying) { s.disc.position.y = SW * 0.2 + Math.sin(t * 2) * 0.01; s.disc.rotation.y += dt * 1.5; busy = true; }
    });
    // pulling a record out: it rises out of the crate, spins toward you, then drops back as the station starts
    if (pullT >= 0) {
      pullT += dt; const s = sleeves[pullIdx], k = Math.min(1, pullT / 1.2);
      const up = Math.sin(k * Math.PI);
      s.m.position.y = SW / 2 + up * 1.2; s.m.position.z = up * 0.6; s.m.rotation.y = up * 0.35;
      if (pullT > 0.55 && pullIdx >= 0 && s.slug !== playing) { playing = s.slug; onPick(s); }
      if (k >= 1) { pullT = -1; s.m.position.set(0, SW / 2, 0); s.m.rotation.y = 0; }
      busy = true;
    }
    rim.intensity = 7 + Math.sin(t * 1.3) * 1.5;
    renderer.render(scene, camera);
    if (busy) loop(); else raf = 0;
  }
  function loop() { if (!raf && !dead) raf = requestAnimationFrame(frame); }
  loop();
  // keep drawing for a moment while the sleeve art arrives
  setTimeout(loop, 400); setTimeout(loop, 1200); setTimeout(loop, 3000);

  return {
    next() { setFocus(focus + 1); }, prev() { setFocus(focus - 1); },
    playFocused() { pull(focus); },
    setPlaying(slug) { playing = slug; const i = sleeves.findIndex((s) => s.slug === slug); if (i >= 0 && pullT < 0) setFocus(i); loop(); },
    focused() { return sleeves[focus]; },
    dispose() {
      dead = true; cancelAnimationFrame(raf); ro.disconnect(); io.disconnect();
      canvas.removeEventListener("pointerdown", onDown); canvas.removeEventListener("pointermove", onMove); canvas.removeEventListener("pointerup", onUp);
      canvas.removeEventListener("wheel", onWheel); canvas.removeEventListener("touchmove", onTouch);
      renderer.dispose(); pmrem.dispose();
    },
  };
}
