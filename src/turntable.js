// APR 3D TURNTABLE — the current song's cover spins on a vinyl record.
// Loaded lazily so the radio starts instantly; falls back to the flat UI if WebGL is missing.
import * as THREE from "three";
import { RoomEnvironment } from "three/examples/jsm/environments/RoomEnvironment.js";
import { RoundedBoxGeometry } from "three/examples/jsm/geometries/RoundedBoxGeometry.js";
import { GLTFLoader } from "three/examples/jsm/loaders/GLTFLoader.js";
import { MeshoptDecoder } from "three/examples/jsm/libs/meshopt_decoder.module.js";
import deckUrl from "./assets/turntable.glb?url";

const GOLD = 0xc2a24d, BLACK = 0x0a0806;

function grooveTexture() {
  const s = 1024, c = document.createElement("canvas"); c.width = c.height = s;
  const g = c.getContext("2d"), m = s / 2;
  g.fillStyle = "#0c0b0a"; g.fillRect(0, 0, s, s);
  for (let r = m; r > m * 0.36; r -= 1.6) {
    const v = 14 + Math.random() * 10 + (Math.floor(r / 38) % 2 ? 5 : 0); // groove bands between "songs"
    g.strokeStyle = `rgb(${v},${v},${v - 1})`; g.lineWidth = 1;
    g.beginPath(); g.arc(m, m, r, 0, Math.PI * 2); g.stroke();
  }
  // run-out area
  g.fillStyle = "#121110"; g.beginPath(); g.arc(m, m, m * 0.36, 0, Math.PI * 2); g.fill();
  const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; t.anisotropy = 8;
  return t;
}
function sheenTexture() { // the light streaks you see across real vinyl
  const s = 512, c = document.createElement("canvas"); c.width = c.height = s;
  const g = c.getContext("2d"), m = s / 2;
  const grd = g.createConicGradient ? g.createConicGradient(0, m, m) : null;
  if (grd) {
    grd.addColorStop(0, "rgba(255,255,255,0)"); grd.addColorStop(0.06, "rgba(255,245,220,0.55)");
    grd.addColorStop(0.12, "rgba(255,255,255,0)"); grd.addColorStop(0.5, "rgba(255,255,255,0)");
    grd.addColorStop(0.56, "rgba(255,245,220,0.4)"); grd.addColorStop(0.62, "rgba(255,255,255,0)"); grd.addColorStop(1, "rgba(255,255,255,0)");
    g.fillStyle = grd; g.beginPath(); g.arc(m, m, m, 0, Math.PI * 2); g.arc(m, m, m * 0.37, 0, Math.PI * 2, true); g.fill();
  }
  const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; return t;
}
function glowTexture() {
  const s = 256, c = document.createElement("canvas"); c.width = c.height = s;
  const g = c.getContext("2d"), grd = g.createRadialGradient(s / 2, s / 2, 0, s / 2, s / 2, s / 2);
  grd.addColorStop(0, "rgba(255,255,255,0.9)"); grd.addColorStop(0.4, "rgba(255,255,255,0.25)"); grd.addColorStop(1, "rgba(255,255,255,0)");
  g.fillStyle = grd; g.fillRect(0, 0, s, s);
  return new THREE.CanvasTexture(c);
}

