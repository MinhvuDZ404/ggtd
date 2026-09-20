// ============================================================
// GTDM main — boot, scene router, topbar, global bus wiring
// ============================================================
import { el, clear, fmt, bus } from './core/util.js';
import { t, setLang, getLang } from './core/i18n.js';
import { initSave } from './core/save.js';
import { audioCfg, setVolumes, audioResume, playMusic, sfx } from './core/audio.js';
import { CURRENCIES, K } from './data/defs.js';
import { getStage, getDailyChallenge, getDailyStage, getProofFloor, getBossRushStage } from './data/stages.js';
import { TOWER_IDS, preloadSprites } from './game/sprites.js';
import { HEROES } from './data/heroes.js';
import * as ST from './game/state.js';
import { startBattle, isBattling } from './ui/battleui.js';
import { renderLobby, stopLobbyBanner } from './ui/lobby.js';
import { renderStages } from './ui/stages.js';
import { renderModes } from './ui/modes.js';
import { renderHeroes, renderTowers } from './ui/units.js';
import { renderSummon } from './ui/summon.js';
import { renderQuests, openMailModal } from './ui/quests.js';
import { renderCodex } from './ui/codex.js';
import { openSettings } from './ui/settings.js';
import { toast } from './ui/modal.js';
import { ico } from './ui/icons.js';

const scene = () => document.getElementById('scene');
let curScene = 'lobby';

// ============================================================
// BOOT
// ============================================================
async function boot() {
  const fill = document.getElementById('bootFill');
  const tip = document.getElementById('bootTip');
  const setP = p => { fill.style.width = p + '%'; };
  const tips = ['boot.tip1', 'boot.tip2', 'boot.tip3', 'boot.tip4', 'boot.tip5'];
  let ti = 0;
  tip.textContent = t(tips[0]);
  const tipTimer = setInterval(() => { ti = (ti + 1) % tips.length; tip.textContent = t(tips[ti]); }, 1600);
  setP(12);

  await initSave();
  setP(35);
  await ST.initState();
  setP(55);

  // apply saved settings
  const s = ST.S.settings;
  setLang(s.lang === 'en' ? 'en' : 'vi');
  audioCfg.music = s.music ?? 0.55;
  audioCfg.sfx = s.sfx ?? 0.8;
  audioCfg.muted = !!s.muted;
  setVolumes();

  // daily housekeeping
  ST.ensureMissions();
  ST.pruneMail();

  // preload lobby-relevant sprites (battle preloads its own)
  await new Promise(r => requestAnimationFrame(r));
  try {
    preloadSprites([...TOWER_IDS, ...HEROES.map(h => h.sprite)], ['idle'], 96);
  } catch (e) { console.warn('preload', e); }
  setP(88);
  await new Promise(r => setTimeout(r, 220));
  setP(100);

  clearInterval(tipTimer);
  wireTopbar();
  wireNav();
  wireBus();
  updateTopbar();

  const bootEl = document.getElementById('boot');
  bootEl.classList.add('fade');
  setTimeout(() => bootEl.remove(), 700);
  document.getElementById('topbar').classList.remove('hidden');
  document.getElementById('navbar').classList.remove('hidden');
  setScene('lobby');

  // audio unlocks on first interaction
  const unlock = () => { audioResume(); playMusic('lobby'); window.removeEventListener('pointerdown', unlock); window.removeEventListener('keydown', unlock); };
  window.addEventListener('pointerdown', unlock);
  window.addEventListener('keydown', unlock);

  // never lose progress
  window.addEventListener('beforeunload', () => ST.persistNow());
  document.addEventListener('visibilitychange', () => { if (document.hidden) ST.persistNow(); });
  setInterval(() => { if (!isBattling()) ST.persist(true); }, 30000);
}

