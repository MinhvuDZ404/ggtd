// ============================================================
// GTDM units — heroes & towers collection, detail, upgrades
// ============================================================
import { el, clear, fmt, bus } from '../core/util.js';
import { t, tData } from '../core/i18n.js';
import { K, RARITY_COLOR, RARITY_IDX, ATTRS } from '../data/defs.js';
import { TOWERS, TOWER_MAP } from '../data/towers.js';
import { HEROES, HERO_MAP } from '../data/heroes.js';
import { REGIONS } from '../data/stages.js';
import { sfx } from '../core/audio.js';
import * as ST from '../game/state.js';
import { openModal, toast } from './modal.js';
import { ico } from './icons.js';
import { unitCard, detailTop, statBox, skillBox, attrTag, artCanvas, costTag } from './widgets.js';

// ------------------------------------------------------------
// shared filter + grid scaffolding
// ------------------------------------------------------------
function filterState() { return { attr: 'all', owned: false }; }

function filterRow(fs, rerender) {
  const row = el('div', 'filter-row');
  const mk = (label, on, fn) => {
    const b = el('button', 'fbtn' + (on ? ' on' : ''), label);
    b.onclick = () => { sfx.click(); fn(); rerender(); };
    row.appendChild(b);
  };
  mk(t('common.all') || 'ALL', fs.attr === 'all', () => fs.attr = 'all');
  ATTRS.forEach(a => mk(attrTag(a).replace(/<[^>]+>/g, ''), fs.attr === a, () => fs.attr = a));
  return row;
}

// ------------------------------------------------------------
// HEROES
// ------------------------------------------------------------
export function renderHeroes(scene) {
  clear(scene);
  const root = el('div', 'scene-root');
  scene.appendChild(root);
  const fs = renderHeroes._fs || (renderHeroes._fs = filterState());
  const rerender = () => renderHeroes(scene);

  // team strip
  const team = el('div', 'panel');
  team.innerHTML = `<div class="sec-title">${t('common.team')}
    <button class="btn btn-sm" id="autoTeam" style="margin-left:auto">${t('heroes.auto')}</button></div>`;
  const strip = el('div', 'team-strip');
  for (let i = 0; i < K.HERO_TEAM_SIZE; i++) {
    const hid = ST.S.team[i];
    const slot = el('div', 'team-slot' + (hid ? '' : ' empty'));
    const p = el('div', 'team-portrait');
    if (hid && HERO_MAP[hid]) {
      p.appendChild(artCanvas(HERO_MAP[hid].sprite, 64, { portrait: true }));
      slot.innerHTML += `<div class="ts-name">${tData(HERO_MAP[hid], 'name')} Lv.${ST.heroLvl(hid)}</div>`;
    } else {
      p.innerHTML = '＋';
      slot.innerHTML += `<div class="ts-name">—</div>`;
    }
    slot.prepend(p);
    slot.onclick = () => teamPicker(i, rerender);
    strip.appendChild(slot);
  }
  team.appendChild(strip);
  root.appendChild(team);

  root.appendChild(filterRow(fs, rerender));

  root.appendChild(el('div', 'sec-title', `${t('heroes.title')} — ${t('heroes.owned', { n: Object.keys(ST.S.heroes).length, t: HEROES.length })}`));
  team.querySelector('#autoTeam').onclick = () => { ST.autoTeam(); sfx.click(); toast(t('toast.saved'), 'good', '🦸'); rerender(); };

  const grid = el('div', 'card-grid');
  HEROES
    .filter(h => (fs.attr === 'all' || h.attr === fs.attr))
    .sort((a, b) => (ST.ownsHero(b.id) - ST.ownsHero(a.id)) || (RARITY_IDX[b.rarity] - RARITY_IDX[a.rarity]))
    .forEach(h => {
      const owned = ST.ownsHero(h.id);
      const inTeam = ST.S.team.includes(h.id);
      grid.appendChild(unitCard(h, {
        owned,
        awakened: ST.heroAwaken(h.id) > 0,
        sub: owned ? `Lv.${ST.heroLvl(h.id)}${ST.heroAwaken(h.id) ? ' ' + '★'.repeat(ST.heroAwaken(h.id)) : ''}` : lockHint(h),
        team: inTeam,
        onclick: () => { sfx.click(); heroDetail(h.id, rerender); },
      }));
    });
  root.appendChild(grid);
}

function lockHint(h) {
  if (typeof h.unlock === 'string' && h.unlock.startsWith('stage')) return '🔒 ' + h.unlock.slice(5);
  return '🔒';
}

