// ============================================================
// GTDM FX — pooled particles, floating text, rings, lightning,
// screen shake, ambient weather. All canvas-space (logical px).
// ============================================================
import { TAU, rgba, clamp } from '../core/util.js';

export const rndRange = (a, b) => a + Math.random() * (b - a);


// ---------- pooled particle ----------
const PMAX = 1400;
class Particle {
  constructor() { this.alive = false; }
  init(o) {
    this.alive = true;
    this.x = o.x; this.y = o.y;
    this.vx = o.vx ?? 0; this.vy = o.vy ?? 0;
    this.g = o.g ?? 0;            // gravity
    this.drag = o.drag ?? 0;      // per-second velocity damping factor
    this.life = o.life; this.t = 0;
    this.size = o.size ?? 4; this.size2 = o.size2 ?? 0; // end size
    this.color = o.color ?? '#fff';
    this.kind = o.kind ?? 'dot';  // dot|spark|smoke|shard|star|ring|ember
    this.rot = o.rot ?? 0; this.vr = o.vr ?? 0;
    this.alpha = o.alpha ?? 1;
    this.glow = o.glow ?? false;
    this.collide = o.collide ?? false; // bounce off ground y
    this.groundY = o.groundY ?? 1e9;
    return this;
  }
}

export class FXSystem {
  constructor() {
    this.pool = [];
    for (let i = 0; i < PMAX; i++) this.pool.push(new Particle());
    this.free = this.pool.slice();
    this.texts = [];
    this.rings = [];
    this.beams = [];
    this.shakeAmt = 0; this.shakeT = 0;
    this.flash = null; // {color, t, dur, alpha}
    this.decals = [];  // ground scorch/lava pools drawn under units: {x,y,r,color,t,dur,kind}
  }
  spawn(o) {
    if (!this.free.length) {
      // recycle oldest
      let oldest = null;
      for (const p of this.pool) if (p.alive && (!oldest || p.t / p.life > oldest.t / oldest.life)) oldest = p;
      if (!oldest) return null;
      oldest.alive = false;
      this.free.push(oldest);
    }
    return this.free.pop().init(o);
  }

