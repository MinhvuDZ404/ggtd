// ============================================================
// GTDM stages view — region tabs, stage grid, detail modal, sweep
// ============================================================
import { el, clear, fmt, bus } from '../core/util.js';
import { t, tData } from '../core/i18n.js';
import { RARITY_COLOR } from '../data/defs.js';
import { REGIONS, getStage, stageBoss, stageRegion, TOTAL_STAGES } from '../data/stages.js';
import { BOSS_MAP } from '../data/enemies.js';
import { sfx } from '../core/audio.js';
import * as ST from '../game/state.js';
import { openModal, confirmDialog, toast, rewardPopup, rewardItemsHTML, CUR_ICON } from './modal.js';
import { attrTag, starsHTML, artCanvas } from './widgets.js';

let curRegion = null;

export function renderStages(scene) {
  clear(scene);
  const root = el('div', 'scene-root');
  scene.appendChild(root);
  if (curRegion === null) curRegion = Math.min(9, stageRegion(ST.S.maxStage));

  // region tabs
  const tabs = el('div', 'region-tabs');
  REGIONS.forEach((r, i) => {
    const unlocked = ST.S.maxStage > i * 20;
    const tab = el('button', 'rtab' + (i === curRegion ? ' cur' : '') + (unlocked ? '' : ' locked'));
    tab.innerHTML = `${r.icon} ${i + 1}`;
    tab.title = tData(r, 'name');
    tab.onclick = () => {
      if (!unlocked) { sfx.error(); toast(t('stages.locked'), 'bad', '🔒'); return; }
      curRegion = i; sfx.click(); renderStages(scene);
    };
    tabs.appendChild(tab);
  });
  root.appendChild(tabs);

  const region = REGIONS[curRegion];
  // region header
  const head = el('div', 'region-head');
  head.innerHTML = `
    <div class="region-emblem">${region.icon}</div>
    <div class="region-info">
      <div class="region-name">${tData(region, 'name')}</div>
      <div class="region-desc">${tData(region, 'desc')}</div>
      <div class="txt-s txt-mut" style="margin-top:3px">★ ${ST.regionStars(curRegion)} / 60</div>
    </div>
    <div class="region-nav">
      <button class="btn btn-sm" id="rgPrev">◀</button>
      <button class="btn btn-sm" id="rgNext">▶</button>
    </div>`;
  root.appendChild(head);
  head.querySelector('#rgPrev').onclick = () => moveRegion(-1, scene);
  head.querySelector('#rgNext').onclick = () => moveRegion(1, scene);

  // stage grid
  const grid = el('div', 'stage-grid');
  for (let idx = 0; idx < 20; idx++) {
    const id = curRegion * 20 + idx + 1;
    grid.appendChild(stageNode(id, idx));
  }
  root.appendChild(grid);
}

function moveRegion(d, scene) {
  const n = curRegion + d;
  if (n < 0 || n > 9) return;
  if (ST.S.maxStage <= n * 20) { sfx.error(); toast(t('stages.locked'), 'bad', '🔒'); return; }
  curRegion = n; sfx.click(); renderStages(scene);
}

function stageNode(id, idx) {
  const st = ST.S.stages[id];
  const cleared = !!st?.cleared;
  const unlocked = ST.isStageUnlocked(id);
  const isBoss = idx === 9 || idx === 19;
  const current = !cleared && unlocked;
  const node = el('div', 'stage-node' +
    (cleared ? ' cleared' : '') + (current ? ' current' : '') +
    (isBoss ? ' boss' : '') + (unlocked ? '' : ' locked'));
  node.innerHTML = `
    ${isBoss ? `<div class="sn-elite">${idx === 19 ? '👑' : '💀'}</div>` : ''}
    <div class="sn-num">${id}</div>
    <div class="sn-stars">${starsHTML(st?.stars ?? 0)}</div>`;
  node.onclick = () => {
    if (!unlocked) { sfx.error(); toast(t('stages.locked'), 'bad', '🔒'); return; }
    sfx.click();
    stageModal(id);
  };
  return node;
}

function stageModal(id) {
  const stage = getStage(id);
  const region = REGIONS[stage.region];
  const st = ST.S.stages[id] || {};
  const boss = stage.boss ? BOSS_MAP[stage.boss] : null;
  const idx = stage.idx;

  const body = el('div');
  body.innerHTML = `
    <div class="detail-top">
      <div class="detail-art" style="--rc:${RARITY_COLOR[boss ? 'legendary' : 'blue']}">
        <div style="font-size:64px;text-align:center;line-height:116px">${boss ? (idx === 19 ? '👑' : '💀') : region.icon}</div>
      </div>
      <div>
        <div class="detail-name">${id} · ${boss ? tData(boss, 'name') : tData(region, 'name')}</div>
        <div class="detail-sub"><span class="chip">${t('battle.wave', { a: stage.waves.length, b: stage.waves.length })}</span>
        ${boss ? `<span class="chip" style="color:#ff9a8a">${idx === 19 ? t('stages.boss') : t('stages.elite')}</span>` : ''}</div>
        <div class="sn-stars txt-gold" style="font-size:18px;margin-top:6px">${starsHTML(st.stars ?? 0)}</div>
      </div>
    </div>
    ${boss ? `<div class="detail-desc" style="--rc:#f0564a">☠ ${tData(boss, 'title')} — ${attrTag(boss.attr)}</div>` : ''}
    <div class="stat-grid">
      <div class="stat-box"><div class="sb-l">${t('stages.reward1')}</div><div class="sb-v">💰 ${fmt(stage.rewards.gold)}</div></div>
      <div class="stat-box"><div class="sb-l">❤</div><div class="sb-v">${stage.lives}</div></div>
      ${st.bestLives ? `<div class="stat-box"><div class="sb-l">BEST</div><div class="sb-v">${st.bestLives}❤</div></div>` : ''}
    </div>
    ${stage.rewards.first && !st.cleared ? `<div class="txt-s txt-gold fw9" style="margin-top:10px">✨ ${t('result.firstclear')}</div>
      <div class="reward-items" style="justify-content:flex-start;margin:6px 0">${rewardItemsHTML(Object.entries(stage.rewards.first).filter(([, n]) => n > 0).map(([k2, n]) => ({ id: k2, n })))}</div>` : ''}`;

  const foot = [];
  const m = { close: () => { } };
  if (ST.canSweep(id)) {
    const sw = el('button', 'btn btn-green', `⚡ ${t('stages.sweep')}`);
    sw.onclick = () => { m.close(); doSweep(id); };
    foot.push(sw);
  }
  const fight = el('button', 'btn btn-gold', `⚔ ${t('stages.fight')}`);
  fight.onclick = () => { m.close(); bus.emit('play:stage', id); };
  foot.push(fight);
  const modal = openModal({ title: `${region.icon} ${tData(region, 'name')}`, body, foot, wide: true });
  m.close = modal.close;
}

// instant sweep — grants the repeatable gold reward; stars stay as earned
export function doSweep(id) {
  if (!ST.canSweep(id)) { sfx.error(); return; }
  const stage = getStage(id);
  const gold = stage.rewards.gold;
  ST.addCur('gold', gold, true);
  ST.persistNow();
  sfx.bigCoin();
  rewardPopup(t('stages.sweep'), [{ id: 'gold', n: gold }], null);
  bus.emit('state');
}
