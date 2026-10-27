import * as THREE from 'three';
import Lenis from 'lenis';
import gsap from 'gsap';
import { ScrollTrigger } from 'gsap/ScrollTrigger';
import { projects } from './projects.js';

const isTouch = matchMedia('(hover: none)').matches;
const reduceMotion = matchMedia('(prefers-reduced-motion: reduce)').matches;
const isSmall = () => innerWidth < 760;
const el = (id) => document.getElementById(id);
const N = projects.length;
const ASPECT = 0.625;
const BASE = import.meta.env.BASE_URL;

/* ---------- Card textures: cover photo + a tiny "website" overlay ---------- */
const TEX_W = isTouch ? 768 : 1024, TEX_H = Math.round(TEX_W * ASPECT);
function rr(x, X, Y, W, H, R) { x.beginPath(); x.moveTo(X + R, Y); x.arcTo(X + W, Y, X + W, Y + H, R); x.arcTo(X + W, Y + H, X, Y + H, R); x.arcTo(X, Y + H, X, Y, R); x.arcTo(X, Y, X + W, Y, R); x.closePath(); }
function drawCard(p, img) {
  const c = document.createElement('canvas'); c.width = TEX_W; c.height = TEX_H;
  const x = c.getContext('2d'); const s = TEX_W / 1024;
  if (img) x.drawImage(img, 0, 0, TEX_W, TEX_H);
  else { const g = x.createLinearGradient(0, 0, TEX_W, TEX_H); g.addColorStop(0, p.colors[0]); g.addColorStop(1, p.colors[1]); x.fillStyle = g; x.fillRect(0, 0, TEX_W, TEX_H); }
  const sh = x.createLinearGradient(0, 0, TEX_W * 0.75, 0); sh.addColorStop(0, 'rgba(0,0,0,.55)'); sh.addColorStop(1, 'rgba(0,0,0,0)');
  x.fillStyle = sh; x.fillRect(0, 0, TEX_W, TEX_H);
  // mini nav
  x.fillStyle = '#fff'; x.beginPath(); x.arc(44 * s, 44 * s, 11 * s, 0, 7); x.fill();
  x.font = `500 ${15 * s}px "Inter Tight", sans-serif`; x.textBaseline = 'middle';
  ['Work', 'About', 'Pricing'].forEach((t, k) => { x.globalAlpha = .85; x.fillText(t, (640 + k * 82) * s, 44 * s); });
  x.globalAlpha = 1; rr(x, 890 * s, 26 * s, 100 * s, 36 * s, 18 * s); x.fill();
  x.fillStyle = '#111'; x.fillText('Start', 918 * s, 44 * s);
  // headline
  x.fillStyle = '#fff'; x.textBaseline = 'alphabetic';
  x.font = `500 ${96 * s}px "Inter Tight", sans-serif`;
  x.fillText(p.title, 52 * s, 420 * s);
  x.font = `italic 400 ${36 * s}px "Instrument Serif", serif`;
  let line = '', ly = 476 * s;
  for (const w of p.tagline.split(' ')) { const t = line ? line + ' ' + w : w; if (x.measureText(t).width > 520 * s) { x.fillText(line, 56 * s, ly); line = w; ly += 42 * s; } else line = t; }
  x.fillText(line, 56 * s, ly);
  x.globalAlpha = .8; x.font = `500 ${15 * s}px "Inter Tight", sans-serif`;
  x.fillText(`${p.kind.toUpperCase()} · ${p.year}`, 56 * s, 330 * s); x.globalAlpha = 1;
  return c;
}
function loadImg(src) { return new Promise((res) => { const i = new Image(); i.onload = () => res(i); i.onerror = () => res(null); i.src = src; }); }