  // ---------- emitters ----------
  burst(x, y, { n = 10, color = '#ffd966', speed = 120, spread = TAU, dir = 0, life = 0.5, size = 4, g = 200, kind = 'dot', glow = false, drag = 0 } = {}) {
    for (let i = 0; i < n; i++) {
      const a = dir + (spread >= TAU ? Math.random() * TAU : (Math.random() - 0.5) * spread);
      const s = speed * (0.4 + Math.random() * 0.8);
      this.spawn({ x, y, vx: Math.cos(a) * s, vy: Math.sin(a) * s, g, life: life * (0.6 + Math.random() * 0.7), size: size * (0.6 + Math.random() * 0.8), size2: 0, color, kind, glow, drag });
    }
  }
  smoke(x, y, { n = 6, color = '#555068', life = 0.8, size = 10, vy = -30 } = {}) {
    for (let i = 0; i < n; i++) {
      this.spawn({ x: x + rndRange(-6, 6), y: y + rndRange(-4, 4), vx: rndRange(-14, 14), vy: vy + rndRange(-14, 6), g: -8, life: life * (0.7 + Math.random() * 0.6), size: size * (0.6 + Math.random() * 0.7), size2: size * 2.2, color, kind: 'smoke', alpha: 0.55 });
    }
  }
  embers(x, y, n = 8, color = '#ff9a3a') {
    for (let i = 0; i < n; i++) {
      this.spawn({ x: x + rndRange(-8, 8), y: y + rndRange(-4, 4), vx: rndRange(-20, 20), vy: rndRange(-90, -40), g: -20, life: rndRange(0.5, 1.1), size: rndRange(1.5, 3.5), color, kind: 'ember', glow: true });
    }
  }
  shards(x, y, n = 8, color = '#cfd6e4') {
    for (let i = 0; i < n; i++) {
      const a = Math.random() * TAU, s = rndRange(60, 200);
      this.spawn({ x, y, vx: Math.cos(a) * s, vy: Math.sin(a) * s - 60, g: 420, life: rndRange(0.4, 0.8), size: rndRange(3, 6), color, kind: 'shard', vr: rndRange(-10, 10), collide: true });
    }
  }
  stars(x, y, n = 6, color = '#ffe08a') {
    for (let i = 0; i < n; i++) {
      const a = Math.random() * TAU, s = rndRange(30, 110);
      this.spawn({ x, y, vx: Math.cos(a) * s, vy: Math.sin(a) * s, g: 60, life: rndRange(0.5, 0.9), size: rndRange(4, 8), color, kind: 'star', glow: true, vr: rndRange(-6, 6), drag: 2 });
    }
  }
  ring(x, y, { r = 40, r2 = null, color = '#ffd966', life = 0.4, lw = 4, glow = true, fill = null } = {}) {
    this.rings.push({ x, y, r0: 4, r, r2: r2 ?? r, color, t: 0, life, lw, glow, fill });
  }
  text(x, y, str, { color = '#fff', size = 15, life = 0.85, vy = -46, vx = rndRange(-10, 10), outline = '#0d0a17', crit = false, shadow = null } = {}) {
    if (this.texts.length > 60) this.texts.shift();
    this.texts.push({ x, y, str, color, size, t: 0, life, vy, vx, outline, crit, shadow });
  }
  beam(x1, y1, x2, y2, { color = '#8fd8ff', life = 0.18, lw = 3, jag = 0.18, glow = true } = {}) {
    // pre-compute jagged lightning polyline
    const pts = [[x1, y1]];
    const segs = Math.max(2, Math.floor(Math.hypot(x2 - x1, y2 - y1) / 22));
    for (let i = 1; i < segs; i++) {
      const tt = i / segs;
      const nx = -(y2 - y1), ny = (x2 - x1);
      const l = Math.hypot(nx, ny) || 1;
      const off = (Math.random() - 0.5) * jag * Math.hypot(x2 - x1, y2 - y1);
      pts.push([x1 + (x2 - x1) * tt + nx / l * off, y1 + (y2 - y1) * tt + ny / l * off]);
    }
    pts.push([x2, y2]);
    this.beams.push({ pts, color, t: 0, life, lw, glow });
  }
  lightningBolt(x, yTop, yBottom, color = '#8fd8ff', life = 0.25) {
    this.beam(x + rndRange(-14, 14), yTop, x, yBottom, { color, life, lw: 3.5, jag: 0.3 });
  }
  shake(amt = 6, dur = 0.3) {
    this.shakeAmt = Math.max(this.shakeAmt, amt);
    this.shakeT = Math.max(this.shakeT, dur);
  }
  screenFlash(color = '#ffffff', alpha = 0.35, dur = 0.25) {
    this.flash = { color, alpha, t: 0, dur };
  }
  decal(x, y, r, color, dur = 4, kind = 'scorch') {
    if (this.decals.length > 40) this.decals.shift();
    this.decals.push({ x, y, r, color, t: 0, dur, kind, seed: Math.random() * 100 });
  }

  get shakeOffset() {
    if (this.shakeT <= 0) return [0, 0];
    const s = this.shakeAmt * (this.shakeT > 0 ? clamp(this.shakeT * 3, 0, 1) : 0);
    return [rndRange(-s, s), rndRange(-s, s)];
  }

  update(dt) {
    // particles
    for (const p of this.pool) {
      if (!p.alive) continue;
      p.t += dt;
      if (p.t >= p.life) { p.alive = false; this.free.push(p); continue; }
      if (p.drag) { const f = Math.max(0, 1 - p.drag * dt); p.vx *= f; p.vy *= f; }
      p.vy += p.g * dt;
      p.x += p.vx * dt; p.y += p.vy * dt;
      p.rot += p.vr * dt;
      if (p.collide && p.y > p.groundY) { p.y = p.groundY; p.vy *= -0.4; p.vx *= 0.7; }
    }
    for (let i = this.texts.length - 1; i >= 0; i--) {
      const tx = this.texts[i]; tx.t += dt;
      tx.x += tx.vx * dt; tx.y += tx.vy * dt; tx.vy += 60 * dt;
      if (tx.t >= tx.life) this.texts.splice(i, 1);
    }
    for (let i = this.rings.length - 1; i >= 0; i--) {
      const r = this.rings[i]; r.t += dt;
      if (r.t >= r.life) this.rings.splice(i, 1);
    }
    for (let i = this.beams.length - 1; i >= 0; i--) {
      const b = this.beams[i]; b.t += dt;
      if (b.t >= b.life) this.beams.splice(i, 1);
    }
    for (let i = this.decals.length - 1; i >= 0; i--) {
      const d = this.decals[i]; d.t += dt;
      if (d.t >= d.dur) this.decals.splice(i, 1);
    }
    if (this.shakeT > 0) { this.shakeT -= dt; if (this.shakeT <= 0) this.shakeAmt = 0; }
    if (this.flash) { this.flash.t += dt; if (this.flash.t >= this.flash.dur) this.flash = null; }
  }

