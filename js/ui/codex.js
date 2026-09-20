// ============================================================
// GTDM codex — bestiary of encountered enemies & lords
// ============================================================
import { el, clear, fmt, bus } from '../core/util.js';
import { t, tData } from '../core/i18n.js';
import { RARITY_COLOR } from '../data/defs.js';
import { ENEMIES, BOSSES, EXTRA_UNITS } from '../data/enemies.js';
import { sfx } from '../core/audio.js';
import * as ST from '../game/state.js';
import { openModal } from './modal.js';
import { artCanvas, attrTag, statBox } from './widgets.js';

let curTab = 'enemies';

export function renderCodex(scene) {
  clear(scene);
  const root = el('div', 'scene-root');
  scene.appendChild(root);

  const back = el('button', 'btn btn-sm', '◀ ' + t('lobby.more'));
  back.style.marginBottom = '10px';
  back.onclick = () => { sfx.back(); bus.emit('nav:go', 'lobby'); };
  root.appendChild(back);

  root.appendChild(el('div', 'sec-title', '📖 ' + t('codex.title')));

  const tabs = el('div', 'tab-row');
  [['enemies', `👹 ${t('codex.enemies')}`], ['bosses', `👑 ${t('codex.bosses')}`]].forEach(([id, label]) => {
    const b = el('button', 'tab-btn' + (curTab === id ? ' on' : ''), label);
    b.onclick = () => { curTab = id; sfx.click(); renderCodex(scene); };
    tabs.appendChild(b);
  });
  root.appendChild(tabs);

  const list = curTab === 'enemies' ? [...ENEMIES, ...EXTRA_UNITS] : BOSSES;
  const knownN = list.filter(e => ST.S.codex[e.id] || ST.S.codex['boss_' + e.id]).length;
  root.insertAdjacentHTML('beforeend',
    `<div class="txt-xs txt-mut" style="margin-bottom:10px">${t('codex.lore')} — ${knownN}/${list.length}</div>`);

  list.forEach(e => {
    const isBoss = curTab === 'bosses';
    const known = isBoss ? !!ST.S.codex['boss_' + e.id] : !!ST.S.codex[e.id];
    const item = el('div', 'codex-item' + (known ? '' : ' unknown'));
    const art = el('div', 'cx-art');
    art.appendChild(artCanvas(e.sprite, 52, { silhouette: !known }));
    const info = el('div');
    info.style.cssText = 'flex:1;min-width:0';
    info.innerHTML = known
      ? `<div class="cx-t">${tData(e, 'name')}</div><div class="cx-d">${attrTag(e.attr)} · ❤${fmt(e.hp)} · ⚔${e.dmg}${e.flying ? ' · 🦅' : ''}${e.undead ? ' · 💀' : ''}</div>`
      : `<div class="cx-t">${t('codex.unknown')}</div><div class="cx-d">？？？</div>`;
    item.appendChild(art);
    item.appendChild(info);
    item.onclick = () => { sfx.click(); if (known) codexDetail(e, isBoss); };
    root.appendChild(item);
  });
}

function codexDetail(e, isBoss) {
  const body = el('div');
  const art = el('div', 'detail-art');
  art.style.cssText = '--rc:' + (isBoss ? RARITY_COLOR.legendary : RARITY_COLOR.blue) + ';margin:0 auto 10px';
  art.appendChild(artCanvas(e.sprite, 120, { portrait: true, framed: true }));
  body.appendChild(art);
  body.insertAdjacentHTML('beforeend', `
    <div style="text-align:center"><div class="detail-name">${tData(e, 'name')}</div>
    ${e.title ? `<div class="txt-s txt-mut">${tData(e, 'title')}</div>` : ''}</div>
    ${e.desc ? `<div class="detail-desc" style="--rc:${isBoss ? RARITY_COLOR.legendary : RARITY_COLOR.blue}">${tData(e, 'desc')}</div>` : ''}
    <div class="stat-grid">
      ${statBox('❤ ' + t('common.hp'), fmt(e.hp))}
      ${statBox('⚔ ' + t('common.dmg'), e.dmg)}
      ${statBox('👟 SPD', (e.spd ?? 1).toFixed(2))}
      ${statBox('🛡 ARMOR', e.armor ?? 0)}
      ${statBox('🔮 MRES', Math.round((e.mres ?? 0) * 100) + '%')}
      ${statBox(attrTag(e.attr), t('attr.' + e.attr + '.desc'))}
    </div>
    ${isBoss && e.behaviors?.length ? `<div class="skill-box"><div class="sk-name">⚙ SKILLS</div><div class="sk-desc">${e.behaviors.map(b => '• ' + b).join('<br>')}</div></div>` : ''}`);
  openModal({ title: t('codex.title'), body, wide: true });
}