/* ---------- Scene ---------- */
const canvas = el('gl');
const renderer = new THREE.WebGLRenderer({ canvas, antialias: devicePixelRatio < 2, powerPreference: 'high-performance' });
renderer.setPixelRatio(Math.min(devicePixelRatio, isTouch ? 1.5 : 2));
renderer.outputColorSpace = THREE.SRGBColorSpace;
const scene = new THREE.Scene();
const camera = new THREE.PerspectiveCamera(35, innerWidth / innerHeight, 0.1, 100);
camera.position.set(0, 0, 12);
const LIGHT = new THREE.Color('#ecebe8'), DIM = new THREE.Color('#121216'), NIGHT = new THREE.Color('#0d1424');
const bg = new THREE.Color();
const SEG_X = 24, SEG_Y = 2; // segmented so cards can bend along the ribbon, wall and sphere
const VX = SEG_X + 1, VY = SEG_Y + 1, NV = VX * VY;
const cards = [];
const rnd = (k) => { const v = Math.sin(k * 127.1 + 311.7) * 43758.5453; return v - Math.floor(v); };

projects.forEach((p, i) => {
  const g = new THREE.PlaneGeometry(1, ASPECT, SEG_X, SEG_Y);
  const tex = new THREE.CanvasTexture(drawCard(p, null)); tex.colorSpace = THREE.SRGBColorSpace; tex.anisotropy = 4;
  const mat = new THREE.MeshBasicMaterial({ map: tex, side: THREE.DoubleSide });
  // when the rope twists a card's back toward the camera, show the picture un-mirrored
  mat.onBeforeCompile = (sh) => { sh.fragmentShader = sh.fragmentShader.replace('#include <map_fragment>',
    '#ifdef USE_MAP\n vec2 muv = gl_FrontFacing ? vMapUv : vec2(1.0 - vMapUv.x, vMapUv.y);\n diffuseColor *= texture2D(map, muv);\n#endif'); };
  const m = new THREE.Mesh(g, mat);
  m.frustumCulled = false;
  const local = new Float32Array(NV * 2); // lx, ly in [-.5,.5]
  const pa = g.attributes.position.array;
  for (let k = 0; k < NV; k++) { local[k * 2] = pa[k * 3]; local[k * 2 + 1] = pa[k * 3 + 1] / ASPECT; }
  m.userData = { i, p, hover: 0, tex, local,
    scatter: new THREE.Vector3((rnd(i) - .5) * 8.5, (rnd(i + 20) - .5) * 4.6, (rnd(i + 40) - .5) * 3 - 1),
    scatterRot: new THREE.Quaternion().setFromEuler(new THREE.Euler((rnd(i + 60) - .5) * .5, (rnd(i + 80) - .5) * .9, (rnd(i + 99) - .5) * .4)) };
  scene.add(m); cards.push(m);
});
async function upgradeTextures() {
  try { await Promise.race([document.fonts.ready, new Promise((r) => setTimeout(r, 1500))]); } catch {}
  await Promise.all(cards.map(async (m) => {
    const img = await loadImg(`${BASE}covers/${m.userData.p.id}.webp`);
    const t = new THREE.CanvasTexture(drawCard(m.userData.p, img)); t.colorSpace = THREE.SRGBColorSpace; t.anisotropy = 4;
    m.material.map = t; m.material.needsUpdate = true; m.userData.tex.dispose();
  }));
}

