// ============================================================
// GTDM sprite factory — original procedural vector-art sprites
// Every unit/tower/boss is drawn from parameters into cached
// offscreen canvases with animation frames (walk/idle/attack).
// ============================================================
import { TAU, rgba, shade, mulberry32, hashStr } from '../core/util.js';

const cache = new Map();

// ---------- generic helpers ----------
function mk(size) {
  const c = document.createElement('canvas');
  c.width = size; c.height = size;
  return c;
}
function ell(ctx, x, y, rx, ry, fill, stroke = null, lw = 2) {
  ctx.beginPath(); ctx.ellipse(x, y, rx, ry, 0, 0, TAU);
  if (fill) { ctx.fillStyle = fill; ctx.fill(); }
  if (stroke) { ctx.strokeStyle = stroke; ctx.lineWidth = lw; ctx.stroke(); }
}
function rrect(ctx, x, y, w, h, r, fill, stroke = null, lw = 2) {
  ctx.beginPath();
  ctx.moveTo(x + r, y); ctx.arcTo(x + w, y, x + w, y + h, r); ctx.arcTo(x + w, y + h, x, y + h, r);
  ctx.arcTo(x, y + h, x, y, r); ctx.arcTo(x, y, x + w, y, r); ctx.closePath();
  if (fill) { ctx.fillStyle = fill; ctx.fill(); }
  if (stroke) { ctx.strokeStyle = stroke; ctx.lineWidth = lw; ctx.stroke(); }
}
function poly(ctx, pts, fill, stroke = null, lw = 2, close = true) {
  ctx.beginPath();
  pts.forEach((p, i) => i ? ctx.lineTo(p[0], p[1]) : ctx.moveTo(p[0], p[1]));
  if (close) ctx.closePath();
  if (fill) { ctx.fillStyle = fill; ctx.fill(); }
  if (stroke) { ctx.strokeStyle = stroke; ctx.lineWidth = lw; ctx.lineJoin = 'round'; ctx.stroke(); }
}
function vgrad(ctx, x, y0, y1, c0, c1) {
  const g = ctx.createLinearGradient(x, y0, x, y1);
  g.addColorStop(0, c0); g.addColorStop(1, c1);
  return g;
}
function eyesGlow(ctx, x, y, r, color) {
  ctx.save(); ctx.shadowColor = color; ctx.shadowBlur = r * 3;
  ell(ctx, x, y, r, r * 0.8, color);
  ctx.restore();
}
function shadowBlob(ctx, cx, cy, rx) {
  ell(ctx, cx, cy, rx, rx * 0.28, 'rgba(0,0,0,0.35)');
}

// deterministic jitter for textures
function jitter(seed, i, amt = 1) { const r = mulberry32(seed + i * 977)(); return (r - 0.5) * 2 * amt; }

// ============================================================
// POSES: t in [0,1) animation phase; pose = walk|idle|attack|flap
// ============================================================

function drawHumanoid(ctx, S, p, t, pose) {
  // S = size; p = params {skin, armor, armor2, cloth, weapon, weaponColor, eye, cape, hat, horns, crown, hood, wings, halo, skull, big, floaty}
  const cx = S / 2, groundY = S * 0.94;
  const h = S * (p.big ? 0.88 : 0.78); // total height
  const bob = pose === 'walk' ? Math.sin(t * TAU * 2) * S * 0.018 : Math.sin(t * TAU) * S * 0.012;
  const atkSwing = pose === 'attack' ? Math.sin(Math.min(1, t * 2) * Math.PI) : 0;
  const legSwing = pose === 'walk' ? Math.sin(t * TAU * 2) * 0.5 : 0;
  const yTop = groundY - h + bob;
  const hipY = groundY - h * 0.42 + bob;
  const shY = yTop + h * 0.26; // shoulders
  ctx.lineCap = 'round'; ctx.lineJoin = 'round';

  shadowBlob(ctx, cx, groundY, S * 0.22);

  // cape
  if (p.cape) {
    const flap = Math.sin(t * TAU + 1) * S * 0.03 + (pose === 'walk' ? S * 0.02 : 0);
    poly(ctx, [[cx - S * 0.16, shY - S * 0.02], [cx + S * 0.16, shY - S * 0.02],
    [cx + S * 0.2 + flap, groundY - S * 0.1], [cx - S * 0.2 + flap * 0.5, groundY - S * 0.1]],
      shade(p.cape, -0.15), shade(p.cape, -0.4), 2);
    poly(ctx, [[cx - S * 0.15, shY], [cx + S * 0.15, shY],
    [cx + S * 0.18 + flap, groundY - S * 0.12], [cx - S * 0.18 + flap * 0.5, groundY - S * 0.12]],
      p.cape, shade(p.cape, -0.3), 2);
  }
  // wings behind
  if (p.wings) drawWings(ctx, cx, shY, S, p.wings, t, pose, true);

  // legs
  const legW = S * 0.075;
  [-1, 1].forEach((dir, i) => {
    const sw = legSwing * dir;
    const lx = cx + dir * S * 0.075;
    ctx.save(); ctx.translate(lx, hipY); ctx.rotate(sw * 0.7);
    rrect(ctx, -legW / 2, 0, legW, h * 0.42, legW * 0.4, vgrad(ctx, 0, 0, h * 0.42, shade(p.cloth || p.armor, -0.1), shade(p.cloth || p.armor, -0.35)), 'rgba(0,0,0,.5)', 1.5);
    // boot
    rrect(ctx, -legW / 2 - 1, h * 0.36, legW + 3, h * 0.08, 3, shade(p.armor2 || '#3a2c22', -0.1), 'rgba(0,0,0,.5)', 1.5);
    ctx.restore();
  });

  // torso
  const torsoH = h * 0.36;
  rrect(ctx, cx - S * 0.15, hipY - torsoH, S * 0.3, torsoH + S * 0.02, S * 0.06,
    vgrad(ctx, 0, hipY - torsoH, hipY, shade(p.armor, 0.18), shade(p.armor, -0.25)), 'rgba(0,0,0,.55)', 2);
  // chest detail
  if (p.emblem) {
    ell(ctx, cx, hipY - torsoH * 0.55, S * 0.045, S * 0.05, p.emblem, shade(p.emblem, -0.4), 1.5);
  } else {
    rrect(ctx, cx - S * 0.15, hipY - torsoH * 0.2, S * 0.3, S * 0.05, 2, shade(p.armor2 || p.armor, -0.2), 'rgba(0,0,0,.4)', 1.5);
  }
  // belt
  rrect(ctx, cx - S * 0.155, hipY - S * 0.045, S * 0.31, S * 0.05, 2, shade(p.armor2 || '#6b4a20', -0.05), 'rgba(0,0,0,.5)', 1.5);

  // back arm (+ shield)
  ctx.save();
  ctx.translate(cx - S * 0.13, shY); ctx.rotate(-0.25 + legSwing * 0.4);
  rrect(ctx, -S * 0.035, 0, S * 0.07, h * 0.28, S * 0.03, shade(p.skin || p.armor, -0.2), 'rgba(0,0,0,.5)', 1.5);
  if (p.shield) {
    ell(ctx, -S * 0.02, h * 0.22, S * 0.09, S * 0.11, vgrad(ctx, 0, h * 0.12, h * 0.32, shade(p.shield, 0.2), shade(p.shield, -0.3)), 'rgba(0,0,0,.6)', 2);
    ell(ctx, -S * 0.02, h * 0.22, S * 0.035, S * 0.045, shade(p.shield, 0.35));
  }
  ctx.restore();

  // front arm + weapon
  ctx.save();
  ctx.translate(cx + S * 0.13, shY);
  const wAng = pose === 'attack' ? (-1.2 + atkSwing * 2.6) : (-0.2 - legSwing * 0.4);
  ctx.rotate(wAng);
  rrect(ctx, -S * 0.035, 0, S * 0.07, h * 0.28, S * 0.03, shade(p.skin || p.armor, -0.1), 'rgba(0,0,0,.5)', 1.5);
  drawWeapon(ctx, 0, h * 0.26, S, p.weapon, p.weaponColor || '#cfd6e4', atkSwing);
  ctx.restore();

  // head
  const headR = S * (p.big ? 0.115 : 0.105);
  const headY = yTop + headR * 0.9;
  if (p.hood) {
    ell(ctx, cx, headY + headR * 0.1, headR * 1.35, headR * 1.4, shade(p.hood, -0.1), 'rgba(0,0,0,.5)', 2);
    ell(ctx, cx, headY + headR * 0.25, headR * 0.9, headR * 0.85, '#0c0a14');
    eyesGlow(ctx, cx - headR * 0.32, headY + headR * 0.25, headR * 0.16, p.eye || '#ff5a4a');
    eyesGlow(ctx, cx + headR * 0.32, headY + headR * 0.25, headR * 0.16, p.eye || '#ff5a4a');
  } else if (p.skull) {
    ell(ctx, cx, headY, headR, headR * 1.05, vgrad(ctx, 0, headY - headR, headY + headR, '#e8e4d0', '#b8b09a'), 'rgba(0,0,0,.6)', 2);
    ell(ctx, cx - headR * 0.38, headY - headR * 0.1, headR * 0.26, headR * 0.3, '#141018');
    ell(ctx, cx + headR * 0.38, headY - headR * 0.1, headR * 0.26, headR * 0.3, '#141018');
    eyesGlow(ctx, cx - headR * 0.38, headY - headR * 0.08, headR * 0.12, p.eye || '#7dffb0');
    eyesGlow(ctx, cx + headR * 0.38, headY - headR * 0.08, headR * 0.12, p.eye || '#7dffb0');
    rrect(ctx, cx - headR * 0.3, headY + headR * 0.45, headR * 0.6, headR * 0.3, 2, '#d8d0bc', 'rgba(0,0,0,.5)', 1.5);
    for (let i = 0; i < 4; i++) { ctx.fillStyle = 'rgba(0,0,0,.5)'; ctx.fillRect(cx - headR * 0.26 + i * headR * 0.16, headY + headR * 0.48, 1.5, headR * 0.24); }
  } else {
    // helmet or skin head
    ell(ctx, cx, headY, headR, headR * 1.02, p.helm ? vgrad(ctx, 0, headY - headR, headY + headR, shade(p.helm, 0.25), shade(p.helm, -0.3)) : vgrad(ctx, 0, headY - headR, headY + headR, shade(p.skin, 0.15), shade(p.skin, -0.2)), 'rgba(0,0,0,.55)', 2);
    if (p.helm) {
      // visor slit
      rrect(ctx, cx - headR * 0.72, headY - headR * 0.16, headR * 1.44, headR * 0.42, 2, '#12101c');
      eyesGlow(ctx, cx - headR * 0.34, headY + headR * 0.04, headR * 0.13, p.eye || '#8fd8ff');
      eyesGlow(ctx, cx + headR * 0.34, headY + headR * 0.04, headR * 0.13, p.eye || '#8fd8ff');
      if (p.plume) poly(ctx, [[cx, headY - headR], [cx - S * 0.02 + Math.sin(t * TAU) * 2, headY - headR * 1.9], [cx + S * 0.03, headY - headR * 0.8]], p.plume, null);
    } else {
      // face
      const ey = headY - headR * 0.05;
      ell(ctx, cx - headR * 0.35, ey, headR * 0.14, headR * 0.18, '#1a1420');
      ell(ctx, cx + headR * 0.35, ey, headR * 0.14, headR * 0.18, '#1a1420');
      eyesGlow(ctx, cx - headR * 0.35, ey, headR * 0.07, p.eye || '#ffffff');
      eyesGlow(ctx, cx + headR * 0.35, ey, headR * 0.07, p.eye || '#ffffff');
      if (p.mouth) { ctx.strokeStyle = 'rgba(0,0,0,.5)'; ctx.lineWidth = 1.5; ctx.beginPath(); ctx.arc(cx, headY + headR * 0.35, headR * 0.3, 0.2, Math.PI - 0.2); ctx.stroke(); }
      if (p.hair) {
        poly(ctx, [[cx - headR, headY - headR * 0.2], [cx - headR * 0.6, headY - headR * 1.15], [cx, headY - headR * 0.9], [cx + headR * 0.7, headY - headR * 1.1], [cx + headR, headY - headR * 0.15], [cx + headR * 0.7, headY - headR * 0.7], [cx - headR * 0.7, headY - headR * 0.7]], p.hair, 'rgba(0,0,0,.4)', 1.5);
      }
    }
  }
  // horns / hat / crown
  if (p.horns) {
    [-1, 1].forEach(d => {
      poly(ctx, [[cx + d * headR * 0.7, headY - headR * 0.5], [cx + d * headR * 1.5, headY - headR * 1.4], [cx + d * headR * 1.0, headY - headR * 0.35]], p.hornColor || '#e0d8c0', 'rgba(0,0,0,.5)', 1.5);
    });
  }
  if (p.hat) { // wizard hat
    poly(ctx, [[cx - headR * 1.25, headY - headR * 0.62], [cx + headR * 1.25, headY - headR * 0.62], [cx + headR * 0.2 + Math.sin(t * TAU) * 3, headY - headR * 2.5]], p.hat, shade(p.hat, -0.35), 2);
    rrect(ctx, cx - headR * 1.4, headY - headR * 0.78, headR * 2.8, headR * 0.24, headR * 0.1, shade(p.hat, -0.15), 'rgba(0,0,0,.5)', 1.5);
    if (p.hatBand) rrect(ctx, cx - headR * 0.62, headY - headR * 0.95, headR * 1.24, headR * 0.22, 2, p.hatBand);
  }
  if (p.crown) {
    const cw = headR * 1.5, chy = headY - headR * (p.helm || p.skull ? 1.05 : 0.95);
    poly(ctx, [[cx - cw, chy], [cx - cw, chy - headR * 0.5], [cx - cw * 0.5, chy - headR * 0.15], [cx, chy - headR * 0.62], [cx + cw * 0.5, chy - headR * 0.15], [cx + cw, chy - headR * 0.5], [cx + cw, chy]],
      vgrad(ctx, 0, chy - headR * 0.6, chy, '#ffe08a', '#c89a20'), 'rgba(80,50,0,.7)', 1.5);
    ell(ctx, cx, chy - headR * 0.08, headR * 0.12, headR * 0.12, '#ff5a6a');
  }
  if (p.halo) {
    ctx.save(); ctx.shadowColor = p.halo; ctx.shadowBlur = 8;
    ell(ctx, cx, yTop - S * 0.04 + Math.sin(t * TAU) * 1.5, headR * 0.9, headR * 0.28, null, p.halo, 3);
    ctx.restore();
  }
  // headdress (pharaoh nemes)
  if (p.nemes) {
    poly(ctx, [[cx - headR * 1.2, headY + headR * 0.9], [cx - headR * 1.05, headY - headR * 0.7], [cx, headY - headR * 1.2], [cx + headR * 1.05, headY - headR * 0.7], [cx + headR * 1.2, headY + headR * 0.9], [cx + headR * 0.75, headY + headR * 0.55], [cx - headR * 0.75, headY + headR * 0.55]],
      p.nemes, 'rgba(0,0,0,.5)', 2);
    for (let i = 0; i < 3; i++) {
      ctx.strokeStyle = p.nemesStripe || '#2a4ac8'; ctx.lineWidth = 2;
      ctx.beginPath(); ctx.moveTo(cx - headR * (0.9 - i * 0.06), headY - headR * 0.4 + i * headR * 0.45);
      ctx.lineTo(cx + headR * (0.9 - i * 0.06), headY - headR * 0.4 + i * headR * 0.45); ctx.stroke();
    }
  }
}

