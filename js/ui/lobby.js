// ============================================================
// GTDM lobby — home scene: hero banner, modes, team, stats
// ============================================================
import { el, clear, fmt, bus, mulberry32 } from '../core/util.js';
import { t, tData } from '../core/i18n.js';
import { K } from '../data/defs.js';
import { REGIONS, stageRegion } from '../data/stages.js';
import { HERO_MAP } from '../data/heroes.js';
import { portrait } from '../game/sprites.js';
import { sfx } from '../core/audio.js';
import * as ST from '../game/state.js';
import { artCanvas, starsHTML } from './widgets.js';
import { ico } from './icons.js';

export function renderLobby(scene) {
  clear(scene);
  const root = el('div', 'scene-root');
  scene.appendChild(root);

  // ---------- hero banner ----------
  const nextStage = Math.min(200, ST.S.maxStage);
  const region = REGIONS[stageRegion(nextStage)];
  const hero = el('div', 'lobby-hero');
  const cv = document.createElement('canvas');
  hero.appendChild(cv);
  const ov = el('div', 'lh-overlay');
  ov.innerHTML = `
    <div class="lh-title">${region.icon} ${tData(region, 'name')}</div>
    <div class="lh-sub">${t('lobby.welcome')} — ${t('stages.region')} ${stageRegion(nextStage) + 1} · ${t('result.stars')} ${ST.totalStars()}★</div>`;
  hero.appendChild(ov);
  const playWrap = el('div', 'lh-play');
  const playBtn = el('button', 'btn btn-gold btn-lg', nextStage > 200 ? t('lobby.play') : `${t('lobby.continue')} — ${nextStage} ▶`);
  playBtn.onclick = () => { sfx.click(); bus.emit('nav:go', 'stages'); };
  playWrap.appendChild(playBtn);
  hero.appendChild(playWrap);
  root.appendChild(hero);
  paintBanner(cv, region, nextStage);

  // ---------- event cards ----------
  const grid = el('div', 'lobby-grid');
  root.appendChild(grid);

  const daily = ST.todayDaily();
  if (ST.S.unlocks.daily) {
    grid.appendChild(eventCard('ev-daily', ico('dice', 34), t('mode.daily'), t('mode.daily.d'),
      daily.done ? t('daily.done') : t('daily.start'), () => bus.emit('nav:go', 'battlehub'),
      !daily.done));
  }
  if (ST.S.unlocks.proof) {
    grid.appendChild(eventCard('ev-proof', ico('spire', 34), t('mode.proof'), t('mode.proof.d'),
      `${t('proof.best')}: ${ST.S.proof.best}`, () => bus.emit('nav:go', 'battlehub')));
  }
  if (ST.S.unlocks.bossrush) {
    grid.appendChild(eventCard('ev-boss', ico('skull', 34), t('mode.bossrush'), t('mode.bossrush.d'),
      t('bossrush.pick'), () => bus.emit('nav:go', 'battlehub')));
  }
  grid.appendChild(eventCard('ev-chal', ico('book', 34), t('codex.title'), t('codex.lore'),
    `${Object.keys(ST.S.codex).length} ✦`, () => bus.emit('nav:go', 'codex')));

  // ---------- team strip ----------
  const teamSec = el('div', 'panel', `<div class="sec-title">${t('common.team')} <span class="txt-s txt-mut">(${t('lobby.teamHint')})</span></div>`);
  const strip = el('div', 'team-strip');
  for (let i = 0; i < K.HERO_TEAM_SIZE; i++) {
    const hid = ST.S.team[i];
    const slot = el('div', 'team-slot' + (hid ? '' : ' empty'));
    const p = el('div', 'team-portrait');
    if (hid && HERO_MAP[hid]) {
      p.appendChild(artCanvas(HERO_MAP[hid].sprite, 64, { portrait: true }));
      slot.innerHTML += `<div class="ts-name">${tData(HERO_MAP[hid], 'name')}</div>`;
    } else {
      p.innerHTML = '＋';
      slot.innerHTML += `<div class="ts-name">—</div>`;
    }
    slot.prepend(p);
    slot.onclick = () => { sfx.click(); bus.emit('nav:go', 'heroes'); };
    strip.appendChild(slot);
  }
  teamSec.appendChild(strip);
  root.appendChild(teamSec);

  // ---------- stats ----------
  const st = ST.S.stats;
  const statSec = el('div', 'panel');
  statSec.innerHTML = `<div class="sec-title">${t('lobby.stats')}</div>
    <div class="stat-grid">
      <div class="stat-box"><div class="sb-l">${t('lobby.stat.kills')}</div><div class="sb-v">${fmt(st.kills)}</div></div>
      <div class="stat-box"><div class="sb-l">${t('lobby.stat.wins')}</div><div class="sb-v">${st.wins} / ${st.wins + st.losses}</div></div>
      <div class="stat-box"><div class="sb-l">${t('lobby.stat.stages')}</div><div class="sb-v">${ST.totalStars()}★</div></div>
      <div class="stat-box"><div class="sb-l">${t('lobby.stat.best')}</div><div class="sb-v">🗼 ${st.proofBest}</div></div>
    </div>`;
  root.appendChild(statSec);
}

