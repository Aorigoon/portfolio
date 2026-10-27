import * as THREE from 'three';
import Lenis from 'lenis';
import { projects } from './projects.js';

const isTouch = matchMedia('(hover: none)').matches;
const reduceMotion = matchMedia('(prefers-reduced-motion: reduce)').matches;
const isSmall = () => innerWidth < 760;

/* ---------- Card textures, drawn on canvas (no image downloads) ---------- */
const TEX_W = isTouch ? 768 : 1024;
const TEX_H = Math.round(TEX_W * 0.625);
const coverCache = {};

function roundRect(ctx, x, y, w, h, r) {
  ctx.beginPath(); ctx.moveTo(x + r, y); ctx.arcTo(x + w, y, x + w, y + h, r);
  ctx.arcTo(x + w, y + h, x, y + h, r); ctx.arcTo(x, y + h, x, y, r); ctx.arcTo(x, y, x + w, y, r); ctx.closePath();
}
function luminance(hex) {
  const n = parseInt(hex.slice(1), 16); const r = n >> 16, g = (n >> 8) & 255, b = n & 255;
  return (0.299 * r + 0.587 * g + 0.114 * b) / 255;
}
function drawCard(p, i) {
  const c = document.createElement('canvas'); c.width = TEX_W; c.height = TEX_H;
  const x = c.getContext('2d'); const s = TEX_W / 1024;
  const [a, b] = p.colors;
  const g = x.createLinearGradient(0, 0, TEX_W, TEX_H); g.addColorStop(0, a); g.addColorStop(1, b);
  x.fillStyle = g; x.fillRect(0, 0, TEX_W, TEX_H);
  // glow orbs
  for (let k = 0; k < 3; k++) {
    const ox = TEX_W * (0.55 + 0.35 * Math.sin(i * 1.7 + k * 2.1));
    const oy = TEX_H * (0.35 + 0.4 * Math.cos(i * 1.3 + k * 1.9));
    const r = TEX_W * (0.25 + 0.1 * k);
    const rg = x.createRadialGradient(ox, oy, 0, ox, oy, r);
    rg.addColorStop(0, 'rgba(255,255,255,0.28)'); rg.addColorStop(1, 'rgba(255,255,255,0)');
    x.fillStyle = rg; x.fillRect(0, 0, TEX_W, TEX_H);
  }
  // fine grid
  x.strokeStyle = 'rgba(255,255,255,0.07)'; x.lineWidth = 1;
  for (let gx = 0; gx < TEX_W; gx += 32 * s) { x.beginPath(); x.moveTo(gx, 0); x.lineTo(gx, TEX_H); x.stroke(); }
  for (let gy = 0; gy < TEX_H; gy += 32 * s) { x.beginPath(); x.moveTo(0, gy); x.lineTo(TEX_W, gy); x.stroke(); }

  const dark = luminance(a) * 0.5 + luminance(b) * 0.5 > 0.62;
  const ink = dark ? '#111' : '#fff';
  const soft = dark ? 'rgba(0,0,0,0.6)' : 'rgba(255,255,255,0.78)';

  // browser chrome
  x.fillStyle = dark ? 'rgba(255,255,255,0.45)' : 'rgba(0,0,0,0.22)';
  roundRect(x, 0, TEX_W, 44 * s, 0); x.fill();
  ['#ff5f57', '#febc2e', '#28c840'].forEach((col, k) => { x.fillStyle = col; x.beginPath(); x.arc((26 + k * 22) * s, 22 * s, 6.5 * s, 0, Math.PI * 2); x.fill(); });
  x.fillStyle = dark ? 'rgba(0,0,0,0.12)' : 'rgba(255,255,255,0.16)';
  roundRect(x, 110 * s, 11 * s, 380 * s, 22 * s, 11 * s); x.fill();
  x.fillStyle = soft; x.font = `500 ${13 * s}px "Inter Tight", sans-serif`; x.textBaseline = 'middle';
  x.fillText(`${p.id}.app`, 124 * s, 22.5 * s);

  // mock UI panel on the right
  x.save(); x.globalAlpha = 0.9;
  x.fillStyle = dark ? 'rgba(255,255,255,0.55)' : 'rgba(255,255,255,0.14)';
  roundRect(x, 640 * s, 110 * s, 330 * s, 420 * s, 22 * s); x.fill();
  x.fillStyle = dark ? 'rgba(0,0,0,0.12)' : 'rgba(255,255,255,0.22)';
  for (let k = 0; k < 5; k++) { roundRect(x, 664 * s, (140 + k * 62) * s, (280 - (k % 3) * 60) * s, 34 * s, 10 * s); x.fill(); }
  x.fillStyle = ink; roundRect(x, 664 * s, 456 * s, 130 * s, 46 * s, 23 * s); x.fill();
  x.restore();

  // text
  x.textBaseline = 'alphabetic'; x.fillStyle = soft;
  x.font = `600 ${18 * s}px "Inter Tight", sans-serif`;
  x.fillText(`${p.kind.toUpperCase()}  ·  ${p.year}`, 56 * s, 140 * s);
  x.fillStyle = ink; x.font = `600 ${112 * s}px "Inter Tight", sans-serif`;
  x.fillText(p.title, 50 * s, 260 * s);
  x.font = `italic 400 ${40 * s}px "Instrument Serif", serif`;
  const words = p.tagline.split(' '); let line = '', ly = 330 * s;
  for (const w of words) {
    const t = line ? line + ' ' + w : w;
    if (x.measureText(t).width > 540 * s) { x.fillText(line, 56 * s, ly); line = w; ly += 46 * s; } else line = t;
  }
  x.fillText(line, 56 * s, ly);
  // chips
  let cx = 56 * s; const cy = 520 * s; x.font = `500 ${17 * s}px "Inter Tight", sans-serif`;
  for (const t of p.stack.slice(0, 3)) {
    const w = x.measureText(t).width + 28 * s; if (cx + w > 610 * s) break;
    x.strokeStyle = soft; x.lineWidth = 1.5 * s; roundRect(x, cx, cy - 26 * s, w, 38 * s, 19 * s); x.stroke();
    x.fillStyle = ink; x.fillText(t, cx + 14 * s, cy - 1 * s); cx += w + 10 * s;
  }
  coverCache[p.id] = c.toDataURL('image/jpeg', 0.85);
  return c;
}

