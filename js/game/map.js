// ============================================================
// GTDM map — path polyline, build slots, pre-rendered scenery
// ============================================================
import { TAU, clamp, mulberry32, rgba, shade, dist } from '../core/util.js';
import { K } from '../data/defs.js';

const T = K.TILE, COLS = K.COLS, ROWS = K.ROWS;
export const W = K.W, H = K.H;

export class GMap {
  constructor(layout, theme, seed) {
    this.theme = theme;
    this.seed = seed;
    this.pts = layout.pts;
    this.buildPath();
    this.buildCells();
    this.buildSlots(seed);
  }

  buildPath() {
    // pixel waypoints (cell centers)
    const wp = this.pts.map(([c, r]) => [c * T + T / 2, r * T + T / 2]);
    // clamp inside canvas
    wp[0][0] = Math.min(wp[0][0], 18); wp[wp.length - 1][0] = Math.max(wp[wp.length - 1][0], W - 18);
    this.waypoints = wp;
    // dense sampled polyline with rounded corners
    const dense = [];
    const R = 20; // corner radius
    let cursor = [wp[0][0], wp[0][1]];
    dense.push([...cursor]);
    for (let i = 1; i < wp.length - 1; i++) {
      const prev = wp[i - 1], cur = wp[i], next = wp[i + 1];
      // point before corner
      const d1 = Math.hypot(cur[0] - prev[0], cur[1] - prev[1]);
      const d2 = Math.hypot(next[0] - cur[0], next[1] - cur[1]);
      const r = Math.min(R, d1 / 2, d2 / 2);
      const a = [(cur[0] - prev[0]) / d1, (cur[1] - prev[1]) / d1];
      const b = [(next[0] - cur[0]) / d2, (next[1] - cur[1]) / d2];
      const p1 = [cur[0] - a[0] * r, cur[1] - a[1] * r];
      const p2 = [cur[0] + b[0] * r, cur[1] + b[1] * r];
      this.sampleLine(dense, cursor, p1);
      // quadratic corner
      const steps = 8;
      for (let s = 1; s <= steps; s++) {
        const t = s / steps;
        const x = (1 - t) * (1 - t) * p1[0] + 2 * (1 - t) * t * cur[0] + t * t * p2[0];
        const y = (1 - t) * (1 - t) * p1[1] + 2 * (1 - t) * t * cur[1] + t * t * p2[1];
        dense.push([x, y]);
      }
      cursor = p2;
    }
    this.sampleLine(dense, cursor, wp[wp.length - 1]);
    // cumulative distances + angles
    let total = 0;
    this.path = dense.map((p, i) => {
      if (i > 0) total += Math.hypot(p[0] - dense[i - 1][0], p[1] - dense[i - 1][1]);
      return { x: p[0], y: p[1], d: total };
    });
    this.pathLen = total;
  }
  sampleLine(out, a, b) {
    const d = Math.hypot(b[0] - a[0], b[1] - a[1]);
    const n = Math.max(1, Math.ceil(d / 6));
    for (let i = 1; i <= n; i++) out.push([a[0] + (b[0] - a[0]) * i / n, a[1] + (b[1] - a[1]) * i / n]);
  }

  // position along path by distance
  posAt(d) {
    const P = this.path;
    if (d <= 0) return { x: P[0].x, y: P[0].y, ang: this.angAt(0) };
    if (d >= this.pathLen) { const l = P[P.length - 1]; return { x: l.x, y: l.y, ang: this.angAt(this.pathLen) }; }
    // binary search
    let lo = 0, hi = P.length - 1;
    while (lo < hi - 1) { const mid = (lo + hi) >> 1; if (P[mid].d < d) lo = mid; else hi = mid; }
    const a = P[lo], b = P[hi];
    const t = (d - a.d) / ((b.d - a.d) || 1);
    return { x: a.x + (b.x - a.x) * t, y: a.y + (b.y - a.y) * t, ang: Math.atan2(b.y - a.y, b.x - a.x) };
  }
  angAt(d) {
    const p1 = this.posAtRaw(clamp(d - 6, 0, this.pathLen)), p2 = this.posAtRaw(clamp(d + 6, 0, this.pathLen));
    return Math.atan2(p2.y - p1.y, p2.x - p1.x);
  }
  posAtRaw(d) {
    const P = this.path;
    let lo = 0, hi = P.length - 1;
    while (lo < hi - 1) { const mid = (lo + hi) >> 1; if (P[mid].d < d) lo = mid; else hi = mid; }
    const a = P[lo], b = P[hi];
    const t = (d - a.d) / ((b.d - a.d) || 1);
    return { x: a.x + (b.x - a.x) * t, y: a.y + (b.y - a.y) * t };
  }