/* ---------- Layouts: each maps a card-local point (lx, ly) to a world point ---------- */
const v3 = () => new THREE.Vector3();
const T = v3(), U = v3(), W = v3(), P = v3(), tmp = v3(), Zv = new THREE.Vector3(0, 0, 1);
function vis() { const h = 2 * camera.position.z * Math.tan(THREE.MathUtils.degToRad(camera.fov / 2)); return { w: h * camera.aspect, h }; }
let L = {}; // per-frame layout constants
function layoutConsts(time, rise) {
  const small = isSmall(); const { w: vw, h: vh } = vis();
  // ribbon: cards ride a 3D rope-like path, driven by scroll
  if (rope.vw !== vw || rope.vh !== vh) buildRope(vw, vh, small);
  const rh = Math.min(vh * (small ? .15 : .2), vw * (small ? .27 : .2)), rw = rh / ASPECT, rgap = rh * .05;
  L.r = { w: rw, h: rh, sp: rw + rgap, head: rope.s0 * rope.intro + rise * (rope.len - rope.s0 + N * (rw + rgap) + rw) };
  // wall
  const ww = small ? 2.4 : 3.6; const R = small ? 6 : 8.5;
  L.w = { w: ww, h: ww * ASPECT, R, d: (ww * 1.012) / R, sway: Math.sin(time * .15) * .22 - .1, cz: small ? 6.5 : 9, cy: small ? .3 : 0 };
  // grid
  const cols = small ? 2 : 4, rows = Math.ceil(N / cols), gap = small ? .12 : .14;
  let cw = Math.min(small ? 9 : 2.6, (vw * (small ? .9 : .7) - gap * (cols - 1)) / cols);
  const availH = vh * (small ? .66 : .68);
  if (rows * cw * ASPECT + (rows - 1) * gap > availH) cw = ((availH - (rows - 1) * gap) / rows) / ASPECT;
  L.g = { cols, rows, gap, cw, ch: cw * ASPECT, tw: cols * cw + (cols - 1) * gap, th: rows * cw * ASPECT + (rows - 1) * gap, dy: vh * (small ? .09 : .06) };
  // sphere
  const sr = small ? 1.95 : 3.3;
  L.s = { R: sr, w: small ? 1.15 : 1.6, cx: small ? 0 : 1.2, cy: small ? 1.2 : .1, rot: new THREE.Quaternion().setFromEuler(new THREE.Euler(.35, 0, .15)).multiply(new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(0, 1, 0), time * .22)) };
  L.sc = { s: small ? 1.1 : 1.5 };
}
/* The rope: a Catmull-Rom path that enters bottom-left from behind, swings toward the
   camera, twists back and climbs out past the header. Sampled by arc length with a
   parallel-transported normal plus a slow twist, so every card bends and rolls with it. */
