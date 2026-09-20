// ============================================================
// GTDM boss AI — phases, enrage, behavior interpreter
// Attaches to boss Enemy instances via e.bossData
// ============================================================
import { TAU, clamp, dist2, rgba, pick, shuffle, mulberry32 } from '../core/util.js';
import { K } from '../data/defs.js';
import { ENEMY_MAP, BOSSES } from '../data/enemies.js';
import { sfx, duckMusic, playMusic } from '../core/audio.js';
import { Hazard, setTimeout0, attrColor } from './entities.js';

const T = K.TILE;

export function attachBoss(B, e, bossDef, opts = {}) {
  const bd = {
    def: bossDef,
    phase: 0,
    phaseInvuln: 0,
    behaviors: (bossDef.behaviors || []).map(b => ({ ...b, t: (b.after ?? 2) + Math.random() * 2, done: false, left: b.count ?? 0 })),
    shieldActive: 0,         // damage reduction while >0
    deathGold: bossDef.behaviors?.find(x => x.type === 'deathGold')?.gold || 0,
    reviveLeft: bossDef.behaviors?.find(x => x.type === 'revive')?.count || 0,
    reviveDef: bossDef.behaviors?.find(x => x.type === 'revive'),
    attrShifting: !!bossDef.behaviors?.some(x => x.type === 'attrShift'),
    splitDone: new Set(),
    cloneDone: new Set(),
    echoesDone: false,
    obeliskShield: 0,
    enraged: 1,
    roarT: 0,
    isEcho: !!opts.echo,
  };
  e.bossData = bd;
  e.maxHp = Math.round(e.maxHp * (opts.hpMult || 1));
  e.hp = e.maxHp;
  const goldHit = bossDef.behaviors?.find(x => x.type === 'goldOnHit');
  if (goldHit) e.goldOnHit = { chance: goldHit.chance || 0.05, gold: Math.max(3, Math.round((goldHit.gold || 5) * (1 + B.regionIdx * 0.4))) };
  // bosses ignore normal leak dmg scaling? keep def dmg
  return bd;
}

export function updateBoss(B, e, dt) {
  const bd = e.bossData;
  if (!bd || e.dead) return;
  if (bd.phaseInvuln > 0) bd.phaseInvuln -= dt;
  if (bd.roarT > 0) bd.roarT -= dt;

  // ---- phases & enrage ----
  const pct = e.hp / e.maxHp;
  const phases = bd.def.phases || [{ at: 1 }];
  let newPhase = 0;
  for (let i = 0; i < phases.length; i++) if (pct <= phases[i].at) newPhase = i;
  if (newPhase !== bd.phase) {
    bd.phase = newPhase;
    const ph = phases[newPhase];
    if (ph.enrage) {
      e.speedBuffs = e.speedBuffs.filter(b => b.tag !== 'enrage');
      e.speedBuffs.push({ mult: ph.enrage, t: 1e9, tag: 'enrage' });
    }
    if (!bd.isEcho) {
      bd.phaseInvuln = 0.9;
      bd.roarT = 1.4;
      B.fx.shake(10, 0.6);
      B.fx.screenFlash(attrColor(e.attr), 0.3, 0.5);
      B.fx.ring(e.x, e.y - 30, { r: 140, color: '#ff5a4a', life: 0.8, lw: 6, fill: '#ff5a4a' });
      B.fx.burst(e.x, e.y - 30, { n: 30, color: '#ff9a5c', speed: 240, life: 0.8, size: 5, g: 200 });
      sfx.bossRoar();
      duckMusic(0.35, 0.6);
      B.onBossPhase?.(e, newPhase);
    }
  }
  // shield phase from obelisks
  if (bd.obeliskShield) {
    const alive = B.enemies.some(o => !o.dead && o.id === 'obelisk');
    bd.shieldActive = alive ? bd.obeliskShield : 0;
  }

  // ---- behaviors ----
  for (const b of bd.behaviors) {
    if (b.onlyPhase && bd.phase + 1 < b.onlyPhase) continue;
    if (b.at !== undefined) { // threshold behavior
      if (pct <= b.at && !b.done) { b.done = true; runBehavior(B, e, b, bd); }
      continue;
    }
    if (b.cd === undefined) { // passive (regen)
      if (b.type === 'regen' && !B.frozen) {
        e.hp = Math.min(e.maxHp, e.hp + e.maxHp * b.pct * dt);
      }
      continue;
    }
    if (B.frozen || B.freezeT > 0) continue; // boss AI pauses during freeze (fairness)
    b.t -= dt;
    if (b.t <= 0) {
      // phase3 upgrade of counts
      let bb = b;
      if (b.phase3 && bd.phase >= 2) bb = { ...b, ...b.phase3 };
      runBehavior(B, e, bb, bd);
      b.t = b.cd * (bd.phase >= 1 ? 0.85 : 1) * (0.85 + Math.random() * 0.3);
    }
  }
}