/* ---------- Three.js scene ---------- */
const canvas = document.getElementById('gl');
const renderer = new THREE.WebGLRenderer({ canvas, antialias: devicePixelRatio < 2, powerPreference: 'high-performance' });
renderer.setPixelRatio(Math.min(devicePixelRatio, isTouch ? 1.5 : 2));
renderer.outputColorSpace = THREE.SRGBColorSpace;
const scene = new THREE.Scene();
const camera = new THREE.PerspectiveCamera(35, innerWidth / innerHeight, 0.1, 100);
camera.position.set(0, 0, 12);
const LIGHT = new THREE.Color('#f4f3ef'), DARK = new THREE.Color('#0b0b0f');
const bg = new THREE.Color().copy(LIGHT);

const ASPECT = 0.625;
const geo = new THREE.PlaneGeometry(1, ASPECT, 1, 1);
const cards = [];
const N = projects.length;

function buildCards() {
  projects.forEach((p, i) => {
    const tex = new THREE.CanvasTexture(drawCard(p, i));
    tex.colorSpace = THREE.SRGBColorSpace; tex.anisotropy = 4;
    tex.generateMipmaps = true; tex.minFilter = THREE.LinearMipmapLinearFilter;
    const mat = new THREE.MeshBasicMaterial({ map: tex, side: THREE.DoubleSide, transparent: true });
    const m = new THREE.Mesh(geo, mat);
    m.userData = { i, p, hover: 0, scatter: new THREE.Vector3((Math.random() - .5) * 9, (Math.random() - .5) * 5, (Math.random() - .5) * 4 - 1), scatterRot: new THREE.Euler((Math.random() - .5) * .8, (Math.random() - .5) * 1.2, (Math.random() - .5) * .6) };
    scene.add(m); cards.push(m);
  });
}

