import * as THREE from 'three';
import Lenis from 'lenis';
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
const geo = new THREE.PlaneGeometry(1, ASPECT);
const cards = [];
const rnd = (k) => { const v = Math.sin(k * 127.1 + 311.7) * 43758.5453; return v - Math.floor(v); };

projects.forEach((p, i) => {
  const tex = new THREE.CanvasTexture(drawCard(p, null)); tex.colorSpace = THREE.SRGBColorSpace; tex.anisotropy = 4;
  const m = new THREE.Mesh(geo, new THREE.MeshBasicMaterial({ map: tex, side: THREE.DoubleSide }));
  m.userData = { i, p, hover: 0, tex,
    scatter: new THREE.Vector3((rnd(i) - .5) * 8.5, (rnd(i + 20) - .5) * 5, (rnd(i + 40) - .5) * 3 - 1),
    scatterRot: new THREE.Euler((rnd(i + 60) - .5) * .5, (rnd(i + 80) - .5) * .9, (rnd(i + 99) - .5) * .4) };
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

/* ---------- Layouts (each writes pos / quat / scale) ---------- */
const E = new THREE.Euler(), Q1 = new THREE.Quaternion(), Q2 = new THREE.Quaternion(), UP = new THREE.Vector3(0, 1, 0), ORIGIN = new THREE.Vector3();
const M4 = new THREE.Matrix4();
function vis() { const h = 2 * camera.position.z * Math.tan(THREE.MathUtils.degToRad(camera.fov / 2)); return { w: h * camera.aspect, h }; }

// 1. Film-strip ribbon sweeping diagonally, twisting as it flows
function ribbon(i, time, rise, out) {
  const small = isSmall(); const w = small ? 1.25 : 1.75; const sp = w * 1.015;
  const L = N * sp; const u = ((i * sp - time * (small ? .35 : .5)) % L + L) % L - L / 2;
  const slope = small ? 0.55 : 0.32;
  const y = u * slope + 0.35 * Math.sin(u * 0.35) + (small ? 0.4 : 0.2) - rise;
  const z = -0.8 - u * 0.12;
  const dy = slope + 0.35 * 0.35 * Math.cos(u * 0.35);
  const twist = 0.75 * Math.sin(u * 0.28 + 1.2);
  out.pos.set(u, y, z);
  Q1.setFromAxisAngle(new THREE.Vector3(1, 0, 0), twist);
  Q2.setFromEuler(E.set(0, -0.18, Math.atan(dy)));
  out.quat.copy(Q2).multiply(Q1); out.scale = w;
}
// 2. Curved wall of big cards wrapping around the viewer
function wall(i, time, out) {
  const small = isSmall(); const R = small ? 6 : 8.5; const w = small ? 2.4 : 3.6;
  const d = (w * 1.03) / R; const th = (i - (N - 1) / 2) * d + Math.sin(time * 0.15) * 0.25 - 0.1;
  out.pos.set(Math.sin(th) * R, small ? 0.3 : 0, 9 - Math.cos(th) * R - (small ? 2.5 : 0));
  out.quat.setFromAxisAngle(UP, -th); out.scale = w;
}
// 3. Tidy grid under the project header
function grid(i, out) {
  const { w: vw, h: vh } = vis(); const small = isSmall();
  const cols = small ? 2 : 4; const rows = Math.ceil(N / cols); const gap = small ? 0.12 : 0.14;
  let cw = Math.min(small ? 9 : 2.6, (vw * (small ? 0.9 : 0.7) - gap * (cols - 1)) / cols);
  const availH = vh * (small ? 0.66 : 0.68);
  if (rows * cw * ASPECT + (rows - 1) * gap > availH) cw = ((availH - (rows - 1) * gap) / rows) / ASPECT;
  const ch = cw * ASPECT; const r = Math.floor(i / cols), c = i % cols;
  const totalW = cols * cw + (cols - 1) * gap; const totalH = rows * ch + (rows - 1) * gap;
  out.pos.set(-totalW / 2 + cw / 2 + c * (cw + gap), totalH / 2 - ch / 2 - r * (ch + gap) - vh * (small ? 0.09 : 0.06), 0);
  out.quat.identity(); out.scale = cw;
}
// 4. Rotating sphere of cards behind the about copy
const dirs = Array.from({ length: N }, (_, i) => { const y = 1 - (i / (N - 1)) * 2; const r = Math.sqrt(1 - y * y); const t = i * Math.PI * (3 - Math.sqrt(5)); return new THREE.Vector3(Math.cos(t) * r, y * .9, Math.sin(t) * r).normalize(); });
const SR = new THREE.Quaternion();
function sphere(i, time, out) {
  const small = isSmall(); const R = small ? 1.9 : 3.3;
  SR.setFromEuler(E.set(0.35, 0, 0.15)).multiply(Q1.setFromAxisAngle(UP, time * 0.22));
  const d = dirs[i].clone().applyQuaternion(SR);
  out.pos.copy(d).multiplyScalar(R); out.pos.y += small ? 1.2 : 0.1; out.pos.x += small ? 0 : 1.2;
  M4.lookAt(ORIGIN, d, UP); out.quat.setFromRotationMatrix(M4).multiply(Q2.setFromAxisAngle(UP, Math.PI));
  out.scale = small ? 1.1 : 1.55;
}
function scatter(m, out) { const s = isSmall() ? 1.1 : 1.5; out.pos.copy(m.userData.scatter); out.quat.setFromEuler(m.userData.scatterRot); out.scale = s; }

/* ---------- Scroll timeline ---------- */
let S = {};
function measure() {
  const vh = innerHeight; const top = (e) => e.getBoundingClientRect().top + scrollY;
  const w = top(el('work')), wh = el('work').offsetHeight, a = top(el('about')), s = top(document.querySelector('.solid'));
  const span = wh - vh;
  S = { rise: [0, vh * 0.7], wall: [w - vh * 0.2, w + span * 0.22], scat: [w + span * 0.36, w + span * 0.52], grid: [w + span * 0.52, w + span * 0.72],
        sph: [a - vh * 0.75, a + vh * 0.2], fade: [s - vh * 0.85, s - vh * 0.15], workOn: w + span * 0.72, aboutOn: a - vh * 0.1, dockOff: s - vh * 0.6 };
}
const c01 = (v) => Math.min(1, Math.max(0, v));
const ez = (t) => (t < .5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2);
const pr = (y, [a, b]) => c01((y - a) / (b - a));
function blend(out, A, B, t) { out.pos.lerpVectors(A.pos, B.pos, t); out.quat.slerpQuaternions(A.quat, B.quat, t); out.scale = A.scale + (B.scale - A.scale) * t; }
const mk = () => ({ pos: new THREE.Vector3(), quat: new THREE.Quaternion(), scale: 1 });
const A = mk(), B = mk(), C = mk();

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

/* ---------- Loop ---------- */
let lenis = null; if (!isTouch && !reduceMotion) lenis = new Lenis({ lerp: 0.09 });
const clock = new THREE.Clock(); let time = 0, running = true;
document.addEventListener('visibilitychange', () => { running = !document.hidden; if (running) { clock.getDelta(); requestAnimationFrame(loop); } });
const dock = el('dock');

function loop(now) {
  if (!running) return;
  lenis?.raf(now);
  time += Math.min(clock.getDelta(), 0.05) * (reduceMotion ? 0.3 : 1);
  const y = scrollY;
  const tRise = ez(pr(y, S.rise)), tWall = ez(pr(y, S.wall)), tScat = pr(y, S.scat), tGrid = pr(y, S.grid), tSph = ez(pr(y, S.sph)), fade = pr(y, S.fade);
  inGrid = tGrid > 0.98 && tSph < 0.02;
  pickable = (inGrid || tWall < 0.02 || (tWall > 0.98 && tScat < 0.02)) && fade < 0.1;
  const b = document.body.classList;
  b.toggle('show-work', y > S.workOn && tSph < 0.25);
  b.toggle('in-about', tSph > 0.5 && fade < 0.5);
  b.toggle('show-about', tSph > 0.75 && fade < 0.5);
  dock.classList.toggle('hide', y > S.dockOff || (tSph > 0.3 && fade < 0.5));
  canvas.style.opacity = String(1 - fade);
  bg.copy(userDark ? DIM : LIGHT).lerp(NIGHT, tSph * (1 - fade)); renderer.setClearColor(bg, 1);
  document.body.style.backgroundColor = '#' + bg.getHexString();

  const hit = !isTouch ? pick() : null;
  if (hit !== hovered) { hovered = hit; canvas.style.cursor = hit ? 'pointer' : ''; if (hit && inGrid) setActive(hit.userData.i); }

  const rise = (1 - tRise) * (isSmall() ? 3.6 : 3.2);
  for (const m of cards) {
    const i = m.userData.i;
    const lag = (i / N) * 0.25;
    if (tWall <= 0) ribbon(i, time, rise, A);
    else if (tScat <= 0) { ribbon(i, time, 0, B); wall(i, time, C); blend(A, B, C, ez(c01(tWall * 1.25 - lag))); }
    else if (tGrid <= 0) { wall(i, time, B); scatter(m, C); blend(A, B, C, ez(c01(tScat * 1.25 - lag))); }
    else { scatter(m, B); grid(i, C); blend(A, B, C, ez(c01(tGrid * 1.25 - lag))); }
    if (tSph > 0) { C.pos.copy(A.pos); C.quat.copy(A.quat); C.scale = A.scale; sphere(i, time, B); blend(A, C, B, ez(c01(tSph * 1.3 - lag))); }
    m.userData.hover += ((hovered === m && pickable ? 1 : 0) - m.userData.hover) * 0.15;
    m.position.copy(A.pos); m.position.z += m.userData.hover * 0.35;
    m.quaternion.copy(A.quat); m.scale.setScalar(A.scale * (1 + m.userData.hover * 0.04));
  }
  if (fade < 1) renderer.render(scene, camera);
  requestAnimationFrame(loop);
}
function resize() { renderer.setSize(innerWidth, innerHeight, false); camera.aspect = innerWidth / innerHeight; camera.fov = isSmall() ? 44 : 35; camera.updateProjectionMatrix(); measure(); }
let rt; addEventListener('resize', () => { clearTimeout(rt); rt = setTimeout(resize, 120); });

const tools = ['Next.js', 'Flutter', 'Three.js', 'Cloudflare Workers', 'React', 'TypeScript', 'Python', 'Hono', 'Firebase', 'Modal GPU', 'LoRA fine-tuning', 'GSAP', 'Kotlin', 'Drizzle', 'Paddle'];
el('marquee').innerHTML = [...tools, ...tools].map((t) => `<span>${t}</span>`).join('');

resize(); requestAnimationFrame(loop); upgradeTextures();
