// ============================================================
// GTDM summon — gacha screen, animated reveal, pity display
// ============================================================
import { el, clear, fmt, bus, TAU } from '../core/util.js';
import { t, tData } from '../core/i18n.js';
import { K, RARITY_COLOR, RARITY_IDX } from '../data/defs.js';
import { TOWER_MAP } from '../data/towers.js';
import { getSprite } from '../game/sprites.js';
import { sfx } from '../core/audio.js';
import * as ST from '../game/state.js';
import { featuredBanner, doPull, freePullAvailable, markFreePull, pityState } from '../game/gacha.js';
import { toast, rewardItemsHTML } from './modal.js';
import { artCanvas } from './widgets.js';
import { ico } from './icons.js';

export function renderSummon(scene) {
  clear(scene);
  const root = el('div', 'scene-root');
  scene.appendChild(root);
  const feat = featuredBanner();

  // ---------- stage with animated portal ----------
  const stage = el('div', 'summon-stage');
  const cv = document.createElement('canvas');
  stage.appendChild(cv);
  const info = el('div', 'banner-info');
  info.innerHTML = `
    <div class="banner-name">✦ ${t('gacha.title')} ✦</div>
    <div class="banner-feat">
      ${feat.towers.map(id => {
    const d = TOWER_MAP[id];
    return `<span class="feat-chip r-${d.rarity}" style="--rc:${RARITY_COLOR[d.rarity]}">${d.icon || '🗼'} ${tData(d, 'name')} UP!</span>`;
  }).join('')}
    </div>`;
  stage.appendChild(info);
  root.appendChild(stage);
  const stopPortal = paintPortal(cv);

  // ---------- pity ----------
  const pity = pityState();
  const pityRow = el('div', 'pity-row');
  pityRow.innerHTML = `
    <div class="pity-box">
      <div class="pb-l">💜 ${t('gacha.pity.rare')}</div>
      <div class="pb-track"><div class="pb-fill" style="width:${(pity.rare.cur / pity.rare.max) * 100}%"></div></div>
      <div class="pb-n">${t('gacha.pity.n', { a: pity.rare.cur, b: pity.rare.max })}</div>
    </div>
    <div class="pity-box">
      <div class="pb-l">🌟 ${t('gacha.pity.legend')}</div>
      <div class="pb-track"><div class="pb-fill" style="width:${(pity.legend.cur / pity.legend.max) * 100}%"></div></div>
      <div class="pb-n">${t('gacha.pity.n', { a: pity.legend.cur, b: pity.legend.max })}</div>
    </div>`;
  root.appendChild(pityRow);

  // ---------- rates note ----------
  root.insertAdjacentHTML('beforeend',
    `<div class="txt-xs txt-mut" style="text-align:center;margin:2px 0 10px">${t('gacha.std')} · ${t('gacha.guaranteed')}</div>`);

  // ---------- buttons ----------
  const btns = el('div', 'summon-btns');
  const canFree = freePullAvailable();
  const free = el('button', 'btn ' + (canFree ? 'btn-green' : ''));
  free.innerHTML = `<span class="sb-t">${t('gacha.free')}</span><span class="sb-c">${canFree ? 'FREE ✨' : t('common.claimed')}</span>`;
  free.disabled = !canFree;
  free.onclick = () => { if (!canFree) return; markFreePull(); runPull(1, feat, true); };
  btns.appendChild(free);

  const b1 = el('button', 'btn btn-purple');
  const useCard = ST.S.cur.card >= K.PULL_COST_CARD;
  b1.innerHTML = `<span class="sb-t">${t('gacha.x1')}</span><span class="sb-c">${useCard ? `${ico('card', 14)} ×${K.PULL_COST_CARD}` : `${ico('diamond', 14)} ${K.PULL1_COST_DIAMOND}`}</span>`;
  b1.onclick = () => {
    const cost = useCard ? { card: K.PULL_COST_CARD } : { diamond: K.PULL1_COST_DIAMOND };
    if (!ST.spendMany(cost)) { sfx.error(); toast(t('common.notenough'), 'bad', '💸'); return; }
    runPull(1, feat, false);
  };
  btns.appendChild(b1);

  const b10 = el('button', 'btn btn-gold');
  b10.innerHTML = `<span class="sb-t">${t('gacha.x10')}</span><span class="sb-c">${ico('diamond', 14)} ${K.PULL10_COST_DIAMOND}</span>`;
  b10.onclick = () => {
    if (!ST.spendMany({ diamond: K.PULL10_COST_DIAMOND })) { sfx.error(); toast(t('common.notenough'), 'bad', '💸'); return; }
    runPull(10, feat, false);
  };
  btns.appendChild(b10);
  root.appendChild(btns);

  root.insertAdjacentHTML('beforeend',
    `<div class="txt-xs txt-mut" style="text-align:center;margin-top:8px">${t('gacha.dupe', { n: '🎴 · 🌀 · ✦' })} ${t('cur.mileage')}</div>`);

  // cleanup portal animation when scene changes
  scene._cleanup = stopPortal;
}

