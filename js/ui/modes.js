// ============================================================
// GTDM battle hub — daily challenge, tower of proof, boss rush,
// global ability upgrades
// ============================================================
import { el, clear, fmt, bus } from '../core/util.js';
import { t, tData } from '../core/i18n.js';
import { K, RARITY_COLOR } from '../data/defs.js';
import { MODIFIERS, PROOF_REWARDS, REGIONS } from '../data/stages.js';
import { TOWER_MAP } from '../data/towers.js';
import { BOSSES, BOSS_MAP } from '../data/enemies.js';
import { ABILITIES } from '../data/heroes.js';
import { sfx } from '../core/audio.js';
import * as ST from '../game/state.js';
import { toast, rewardItemsHTML, confirmDialog } from './modal.js';
import { ico } from './icons.js'; // eslint-disable-line
import { artCanvas, attrTag } from './widgets.js';

export function renderModes(scene) {
  clear(scene);
  const root = el('div', 'scene-root');
  scene.appendChild(root);
  root.appendChild(el('div', 'sec-title', '⚔ ' + t('nav.battle')));

  // ---------- daily challenge ----------
  const daily = ST.todayDaily();
  const dcard = el('div', 'event-card ev-daily');
  dcard.style.minHeight = 'auto';
  const mods = daily.mods.map(id => MODIFIERS.find(m => m.id === id)).filter(Boolean);
  dcard.innerHTML = `
    <div class="dsp-flex sb ac">
      <div class="ev-name">${ico('dice', 20)} ${t('mode.daily')}</div>
      <div class="chip">${REGIONS[daily.region].icon} ${tData(REGIONS[daily.region], 'name')}</div>
    </div>
    <div class="ev-desc">${t('mode.daily.d')}</div>
    <div class="modifier-list">
      ${mods.map(m => `<div class="modifier"><span class="mo-ico">${m.icon}</span><b>${tData(m, 'name')}</b> — ${tData(m, 'desc')}</div>`).join('')}
    </div>
    <div class="txt-xs txt-mut">${t('daily.score')} ⭐ ${fmt(ST.S.daily.bestScore)} · ${t('daily.modifiers')}: ${daily.nWaves} waves · draft 6 towers</div>
    <div class="dsp-flex mt8" id="draftRow" style="gap:6px"></div>
    <button class="btn ${daily.done ? '' : 'btn-gold'} btn-block mt12" id="dailyGo" ${daily.done ? 'disabled' : ''}>
      ${daily.done ? '✓ ' + t('daily.done') : '▶ ' + t('daily.start')}</button>`;
  root.appendChild(dcard);
  const draftRow = dcard.querySelector('#draftRow');
  daily.draft.forEach(id => {
    const d = TOWER_MAP[id];
    const chip = el('div', 'r-' + d.rarity);
    chip.style.cssText = 'width:44px;text-align:center';
    const a = el('div');
    a.style.cssText = `width:44px;height:44px;border-radius:10px;border:1px solid ${RARITY_COLOR[d.rarity]};overflow:hidden;background:#171130`;
    a.appendChild(artCanvas(id, 44));
    chip.appendChild(a);
    chip.insertAdjacentHTML('beforeend', `<div class="txt-xs" style="margin-top:2px">${tData(d, 'name').split(' ')[0]}</div>`);
    draftRow.appendChild(chip);
  });
  dcard.querySelector('#dailyGo').onclick = () => { sfx.click(); bus.emit('play:daily'); };

  // ---------- tower of proof ----------
  if (ST.S.unlocks.proof) {
    const pcard = el('div', 'proof-banner mt12');
    const nextMs = Math.ceil((ST.S.proof.best + 1) / 5) * 5;
    pcard.innerHTML = `
      <div class="pb-ico">${ico('spire', 56)}</div>
      <h2>${t('mode.proof')}</h2>
      <p>${t('mode.proof.d')}</p>
      <div class="proof-best">
        <div class="pbb"><b>${ST.S.proof.best}</b><span>${t('proof.best')}</span></div>
        <div class="pbb"><b>${ST.S.proof.runs}</b><span>RUNS</span></div>
        <div class="pbb"><b>${nextMs}</b><span>${t('proof.reward')}</span></div>
      </div>
      <div class="reward-items" style="margin:10px 0 4px">${rewardItemsHTML(PROOF_REWARDS(nextMs))}</div>
      <button class="btn btn-purple btn-lg mt8" id="proofGo">▶ ${t('proof.start')}</button>`;
    root.appendChild(pcard);
    pcard.querySelector('#proofGo').onclick = () => { sfx.click(); bus.emit('play:proof', 1); };
  } else {
    root.insertAdjacentHTML('beforeend', `<div class="panel mt12 empty-note">🔒 ${t('mode.proof')} — ${t('heroes.unlockAt', { n: 10 })}</div>`);
  }

  // ---------- boss rush ----------
  if (ST.S.unlocks.bossrush) {
    const bcard = el('div', 'panel mt12');
    bcard.innerHTML = `<div class="sec-title">${ico('skull', 20)} ${t('bossrush.title')} <span class="txt-s txt-mut">${t('bossrush.pick')}</span></div>`;
    const grid = el('div', 'card-grid');
    BOSSES.forEach(b => {
      const cleared = ST.stageCleared(b.region * 20 + (b.slot === 'mini' ? 10 : 20));
      const times = ST.S.bossrush.done[b.id]?.times || 0;
      const card = el('div', `unit-card r-${cleared ? 'legendary' : 'gray'} ${cleared ? 'owned' : 'notowned'}`);
      card.innerHTML = `
        <div class="uc-art"></div>
        <div class="uc-name">${cleared ? tData(b, 'name') : '???'}</div>
        <div class="uc-lvl">${cleared ? `${REGIONS[b.region].icon} · ×${times}` : '🔒'}</div>`;
      card.querySelector('.uc-art').appendChild(artCanvas(b.sprite, 72, { portrait: true, silhouette: !cleared }));
      card.onclick = () => {
        if (!cleared) { sfx.error(); toast(t('stages.locked'), 'bad', '🔒'); return; }
        sfx.click();
        confirmDialog(tData(b, 'name'), `${t('mode.bossrush.d')} · ❤15 · 💰×${b.region + 1}`,
          () => bus.emit('play:bossrush', b.id), '⚔ ' + t('stages.fight'));
      };
      grid.appendChild(card);
    });
    bcard.appendChild(grid);
    root.appendChild(bcard);
  } else {
    root.insertAdjacentHTML('beforeend', `<div class="panel mt12 empty-note">🔒 ${t('mode.bossrush')} — ${t('heroes.unlockAt', { n: 30 })}</div>`);
  }

  // ---------- global abilities ----------
  const acard = el('div', 'panel mt12');
  acard.innerHTML = `<div class="sec-title">☄️ ${t('ab.title') || 'ABILITIES'} <span class="txt-s txt-mut">${ico('magic', 14)} <b data-cur="magic">${ST.S.cur.magic}</b></span></div>`;
  ABILITIES.forEach(a => {
    const unlocked = ST.abilityUnlocked(a.id);
    const lvl = ST.abilityLvl(a.id);
    const row = el('div', 'mission-item' + (unlocked ? '' : ' done'));
    row.style.opacity = unlocked ? '1' : '.55';
    row.innerHTML = `
      <div class="mi-ico">${a.icon}</div>
      <div class="mi-body">
        <div class="mi-t">${tData(a, 'name')} ${lvl ? `Lv.${lvl}` : ''}</div>
        <div class="mi-n">${tData(a, 'desc')}</div>
        <div class="mi-n txt-mut">${unlocked ? `CD ${a.cd(Math.max(1, lvl)).toFixed(0)}s` : `🔒 ${t('heroes.unlockAt', { n: a.unlockStage })}`}</div>
      </div>`;
    if (unlocked && lvl < a.maxLvl) {
      const cost = K.abilityUpCost(lvl + 1);
      const b = el('button', 'btn btn-sm btn-purple', `⬆ ${ico('magic', 14)}${cost}`);
      b.onclick = () => {
        if (ST.upgradeAbility(a.id)) { sfx.upgrade(); bus.emit('state'); renderModes(scene); }
        else { sfx.error(); toast(t('common.notenough'), 'bad', '💸'); }
      };
      row.appendChild(b);
    } else if (unlocked) {
      const mx = el('button', 'btn btn-sm', t('common.max')); mx.disabled = true; row.appendChild(mx);
    }
    acard.appendChild(row);
  });
  root.appendChild(acard);
}