  drawDecals(ctx) {
    for (const d of this.decals) {
      const k = clamp(1 - d.t / d.dur, 0, 1);
      const a = k * 0.5;
      ctx.save();
      if (d.kind === 'lava') {
        ctx.globalAlpha = a + 0.25;
        ctx.shadowColor = '#ff7a3a'; ctx.shadowBlur = 14;
        const g = ctx.createRadialGradient(d.x, d.y, 2, d.x, d.y, d.r);
        g.addColorStop(0, rgba('#ffd966', 0.9 * k)); g.addColorStop(0.5, rgba('#f05a1a', 0.7 * k)); g.addColorStop(1, rgba('#8a2a10', 0));
        ctx.fillStyle = g;
        ctx.beginPath(); ctx.ellipse(d.x, d.y, d.r, d.r * 0.55, 0, 0, TAU); ctx.fill();
      } else if (d.kind === 'ice') {
        ctx.globalAlpha = a + 0.2;
        const g = ctx.createRadialGradient(d.x, d.y, 2, d.x, d.y, d.r);
        g.addColorStop(0, rgba('#e8f8ff', 0.8 * k)); g.addColorStop(1, rgba('#8fd8ff', 0));
        ctx.fillStyle = g;
        ctx.beginPath(); ctx.ellipse(d.x, d.y, d.r, d.r * 0.5, 0, 0, TAU); ctx.fill();
      } else { // scorch
        ctx.globalAlpha = a * 0.8;
        ctx.fillStyle = rgba(d.color, 0.6);
        ctx.beginPath(); ctx.ellipse(d.x, d.y, d.r * (0.8 + Math.sin(d.seed) * 0.2), d.r * 0.5, d.seed, 0, TAU); ctx.fill();
      }
      ctx.restore();
    }
  }

  draw(ctx) {
    // rings
    for (const r of this.rings) {
      const k = r.t / r.life;
      const rad = r.r0 + (r.r2 - r.r0) * (1 - Math.pow(1 - k, 2));
      ctx.save();
      ctx.globalAlpha = (1 - k) * 0.9;
      if (r.glow) { ctx.shadowColor = r.color; ctx.shadowBlur = 10; }
      if (r.fill) {
        const g = ctx.createRadialGradient(r.x, r.y, 0, r.x, r.y, rad);
        g.addColorStop(0, rgba(r.fill, 0.0)); g.addColorStop(0.7, rgba(r.fill, 0.35 * (1 - k))); g.addColorStop(1, rgba(r.color, 0));
        ctx.fillStyle = g;
        ctx.beginPath(); ctx.arc(r.x, r.y, rad, 0, TAU); ctx.fill();
      }
      ctx.strokeStyle = r.color; ctx.lineWidth = r.lw * (1 - k * 0.6);
      ctx.beginPath(); ctx.arc(r.x, r.y, rad, 0, TAU); ctx.stroke();
      ctx.restore();
    }
    // particles
    for (const p of this.pool) {
      if (!p.alive) continue;
      const k = p.t / p.life;
      const a = p.alpha * (1 - k * k);
      const sz = p.size + (p.size2 - p.size) * k;
      ctx.save();
      ctx.globalAlpha = clamp(a, 0, 1);
      if (p.glow) { ctx.shadowColor = p.color; ctx.shadowBlur = sz * 2; }
      ctx.fillStyle = p.color;
      switch (p.kind) {
        case 'dot': case 'ember':
          ctx.beginPath(); ctx.arc(p.x, p.y, sz * (p.kind === 'ember' ? (1 - k * 0.5) : 1), 0, TAU); ctx.fill();
          break;
        case 'spark': {
          const l = clamp(Math.hypot(p.vx, p.vy) * 0.03, 2, 10);
          const ang = Math.atan2(p.vy, p.vx);
          ctx.strokeStyle = p.color; ctx.lineWidth = sz * 0.7; ctx.lineCap = 'round';
          ctx.beginPath(); ctx.moveTo(p.x - Math.cos(ang) * l, p.y - Math.sin(ang) * l); ctx.lineTo(p.x, p.y); ctx.stroke();
          break;
        }
        case 'smoke':
          ctx.beginPath(); ctx.arc(p.x, p.y, sz, 0, TAU); ctx.fill();
          break;
        case 'shard':
          ctx.translate(p.x, p.y); ctx.rotate(p.rot);
          ctx.fillRect(-sz / 2, -sz / 3, sz, sz * 0.66);
          break;
        case 'star': {
          ctx.translate(p.x, p.y); ctx.rotate(p.rot);
          ctx.beginPath();
          for (let i = 0; i < 8; i++) {
            const rr = i % 2 ? sz * 0.45 : sz;
            ctx.lineTo(Math.cos(i * TAU / 8) * rr, Math.sin(i * TAU / 8) * rr);
          }
          ctx.closePath(); ctx.fill();
          break;
        }
      }
      ctx.restore();
    }
    // beams
    for (const b of this.beams) {
      const k = 1 - b.t / b.life;
      ctx.save();
      ctx.globalAlpha = k;
      if (b.glow) { ctx.shadowColor = b.color; ctx.shadowBlur = 12; }
      ctx.strokeStyle = b.color; ctx.lineWidth = b.lw * k + 1; ctx.lineJoin = 'round'; ctx.lineCap = 'round';
      ctx.beginPath();
      b.pts.forEach((p, i) => i ? ctx.lineTo(p[0], p[1]) : ctx.moveTo(p[0], p[1]));
      ctx.stroke();
      ctx.strokeStyle = '#ffffff'; ctx.lineWidth = Math.max(1, b.lw * k * 0.4);
      ctx.stroke();
      ctx.restore();
    }
    // floating texts
    for (const tx of this.texts) {
      const k = tx.t / tx.life;
      const a = k < 0.15 ? k / 0.15 : 1 - Math.pow(clamp((k - 0.55) / 0.45, 0, 1), 2);
      const pop = tx.crit && k < 0.25 ? 1 + (0.25 - k) * 2.4 : 1;
      ctx.save();
      ctx.globalAlpha = clamp(a, 0, 1);
      ctx.font = `900 ${Math.round(tx.size * pop)}px ${tx.crit ? '"Segoe UI",system-ui,sans-serif' : '"Segoe UI",system-ui,sans-serif'}`;
      ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
      if (tx.shadow) { ctx.shadowColor = tx.shadow; ctx.shadowBlur = 8; }
      ctx.strokeStyle = tx.outline; ctx.lineWidth = 3.5; ctx.lineJoin = 'round';
      ctx.strokeText(tx.str, tx.x, tx.y);
      ctx.fillStyle = tx.color;
      ctx.fillText(tx.str, tx.x, tx.y);
      ctx.restore();
    }
    // screen flash
    if (this.flash) {
      const k = 1 - this.flash.t / this.flash.dur;
      ctx.save();
      ctx.globalAlpha = this.flash.alpha * k;
      ctx.fillStyle = this.flash.color;
      ctx.fillRect(-20, -20, ctx.canvas.width + 40, ctx.canvas.height + 40);
      ctx.restore();
    }
  }
  reset() {
    for (const p of this.pool) { if (p.alive) { p.alive = false; this.free.push(p); } }
    this.texts.length = 0; this.rings.length = 0; this.beams.length = 0; this.decals.length = 0;
    this.shakeAmt = 0; this.shakeT = 0; this.flash = null;
  }
}