  buildCells() {
    this.cells = new Set(); // "c,r" path cells
    for (let i = 0; i < this.pts.length - 1; i++) {
      const [c1, r1] = this.pts[i], [c2, r2] = this.pts[i + 1];
      const dc = Math.sign(c2 - c1), dr = Math.sign(r2 - r1);
      let c = c1, r = r1;
      this.cells.add(`${c},${r}`);
      while (c !== c2 || r !== r2) {
        if (c !== c2) c += dc; else if (r !== r2) r += dr;
        this.cells.add(`${c},${r}`);
      }
    }
  }
  isPath(c, r) { return this.cells.has(`${c},${r}`); }

  buildSlots(seed) {
    const rnd = mulberry32(seed ^ 0x5bf03635);
    const cand = [];
    this.cells.forEach(key => {
      const [c, r] = key.split(',').map(Number);
      [[1, 0], [-1, 0], [0, 1], [0, -1]].forEach(([dc, dr]) => {
        const nc = c + dc, nr = r + dr;
        if (nc < 0 || nc >= COLS || nr < 0 || nr >= ROWS) return;
        if (this.isPath(nc, nr)) return;
        cand.push([nc, nr]);
      });
    });
    // dedupe
    const seen = new Set(); const uniq = [];
    cand.forEach(([c, r]) => { const k = `${c},${r}`; if (!seen.has(k)) { seen.add(k); uniq.push([c, r]); } });
    // distance along path for spacing (approx via nearest path point)
    uniq.forEach(cell => {
      const px = cell[0] * T + T / 2, py = cell[1] * T + T / 2;
      let best = 0, bd = 1e9;
      for (let i = 0; i < this.path.length; i += 3) {
        const d = (this.path[i].x - px) ** 2 + (this.path[i].y - py) ** 2;
        if (d < bd) { bd = d; best = this.path[i].d; }
      }
      cell.t = best / this.pathLen;
    });
    uniq.sort((a, b) => a.t - b.t);
    // greedy spacing selection
    const chosen = [];
    const minDt = 0.045;
    for (const cell of uniq) {
      if (chosen.every(o => Math.abs(o.t - cell.t) > minDt || (o[0] !== cell[0] || o[1] !== cell[1]) && false)) {
        if (!chosen.some(o => Math.abs(o.t - cell.t) < minDt)) chosen.push(cell);
      }
    }
    // ensure max 17, min ~10: if too few, relax
    let pool = chosen;
    if (pool.length < 10) {
      pool = [];
      const minDt2 = 0.02;
      for (const cell of uniq) if (!pool.some(o => Math.abs(o.t - cell.t) < minDt2 && (Math.abs(o[0] - cell[0]) + Math.abs(o[1] - cell[1])) < 2)) pool.push(cell);
    }
    // deterministic thin-out to <= 17
    while (pool.length > 17) {
      // remove one at random-ish middle
      const idx = 1 + Math.floor(rnd() * (pool.length - 2));
      pool.splice(idx, 1);
    }
    this.slots = pool.map(([c, r, t], i) => ({
      id: i, c, r, t,
      x: c * T + T / 2, y: r * T + T / 2,
      tower: null, disabledUntil: 0, disableFx: null,
    }));
  }

  slotAtPixel(px, py) {
    let best = null, bd = (T * 0.52) ** 2;
    for (const s of this.slots) {
      const d = (s.x - px) ** 2 + (s.y - py) ** 2;
      if (d < bd) { bd = d; best = s; }
    }
    return best;
  }