function drawWeapon(ctx, hx, hy, S, type, color, atkSwing = 0) {
  ctx.save(); ctx.translate(hx, hy);
  const gl = (c, blur = 6) => { ctx.shadowColor = c; ctx.shadowBlur = blur; };
  switch (type) {
    case 'sword':
      ctx.rotate(-0.3);
      rrect(ctx, -S * 0.012, -S * 0.34, S * 0.024, S * 0.34, 2, vgrad(ctx, 0, -S * 0.34, 0, '#ffffff', color), 'rgba(0,0,0,.5)', 1);
      rrect(ctx, -S * 0.05, -S * 0.015, S * 0.1, S * 0.022, 2, '#c8a24a', 'rgba(0,0,0,.5)', 1);
      break;
    case 'bigsword':
      ctx.rotate(-0.25);
      poly(ctx, [[-S * 0.03, 0], [-S * 0.035, -S * 0.42], [0, -S * 0.5], [S * 0.035, -S * 0.42], [S * 0.03, 0]], vgrad(ctx, 0, -S * 0.5, 0, '#ffffff', color), 'rgba(0,0,0,.55)', 1.5);
      rrect(ctx, -S * 0.06, -S * 0.02, S * 0.12, S * 0.03, 2, '#c8a24a', 'rgba(0,0,0,.5)', 1);
      break;
    case 'flameblade':
      ctx.rotate(-0.25);
      ctx.save(); gl('#ff7a3a', 10);
      poly(ctx, [[-S * 0.03, 0], [-S * 0.04, -S * 0.4], [0, -S * 0.5], [S * 0.04, -S * 0.4], [S * 0.03, 0]], vgrad(ctx, 0, -S * 0.5, 0, '#ffe08a', color), '#7a2a10', 1.5);
      ctx.restore();
      break;
    case 'staff':
      rrect(ctx, -S * 0.012, -S * 0.44, S * 0.024, S * 0.46, 2, '#7a5a30', 'rgba(0,0,0,.5)', 1);
      ctx.save(); gl(color, 12);
      ell(ctx, 0, -S * 0.47, S * 0.045, S * 0.045, color);
      ctx.restore();
      ell(ctx, 0, -S * 0.47, S * 0.02, S * 0.02, '#ffffff');
      break;
    case 'scythe':
      rrect(ctx, -S * 0.012, -S * 0.5, S * 0.024, S * 0.52, 2, '#4a3a5a', 'rgba(0,0,0,.5)', 1);
      ctx.save(); gl(color, 8);
      ctx.beginPath(); ctx.arc(0, -S * 0.48, S * 0.14, Math.PI * 0.9, Math.PI * 1.85);
      ctx.lineTo(S * 0.05, -S * 0.44); ctx.arc(0, -S * 0.48, S * 0.09, Math.PI * 1.85, Math.PI * 0.95, true);
      ctx.closePath(); ctx.fillStyle = vgrad(ctx, -S * 0.14, -S * 0.6, S * 0.1, '#e8e8f4', color); ctx.fill();
      ctx.strokeStyle = 'rgba(0,0,0,.5)'; ctx.lineWidth = 1.5; ctx.stroke();
      ctx.restore();
      break;
    case 'bow':
      ctx.rotate(-0.1);
      ctx.strokeStyle = '#8a5a30'; ctx.lineWidth = S * 0.02;
      ctx.beginPath(); ctx.arc(0, -S * 0.2, S * 0.2, -Math.PI * 0.42, Math.PI * 0.42); ctx.stroke();
      ctx.strokeStyle = '#e8e4d8'; ctx.lineWidth = 1.5;
      ctx.beginPath(); ctx.moveTo(S * 0.145, -S * 0.34); ctx.lineTo(S * 0.145, -S * 0.06); ctx.stroke();
      break;
    case 'dagger':
      ctx.rotate(-0.4);
      poly(ctx, [[-S * 0.015, 0], [0, -S * 0.2], [S * 0.015, 0]], vgrad(ctx, 0, -S * 0.2, 0, '#fff', color), 'rgba(0,0,0,.5)', 1);
      break;
    case 'spear':
      rrect(ctx, -S * 0.01, -S * 0.52, S * 0.02, S * 0.54, 2, '#8a6a3a', 'rgba(0,0,0,.5)', 1);
      ctx.save(); gl(color, 8);
      poly(ctx, [[-S * 0.035, -S * 0.5], [0, -S * 0.64], [S * 0.035, -S * 0.5], [0, -S * 0.44]], color, 'rgba(0,0,0,.4)', 1);
      ctx.restore();
      break;
    case 'hammer':
      rrect(ctx, -S * 0.014, -S * 0.42, S * 0.028, S * 0.44, 2, '#6a4a28', 'rgba(0,0,0,.5)', 1);
      rrect(ctx, -S * 0.07, -S * 0.5, S * 0.14, S * 0.1, S * 0.02, vgrad(ctx, 0, -S * 0.5, -S * 0.4, shade(color, 0.3), color), 'rgba(0,0,0,.6)', 1.5);
      break;
    case 'tome':
      rrect(ctx, -S * 0.06, -S * 0.14, S * 0.12, S * 0.14, 2, color, 'rgba(0,0,0,.5)', 1.5);
      rrect(ctx, -S * 0.05, -S * 0.125, S * 0.09, S * 0.11, 1, '#f0e8d0');
      ell(ctx, 0, -S * 0.07, S * 0.02, S * 0.02, '#ffd966');
      break;
    case 'wand':
      ctx.rotate(-0.2);
      rrect(ctx, -S * 0.008, -S * 0.3, S * 0.016, S * 0.3, 2, '#e8dcc0', 'rgba(0,0,0,.4)', 1);
      ctx.save(); gl(color, 10);
      poly(ctx, [[0, -S * 0.38], [S * 0.03, -S * 0.32], [0, -S * 0.26], [-S * 0.03, -S * 0.32]], color);
      ctx.restore();
      break;
    case 'note':
      ctx.save(); gl(color, 8);
      ell(ctx, 0, -S * 0.16, S * 0.035, S * 0.028, color);
      rrect(ctx, S * 0.025, -S * 0.34, S * 0.012, S * 0.19, 1, color);
      ctx.restore();
      break;
    case 'claw':
      [-1, 0, 1].forEach(i => {
        ctx.save(); ctx.rotate(i * 0.25 - 0.2);
        poly(ctx, [[0, 0], [S * 0.012, -S * 0.16], [-S * 0.012, -S * 0.15]], '#e8e0d0', 'rgba(0,0,0,.4)', 1);
        ctx.restore();
      });
      break;
    case 'fist':
      ell(ctx, 0, -S * 0.02, S * 0.045, S * 0.04, color, 'rgba(0,0,0,.5)', 1.5);
      break;
  }
  ctx.restore();
}

function drawWings(ctx, cx, cy, S, w, t, pose, behind) {
  const flap = Math.sin(t * TAU * (pose === 'flap' || pose === 'walk' ? 2 : 1)) * 0.5 + 0.5;
  const ang = -0.5 - flap * 0.7;
  [-1, 1].forEach(d => {
    ctx.save();
    ctx.translate(cx + d * S * 0.1, cy);
    ctx.rotate(d * ang);
    ctx.scale(d, 1);
    const col = typeof w === 'string' ? w : w.color;
    if (w.type === 'feather') {
      for (let i = 0; i < 4; i++) {
        ctx.save(); ctx.rotate(-0.35 + i * 0.22);
        ell(ctx, S * 0.22, 0, S * 0.24, S * 0.06, i % 2 ? shade(col, -0.1) : col, 'rgba(0,0,0,.35)', 1.5);
        ctx.restore();
      }
    } else if (w.type === 'bat') {
      poly(ctx, [[0, 0], [S * 0.18, -S * 0.28], [S * 0.42, -S * 0.2], [S * 0.34, -S * 0.02], [S * 0.44, S * 0.06], [S * 0.28, S * 0.1], [S * 0.3, S * 0.22], [S * 0.12, S * 0.14]], col, 'rgba(0,0,0,.5)', 1.5);
    } else if (w.type === 'energy') {
      ctx.save(); ctx.shadowColor = col; ctx.shadowBlur = 12;
      poly(ctx, [[0, 0], [S * 0.3, -S * 0.2], [S * 0.44, 0], [S * 0.3, S * 0.16]], rgba(col.startsWith('#') ? col : '#8fd8ff', 0.55), col, 2);
      ctx.restore();
    } else { // insect
      ctx.save(); ctx.globalAlpha = 0.65;
      ell(ctx, S * 0.24, -S * 0.04, S * 0.24, S * 0.07, rgba('#cfe8ff', 0.8), '#8fb8d8', 1);
      ell(ctx, S * 0.2, S * 0.08, S * 0.18, S * 0.05, rgba('#cfe8ff', 0.7), '#8fb8d8', 1);
      ctx.restore();
    }
    ctx.restore();
  });
}

function drawBeast(ctx, S, p, t, pose) {
  // p: {fur, fur2, belly, spike, horn, eye, mane, tail, wings, big, tusks}
  const cx = S / 2, groundY = S * 0.92;
  const bodyW = S * (p.big ? 0.56 : 0.5), bodyH = S * 0.26;
  const bodyY = groundY - S * (p.big ? 0.36 : 0.32);
  const walk = pose === 'walk' ? Math.sin(t * TAU * 2) : 0;
  const bob = walk * S * 0.015;
  ctx.lineCap = 'round';
  shadowBlob(ctx, cx, groundY, bodyW * 0.55);
  if (p.wings) drawWings(ctx, cx, bodyY - S * 0.06, S, p.wings, t, pose, true);
  // tail
  const tw = Math.sin(t * TAU + 2) * S * 0.05;
  ctx.strokeStyle = shade(p.fur, -0.15); ctx.lineWidth = S * 0.045;
  ctx.beginPath(); ctx.moveTo(cx - bodyW * 0.48, bodyY + bob);
  ctx.quadraticCurveTo(cx - bodyW * 0.72, bodyY - S * 0.08 + tw, cx - bodyW * 0.8, bodyY - S * 0.16 + tw); ctx.stroke();
  // legs
  const legX = [-0.32, -0.12, 0.12, 0.32];
  legX.forEach((lx, i) => {
    const ph = walk * (i % 2 ? 1 : -1);
    ctx.save(); ctx.translate(cx + lx * bodyW, bodyY + bodyH * 0.55 + bob); ctx.rotate(ph * 0.4);
    rrect(ctx, -S * 0.032, 0, S * 0.064, S * 0.16, S * 0.03, shade(p.fur, i < 2 ? -0.25 : -0.05), 'rgba(0,0,0,.4)', 1.5);
    ctx.restore();
  });
  // body
  ell(ctx, cx, bodyY + bob, bodyW * 0.52, bodyH, vgrad(ctx, 0, bodyY - bodyH + bob, bodyY + bodyH + bob, shade(p.fur, 0.15), shade(p.fur, -0.3)), 'rgba(0,0,0,.5)', 2);
  ell(ctx, cx + bodyW * 0.05, bodyY + bodyH * 0.45 + bob, bodyW * 0.32, bodyH * 0.45, p.belly || shade(p.fur, 0.3));
  // mane / spikes
  if (p.mane) {
    for (let i = 0; i < 5; i++) {
      poly(ctx, [[cx - bodyW * 0.1 + i * bodyW * 0.1, bodyY - bodyH * 0.8 + bob],
      [cx - bodyW * 0.04 + i * bodyW * 0.1, bodyY - bodyH * (1.3 + (i % 2) * 0.25) + bob],
      [cx + bodyW * 0.02 + i * bodyW * 0.1, bodyY - bodyH * 0.8 + bob]], p.mane, 'rgba(0,0,0,.35)', 1);
    }
  }
  if (p.spike) {
    for (let i = 0; i < 4; i++) {
      poly(ctx, [[cx - bodyW * 0.2 + i * bodyW * 0.16, bodyY - bodyH * 0.85 + bob],
      [cx - bodyW * 0.14 + i * bodyW * 0.16, bodyY - bodyH * (1.5 - i * 0.08) + bob],
      [cx - bodyW * 0.06 + i * bodyW * 0.16, bodyY - bodyH * 0.8 + bob]], p.spike, 'rgba(0,0,0,.4)', 1.5);
    }
  }
  // head
  const headX = cx + bodyW * 0.5, headY = bodyY - bodyH * 0.5 + bob;
  const hr = S * (p.big ? 0.13 : 0.115);
  ell(ctx, headX, headY, hr, hr * 0.88, vgrad(ctx, 0, headY - hr, headY + hr, shade(p.fur, 0.12), shade(p.fur, -0.25)), 'rgba(0,0,0,.5)', 2);
  // snout
  ell(ctx, headX + hr * 0.75, headY + hr * 0.22, hr * 0.5, hr * 0.38, shade(p.fur2 || p.fur, 0.05), 'rgba(0,0,0,.45)', 1.5);
  ell(ctx, headX + hr * 1.05, headY + hr * 0.1, hr * 0.14, hr * 0.1, '#1a1018');
  if (p.tusks) {
    [-1, 1].forEach(d => poly(ctx, [[headX + hr * 0.6, headY + hr * (0.4 + d * 0.1)], [headX + hr * 1.05, headY + hr * (0.75 + d * 0.25)], [headX + hr * 0.75, headY + hr * 0.45]], '#f0e8d0', 'rgba(0,0,0,.4)', 1));
  }
  // ears
  [-1, 1].forEach(d => {
    if (p.ears === 'pointy') poly(ctx, [[headX + d * hr * 0.2, headY - hr * 0.7], [headX + d * hr * 0.75, headY - hr * 1.5], [headX + d * hr * 0.8, headY - hr * 0.5]], p.fur, 'rgba(0,0,0,.4)', 1.5);
    else ell(ctx, headX + d * hr * 0.55, headY - hr * 0.8, hr * 0.22, hr * 0.3, shade(p.fur, -0.1), 'rgba(0,0,0,.4)', 1.5);
  });
  if (p.horn) [-1, 1].forEach(d => poly(ctx, [[headX + d * hr * 0.1, headY - hr * 0.9], [headX + d * hr * 0.5, headY - hr * 1.7], [headX + d * hr * 0.55, headY - hr * 0.8]], p.horn, 'rgba(0,0,0,.4)', 1.5));
  // eyes
  const ey = headY - hr * 0.15;
  eyesGlow(ctx, headX + hr * 0.28, ey, hr * 0.13, p.eye || '#ffd23a');
  eyesGlow(ctx, headX + hr * 0.62, ey, hr * 0.1, p.eye || '#ffd23a');
  // teeth when attacking
  if (pose === 'attack') {
    poly(ctx, [[headX + hr * 0.5, headY + hr * 0.45], [headX + hr * 0.62, headY + hr * 0.7], [headX + hr * 0.74, headY + hr * 0.45]], '#fff', null);
  }
}

