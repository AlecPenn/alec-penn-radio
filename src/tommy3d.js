// TOMMY — the 3D black cat in a wizard hat, gold APR pendant (modeled in Blender). When someone types TOMMY he rises up
// in the bottom corner, looks at you, flicks his tail, tips his hat and sinks back down.
// Loaded only when the egg fires.
import * as THREE from "three";
import { GLTFLoader } from "three/examples/jsm/loaders/GLTFLoader.js";
import { MeshoptDecoder } from "three/examples/jsm/libs/meshopt_decoder.module.js";
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

  const loader = new GLTFLoader(); loader.setMeshoptDecoder(MeshoptDecoder);
  loader.load(tommyUrl, (g) => {
    if (stopped) return;
    const cat = g.scene;
    // size him to ~1.45 units tall, standing on the floor, centred
    const box = new THREE.Box3().setFromObject(cat), sz = box.getSize(new THREE.Vector3()), c = box.getCenter(new THREE.Vector3());
    const k = 1.45 / sz.y; cat.scale.setScalar(k); cat.position.set(-c.x * k, -box.min.y * k, -c.z * k);
    // keep his fur black on screens (the velvet sheen is tuned for studio renders)
    cat.traverse((o) => { const m = o.material; if (m && "sheen" in m && m.sheen > 0) { m.sheen = 0.35; m.sheenRoughness = 0.5; } });
    const rig = new THREE.Group(); rig.add(cat); scene.add(rig);
    const hat = cat.getObjectByName("THat");
    const lids = ["TLidL", "TLidR"].map((n) => cat.getObjectByName(n)).filter(Boolean);
    const rest = new Map([hat, ...lids].filter(Boolean).map((o) => [o, o.quaternion.clone()]));
    const q = new THREE.Quaternion(), X = new THREE.Vector3(1, 0, 0), Z = new THREE.Vector3(0, 0, 1);
    const turn = (o, axis, a) => { if (o) o.quaternion.copy(rest.get(o)).multiply(q.setFromAxisAngle(axis, a)); };
    // our own clock: advances at most 1/30 s per frame, so a slow first frame (shaders warming up) never skips the show
    const D = 6.2; let t = 0, last = 0;
    renderer.compile(scene, camera);
    const tick = (now) => {
      if (stopped) return;
      raf = requestAnimationFrame(tick);
      if (last) t += Math.min((now - last) / 1000, 1 / 30); last = now;
      const up = t < 0.7 ? back(t / 0.7) : t > D - 0.6 ? 1 - ease((t - (D - 0.6)) / 0.6) : 1;
      rig.position.y = -1.8 * (1 - up);
      // turns to look at you, then back to three-quarters
      const look = t > 0.9 && t < 3.3 ? Math.sin((t - 0.9) / 2.4 * Math.PI) : 0;
      rig.rotation.y = -0.45 + look * 0.4 + Math.sin(t * 0.6) * 0.05;
      rig.rotation.z = Math.sin(t * 1.4) * 0.025;
      glow.material.opacity = 0.1 * Math.max(0, up);
      // a slow cat blink (that's a cat saying "I like you")
      const blink = t > 2.0 && t < 2.9 ? Math.sin((t - 2.0) / 0.9 * Math.PI) : 0;
      lids.forEach((l) => turn(l, X, blink * 0.75));
      // tips his hat
      const tip = t > 3.5 && t < 4.7 ? Math.sin((t - 3.5) / 1.2 * Math.PI) : 0;
      if (hat) { turn(hat, Z, tip * 0.35); hat.position.y = hat.userData.y0 ?? (hat.userData.y0 = hat.position.y); hat.position.y = hat.userData.y0 + tip * 0.05; }
      renderer.render(scene, camera);
      if (t >= D) { stop(); onDone(); }
    };
    raf = requestAnimationFrame(tick);
  }, undefined, () => { stop(); onDone(new Error("load")); });

  function stop() {
    if (stopped) return;
    stopped = true; cancelAnimationFrame(raf); window.removeEventListener("resize", size);
    scene.traverse((o) => { o.geometry?.dispose?.(); if (o.material) [].concat(o.material).forEach((m) => m.dispose()); });
    pmrem.dispose(); renderer.dispose();
  }
  return stop;
}