  // ----------------------------------------------------------
  // pre-rendered background
  // ----------------------------------------------------------
  renderBackground() {
    const c = document.createElement('canvas');
    c.width = W; c.height = H;
    const g = c.getContext('2d');
    const rnd = mulberry32(this.seed ^ 0x243f6a88);
    const th = this.theme;

    // ground
    const gg = g.createLinearGradient(0, 0, W, H);
    gg.addColorStop(0, th.ground[0]); gg.addColorStop(1, th.ground[1]);
    g.fillStyle = gg; g.fillRect(0, 0, W, H);
    // ground blotches
    for (let i = 0; i < 90; i++) {
      const x = rnd() * W, y = rnd() * H, r = 8 + rnd() * 34;
      g.fillStyle = rgba(rnd() < 0.5 ? shade(th.ground[0], 0.06) : shade(th.ground[1], -0.06), 0.4);
      g.beginPath(); g.ellipse(x, y, r, r * 0.6, rnd() * TAU, 0, TAU); g.fill();
    }
    // grid hints (very subtle)
    g.strokeStyle = 'rgba(0,0,0,0.05)'; g.lineWidth = 1;
    for (let i = 1; i < COLS; i++) { g.beginPath(); g.moveTo(i * T, 0); g.lineTo(i * T, H); g.stroke(); }
    for (let i = 1; i < ROWS; i++) { g.beginPath(); g.moveTo(0, i * T); g.lineTo(W, i * T); g.stroke(); }

    // decorations on free cells
    const free = [];
    const slotSet = new Set(this.slots.map(s => `${s.c},${s.r}`));
    for (let r2 = 0; r2 < ROWS; r2++) for (let c2 = 0; c2 < COLS; c2++) {
      if (!this.isPath(c2, r2) && !slotSet.has(`${c2},${r2}`)) free.push([c2, r2]);
    }
    // shuffle & take ~30
    for (let i = free.length - 1; i > 0; i--) { const j = Math.floor(rnd() * (i + 1));[free[i], free[j]] = [free[j], free[i]]; }
    const decoCount = Math.min(free.length, 26);
    for (let i = 0; i < decoCount; i++) {
      const [c2, r2] = free[i];
      const x = c2 * T + T / 2 + (rnd() - 0.5) * 24, y = r2 * T + T / 2 + (rnd() - 0.5) * 20;
      drawDeco(g, th.deco, x, y, 0.75 + rnd() * 0.55, rnd, th, i);
    }

    // path
    this.strokePath(g, th);

    // slot pads
    for (const s of this.slots) this.drawSlotPad(g, s);

    // spawn portal & exit gate
    this.drawPortal(g, th);
    this.drawGate(g, th);

    // region atmosphere: motifs, light pools, directional light
    this.drawRegionMotif(g, th, mulberry32(this.seed ^ 0x77aa11));

    // vignette
    const vg = g.createRadialGradient(W / 2, H / 2, H * 0.42, W / 2, H / 2, H * 0.95);
    vg.addColorStop(0, 'rgba(0,0,0,0)'); vg.addColorStop(1, 'rgba(5,3,12,0.5)');
    g.fillStyle = vg; g.fillRect(0, 0, W, H);
    this.bgCanvas = c;
    return c;
  }

  strokePath(g, th) {
    const P = this.path;
    const stroke = (width, color, alpha = 1) => {
      g.save(); g.globalAlpha = alpha;
      g.strokeStyle = color; g.lineWidth = width; g.lineJoin = 'round'; g.lineCap = 'round';
      g.beginPath();
      P.forEach((p, i) => i ? g.lineTo(p.x, p.y) : g.moveTo(p.x, p.y));
      g.stroke(); g.restore();
    };
    stroke(T * 0.86, 'rgba(0,0,0,0.35)');
    stroke(T * 0.76, shade(th.path[0], -0.3));
    stroke(T * 0.66, th.path[0]);
    stroke(T * 0.5, th.path[1], 0.85);
    // texture stones
    const rnd = mulberry32(this.seed ^ 0x1234);
    g.save();
    for (let i = 6; i < P.length - 6; i += 5) {
      const p = P[i];
      const ox = (rnd() - 0.5) * T * 0.5, oy = (rnd() - 0.5) * T * 0.4;
      g.fillStyle = rgba(rnd() < 0.5 ? shade(th.path[1], 0.12) : shade(th.path[0], -0.12), 0.5);
      g.beginPath(); g.ellipse(p.x + ox, p.y + oy, 2 + rnd() * 4, 1.6 + rnd() * 3, rnd() * TAU, 0, TAU); g.fill();
    }
    g.restore();
    // direction chevrons
    g.save();
    g.strokeStyle = 'rgba(255,255,255,0.10)'; g.lineWidth = 2.4; g.lineCap = 'round';
    for (let d = 50; d < this.pathLen - 60; d += 105) {
      const p = this.posAt(d);
      g.save(); g.translate(p.x, p.y); g.rotate(p.ang);
      g.beginPath(); g.moveTo(-5, -7); g.lineTo(3, 0); g.lineTo(-5, 7); g.stroke();
      g.restore();
    }
    g.restore();
  }