const RS = 360; // samples
const rope = { vw: 0, vh: 0, len: 1, s0: 0, intro: 0, P: [], Nn: [], T: [] };
const ROPE_PTS = [ // (x * vw, y * vh, z * vh)
  [-.78, -.95, -.9], [-.5, -.62, -.55], [-.2, -.46, -.18], [.12, -.38, .14], [.34, -.22, .22],
  [.3, -.04, .08], [.04, .06, -.12], [-.22, .2, -.3], [-.12, .4, -.5], [.24, .56, -.66], [.7, .78, -.85], [1.2, 1.15, -1.1],
];
const ROPE_PTS_SM = [
  [-.9, -.75, -.6], [-.55, -.5, -.35], [-.2, -.38, -.1], [.15, -.3, .1], [.38, -.16, .12],
  [.25, 0, 0], [-.05, .1, -.15], [-.3, .24, -.3], [-.1, .42, -.45], [.3, .58, -.6], [.9, .82, -.8], [1.5, 1.1, -1],
];
function buildRope(vw, vh, small) {
  rope.vw = vw; rope.vh = vh;
  const pts = (small ? ROPE_PTS_SM : ROPE_PTS).map(([x, y, z]) => new THREE.Vector3(x * vw, y * vh, z * vh));
  const cv = new THREE.CatmullRomCurve3(pts, false, 'centripetal');
  rope.len = cv.getLength(); rope.P = []; rope.T = []; rope.Nn = [];
  const up = new THREE.Vector3(0, 1, 0), fz = new THREE.Vector3(0, 0, 1);
  for (let k = 0; k < RS; k++) {
    const u = k / (RS - 1); const p = cv.getPointAt(u), t = cv.getTangentAt(u).normalize();
    // keep the strip's "up" pointing up so pictures stay upright, even where it runs leftward
    const a = up.clone().addScaledVector(t, -t.y), side = new THREE.Vector3().crossVectors(fz, t);
    if (side.dot(a) < 0) side.negate();
    const n = a.lengthSq() > .001 ? a.normalize().multiplyScalar(.8).addScaledVector(side.normalize(), .2) : side.normalize();
    n.addScaledVector(t, -n.dot(t)).normalize();
    if (k > 0 && n.dot(rope.Nn[k - 1]) < 0) n.negate();
    rope.P.push(p); rope.T.push(t); rope.Nn.push(n);
  }
  for (let it = 0; it < 6; it++) for (let k = 1; k < RS - 1; k++) {
    const n = rope.Nn[k]; n.add(rope.Nn[k - 1]).add(rope.Nn[k + 1]).multiplyScalar(1 / 3);
    n.addScaledVector(rope.T[k], -n.dot(rope.T[k])).normalize();
  }
  for (let k = 0; k < RS; k++) rope.Nn[k].applyAxisAngle(rope.T[k], .45 * Math.sin((k / (RS - 1)) * Math.PI * 3 + .5)); // gentle rope roll
  // where the path first becomes visible near the bottom edge: the ribbon "peeks" in from here
  let k0 = 0; while (k0 < RS - 1 && rope.P[k0].y < -vh * .5 + vh * (small ? .02 : .05)) k0++;
  rope.s0 = (k0 / (RS - 1)) * rope.len + vh * .02;
}
function ropeAt(s, outP, outN) {
  const f = (s / rope.len) * (RS - 1);
  if (f <= 0) { outN.copy(rope.Nn[0]); return outP.copy(rope.P[0]).addScaledVector(rope.T[0], Math.max(s, -rope.len * .4)); }
  if (f >= RS - 1) { outN.copy(rope.Nn[RS - 1]); return outP.copy(rope.P[RS - 1]).addScaledVector(rope.T[RS - 1], Math.min(s - rope.len, rope.len * .4)); }
  const k = Math.floor(f), a = f - k;
  outN.copy(rope.Nn[k]).lerp(rope.Nn[k + 1], a).normalize();
  return outP.copy(rope.P[k]).lerp(rope.P[k + 1], a);
}
function ribbonPt(i, lx, ly, out) {
  const r = L.r; const s = r.head - i * r.sp - (.5 - lx) * r.w; // card 0 leads
  ropeAt(s, P, tmp);
  return out.copy(P).addScaledVector(tmp, ly * r.h);
}
function wallPt(i, lx, ly, out) {
  const w = L.w; const th = (i - (N - 1) / 2) * w.d + w.sway + lx * w.w / w.R;
  return out.set(Math.sin(th) * w.R, w.cy + ly * w.h, w.cz - Math.cos(th) * w.R);
}
function gridPt(i, lx, ly, out) {
  const g = L.g; const r = Math.floor(i / g.cols), c = i % g.cols;
  const cx = -g.tw / 2 + g.cw / 2 + c * (g.cw + g.gap), cy = g.th / 2 - g.ch / 2 - r * (g.ch + g.gap) - g.dy;
  return out.set(cx + lx * g.cw, cy + ly * g.ch, 0);
}
function scatterPt(m, lx, ly, out) {
  const s = L.sc.s; out.set(lx * s, ly * s * ASPECT, 0).applyQuaternion(m.userData.scatterRot); return out.add(m.userData.scatter);
}
const dirs = Array.from({ length: N }, (_, i) => { const y = 1 - (i / (N - 1)) * 2; const r = Math.sqrt(1 - y * y); const t = i * Math.PI * (3 - Math.sqrt(5)); return new THREE.Vector3(Math.cos(t) * r, y * .9, Math.sin(t) * r).normalize(); });
const E1 = v3(), E2 = v3(), D = v3();
function spherePt(i, lx, ly, out) {
  const s = L.s; D.copy(dirs[i]).applyQuaternion(s.rot);
  E1.crossVectors(new THREE.Vector3(0, 1, 0), D).normalize(); E2.crossVectors(D, E1);
  out.copy(D).multiplyScalar(s.R).addScaledVector(E1, -lx * s.w).addScaledVector(E2, ly * s.w * ASPECT);
  out.normalize().multiplyScalar(s.R); out.x += s.cx; out.y += s.cy; return out;
}

