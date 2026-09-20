// ============================================================
// GTDM battle UI — canvas host, HUD, slot popups, results
// ============================================================
import { el, clear, fmt, clamp, bus } from '../core/util.js';
import { t, tData } from '../core/i18n.js';
import { K, RARITY_COLOR } from '../data/defs.js';
import { TOWER_MAP } from '../data/towers.js';
import { HERO_MAP, HEROES } from '../data/heroes.js';
import { BOSS_MAP } from '../data/enemies.js';
import { PROOF_REWARDS } from '../data/stages.js';
import { getSprite, portrait } from '../game/sprites.js';
import { Battle } from '../game/battle.js';
import { sfx, playMusic } from '../core/audio.js';
import * as ST from '../game/state.js';
import { confirmDialog, toast, rewardItemsHTML } from './modal.js';

let cur = null; // active battle UI session

export function isBattling() { return !!cur; }

// cfg: {mode, stage, draft?, mods?, onExit}
export function startBattle(cfg) {
  if (cur) return;
  const battleRoot = document.getElementById('battle');
  const scene = document.getElementById('scene');
  const topbar = document.getElementById('topbar');
  const navbar = document.getElementById('navbar');
  scene.classList.add('hidden');
  topbar.classList.add('hidden');
  navbar.classList.add('hidden');
  battleRoot.classList.remove('hidden');
  clear(battleRoot);

  // ----- box + canvas -----
  const box = el('div');
  box.id = 'battleBox';
  box.style.cssText = 'position:relative;';
  const canvas = document.createElement('canvas');
  canvas.id = 'gameCanvas';
  box.appendChild(canvas);
  const hud = el('div');
  hud.id = 'battleHud';
  box.appendChild(hud);
  battleRoot.appendChild(box);

  const Q = Math.min(2, window.devicePixelRatio || 1);
  function fit() {
    const vw = window.innerWidth, vh = window.innerHeight;
    let cw = vw, chh = vw * 9 / 16;
    if (chh > vh) { chh = vh; cw = vh * 16 / 9; }
    box.style.width = cw + 'px';
    box.style.height = chh + 'px';
    canvas.style.width = cw + 'px';
    canvas.style.height = chh + 'px';
    canvas.width = Math.round(K.W * Q);
    canvas.height = Math.round(K.H * Q);
    if (session.battle) session.battle.ctx.setTransform(Q, 0, 0, Q, 0, 0);
    session.scale = cw / K.W;
  }

  const session = { cfg, battle: null, scale: 1, popup: null, ended: false, box, canvas, hud };
  cur = session;
  window.addEventListener('resize', fit);
  session.cleanupFns = [() => window.removeEventListener('resize', fit)];

  // ----- create battle -----
  const battle = new Battle({
    mode: cfg.mode,
    stage: cfg.stage,
    canvas,
    stateRef: ST.S,
    mods: cfg.mods,
    draft: cfg.draft,
    team: ST.S.team,
    ownsTower: id => ST.ownsTower(id),
    towerMetaLvl: id => ST.towerLvl(id),
    refineBonus: id => 1 + (ST.S.towers[id]?.refine || 0) * 0.02,
    heroLvl: id => ST.heroLvl(id),
    heroAwaken: id => ST.heroAwaken(id),
    abilityLvl: id => ST.abilityLvl(id),
    abilityUnlocked: id => ST.abilityUnlocked(id),
    codexUnlock: id => ST.codexUnlock(id),
    onSlotSelect: slot => showSlotPopup(slot),
    onEnd: (won, payload) => onBattleEnd(won, payload),
  });
  session.battle = battle;
  fit();

  // ----- pointer input -----
  const toLocal = e => {
    const r = canvas.getBoundingClientRect();
    const cx = (e.clientX ?? e.touches?.[0]?.clientX ?? 0);
    const cy = (e.clientY ?? e.touches?.[0]?.clientY ?? 0);
    return { x: (cx - r.left) / r.width * K.W, y: (cy - r.top) / r.height * K.H };
  };
  canvas.addEventListener('pointerdown', e => {
    e.preventDefault();
    const p = toLocal(e);
    battle.pointerDown(p.x, p.y);
    updatePopup();
  });
  canvas.addEventListener('pointermove', e => {
    const p = toLocal(e);
    battle.pointerMove(p.x, p.y);
  });
  window.addEventListener('pointerup', e => {
    const p = toLocal(e);
    battle.pointerUp(p.x, p.y);
    syncChips();
  });
  canvas.addEventListener('pointercancel', () => battle.pointerUp(-999, -999));

  buildHUD(session);
  battle.start();
  session.hudRaf = requestAnimationFrame(function hudLoop() {
    if (!cur) return;
    updateHUD();
    session.hudRaf = requestAnimationFrame(hudLoop);
  });
}