  drawSlotPad(g, s) {
    g.save();
    g.translate(s.x, s.y);
    const r = T * 0.34;
    // pad
    const pg = g.createRadialGradient(0, -4, 4, 0, 0, r);
    pg.addColorStop(0, 'rgba(255,255,255,0.10)');
    pg.addColorStop(0.7, 'rgba(255,255,255,0.045)');
    pg.addColorStop(1, 'rgba(0,0,0,0.16)');
    g.fillStyle = pg;
    g.beginPath(); g.arc(0, 0, r, 0, TAU); g.fill();
    // rune ring
    g.strokeStyle = 'rgba(245,197,66,0.4)'; g.lineWidth = 2;
    g.setLineDash([7, 5]);
    g.beginPath(); g.arc(0, 0, r - 2, 0, TAU); g.stroke();
    g.setLineDash([]);
    g.strokeStyle = 'rgba(245,197,66,0.16)'; g.lineWidth = 1;
    g.beginPath(); g.arc(0, 0, r - 6, 0, TAU); g.stroke();
    // corner runes
    g.fillStyle = 'rgba(245,197,66,0.35)';
    for (let i = 0; i < 4; i++) {
      const a = i * TAU / 4 + Math.PI / 4;
      g.fillRect(Math.cos(a) * (r - 3) - 1.5, Math.sin(a) * (r - 3) - 1.5, 3, 3);
    }
    g.restore();
  }

  drawPortal(g, th) {
    const p = this.path[0];
    g.save(); g.translate(p.x, p.y);
    // dark rift
    const rg = g.createRadialGradient(0, 0, 2, 0, 0, T * 0.55);
    rg.addColorStop(0, '#1c0c28'); rg.addColorStop(0.6, rgba('#5a1a8a', 0.55)); rg.addColorStop(1, 'rgba(90,26,138,0)');
    g.fillStyle = rg;
    g.beginPath(); g.ellipse(0, 0, T * 0.42, T * 0.55, 0, 0, TAU); g.fill();
    g.strokeStyle = rgba('#c05af0', 0.6); g.lineWidth = 2.5;
    g.beginPath(); g.ellipse(0, 0, T * 0.3, T * 0.44, 0, 0, TAU); g.stroke();
    g.restore();
  }
  drawGate(g, th) {
    const p = this.path[this.path.length - 1];
    const dir = p.x > W / 2 ? 1 : -1;
    g.save(); g.translate(p.x - dir * 8, p.y);
    // golden gate glow
    const rg = g.createRadialGradient(0, 0, 2, 0, 0, T * 0.6);
    rg.addColorStop(0, rgba('#ffe08a', 0.5)); rg.addColorStop(1, 'rgba(255,217,102,0)');
    g.fillStyle = rg; g.beginPath(); g.arc(0, 0, T * 0.6, 0, TAU); g.fill();
    // gate posts
    g.fillStyle = '#e0a520'; g.strokeStyle = '#6b4a10'; g.lineWidth = 2;
    [-14, 14].forEach(ox => { g.beginPath(); g.roundRect ? g.roundRect(ox - 4, -T * 0.42, 8, T * 0.84, 3) : g.rect(ox - 4, -T * 0.42, 8, T * 0.84); g.fill(); g.stroke(); });
    g.fillStyle = '#ffd966';
    g.beginPath(); g.moveTo(-20, -T * 0.42); g.lineTo(0, -T * 0.58); g.lineTo(20, -T * 0.42); g.closePath(); g.fill(); g.stroke();
    // heart crystal
    g.save(); g.shadowColor = '#ffd966'; g.shadowBlur = 12;
    g.fillStyle = '#fff4c8';
    g.beginPath(); g.arc(0, -T * 0.46, 5, 0, TAU); g.fill();
    g.restore();
    g.restore();
  }