function drawFlyer(ctx, S, p, t, pose) {
  // p: {body, belly, wing:{type,color}, eye, beak, horn, tail, crest, big}
  const cx = S / 2;
  const floatY = S * 0.52 + Math.sin(t * TAU) * S * 0.03;
  ctx.lineCap = 'round';
  ell(ctx, cx, S * 0.93, S * 0.16, S * 0.04, 'rgba(0,0,0,.28)');
  drawWings(ctx, cx, floatY - S * 0.04, S * (p.big ? 1.15 : 1), p.wing, t, pose === 'walk' ? 'flap' : pose, true);
  // tail
  const tw = Math.sin(t * TAU + 1) * S * 0.03;
  poly(ctx, [[cx - S * 0.05, floatY + S * 0.08], [cx - S * 0.22, floatY + S * 0.2 + tw], [cx - S * 0.04, floatY + S * 0.16]], shade(p.body, -0.2), 'rgba(0,0,0,.4)', 1.5);
  // body
  ell(ctx, cx, floatY, S * 0.13, S * 0.17, vgrad(ctx, 0, floatY - S * 0.17, floatY + S * 0.17, shade(p.body, 0.15), shade(p.body, -0.25)), 'rgba(0,0,0,.5)', 2);
  ell(ctx, cx + S * 0.02, floatY + S * 0.06, S * 0.075, S * 0.09, p.belly || shade(p.body, 0.3));
  // feet
  [-1, 1].forEach(d => {
    ctx.strokeStyle = p.feet || '#c8903a'; ctx.lineWidth = S * 0.018;
    ctx.beginPath(); ctx.moveTo(cx + d * S * 0.045, floatY + S * 0.14); ctx.lineTo(cx + d * S * 0.05, floatY + S * 0.2); ctx.stroke();
  });
  // head
  const hy = floatY - S * 0.17;
  ell(ctx, cx + S * 0.02, hy, S * 0.085, S * 0.08, vgrad(ctx, 0, hy - S * 0.08, hy + S * 0.08, shade(p.body, 0.2), shade(p.body, -0.15)), 'rgba(0,0,0,.5)', 2);
  if (p.beak) poly(ctx, [[cx + S * 0.09, hy - S * 0.01], [cx + S * 0.17, hy + S * 0.015], [cx + S * 0.09, hy + S * 0.04]], p.beak, 'rgba(0,0,0,.4)', 1);
  if (p.crest) poly(ctx, [[cx - S * 0.02, hy - S * 0.07], [cx + S * 0.01, hy - S * 0.14], [cx + S * 0.05, hy - S * 0.06]], p.crest, 'rgba(0,0,0,.3)', 1);
  if (p.horn) [-1, 1].forEach(d => poly(ctx, [[cx + d * S * 0.04, hy - S * 0.05], [cx + d * S * 0.08, hy - S * 0.12], [cx + d * S * 0.06, hy - S * 0.03]], p.horn, null));
  eyesGlow(ctx, cx + S * 0.05, hy - S * 0.01, S * 0.017, p.eye || '#ffd23a');
  if (pose === 'attack' && p.beak) {
    poly(ctx, [[cx + S * 0.09, hy + S * 0.02], [cx + S * 0.16, hy + S * 0.05], [cx + S * 0.09, hy + S * 0.06]], '#fff', null);
  }
}

function drawBlob(ctx, S, p, t, pose) {
  const cx = S / 2;
  const squish = pose === 'walk' ? Math.sin(t * TAU * 2) * 0.1 : Math.sin(t * TAU) * 0.05;
  const by = S * 0.72;
  ell(ctx, cx, S * 0.9, S * 0.24, S * 0.05, 'rgba(0,0,0,.3)');
  ctx.save();
  ctx.shadowColor = p.glow || 'transparent'; ctx.shadowBlur = p.glow ? 10 : 0;
  const rx = S * 0.26 * (1 + squish * 0.5), ry = S * 0.22 * (1 - squish * 0.7);
  ell(ctx, cx, by, rx, ry, rgba(p.body, 0.88), shade(p.body, -0.4), 2);
  ctx.restore();
  ell(ctx, cx - rx * 0.3, by - ry * 0.45, rx * 0.22, ry * 0.16, rgba('#ffffff', 0.5));
  // nucleus
  if (p.core) ell(ctx, cx, by + ry * 0.15, rx * 0.3, ry * 0.3, rgba(p.core, 0.7));
  // eyes
  const blink = Math.sin(t * TAU * 0.7) > 0.92 ? 0.2 : 1;
  ell(ctx, cx - rx * 0.28, by - ry * 0.15, rx * 0.12, ry * 0.16 * blink, '#141024');
  ell(ctx, cx + rx * 0.28, by - ry * 0.15, rx * 0.12, ry * 0.16 * blink, '#141024');
  ell(ctx, cx - rx * 0.26, by - ry * 0.22, rx * 0.04, ry * 0.05 * blink, '#fff');
  ell(ctx, cx + rx * 0.3, by - ry * 0.22, rx * 0.04, ry * 0.05 * blink, '#fff');
  if (p.mouth) { ctx.strokeStyle = '#141024'; ctx.lineWidth = 2; ctx.beginPath(); ctx.arc(cx, by + ry * 0.2, rx * 0.18, 0.3, Math.PI - 0.3); ctx.stroke(); }
  if (p.crownlet) {
    poly(ctx, [[cx - rx * 0.4, by - ry * 0.85], [cx - rx * 0.2, by - ry * 1.2], [cx, by - ry * 0.9], [cx + rx * 0.2, by - ry * 1.25], [cx + rx * 0.4, by - ry * 0.85]], '#ffd966', '#a87b1e', 1.5);
  }
}

function drawGhost(ctx, S, p, t, pose) {
  const cx = S / 2;
  const fy = S * 0.46 + Math.sin(t * TAU) * S * 0.035;
  const w = S * 0.3;
  ctx.save();
  ctx.globalAlpha = p.alpha ?? 0.92;
  ctx.shadowColor = p.glow || p.body; ctx.shadowBlur = 14;
  // body with wavy bottom
  ctx.beginPath();
  ctx.moveTo(cx - w, fy + S * 0.3);
  ctx.quadraticCurveTo(cx - w * 1.1, fy - S * 0.2, cx, fy - S * 0.28);
  ctx.quadraticCurveTo(cx + w * 1.1, fy - S * 0.2, cx + w, fy + S * 0.3);
  for (let i = 0; i < 4; i++) {
    const px = cx + w - (i + 1) * (w * 2 / 4);
    const ph = Math.sin(t * TAU * 2 + i * 1.7) * S * 0.03;
    ctx.quadraticCurveTo(px + w / 4, fy + S * 0.38 + ph, px, fy + S * 0.28);
  }
  ctx.closePath();
  ctx.fillStyle = vgrad(ctx, 0, fy - S * 0.3, fy + S * 0.35, rgba(p.body, 0.95), rgba(p.fade || p.body, 0.25));
  ctx.fill();
  ctx.strokeStyle = rgba(p.glow || '#ffffff', 0.35); ctx.lineWidth = 1.5; ctx.stroke();
  ctx.restore();
  // hood face
  ell(ctx, cx, fy - S * 0.08, w * 0.62, w * 0.6, '#0d0a16');
  eyesGlow(ctx, cx - w * 0.26, fy - S * 0.08, S * 0.022, p.eye || '#7dffb0');
  eyesGlow(ctx, cx + w * 0.26, fy - S * 0.08, S * 0.022, p.eye || '#7dffb0');
  if (p.horns) [-1, 1].forEach(d => poly(ctx, [[cx + d * w * 0.5, fy - S * 0.22], [cx + d * w * 1.0, fy - S * 0.42], [cx + d * w * 0.7, fy - S * 0.18]], shade(p.body, -0.1), 'rgba(0,0,0,.4)', 1.5));
}

function drawConstruct(ctx, S, p, t, pose) {
  const cx = S / 2, gy = S * 0.92;
  const bob = pose === 'walk' ? Math.abs(Math.sin(t * TAU * 2)) * S * 0.02 : Math.sin(t * TAU) * S * 0.01;
  const j = i => jitter(hashStr(p.id || 'c'), i, S * 0.012);
  shadowBlob(ctx, cx, gy, S * 0.26);
  // legs
  const legSw = pose === 'walk' ? Math.sin(t * TAU * 2) * 0.4 : 0;
  [-1, 1].forEach((d, i) => {
    ctx.save(); ctx.translate(cx + d * S * 0.12, gy - S * 0.26 + bob); ctx.rotate(legSw * d);
    rrect(ctx, -S * 0.05, 0, S * 0.1, S * 0.26, 3, shade(p.rock, -0.2), 'rgba(0,0,0,.5)', 2);
    ctx.restore();
  });
  // arms
  [-1, 1].forEach(d => {
    ctx.save(); ctx.translate(cx + d * S * 0.22, gy - S * 0.5 + bob); ctx.rotate(d * (0.2 + (pose === 'attack' ? -0.8 : 0) + Math.sin(t * TAU) * 0.05));
    rrect(ctx, -S * 0.045, 0, S * 0.09, S * 0.3, 4, shade(p.rock, -0.12), 'rgba(0,0,0,.5)', 2);
    ell(ctx, 0, S * 0.32, S * 0.07, S * 0.06, shade(p.rock, -0.05), 'rgba(0,0,0,.5)', 2);
    ctx.restore();
  });
  // body chunks
  const bx = cx + j(1), by = gy - S * 0.52 + bob;
  poly(ctx, [[bx - S * 0.2 + j(2), by + S * 0.24], [bx - S * 0.24 + j(3), by - S * 0.06], [bx - S * 0.1 + j(4), by - S * 0.2], [bx + S * 0.12 + j(5), by - S * 0.22], [bx + S * 0.25 + j(6), by - S * 0.02], [bx + S * 0.2 + j(7), by + S * 0.25]],
    vgrad(ctx, 0, by - S * 0.22, by + S * 0.25, shade(p.rock, 0.2), shade(p.rock, -0.35)), 'rgba(0,0,0,.55)', 2);
  // cracks with glow
  ctx.save(); ctx.shadowColor = p.glow; ctx.shadowBlur = 8;
  ctx.strokeStyle = p.glow; ctx.lineWidth = 2.2;
  ctx.beginPath();
  ctx.moveTo(bx - S * 0.12, by - S * 0.1); ctx.lineTo(bx - S * 0.02, by + S * 0.02); ctx.lineTo(bx + S * 0.08, by - S * 0.06);
  ctx.moveTo(bx - S * 0.02, by + S * 0.02); ctx.lineTo(bx + S * 0.02, by + S * 0.16);
  ctx.stroke();
  ctx.restore();
  // head
  const hy = by - S * 0.28 + bob * 0.5;
  poly(ctx, [[cx - S * 0.12 + j(8), hy + S * 0.08], [cx - S * 0.14 + j(9), hy - S * 0.06], [cx + j(10), hy - S * 0.12], [cx + S * 0.14 + j(11), hy - S * 0.04], [cx + S * 0.12 + j(12), hy + S * 0.09]],
    vgrad(ctx, 0, hy - S * 0.12, hy + S * 0.1, shade(p.rock, 0.25), shade(p.rock, -0.2)), 'rgba(0,0,0,.55)', 2);
  eyesGlow(ctx, cx - S * 0.055, hy, S * 0.02, p.eye || p.glow);
  eyesGlow(ctx, cx + S * 0.055, hy, S * 0.02, p.eye || p.glow);
  if (p.crystal) { // floating crystal above
    const fy2 = hy - S * 0.2 + Math.sin(t * TAU) * S * 0.015;
    ctx.save(); ctx.translate(cx, fy2); ctx.rotate(t * TAU * 0.25);
    ctx.shadowColor = p.crystal; ctx.shadowBlur = 12;
    poly(ctx, [[0, -S * 0.07], [S * 0.045, 0], [0, S * 0.07], [-S * 0.045, 0]], p.crystal, '#fff8', 1.5);
    ctx.restore();
  }
  if (p.rings) { // arcane rings
    ctx.save(); ctx.translate(cx, by - S * 0.1);
    ctx.strokeStyle = rgba(p.glow, 0.7); ctx.lineWidth = 2;
    ell(ctx, 0, 0, S * 0.3, S * 0.1, null, rgba(p.glow, 0.6), 2);
    ctx.rotate(t * 2);
    ell(ctx, 0, 0, S * 0.24, S * 0.24, null, rgba(p.glow, 0.35), 1.5);
    ctx.restore();
  }
}