function eventCard(cls, icon, name, desc, cta, onclick, badge) {
  const c = el('div', 'event-card ' + cls);
  c.innerHTML = `
    ${badge ? `<div class="ev-badge">GO!</div>` : ''}
    <div class="ev-ico">${icon}</div>
    <div class="ev-name">${name}</div>
    <div class="ev-desc">${desc}</div>
    <div class="ev-cta">${cta} ▶</div>`;
  c.onclick = () => { sfx.click(); onclick(); };
  return c;
}

// animated painted banner of the current region (cheap canvas art)
function paintBanner(cv, region, stageId) {
  const ctx = cv.getContext('2d');
  const rnd = mulberry32(stageId * 7919 + 13);
  let raf = 0, tt = 0;
  function resize() {
    const r = cv.getBoundingClientRect();
    cv.width = Math.max(2, r.width); cv.height = Math.max(2, r.height);
  }
  resize();
  const decos = [];
  for (let i = 0; i < 9; i++) decos.push({ x: rnd(), y: 0.55 + rnd() * 0.4, s: 0.6 + rnd() * 0.9, ph: rnd() * 6.28 });
  function draw() {
    const W = cv.width, H = cv.height;
    tt += 0.016;
    const sky = ctx.createLinearGradient(0, 0, 0, H);
    sky.addColorStop(0, region.sky?.[0] || '#241c40');
    sky.addColorStop(1, region.sky?.[1] || '#171130');
    ctx.fillStyle = sky; ctx.fillRect(0, 0, W, H);
    // sun/moon
    ctx.globalAlpha = 0.5;
    ctx.fillStyle = '#fff8d8';
    ctx.beginPath(); ctx.arc(W * 0.78, H * 0.24, 26, 0, 7); ctx.fill();
    ctx.globalAlpha = 1;
    // hills
    ctx.fillStyle = region.ground?.[0] || '#2c4a24';
    ctx.beginPath(); ctx.moveTo(0, H);
    for (let x = 0; x <= W; x += 24) ctx.lineTo(x, H * 0.62 + Math.sin(x * 0.013 + region.id * 2.2) * H * 0.07);
    ctx.lineTo(W, H); ctx.fill();
    ctx.fillStyle = region.ground?.[1] || '#35562b';
    ctx.beginPath(); ctx.moveTo(0, H);
    for (let x = 0; x <= W; x += 20) ctx.lineTo(x, H * 0.78 + Math.sin(x * 0.02 + region.id) * H * 0.05);
    ctx.lineTo(W, H); ctx.fill();
    // deco silhouettes
    ctx.fillStyle = '#0d0a1755';
    for (const d of decos) {
      const s = 20 * d.s, x = d.x * W, y = d.y * H + Math.sin(tt * 1.4 + d.ph) * 2;
      ctx.beginPath(); ctx.moveTo(x, y); ctx.lineTo(x - s * 0.5, y + s); ctx.lineTo(x + s * 0.5, y + s); ctx.fill();
    }
    raf = requestAnimationFrame(draw);
  }
  draw();
  const ro = new ResizeObserver(() => resize());
  ro.observe(cv);
  const stop = () => { cancelAnimationFrame(raf); ro.disconnect(); };
  lobbyBannerStop = stop;
}

export let lobbyBannerStop = null;
export function stopLobbyBanner() { if (lobbyBannerStop) { lobbyBannerStop(); lobbyBannerStop = null; } }