  // ---------- region atmosphere: unique motif per region family ----------
  drawRegionMotif(g, th, rnd) {
    g.save();
    // colored light pools from the sky palette
    for (let i = 0; i < 3; i++) {
      const x = rnd() * W, y = rnd() * H, r = 140 + rnd() * 180;
      const lg = g.createRadialGradient(x, y, 10, x, y, r);
      lg.addColorStop(0, rgba(th.sky?.[1] || '#ffe9a8', 0.10));
      lg.addColorStop(1, 'rgba(0,0,0,0)');
      g.fillStyle = lg;
      g.beginPath(); g.arc(x, y, r, 0, TAU); g.fill();
    }
    // directional light from top-left
    const dl = g.createLinearGradient(0, 0, W * 0.7, H * 0.8);
    dl.addColorStop(0, 'rgba(255,244,200,0.07)');
    dl.addColorStop(0.5, 'rgba(255,244,200,0)');
    dl.addColorStop(1, 'rgba(10,6,20,0.10)');
    g.fillStyle = dl; g.fillRect(0, 0, W, H);

    switch (th.deco) {
      case 'tree': case 'bigtree': {
        // grass tufts + wildflowers
        for (let i = 0; i < 70; i++) {
          const x = rnd() * W, y = rnd() * H;
          g.strokeStyle = rgba('#7ec860', 0.35); g.lineWidth = 1.4; g.lineCap = 'round';
          g.beginPath(); g.moveTo(x, y); g.lineTo(x - 2, y - 5); g.stroke();
          g.beginPath(); g.moveTo(x + 3, y); g.lineTo(x + 4, y - 4); g.stroke();
          if (i % 9 === 0) { g.fillStyle = rgba(i % 18 === 0 ? '#ff8ad8' : '#ffe08a', 0.7); g.beginPath(); g.arc(x, y - 6, 1.8, 0, TAU); g.fill(); }
        }
        break;
      }
      case 'cactus': {
        // sand ripples + bleached bones + heat shimmer bands
        for (let i = 0; i < 26; i++) {
          const x = rnd() * W, y = rnd() * H, w = 30 + rnd() * 60;
          g.strokeStyle = rgba('#b8935a', 0.25); g.lineWidth = 2;
          g.beginPath(); g.moveTo(x, y); g.quadraticCurveTo(x + w / 2, y - 4, x + w, y); g.stroke();
        }
        for (let i = 0; i < 6; i++) {
          const x = rnd() * W, y = rnd() * H;
          g.strokeStyle = rgba('#e8dcc0', 0.5); g.lineWidth = 2.4; g.lineCap = 'round';
          g.beginPath(); g.moveTo(x - 7, y); g.lineTo(x + 7, y); g.stroke();
          g.beginPath(); g.moveTo(x - 3, y - 4); g.lineTo(x - 3, y + 4); g.stroke();
          g.beginPath(); g.moveTo(x + 3, y - 4); g.lineTo(x + 3, y + 4); g.stroke();
        }
        break;
      }
      case 'pine': {
        // snow drifts + ice cracks
        for (let i = 0; i < 18; i++) {
          const x = rnd() * W, y = rnd() * H, w = 26 + rnd() * 50;
          g.fillStyle = rgba('#ffffff', 0.30);
          g.beginPath(); g.ellipse(x, y, w, w * 0.28, rnd() * 0.6 - 0.3, 0, TAU); g.fill();
        }
        g.strokeStyle = rgba('#bfe4ff', 0.35); g.lineWidth = 1.2;
        for (let i = 0; i < 10; i++) {
          let x = rnd() * W, y = rnd() * H;
          g.beginPath(); g.moveTo(x, y);
          for (let k = 0; k < 4; k++) { x += (rnd() - 0.5) * 34; y += (rnd() - 0.5) * 22; g.lineTo(x, y); }
          g.stroke();
        }
        break;
      }
      case 'ruin': {
        // carved rune circles + scattered bricks + moss
        for (let i = 0; i < 5; i++) {
          const x = rnd() * W, y = rnd() * H, r = 26 + rnd() * 30;
          g.strokeStyle = rgba('#9ad8a8', 0.16); g.lineWidth = 2;
          g.beginPath(); g.arc(x, y, r, 0, TAU); g.stroke();
          g.beginPath(); g.arc(x, y, r * 0.7, 0, TAU); g.stroke();
          for (let k = 0; k < 8; k++) {
            const a = k / 8 * TAU;
            g.beginPath(); g.moveTo(x + Math.cos(a) * r * 0.7, y + Math.sin(a) * r * 0.7);
            g.lineTo(x + Math.cos(a) * r, y + Math.sin(a) * r); g.stroke();
          }
        }
        for (let i = 0; i < 14; i++) {
          const x = rnd() * W, y = rnd() * H;
          g.fillStyle = rgba('#b8b09a', 0.4);
          g.fillRect(x, y, 8 + rnd() * 6, 5 + rnd() * 3);
        }
        break;
      }
      case 'rock': {
        // glowing lava cracks + ash patches
        for (let i = 0; i < 9; i++) {
          let x = rnd() * W, y = rnd() * H;
          g.save();
          g.shadowColor = '#ff7a3a'; g.shadowBlur = 7;
          g.strokeStyle = rgba('#ff9a3a', 0.5); g.lineWidth = 2.2; g.lineCap = 'round';
          g.beginPath(); g.moveTo(x, y);
          for (let k = 0; k < 5; k++) { x += (rnd() - 0.5) * 44; y += (rnd() - 0.5) * 30; g.lineTo(x, y); }
          g.stroke(); g.restore();
        }
        for (let i = 0; i < 16; i++) {
          g.fillStyle = rgba('#241a14', 0.25);
          g.beginPath(); g.ellipse(rnd() * W, rnd() * H, 14 + rnd() * 26, 8 + rnd() * 12, rnd() * TAU, 0, TAU); g.fill();
        }
        break;
      }
      case 'cloud': {
        // cloud shadows + god rays
        for (let i = 0; i < 8; i++) {
          const x = rnd() * W, y = rnd() * H, r = 50 + rnd() * 70;
          g.fillStyle = rgba('#4a6a9a', 0.13);
          g.beginPath(); g.ellipse(x, y, r, r * 0.45, 0, 0, TAU); g.fill();
          g.beginPath(); g.ellipse(x + r * 0.5, y + 6, r * 0.6, r * 0.3, 0, 0, TAU); g.fill();
        }
        g.save();
        for (let i = 0; i < 4; i++) {
          const x = W * (0.15 + rnd() * 0.7);
          const rg = g.createLinearGradient(x, 0, x + 90, H);
          rg.addColorStop(0, 'rgba(255,244,200,0.10)'); rg.addColorStop(1, 'rgba(255,244,200,0)');
          g.fillStyle = rg;
          g.beginPath(); g.moveTo(x, 0); g.lineTo(x + 40, 0); g.lineTo(x + 130, H); g.lineTo(x + 60, H); g.closePath(); g.fill();
        }
        g.restore();
        break;
      }
      case 'spire': {
        // floating rock shadows + void rifts
        for (let i = 0; i < 7; i++) {
          const x = rnd() * W, y = rnd() * H, r = 18 + rnd() * 26;
          g.fillStyle = rgba('#050309', 0.35);
          g.beginPath(); g.ellipse(x, y + 10, r, r * 0.4, 0, 0, TAU); g.fill();
          g.save(); g.shadowColor = '#a06bf0'; g.shadowBlur = 10;
          g.strokeStyle = rgba('#b49aff', 0.35); g.lineWidth = 1.6;
          g.beginPath(); g.ellipse(x, y - 26, r * 0.7, r * 0.28, 0.3, 0, TAU); g.stroke();
          g.restore();
        }
        break;
      }
      case 'crystal': {
        // ley-lines connecting glow nodes
        const nodes = [];
        for (let i = 0; i < 6; i++) nodes.push([rnd() * W, rnd() * H]);
        g.strokeStyle = rgba('#8fd8ff', 0.14); g.lineWidth = 1.6;
        for (let i = 0; i < nodes.length - 1; i++) {
          g.beginPath(); g.moveTo(nodes[i][0], nodes[i][1]); g.lineTo(nodes[i + 1][0], nodes[i + 1][1]); g.stroke();
        }
        for (const [x, y] of nodes) {
          const ng = g.createRadialGradient(x, y, 2, x, y, 34);
          ng.addColorStop(0, rgba('#8fd8ff', 0.22)); ng.addColorStop(1, 'rgba(143,216,255,0)');
          g.fillStyle = ng; g.beginPath(); g.arc(x, y, 34, 0, TAU); g.fill();
        }
        break;
      }
      case 'pillar': {
        // golden mosaic tiles + coin glints
        for (let i = 0; i < 40; i++) {
          const x = rnd() * W, y = rnd() * H;
          g.fillStyle = rgba(i % 2 ? '#f5c542' : '#c99a2e', 0.10);
          g.fillRect(x, y, 9, 9);
        }
        for (let i = 0; i < 10; i++) {
          const x = rnd() * W, y = rnd() * H;
          g.save(); g.shadowColor = '#ffe08a'; g.shadowBlur = 6;
          g.fillStyle = rgba('#ffe9a8', 0.5);
          g.beginPath(); g.arc(x, y, 2.2, 0, TAU); g.fill(); g.restore();
        }
        break;
      }
    }
    g.restore();
  }
}