// ============================================================
// HUD
// ============================================================
function buildHUD(session) {
  const { hud, battle } = session;
  clear(hud);
  const hc = { lastGold: -1, lastLives: -1, lastWave: '', bbOpacity: -1, cards: [], abs: [], chips: [], popOpts: null };
  session.hudCache = hc;

  // ---- top ----
  const top = el('div', 'bh-top');
  top.innerHTML = `
    <div class="bh-lives" id="bhLives">❤️ ${battle.lives}</div>
    <div class="bh-gold" id="bhGold">💰 ${fmt(battle.gold)}</div>
    <div class="bh-wave" id="bhWave"></div>
    <div class="bh-speed">
      <button class="bh-sbtn on" data-spd="1">1×</button>
      <button class="bh-sbtn" data-spd="2">2×</button>
    </div>
    <button class="bh-x" id="bhExit">✕</button>`;
  hud.appendChild(top);
  hc.gold = top.querySelector('#bhGold');
  hc.lives = top.querySelector('#bhLives');
  hc.wave = top.querySelector('#bhWave');
  top.querySelectorAll('.bh-sbtn').forEach(b => b.onclick = () => {
    battle.setSpeed(Number(b.dataset.spd));
    top.querySelectorAll('.bh-sbtn').forEach(o => o.classList.toggle('on', o === b));
  });
  top.querySelector('#bhExit').onclick = () => {
    battle.pause();
    confirmDialog(t('battle.exit') || 'Exit battle?', t('battle.exitWarn') || 'Progress in this battle will be lost.', () => {
      endSession(false, null);
    }, t('common.confirm'), t('common.cancel'));
    setTimeout(() => battle.resume(), 100);
  };

  // ---- boss bar ----
  const bb = el('div', 'bossbar');
  bb.id = 'bossBar';
  bb.style.opacity = '0';
  bb.innerHTML = `<div class="bb-name" id="bbName"></div>
    <div class="bb-track"><div class="bb-fill" id="bbFill" style="width:100%"></div>
    <div class="bb-txt" id="bbTxt"></div></div>`;
  hud.appendChild(bb);
  hc.bb = bb;
  hc.bbFill = bb.querySelector('#bbFill');
  hc.bbName = bb.querySelector('#bbName');
  hc.bbTxt = bb.querySelector('#bbTxt');

  // ---- call wave button ----
  const cw = el('button', 'btn btn-gold next-wave-btn hidden');
  cw.id = 'callWaveBtn';
  hud.appendChild(cw);
  cw.onclick = () => battle.callWaveEarly();
  hc.cw = cw;

  // ---- abilities ----
  const abWrap = el('div', 'bh-abilities');
  abWrap.id = 'abilityBar';
  Object.values(battle.abilities).forEach(a => {
    const b = el('button', 'ab-btn');
    b.dataset.ab = a.id;
    b.innerHTML = `<span class="ab-ico">${a.def.icon}</span><span class="ab-key">${tData(a.def, 'name').split(' ')[0]}</span><div class="ab-cd hidden"></div>`;
    b._cdEl = b.querySelector('.ab-cd');
    b._ready = null; b._armed = null;
    b.onclick = () => { battle.armAbility(a.id); syncAbilities(); };
    abWrap.appendChild(b);
    hc.abs.push(b);
  });
  hud.appendChild(abWrap);

  // ---- bottom: build tray + heroes ----
  const bottom = el('div', 'bh-bottom');
  bottom.id = 'bhBottom';
  // hero chips first (left)
  const heroStrip = el('div', 'bh-heros');
  heroStrip.id = 'heroStrip';
  battle.heroes.forEach((h, i) => {
    const chip = el('div', 'hero-chip r-' + h.def.rarity);
    chip.dataset.hidx = i;
    chip.innerHTML = `<div class="hc-skill"><i></i></div><div class="hc-key">${i + 1}</div>`;
    chip._fill = chip.querySelector('.hc-skill i');
    const cv = document.createElement('canvas');
    cv.width = 88; cv.height = 88;
    cv.getContext('2d').drawImage(portrait(h.def.sprite, 88, false), 0, 0);
    chip.prepend(cv);
    // drag handlers
    chip.addEventListener('pointerdown', e => {
      e.preventDefault();
      if (h.deployed) {
        // undeploy to move: start drag from field position instead
      }
      battle.startHeroDragFromChip(i);
      const move = ev => {
        const r = session.canvas.getBoundingClientRect();
        battle.pointerMove((ev.clientX - r.left) / r.width * K.W, (ev.clientY - r.top) / r.height * K.H);
      };
      const up = ev => {
        const r = session.canvas.getBoundingClientRect();
        battle.pointerUp((ev.clientX - r.left) / r.width * K.W, (ev.clientY - r.top) / r.height * K.H);
        window.removeEventListener('pointermove', move);
        window.removeEventListener('pointerup', up);
        syncChips();
      };
      window.addEventListener('pointermove', move);
      window.addEventListener('pointerup', up);
    });
    heroStrip.appendChild(chip);
    hc.chips.push(chip);
  });
  bottom.appendChild(heroStrip);
  // build cards
  battle.buildable.forEach(id => {
    const def = TOWER_MAP[id];
    const card = el('div', 'build-card r-' + def.rarity);
    card.dataset.tid = id;
    card.innerHTML = `<div class="bc-name">${tData(def, 'name')}</div><div class="bc-cost">💰<span>${battle.towerCost(id)}</span></div>`;
    const cv = document.createElement('canvas');
    cv.width = 92; cv.height = 92;
    cv.getContext('2d').drawImage(getSprite(id, 'idle', 0, 92), 0, 0);
    card.prepend(cv);
    card.onclick = () => {
      battle.selBuild = battle.selBuild === id ? null : id;
      battle.selSlot = null;
      hidePopup();
      sfx.click();
      syncTray();
    };
    bottom.appendChild(card);
    hc.cards.push(card);
  });
  hud.appendChild(bottom);
  syncChips(); syncTray(); syncAbilities();
}