export function createTurntable(canvas, { mobile = false, getBass = () => 0, onScratch = null } = {}) {
  const renderer = new THREE.WebGLRenderer({ canvas, antialias: true, alpha: true, powerPreference: "high-performance" });
  renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, mobile ? 1.5 : 2));
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 1.05;

  const scene = new THREE.Scene();
  const pmrem = new THREE.PMREMGenerator(renderer);
  scene.environment = pmrem.fromScene(new RoomEnvironment(), 0.04).texture;

  const camera = new THREE.PerspectiveCamera(32, 1, 0.1, 100);
  const camBase = new THREE.Vector3(0, 6.6, 8.6);
  camera.position.copy(camBase); camera.lookAt(0, -0.35, 0.2);

  // lights
  scene.add(new THREE.AmbientLight(0xffffff, 0.15));
  const key = new THREE.SpotLight(0xfff1d6, 26, 30, Math.PI / 5, 0.8, 1.4);
  key.position.set(-3.5, 7, 3); key.target.position.set(0, 0, 0); scene.add(key, key.target);
  const rim = new THREE.PointLight(GOLD, 18, 14, 1.6); rim.position.set(3.4, 1.6, -2.6); scene.add(rim);

  const deck = new THREE.Group(); scene.add(deck);

  // plinth: black lacquer with a gold inlay line
  const plinth = new THREE.Mesh(new RoundedBoxGeometry(5.4, 0.42, 4.2, 6, 0.16),
    new THREE.MeshPhysicalMaterial({ color: 0x0d0a07, roughness: 0.55, metalness: 0.0, clearcoat: 0.6, clearcoatRoughness: 0.35, envMapIntensity: 0.25 }));
  plinth.position.y = -0.21; deck.add(plinth);
  const inlay = new THREE.Mesh(new THREE.BoxGeometry(5.42, 0.035, 4.22),
    new THREE.MeshStandardMaterial({ color: GOLD, metalness: 1, roughness: 0.28 }));
  inlay.position.y = -0.1; deck.add(inlay);
  // feet
  for (const [x, z] of [[-2.35, -1.75], [2.35, -1.75], [-2.35, 1.75], [2.35, 1.75]]) {
    const f = new THREE.Mesh(new THREE.CylinderGeometry(0.22, 0.26, 0.16, 32), new THREE.MeshStandardMaterial({ color: GOLD, metalness: 1, roughness: 0.35 }));
    f.position.set(x, -0.48, z); deck.add(f);
  }

  // platter
  const platter = new THREE.Mesh(new THREE.CylinderGeometry(1.72, 1.72, 0.16, 96),
    new THREE.MeshStandardMaterial({ color: 0x2a2620, metalness: 0.9, roughness: 0.25 }));
  platter.position.set(-0.45, 0.08, 0); deck.add(platter);

  // record (spins)
  let spin = new THREE.Group(); spin.position.set(-0.45, 0.17, 0); deck.add(spin);
  const vinyl = new THREE.Mesh(new THREE.CylinderGeometry(1.62, 1.62, 0.025, 128),
    [new THREE.MeshPhysicalMaterial({ color: 0x0c0b0a, roughness: 0.4, clearcoat: 1, clearcoatRoughness: 0.2 }),
     new THREE.MeshPhysicalMaterial({ map: grooveTexture(), roughness: 0.38, metalness: 0.2, clearcoat: 1, clearcoatRoughness: 0.25 }),
     new THREE.MeshPhysicalMaterial({ color: 0x0c0b0a, roughness: 0.5 })]);
  spin.add(vinyl);
  const sheen = new THREE.Mesh(new THREE.CircleGeometry(1.6, 96), new THREE.MeshBasicMaterial({ map: sheenTexture(), transparent: true, opacity: 0.18, blending: THREE.AdditiveBlending, depthWrite: false }));
  sheen.rotation.x = -Math.PI / 2; sheen.position.set(-0.45, 0.185, 0); deck.add(sheen); // stays still while the record turns = moving glints
  const labelMat = new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 0.6, metalness: 0 });
  const label = new THREE.Mesh(new THREE.CircleGeometry(0.72, 64), labelMat);
  label.rotation.x = -Math.PI / 2; label.position.y = 0.0135; spin.add(label);
  const spindle = new THREE.Mesh(new THREE.CylinderGeometry(0.045, 0.045, 0.16, 16), new THREE.MeshStandardMaterial({ color: GOLD, metalness: 1, roughness: 0.2 }));
  spindle.position.y = 0.06; spin.add(spindle);

  // tonearm
  const goldMat = new THREE.MeshStandardMaterial({ color: GOLD, metalness: 1, roughness: 0.22 });
  const pivot = new THREE.Group(); pivot.position.set(1.95, 0.32, -1.35); deck.add(pivot);
  const base = new THREE.Mesh(new THREE.CylinderGeometry(0.28, 0.32, 0.22, 48), new THREE.MeshStandardMaterial({ color: 0x1b1712, metalness: 0.8, roughness: 0.3 }));
  base.position.y = -0.12; pivot.add(base);
  const ring = new THREE.Mesh(new THREE.TorusGeometry(0.3, 0.025, 12, 48), goldMat); ring.rotation.x = Math.PI / 2; ring.position.y = -0.01; pivot.add(ring);
  let arm = new THREE.Group(); pivot.add(arm);
  const tube = new THREE.Mesh(new THREE.CylinderGeometry(0.035, 0.035, 2.45, 16), goldMat);
  tube.rotation.x = Math.PI / 2; tube.position.set(0, 0.08, 1.2); arm.add(tube);
  const head = new THREE.Mesh(new THREE.BoxGeometry(0.2, 0.06, 0.34), new THREE.MeshStandardMaterial({ color: 0x15110c, metalness: 0.6, roughness: 0.35 }));
  head.position.set(-0.06, 0.05, 2.45); head.rotation.y = 0.35; arm.add(head);
  const weight = new THREE.Mesh(new THREE.CylinderGeometry(0.13, 0.13, 0.26, 32), goldMat);
  weight.rotation.x = Math.PI / 2; weight.position.set(0, 0.08, -0.32); arm.add(weight);
  let REST = 0.18, PLAY_START = -0.42, PLAY_END = -0.62; // y-rotation of the arm
  let spinY = 0.17, lift = 0.45, armTilt = [-0.02, -0.06];

  // glow under the deck in the channel color
  const glow = new THREE.Mesh(new THREE.PlaneGeometry(10, 8), new THREE.MeshBasicMaterial({ map: glowTexture(), color: GOLD, transparent: true, opacity: 0.35, blending: THREE.AdditiveBlending, depthWrite: false }));
  glow.rotation.x = -Math.PI / 2; glow.position.y = -0.56; scene.add(glow);

  // ── the Blender-modelled deck (matte black + gold, Wave Seal label) replaces the stand-in once it loads ──
  const placeholder = deck.children.slice();
  const gl = new GLTFLoader(); gl.setMeshoptDecoder(MeshoptDecoder);
  gl.load(deckUrl, (g) => {
    if (disposed) return;
    const model = g.scene, K = 5.4 / 0.46;                     // the Blender deck is 46 cm wide; the scene is built 5.4 wide
    model.scale.setScalar(K); model.position.y = -0.08 * K;    // its top sits where the old plinth top was
    const rec = model.getObjectByName("RecordRoot"), tone = model.getObjectByName("Tonearm"), wave = model.getObjectByName("LabelWave");
    if (!rec || !tone) return;
    model.traverse((o) => { if (o.material && o.material.name === "MatteBlack") { o.material.roughness = 0.5; o.material.envMapIntensity = 0.35; } });
    // the song's cover goes on the record's label, inside the gold ring
    label.geometry.dispose(); label.geometry = new THREE.CircleGeometry(0.0395, 64);
    label.position.set(0, 0.00175, 0); rec.add(label);
    if (wave) wave.visible = !labelMat.map;
    placeholder.forEach((o) => { if (o !== spin) deck.remove(o); }); deck.remove(spin); deck.remove(sheen);
    deck.add(model);
    spin = rec; spinY = rec.position.y; lift = 0.45 / K;
    arm = tone; REST = 0.21; PLAY_START = -0.19; PLAY_END = -0.52; armTilt = [0, 0];
    armY = REST; arm.rotation.y = armY;
    waveLabel = wave;
    loop();
  });
  let waveLabel = null;

  // state
  let playing = false, speed = 0, armY = REST, progress = 0, raf = 0, visible = true, disposed = false;
  let swapT = -1, pendingTex = null;
  const glowColor = new THREE.Color(GOLD), loader = new THREE.TextureLoader();
  const pointer = { x: 0, y: 0 }, tilt = { x: 0, y: 0 };

  function resize() {
    const w = canvas.clientWidth || 400, h = canvas.clientHeight || 300;
    renderer.setSize(w, h, false); camera.aspect = w / h;
    camera.position.copy(camBase).multiplyScalar(w / h < 1.1 ? 1.22 : 1); camera.lookAt(0, -0.35, 0.2);
    camera.updateProjectionMatrix();
  }
  const ro = new ResizeObserver(resize); ro.observe(canvas); resize();
  const io = new IntersectionObserver((e) => { visible = e[0].isIntersecting; if (visible) loop(); }, { threshold: 0 });
  io.observe(canvas);
  const onVis = () => { if (!document.hidden) loop(); };
  document.addEventListener("visibilitychange", onVis);
  const onMove = (e) => { const r = canvas.getBoundingClientRect(); pointer.x = ((e.clientX - r.left) / r.width - 0.5); pointer.y = ((e.clientY - r.top) / r.height - 0.5); };
  if (!mobile) window.addEventListener("pointermove", onMove);

  // ── spin the record with a finger or the mouse: grab it, drag it around, flick it and let go ──
  const ray = new THREE.Raycaster(), ndc = new THREE.Vector2(), plane = new THREE.Plane(new THREE.Vector3(0, 1, 0), 0);
  const hit = new THREE.Vector3(), centre = new THREE.Vector3();
  let grab = null;   // { angle, t, vel }
  function recordAngle(e) {
    const r = canvas.getBoundingClientRect();
    ndc.set(((e.clientX - r.left) / r.width) * 2 - 1, -((e.clientY - r.top) / r.height) * 2 + 1);
    ray.setFromCamera(ndc, camera);
    spin.getWorldPosition(centre); plane.constant = -centre.y;
    if (!ray.ray.intersectPlane(plane, hit)) return null;
    const dx = hit.x - centre.x, dz = hit.z - centre.z, radius = 1.9 * deck.scale.x;
    return { a: Math.atan2(dz, dx), inside: Math.hypot(dx, dz) < radius };
  }
  const onDown = (e) => {
    const p = recordAngle(e); if (!p || !p.inside) return;
    grab = { angle: p.a, t: performance.now(), vel: 0 };
    canvas.setPointerCapture?.(e.pointerId); canvas.style.cursor = "grabbing"; loop();
  };
  const onDrag = (e) => {
    if (!grab) { const p = recordAngle(e); canvas.style.cursor = p && p.inside ? "grab" : ""; return; }
    const p = recordAngle(e); if (!p) return;
    let d = p.a - grab.angle; if (d > Math.PI) d -= 2 * Math.PI; if (d < -Math.PI) d += 2 * Math.PI;
    const now = performance.now(), dts = Math.max(0.008, (now - grab.t) / 1000);
    spin.rotation.y -= d;                                  // the record follows your finger
    grab.vel = grab.vel * 0.6 + (d / dts) * 0.4; grab.angle = p.a; grab.t = now;
    onScratch && onScratch(d / dts);
  };
  const onUp = () => { if (!grab) return; speed = Math.max(-25, Math.min(25, grab.vel)); grab = null; canvas.style.cursor = ""; onScratch && onScratch(null); loop(); };
  // on phones, a touch that starts on the record spins it instead of scrolling the page
  const onTouch = (e) => { const t = e.touches[0]; const p = t && recordAngle(t); if (p && p.inside) e.preventDefault(); };
  canvas.addEventListener("pointerdown", onDown); canvas.addEventListener("pointermove", onDrag);
  canvas.addEventListener("pointerup", onUp); canvas.addEventListener("pointercancel", onUp);
  canvas.addEventListener("touchstart", onTouch, { passive: false });

  let last = performance.now();
  function frame(now) {
    raf = 0;
    if (disposed || !visible || document.hidden) return;
    const dt = Math.min(0.05, (now - last) / 1000); last = now;
    if (!grab) speed += ((playing ? 3.49 : 0) - speed) * Math.min(1, dt * (Math.abs(speed) > 5 ? 0.9 : playing ? 1.6 : 1.1)); // 33⅓ rpm; a flick coasts, then settles
    if (!grab) spin.rotation.y -= speed * dt;
    const target = playing ? PLAY_START + (PLAY_END - PLAY_START) * progress : REST;
    armY += (target - armY) * Math.min(1, dt * 2.2); arm.rotation.y = armY;
    arm.rotation.x = playing ? armTilt[0] : armTilt[1];
    // record swap: lift, change label, drop
    if (swapT >= 0) {
      swapT += dt; const k = Math.min(1, swapT / 0.9);
      spin.position.y = spinY + Math.sin(k * Math.PI) * lift;
      if (k > 0.5 && pendingTex) { labelMat.map?.dispose(); labelMat.map = pendingTex; labelMat.needsUpdate = true; pendingTex = null; if (waveLabel) waveLabel.visible = false; }
      if (k >= 1) { swapT = -1; spin.position.y = spinY; }
    }
    const bass = getBass();
    rim.color.copy(glowColor); glow.material.color.copy(glowColor);
    rim.intensity = 14 + bass * 40; glow.material.opacity = 0.28 + bass * 0.35;
    tilt.x += (pointer.x - tilt.x) * 0.05; tilt.y += (pointer.y - tilt.y) * 0.05;
    deck.rotation.y = -0.08 + tilt.x * 0.12 + (mobile ? Math.sin(now / 4000) * 0.05 : 0);
    deck.rotation.x = tilt.y * 0.05;
    renderer.render(scene, camera);
    loop();
  }
  function loop() { if (!raf && !disposed) raf = requestAnimationFrame(frame); }
  loop();

  return {
    setPlaying(p) { playing = p; loop(); },
    setProgress(p) { progress = Math.max(0, Math.min(1, p || 0)); },
    setGlow(hex) { glowColor.set(hex); },
    setCover(url) {
      if (!url) return;
      loader.load(url, (t) => { t.colorSpace = THREE.SRGBColorSpace; t.anisotropy = 8;
        if (!labelMat.map) { labelMat.map = t; labelMat.needsUpdate = true; if (waveLabel) waveLabel.visible = false; } else { pendingTex = t; swapT = 0; } loop(); });
    },
    dispose() {
      disposed = true; cancelAnimationFrame(raf); ro.disconnect(); io.disconnect();
      document.removeEventListener("visibilitychange", onVis); window.removeEventListener("pointermove", onMove);
      canvas.removeEventListener("pointerdown", onDown); canvas.removeEventListener("pointermove", onDrag); canvas.removeEventListener("pointerup", onUp); canvas.removeEventListener("pointercancel", onUp); canvas.removeEventListener("touchstart", onTouch);
      renderer.dispose(); pmrem.dispose();
    },
  };
}