// ---------- decoration drawing ----------
function drawDeco(g, type, x, y, s, rnd, th, i) {
  g.save(); g.translate(x, y); g.scale(s, s);
  const dark = 'rgba(0,0,0,0.28)';
  switch (type) {
    case 'tree': {
      g.fillStyle = dark; g.beginPath(); g.ellipse(0, 14, 13, 5, 0, 0, TAU); g.fill();
      g.fillStyle = '#5a3c22'; g.fillRect(-2.5, -4, 5, 18);
      const c1 = i % 2 ? '#3c7a2c' : '#2f6a24';
      g.fillStyle = c1; g.beginPath(); g.arc(0, -12, 14, 0, TAU); g.fill();
      g.fillStyle = shade(c1, 0.15); g.beginPath(); g.arc(-5, -16, 8, 0, TAU); g.fill();
      g.fillStyle = shade(c1, -0.15); g.beginPath(); g.arc(6, -8, 9, 0, TAU); g.fill();
      break;
    }
    case 'bigtree': {
      g.fillStyle = dark; g.beginPath(); g.ellipse(0, 16, 17, 6, 0, 0, TAU); g.fill();
      g.fillStyle = '#4a3018'; g.fillRect(-4, -6, 8, 24);
      g.fillStyle = '#245a1c'; g.beginPath(); g.arc(0, -18, 19, 0, TAU); g.fill();
      g.fillStyle = '#2f7024'; g.beginPath(); g.arc(-8, -22, 11, 0, TAU); g.fill();
      g.fillStyle = '#1c4a16'; g.beginPath(); g.arc(9, -12, 12, 0, TAU); g.fill();
      // fireflies
      g.fillStyle = rgba('#d8f08a', 0.7);
      g.beginPath(); g.arc(-12, -6, 1.6, 0, TAU); g.fill();
      break;
    }
    case 'pine': {
      g.fillStyle = dark; g.beginPath(); g.ellipse(0, 14, 12, 4.5, 0, 0, TAU); g.fill();
      g.fillStyle = '#5a3c22'; g.fillRect(-2.5, 2, 5, 12);
      for (let l = 0; l < 3; l++) {
        const w = 17 - l * 4, ty = 4 - l * 11;
        g.fillStyle = l % 2 ? '#2c5a3c' : '#24503a';
        g.beginPath(); g.moveTo(-w, ty); g.lineTo(0, ty - 15); g.lineTo(w, ty); g.closePath(); g.fill();
        g.fillStyle = 'rgba(255,255,255,0.55)';
        g.beginPath(); g.moveTo(-w * 0.55, ty - 6); g.lineTo(0, ty - 15); g.lineTo(w * 0.55, ty - 6); g.lineTo(0, ty - 9); g.closePath(); g.fill();
      }
      break;
    }
    case 'cactus': {
      g.fillStyle = dark; g.beginPath(); g.ellipse(0, 14, 10, 4, 0, 0, TAU); g.fill();
      g.strokeStyle = '#3c7a3c'; g.lineCap = 'round';
      g.lineWidth = 9; g.beginPath(); g.moveTo(0, 14); g.lineTo(0, -12); g.stroke();
      g.lineWidth = 6;
      g.beginPath(); g.moveTo(0, 0); g.quadraticCurveTo(-11, 0, -11, -8); g.stroke();
      g.beginPath(); g.moveTo(0, 4); g.quadraticCurveTo(10, 4, 10, -4); g.stroke();
      g.fillStyle = '#ff8ad8'; g.beginPath(); g.arc(0, -14, 3, 0, TAU); g.fill();
      break;
    }
    case 'ruin': {
      g.fillStyle = dark; g.beginPath(); g.ellipse(0, 12, 15, 5, 0, 0, TAU); g.fill();
      g.fillStyle = '#b8b09a'; g.strokeStyle = '#6a6455'; g.lineWidth = 1.5;
      g.fillRect(-12, -14, 6, 26); g.strokeRect(-12, -14, 6, 26);
      g.fillRect(2, -6, 6, 18); g.strokeRect(2, -6, 6, 18);
      g.fillRect(-14, -18, 20, 5); g.strokeRect(-14, -18, 20, 5);
      g.fillStyle = rgba('#6e9a7a', 0.6); g.beginPath(); g.ellipse(6, 10, 8, 3, 0, 0, TAU); g.fill();
      break;
    }
    case 'rock': {
      g.fillStyle = dark; g.beginPath(); g.ellipse(0, 12, 14, 5, 0, 0, TAU); g.fill();
      g.fillStyle = '#5a3028'; g.strokeStyle = '#2c1410'; g.lineWidth = 1.5;
      g.beginPath(); g.moveTo(-13, 12); g.lineTo(-8, -6); g.lineTo(2, -12); g.lineTo(12, -2); g.lineTo(13, 12); g.closePath(); g.fill(); g.stroke();
      g.save(); g.shadowColor = '#ff7a3a'; g.shadowBlur = 8;
      g.strokeStyle = '#ff9a3a'; g.lineWidth = 2;
      g.beginPath(); g.moveTo(-6, 4); g.lineTo(-1, -3); g.lineTo(4, 2); g.stroke();
      g.restore();
      break;
    }
    case 'cloud': {
      g.fillStyle = 'rgba(255,255,255,0.85)';
      g.beginPath(); g.arc(-8, 0, 10, 0, TAU); g.arc(4, -3, 12, 0, TAU); g.arc(13, 3, 8, 0, TAU); g.fill();
      g.fillStyle = 'rgba(180,205,240,0.6)';
      g.beginPath(); g.ellipse(2, 8, 16, 5, 0, 0, TAU); g.fill();
      break;
    }
    case 'spire': {
      g.fillStyle = dark; g.beginPath(); g.ellipse(0, 14, 11, 4, 0, 0, TAU); g.fill();
      g.fillStyle = '#30244a'; g.strokeStyle = '#14101f'; g.lineWidth = 1.5;
      g.beginPath(); g.moveTo(-8, 14); g.lineTo(-4, -18); g.lineTo(0, -24); g.lineTo(4, -18); g.lineTo(8, 14); g.closePath(); g.fill(); g.stroke();
      g.save(); g.shadowColor = '#a06bf0'; g.shadowBlur = 8;
      g.fillStyle = '#c05af0'; g.beginPath(); g.arc(0, -8, 2.5, 0, TAU); g.fill();
      g.restore();
      break;
    }
    case 'crystal': {
      g.fillStyle = dark; g.beginPath(); g.ellipse(0, 12, 12, 4.5, 0, 0, TAU); g.fill();
      const cols = ['#c9a2ff', '#8fd8ff', '#ff8ad8'];
      for (let k = 0; k < 3; k++) {
        const ox = (k - 1) * 7, hgt = k === 1 ? 26 : 16;
        g.save(); g.shadowColor = cols[k]; g.shadowBlur = 8;
        g.fillStyle = cols[k]; g.globalAlpha = 0.85;
        g.beginPath(); g.moveTo(ox - 4, 12); g.lineTo(ox - 2.5, 12 - hgt + 6); g.lineTo(ox, 12 - hgt); g.lineTo(ox + 2.5, 12 - hgt + 6); g.lineTo(ox + 4, 12); g.closePath(); g.fill();
        g.restore();
      }
      break;
    }
    case 'pillar': {
      g.fillStyle = dark; g.beginPath(); g.ellipse(0, 14, 12, 4.5, 0, 0, TAU); g.fill();
      g.fillStyle = '#c8a24a'; g.strokeStyle = '#6b4a10'; g.lineWidth = 1.5;
      g.fillRect(-6, -20, 12, 34); g.strokeRect(-6, -20, 12, 34);
      g.fillRect(-9, -24, 18, 5); g.strokeRect(-9, -24, 18, 5);
      g.fillRect(-9, 12, 18, 5); g.strokeRect(-9, 12, 18, 5);
      g.fillStyle = '#ffd966'; g.beginPath(); g.arc(0, -8, 3, 0, TAU); g.fill();
      break;
    }
  }
  g.restore();
}