// ---- boss intro ceremony ----
function showBossIntro(boss) {
  if (!cur) return;
  const { box } = cur;
  const card = el('div', 'boss-intro');
  const art = el('div', 'bi-art');
  const cv = document.createElement('canvas');
  cv.width = 176; cv.height = 176;
  cv.style.cssText = 'width:88px;height:88px';
  cv.getContext('2d').drawImage(portrait(boss.def.sprite, 176, true), 0, 0);
  art.appendChild(cv);
  const info = el('div', 'bi-info');
  info.innerHTML = `
    <div class="bi-name">${boss.bossName}</div>
    <div class="bi-title">${boss.bossTitle}</div>
    <div class="bi-attr">${attrTagHTML(boss.def.attr)}</div>`;
  card.appendChild(art);
  card.appendChild(info);
  box.appendChild(card);
  sfx.bossRoar?.();
  setTimeout(() => { card.classList.add('out'); setTimeout(() => card.remove(), 600); }, 2600);
}
function attrTagHTML(attr) {
  return `<span class="atag a-${attr}"><span class="adot"></span>${t('attr.' + attr)}</span>`;
}

function hidePopup() {
  if (cur?.popup) { cur.popup.remove(); cur.popup = null; }
  if (cur?.hudCache) cur.hudCache.popOpts = null;
}
function updatePopup() { /* popup closes on canvas tap via onSlotSelect(null) */ }