function drawPlant(ctx, S, p, t, pose) {
  const cx = S / 2, gy = S * 0.92;
  const sway = Math.sin(t * TAU) * 0.06;
  shadowBlob(ctx, cx, gy, S * 0.22);
  // roots/legs
  [-1, 1].forEach(d => {
    ctx.strokeStyle = shade(p.bark, -0.25); ctx.lineWidth = S * 0.06;
    ctx.beginPath(); ctx.moveTo(cx + d * S * 0.06, gy - S * 0.3);
    ctx.quadraticCurveTo(cx + d * S * 0.16, gy - S * 0.12, cx + d * S * 0.2, gy); ctx.stroke();
  });
  // trunk
  ctx.save(); ctx.translate(cx, gy - S * 0.28); ctx.rotate(sway * 0.4);
  rrect(ctx, -S * 0.13, -S * 0.24, S * 0.26, S * 0.3, S * 0.05, vgrad(ctx, -S * 0.13, 0, S * 0.13, shade(p.bark, 0.15), shade(p.bark, -0.3)), 'rgba(0,0,0,.5)', 2);
  // face on trunk
  eyesGlow(ctx, -S * 0.05, -S * 0.12, S * 0.018, p.eye || '#ffe08a');
  eyesGlow(ctx, S * 0.05, -S * 0.12, S * 0.018, p.eye || '#ffe08a');
  ctx.strokeStyle = 'rgba(0,0,0,.5)'; ctx.lineWidth = 2;
  ctx.beginPath(); ctx.arc(0, -S * 0.04, S * 0.05, pose === 'attack' ? 0 : 0.4, pose === 'attack' ? Math.PI : Math.PI - 0.4); ctx.stroke();
  // arms = branches
  [-1, 1].forEach(d => {
    ctx.save(); ctx.rotate(d * (0.5 + sway * d) + (pose === 'attack' ? -d * 0.7 : 0));
    ctx.strokeStyle = shade(p.bark, -0.1); ctx.lineWidth = S * 0.045;
    ctx.beginPath(); ctx.moveTo(d * S * 0.1, -S * 0.2); ctx.quadraticCurveTo(d * S * 0.3, -S * 0.3, d * S * 0.34, -S * 0.44); ctx.stroke();
    if (p.leaves) ell(ctx, d * S * 0.36, -S * 0.48, S * 0.09, S * 0.06, p.leaves, shade(p.leaves, -0.3), 1.5);
    ctx.restore();
  });
  // canopy
  if (p.canopy) {
    const cy2 = -S * 0.36;
    [[-0.14, 0.02, 0.13], [0.14, 0.02, 0.13], [0, -0.08, 0.17]].forEach(([ox, oy, r], i) => {
      ell(ctx, ox * S, cy2 + oy * S + sway * S * 8 * (i % 2 ? 1 : -1) * 0.02, r * S, r * S * 0.85, i % 2 ? shade(p.canopy, -0.08) : p.canopy, shade(p.canopy, -0.35), 2);
    });
    if (p.flowers) [[-0.16, -0.3], [0.1, -0.42], [0.2, -0.26]].forEach(([fx, fy]) => {
      ell(ctx, fx * S, cy2 + fy * S, S * 0.025, S * 0.025, p.flowers);
    });
  }
  ctx.restore();
}

function drawSerpent(ctx, S, p, t, pose, heads = 3) {
  // multi-headed hydra / leviathan style: coiled body + necks
  const cx = S / 2, gy = S * 0.92;
  const sway = Math.sin(t * TAU) * 0.05;
  shadowBlob(ctx, cx, gy, S * 0.3);
  // coil base
  ell(ctx, cx, gy - S * 0.09, S * 0.28, S * 0.11, shade(p.body, -0.25), 'rgba(0,0,0,.5)', 2);
  ell(ctx, cx, gy - S * 0.16, S * 0.24, S * 0.1, shade(p.body, -0.1), 'rgba(0,0,0,.4)', 2);
  ell(ctx, cx, gy - S * 0.24, S * 0.2, S * 0.09, p.body, 'rgba(0,0,0,.4)', 2);
  // belly scales
  ell(ctx, cx, gy - S * 0.22, S * 0.11, S * 0.05, p.belly || shade(p.body, 0.3));
  // necks + heads
  for (let i = 0; i < heads; i++) {
    const dir = (i - (heads - 1) / 2);
    const ph = t * TAU + i * 1.9;
    const nx = cx + dir * S * 0.16, ny = gy - S * 0.55 + Math.sin(ph) * S * 0.03;
    const hx = nx + dir * S * 0.1 + Math.sin(ph + 1) * S * 0.02;
    const hy = ny - S * 0.14 + Math.cos(ph) * S * 0.025 - (pose === 'attack' && i === 1 ? S * 0.1 : 0);
    ctx.strokeStyle = shade(p.body, -0.05); ctx.lineWidth = S * 0.055; ctx.lineCap = 'round';
    ctx.beginPath(); ctx.moveTo(cx + dir * S * 0.06, gy - S * 0.28);
    ctx.quadraticCurveTo(nx - dir * S * 0.02 + Math.sin(ph) * S * 0.02, ny + S * 0.06, hx, hy); ctx.stroke();
    // head
    ell(ctx, hx, hy, S * 0.075, S * 0.055, vgrad(ctx, 0, hy - S * 0.05, hy + S * 0.05, shade(p.body, 0.15), shade(p.body, -0.25)), 'rgba(0,0,0,.5)', 1.5);
    // jaw
    poly(ctx, [[hx + (dir >= 0 ? S * 0.05 : -S * 0.05), hy + S * 0.01], [hx + dir * S * 0.11, hy + S * 0.035 + (pose === 'attack' ? S * 0.03 : 0)], [hx + dir * S * 0.04, hy + S * 0.045]], shade(p.body, -0.15), 'rgba(0,0,0,.4)', 1);
    eyesGlow(ctx, hx + dir * S * 0.03, hy - S * 0.015, S * 0.014, p.eye || '#ffe04a');
    if (p.frill) poly(ctx, [[hx - dir * S * 0.05, hy - S * 0.03], [hx - dir * S * 0.1, hy - S * 0.09], [hx - dir * S * 0.02, hy - S * 0.06]], p.frill, null);
    if (p.horns) poly(ctx, [[hx, hy - S * 0.04], [hx - dir * S * 0.02, hy - S * 0.1], [hx + dir * S * 0.03, hy - S * 0.05]], p.horns, null);
  }
  if (p.aura) {
    ctx.save(); ctx.globalAlpha = 0.25 + Math.sin(t * TAU) * 0.1;
    ell(ctx, cx, gy - S * 0.35, S * 0.42, S * 0.34, null, p.aura, 3);
    ctx.restore();
  }
}

function drawScorpion(ctx, S, p, t, pose) {
  const cx = S / 2, gy = S * 0.9;
  const walk = pose === 'walk' ? Math.sin(t * TAU * 2) : 0;
  shadowBlob(ctx, cx, gy, S * 0.3);
  // legs
  for (let i = 0; i < 3; i++) [-1, 1].forEach(d => {
    ctx.strokeStyle = shade(p.body, -0.25); ctx.lineWidth = S * 0.028;
    const ph = walk * (i % 2 ? 1 : -1) * 0.2;
    ctx.beginPath(); ctx.moveTo(cx + d * S * 0.1, gy - S * 0.2);
    ctx.quadraticCurveTo(cx + d * S * (0.22 + i * 0.03), gy - S * (0.16 - i * 0.02) + ph * S, cx + d * S * (0.26 + i * 0.05), gy - S * 0.02); ctx.stroke();
  });
  // body segments
  ell(ctx, cx, gy - S * 0.26, S * 0.2, S * 0.13, vgrad(ctx, 0, gy - S * 0.4, gy - S * 0.14, shade(p.body, 0.2), shade(p.body, -0.3)), 'rgba(0,0,0,.5)', 2);
  ell(ctx, cx - S * 0.02, gy - S * 0.24, S * 0.12, S * 0.07, shade(p.belly || p.body, 0.25));
  // claws
  [-1, 1].forEach(d => {
    const cyx = cx + d * S * 0.3, cyy = gy - S * 0.32 + Math.sin(t * TAU + d) * S * 0.012;
    ctx.strokeStyle = shade(p.body, -0.15); ctx.lineWidth = S * 0.035;
    ctx.beginPath(); ctx.moveTo(cx + d * S * 0.14, gy - S * 0.28); ctx.lineTo(cyx, cyy); ctx.stroke();
    ell(ctx, cyx, cyy, S * 0.075, S * 0.055, shade(p.body, 0.05), 'rgba(0,0,0,.5)', 2);
    poly(ctx, [[cyx + d * S * 0.02, cyy - S * 0.05], [cyx + d * S * 0.09, cyy - S * 0.075 - (pose === 'attack' ? S * 0.03 : 0)], [cyx + d * S * 0.05, cyy - S * 0.02]], shade(p.body, 0.1), 'rgba(0,0,0,.5)', 1.5);
    poly(ctx, [[cyx + d * S * 0.02, cyy + S * 0.04], [cyx + d * S * 0.08, cyy + S * 0.02], [cyx + d * S * 0.04, cyy]], shade(p.body, -0.05), 'rgba(0,0,0,.5)', 1.5);
  });
  // tail
  const st = Math.sin(t * TAU * 0.8) * 0.15 + (pose === 'attack' ? 0.4 : 0);
  const pts = [];
  for (let i = 0; i <= 6; i++) {
    const a = Math.PI * 0.15 + (i / 6) * (Math.PI * 0.85 + st);
    pts.push([cx - S * 0.16 - Math.cos(a) * S * 0.26 * (i / 6 + 0.4), gy - S * 0.26 - Math.sin(a) * S * 0.3 * (i / 6 + 0.3)]);
  }
  ctx.strokeStyle = shade(p.body, -0.1); ctx.lineWidth = S * 0.04;
  ctx.beginPath(); pts.forEach((q, i) => i ? ctx.lineTo(q[0], q[1]) : ctx.moveTo(q[0], q[1])); ctx.stroke();
  const tip = pts[pts.length - 1];
  ctx.save(); ctx.shadowColor = p.venom || '#7dff5a'; ctx.shadowBlur = 8;
  poly(ctx, [[tip[0], tip[1] - S * 0.02], [tip[0] - S * 0.045, tip[1] + S * 0.05], [tip[0] + S * 0.02, tip[1] + S * 0.04]], p.venom || '#7dff5a', 'rgba(0,0,0,.5)', 1.5);
  ctx.restore();
  // eyes
  eyesGlow(ctx, cx + S * 0.08, gy - S * 0.3, S * 0.014, p.eye || '#ff5a4a');
  eyesGlow(ctx, cx + S * 0.12, gy - S * 0.32, S * 0.012, p.eye || '#ff5a4a');
}

function drawKraken(ctx, S, p, t, pose) {
  const cx = S / 2, gy = S * 0.94;
  const sway = Math.sin(t * TAU * 0.8);
  shadowBlob(ctx, cx, gy, S * 0.34);
  // tentacles
  for (let i = 0; i < 6; i++) {
    const d = (i - 2.5) / 2.5;
    const ph = t * TAU + i * 1.3;
    ctx.strokeStyle = i % 2 ? shade(p.body, -0.15) : shade(p.body, -0.05);
    ctx.lineWidth = S * 0.05 * (1 - Math.abs(d) * 0.3);
    ctx.beginPath();
    ctx.moveTo(cx + d * S * 0.14, gy - S * 0.3);
    ctx.quadraticCurveTo(cx + d * S * 0.3 + Math.sin(ph) * S * 0.06, gy - S * 0.12, cx + d * S * 0.42 + Math.sin(ph + 1) * S * 0.08, gy - S * 0.02 - Math.abs(d) * S * 0.04);
    ctx.stroke();
    // suckers
    ctx.fillStyle = rgba(p.sucker || '#ff9a8a', 0.8);
    for (let s2 = 1; s2 <= 3; s2++) {
      const sx = cx + d * S * (0.16 + s2 * 0.08) + Math.sin(ph + s2) * S * 0.02;
      ell(ctx, sx, gy - S * (0.22 - s2 * 0.05), S * 0.012, S * 0.012, rgba(p.sucker || '#ff9a8a', 0.8));
    }
  }
  // mantle
  const my = gy - S * 0.52 + sway * S * 0.012;
  ell(ctx, cx, my, S * 0.24, S * 0.3, vgrad(ctx, 0, my - S * 0.3, my + S * 0.3, shade(p.body, 0.18), shade(p.body, -0.35)), 'rgba(0,0,0,.55)', 2.5);
  ell(ctx, cx, my + S * 0.1, S * 0.15, S * 0.16, shade(p.belly || p.body, 0.25));
  // eyes
  const ey = my - S * 0.02;
  ell(ctx, cx - S * 0.09, ey, S * 0.05, S * 0.045, '#ffe9a0', 'rgba(0,0,0,.6)', 1.5);
  ell(ctx, cx + S * 0.09, ey, S * 0.05, S * 0.045, '#ffe9a0', 'rgba(0,0,0,.6)', 1.5);
  eyesGlow(ctx, cx - S * 0.09, ey, S * 0.02, p.eye || '#ff3a2a');
  eyesGlow(ctx, cx + S * 0.09, ey, S * 0.02, p.eye || '#ff3a2a');
  // crown bumps
  for (let i = 0; i < 4; i++) ell(ctx, cx - S * 0.12 + i * S * 0.08, my - S * 0.28, S * 0.035, S * 0.045, shade(p.body, 0.1), 'rgba(0,0,0,.4)', 1);
  if (p.glowSpots) {
    ctx.save(); ctx.shadowColor = p.glowSpots; ctx.shadowBlur = 6;
    for (let i = 0; i < 5; i++) ell(ctx, cx + jitter(77, i, S * 0.16), my + jitter(88, i, S * 0.2), S * 0.014, S * 0.014, p.glowSpots);
    ctx.restore();
  }
}

