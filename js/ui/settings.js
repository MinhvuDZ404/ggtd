// ============================================================
// GTDM settings modal — language, audio, quality, reset
// ============================================================
import { el } from '../core/util.js';
import { t, setLang, getLang } from '../core/i18n.js';
import { audioCfg, setVolumes } from '../core/audio.js';
import { sfx } from '../core/audio.js';
import * as ST from '../game/state.js';
import { openModal, confirmDialog, toast } from './modal.js';

export function openSettings(onChanged) {
  const S = ST.S;
  const body = el('div');

  // language
  body.insertAdjacentHTML('beforeend', `
    <div class="setting-row">
      <div class="sr-t">🌐 ${t('settings.lang')}<div class="sr-d">Tiếng Việt / English</div></div>
      <div class="lang-switch" id="langSw">
        <button data-l="vi" class="${getLang() === 'vi' ? 'on' : ''}">VI</button>
        <button data-l="en" class="${getLang() === 'en' ? 'on' : ''}">EN</button>
      </div>
    </div>`);

  // music slider
  body.insertAdjacentHTML('beforeend', `
    <div class="setting-row">
      <div class="sr-t">🎵 ${t('settings.music')}</div>
      <input type="range" class="slider" id="musVol" min="0" max="1" step="0.05" value="${S.settings.music}">
    </div>`);

  // sfx slider
  body.insertAdjacentHTML('beforeend', `
    <div class="setting-row">
      <div class="sr-t">🔊 ${t('settings.sfx')}</div>
      <input type="range" class="slider" id="sfxVol" min="0" max="1" step="0.05" value="${S.settings.sfx}">
    </div>`);

  // quality
  body.insertAdjacentHTML('beforeend', `
    <div class="setting-row">
      <div class="sr-t">✨ ${t('settings.quality')}<div class="sr-d">${t('settings.hq')} / ${t('settings.lq')}</div></div>
      <div class="lang-switch" id="qSw">
        ${['high', 'med', 'low'].map(q => `<button data-q="${q}" class="${S.settings.quality === q ? 'on' : ''}">${t('quality.' + q)}</button>`).join('')}
      </div>
    </div>`);

  // toggles
  const toggles = [
    ['floatingDmg', '💥 Floating damage'],
    ['shake', '📳 Screen shake'],
  ];
  toggles.forEach(([key, label]) => {
    body.insertAdjacentHTML('beforeend', `
      <div class="setting-row">
        <div class="sr-t">${label}</div>
        <div class="toggle ${S.settings[key] !== false ? 'on' : ''}" data-k="${key}"><i></i></div>
      </div>`);
  });

  // about + reset
  body.insertAdjacentHTML('beforeend', `
    <div class="setting-row">
      <div class="sr-t">ℹ️ ${t('settings.about')}<div class="sr-d">GOLD TOWER DEFENCE M · v1.0 · ${S.stats.wins}W/${S.stats.losses}L · ★${S.stats.starsTotal}</div></div>
    </div>
    <div class="setting-row">
      <div class="sr-t" style="color:var(--red)">⚠️ ${t('settings.reset')}<div class="sr-d">${t('settings.resetWarn')}</div></div>
      <button class="btn btn-sm btn-red" id="resetBtn">RESET</button>
    </div>`);

  const m = openModal({ title: '⚙️ ' + t('settings.title'), body });

  // wire
  body.querySelector('#langSw').addEventListener('click', e => {
    const b = e.target.closest('button'); if (!b) return;
    setLang(b.dataset.l);
    S.settings.lang = b.dataset.l;
    ST.persistNow();
    sfx.click();
    m.close();
    toast(t('toast.saved'), 'good', '🌐');
    onChanged?.();
  });
  body.querySelector('#musVol').oninput = e => {
    S.settings.music = Number(e.target.value);
    audioCfg.music = Number(e.target.value);
    setVolumes();
    ST.persist();
  };
  body.querySelector('#sfxVol').oninput = e => {
    S.settings.sfx = Number(e.target.value);
    audioCfg.sfx = Number(e.target.value);
    setVolumes();
    ST.persist();
  };
  body.querySelector('#sfxVol').onchange = () => sfx.click();
  body.querySelector('#qSw').addEventListener('click', e => {
    const b = e.target.closest('button'); if (!b) return;
    S.settings.quality = b.dataset.q;
    ST.persistNow();
    body.querySelectorAll('#qSw button').forEach(o => o.classList.toggle('on', o === b));
    sfx.click();
    onChanged?.();
  });
  body.querySelectorAll('.toggle').forEach(tg => {
    tg.onclick = () => {
      const k = tg.dataset.k;
      S.settings[k] = S.settings[k] === false ? true : false;
      tg.classList.toggle('on', S.settings[k] !== false);
      ST.persistNow();
      sfx.click();
    };
  });
  body.querySelector('#resetBtn').onclick = () => {
    confirmDialog(t('settings.reset'), t('settings.resetWarn'), () => {
      ST.resetSave();
    }, 'RESET', t('common.cancel'));
  };
  return m;
}