/* ---------- Scroll timeline (GSAP ScrollTrigger, scrubbed) ---------- */
gsap.registerPlugin(ScrollTrigger);
const st = { rise: 0, wall: 0, scat: 0, grid: 0, sph: 0, fade: 0, out: 0 };
const c01 = (v) => Math.min(1, Math.max(0, v));
const ez = (t) => (t < .5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2);
function buildTimeline() {
  ScrollTrigger.getAll().forEach((t) => t.kill());
  const scrub = isTouch ? 0.6 : 1.1;
  // ribbon travels along the rope from the first pixel of scroll until it leaves past the header
  gsap.timeline({ scrollTrigger: { trigger: 'main', start: 'top top', end: () => '+=' + innerHeight * 1.8, scrub } }).fromTo(st, { rise: 0 }, { rise: 1, ease: 'none' });
  // hero lines slide out in opposite directions
  gsap.timeline({ scrollTrigger: { trigger: '#hero', start: 'top top', end: () => '+=' + innerHeight * .8, scrub: isTouch ? .4 : .8 } })
    .fromTo('.hero-title .l1', { x: 0 }, { x: () => -innerWidth * 1.05, ease: 'power1.in' }, 0)
    .fromTo('.hero-title .l2', { x: 0 }, { x: () => innerWidth * 1.05, ease: 'power1.in' }, 0)
    .fromTo('.hero-tag', { opacity: 1, y: 0 }, { opacity: 0, y: -30, ease: 'power1.in', duration: .5 }, 0);
  gsap.timeline({ scrollTrigger: { trigger: '#work', start: () => 'top ' + (-innerHeight * .55), end: 'bottom bottom', scrub } })
    .fromTo(st, { wall: 0 }, { wall: 1, ease: 'none', duration: 0.3 })
    .to({}, { duration: 0.12 })
    .fromTo(st, { scat: 0 }, { scat: 1, ease: 'none', duration: 0.18 })
    .fromTo(st, { grid: 0 }, { grid: 1, ease: 'none', duration: 0.22 })
    .to({}, { duration: 0.18 });
  gsap.timeline({ scrollTrigger: { trigger: '#about', start: 'top 85%', end: 'top 10%', scrub } }).fromTo(st, { sph: 0 }, { sph: 1, ease: 'none' });
  gsap.timeline({ scrollTrigger: { trigger: '.solid', start: 'top 95%', end: 'top 20%', scrub: 0.4 } }).fromTo(st, { fade: 0 }, { fade: 1, ease: 'none' });
}
/* ---------- Work header + modal ---------- */
let active = 0;
function setActive(i) {
  if (i === active && el('whDesc').textContent) return; active = i; const p = projects[i];
  el('whNum').textContent = `(${String(i + 1).padStart(2, '0')})`; el('whTitle').textContent = p.title; el('whDesc').textContent = p.short;
}
setActive(0); el('whDesc').textContent = projects[0].short;
el('seeBtn').addEventListener('click', () => openModal(projects[active]));
const modal = el('modal');
function openModal(p) {
  el('mCover').src = `${BASE}covers/${p.id}.webp`; el('mCover').alt = p.title;
  el('mKind').textContent = `${p.kind} · ${p.year}`; el('mTitle').textContent = p.title; el('mTagline').textContent = p.tagline;
  el('mSummary').textContent = p.summary; el('mRole').textContent = p.role;
  el('mStack').innerHTML = p.stack.map((s) => `<span>${s}</span>`).join('');
  const a = el('mLink'); if (p.link) { a.href = p.link; a.textContent = p.linkLabel || 'Open'; a.style.display = ''; } else a.style.display = 'none';
  modal.classList.add('open'); modal.setAttribute('aria-hidden', 'false'); lenis?.stop();
}
function closeModal() { modal.classList.remove('open'); modal.setAttribute('aria-hidden', 'true'); lenis?.start(); }
modal.addEventListener('click', (e) => { if (e.target.closest('[data-close]')) closeModal(); });
addEventListener('keydown', (e) => { if (e.key === 'Escape') { closeModal(); toggleMenu(false); } });

const menu = el('menu');
function toggleMenu(open = !menu.classList.contains('open')) { menu.classList.toggle('open', open); el('menuBtn').textContent = open ? 'Close' : 'Menu'; open ? lenis?.stop() : lenis?.start(); }
el('menuBtn').addEventListener('click', () => toggleMenu());
menu.addEventListener('click', (e) => { const a = e.target.closest('[data-menu]'); if (!a) return; e.preventDefault(); toggleMenu(false); const t = document.querySelector(a.getAttribute('href')); const y = t.getBoundingClientRect().top + scrollY + (a.getAttribute('href') === '#work' ? el('work').offsetHeight * 0.7 : 0); lenis ? lenis.scrollTo(y) : scrollTo({ top: y, behavior: 'smooth' }); });
let userDark = localStorage.getItem('theme') === 'dark';
function applyTheme() { document.body.classList.toggle('theme-dark', userDark); }
applyTheme(); el('themeBtn').addEventListener('click', () => { userDark = !userDark; localStorage.setItem('theme', userDark ? 'dark' : 'light'); applyTheme(); });