// ============================================================
// TOWER DRAWING — unique silhouette per tower
// ============================================================
function drawTowerArt(ctx, S, id, t) {
  const cx = S / 2, gy = S * 0.93;
  ctx.lineCap = 'round'; ctx.lineJoin = 'round';
  // shared stone base
  const base = (col1 = '#6a6478', col2 = '#484258') => {
    ell(ctx, cx, gy - S * 0.02, S * 0.36, S * 0.09, 'rgba(0,0,0,.35)');
    poly(ctx, [[cx - S * 0.32, gy], [cx - S * 0.26, gy - S * 0.14], [cx + S * 0.26, gy - S * 0.14], [cx + S * 0.32, gy]], vgrad(ctx, 0, gy - S * 0.14, gy, col1, col2), 'rgba(0,0,0,.5)', 2);
    for (let i = 0; i < 3; i++) { ctx.strokeStyle = 'rgba(0,0,0,.25)'; ctx.lineWidth = 1.5; ctx.beginPath(); ctx.moveTo(cx - S * 0.2 + i * S * 0.18, gy - S * 0.13); ctx.lineTo(cx - S * 0.22 + i * S * 0.18, gy - S * 0.01); ctx.stroke(); }
  };
  const glowOrb = (x, y, r, c) => { ctx.save(); ctx.shadowColor = c; ctx.shadowBlur = r * 3.5; ell(ctx, x, y, r, r, c); ctx.restore(); ell(ctx, x, y, r * 0.45, r * 0.45, '#ffffffcc'); };

  switch (id) {
    case 'thorn': {
      base('#5a6a48', '#3c4a30');
      // thorny mound
      ell(ctx, cx, gy - S * 0.2, S * 0.24, S * 0.16, vgrad(ctx, 0, gy - S * 0.36, gy - S * 0.06, '#5a7a3a', '#33481f'), '#20300f', 2);
      for (let i = 0; i < 7; i++) {
        const a = Math.PI + (i / 6) * Math.PI;
        const tx = cx + Math.cos(a) * S * 0.22, ty = gy - S * 0.2 + Math.sin(a) * S * 0.15;
        poly(ctx, [[tx, ty], [tx + Math.cos(a) * S * 0.1, ty + Math.sin(a) * S * 0.1], [tx + Math.cos(a + 0.5) * S * 0.03, ty + Math.sin(a + 0.5) * S * 0.03]], '#d8c8a0', '#6a5a3a', 1);
      }
      eyesGlow(ctx, cx - S * 0.06, gy - S * 0.22, S * 0.016, '#ff6a4a');
      eyesGlow(ctx, cx + S * 0.06, gy - S * 0.22, S * 0.016, '#ff6a4a');
      break;
    }
    case 'icearrow': {
      base('#7a8aa0', '#54607a');
      // icy platform + crystal arrows
      rrect(ctx, cx - S * 0.2, gy - S * 0.3, S * 0.4, S * 0.16, 3, vgrad(ctx, 0, gy - S * 0.3, gy - S * 0.14, '#bfe0f8', '#7aa8d0'), '#4a78a0', 2);
      ctx.save(); ctx.shadowColor = '#8fd8ff'; ctx.shadowBlur = 10;
      poly(ctx, [[cx - S * 0.1, gy - S * 0.3], [cx - S * 0.06, gy - S * 0.56], [cx - S * 0.02, gy - S * 0.3]], '#cfeaff', '#6aa8d8', 1.5);
      poly(ctx, [[cx, gy - S * 0.32], [cx + S * 0.05, gy - S * 0.64], [cx + S * 0.1, gy - S * 0.32]], '#e8f6ff', '#6aa8d8', 1.5);
      poly(ctx, [[cx + S * 0.1, gy - S * 0.3], [cx + S * 0.15, gy - S * 0.5], [cx + S * 0.2, gy - S * 0.3]], '#bfe0f8', '#6aa8d8', 1.5);
      ctx.restore();
      // hooded archer silhouette
      ell(ctx, cx - S * 0.16, gy - S * 0.42, S * 0.07, S * 0.09, '#3a5a8a', '#20384f', 1.5);
      eyesGlow(ctx, cx - S * 0.16, gy - S * 0.42, S * 0.014, '#9fe8ff');
      break;
    }
    case 'shuriken': {
      base('#6a5a70', '#483c50');
      // dojo post + spinning shuriken
      rrect(ctx, cx - S * 0.05, gy - S * 0.42, S * 0.1, S * 0.3, 2, '#7a4a3a', '#4a281c', 2);
      poly(ctx, [[cx - S * 0.2, gy - S * 0.44], [cx + S * 0.2, gy - S * 0.44], [cx + S * 0.14, gy - S * 0.52], [cx - S * 0.14, gy - S * 0.52]], '#a04a3a', '#5a2418', 2);
      ctx.save(); ctx.translate(cx, gy - S * 0.6); ctx.rotate(t * TAU * 1.5);
      ctx.shadowColor = '#cfd6e4'; ctx.shadowBlur = 6;
      for (let i = 0; i < 4; i++) {
        ctx.rotate(Math.PI / 2);
        poly(ctx, [[0, 0], [S * 0.1, -S * 0.03], [S * 0.14, 0], [S * 0.1, S * 0.03]], '#dfe6f0', '#8a92a4', 1);
      }
      ctx.restore();
      break;
    }
    case 'bat': {
      base('#4a4258', '#302a3c');
      // dead tree roost
      ctx.strokeStyle = '#3a2c22'; ctx.lineWidth = S * 0.05;
      ctx.beginPath(); ctx.moveTo(cx, gy - S * 0.14); ctx.lineTo(cx, gy - S * 0.5); ctx.stroke();
      [[-1, 0.5], [1, 0.42], [-1, 0.3], [1, 0.6]].forEach(([d, h]) => {
        ctx.lineWidth = S * 0.025;
        ctx.beginPath(); ctx.moveTo(cx, gy - S * h); ctx.quadraticCurveTo(cx + d * S * 0.12, gy - S * (h + 0.06), cx + d * S * 0.18, gy - S * (h + 0.02)); ctx.stroke();
      });
      // hanging bats
      [[-0.14, 0.56], [0.13, 0.5], [0, 0.64]].forEach(([ox, oy], i) => {
        const bx = cx + ox * S + Math.sin(t * TAU * 2 + i * 2) * 1.5, by = gy - oy * S;
        ell(ctx, bx, by, S * 0.03, S * 0.04, '#241c30', '#0d0a14', 1);
        poly(ctx, [[bx, by], [bx - S * 0.07, by - S * 0.03], [bx - S * 0.05, by + S * 0.02]], '#3a2c50');
        poly(ctx, [[bx, by], [bx + S * 0.07, by - S * 0.03], [bx + S * 0.05, by + S * 0.02]], '#3a2c50');
        eyesGlow(ctx, bx, by - S * 0.012, S * 0.008, '#ff5a4a');
      });
      break;
    }
    case 'cannon': {
      base('#6a6478', '#484258');
      // rotating barrel
      rrect(ctx, cx - S * 0.22, gy - S * 0.28, S * 0.44, S * 0.14, 4, vgrad(ctx, 0, gy - S * 0.28, gy - S * 0.14, '#7d8494', '#4a5060'), '#2c3040', 2);
      ctx.save(); ctx.translate(cx, gy - S * 0.34);
      ell(ctx, 0, 0, S * 0.12, S * 0.12, vgrad(ctx, -S * 0.1, -S * 0.1, S * 0.1, '#8a92a4', '#454b5c'), '#2c3040', 2);
      ctx.rotate(-0.5);
      rrect(ctx, -S * 0.045, -S * 0.34, S * 0.09, S * 0.36, S * 0.03, vgrad(ctx, -S * 0.045, 0, S * 0.045, '#5d6474', '#2e3342'), '#1c202c', 2);
      ell(ctx, 0, -S * 0.34, S * 0.055, S * 0.03, '#14161e', '#000', 1.5);
      ctx.restore();
      // ammo pile
      ell(ctx, cx + S * 0.24, gy - S * 0.06, S * 0.05, S * 0.045, '#2c3040', '#14161e', 1.5);
      ell(ctx, cx + S * 0.19, gy - S * 0.045, S * 0.04, S * 0.035, '#3a4050', '#14161e', 1.5);
      break;
    }
    case 'magic': {
      base('#5a5a8a', '#3c3c60');
      // arcane spire
      poly(ctx, [[cx - S * 0.16, gy - S * 0.14], [cx - S * 0.1, gy - S * 0.55], [cx + S * 0.1, gy - S * 0.55], [cx + S * 0.16, gy - S * 0.14]], vgrad(ctx, 0, gy - S * 0.55, gy - S * 0.14, '#6a5aa8', '#3a2c68'), '#241a44', 2);
      poly(ctx, [[cx - S * 0.12, gy - S * 0.52], [cx, gy - S * 0.78], [cx + S * 0.12, gy - S * 0.52]], '#8a6bd8', '#3a2c68', 2);
      // orbiting rune
      const a2 = t * TAU;
      glowOrb(cx + Math.cos(a2) * S * 0.16, gy - S * 0.62 + Math.sin(a2) * S * 0.05, S * 0.028, '#c9a2ff');
      glowOrb(cx, gy - S * 0.42, S * 0.035, '#a078f0');
      ctx.strokeStyle = rgba('#c9a2ff', 0.5); ctx.lineWidth = 1.5;
      ell(ctx, cx, gy - S * 0.62, S * 0.17, S * 0.055, null, rgba('#c9a2ff', 0.5), 1.5);
      break;
    }
    case 'barracks': {
      base('#7a7060', '#544c40');
      // tent + flag + sword rack
      poly(ctx, [[cx - S * 0.3, gy - S * 0.14], [cx, gy - S * 0.52], [cx + S * 0.3, gy - S * 0.14]], vgrad(ctx, 0, gy - S * 0.5, gy - S * 0.14, '#a08a5a', '#6a5636'), '#3c2e1a', 2);
      poly(ctx, [[cx - S * 0.08, gy - S * 0.14], [cx, gy - S * 0.42], [cx + S * 0.08, gy - S * 0.14]], '#2c2214');
      ctx.strokeStyle = '#c8b888'; ctx.lineWidth = 2;
      ctx.beginPath(); ctx.moveTo(cx, gy - S * 0.52); ctx.lineTo(cx, gy - S * 0.68); ctx.stroke();
      const fw = Math.sin(t * TAU * 1.2) * S * 0.02;
      poly(ctx, [[cx, gy - S * 0.68], [cx + S * 0.14 + fw, gy - S * 0.64], [cx, gy - S * 0.58]], '#c8452a', '#7a2412', 1);
      // sword + shield leaning
      ctx.save(); ctx.translate(cx - S * 0.3, gy - S * 0.16); ctx.rotate(-0.5);
      rrect(ctx, -S * 0.012, -S * 0.22, S * 0.024, S * 0.24, 1, '#cfd6e4', '#6a7080', 1);
      ctx.restore();
      ell(ctx, cx + S * 0.28, gy - S * 0.22, S * 0.07, S * 0.09, '#8a5a2a', '#4a2c12', 1.5);
      ell(ctx, cx + S * 0.28, gy - S * 0.22, S * 0.03, S * 0.04, '#c89a4a');
      break;
    }
    case 'wolf': {
      base('#5a5a52', '#3c3c34');
      // cave den with glowing eyes
      poly(ctx, [[cx - S * 0.28, gy - S * 0.14], [cx - S * 0.2, gy - S * 0.46], [cx, gy - S * 0.56], [cx + S * 0.2, gy - S * 0.46], [cx + S * 0.28, gy - S * 0.14]], vgrad(ctx, 0, gy - S * 0.56, gy - S * 0.14, '#6a645a', '#3a362e'), '#201c16', 2);
      ell(ctx, cx, gy - S * 0.24, S * 0.14, S * 0.12, '#14100c');
      const blink = Math.sin(t * TAU * 0.9) > 0 ? 1 : 0.3;
      eyesGlow(ctx, cx - S * 0.05, gy - S * 0.26, S * 0.016 * blink + 0.5, '#ffd23a');
      eyesGlow(ctx, cx + S * 0.05, gy - S * 0.26, S * 0.016 * blink + 0.5, '#ffd23a');
      // bones
      ctx.strokeStyle = '#d8d0bc'; ctx.lineWidth = 2.5;
      ctx.beginPath(); ctx.moveTo(cx - S * 0.3, gy - S * 0.06); ctx.lineTo(cx - S * 0.2, gy - S * 0.09); ctx.stroke();
      ell(ctx, cx - S * 0.31, gy - S * 0.055, 2.5, 2.5, '#d8d0bc'); ell(ctx, cx - S * 0.19, gy - S * 0.095, 2.5, 2.5, '#d8d0bc');
      break;
    }
    case 'blossom': {
      base('#5a6a48', '#3c4a30');
      // giant poisonous flower
      ctx.strokeStyle = '#3c6a28'; ctx.lineWidth = S * 0.035;
      ctx.beginPath(); ctx.moveTo(cx, gy - S * 0.14); ctx.quadraticCurveTo(cx + S * 0.04, gy - S * 0.34, cx, gy - S * 0.48); ctx.stroke();
      poly(ctx, [[cx, gy - S * 0.3], [cx - S * 0.14, gy - S * 0.36], [cx - S * 0.1, gy - S * 0.28]], '#4a8a30', '#2a5018', 1);
      poly(ctx, [[cx, gy - S * 0.36], [cx + S * 0.15, gy - S * 0.4], [cx + S * 0.1, gy - S * 0.32]], '#4a8a30', '#2a5018', 1);
      const fy = gy - S * 0.56, pr = S * 0.075;
      ctx.save(); ctx.translate(cx, fy); ctx.rotate(Math.sin(t * TAU * 0.5) * 0.08);
      ctx.shadowColor = '#b06af0'; ctx.shadowBlur = 8;
      for (let i = 0; i < 6; i++) {
        ctx.rotate(TAU / 6);
        ell(ctx, 0, -pr * 1.5, pr * 0.62, pr * 1.05, i % 2 ? '#c07af8' : '#a05ae0', '#5a2a8a', 1.5);
      }
      ell(ctx, 0, 0, pr * 0.8, pr * 0.8, vgrad(ctx, 0, -pr, pr, '#ffe08a', '#e0a020'), '#8a5a10', 1.5);
      ctx.restore();
      // poison drips
      const dp = (t * 0.5) % 1;
      ell(ctx, cx + S * 0.05, fy + pr + dp * S * 0.2, S * 0.012 * (1 - dp * 0.5), S * 0.016 * (1 - dp * 0.5), rgba('#7dff5a', 0.8 - dp * 0.6));
      break;
    }
    case 'bamboo': {
      base('#6a7050', '#484c34');
      // bamboo stalks
      for (let i = 0; i < 4; i++) {
        const bx = cx - S * 0.21 + i * S * 0.14, bh = S * (0.5 + (i % 2) * 0.16), sw = Math.sin(t * TAU * 0.8 + i) * S * 0.01;
        ctx.strokeStyle = i % 2 ? '#5a9a3a' : '#4a8a2c'; ctx.lineWidth = S * 0.05;
        ctx.beginPath(); ctx.moveTo(bx, gy - S * 0.12); ctx.quadraticCurveTo(bx + sw, gy - bh * 0.6, bx + sw * 2.4, gy - bh - S * 0.1); ctx.stroke();
        for (let n = 1; n <= 3; n++) {
          const ny = gy - S * 0.12 - bh * n / 3.4;
          ctx.strokeStyle = '#2c5018'; ctx.lineWidth = 2;
          ctx.beginPath(); ctx.moveTo(bx + sw * n * 0.6 - S * 0.03, ny); ctx.lineTo(bx + sw * n * 0.6 + S * 0.03, ny); ctx.stroke();
        }
        // leaves
        poly(ctx, [[bx + sw * 2.4, gy - bh - S * 0.1], [bx + sw * 2.4 + S * 0.1, gy - bh - S * 0.16], [bx + sw * 2.4 + S * 0.04, gy - bh - S * 0.08]], '#6ab84a', null);
      }
      break;
    }
    case 'nun': {
      base('#8a8494', '#5c566a');
      // chapel shrine
      poly(ctx, [[cx - S * 0.22, gy - S * 0.14], [cx - S * 0.22, gy - S * 0.42], [cx, gy - S * 0.58], [cx + S * 0.22, gy - S * 0.42], [cx + S * 0.22, gy - S * 0.14]], vgrad(ctx, 0, gy - S * 0.58, gy - S * 0.14, '#e8e0f0', '#b8aac8'), '#6a5a7a', 2);
      rrect(ctx, cx - S * 0.07, gy - S * 0.3, S * 0.14, S * 0.16, S * 0.07, '#5a4a6a', '#3a2c4a', 1.5);
      // cross + halo glow
      const pulse = 0.7 + Math.sin(t * TAU) * 0.3;
      ctx.save(); ctx.shadowColor = '#ffe9a8'; ctx.shadowBlur = 12 * pulse;
      rrect(ctx, cx - S * 0.015, gy - S * 0.52, S * 0.03, S * 0.12, 1, '#ffd966');
      rrect(ctx, cx - S * 0.05, gy - S * 0.49, S * 0.1, S * 0.03, 1, '#ffd966');
      ctx.restore();
      // praying nun figure
      ell(ctx, cx + S * 0.26, gy - S * 0.18, S * 0.055, S * 0.08, '#3a3a5a', '#1c1c30', 1.5);
      ell(ctx, cx + S * 0.26, gy - S * 0.29, S * 0.04, S * 0.04, '#e8c8a8', '#8a6a4a', 1);
      poly(ctx, [[cx + S * 0.22, gy - S * 0.32], [cx + S * 0.26, gy - S * 0.37], [cx + S * 0.3, gy - S * 0.32]], '#2a2a44', null);
      break;
    }
    case 'orchid': {
      base('#6a6a78', '#484854');
      // elegant orchid in golden pot
      poly(ctx, [[cx - S * 0.12, gy - S * 0.14], [cx - S * 0.09, gy - S * 0.26], [cx + S * 0.09, gy - S * 0.26], [cx + S * 0.12, gy - S * 0.14]], vgrad(ctx, 0, gy - S * 0.26, gy, '#e0a520', '#a87b1e'), '#6b4a10', 2);
      ctx.strokeStyle = '#3c8a3c'; ctx.lineWidth = S * 0.025;
      ctx.beginPath(); ctx.moveTo(cx, gy - S * 0.26); ctx.quadraticCurveTo(cx + S * 0.1, gy - S * 0.44, cx + S * 0.02, gy - S * 0.6); ctx.stroke();
      const sway = Math.sin(t * TAU * 0.6);
      [[0.02, 0.6, '#ff8ad8'], [-0.08, 0.48, '#ffa8e0'], [0.12, 0.5, '#ff7ad0']].forEach(([ox, oy, c], i) => {
        const fx = cx + ox * S + sway * 2, fy = gy - oy * S;
        ctx.save(); ctx.translate(fx, fy); ctx.rotate(sway * 0.1 + i);
        ctx.shadowColor = c; ctx.shadowBlur = 8;
        for (let p2 = 0; p2 < 5; p2++) { ctx.rotate(TAU / 5); ell(ctx, 0, -S * 0.035, S * 0.022, S * 0.038, c, shade(c, -0.3), 1); }
        ell(ctx, 0, 0, S * 0.016, S * 0.016, '#ffe08a');
        ctx.restore();
      });
      // sparkle aura
      const sp = (t * 0.7) % 1;
      glowOrb(cx + Math.sin(sp * TAU) * S * 0.2, gy - S * 0.4 - sp * S * 0.15, S * 0.012, '#ffb8e8');
      break;
    }
    case 'assassin': {
      base('#4a4258', '#302a3c');
      // dark tent with hanging blades
      poly(ctx, [[cx - S * 0.24, gy - S * 0.14], [cx - S * 0.16, gy - S * 0.48], [cx + S * 0.16, gy - S * 0.48], [cx + S * 0.24, gy - S * 0.14]], vgrad(ctx, 0, gy - S * 0.48, gy, '#3a2c50', '#1c1428'), '#0d0a14', 2);
      poly(ctx, [[cx - S * 0.18, gy - S * 0.48], [cx, gy - S * 0.62], [cx + S * 0.18, gy - S * 0.48]], '#241a38', '#0d0a14', 2);
      // hooded eyes in darkness
      const flick = Math.sin(t * TAU * 1.4) > -0.3 ? 1 : 0;
      if (flick) {
        eyesGlow(ctx, cx - S * 0.045, gy - S * 0.32, S * 0.016, '#ff4a6a');
        eyesGlow(ctx, cx + S * 0.045, gy - S * 0.32, S * 0.016, '#ff4a6a');
      }
      // crossed daggers
      ctx.save(); ctx.translate(cx + S * 0.26, gy - S * 0.3); ctx.rotate(0.6);
      poly(ctx, [[0, 0], [S * 0.02, -S * 0.16], [-S * 0.02, -S * 0.16]], '#cfd6e4', '#6a7080', 1);
      ctx.restore();
      ctx.save(); ctx.translate(cx + S * 0.26, gy - S * 0.3); ctx.rotate(-0.6);
      poly(ctx, [[0, 0], [S * 0.02, -S * 0.16], [-S * 0.02, -S * 0.16]], '#cfd6e4', '#6a7080', 1);
      ctx.restore();
      break;
    }
    case 'lightning': {
      base('#5a6488', '#3c4460');
      // tesla coil
      rrect(ctx, cx - S * 0.07, gy - S * 0.5, S * 0.14, S * 0.38, 3, vgrad(ctx, cx - S * 0.07, 0, cx + S * 0.07, '#8a92b8', '#4a5070'), '#2c3048', 2);
      for (let i = 0; i < 4; i++) {
        ell(ctx, cx, gy - S * 0.2 - i * S * 0.09, S * 0.11 - i * S * 0.015, S * 0.025, '#c8a24a', '#6b4a10', 1.5);
      }
      // sphere with arcs
      const sy = gy - S * 0.58;
      glowOrb(cx, sy, S * 0.055, '#8fd8ff');
      ctx.save(); ctx.shadowColor = '#8fd8ff'; ctx.shadowBlur = 6;
      ctx.strokeStyle = '#d8f0ff'; ctx.lineWidth = 1.6;
      for (let i = 0; i < 3; i++) {
        const a = t * TAU * 2 + i * 2.1;
        ctx.beginPath(); ctx.moveTo(cx, sy);
        ctx.lineTo(cx + Math.cos(a) * S * 0.09, sy + Math.sin(a) * S * 0.07);
        ctx.lineTo(cx + Math.cos(a + 0.4) * S * 0.14, sy + Math.sin(a + 0.4) * S * 0.11);
        ctx.stroke();
      }
      ctx.restore();
      break;
    }
    case 'sniper': {
      base('#7a7060', '#544c40');
      // hawk nest tower
      rrect(ctx, cx - S * 0.1, gy - S * 0.52, S * 0.2, S * 0.4, 2, vgrad(ctx, cx - S * 0.1, 0, cx + S * 0.1, '#8a7050', '#5a4430'), '#33241a', 2);
      poly(ctx, [[cx - S * 0.2, gy - S * 0.52], [cx, gy - S * 0.66], [cx + S * 0.2, gy - S * 0.52]], '#6a4a30', '#33241a', 2);
      // hawk with rifle
      const hky = gy - S * 0.56;
      ell(ctx, cx, hky, S * 0.09, S * 0.07, '#8a5a3a', '#4a2c14', 1.5);
      ell(ctx, cx + S * 0.07, hky - S * 0.05, S * 0.05, S * 0.045, '#a06a42', '#4a2c14', 1.5);
      poly(ctx, [[cx + S * 0.11, hky - S * 0.05], [cx + S * 0.17, hky - S * 0.035], [cx + S * 0.11, hky - S * 0.02]], '#e0a020');
      eyesGlow(ctx, cx + S * 0.09, hky - S * 0.06, S * 0.012, '#ffd23a');
      ctx.save(); ctx.translate(cx + S * 0.02, hky - S * 0.01); ctx.rotate(-0.35 + Math.sin(t * 2) * 0.02);
      rrect(ctx, 0, -S * 0.015, S * 0.24, S * 0.03, 2, '#3a4050', '#14161e', 1);
      ell(ctx, S * 0.16, -S * 0.03, S * 0.02, S * 0.015, '#8fd8ff');
      ctx.restore();
      break;
    }
    case 'chrys': {
      base('#8a7a50', '#5c5034');
      // golden chrysanthemum
      ctx.strokeStyle = '#3c8a3c'; ctx.lineWidth = S * 0.03;
      ctx.beginPath(); ctx.moveTo(cx, gy - S * 0.14); ctx.lineTo(cx, gy - S * 0.42); ctx.stroke();
      poly(ctx, [[cx, gy - S * 0.3], [cx - S * 0.12, gy - S * 0.34], [cx - S * 0.08, gy - S * 0.26]], '#4a9a30', null);
      const fy = gy - S * 0.52, rot = t * 0.4;
      ctx.save(); ctx.translate(cx, fy); ctx.rotate(rot);
      ctx.shadowColor = '#ffd966'; ctx.shadowBlur = 14;
      for (let layer = 0; layer < 2; layer++) {
        for (let i = 0; i < 10; i++) {
          ctx.rotate(TAU / 10);
          ell(ctx, 0, -S * (layer ? 0.06 : 0.1), S * 0.02, S * (layer ? 0.05 : 0.075), layer ? '#ffe9a8' : '#ffd966', '#a87b1e', 1);
        }
      }
      ell(ctx, 0, 0, S * 0.04, S * 0.04, vgrad(ctx, 0, -S * 0.04, S * 0.04, '#fff4c8', '#e0a520'), '#8a5a10', 1.5);
      ctx.restore();
      // gold sparkles
      for (let i = 0; i < 3; i++) {
        const sp2 = ((t * 0.4 + i * 0.33) % 1);
        glowOrb(cx + Math.sin(sp2 * TAU + i * 2) * S * 0.16, fy - sp2 * S * 0.14, S * 0.014 * (1 - sp2 * 0.6), '#ffe08a');
      }
      break;
    }
    case 'magma': {
      base('#5a4440', '#3c2c28');
      // forge with crucible
      poly(ctx, [[cx - S * 0.26, gy - S * 0.14], [cx - S * 0.2, gy - S * 0.44], [cx + S * 0.2, gy - S * 0.44], [cx + S * 0.26, gy - S * 0.14]], vgrad(ctx, 0, gy - S * 0.44, gy, '#6a4a40', '#3a2420'), '#1c100c', 2);
      ell(ctx, cx, gy - S * 0.44, S * 0.2, S * 0.06, '#2c1a14', '#140a08', 2);
      const bub = Math.sin(t * TAU * 1.3) * 0.5 + 0.5;
      ctx.save(); ctx.shadowColor = '#ff7a3a'; ctx.shadowBlur = 14 + bub * 8;
      ell(ctx, cx, gy - S * 0.44, S * 0.15, S * 0.042, vgrad(ctx, 0, gy - S * 0.48, gy - S * 0.4, '#ffe08a', '#f05a1a'));
      ctx.restore();
      // bubble
      ell(ctx, cx + S * 0.05, gy - S * 0.47 - bub * S * 0.02, S * 0.018 * (1.2 - bub * 0.5), S * 0.014, '#ffb04a');
      // chimney smoke glow + tongs
      ctx.strokeStyle = '#c8452a'; ctx.lineWidth = 3;
      ctx.beginPath(); ctx.moveTo(cx + S * 0.24, gy - S * 0.3); ctx.lineTo(cx + S * 0.32, gy - S * 0.44); ctx.stroke();
      break;
    }
    case 'holynova': {
      base('#8a8494', '#5c566a');
      // floating halo monument
      const fy = gy - S * 0.44 + Math.sin(t * TAU * 0.8) * S * 0.015;
      poly(ctx, [[cx - S * 0.1, gy - S * 0.14], [cx - S * 0.07, fy], [cx + S * 0.07, fy], [cx + S * 0.1, gy - S * 0.14]], vgrad(ctx, 0, fy, gy, '#f0e8f8', '#b8a8c8'), '#7a6a8a', 2);
      ctx.save(); ctx.translate(cx, fy - S * 0.14);
      ctx.rotate(t * 1.2);
      ctx.shadowColor = '#ffe9a8'; ctx.shadowBlur = 16;
      ell(ctx, 0, 0, S * 0.13, S * 0.13, null, '#ffd966', 3);
      ctx.rotate(0.8);
      ell(ctx, 0, 0, S * 0.09, S * 0.09, null, rgba('#ffffff', 0.8), 2);
      ctx.restore();
      glowOrb(cx, fy - S * 0.14, S * 0.03, '#fff4c8');
      // runes on pillar
      ctx.fillStyle = rgba('#ffd966', 0.7);
      [[0, 0.1], [0, 0.2], [0, 0.3]].forEach(([ox, oy]) => ctx.fillRect(cx - S * 0.012 + ox, gy - S * 0.18 - oy * S * 0.6 + S * 0.14, S * 0.024, S * 0.012));
      break;
    }
    case 'storm': {
      base('#4a5478', '#303854');
      // storm totem with floating shards
      poly(ctx, [[cx - S * 0.13, gy - S * 0.14], [cx - S * 0.08, gy - S * 0.5], [cx + S * 0.08, gy - S * 0.5], [cx + S * 0.13, gy - S * 0.14]], vgrad(ctx, 0, gy - S * 0.5, gy, '#5a6498', '#2c3454'), '#141a30', 2);
      // lightning bolt emblem
      ctx.save(); ctx.shadowColor = '#8fd8ff'; ctx.shadowBlur = 8;
      poly(ctx, [[cx + S * 0.01, gy - S * 0.44], [cx - S * 0.05, gy - S * 0.3], [cx, gy - S * 0.3], [cx - S * 0.03, gy - S * 0.18], [cx + S * 0.06, gy - S * 0.34], [cx + S * 0.01, gy - S * 0.34]], '#ffe9a8', '#c8a24a', 1);
      ctx.restore();
      // floating charged shards
      for (let i = 0; i < 3; i++) {
        const a = t * TAU * 0.6 + i * TAU / 3;
        const sx = cx + Math.cos(a) * S * 0.2, sy = gy - S * 0.58 + Math.sin(a) * S * 0.06;
        ctx.save(); ctx.translate(sx, sy); ctx.rotate(a * 2);
        ctx.shadowColor = '#8fd8ff'; ctx.shadowBlur = 8;
        poly(ctx, [[0, -S * 0.04], [S * 0.02, 0], [0, S * 0.04], [-S * 0.02, 0]], '#a8e0ff', '#4a90d8', 1);
        ctx.restore();
      }
      break;
    }
    case 'void': {
      base('#3a2c50', '#241a34');
      // void portal
      ctx.save(); ctx.translate(cx, gy - S * 0.36);
      poly(ctx, [[-S * 0.2, S * 0.22], [-S * 0.24, -S * 0.1], [-S * 0.12, -S * 0.26], [S * 0.12, -S * 0.26], [S * 0.24, -S * 0.1], [S * 0.2, S * 0.22]], '#2c2044', '#140c22', 2);
      const pr = S * 0.13;
      ctx.shadowColor = '#c05af0'; ctx.shadowBlur = 18;
      ell(ctx, 0, 0, pr, pr * 1.15, vgrad(ctx, 0, -pr, pr, '#1a0c28', '#3a1454'));
      ctx.restore();
      // swirling ring
      ctx.save(); ctx.translate(cx, gy - S * 0.36); ctx.rotate(-t * 2.4);
      ctx.strokeStyle = rgba('#c05af0', 0.8); ctx.lineWidth = 2.5;
      ctx.shadowColor = '#c05af0'; ctx.shadowBlur = 10;
      ctx.beginPath(); ctx.ellipse(0, 0, S * 0.155, S * 0.175, 0, 0.4, TAU - 0.4); ctx.stroke();
      ctx.restore();
      // particles sucked in
      for (let i = 0; i < 3; i++) {
        const sp2 = ((t * 0.8 + i * 0.33) % 1);
        const r2 = S * 0.25 * (1 - sp2);
        const a2 = sp2 * TAU * 2 + i * 2;
        glowOrb(cx + Math.cos(a2) * r2, gy - S * 0.36 + Math.sin(a2) * r2 * 0.8, S * 0.012 * sp2 + 1, '#e0a0ff');
      }
      break;
    }
  }
}