/* ---------- Layouts ---------- */
const tmpQ = new THREE.Quaternion(), tmpE = new THREE.Euler(), up = new THREE.Vector3(0, 1, 0);
function visibleSize() {
  const h = 2 * camera.position.z * Math.tan(THREE.MathUtils.degToRad(camera.fov / 2));
  return { w: h * camera.aspect, h };
}
function ribbon(i, time, out) {
  const small = isSmall(); const w = small ? 1.7 : 2.5; const sp = w * 1.06;
  const L = N * sp; let xs = ((i * sp + time * (small ? .45 : .6)) % L + L) % L - L / 2;
  const amp = small ? 0.45 : 0.6;
  const y = amp * Math.sin(xs * 0.42) + (small ? -2.75 : -2.15);
  const z = -0.6 + 1.6 * Math.cos(xs * 0.33);
  const dx = 1, dy = amp * 0.42 * Math.cos(xs * 0.42), dz = -1.6 * 0.33 * Math.sin(xs * 0.33);
  out.pos.set(xs, y, z);
  tmpE.set(0, -Math.atan2(dz, dx) * 0.9, Math.atan2(dy, dx) * 0.7); out.quat.setFromEuler(tmpE);
  out.scale = w;
}
function grid(i, out) {
  const { w: vw, h: vh } = visibleSize();
  const cols = vw / vh > 1.1 ? 4 : vw / vh > 0.75 ? 3 : 2;
  const rows = Math.ceil(N / cols); const gap = 0.18;
  let cw = (vw * 0.86 - gap * (cols - 1)) / cols;
  const availH = vh * 0.68; const ch = cw * ASPECT;
  if (rows * ch + (rows - 1) * gap > availH) cw = ((availH - (rows - 1) * gap) / rows) / ASPECT;
  const r = Math.floor(i / cols), c = i % cols;
  const inRow = Math.min(cols, N - r * cols);
  const totalW = inRow * cw + (inRow - 1) * gap;
  const totalH = rows * cw * ASPECT + (rows - 1) * gap;
  out.pos.set(-totalW / 2 + cw / 2 + c * (cw + gap), totalH / 2 - (cw * ASPECT) / 2 - r * (cw * ASPECT + gap) - vh * 0.04, 0);
  out.quat.identity(); out.scale = cw;
}
const sphereDirs = Array.from({ length: N }, (_, i) => {
  const y = 1 - (i / (N - 1)) * 2; const r = Math.sqrt(1 - y * y); const th = i * Math.PI * (3 - Math.sqrt(5));
  return new THREE.Vector3(Math.cos(th) * r, y * 0.85, Math.sin(th) * r).normalize();
});
const sphereRot = new THREE.Quaternion();
function sphere(i, time, out) {
  const small = isSmall(); const R = small ? 1.55 : 2.9;
  const d = sphereDirs[i];
  tmpQ.setFromAxisAngle(up, time * 0.25);
  sphereRot.setFromEuler(tmpE.set(0.25, 0, 0)).multiply(tmpQ);
  const dir = d.clone().applyQuaternion(sphereRot);
  out.pos.copy(dir).multiplyScalar(R);
  out.pos.x += small ? 0 : 2.6; out.pos.y += small ? 2.3 : 0;
  const m = new THREE.Matrix4().lookAt(new THREE.Vector3(0, 0, 0), dir, up);
  out.quat.setFromRotationMatrix(m); out.quat.multiply(new THREE.Quaternion().setFromAxisAngle(up, Math.PI));
  out.scale = small ? 1.05 : 1.6;
}

/* ---------- Scroll timeline ---------- */
const el = (id) => document.getElementById(id);
let stops = {};
function measure() {
  const vh = innerHeight; const top = (e) => e.getBoundingClientRect().top + scrollY;
  const w = top(el('work')), d = top(el('dark')), s = top(el('services'));
  stops = {
    rgA: vh * 0.25, rgB: w + vh * 0.45,
    gsA: d - vh * 0.55, gsB: d + vh * 0.35,
    fadeA: s - vh * 0.9, fadeB: s - vh * 0.2,
    workOn: w + vh * 0.3, darkOn: d - vh * 0.1,
  };
}
const clamp01 = (v) => Math.min(1, Math.max(0, v));
const ease = (t) => (t < .5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2);
const prog = (y, a, b) => clamp01((y - a) / (b - a));

/* ---------- Interaction ---------- */
const raycaster = new THREE.Raycaster(); const pointer = new THREE.Vector2(-9, -9);
let hovered = null, interactive = false;
const hoverLabel = el('hoverLabel');
addEventListener('pointermove', (e) => { pointer.set((e.clientX / innerWidth) * 2 - 1, -(e.clientY / innerHeight) * 2 + 1); });
canvas.addEventListener('click', (e) => {
  pointer.set((e.clientX / innerWidth) * 2 - 1, -(e.clientY / innerHeight) * 2 + 1);
  const hit = pick(); if (hit) openModal(hit.userData.p);
});
function pick() {
  if (!interactive) return null;
  raycaster.setFromCamera(pointer, camera);
  const h = raycaster.intersectObjects(cards, false); return h.length ? h[0].object : null;
}
const modal = el('modal');
function openModal(p) {
  el('mCover').style.backgroundImage = `url(${coverCache[p.id]})`;
  el('mKind').textContent = `${p.kind} · ${p.year}`; el('mTitle').textContent = p.title;
  el('mTagline').textContent = p.tagline; el('mSummary').textContent = p.summary; el('mRole').textContent = p.role;
  el('mStack').innerHTML = p.stack.map((s) => `<span>${s}</span>`).join('');
  const a = el('mLink'); if (p.link) { a.href = p.link; a.textContent = p.linkLabel || 'Open'; a.style.display = ''; } else a.style.display = 'none';
  modal.classList.add('open'); modal.setAttribute('aria-hidden', 'false'); lenis?.stop();
}
function closeModal() { modal.classList.remove('open'); modal.setAttribute('aria-hidden', 'true'); lenis?.start(); }
modal.addEventListener('click', (e) => { if (e.target.closest('[data-close]')) closeModal(); });
addEventListener('keydown', (e) => { if (e.key === 'Escape') closeModal(); });