/* ---------- Picking ---------- */
const ray = new THREE.Raycaster(), ptr = new THREE.Vector2(-9, -9); let hovered = null, pickable = false, inGrid = false;
addEventListener('pointermove', (e) => ptr.set((e.clientX / innerWidth) * 2 - 1, -(e.clientY / innerHeight) * 2 + 1));
function pick() { if (!pickable) return null; ray.setFromCamera(ptr, camera); const h = ray.intersectObjects(cards, false); return h.length ? h[0].object : null; }
canvas.addEventListener('click', (e) => { ptr.set((e.clientX / innerWidth) * 2 - 1, -(e.clientY / innerHeight) * 2 + 1); const h = pick(); if (h) { setActive(h.userData.i); openModal(h.userData.p); } });

/* ---------- Smooth scroll + render loop on one GSAP ticker ---------- */
let lenis = null;
if (!reduceMotion) {
  lenis = new Lenis({ lerp: isTouch ? 0.12 : 0.085, smoothWheel: true, syncTouch: false });
  lenis.on('scroll', ScrollTrigger.update);
}
gsap.ticker.lagSmoothing(0);
const dock = el('dock');
let time = 0; const A = v3(), B = v3();
const sm = { rise: 0, wall: 0, scat: 0, grid: 0, sph: 0, fade: 0, out: 0 }; // damped copies of the timeline values

gsap.ticker.add((t, dtMs) => {
  lenis?.raf(t * 1000);
  const dt = Math.min(dtMs / 1000, 0.05);
  time += dt * (reduceMotion ? 0.3 : 1);
  const k = 1 - Math.exp(-dt * 10);
  for (const key in sm) sm[key] += (st[key] - sm[key]) * k;
  const tRise = sm.rise * .35 + ez(sm.rise) * .65, tWall = ez(sm.wall), tScat = sm.scat, tGrid = sm.grid, tSph = ez(sm.sph), fade = sm.fade;

  inGrid = tGrid > 0.97 && tSph < 0.02;
  pickable = (inGrid || tWall < 0.02 || (tWall > 0.98 && tScat < 0.02)) && fade < 0.1;
  const b = document.body.classList;
  b.toggle('show-work', tGrid > 0.9 && tSph < 0.25);
  b.toggle('in-about', tSph > 0.5 && fade < 0.5);
  b.toggle('show-about', tSph > 0.75 && fade < 0.5);
  dock.classList.toggle('hide', fade > 0.3 || tSph > 0.3);
  canvas.style.opacity = String(1 - fade);
  bg.copy(userDark ? DIM : LIGHT).lerp(NIGHT, tSph * (1 - fade)); renderer.setClearColor(bg, 1);
  document.body.style.backgroundColor = '#' + bg.getHexString();
  if (fade >= 0.999) return;

  layoutConsts(time, tRise);
  const hit = !isTouch ? pick() : null;
  if (hit !== hovered) { hovered = hit; canvas.style.cursor = hit ? 'pointer' : ''; if (hit && inGrid) setActive(hit.userData.i); }

  for (const m of cards) {
    const { i, local } = m.userData;
    if (tWall <= 0 && tScat <= 0) { const s = L.r.head - i * L.r.sp; m.visible = s > -L.r.w * .1 && s - L.r.w < rope.len + L.r.w; if (!m.visible) continue; } else m.visible = true; const lag = (i / N) * 0.25;
    const aW = ez(c01(tWall * 1.25 - lag)), aS = ez(c01(tScat * 1.25 - lag)), aG = ez(c01(tGrid * 1.25 - lag)), aP = ez(c01(tSph * 1.3 - lag));
    m.userData.hover += ((hovered === m && pickable ? 1 : 0) - m.userData.hover) * 0.15;
    const hz = m.userData.hover * 0.35, hs = 1 + m.userData.hover * 0.04;
    const pa = m.geometry.attributes.position.array;
    for (let v = 0; v < NV; v++) {
      const lx = local[v * 2] * hs, ly = local[v * 2 + 1] * hs;
      // stage chain: ribbon -> wall -> scatter -> grid, then -> sphere
      if (aS <= 0) { ribbonPt(i, lx, ly, A); if (aW > 0) { wallPt(i, lx, ly, B); A.lerp(B, aW); } }
      else if (aG <= 0) { wallPt(i, lx, ly, A); scatterPt(m, lx, ly, B); A.lerp(B, aS); }
      else { scatterPt(m, lx, ly, A); gridPt(i, lx, ly, B); A.lerp(B, aG); }
      if (aP > 0) { spherePt(i, lx, ly, B); A.lerp(B, aP); }
      pa[v * 3] = A.x; pa[v * 3 + 1] = A.y; pa[v * 3 + 2] = A.z + hz;
    }
    m.geometry.attributes.position.needsUpdate = true;
    if (pickable) m.geometry.computeBoundingSphere();
  }
  renderer.render(scene, camera);
});
document.addEventListener('visibilitychange', () => { document.hidden ? gsap.ticker.sleep() : gsap.ticker.wake(); });