function teamPicker(slotIdx, done) {
  const body = el('div', 'card-grid');
  const m = { close: () => { } };
  const none = el('button', 'btn btn-sm btn-red', t('common.unequip'));
  none.onclick = () => { ST.setTeamHero(slotIdx, null); sfx.click(); m.close(); done?.(); bus.emit('team'); };
  body.appendChild(none);
  Object.keys(ST.S.heroes).forEach(hid => {
    const h = HERO_MAP[hid];
    const c = unitCard(h, {
      owned: true,
      sub: `Lv.${ST.heroLvl(hid)}`,
      selected: ST.S.team[slotIdx] === hid,
      onclick: () => {
        ST.setTeamHero(slotIdx, hid);
        sfx.click(); m.close(); done?.(); bus.emit('team');
      },
    });
    body.appendChild(c);
  });
  const modal = openModal({ title: t('common.team') + ' — ' + (slotIdx + 1), body, wide: true });
  m.close = modal.close;
}

function heroDetail(hid, rerender) {
  const h = HERO_MAP[hid];
  const owned = ST.ownsHero(hid);
  const lvl = ST.heroLvl(hid) || 1;
  const aw = ST.heroAwaken(hid);
  const mult = K.heroMetaBonus(lvl, aw);

  const body = el('div');
  body.appendChild(detailTop(h, owned ? `Lv.${lvl}${aw ? ' · ' + '★'.repeat(aw) : ''}` : '🔒'));
  const stats = el('div', 'stat-grid');
  stats.innerHTML =
    statBox(t('common.dmg'), Math.round(h.dmg * mult), owned && lvl > 1 ? `×${mult.toFixed(2)}` : '') +
    statBox(t('common.rate'), (h.rate).toFixed(2) + '/s', '') +
    statBox(t('common.range'), (h.range).toFixed(2), h.melee ? '⚔ ' + t('heroes.melee') : '') +
    statBox(t('heroes.skillCd'), h.skill.cd + 's', '');
  body.appendChild(stats);
  body.insertAdjacentHTML('beforeend', `<div class="detail-desc" style="--rc:${RARITY_COLOR[h.rarity]}">${tData(h, 'desc') || ''}</div>`);
  body.insertAdjacentHTML('beforeend', skillBox(h.skill.icon, tData(h.skill, 'name') + (owned ? ` — ${tData(h.skill, 'desc')}` : ''), ''));
  body.insertAdjacentHTML('beforeend', skillBox('✦', (t('heroes.passive') || 'PASSIVE') + ': ' + tData(h.passive, 'name'), tData(h.passive, 'desc')));

  const foot = [];
  if (!owned) {
    foot.push(el('button', 'btn', '🔒 ' + (typeof h.unlock === 'string' && h.unlock.startsWith('stage') ? t('heroes.unlockAt', { n: h.unlock.slice(5) }) : '???')));
  } else {
    // upgrade
    const upCost = ST.heroUpCost(hid);
    if (upCost) {
      const b = el('button', 'btn btn-gold', `⬆ ${t('common.upgrade')} · ${Object.entries(upCost).map(([k, n]) => `${ico(k, 14)}${fmt(n)}`).join(' ')}`);
      b.onclick = () => {
        if (ST.upgradeHero(hid)) { sfx.upgrade(); toast(`${tData(h, 'name')} → Lv.${ST.heroLvl(hid)}`, 'good', '⬆'); bus.emit('state'); rerender?.(); }
        else { sfx.error(); toast(t('common.notenough'), 'bad', '💸'); }
      };
      foot.push(b);
    } else { const mx = el('button', 'btn', t('common.max')); mx.disabled = true; foot.push(mx); }
    // awaken
    const awCost = ST.heroAwakenCost(hid);
    if (awCost) {
      const b2 = el('button', 'btn btn-purple', `✨ ${t('heroes.awaken')} · ${Object.entries(awCost).map(([k, n]) => `${ico(k, 14)}${fmt(n)}`).join(' ')}`);
      b2.onclick = () => {
        if (ST.awakenHero(hid)) { sfx.holy?.() || sfx.upgrade(); toast(`${tData(h, 'name')} ★${ST.heroAwaken(hid)}`, 'gold', '✨'); bus.emit('state'); rerender?.(); }
        else { sfx.error(); toast(t('common.notenough'), 'bad', '💸'); }
      };
      foot.push(b2);
    }
    // equip
    const inTeam = ST.S.team.includes(hid);
    const b3 = el('button', inTeam ? 'btn btn-red' : 'btn btn-green', inTeam ? t('common.unequip') : t('common.equip'));
    b3.onclick = () => {
      if (inTeam) ST.setTeamHero(ST.S.team.indexOf(hid), null);
      else {
        const slot = ST.S.team.indexOf(null);
        if (slot === -1) { teamPickerSwap(hid, rerender); return; }
        ST.setTeamHero(slot, hid);
      }
      sfx.click(); bus.emit('team'); rerender?.();
    };
    foot.push(b3);
  }
  openModal({ title: tData(h, 'name'), body, foot, wide: true });
}