function runPull(n, feat, free) {
  const { results, pityTriggered, dupeTotals } = doPull(n, feat);
  bus.emit('state');
  reveal(results, dupeTotals, pityTriggered);
}

// ============================================================
// REVEAL — full-screen card flip ceremony
// ============================================================
function reveal(results, dupeTotals, pityTriggered) {
  const layer = el('div', 'reveal-layer');
  document.body.appendChild(layer);
  const cv = document.createElement('canvas');
  layer.appendChild(cv);
  const stopBg = paintRevealBg(cv, results);

  const best = Math.max(...results.map(r => RARITY_IDX[r.rarity]));
  const title = el('div', 'reveal-title');
  title.textContent = best >= 4 ? '✦ ' + t('rar.' + results.find(r => RARITY_IDX[r.rarity] === best).rarity).toUpperCase() + ' ✦' : t('gacha.result');
  layer.appendChild(title);

  const cards = el('div', 'reveal-cards');
  layer.appendChild(cards);
  const single = results.length === 1;

  let flipped = 0;
  const cardEls = results.map((r, i) => {
    const def = TOWER_MAP[r.id];
    const c = el('div', 'rcard r-' + r.rarity + (single ? ' big' : '') + (RARITY_IDX[r.rarity] >= 5 ? ' rc-mythic' : RARITY_IDX[r.rarity] >= 4 ? ' rc-legend' : ''));
    c.style.setProperty('--rc', RARITY_COLOR[r.rarity]);
    c.innerHTML = `
      <div class="rc-face rc-back"></div>
      <div class="rc-face rc-front">
        <div class="rc-art"></div>
        <div class="rc-name">${tData(def, 'name')}</div>
        <div class="rc-rar">${t('rar.' + r.rarity)}${r.isNew ? ' · NEW!' : r.dupe?.refine ? ' · +REFINE' : ''}</div>
      </div>`;
    c.querySelector('.rc-art').appendChild(artCanvas(def.sprite, single ? 120 : 74));
    const flip = () => {
      if (c.classList.contains('flipped')) return;
      c.classList.add('flipped');
      flipped++;
      if (RARITY_IDX[r.rarity] >= 4) { sfx.fanfare(); burstAt(layer, c, RARITY_COLOR[r.rarity]); }
      else if (RARITY_IDX[r.rarity] === 3) sfx.holy();
      else sfx.star();
      if (flipped === results.length) setTimeout(showSummary, 700);
    };
    c.onclick = flip;
    if (!single) setTimeout(() => { if (!c.classList.contains('flipped')) flip(); }, 1400 + i * 220);
    cards.appendChild(c);
    return { el: c, flip };
  });

  const skip = el('button', 'btn reveal-skip', t('gacha.tap'));
  skip.onclick = () => {
    let done = true;
    cardEls.forEach(ce => ce.flip());
    if (done) { /* summary shown by last flip */ }
  };
  layer.appendChild(skip);

  let summaryShown = false;
  function showSummary() {
    if (summaryShown) return;
    summaryShown = true;
    skip.textContent = t('common.ok');
    skip.classList.add('btn-gold');
    skip.onclick = close;
    const dupes = Object.entries(dupeTotals).filter(([, n]) => n > 0);
    if (dupes.length) {
      const sum = el('div');
      sum.style.cssText = 'position:absolute;bottom:86px;z-index:3;display:flex;gap:10px;flex-wrap:wrap;justify-content:center;max-width:92vw';
      sum.innerHTML = rewardItemsHTML(dupes.map(([id, n2]) => ({ id, n: n2 })));
      layer.appendChild(sum);
    }
    if (pityTriggered) toast('✨ ' + t('gacha.guaranteed'), 'gold', '🌟');
    ST.persistNow();
    bus.emit('state'); bus.emit('collection');
  }
  function close() {
    stopBg();
    layer.remove();
    sfx.back();
  }
  if (single) setTimeout(() => { if (!summaryShown && flipped === 1) { } }, 100);
}

function burstAt(layer, card, color) {
  const r = card.getBoundingClientRect();
  for (let i = 0; i < 14; i++) {
    const s = el('div', 'sparkle');
    s.textContent = '✦';
    s.style.left = (r.left + r.width / 2 + (Math.random() - 0.5) * r.width) + 'px';
    s.style.top = (r.top + r.height / 2 + (Math.random() - 0.5) * r.height) + 'px';
    s.style.color = color;
    layer.appendChild(s);
    setTimeout(() => s.remove(), 850);
  }
}