/* ---------- Loop ---------- */
let lenis = null;
if (!isTouch && !reduceMotion) {
  lenis = new Lenis({ lerp: 0.1 });
}
const A = { pos: new THREE.Vector3(), quat: new THREE.Quaternion(), scale: 1 };
const B = { pos: new THREE.Vector3(), quat: new THREE.Quaternion(), scale: 1 };
const C = { pos: new THREE.Vector3(), quat: new THREE.Quaternion(), scale: 1 };
const clock = new THREE.Clock(); let time = 0; let running = true;
document.addEventListener('visibilitychange', () => { running = !document.hidden; if (running) { clock.getDelta(); requestAnimationFrame(loop); } });

function blend(m, out, from, to, t) {
  out.pos.lerpVectors(from.pos, to.pos, t); out.quat.slerpQuaternions(from.quat, to.quat, t); out.scale = THREE.MathUtils.lerp(from.scale, to.scale, t);
}
function loop(now) {
  if (!running) return;
  lenis?.raf(now);
  const dt = Math.min(clock.getDelta(), 0.05); time += dt * (reduceMotion ? 0.3 : 1);
  const y = scrollY;
  const t1 = ease(prog(y, stops.rgA, stops.rgB));
  const t2 = ease(prog(y, stops.gsA, stops.gsB));
  const fade = prog(y, stops.fadeA, stops.fadeB);

  document.body.classList.toggle('is-dark', t2 > 0.5);
  document.body.classList.toggle('show-work', y > stops.workOn && t2 < 0.3);
  document.body.classList.toggle('show-dark', t2 > 0.7 && fade < 0.6);
  canvas.style.opacity = String(1 - fade);
  interactive = t1 > 0.97 && t2 < 0.03 && fade < 0.1 || (t1 < 0.02);

  bg.copy(LIGHT).lerp(DARK, t2); renderer.setClearColor(bg, 1);

  const hit = !isTouch ? pick() : null;
  if (hit !== hovered) { hovered = hit; canvas.style.cursor = hit ? 'pointer' : ''; hoverLabel.textContent = hit ? `${hit.userData.p.title} · ${hit.userData.p.kind}` : ''; hoverLabel.classList.toggle('on', !!hit && t1 > 0.97); }

  for (const m of cards) {
    const { i, scatter, scatterRot } = m.userData;
    // stage 1: ribbon -> scatter -> grid
    if (t1 <= 0) ribbon(i, time, A);
    else if (t1 >= 1) grid(i, A);
    else {
      const stagger = clamp01(t1 * 1.25 - (i / N) * 0.25);
      if (stagger < 0.5) { ribbon(i, time, B); C.pos.copy(scatter); C.quat.setFromEuler(scatterRot); C.scale = isSmall() ? 1.3 : 1.9; blend(m, A, B, C, ease(stagger * 2)); }
      else { C.pos.copy(scatter); C.quat.setFromEuler(scatterRot); C.scale = isSmall() ? 1.3 : 1.9; grid(i, B); blend(m, A, C, B, ease((stagger - 0.5) * 2)); }
    }
    // stage 2: grid -> sphere
    if (t2 > 0) { sphere(i, time, B); const st = clamp01(t2 * 1.3 - (i / N) * 0.3); C.pos.copy(A.pos); C.quat.copy(A.quat); C.scale = A.scale; blend(m, A, C, B, ease(st)); }
    m.userData.hover += ((hovered === m ? 1 : 0) - m.userData.hover) * 0.15;
    m.position.copy(A.pos); m.position.z += m.userData.hover * 0.4;
    m.quaternion.copy(A.quat); m.scale.setScalar(A.scale * (1 + m.userData.hover * 0.05));
  }
  if (fade < 1) renderer.render(scene, camera);
  requestAnimationFrame(loop);
}

function resize() {
  renderer.setSize(innerWidth, innerHeight, false);
  camera.aspect = innerWidth / innerHeight; camera.fov = innerWidth < 760 ? 42 : 35;
  camera.updateProjectionMatrix(); measure();
}
let rt; addEventListener('resize', () => { clearTimeout(rt); rt = setTimeout(resize, 120); });

/* ---------- Marquee ---------- */
const tools = ['Next.js', 'Flutter', 'Three.js', 'Cloudflare Workers', 'React', 'TypeScript', 'Python', 'Hono', 'Firebase', 'Modal GPU', 'LoRA fine-tuning', 'GSAP', 'Kotlin', 'Drizzle', 'Paddle'];
el('marquee').innerHTML = [...tools, ...tools].map((t) => `<span>${t}</span>`).join('');

/* ---------- Boot ---------- */
(async () => {
  try { await Promise.race([document.fonts.ready, new Promise((r) => setTimeout(r, 1500))]); } catch {}
  buildCards(); resize(); requestAnimationFrame(loop);
})();