function resize() { renderer.setSize(innerWidth, innerHeight, false); camera.aspect = innerWidth / innerHeight; camera.fov = isSmall() ? 44 : 35; camera.updateProjectionMatrix(); ScrollTrigger.refresh(); }
let rt; addEventListener('resize', () => { clearTimeout(rt); rt = setTimeout(resize, 150); });

const tools = ['Next.js', 'Flutter', 'Three.js', 'Cloudflare Workers', 'React', 'TypeScript', 'Python', 'Hono', 'Firebase', 'Modal GPU', 'LoRA fine-tuning', 'GSAP', 'Kotlin', 'Drizzle', 'Paddle'];
el('marquee').innerHTML = [...tools, ...tools].map((t) => `<span>${t}</span>`).join('');

/* ---------- Splash: greetings, then a curved black curtain lifts ---------- */
function runIntro() {
  const words = [...document.querySelectorAll('#spWords span')];
  const path = el('spPath'), splash = el('splash'), curve = { d: 100 };
  const drawCurve = () => path.setAttribute('d', `M0 0 L1000 0 Q500 ${curve.d} 0 0 Z`);
  lenis?.stop(); scrollTo(0, 0);
  gsap.set('.hero-title .l1 .in', { x: () => innerWidth * .9 });
  gsap.set('.hero-title .l2 .in', { x: () => -innerWidth * .9 });
  gsap.set('.hero-tag', { opacity: 0, y: 14 });
  const tl = gsap.timeline({ delay: .15 });
  words.forEach((w, k) => {
    const first = k === 0, last = k === words.length - 1;
    tl.fromTo(w, { opacity: 0, y: first ? 18 : 10 }, { opacity: 1, y: 0, duration: first ? .45 : .12, ease: 'power2.out' })
      .to(w, { opacity: 0, duration: .08, ease: 'none' }, `+=${first ? .35 : last ? .5 : .1}`);
  });
  tl.add(() => { document.body.classList.remove('is-loading'); }, '-=.05')
    .to(splash, { y: () => -(innerHeight + innerHeight * .18), duration: 1.1, ease: 'power3.inOut' }, '-=.05')
    .to(curve, { d: 0, duration: 1.1, ease: 'power3.inOut', onUpdate: drawCurve }, '<')
    .to('.hero-title .l1 .in', { x: 0, duration: 1.5, ease: 'power3.out' }, '<.45')
    .to('.hero-title .l2 .in', { x: 0, duration: 1.5, ease: 'power3.out' }, '<.08')
    .to(rope, { intro: 1, duration: 1.6, ease: 'power3.out' }, '<.25')
    .to('.hero-tag', { opacity: 1, y: 0, duration: .8, ease: 'power2.out' }, '<.6')
    .add(() => { splash.remove(); lenis?.start(); ScrollTrigger.refresh(); });
  if (reduceMotion) tl.progress(1);
}

buildTimeline(); resize(); upgradeTextures(); runIntro();
