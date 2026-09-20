// ============================================================
// GTDM core utilities — math, RNG, formatting, tiny event bus
// ============================================================
export const clamp = (v, a, b) => v < a ? a : v > b ? b : v;
export const lerp = (a, b, t) => a + (b - a) * t;
export const inv = (a, b, v) => (v - a) / (b - a);
export const dist = (x1, y1, x2, y2) => Math.hypot(x2 - x1, y2 - y1);
export const dist2 = (x1, y1, x2, y2) => { const dx = x2 - x1, dy = y2 - y1; return dx * dx + dy * dy; };
export const TAU = Math.PI * 2;
export const now = () => performance.now();
export const uid = (() => { let i = 1; return () => 'u' + (i++) + '_' + Math.floor(Math.random() * 1e6).toString(36); })();

export function angLerp(a, b, t) {
  let d = ((b - a + Math.PI) % TAU + TAU) % TAU - Math.PI;
  return a + d * t;
}

// Mulberry32 seeded RNG — deterministic per stage/day
export function mulberry32(seed) {
  let a = seed >>> 0;
  return function () {
    a |= 0; a = a + 0x6D2B79F5 | 0;
    let t = Math.imul(a ^ a >>> 15, 1 | a);
    t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t;
    return ((t ^ t >>> 14) >>> 0) / 4294967296;
  };
}
export function hashStr(s) {
  let h = 2166136261;
  for (let i = 0; i < s.length; i++) { h ^= s.charCodeAt(i); h = Math.imul(h, 16777619); }
  return h >>> 0;
}
export const dayKey = (d = new Date()) => `${d.getFullYear()}-${d.getMonth() + 1}-${d.getDate()}`;
export function daysBetween(a, b) {
  const ua = Date.UTC(a.getFullYear(), a.getMonth(), a.getDate());
  const ub = Date.UTC(b.getFullYear(), b.getMonth(), b.getDate());
  return Math.round((ub - ua) / 86400000);
}

export function fmt(n) {
  n = Math.floor(n);
  if (n >= 1e9) return (n / 1e9).toFixed(n >= 1e10 ? 0 : 1).replace(/\.0$/, '') + 'B';
  if (n >= 1e6) return (n / 1e6).toFixed(n >= 1e7 ? 0 : 1).replace(/\.0$/, '') + 'M';
  if (n >= 1e4) return (n / 1e3).toFixed(n >= 1e5 ? 0 : 1).replace(/\.0$/, '') + 'K';
  return n.toLocaleString('en-US');
}

// Weighted random pick: items = [[weight, value], ...]
export function wpick(items, rnd = Math.random) {
  let total = 0;
  for (const it of items) total += it[0];
  let r = rnd() * total;
  for (const it of items) { r -= it[0]; if (r <= 0) return it[1]; }
  return items[items.length - 1][1];
}
export function pick(arr, rnd = Math.random) { return arr[Math.floor(rnd() * arr.length)]; }
export function shuffle(arr, rnd = Math.random) {
  for (let i = arr.length - 1; i > 0; i--) { const j = Math.floor(rnd() * (i + 1));[arr[i], arr[j]] = [arr[j], arr[i]]; }
  return arr;
}

// ---------- tiny event bus ----------
class Bus {
  constructor() { this.m = new Map(); }
  on(ev, fn) { if (!this.m.has(ev)) this.m.set(ev, new Set()); this.m.get(ev).add(fn); return () => this.off(ev, fn); }
  off(ev, fn) { this.m.get(ev)?.delete(fn); }
  emit(ev, data) { this.m.get(ev)?.forEach(fn => { try { fn(data); } catch (e) { console.error('[bus]', ev, e); } }); }
}
export const bus = new Bus();

// ---------- DOM helpers ----------
export function el(tag, cls, html) {
  const e = document.createElement(tag);
  if (cls) e.className = cls;
  if (html != null) e.innerHTML = html;
  return e;
}
export function clear(node) { while (node.firstChild) node.removeChild(node.firstChild); }
export function qs(sel) { return document.querySelector(sel); }

// ---------- canvas helpers ----------
export function mkCanvas(w, h) {
  const c = document.createElement('canvas');
  c.width = w; c.height = h;
  return c;
}
export function roundRect(ctx, x, y, w, h, r) {
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.arcTo(x + w, y, x + w, y + h, r);
  ctx.arcTo(x + w, y + h, x, y + h, r);
  ctx.arcTo(x, y + h, x, y, r);
  ctx.arcTo(x, y, x + w, y, r);
  ctx.closePath();
}
// hex -> rgba string
export function rgba(hex, a) {
  const h = hex.replace('#', '');
  const n = parseInt(h.length === 3 ? h.split('').map(c => c + c).join('') : h, 16);
  return `rgba(${(n >> 16) & 255},${(n >> 8) & 255},${n & 255},${a})`;
}
export function mixHex(h1, h2, t) {
  const p = h => { const x = h.replace('#', ''); const n = parseInt(x.length === 3 ? x.split('').map(c => c + c).join('') : x, 16); return [(n >> 16) & 255, (n >> 8) & 255, n & 255]; };
  const a = p(h1), b = p(h2);
  const c = a.map((v, i) => Math.round(lerp(v, b[i], t)));
  return `rgb(${c[0]},${c[1]},${c[2]})`;
}
export function shade(hex, amt) { // amt -1..1
  const x = hex.replace('#', '');
  const n = parseInt(x.length === 3 ? x.split('').map(c => c + c).join('') : x, 16);
  let r = (n >> 16) & 255, g = (n >> 8) & 255, b = n & 255;
  if (amt > 0) { r += (255 - r) * amt; g += (255 - g) * amt; b += (255 - b) * amt; }
  else { r *= 1 + amt; g *= 1 + amt; b *= 1 + amt; }
  return `rgb(${r | 0},${g | 0},${b | 0})`;
}

// simple deep clone (JSON-safe data only)
export const deepClone = o => JSON.parse(JSON.stringify(o));

// throttle for expensive UI refreshes
export function throttle(fn, ms) {
  let last = 0, timer = null;
  return (...args) => {
    const t = Date.now();
    if (t - last >= ms) { last = t; fn(...args); }
    else if (!timer) timer = setTimeout(() => { last = Date.now(); timer = null; fn(...args); }, ms - (t - last));
  };
}
