// ============================================================
// GTDM UI kit — modals, toasts, reward popups, confirm dialogs
// ============================================================
import { el, clear, fmt } from '../core/util.js';
import { t } from '../core/i18n.js';
import { CURRENCIES, RARITY_COLOR } from '../data/defs.js';
import { sfx } from '../core/audio.js';
import { ico } from './icons.js';

const layer = () => document.getElementById('modalLayer');
const toastLayer = () => document.getElementById('toastLayer');

export function openModal({ title, body, foot, wide = false, onClose, noX = false, cls = '' }) {
  const back = el('div', 'modal-back');
  const modal = el('div', 'modal ' + (wide ? 'wide ' : '') + cls);
  const head = el('div', 'modal-head');
  head.innerHTML = `<div class="modal-title">${title || ''}</div>`;
  if (!noX) {
    const x = el('button', 'modal-x', '✕');
    x.onclick = () => close();
    head.appendChild(x);
  }
  const bodyEl = el('div', 'modal-body');
  if (typeof body === 'string') bodyEl.innerHTML = body;
  else if (body) bodyEl.appendChild(body);
  modal.appendChild(head);
  modal.appendChild(bodyEl);
  let footEl = null;
  if (foot) {
    footEl = el('div', 'modal-foot');
    if (typeof foot === 'string') footEl.innerHTML = foot;
    else foot.forEach(b => footEl.appendChild(b));
    modal.appendChild(footEl);
  }
  const wrap = el('div');
  wrap.style.cssText = 'position:absolute;inset:0;display:flex;align-items:center;justify-content:center;pointer-events:none;z-index:101';
  wrap.appendChild(back);
  wrap.appendChild(modal);
  layer().appendChild(wrap);
  back.addEventListener('click', () => { if (!noX) close(); });
  function close() {
    sfx.back();
    wrap.style.transition = 'opacity .2s';
    wrap.style.opacity = '0';
    setTimeout(() => wrap.remove(), 200);
    onClose?.();
  }
  return { el: modal, body: bodyEl, foot: footEl, close };
}

export function confirmDialog(title, text, onYes, yesLabel, noLabel) {
  const yes = el('button', 'btn btn-red', yesLabel || t('common.confirm'));
  const no = el('button', 'btn', noLabel || t('common.cancel'));
  const m = openModal({ title, body: `<div style="font-size:14px;color:var(--text2);line-height:1.6">${text}</div>`, foot: [no, yes] });
  yes.onclick = () => { m.close(); onYes?.(); };
  no.onclick = () => m.close();
  return m;
}

export function toast(msg, kind = '', icon = '') {
  const tt = el('div', 'toast ' + (kind ? 't-' + kind : ''), `${icon ? '<span>' + icon + '</span>' : ''}<span>${msg}</span>`);
  toastLayer().appendChild(tt);
  setTimeout(() => { tt.classList.add('out'); setTimeout(() => tt.remove(), 320); }, 2200);
}

export const CUR_ICON = Object.fromEntries(CURRENCIES.map(c => [c.id, c.icon]));
export function curName(id) { return t('cur.' + id); }

// reward display: items = [{id:'gold', n:100} | {id:'tower', towerId} ...]
export function rewardItemsHTML(items) {
  return items.map((it, i) => {
    let icon = ico(it.id, 26) || '🎁', label = curName(it.id), val = '+' + fmt(it.n), rc = '#56468f';
    if (it.id === 'diamond') rc = '#4aa8f0';
    if (it.id === 'gold') rc = '#f5c542';
    if (it.id === 'ruby') rc = '#f0564a';
    if (it.id === 'soul') rc = '#4a78f0';
    if (it.id === 'magic') rc = '#a06bf0';
    if (it.id === 'mineral') rc = '#ff9a5c';
    if (it.id === 'mileage') rc = '#57d97a';
    if (it.id === 'card') rc = '#e0a520';
    return `<div class="reward-item" style="animation-delay:${i * 0.07}s">
      <div class="ri-box" style="--rc:${rc}">${icon}</div>
      <div class="ri-n">${val}</div><div class="ri-l">${label}</div></div>`;
  }).join('');
}

export function rewardPopup(title, items, onClose, extraHTML = '') {
  const body = el('div');
  body.innerHTML = `${extraHTML}<div class="reward-items">${rewardItemsHTML(items)}</div>`;
  const ok = el('button', 'btn btn-gold btn-lg', t('common.ok'));
  const m = openModal({ title, body, foot: [ok], onClose });
  ok.onclick = () => { m.close(); };
  setTimeout(() => sfx.bigCoin(), 150);
  return m;
}

// generic button helper
export function btn(label, cls = '', onclick) {
  const b = el('button', 'btn ' + cls, label);
  if (onclick) b.onclick = onclick;
  return b;
}

// sparkle click effect (juice!)
document.addEventListener('pointerdown', e => {
  const tgt = e.target.closest?.('.btn, .nav-btn, .build-card, .stage-node, .unit-card');
  if (!tgt) return;
  const s = el('div', 'sparkle', '✦');
  s.style.left = e.clientX + 'px';
  s.style.top = e.clientY + 'px';
  s.style.color = 'var(--gold2)';
  document.getElementById('fxLayer').appendChild(s);
  setTimeout(() => s.remove(), 800);
});
