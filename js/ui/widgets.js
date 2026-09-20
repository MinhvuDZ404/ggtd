// ============================================================
// GTDM shared UI widgets — sprite canvases, tags, cost chips
// ============================================================
import { el, fmt } from '../core/util.js';
import { t, tData } from '../core/i18n.js';
import { RARITY_COLOR, ATTR_ICON } from '../data/defs.js';
import { getSprite, portrait, getSilhouette } from '../game/sprites.js';
import { CUR_ICON } from './modal.js';
import { ico } from './icons.js';
import * as ST from '../game/state.js';

// canvas with a sprite drawn in (portrait framed or raw sprite)
export function artCanvas(id, size = 96, opts = {}) {
  const cv = document.createElement('canvas');
  const q = Math.min(2, window.devicePixelRatio || 1);
  cv.width = size * q; cv.height = size * q;
  cv.style.width = '100%'; cv.style.height = '100%';
  const ctx = cv.getContext('2d');
  ctx.scale(q, q);
  const src = opts.silhouette ? getSilhouette(id, 'idle', 0, size, '#9a90b8')
    : opts.portrait ? portrait(id, size, !!opts.framed)
      : getSprite(id, opts.pose || 'idle', 0, size);
  if (src) ctx.drawImage(src, (size - src.width) / 2, (size - src.height) / 2);
  return cv;
}

export function attrTag(attr) {
  return `<span class="atag a-${attr}"><span class="adot"></span>${ATTR_ICON[attr] || ''} ${t('attr.' + attr)}</span>`;
}

export function rarTag(rarity) {
  return `<span class="uc-rar">${t('rar.' + rarity)}</span>`;
}

export function starsHTML(n, max = 3) {
  let s = '';
  for (let i = 0; i < max; i++) s += i < n ? '★' : '☆';
  return s;
}

export function costTag(curId, n, afford) {
  return `<span class="cost-tag ${afford ? '' : 'lack'}">${ico(curId, 14)} ${fmt(n)}</span>`;
}

// unit card used by heroes/towers/codex grids
export function unitCard(def, opts = {}) {
  const owned = opts.owned;
  const card = el('div', `unit-card r-${def.rarity} ${owned ? 'owned' : 'notowned'}${opts.selected ? ' selected' : ''}${opts.awakened ? ' awakened' : ''}`);
  card.innerHTML = `
    <div class="uc-attr">${attrTag(def.attr)}</div>
    ${rarTag(def.rarity)}
    <div class="uc-art"></div>
    <div class="uc-name">${owned || opts.showName ? tData(def, 'name') : '???'}</div>
    ${opts.sub ? `<div class="uc-lvl">${opts.sub}</div>` : ''}
    ${opts.badge ? `<div class="uc-new">${opts.badge}</div>` : ''}
    ${opts.team ? `<div class="uc-team">${t('common.team')}</div>` : ''}`;
  card.querySelector('.uc-art').appendChild(
    artCanvas(def.sprite, 72, { portrait: true, silhouette: !(owned || opts.showName) }));
  if (opts.onclick) card.onclick = opts.onclick;
  return card;
}

// modal detail header: art + name + tags
export function detailTop(def, lvlText) {
  const wrap = el('div', `detail-top`);
  wrap.style.setProperty('--rc', RARITY_COLOR[def.rarity]);
  const art = el('div', `detail-art r-${def.rarity}`);
  art.appendChild(artCanvas(def.sprite, 120, { portrait: true, framed: true }));
  const info = el('div');
  info.innerHTML = `
    <div class="detail-name">${tData(def, 'name')}</div>
    <div class="detail-sub">${attrTag(def.attr)}<span class="chip" style="color:${RARITY_COLOR[def.rarity]};border-color:${RARITY_COLOR[def.rarity]}">${t('rar.' + def.rarity)}</span>${lvlText ? `<span class="chip">${lvlText}</span>` : ''}</div>
    ${def.role ? `<div class="txt-s txt-mut" style="margin-top:6px">${tData(def, 'role')}</div>` : ''}`;
  wrap.appendChild(art);
  wrap.appendChild(info);
  return wrap;
}

export function statBox(label, value, delta) {
  return `<div class="stat-box"><div class="sb-l">${label}</div><div class="sb-v">${value}</div>${delta ? `<div class="sb-d">${delta}</div>` : ''}</div>`;
}

export function skillBox(icon, name, desc) {
  return `<div class="skill-box"><div class="sk-name">${icon || '✦'} ${name}</div><div class="sk-desc">${desc}</div></div>`;
}

export function secTitle(txt) {
  return `<div class="sec-title">${txt}</div>`;
}

export function emptyNote(txt) {
  return `<div class="empty-note">${txt}</div>`;
}

// live currency readout used inside modals
export function curLine(ids) {
  return ids.map(id => `<span class="cost-tag ${ST.hasCur(id, 0) ? '' : ''}">${CUR_ICON[id]} <b data-cur="${id}">${fmt(ST.S.cur[id] || 0)}</b></span>`).join(' ');
}