function showSlotPopup(slot) {
  if (!cur) return;
  hidePopup();
  if (!slot) return;
  const { battle, box } = cur;
  const pop = el('div', 'slot-info');
  if (slot.tower) {
    const tw = slot.tower;
    const def = tw.def;
    const upCost = tw.upgradeCost();
    pop.innerHTML = `
      <div class="si-head">
        <span class="atag a-${def.attr}"><span class="adot"></span>${t('attr.' + def.attr)}</span>
        <span class="si-name rtext" style="--rc:${RARITY_COLOR[def.rarity]}">${tData(def, 'name')}</span>
        <span class="si-lv">Lv.${tw.lvl}${tw.lvl >= K.INBATTLE_MAX ? ' ★' : ''}</span>
      </div>
      <div class="si-stats">
        <span>⚔ ${Math.round(tw.dmg)}</span><span>⚡ ${(tw.rate).toFixed(2)}/s</span><span>🎯 ${(tw.range / K.TILE).toFixed(1)}</span>
        <span>🎯 <b id="siMode">${['FIRST', 'LAST', 'STRONG', 'CLOSE'][tw.targetMode]}</b></span>
      </div>
      <div class="si-btns">
        ${tw.disabled > 0 ? `<button class="btn btn-sm" disabled>⛔ ${tw.disabled.toFixed(1)}s</button>` : ''}
        <button class="btn btn-sm" id="siMode2">🔄</button>
        ${upCost !== null ? `<button class="btn btn-sm btn-gold" id="siUp">⬆ 💰${upCost}</button>` : `<button class="btn btn-sm" disabled>${t('battle.maxlvl')}</button>`}
        <button class="btn btn-sm btn-red" id="siSell">${t('common.sell')} 💰${tw.sellValue}</button>
      </div>`;
    setTimeout(() => {
      pop.querySelector('#siUp') && (pop.querySelector('#siUp').onclick = () => {
        if (battle.upgradeTower(tw)) showSlotPopup(slot); else toast(t('common.notenough'), 'bad', '💸');
      });
      pop.querySelector('#siSell').onclick = () => { battle.sellTower(tw); hidePopup(); battle.selSlot = null; };
      const m1 = pop.querySelector('#siMode'), m2 = pop.querySelector('#siMode2');
      if (m2) m2.onclick = () => { battle.cycleTargetMode(tw); if (m1) m1.textContent = ['FIRST', 'LAST', 'STRONG', 'CLOSE'][tw.targetMode]; };
    }, 0);
  } else {
    // build menu
    const opts = battle.buildable.map(id => {
      const def = TOWER_MAP[id];
      const cost = battle.towerCost(id);
      const ok = battle.gold >= cost;
      return `<button class="build-opt ${ok ? '' : 'cant'}" data-id="${id}" style="--rc:${RARITY_COLOR[def.rarity]}">
        <img-c></img-c><span class="bo-n">${tData(def, 'name')}</span><span class="bo-c ${ok ? '' : 'bc-lack'}">💰${cost}</span></button>`;
    }).join('');
    pop.innerHTML = `<div class="si-head"><span class="si-name">${t('battle.build')}</span></div>
      <div class="build-opts">${opts}</div>`;
    // draw sprites into buttons + cache for affordability sync
    const h = cur.hudCache;
    h.popOpts = [];
    setTimeout(() => {
      if (!cur || cur.popup !== pop) return;
      pop.querySelectorAll('.build-opt').forEach(b => {
        const id = b.dataset.id;
        const cv = document.createElement('canvas');
        cv.width = 64; cv.height = 64;
        cv.style.cssText = 'width:34px;height:34px';
        cv.getContext('2d').drawImage(getSprite(id, 'idle', 0, 64), 0, 0);
        b.querySelector('img-c')?.replaceWith(cv);
        b.onclick = () => {
          if (battle.buildAt(slot, id)) { hidePopup(); battle.selSlot = null; battle.selBuild = null; }
          else { sfx.error(); toast(t('common.notenough'), 'bad', '💸'); }
        };
        h.popOpts.push(b);
      });
      syncTray();
    }, 0);
  }
  // position near slot (screen coords)
  const sc = cur.scale;
  let px = slot.x * sc, py = slot.y * sc;
  box.appendChild(pop);
  const pw = pop.offsetWidth || 260, ph = pop.offsetHeight || 120;
  px = clamp(px - pw / 2, 6, box.clientWidth - pw - 6);
  py = clamp(py - ph - 34, 6, box.clientHeight - ph - 6);
  pop.style.left = px + 'px';
  pop.style.top = py + 'px';
  cur.popup = pop;
}