// ============================================================
// SPRITE DEFINITIONS
// kind: hum|beast|fly|blob|ghost|con|plant|serp|scorp|krak|tower
// ============================================================
export const SPRITE_DEFS = {
  // ---- enemies ----
  goblin: { kind: 'hum', p: { skin: '#6aa84a', armor: '#7a5a3a', armor2: '#5a3c22', cloth: '#6a4a2c', weapon: 'dagger', weaponColor: '#cfd6e4', eye: '#ffd23a', ears: 'pointy' } },
  wolf: { kind: 'beast', p: { fur: '#6a6470', fur2: '#8a8494', belly: '#b8b0c0', eye: '#ffd23a', ears: 'pointy', mane: '#4a4450' } },
  orc: { kind: 'hum', p: { skin: '#5a8a3a', armor: '#7d8494', armor2: '#5a4a30', cloth: '#4a3a28', helm: '#8a92a4', weapon: 'bigsword', weaponColor: '#a8b0c0', eye: '#ff8a4a', big: true, horns: true, hornColor: '#d8c8a0', tuskFace: true } },
  shaman: { kind: 'hum', p: { skin: '#6aa84a', armor: '#a04a8a', cloth: '#7a2a6a', weapon: 'staff', weaponColor: '#7dff5a', eye: '#ff5ae0', hat: '#8a2a7a', hatBand: '#ffd966', hood: null } },
  harpy: { kind: 'fly', p: { body: '#c88a5a', belly: '#e8c8a0', wing: { type: 'feather', color: '#a05a3a' }, eye: '#ffd23a', beak: '#e0a020', crest: '#8a3a2a', feet: '#c8903a' } },
  batswarm: { kind: 'fly', p: { body: '#3a2c50', belly: '#5a4a70', wing: { type: 'bat', color: '#241a38' }, eye: '#ff5a4a', big: false } },
  golem: { kind: 'con', p: { rock: '#8a8494', glow: '#8fd8ff', eye: '#8fd8ff', id: 'golem', big: true } },
  rockling: { kind: 'con', p: { rock: '#9a94a4', glow: '#8fd8ff', id: 'rockling' } },
  slime: { kind: 'blob', p: { body: '#7dc8f0', core: '#4a90d8', glow: '#8fd8ff', mouth: true } },
  minislime: { kind: 'blob', p: { body: '#9ad8ff', core: '#5aa0e8', mouth: true } },
  wraith: { kind: 'ghost', p: { body: '#7a6ab8', fade: '#3a2c68', glow: '#a08cf0', eye: '#7dffb0', alpha: 0.9 } },
  troll: { kind: 'hum', p: { skin: '#4a9a5a', armor: '#5a7a4a', armor2: '#3c5230', cloth: '#4a5a30', weapon: 'hammer', weaponColor: '#7a5a3a', eye: '#ffd23a', big: true, horns: true, hornColor: '#c8b890', mouth: true } },
  necro: { kind: 'hum', p: { skin: '#b8b0c8', armor: '#2c2440', cloth: '#1c1430', weapon: 'staff', weaponColor: '#7dff5a', eye: '#7dffb0', hood: '#241a38', skull: false, floaty: true } },
  skeleton: { kind: 'hum', p: { skin: '#d8d0bc', armor: '#b8b09a', cloth: '#8a8272', weapon: 'dagger', weaponColor: '#d8d0bc', eye: '#7dffb0', skull: true } },
  imp: { kind: 'hum', p: { skin: '#d85a8a', armor: '#8a2a5a', cloth: '#5a1a3a', weapon: 'wand', weaponColor: '#c05af0', eye: '#ffe04a', horns: true, hornColor: '#3a1a2a', mouth: true } },
  warlock: { kind: 'hum', p: { skin: '#c8a888', armor: '#3a2c68', armor2: '#241a44', cloth: '#2c2050', weapon: 'tome', weaponColor: '#c05af0', eye: '#c05af0', hood: '#31245c' } },
  wyvern: { kind: 'fly', p: { body: '#5a7a4a', belly: '#c8d8a0', wing: { type: 'bat', color: '#3a5230' }, eye: '#ffd23a', horn: '#d8c8a0', big: true } },
  cultist: { kind: 'hum', p: { skin: '#b8a8c8', armor: '#4a1c2c', cloth: '#30101c', weapon: 'wand', weaponColor: '#ff5a6a', eye: '#ff3a4a', hood: '#3c1424' } },
  siege: { kind: 'con', p: { rock: '#7a5a4a', glow: '#ff7a3a', eye: '#ff7a3a', id: 'siege', big: true } },
  darkblade: { kind: 'hum', p: { skin: '#8a7a9a', armor: '#241a38', armor2: '#14101f', cloth: '#1c1430', weapon: 'sword', weaponColor: '#c05af0', eye: '#ff4a6a', hood: '#241a38', cape: '#301040' } },
  shieldbearer: { kind: 'hum', p: { skin: '#c8a888', armor: '#8a92a4', armor2: '#5d6474', cloth: '#4a5060', helm: '#a8b0c0', shield: '#c8452a', weapon: 'sword', weaponColor: '#cfd6e4', eye: '#8fd8ff', big: true } },
  voidling: { kind: 'ghost', p: { body: '#c05af0', fade: '#5a1a8a', glow: '#e0a0ff', eye: '#ffffff', horns: true, alpha: 0.85 } },
  prism: { kind: 'con', p: { rock: '#a8b8e8', glow: '#c9a2ff', eye: '#ffffff', crystal: '#ff8ad8', id: 'prism' } },
  obelisk: { kind: 'con', p: { rock: '#c8b878', glow: '#ffd966', eye: '#ffd966', id: 'obelisk', rings: true } },
  treantling: { kind: 'plant', p: { bark: '#6a4a30', canopy: '#4a8a30', leaves: '#5aa83a', eye: '#ffe08a', flowers: '#ff8ad8' } },
  hydrahead: { kind: 'serp', p: { body: '#4a8a6a', belly: '#a8d8b8', eye: '#ffe04a', horns: '#d8c8a0', heads: 1 } },
  solusmirage: { kind: 'ghost', p: { body: '#8fb8ff', fade: '#3a5aa8', glow: '#cfe0ff', eye: '#ffffff', alpha: 0.7 } },
  // ---- heroes ----
  arthur: { kind: 'hum', p: { skin: '#e8c8a8', armor: '#4a78c8', armor2: '#c8a24a', cloth: '#2c4a8a', helm: '#5a8ad8', plume: '#f0564a', shield: '#c8452a', weapon: 'sword', weaponColor: '#e8f0ff', eye: '#8fd8ff', cape: '#2c4a8a', emblem: '#ffd966', big: true } },
  luna: { kind: 'hum', p: { skin: '#f0d8c0', armor: '#6a5aa8', armor2: '#c9a2ff', cloth: '#4a3a88', weapon: 'staff', weaponColor: '#8fd8ff', eye: '#cfe0ff', hat: '#5a4a98', hatBand: '#cfe0ff', hair: '#cfe0ff', cape: '#3a2c78' } },
  rin: { kind: 'hum', p: { skin: '#e8c8a8', armor: '#2c2440', armor2: '#f0564a', cloth: '#1c1430', weapon: 'dagger', weaponColor: '#cfd6e4', eye: '#ff8a9a', hood: '#241a38', hair: '#2c2440' } },
  marco: { kind: 'hum', p: { skin: '#e8c8a8', armor: '#e8e0d0', armor2: '#c8a24a', cloth: '#d8ccb0', weapon: 'tome', weaponColor: '#ffd966', eye: '#ffe9a8', halo: '#ffe9a8', mouth: true } },
  sylph: { kind: 'hum', p: { skin: '#f0d8c0', armor: '#3a8a4a', armor2: '#c8a24a', cloth: '#2c6a3a', weapon: 'bow', weaponColor: '#8a5a30', eye: '#7dff8a', hair: '#e8a84a', cape: '#2c6a3a' } },
  grimm: { kind: 'hum', p: { skin: '#c8b0c8', armor: '#1c1428', armor2: '#8a2a4a', cloth: '#14101f', weapon: 'dagger', weaponColor: '#ff4a6a', eye: '#ff3a5a', hood: '#1c1428', cape: '#2a0c1c' } },
  terra: { kind: 'hum', p: { skin: '#d8b898', armor: '#8a6a4a', armor2: '#5a9a3a', cloth: '#6a4a30', weapon: 'staff', weaponColor: '#a8e06a', eye: '#a8e06a', hair: '#5a3a20', big: true } },
  aria: { kind: 'hum', p: { skin: '#f0d8c0', armor: '#d85a8a', armor2: '#ffd966', cloth: '#a83a6a', weapon: 'note', weaponColor: '#ffd966', eye: '#ff8ad8', hair: '#ff8ad8', cape: '#a83a6a', halo: '#ffd966' } },
  ember: { kind: 'hum', p: { skin: '#e8b898', armor: '#8a3a2a', armor2: '#e0a520', cloth: '#5a2418', helm: '#a04a2a', plume: '#ff9a3a', weapon: 'flameblade', weaponColor: '#ff7a3a', eye: '#ffb04a', cape: '#7a2412', emblem: '#ffd966', big: true } },
  volt: { kind: 'hum', p: { skin: '#e8c8a8', armor: '#3a5aa8', armor2: '#8fd8ff', cloth: '#2c4488', weapon: 'wand', weaponColor: '#8fd8ff', eye: '#8fd8ff', hair: '#3a4a6a', hat: '#2c4488', hatBand: '#8fd8ff' } },
  leo: { kind: 'hum', p: { skin: '#e8c8a8', armor: '#e0a520', armor2: '#fff4c8', cloth: '#a87b1e', helm: '#ffd966', plume: '#fff4c8', weapon: 'hammer', weaponColor: '#ffd966', eye: '#ffe08a', cape: '#c8452a', crown: true, emblem: '#fff4c8', big: true } },
  freya: { kind: 'hum', p: { skin: '#f0dcc8', armor: '#cfd8e8', armor2: '#ffd966', cloth: '#8aa8d8', helm: '#e8f0ff', plume: '#8fd8ff', weapon: 'spear', weaponColor: '#ffe9a8', eye: '#8fd8ff', wings: { type: 'feather', color: '#f0f4ff' }, cape: '#5a8ad8', halo: '#cfe0ff', big: true } },
  nyx: { kind: 'hum', p: { skin: '#c8b8d8', armor: '#241a38', armor2: '#c05af0', cloth: '#18102a', weapon: 'scythe', weaponColor: '#e0a0ff', eye: '#c05af0', crown: true, cape: '#2a1044', hair: '#c05af0' } },
  // ---- soldiers & summons ----
  soldier: { kind: 'hum', p: { skin: '#e8c8a8', armor: '#4a78c8', armor2: '#c8a24a', cloth: '#2c4a8a', helm: '#5a8ad8', shield: '#8a92a4', weapon: 'sword', weaponColor: '#cfd6e4', eye: '#8fd8ff' } },
  wolfpup: { kind: 'beast', p: { fur: '#7a94b8', fur2: '#9ab4d8', belly: '#cfe0f0', eye: '#8fd8ff', ears: 'pointy' } },
  golemguard: { kind: 'con', p: { rock: '#8aa06a', glow: '#a8e06a', eye: '#a8e06a', id: 'golemg', big: true } },
  // ---- bosses ----
  boss_grulk: { kind: 'beast', p: { fur: '#8a5a4a', fur2: '#a87a5a', belly: '#c89a7a', eye: '#ff5a3a', tusks: true, mane: '#5a3428', spike: '#6a4a3a', big: true } },
  boss_ironback: { kind: 'beast', p: { fur: '#4a4450', fur2: '#6a6470', belly: '#8a8494', eye: '#ffd23a', ears: 'pointy', mane: '#2c2833', spike: '#b8c0d0', big: true } },
  boss_vizier: { kind: 'scorp', p: { body: '#c89a3a', belly: '#e8c878', venom: '#7dff5a', eye: '#ff3a2a' } },
  boss_amenhotep: { kind: 'hum', p: { skin: '#c8a86a', armor: '#3a5ad8', armor2: '#ffd966', cloth: '#e8e0d0', nemes: '#3a5ad8', nemesStripe: '#ffd966', weapon: 'staff', weaponColor: '#ffd966', eye: '#8fd8ff', cape: '#2c4ac8', emblem: '#ffd966', big: true } },
  boss_yeti: { kind: 'hum', p: { skin: '#dce8f4', armor: '#b8d0e8', armor2: '#8aa8c8', cloth: '#a8c0d8', weapon: 'fist', weaponColor: '#e8f4ff', eye: '#5aa8ff', horns: true, hornColor: '#bfe0f8', mouth: true, big: true, hair: '#f0f8ff' } },
  boss_siva: { kind: 'hum', p: { skin: '#e8f4ff', armor: '#7dc8f0', armor2: '#e8f8ff', cloth: '#4a90d8', weapon: 'wand', weaponColor: '#cfeaff', eye: '#5aa8ff', crown: true, wings: { type: 'energy', color: '#8fd8ff' }, cape: '#5aa8e8', hair: '#cfeaff' } },
  boss_treant: { kind: 'plant', p: { bark: '#5a4028', canopy: '#3a7a28', leaves: '#4a9a30', eye: '#ffe08a', flowers: '#ff9a5c', big: true } },
  boss_morgana: { kind: 'hum', p: { skin: '#d8c8a8', armor: '#2c6a3a', armor2: '#a8e06a', cloth: '#1c4a28', weapon: 'staff', weaponColor: '#7dff5a', eye: '#7dff5a', hat: '#1c4a28', hatBand: '#a8e06a', cape: '#2c5a38', hair: '#7a4a2a' } },
  boss_hydra: { kind: 'serp', p: { body: '#3a7a5a', belly: '#8ac8a0', eye: '#ffe04a', horns: '#c8b890', frill: '#ff7a5a', aura: '#4ac88a', heads: 3 } },
  boss_kraken: { kind: 'krak', p: { body: '#4a3a6a', belly: '#7a6a9a', sucker: '#ff9a8a', eye: '#ff3a2a', glowSpots: '#8fd8ff' } },
  boss_colossus: { kind: 'con', p: { rock: '#5a3a30', glow: '#ff7a3a', eye: '#ffe04a', id: 'colossus', big: true } },
  boss_phoenix: { kind: 'fly', p: { body: '#f05a2a', belly: '#ffd966', wing: { type: 'energy', color: '#ff9a3a' }, eye: '#fff4c8', beak: '#ffd966', crest: '#ff5a2a', big: true } },
  boss_roc: { kind: 'fly', p: { body: '#5a6a9a', belly: '#c8d8f8', wing: { type: 'feather', color: '#3a4a7a' }, eye: '#8fd8ff', beak: '#e8d878', crest: '#8fd8ff', big: true } },
  boss_malakar: { kind: 'hum', p: { skin: '#b8a8c8', armor: '#241a38', armor2: '#8a2a4a', cloth: '#18102a', helm: '#30244a', weapon: 'scythe', weaponColor: '#ff5a8a', eye: '#ff3a5a', wings: { type: 'feather', color: '#1c1430' }, halo: '#ff5a8a', cape: '#2a0c1c', big: true, plume: null } },
  boss_reaper: { kind: 'ghost', p: { body: '#2c2440', fade: '#14101f', glow: '#7dffb0', eye: '#7dffb0', horns: true, alpha: 0.95 } },
  boss_leviathan: { kind: 'serp', p: { body: '#3a2c68', belly: '#8a6ac8', eye: '#c05af0', horns: '#c05af0', frill: '#5a3a9a', aura: '#c05af0', heads: 3 } },
  boss_runeprime: { kind: 'con', p: { rock: '#7a8ab8', glow: '#8fd8ff', eye: '#ffe04a', crystal: '#ffd966', rings: true, id: 'runeprime', big: true } },
  boss_solus: { kind: 'hum', p: { skin: '#e8d8c8', armor: '#4a3a88', armor2: '#c9a2ff', cloth: '#3a2c68', weapon: 'tome', weaponColor: '#c9a2ff', eye: '#cfe0ff', hat: '#31245c', hatBand: '#c9a2ff', halo: '#c9a2ff', cape: '#241a44', big: true, floaty: true } },
  boss_aurelion: { kind: 'hum', p: { skin: '#e8c8a8', armor: '#e0a520', armor2: '#fff4c8', cloth: '#a87b1e', helm: '#ffd966', plume: '#fff4c8', shield: '#ffd966', weapon: 'bigsword', weaponColor: '#fff4c8', eye: '#ffe08a', cape: '#c8452a', emblem: '#fff4c8', big: true, crown: true } },
  boss_midas: { kind: 'hum', p: { skin: '#e8b878', armor: '#ffd966', armor2: '#8a2a4a', cloth: '#a87b1e', weapon: 'hammer', weaponColor: '#ffd966', eye: '#ff3a5a', crown: true, cape: '#5a0c2c', horns: true, hornColor: '#ffd966', emblem: '#ff3a5a', big: true, halo: '#ffd966' } },
};