function teamPickerSwap(hid, rerender) {
  // all slots full — pick which hero to bench
  const body = el('div');
  body.innerHTML = `<div class="txt-s txt-mut" style="margin-bottom:10px">${t('heroes.swapHint')}</div>`;
  const row = el('div', 'dsp-flex gap8 wrap');
  const m = { close: () => { } };
  ST.S.team.forEach((cur, i) => {
    if (!cur) return;
    const b = el('button', 'btn', `${tData(HERO_MAP[cur], 'name')}`);
    b.onclick = () => { ST.setTeamHero(i, hid); sfx.click(); m.close(); bus.emit('team'); rerender?.(); };
    row.appendChild(b);
  });
  body.appendChild(row);
  const modal = openModal({ title: t('common.team'), body });
  m.close = modal.close;
}

// ------------------------------------------------------------
// TOWERS
// ------------------------------------------------------------
export function renderTowers(scene) {
  clear(scene);
  const root = el('div', 'scene-root');
  scene.appendChild(root);
  const fs = renderTowers._fs || (renderTowers._fs = filterState());
  const rerender = () => renderTowers(scene);

  root.appendChild(filterRow(fs, rerender));
  root.appendChild(el('div', 'sec-title', `${t('towers.title')} — ${t('towers.owned', { n: Object.keys(ST.S.towers).length, t: TOWERS.length })}`));

  const grid = el('div', 'card-grid');
  TOWERS
    .filter(x => (fs.attr === 'all' || x.attr === fs.attr))
    .sort((a, b) => (ST.ownsTower(b.id) - ST.ownsTower(a.id)) || (RARITY_IDX[b.rarity] - RARITY_IDX[a.rarity]))
    .forEach(x => {
      const owned = ST.ownsTower(x.id);
      const rec = ST.S.towers[x.id];
      grid.appendChild(unitCard(x, {
        owned,
        sub: owned ? `Lv.${rec.lvl}${rec.refine ? ` +${rec.refine}` : ''}` : `🔒 ${REGIONS[x.unlock]?.icon || ''} R${(x.unlock ?? 0) + 1}`,
        onclick: () => { sfx.click(); towerDetail(x.id, rerender); },
      }));
    });
  root.appendChild(grid);
}

function towerDetail(tid, rerender) {
  const x = TOWER_MAP[tid];
  const owned = ST.ownsTower(tid);
  const lvl = ST.towerLvl(tid) || 1;
  const refine = ST.S.towers[tid]?.refine || 0;
  const mDmg = K.towerMetaBonus(lvl) * (1 + refine * 0.02);
  const mRange = K.towerMetaRange(lvl);

  const body = el('div');
  body.appendChild(detailTop(x, owned ? `Lv.${lvl}${refine ? ` +${refine}` : ''}` : '🔒'));
  const stats = el('div', 'stat-grid');
  stats.innerHTML =
    statBox(t('common.dmg'), Math.round(x.dmg * mDmg), owned && lvl > 1 ? `×${mDmg.toFixed(2)}` : '') +
    statBox(t('common.rate'), (x.rate).toFixed(2) + '/s', '') +
    statBox(t('common.range'), (x.range * mRange).toFixed(2), '') +
    statBox(t('common.cost'), '💰' + x.cost, x.air ? '🦅 AIR' : '');
  body.appendChild(stats);
  body.insertAdjacentHTML('beforeend', `<div class="detail-desc" style="--rc:${RARITY_COLOR[x.rarity]}">${tData(x, 'desc')}</div>`);
  body.insertAdjacentHTML('beforeend', skillBox('⚙', t('towers.mech'), mechText(x)));

  const foot = [];
  if (!owned) {
    foot.push(el('button', 'btn', `🔒 ${t('towers.via') || 'Summon'}`));
    foot[foot.length - 1].onclick = () => bus.emit('nav:go', 'summon');
  } else {
    const upCost = ST.towerUpCost(tid);
    if (upCost) {
      const b = el('button', 'btn btn-gold', `⬆ ${t('common.upgrade')} · ${Object.entries(upCost).map(([k, n]) => `${ico(k, 14)}${fmt(n)}`).join(' ')}`);
      b.onclick = () => {
        if (ST.upgradeTower(tid)) { sfx.upgrade(); toast(`${tData(x, 'name')} → Lv.${ST.towerLvl(tid)}`, 'good', '⬆'); ST.bumpSession('upgrades'); bus.emit('state'); rerender?.(); }
        else { sfx.error(); toast(t('common.notenough'), 'bad', '💸'); }
      };
      foot.push(b);
    } else {
      const mx = el('button', 'btn', t('common.max')); mx.disabled = true; foot.push(mx);
    }
  }
  openModal({ title: tData(x, 'name'), body, foot, wide: true });
}

