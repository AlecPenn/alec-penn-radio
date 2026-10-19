// TOMMY — the 3D black cat in a wizard hat (modeled in Blender). When someone types TOMMY he rises up
// in the bottom corner, looks at you, flicks his tail, tips his hat and sinks back down.
// Loaded only when the egg fires.
import * as THREE from "three";
import { GLTFLoader } from "three/examples/jsm/loaders/GLTFLoader.js";
import { RoomEnvironment } from "three/examples/jsm/environments/RoomEnvironment.js";
import tommyUrl from "./assets/tommy.glb?url";

const ease = (x) => 1 - Math.pow(1 - x, 3);
const back = (x) => { const c = 1.7; return 1 + (c + 1) * Math.pow(x - 1, 3) + c * Math.pow(x - 1, 2); };

export function tommyAppears(canvas, { onDone = () => {} } = {}) {
  const renderer = new THREE.WebGLRenderer({ canvas, antialias: true, alpha: true });
  renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  const scene = new THREE.Scene();
  const pmrem = new THREE.PMREMGenerator(renderer);
  scene.environment = pmrem.fromScene(new RoomEnvironment(), 0.04).texture;
  scene.environmentIntensity = 0.6;
  const key = new THREE.DirectionalLight(0xfff0dc, 2.0); key.position.set(2, 3, 4); scene.add(key);
  const rim = new THREE.DirectionalLight(0xffb347, 3.2); rim.position.set(-3, 2, -2); scene.add(rim);
  const rim2 = new THREE.DirectionalLight(0x9a7bff, 1.2); rim2.position.set(3, 1, -2); scene.add(rim2);
  // soft gold glow under him
  const glow = new THREE.Mesh(new THREE.CircleGeometry(0.6, 48), new THREE.MeshBasicMaterial({ color: 0xffb347, transparent: true, opacity: 0, depthWrite: false }));
  glow.rotation.x = -Math.PI / 2; scene.add(glow);

  const camera = new THREE.PerspectiveCamera(28, 1, 0.1, 50);
  camera.position.set(0, 0.9, 3.6); camera.lookAt(0, 0.68, 0);
  let raf = 0, stopped = false;
  function size() {
    const w = canvas.clientWidth || 400, h = canvas.clientHeight || 400;
    renderer.setSize(w, h, false); camera.aspect = w / h; camera.updateProjectionMatrix();
  }
  size(); window.addEventListener("resize", size);

  new GLTFLoader().load(tommyUrl, (g) => {
    if (stopped) return;
    const cat = g.scene; const rig = new THREE.Group(); rig.add(cat); scene.add(rig);
    cat.position.x = -0.05;
    const parts = {};
    for (const n of ["Head", "Hat", "Tail"]) { const o = cat.getObjectByName(n); if (o) { parts[n] = o; o.userData.rest = o.rotation.clone(); } }
    const set = (n, axis, v) => { const o = parts[n]; if (o) o.rotation[axis] = o.userData.rest[axis] + v; };
    // our own clock: advances at most 1/30 s per frame, so a slow first frame (shaders warming up) never skips the show
    const D = 6.2; let t = 0, last = 0, frames = 0;
    renderer.compile(scene, camera);
    const tick = (now) => {
      if (stopped) return;
      raf = requestAnimationFrame(tick);
      frames++; if (last) t += Math.min((now - last) / 1000, 1 / 30); last = now;
      const up = t < 0.7 ? back(t / 0.7) : t > D - 0.6 ? 1 - ease((t - (D - 0.6)) / 0.6) : 1;
      rig.position.y = -1.7 * (1 - up);
      rig.rotation.y = -0.55 + Math.sin(t * 0.6) * 0.12;          // three-quarter view, turning slightly
      glow.material.opacity = 0.22 * Math.max(0, up);
      set("Head", "y", t > 1 && t < 3.2 ? Math.sin((t - 1) / 2.2 * Math.PI) * 0.5 : 0);   // looks at you
      set("Head", "z", Math.sin(t * 1.7) * 0.05);
      set("Tail", "y", Math.sin(t * 2.6) * 0.18);                       // tail flick
      const tip = t > 3.4 && t < 4.6 ? Math.sin((t - 3.4) / 1.2 * Math.PI) : 0;
      set("Hat", "z", tip * 0.5); set("Hat", "x", tip * -0.15);         // tips his hat
      renderer.render(scene, camera);
      if (t >= D) { console.log("tommy done", t, frames); stop(); onDone(); }
    };
    raf = requestAnimationFrame(tick);
  }, undefined, (err) => { console.warn("tommy load failed", err); stop(); onDone(new Error("load")); });

  function stop() {
    if (stopped) return;
    stopped = true; cancelAnimationFrame(raf); window.removeEventListener("resize", size);
    scene.traverse((o) => { o.geometry?.dispose?.(); if (o.material) [].concat(o.material).forEach((m) => m.dispose()); });
    pmrem.dispose(); renderer.dispose();
  }
  return stop;
}