// towers are animated art (time param)
export const TOWER_IDS = ['thorn', 'icearrow', 'shuriken', 'bat', 'cannon', 'magic', 'barracks', 'wolf', 'blossom', 'bamboo', 'nun', 'orchid', 'assassin', 'lightning', 'sniper', 'chrys', 'magma', 'holynova', 'storm', 'void'];

// ---------- frame counts ----------
const FRAME_COUNT = { walk: 6, idle: 4, attack: 3, flap: 6 };

export function framesFor(id, pose) { return FRAME_COUNT[pose] || 1; }

// ---------- main sprite getter ----------
// Returns cached canvas for (id, pose, frame, size)
export function getSprite(id, pose = 'idle', frame = 0, size = 96) {
  const key = `${id}|${pose}|${frame}|${size}`;
  let c = cache.get(key);
  if (c) return c;
  c = mk(size);
  const ctx = c.getContext('2d');
  const nf = Math.max(1, FRAME_COUNT[pose] || 1);
  const t = (frame % nf) / nf;
  if (TOWER_IDS.includes(id)) {
    drawTowerArt(ctx, size, id, t);
  } else {
    const def = SPRITE_DEFS[id];
    if (!def) { // fallback orb
      ell(ctx, size / 2, size / 2, size * 0.3, size * 0.3, '#f0564a');
    } else {
      drawByKind(ctx, size, def, t, pose === 'flap' ? 'walk' : pose, id);
    }
  }
  cache.set(key, c);
  return c;
}