function mechText(x) {
  const m = x.mech || {};
  const bits = [];
  if (m.bleed) bits.push(`🩸 ${m.bleed.dps}/s ×${m.bleed.stack} stack (${m.bleed.dur}s)`);
  if (m.slow) bits.push(`❄ −${Math.round(m.slow.pct * 100)}% spd (${m.slow.dur}s)`);
  if (m.ricochet) bits.push(`↩ ricochet ×${m.ricochet}`);
  if (m.swarmBurst) bits.push(`🐜 burst vs swarms ×${m.swarmBurst}`);
  if (m.splash) bits.push(`💥 splash r=${m.splash}`);
  if (m.trueDmg) bits.push(`⚪ ${Math.round(m.trueDmg * 100)}% true dmg`);
  if (m.summon) bits.push(`🐾 summon ×${m.summon.count} ${m.summon.unit}${m.summon.hunt ? ' (hunt)' : ''} respawn ${m.summon.respawn}s`);
  if (m.cloud) bits.push(`☁ cloud ${m.cloud.dps}/s r=${m.cloud.radius} (${m.cloud.dur}s)`);
  if (m.knock) bits.push(`🔨 knockback ${m.knock.dist} + stun ${m.knock.stun}s${m.knock.heavyImmune ? ' (heavy immune)' : ''}`);
  if (m.blessAura) bits.push(`🙏 aura +${Math.round(m.blessAura.atkSpd * 100)}% atk spd, heals hero ${m.blessAura.healHero}`);
  if (m.holyBolt) bits.push(`✨ smite undead ${m.holyBolt}`);
  if (m.buffAura) bits.push(`📈 aura r=${m.buffAura.radius}: +${Math.round(m.buffAura.dmg * 100)}% dmg +${Math.round(m.buffAura.atkSpd * 100)}% spd`);
  if (m.crit) bits.push(`🎯 crit ${Math.round(m.crit.chance * 100)}% ×${m.crit.mult}`);
  if (m.bossBonus) bits.push(`👑 +${Math.round(m.bossBonus * 100)}% vs bosses`);
  if (m.chain) bits.push(`⚡ chain ×${m.chain.count} (${Math.round((1 - m.chain.falloff) * 100)}% falloff)`);
  if (m.pierceArmor) bits.push(`🗡 pierce ${Math.round(m.pierceArmor * 100)}% armor`);
  if (m.airBonus) bits.push(`🦅 +${Math.round(m.airBonus * 100)}% vs air`);
  if (m.execute) bits.push(`⚰ execute <${Math.round(m.execute * 100)}% HP`);
  if (m.goldGen) bits.push(`💰 +${m.goldGen}g/cycle, +${m.goldPerKillNear}g per nearby kill`);
  if (m.lavaPool) bits.push(`🌋 lava ${m.lavaPool.dps}/s r=${m.lavaPool.radius} (${m.lavaPool.dur}s)`);
  if (m.nova) bits.push(`💫 nova r=${m.nova.radius}${m.nova.reveal ? ', reveals' : ''}${m.nova.undeadBonus ? `, +${Math.round(m.nova.undeadBonus * 100)}% vs undead` : ''}`);
  if (m.stormStrikes) bits.push(`🌩 ${m.stormStrikes.count} strikes, ${Math.round(m.stormStrikes.stunChance * 100)}% stun`);
  if (m.pull) bits.push(`🌀 pull ${m.pull.dist}`);
  if (m.shred) bits.push(`✂ shred −${Math.round(m.shred.pct * 100)}% armor (${m.shred.dur}s)`);
  return bits.join(' · ') || tData(x, 'desc');
}