// ============================================================
// TOPBAR
// ============================================================
let pillRefs = {};
function wireTopbar() {
  const wrap = document.getElementById('tbCurrencies');
  clear(wrap);
  pillRefs = {};
  CURRENCIES.forEach(c => {
    const p = el('div', 'cur-pill ' + c.id);
    p.innerHTML = `<span class="ci">${ico(c.id, 17)}</span><span class="cv">0</span>`;
    wrap.appendChild(p);
    pillRefs[c.id] = p.querySelector('.cv');
  });
  document.getElementById('btnMail').onclick = () => { sfx.click(); openMailModal(); };
  document.getElementById('btnSettings').onclick = () => {
    sfx.click();
    openSettings(() => { updateTopbar(); renderScene(); });
  };
}

function updateTopbar() {
  const S = ST.S;
  if (!S) return;
  for (const id in pillRefs) pillRefs[id].textContent = fmt(S.cur[id] || 0);
  document.getElementById('tbLevel').textContent = 'Lv.' + S.acct.lvl;
  document.getElementById('tbAvatar').textContent = S.acct.lvl;
  const need = K.xpFor(S.acct.lvl);
  document.getElementById('tbXpFill').style.width = Math.min(100, (S.acct.xp / need) * 100) + '%';
  const un = ST.unreadMail();
  const badge = document.getElementById('mailBadge');
  badge.textContent = un;
  badge.classList.toggle('hidden', un === 0);
}

// ============================================================
// NAV / ROUTER
// ============================================================
const VIEWS = {
  lobby: renderLobby,
  stages: renderStages,
  battlehub: renderModes,
  heroes: renderHeroes,
  towers: renderTowers,
  summon: renderSummon,
  quests: renderQuests,
  codex: renderCodex,
};

function wireNav() {
  document.querySelectorAll('#navbar .nav-btn').forEach(b => {
    b.onclick = () => { sfx.click(); setScene(b.dataset.nav); };
  });
}

export function setScene(name) {
  if (!VIEWS[name]) name = 'lobby';
  // cleanup previous scene resources
  stopLobbyBanner();
  scene()._cleanup?.();
  scene()._cleanup = null;
  curScene = name;
  document.querySelectorAll('#navbar .nav-btn').forEach(b =>
    b.classList.toggle('active', b.dataset.nav === name || (name === 'codex' && b.dataset.nav === 'lobby')));
  VIEWS[name](scene());
}

function renderScene() {
  if (!isBattling()) setScene(curScene);
}

// ============================================================
// GLOBAL BUS
// ============================================================
function wireBus() {
  bus.on('state', () => { updateTopbar(); renderScene(); });
  bus.on('cur', updateTopbar);
  bus.on('mail', updateTopbar);
  bus.on('nav:go', name => setScene(name));
  bus.on('lang', () => { updateTopbar(); renderScene(); });
  bus.on('team', () => { if (curScene === 'lobby' || curScene === 'heroes') renderScene(); });

  // ---------- battle launches ----------
  bus.on('play:stage', id => {
    const stage = getStage(id);
    startBattle({
      mode: 'campaign', stage,
      onExit: () => renderScene(),
    });
  });

  bus.on('play:daily', () => {
    const dc = getDailyChallenge();
    if (ST.S.daily.lastKey === dc.key && ST.S.daily.done) {
      toast(t('daily.done'), 'bad', '⏰');
      return;
    }
    const stage = getDailyStage(dc);
    startBattle({
      mode: 'daily', stage,
      mods: stage.mods, draft: stage.draft,
      onExit: () => renderScene(),
    });
  });

  bus.on('play:proof', floor => {
    const stage = getProofFloor(Math.max(1, floor || 1));
    startBattle({ mode: 'proof', stage, onExit: () => renderScene() });
  });

  bus.on('play:bossrush', bossId => {
    const stage = getBossRushStage(bossId);
    if (!stage) return;
    startBattle({ mode: 'bossrush', stage, onExit: () => renderScene() });
  });

  bus.on('play:retry', cfg => {
    if (!cfg) return;
    startBattle({ ...cfg, onExit: () => renderScene() });
  });
}

// ============================================================
boot().catch(err => {
  console.error('BOOT FAILED', err);
  const tip = document.getElementById('bootTip');
  if (tip) { tip.textContent = '⚠ ' + err.message; tip.style.color = '#ff8a7d'; }
});