function drawByKind(ctx, S, def, t, pose, id) {
  switch (def.kind) {
    case 'hum': drawHumanoid(ctx, S, def.p, t, pose === 'walk' ? 'walk' : pose); break;
    case 'beast': drawBeast(ctx, S, def.p, t, pose); break;
    case 'fly': drawFlyer(ctx, S, def.p, t, pose); break;
    case 'blob': drawBlob(ctx, S, def.p, t, pose); break;
    case 'ghost': drawGhost(ctx, S, def.p, t, pose); break;
    case 'con': drawConstruct(ctx, S, { ...def.p, id }, t, pose); break;
    case 'plant': drawPlant(ctx, S, def.p, t, pose); break;
    case 'serp': drawSerpent(ctx, S, def.p, t, pose, def.p.heads || 3); break;
    case 'scorp': drawScorpion(ctx, S, def.p, t, pose); break;
    case 'krak': drawKraken(ctx, S, def.p, t, pose); break;
  }
}

// ---------- portraits (UI) ----------
export function portrait(id, size = 96, framed = false) {
  const key = `P|${id}|${size}|${framed ? 1 : 0}`;
  let c = cache.get(key);
  if (c) return c;
  c = mk(size);
  const ctx = c.getContext('2d');
  if (framed) {
    const g = ctx.createRadialGradient(size / 2, size * 0.4, size * 0.1, size / 2, size / 2, size * 0.7);
    g.addColorStop(0, '#332a5e'); g.addColorStop(1, '#191233');
    ctx.fillStyle = g; ctx.fillRect(0, 0, size, size);
  }
  const sp = getSprite(id, 'idle', 0, Math.round(size * 1.05));
  ctx.drawImage(sp, (size - sp.width) / 2, (size - sp.height) / 2 + size * 0.02);
  cache.set(key, c);
  return c;
}

// ---------- silhouette (hit flash tint) ----------
export function getSilhouette(id, pose = 'idle', frame = 0, size = 96, color = '#ffffff') {
  const key = `S|${id}|${pose}|${frame}|${size}|${color}`;
  let c = cache.get(key);
  if (c) return c;
  const sp = getSprite(id, pose, frame, size);
  c = mk(size);
  const ctx = c.getContext('2d');
  ctx.drawImage(sp, 0, 0);
  ctx.globalCompositeOperation = 'source-in';
  ctx.fillStyle = color;
  ctx.fillRect(0, 0, size, size);
  cache.set(key, c);
  return c;
}

// preload a set of sprites (call before battle)
export function preloadSprites(ids, poses = ['walk', 'idle', 'attack'], size = 96) {
  ids.forEach(id => poses.forEach(p => {
    const n = FRAME_COUNT[p] || 1;
    for (let f = 0; f < n; f++) getSprite(id, p, f, size);
  }));
}

export function clearSpriteCache() { cache.clear(); }
