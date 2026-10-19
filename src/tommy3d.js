// TOMMY — the 3D black cat in a wizard hat, gold APR pendant (modeled in Blender). When someone types TOMMY he
// hop-trots along the bottom of the screen, stops in the middle to look at you, slow-blinks, tips his hat, and trots off.
// Loaded only when the egg fires.
import * as THREE from "three";
import { GLTFLoader } from "three/examples/jsm/loaders/GLTFLoader.js";
import { MeshoptDecoder } from "three/examples/jsm/libs/meshopt_decoder.module.js";
import { RoomEnvironment } from "three/examples/jsm/environments/RoomEnvironment.js";
import tommyUrl from "./assets/tommy.glb?url";

const ease = (x) => 1 - Math.pow(1 - x, 3);
const back = (x) => { const c = 1.7; return 1 + (c + 1) * Math.pow(x - 1, 3) + c * Math.pow(x - 1, 2); };

export function tommyAppears(canvas, { onDone = () => {}, calm = false } = {}) {
  // calm: the computer asks for less motion (e.g. Windows "Animation effects" off) -> a slow, smooth glide, no hopping
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

  const camera = new THREE.PerspectiveCamera(24, 1, 0.1, 50);
  const DIST = 5.2;
  camera.position.set(0, 0.85, DIST); camera.lookAt(0, 0.72, 0);
  let raf = 0, stopped = false, halfW = 4;
  function size() {
    const w = canvas.clientWidth || 800, h = canvas.clientHeight || 260;
    renderer.setSize(w, h, false); camera.aspect = w / h; camera.updateProjectionMatrix();
    halfW = Math.tan(THREE.MathUtils.degToRad(camera.fov / 2)) * DIST * camera.aspect;   // half the visible width, in scene units
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
    const SPEED = calm ? 0.9 : 1.6;              // scene units per second
    const PAUSE = calm ? 2.6 : 3.2;              // seconds he stops in the middle
    let t = 0, last = 0;
    renderer.compile(scene, camera);
    const tick = (now) => {
      if (stopped) return;
      raf = requestAnimationFrame(tick);
      if (last) t += Math.min((now - last) / 1000, 1 / 30); last = now;
      const start = -halfW - 1.2, mid = 0, end = halfW + 1.2;
      const t1 = (mid - start) / SPEED, t2 = t1 + PAUSE, t3 = t2 + (end - mid) / SPEED;
      let x, moving, pauseT = -1;
      if (t < t1) { x = start + t * SPEED; moving = true; }
      else if (t < t2) { x = mid; moving = false; pauseT = t - t1; }
      else { x = mid + (t - t2) * SPEED; moving = true; }
      // ease into and out of the stop so it doesn't look like he hit a wall
      const near = Math.min(Math.abs(t - t1), Math.abs(t - t2));
      const stride = moving ? Math.min(1, near / 0.35) : 0;
      // trot: little hops with a forward/back rock (a calm glide when less motion is asked for)
      const w = t * 9;
      rig.position.x = x;
      rig.position.y = calm ? 0 : Math.abs(Math.sin(w)) * 0.09 * stride;
      rig.rotation.z = calm ? 0 : -Math.cos(w) * 0.06 * stride;
      // faces the way he's walking (three-quarter to the viewer); at the stop he turns to look at you
      const look = pauseT >= 0 ? Math.sin(Math.min(1, pauseT / 0.5) * Math.PI / 2) * (pauseT > PAUSE - 0.5 ? Math.max(0, (PAUSE - pauseT) / 0.5) : 1) : 0;
      rig.rotation.y = (Math.PI / 2 - 0.35) * (1 - look) + look * 0.05;
      glow.position.x = x; glow.material.opacity = 0.08;
      const blink = pauseT > 0.7 && pauseT < 1.5 ? Math.sin((pauseT - 0.7) / 0.8 * Math.PI) : 0;
      lids.forEach((l) => turn(l, X, blink * 0.75));
      const tip = !calm && pauseT > 1.6 && pauseT < 2.7 ? Math.sin((pauseT - 1.6) / 1.1 * Math.PI) : 0;
      if (hat) { turn(hat, Z, tip * 0.35); hat.position.y = hat.userData.y0 ?? (hat.userData.y0 = hat.position.y); hat.position.y = hat.userData.y0 + tip * 0.05; }
      renderer.render(scene, camera);
      if (t >= t3) { stop(); onDone(); }
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