// ---------- canvases ----------
function paintPortal(cv) {
  const ctx = cv.getContext('2d');
  let raf = 0, tt = 0;
  const parts = [];
  for (let i = 0; i < 40; i++) parts.push({ a: Math.random() * TAU, r: 0.2 + Math.random() * 0.8, s: 0.4 + Math.random(), sz: 1 + Math.random() * 2.4 });
  function resize() { const b = cv.getBoundingClientRect(); cv.width = Math.max(2, b.width); cv.height = Math.max(2, b.height); }
  resize();
  const ro = new ResizeObserver(resize); ro.observe(cv);
  function draw() {
    const W = cv.width, H = cv.height;
    tt += 0.016;
    const g = ctx.createRadialGradient(W / 2, H * 0.46, 8, W / 2, H * 0.46, Math.max(W, H) * 0.7);
    g.addColorStop(0, '#3b2a6e'); g.addColorStop(0.5, '#1d1438'); g.addColorStop(1, '#0b0818');
    ctx.fillStyle = g; ctx.fillRect(0, 0, W, H);
    // portal ring
    const cx = W / 2, cy = H * 0.46, R = Math.min(W, H) * 0.3;
    ctx.save();
    ctx.translate(cx, cy);
    ctx.rotate(tt * 0.4);
    for (let k = 0; k < 3; k++) {
      ctx.strokeStyle = ['#f5c542', '#a06bf0', '#4aa8f0'][k];
      ctx.globalAlpha = 0.5;
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.ellipse(0, 0, R * (1 - k * 0.16), R * (0.42 - k * 0.08), k * 0.7, 0, TAU);
      ctx.stroke();
    }
    ctx.restore();
    ctx.globalAlpha = 1;
    // core glow
    const cg = ctx.createRadialGradient(cx, cy, 2, cx, cy, R * 0.55);
    cg.addColorStop(0, '#ffe9a8cc'); cg.addColorStop(1, 'transparent');
    ctx.fillStyle = cg;
    ctx.beginPath(); ctx.arc(cx, cy, R * 0.55, 0, TAU); ctx.fill();
    // orbiting motes
    for (const p of parts) {
      p.a += 0.01 * p.s;
      const rr = R * (0.5 + p.r * 0.9);
      const x = cx + Math.cos(p.a) * rr, y = cy + Math.sin(p.a) * rr * 0.5;
      ctx.fillStyle = '#ffe9a8';
      ctx.globalAlpha = 0.35 + 0.4 * Math.sin(tt * 2 + p.a * 3);
      ctx.beginPath(); ctx.arc(x, y, p.sz, 0, TAU); ctx.fill();
    }
    ctx.globalAlpha = 1;
    raf = requestAnimationFrame(draw);
  }
  draw();
  return () => { cancelAnimationFrame(raf); ro.disconnect(); };
}

function paintRevealBg(cv, results) {
  const ctx = cv.getContext('2d');
  let raf = 0, tt = 0;
  const best = Math.max(...results.map(r => RARITY_IDX[r.rarity]));
  const col = RARITY_COLOR[results.find(r => RARITY_IDX[r.rarity] === best)?.rarity || 'gray'];
  const motes = [];
  for (let i = 0; i < 60; i++) motes.push({ x: Math.random(), y: Math.random(), v: 0.02 + Math.random() * 0.06, sz: 0.6 + Math.random() * 2, ph: Math.random() * TAU });
  function resize() { cv.width = window.innerWidth; cv.height = window.innerHeight; }
  resize();
  window.addEventListener('resize', resize);
  function draw() {
    const W = cv.width, H = cv.height;
    tt += 0.016;
    const g = ctx.createRadialGradient(W / 2, H / 2, 10, W / 2, H / 2, Math.max(W, H) * 0.8);
    g.addColorStop(0, col + '33'); g.addColorStop(1, '#050309');
    ctx.fillStyle = g; ctx.fillRect(0, 0, W, H);
    ctx.fillStyle = col;
    for (const m of motes) {
      m.y -= m.v * 0.016 * 8;
      if (m.y < -0.02) { m.y = 1.02; m.x = Math.random(); }
      ctx.globalAlpha = 0.2 + 0.3 * Math.sin(tt * 3 + m.ph);
      ctx.beginPath(); ctx.arc(m.x * W, m.y * H, m.sz, 0, TAU); ctx.fill();
    }
    ctx.globalAlpha = 1;
    raf = requestAnimationFrame(draw);
  }
  draw();
  return () => { cancelAnimationFrame(raf); window.removeEventListener('resize', resize); };
}