// ---- HUD sync (every frame) ----
function updateHUD() {
  if (!cur) return;
  const { battle } = cur;
  const h = cur.hudCache;
  if (!h) return;
  if (battle.gold !== h.lastGold) {
    h.gold.textContent = '💰 ' + fmt(battle.gold);
    if (battle.gold > h.lastGold && h.lastGold >= 0) { h.gold.classList.remove('gain'); void h.gold.offsetWidth; h.gold.classList.add('gain'); }
    h.lastGold = battle.gold;
  }
  if (battle.lives !== h.lastLives) { h.lives.textContent = '❤️ ' + battle.lives; h.lastLives = battle.lives; }
  const wt = battle.phase === 'prep'
    ? t('battle.nextNow', { n: battle.wave + 1 }) + ` · ${Math.ceil(battle.prepLeft)}s`
    : t('battle.wave', { a: battle.wave, b: battle.nWaves });
  if (wt !== h.lastWave) { h.wave.textContent = wt; h.lastWave = wt; }
  // call wave button
  if (battle.phase === 'prep' && !cur.ended) {
    if (h.cw.classList.contains('hidden')) h.cw.classList.remove('hidden');
    const bonus = Math.round(battle.prepLeft * (6 + battle.regionIdx * 2));
    const lbl = t('battle.next', { g: bonus });
    if (h.cw.textContent !== lbl) h.cw.textContent = lbl;
  } else if (!h.cw.classList.contains('hidden')) h.cw.classList.add('hidden');
  // boss bar
  const b = battle.boss;
  if (b && !b.dead && b.bossData) {
    if (h.bbOpacity !== 1) { h.bb.style.opacity = '1'; h.bbOpacity = 1; }
    const pct = clamp(b.hp / b.maxHp, 0, 1);
    h.bbFill.style.width = (pct * 100) + '%';
    const nm = `👑 ${b.bossName} — ${b.bossTitle}`;
    if (h.bbName.textContent !== nm) h.bbName.textContent = nm;
    h.bbTxt.textContent = `${fmt(b.hp)} / ${fmt(b.maxHp)}`;
  } else if (h.bbOpacity !== 0) { h.bb.style.opacity = '0'; h.bbOpacity = 0; }
  // boss intro ceremony (once per boss)
  if (battle.boss && !battle.boss.dead && h.lastBoss !== battle.boss) {
    h.lastBoss = battle.boss;
    showBossIntro(battle.boss);
  }
  syncTray();
  syncAbilities();
  syncChips();
}

function syncTray() {
  const h = cur.hudCache;
  const { battle } = cur;
  for (const c of h.cards) {
    const ok = battle.gold >= battle.towerCost(c.dataset.tid);
    if (c._ok !== ok) { c.classList.toggle('cant', !ok); c._ok = ok; }
    const sel = battle.selBuild === c.dataset.tid;
    if (c._sel !== sel) { c.classList.toggle('sel', sel); c._sel = sel; }
  }
  if (cur.popup && h.popOpts) {
    for (const b of h.popOpts) {
      const ok = battle.gold >= battle.towerCost(b.dataset.id);
      if (b._ok !== ok) {
        b.classList.toggle('cant', !ok);
        b.querySelector('.bo-c')?.classList.toggle('bc-lack', !ok);
        b._ok = ok;
      }
    }
  }
}
function syncAbilities() {
  const h = cur.hudCache;
  const { battle } = cur;
  for (const b of h.abs) {
    const a = battle.abilities[b.dataset.ab];
    if (!a) continue;
    const cd = b._cdEl;
    const ready = a.cd <= 0;
    if (b._ready !== ready) {
      b.classList.toggle('ready', ready);
      b.classList.toggle('cooling', !ready);
      b._ready = ready;
    }
    if (b._armed !== !!a.armed) { b.classList.toggle('armed', !!a.armed); b._armed = !!a.armed; }
    if (ready) { if (!cd.classList.contains('hidden')) cd.classList.add('hidden'); }
    else {
      if (cd.classList.contains('hidden')) cd.classList.remove('hidden');
      const secs = Math.ceil(a.cd);
      if (cd.textContent != secs) cd.textContent = secs;
      cd.style.setProperty('--cd', (a.cd / a.maxCd) + 'turn');
    }
  }
}
function syncChips() {
  const h = cur.hudCache;
  const { battle } = cur;
  battle.heroes.forEach((hero, i) => {
    const c = h.chips[i];
    if (!c) return;
    const dep = hero.deployed && !battle.dragHero;
    if (c._dep !== dep) { c.classList.toggle('deployed', dep); c._dep = dep; }
    const pct = (1 - clamp(hero.skillCd / hero.skillMax, 0, 1)) * 100;
    if (c._fill && Math.abs((c._pct ?? -1) - pct) > 1) { c._fill.style.width = pct + '%'; c._pct = pct; }
  });
}