// ---------- ambient weather layer ----------
export class Ambient {
  constructor(theme, w, h) {
    this.theme = theme; this.w = w; this.h = h;
    this.items = [];
    const amb = theme?.ambient;
    if (!amb) return;
    const n = { leaf: 14, sand: 20, snow: 40, firefly: 16, bubble: 12, ember: 16, star: 24, wisp: 12, sparkle: 18, gold: 16 }[amb.type] || 14;
    for (let i = 0; i < n; i++) this.items.push(this.mkItem(amb.type, true));
  }
  mkItem(type, randY = false) {
    const it = { type, x: Math.random() * this.w, y: randY ? Math.random() * this.h : -10, rot: Math.random() * TAU, vr: rndRange(-1.5, 1.5), ph: Math.random() * TAU, sz: rndRange(0.6, 1.3) };
    switch (type) {
      case 'leaf': it.vx = rndRange(8, 26); it.vy = rndRange(12, 30); break;
      case 'sand': it.vx = rndRange(40, 90); it.vy = rndRange(4, 14); it.sz *= 0.5; break;
      case 'snow': it.vx = rndRange(-8, 8); it.vy = rndRange(14, 34); break;
      case 'firefly': it.vx = rndRange(-8, 8); it.vy = rndRange(-6, 6); break;
      case 'bubble': it.vx = rndRange(-4, 4); it.vy = rndRange(-22, -8); it.y = randY ? Math.random() * this.h : this.h + 10; break;
      case 'ember': it.vx = rndRange(-10, 10); it.vy = rndRange(-40, -16); it.y = randY ? Math.random() * this.h : this.h + 10; break;
      case 'star': it.vx = 0; it.vy = 0; it.tw = Math.random(); break;
      case 'wisp': it.vx = rndRange(-6, 6); it.vy = rndRange(-14, -4); it.y = randY ? Math.random() * this.h : this.h + 10; break;
      case 'sparkle': it.vx = rndRange(-3, 3); it.vy = rndRange(-12, -3); it.y = randY ? Math.random() * this.h : this.h + 10; break;
      case 'gold': it.vx = rndRange(-6, 6); it.vy = rndRange(10, 26); break;
    }
    return it;
  }
  update(dt) {
    for (let i = 0; i < this.items.length; i++) {
      const it = this.items[i];
      it.x += it.vx * dt; it.y += it.vy * dt; it.rot += it.vr * dt; it.ph += dt * 3;
      if (it.type === 'leaf' || it.type === 'snow' || it.type === 'gold') it.x += Math.sin(it.ph) * 12 * dt;
      if (it.type === 'firefly') { it.vx += rndRange(-20, 20) * dt; it.vy += rndRange(-20, 20) * dt; it.vx = clamp(it.vx, -14, 14); it.vy = clamp(it.vy, -10, 10); }
      if (it.x < -20) it.x = this.w + 20; if (it.x > this.w + 20) it.x = -20;
      if (it.y > this.h + 20 || it.y < -30) this.items[i] = this.mkItem(it.type);
    }
  }
  draw(ctx) {
    const amb = this.theme?.ambient; if (!amb) return;
    const col = amb.color;
    ctx.save();
    for (const it of this.items) {
      const s = it.sz;
      switch (it.type) {
        case 'leaf':
          ctx.save(); ctx.translate(it.x, it.y); ctx.rotate(it.rot);
          ctx.fillStyle = rgba(col, 0.75);
          ctx.beginPath(); ctx.ellipse(0, 0, 5 * s, 2.6 * s, 0, 0, TAU); ctx.fill();
          ctx.restore();
          break;
        case 'sand':
          ctx.fillStyle = rgba(col, 0.4);
          ctx.fillRect(it.x, it.y, 2.4 * s, 1.4 * s);
          break;
        case 'snow':
          ctx.fillStyle = rgba(col, 0.85);
          ctx.beginPath(); ctx.arc(it.x, it.y, 2 * s, 0, TAU); ctx.fill();
          break;
        case 'firefly': {
          const gl = 0.35 + Math.sin(it.ph * 2) * 0.35;
          ctx.shadowColor = col; ctx.shadowBlur = 8;
          ctx.fillStyle = rgba(col, clamp(gl, 0.05, 0.9));
          ctx.beginPath(); ctx.arc(it.x, it.y, 2 * s, 0, TAU); ctx.fill();
          ctx.shadowBlur = 0;
          break;
        }
        case 'bubble':
          ctx.strokeStyle = rgba(col, 0.5); ctx.lineWidth = 1.4;
          ctx.beginPath(); ctx.arc(it.x, it.y, 3.4 * s, 0, TAU); ctx.stroke();
          break;
        case 'ember':
          ctx.shadowColor = col; ctx.shadowBlur = 7;
          ctx.fillStyle = rgba(col, 0.8);
          ctx.beginPath(); ctx.arc(it.x, it.y, 1.8 * s, 0, TAU); ctx.fill();
          ctx.shadowBlur = 0;
          break;
        case 'star': {
          const tw = 0.3 + Math.abs(Math.sin(it.ph * 0.8 + it.tw * 9)) * 0.7;
          ctx.fillStyle = rgba(col, tw * 0.8);
          ctx.fillRect(it.x - 1, it.y - 1, 2.2 * s, 2.2 * s);
          break;
        }
        case 'wisp':
          ctx.shadowColor = col; ctx.shadowBlur = 10;
          ctx.fillStyle = rgba(col, 0.4);
          ctx.beginPath(); ctx.arc(it.x, it.y, 3 * s, 0, TAU); ctx.fill();
          ctx.shadowBlur = 0;
          break;
        case 'sparkle': {
          const tw = Math.abs(Math.sin(it.ph));
          ctx.save(); ctx.translate(it.x, it.y); ctx.rotate(it.ph * 0.5);
          ctx.fillStyle = rgba(col, 0.7 * tw);
          ctx.fillRect(-3.4 * s, -0.8, 6.8 * s, 1.6);
          ctx.fillRect(-0.8, -3.4 * s, 1.6, 6.8 * s);
          ctx.restore();
          break;
        }
        case 'gold':
          ctx.save(); ctx.translate(it.x, it.y); ctx.rotate(it.rot);
          ctx.fillStyle = rgba(col, 0.6);
          ctx.fillRect(-2 * s, -2 * s, 4 * s, 4 * s);
          ctx.restore();
          break;
      }
    }
    ctx.restore();
  }
}