function runBehavior(B, e, b, bd) {
  const S = B.stateRef;
  switch (b.type) {
    case 'summon': {
      for (let i = 0; i < (b.count || 1); i++) {
        setTimeout0(B, i * 0.35, () => {
          if (e.dead) return;
          B.spawnEnemy(b.id, { d: Math.max(0, e.d - 30 - i * 20), quiet: true, elite: b.elite });
          B.fx.ring(e.x, e.y - 16, { r: 44, color: '#c05af0', life: 0.5, lw: 3 });
        });
      }
      sfx.magic();
      break;
    }
    case 'charge': {
      e.speedBuffs.push({ mult: b.mult || 2.5, t: b.dur || 1, tag: 'charge' });
      B.fx.burst(e.x, e.y - 20, { n: 12, color: '#ffd966', speed: 160, life: 0.5, size: 4, dir: e.ang + Math.PI, spread: 1.2 });
      sfx.boom(false);
      B.telegraph?.(e, 'charge');
      break;
    }
    case 'stomp': {
      B.fx.shake(8, 0.4);
      B.fx.ring(e.x, e.y, { r: T * 2.4, color: '#c8a24a', life: 0.5, lw: 5, fill: '#8a6a3a' });
      B.fx.smoke(e.x, e.y, { n: 10, color: '#8a7a6a', life: 0.7, size: 12 });
      for (const a of B.allies) {
        if (!a.dead && dist2(a.x, a.y, e.x, e.y) < (T * 2.4) ** 2) a.takeDamage(a.maxHp * 0.35, e);
      }
      // knockback light enemies? no — stun towers briefly? stomp = anti-blocker
      sfx.boom(true);
      break;
    }
    case 'howl': case 'icepath': case 'timewarp': {
      const mult = 1 + (b.mult || b.pct || 0.3);
      for (const o of B.enemies) {
        if (!o.dead) o.speedBuffs.push({ mult, t: b.dur || 5, tag: b.type });
      }
      const col = b.type === 'icepath' ? '#8fd8ff' : b.type === 'timewarp' ? '#c9a2ff' : '#ffd966';
      B.fx.ring(e.x, e.y - 20, { r: 400, color: col, life: 0.9, lw: 4 });
      B.fx.screenFlash(col, 0.16, 0.4);
      B.bannerText(b.type === 'timewarp' ? (B.t('boss.timewarp') || 'TIME WARP!') : b.type === 'icepath' ? (B.t('boss.icepath') || 'GLACIAL PATH!') : (B.t('boss.howl') || 'WAR HOWL!'), col);
      if (b.type === 'icepath') {
        // frost decals along path
        for (let d = 0; d < B.map.pathLen; d += 90) {
          const p = B.map.posAt(d);
          B.fx.decal(p.x, p.y, 26, '#8fd8ff', b.dur || 8, 'ice');
        }
      }
      sfx.bossRoar();
      break;
    }
    case 'poisonTower': {
      const towers = B.towers.filter(t => !t.disabled).sort((a, b2) => b2.dpsEst() - a.dpsEst());
      const targets = shuffle([...towers]).slice(0, b.count || 1);
      // prefer stronger ones for pressure but not always top
      targets.forEach(t => {
        t.rateDebuffT = b.dur || 4;
        t.rateDebuff = 0.5;
        B.fx.burst(t.x, t.y - 24, { n: 8, color: '#7dff5a', speed: 80, life: 0.6, size: 3.5 });
        B.fx.ring(t.x, t.y - 20, { r: 26, color: '#7dff5a', life: 0.5, lw: 2 });
      });
      if (targets.length) sfx.magic();
      break;
    }
    case 'obelisks': {
      bd.obeliskShield = b.reduction || 0.7;
      for (let i = 0; i < (b.count || 2); i++) {
        setTimeout0(B, i * 0.4, () => {
          if (e.dead) return;
          const ob = B.spawnEnemy('obelisk', { d: Math.max(0, e.d - 40 - i * 60), quiet: true, hpMult: 1 + B.regionIdx * 0.5 });
          if (ob) {
            B.fx.ring(ob.x, ob.y - 16, { r: 40, color: '#ffd966', life: 0.7, lw: 3, fill: '#ffd966' });
            B.fx.beam(e.x, e.y - 24, ob.x, ob.y - 16, { color: '#ffd966', life: 0.4, lw: 3 });
          }
        });
      }
      B.bannerText(B.t('boss.wards') || 'PROTECTIVE WARDS!', '#ffd966');
      sfx.upgrade();
      break;
    }
    case 'freezeSlots': disableRandomTowers(B, e, b.count || 2, b.dur || 4, 'ice', '#8fd8ff'); break;
    case 'acid': disableRandomTowers(B, e, b.count || 1, b.dur || 3, 'poison', '#7dff5a'); break;
    case 'root': disableTopTower(B, e, b.dur || 6, 'root', '#a8e06a'); break;
    case 'hex': disableTopTower(B, e, b.dur || 7, b.fx === 'sheep' ? 'sheep' : 'hex', '#ff8ad8'); break;
    case 'goldTouch': disableRandomTowers(B, e, b.count || 2, b.dur || 6, 'gold', '#ffd966'); B.bannerText(B.t('boss.goldtouch') || 'GOLDEN TOUCH!', '#ffd966'); break;
    case 'meteorSlots': {
      const towers = B.towers.filter(t => !t.disabled);
      const targets = shuffle([...towers]).slice(0, Math.min(b.count || 2, towers.length));
      targets.forEach((t, i) => {
        setTimeout0(B, i * 0.3, () => {
          // telegraph then strike
          B.fx.ring(t.x, t.y, { r: 34, color: b.fx === 'lightning' ? '#8fd8ff' : b.fx === 'holy' ? '#ffe9a8' : '#ff5a4a', life: 0.7, lw: 2 });
          setTimeout0(B, 0.7, () => {
            if (t.disabled) return;
            B.disableTower(t, b.dur || 4, b.fx === 'lightning' ? 'lightning' : 'meteor');
            if (b.fx === 'lightning') B.fx.lightningBolt(t.x, t.y - 260, t.y - 10, '#8fd8ff', 0.4);
            else {
              B.fx.burst(t.x, t.y - 20, { n: 16, color: '#ff9a3a', speed: 180, life: 0.6, size: 4, g: 300 });
              B.fx.decal(t.x, t.y, 30, '#241a14', 5, 'scorch');
            }
            B.fx.shake(6, 0.3);
            sfx.boom(false);
          });
        });
      });
      if (!targets.length) break;
      B.bannerText(B.t('boss.incoming') || 'INCOMING!', '#ff9a5c');
      break;
    }
    case 'slowTowers': {
      B.towerSlowDebuff = { pct: b.pct || 0.3, t: b.dur || 6 };
      B.fx.screenFlash('#8fd8ff', 0.18, 0.5);
      B.bannerText(B.t('boss.blizzard') || 'BLIZZARD!', '#8fd8ff');
      for (const t of B.towers) B.fx.burst(t.x, t.y - 24, { n: 4, color: '#cfeaff', speed: 50, life: 0.5, size: 2.5 });
      sfx.freeze();
      break;
    }
    case 'grabHero': {
      const heroes = B.heroes.filter(h => h.deployed && h.stunned <= 0);
      if (!heroes.length) break;
      const h = pick(heroes);
      h.stunned = b.dur || 5;
      B.grabFx = { hero: h, t: b.dur || 5 };
      B.fx.ring(h.x, h.y - 14, { r: 34, color: '#c05af0', life: 0.6, lw: 3 });
      B.bannerText(B.t('boss.grab') || 'HERO SNATCHED!', '#c05af0');
      sfx.leak();
      break;
    }
    case 'rift': {
      const dMid = B.map.pathLen * (0.45 + Math.random() * 0.2);
      const p = B.map.posAt(dMid);
      const hz = new Hazard(B, { kind: 'rift', x: p.x, y: p.y, r: 44, dur: b.dur || 12, color: '#c05af0', spawnId: b.id, pathD: dMid });
      B.hazards.push(hz);
      B.fx.ring(p.x, p.y - 14, { r: 60, color: '#c05af0', life: 0.8, lw: 4, fill: '#c05af0' });
      B.bannerText(B.t('boss.rift') || 'VOID RIFT OPENED!', '#c05af0');
      sfx.magic();
      break;
    }
    case 'teleport': {
      B.fx.smoke(e.x, e.y - 20, { n: 12, color: '#c05af0', life: 0.7 });
      e.d = Math.min(B.map.pathLen - 10, e.d + (b.tiles || 2.5) * T);
      e.updatePos();
      B.fx.ring(e.x, e.y - 20, { r: 60, color: '#c05af0', life: 0.6, lw: 4, fill: '#5a1a8a' });
      B.fx.shake(5, 0.3);
      sfx.magic();
      B.bannerText(B.t('boss.warp') || 'SPATIAL WARP!', '#c05af0');
      break;
    }
    case 'stealth': {
      e.stealthed = true;
      e.reveal = 0;
      setTimeout0(B, b.dur || 2.5, () => { e.stealthed = false; B.fx.smoke(e.x, e.y - 20, { n: 8, color: '#241a38', life: 0.6 }); });
      B.fx.smoke(e.x, e.y - 20, { n: 12, color: '#241a38', life: 0.8 });
      sfx.magic();
      break;
    }
    case 'reap': {
      const allies = B.allies.filter(a => !a.dead);
      if (!allies.length) break;
      const a = pick(allies);
      B.fx.beam(e.x, e.y - 30, a.x, a.y - 14, { color: '#7dffb0', life: 0.3, lw: 3 });
      a.takeDamage(a.hp + 999, e);
      B.fx.burst(a.x, a.y - 14, { n: 10, color: '#7dffb0', speed: 120, life: 0.5, size: 3.5 });
      sfx.crit();
      break;
    }
    case 'attrShift': {
      e.attrI = (e.attrI + 1) % 3;
      e.attr = e.attrOrder[e.attrI];
      B.fx.ring(e.x, e.y - 24, { r: 50, color: attrColor(e.attr), life: 0.6, lw: 4 });
      break;
    }
    case 'shield': {
      bd.shieldActive = b.reduction ?? 0.5;
      B.fx.ring(e.x, e.y - 24, { r: 46, color: b.reduction >= 1 ? '#ffd966' : '#8fd8ff', life: b.dur || 4, lw: 3 });
      e.shieldVisual = { t: b.dur || 4.5, color: b.reduction >= 1 ? '#ffd966' : '#8fd8ff' };
      setTimeout0(B, b.dur || 4.5, () => { bd.shieldActive = 0; e.shieldVisual = null; });
      if (b.reduction >= 1) B.bannerText(B.t('boss.invuln') || 'INVULNERABLE!', '#ffd966');
      sfx.upgrade();
      break;
    }
    case 'healSelf': {
      const amt = e.maxHp * (b.pct || 0.06);
      e.hp = Math.min(e.maxHp, e.hp + amt);
      B.fx.stars(e.x, e.y - 30, 10, '#7dff8a');
      B.fx.ring(e.x, e.y - 24, { r: 44, color: '#7dff8a', life: 0.7, lw: 3, fill: '#7dff8a' });
      B.fx.text(e.x, e.y - 60, '+' + B.fmtDmg(amt), { color: '#7dff8a', size: 15, life: 0.9 });
      sfx.heal();
      break;
    }
    case 'healAllies': {
      for (const o of B.enemies) {
        if (o.dead || o === e) continue;
        o.hp = Math.min(o.maxHp, o.hp + o.maxHp * (b.pct || 0.05));
        B.fx.stars(o.x, o.y - 24, 2, '#7dff8a');
      }
      B.fx.ring(e.x, e.y - 24, { r: 300, color: '#7dff8a', life: 0.8, lw: 3 });
      sfx.heal();
      break;
    }
    case 'splitPhase': {
      const key = 'split' + b.at;
      if (bd.splitDone.has(key)) return;
      bd.splitDone.add(key);
      for (let i = 0; i < b.into.count; i++) {
        B.spawnEnemy(b.into.id, { d: Math.max(0, e.d - 20 - i * 30), quiet: true, hpOverride: b.into.hp });
      }
      B.fx.burst(e.x, e.y - 24, { n: 24, color: attrColor(e.attr), speed: 200, life: 0.7, size: 5 });
      B.fx.shake(8, 0.4);
      B.bannerText(B.t('boss.split') || 'IT SPLITS!', attrColor(e.attr));
      sfx.boom(true);
      break;
    }
    case 'cloneIllusion': {
      const key = 'clone' + b.at;
      if (bd.cloneDone.has(key)) return;
      bd.cloneDone.add(key);
      for (let i = 0; i < b.count; i++) {
        B.spawnEnemy(b.id, { d: Math.max(0, e.d - 40 - i * 60), quiet: true, hpOverride: b.hp, sizeMult: 0.9 });
      }
      B.fx.screenFlash('#8fb8ff', 0.25, 0.5);
      B.bannerText(B.t('boss.clones') || 'MIRAGES!', '#8fb8ff');
      sfx.magic();
      break;
    }
    case 'echoes': {
      if (bd.echoesDone) return;
      bd.echoesDone = true;
      const defeated = BOSSES.filter(x => x.id !== e.id && x.region <= B.regionIdx && S && (S.stages[x.region * 20 + (x.slot === 'mini' ? 10 : 20)]?.cleared || x.region < B.regionIdx));
      const picks = shuffle([...(defeated.length ? defeated : BOSSES.filter(x => x.id !== e.id))]).slice(0, b.count || 4);
      B.bannerText(B.t('boss.echoes') || 'ECHOES OF THE FALLEN!', '#ff5fa2');
      B.fx.screenFlash('#ff5fa2', 0.3, 0.7);
      picks.forEach((p2, i) => {
        setTimeout0(B, 0.6 + i * 0.9, () => {
          if (e.dead) return;
          B.spawnBossEcho(p2.id, Math.max(0, e.d - 80 - i * 90));
          sfx.bossRoar();
        });
      });
      break;
    }
    case 'revive': break; // handled on death
    case 'deathGold': break; // handled on death
    case 'goldOnHit': break; // passive on damage
    case 'regen': break;     // passive
  }
}