// ============================================================
// END OF BATTLE
// ============================================================
function onBattleEnd(won, payload) {
  if (!cur || cur.ended) return;
  cur.ended = true;
  hidePopup();
  const { battle, cfg } = cur;
  // ---- compute rewards ----
  let rewards = [];
  let stars = 0;
  let extraHTML = '';
  let title = won ? t('battle.win') : t('battle.lose');
  const mode = cfg.mode;

  if (mode === 'campaign') {
    const stageId = cfg.stage.id;
    if (won) {
      const res = ST.recordStageWin(stageId, battle.lives, battle.maxLives, payload);
      stars = res.stars;
      rewards.push({ id: 'gold', n: cfg.stage.rewards.gold });
      ST.addCur('gold', cfg.stage.rewards.gold, true);
      if (res.first && cfg.stage.rewards.first) {
        for (const k in cfg.stage.rewards.first) {
          const n = cfg.stage.rewards.first[k];
          if (n > 0) { rewards.push({ id: k, n }); ST.addCur(k, n, true); }
        }
        extraHTML += `<div class="txt-gold fw9" style="text-align:center;margin-bottom:4px">✨ ${t('result.firstclear')} ✨</div>`;
      }
      // unlock notices
      const unlocked = [];
      if (stageId === 5) unlocked.push(t('ab.meteor'));
      if (stageId === 5) { ST.S.unlocks.daily = true; unlocked.push(t('mode.daily')); }
      if (stageId === 10) { ST.S.unlocks.proof = true; unlocked.push(t('mode.proof')); }
      if (stageId === 15) { ST.S.unlocks.sweep = true; unlocked.push(t('stages.sweep')); }
      if (stageId === 30) { ST.S.unlocks.bossrush = true; unlocked.push(t('mode.bossrush')); }
      HERO_LIST_CHECK(stageId, unlocked);
      if (unlocked.length) extraHTML += `<div style="text-align:center;color:var(--green);font-weight:800;margin-top:6px">🔓 ${unlocked.join(' · ')}</div>`;
    } else {
      ST.recordStageLoss(stageId, payload);
      const con = Math.round(cfg.stage.rewards.gold * 0.25);
      rewards.push({ id: 'gold', n: con });
      ST.addCur('gold', con, true);
    }
  } else if (mode === 'proof') {
    const floor = cfg.stage.proofFloor;
    if (won) {
      ST.recordProof(floor, payload);
      const rew = [{ id: 'mileage', n: 8 + floor * 3 }, { id: 'gold', n: 500 * Math.pow(1.15, Math.min(30, floor)) | 0 }];
      if (floor % 5 === 0) rew.push(...PROOF_REWARDS(floor));
      rew.forEach(r => { rewards.push(r); ST.addCur(r.id, r.n, true); });
      title = t('proof.floor', { n: floor }) + ' ✓';
      extraHTML += `<div style="text-align:center;color:var(--purple);font-weight:900">${t('proof.best')}: ${Math.max(ST.S.proof.best, floor)}</div>`;
    } else {
      ST.recordProof(Math.max(0, floor - 1), payload);
      title = t('proof.floor', { n: floor }) + ' ✗';
    }
  } else if (mode === 'daily') {
    const score = (payload.wave ?? 0) * 120 + (payload.kills ?? 0) * 2 + (won ? 500 : 0);
    ST.recordDaily(score, payload);
    if (won) {
      const rew = [{ id: 'diamond', n: 60 }, { id: 'magic', n: 6 }, { id: 'mileage', n: 60 }, { id: 'gold', n: 4000 }];
      if (battle.lives >= battle.maxLives) rew.push({ id: 'soul', n: 5 }, { id: 'card', n: 3 });
      rew.forEach(r => { rewards.push(r); ST.addCur(r.id, r.n, true); });
      extraHTML += `<div style="text-align:center;color:var(--blue);font-weight:900">${t('daily.score')}: ${fmt(score)}</div>`;
    } else {
      rewards.push({ id: 'mileage', n: 20 });
      ST.addCur('mileage', 20, true);
    }
  } else if (mode === 'bossrush') {
    const bossId = cfg.stage.bossRush;
    if (won) {
      ST.recordBossRush(bossId, true, payload);
      const bDef = BOSS_MAP[bossId];
      const rew = [{ id: 'ruby', n: 15 + bDef.region * 6 }, { id: 'soul', n: 4 + bDef.region * 3 }, { id: 'gold', n: 2000 * (bDef.region + 1) }];
      rew.forEach(r => { rewards.push(r); ST.addCur(r.id, r.n, true); });
    } else ST.recordBossRush(bossId, false, payload);
  }
  ST.persistNow();
  showResult(won, title, stars, rewards, extraHTML, payload);
}