function disableRandomTowers(B, e, count, dur, fx, color) {
  const towers = B.towers.filter(t => !t.disabled);
  if (!towers.length) return;
  const targets = shuffle([...towers]).slice(0, Math.min(count, towers.length));
  targets.forEach((t, i) => {
    setTimeout0(B, i * 0.15, () => {
      B.disableTower(t, dur, fx);
      B.fx.beam(e.x, e.y - 30, t.x, t.y - 20, { color, life: 0.3, lw: 3 });
      B.fx.ring(t.x, t.y - 20, { r: 30, color, life: 0.5, lw: 3, fill: color });
      sfx.freeze();
    });
  });
}
function disableTopTower(B, e, dur, fx, color) {
  const towers = B.towers.filter(t => !t.disabled).sort((a, b) => b.dpsEst() - a.dpsEst());
  if (!towers.length) return;
  const t = towers[0];
  B.disableTower(t, dur, fx);
  B.fx.beam(e.x, e.y - 30, t.x, t.y - 20, { color, life: 0.4, lw: 3.5 });
  B.fx.ring(t.x, t.y - 20, { r: 34, color, life: 0.6, lw: 3, fill: color });
  B.bannerText(B.t('boss.disabled') || 'TOWER DISABLED!', color);
  sfx.error();
}

// Called by battle when a boss "dies" — returns 'revive' to cancel death
export function bossDeathCheck(B, e) {
  const bd = e.bossData;
  if (!bd || bd.isEcho) return null;
  if (bd.reviveLeft > 0) {
    bd.reviveLeft--;
    const rd = bd.reviveDef;
    e.hp = Math.round(e.maxHp * (rd.hpPct || 0.45));
    e.speedBuffs.push({ mult: 1 + (rd.spdAdd || 0.2), t: 1e9, tag: 'revive' });
    e.dead = false;
    e.flash = 0.5;
    B.fx.screenFlash('#ff9a3a', 0.55, 0.8);
    B.fx.shake(12, 0.7);
    B.fx.ring(e.x, e.y - 24, { r: 170, color: '#ff7a3a', life: 1.0, lw: 7, fill: '#ff7a3a' });
    B.fx.embers(e.x, e.y - 30, 40, '#ffd966');
    B.bannerText(B.t('boss.reborn') || 'REBORN FROM ASHES!', '#ff9a3a');
    sfx.bossRoar();
    duckMusic(0.3, 0.8);
    return 'revive';
  }
  return null;
}