function HERO_LIST_CHECK(stageId, unlocked) {
  HEROES.forEach(h => {
    if (typeof h.unlock === 'string' && h.unlock.startsWith('stage')) {
      const n = parseInt(h.unlock.slice(5));
      if (stageId >= n && stageId - n < 1 && !ST.ownsHero(h.id)) {
        ST.grantHero(h.id);
        unlocked.push(`${tData(h, 'name')} 🦸`);
        ST.S.mail.push(ST.mkMail('hero' + h.id,
          { vi: `Anh hùng ${tData(h, 'name')} gia nhập!`, en: `Hero ${tData(h, 'name')} has joined!` },
          { vi: 'Một anh hùng mới đã nghe danh tiếng của ngươi và xin gia nhập đội quân!', en: 'A new hero, drawn by your legend, has joined your cause!' },
          [{ id: 'ruby', n: 10 }], '🦸'));
      }
    }
  });
}

function showResult(won, title, stars, rewards, extraHTML, payload) {
  const { box, cfg, battle } = cur;
  const wrap = el('div', 'result-wrap');
  const starHTML = stars ? `<div class="result-stars">${[1, 2, 3].map(i =>
    `<span class="${i <= stars ? 'on' : ''}" style="animation-delay:${0.3 + i * 0.25}s">★</span>`).join('')}</div>` : '';
  const statsHTML = `<div class="result-stats">
    <span>☠️ <b>${payload.kills ?? 0}</b></span>
    <span>💰 <b>${fmt(payload.goldEarned ?? 0)}</b></span>
    <span>🌊 <b>${payload.wave ?? 0}/${battle.nWaves}</b></span>
    ${payload.leaks === 0 && won ? `<span class="txt-gold fw9">${t('battle.perfect')}</span>` : ''}
  </div>`;
  const rewHTML = rewards.length ? `<div style="text-align:center;font-size:12px;color:var(--text3);font-weight:800;margin-top:8px">${t('result.got')}</div>
    <div class="reward-items">${rewardItemsHTML(rewards)}</div>` : '';
  wrap.innerHTML = `<div class="result-card ${won ? '' : 'lose-card'}">
    <img class="result-emblem" src="assets/ui/emblem.svg" alt="">
    <div class="result-title ${won ? 'win' : 'lose'}">${title}</div>
    ${starHTML}${extraHTML}${statsHTML}${rewHTML}
    <div class="dsp-flex gap8 mt12" id="resBtns"></div>
  </div>`;
  box.appendChild(wrap);
  const btns = wrap.querySelector('#resBtns');
  const mk = (label, cls, fn) => { const b = el('button', 'btn ' + cls, label); b.onclick = fn; btns.appendChild(b); return b; };
  const goHome = () => endSession(true, () => cfg.onExit?.());
  if (won && cfg.mode === 'campaign' && cfg.stage.id < 200) {
    mk(t('battle.home'), '', goHome);
    mk(t('battle.nextStage'), 'btn-gold', () => {
      endSession(true, () => bus.emit('play:stage', cfg.stage.id + 1));
    });
  } else if (won && cfg.mode === 'proof') {
    mk(t('battle.home'), '', goHome);
    mk(t('proof.next'), 'btn-purple', () => {
      endSession(true, () => bus.emit('play:proof', cfg.stage.proofFloor + 1));
    });
  } else {
    mk(t('battle.home'), '', goHome);
    mk(t('battle.again'), won ? '' : 'btn-gold', () => {
      endSession(true, () => bus.emit('play:retry', cfg));
    });
  }
  // star sounds
  if (stars) [0, 1, 2].forEach(i => { if (i < stars) setTimeout(() => sfx.star(), 500 + i * 280); });
}

function endSession(playSound, after) {
  if (!cur) return;
  const s = cur;
  cur = null;
  s.battle.destroy();
  cancelAnimationFrame(s.hudRaf);
  s.cleanupFns.forEach(f => f());
  hidePopup();
  document.getElementById('battle').classList.add('hidden');
  document.getElementById('scene').classList.remove('hidden');
  document.getElementById('topbar').classList.remove('hidden');
  document.getElementById('navbar').classList.remove('hidden');
  playMusic('lobby');
  bus.emit('state');
  after?.();
}
