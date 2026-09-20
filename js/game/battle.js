// ============================================================
// GTDM battle world — waves, economy, abilities, rendering
// ============================================================
import { TAU, clamp, dist, dist2, lerp, rgba, shade, fmt, mulberry32, pick, shuffle } from '../core/util.js';
import { t as i18n, tData } from '../core/i18n.js';
import { K, attrMult } from '../data/defs.js';
import { TOWER_MAP } from '../data/towers.js';
import { HERO_MAP, ABILITY_MAP } from '../data/heroes.js';
import { ENEMY_MAP, BOSS_MAP } from '../data/enemies.js';
import { MODIFIERS } from '../data/stages.js';
import { GMap, W, H } from './map.js';
import { Enemy, Tower, Hero, Ally, Projectile, Hazard, attrColor, setTimeout0 } from './entities.js';
import { attachBoss, updateBoss, bossDeathCheck } from './boss.js';
import { FXSystem, Ambient } from './particles.js';
import { getSprite, preloadSprites, TOWER_IDS } from './sprites.js';
import { sfx, playMusic, stopMusic, duckMusic } from '../core/audio.js';

const T = K.TILE;
let battleUid = 1;

export class Battle {
  constructor(cfg) {
    this.uid = battleUid++;
    this.cfg = cfg;
    this.mode = cfg.mode || 'campaign';
    this.stage = cfg.stage;
    this.canvas = cfg.canvas;
    this.ctx = this.canvas.getContext('2d');
    this.stateRef = cfg.stateRef;
    this.onEnd = cfg.onEnd || (() => { });
    this.theme = this.stage.theme;
    this.regionIdx = this.stage.region ?? 0;
    this.destroyed = false;
    this.paused = false;
    this.speed = 1;

    // ----- modifiers (daily challenge) -----
    this.hpMult = this.stage.hpMult ?? 1;
    this.goldMult = this.stage.goldMult ?? 1;
    this.spdMult = this.stage.spdMult ?? 1;
    this.armorAdd = this.stage.armorAdd ?? 0;
    this.costMult = 1; this.rangeMult = 1; this.dmgMultMod = 1;
    this.cdMult = 1; this.countMult = 1; this.goldGenMult = 1;
    this.airBias = false;
    (cfg.mods || []).forEach(mid => {
      const m = MODIFIERS.find(x => x.id === mid);
      if (m) m.apply(this);
    });

    // ----- world state -----
    this.map = new GMap(this.stage.layout, this.theme, this.stage.layout.seed);
    this.map.renderBackground();
    this.fx = new FXSystem();
    this.ambient = new Ambient(this.theme, W, H);
    this.enemies = []; this.towers = []; this.heroes = []; this.allies = [];
    this.projectiles = []; this.hazards = []; this.timers = [];
    this.MAX_ENEMIES = 170;

    this.gold = Math.round(this.stage.startGold || 250);
    this.lives = this.lives || this.stage.lives || K.START_LIVES; // mods (hearty) may pre-set
    this.maxLives = this.lives;
    this.wave = 0;                 // waves completed / current index
    this.waves = this.stage.waves.map(w => ({ ...w, groups: w.groups.map(g => ({ ...g })) }));
    if (this.countMult !== 1) this.waves.forEach(w2 => w2.groups.forEach(g => g.count = Math.ceil(g.count * this.countMult)));
    this.nWaves = this.waves.length;
    this.phase = 'prep';           // prep|spawning|active|victory|defeat
    this.prepTime = 20;
    this.prepLeft = this.prepTime;
    this.spawnQueue = [];
    this.waveActive = false;
    this.waveIncoming = 0;
    this.freezeT = 0;
    this.goldRushT = 0; this.goldRushMult = 2;
    this.anthemT = 0;
    this.sanctuaryZone = null;
    this.towerSlowDebuff = null;
    this.grabFx = null;
    this.resonance = false;
    this.boss = null;
    this.bossIncoming = false;
    this.bossBarT = 0;
    this.showFloat = this.stateRef?.settings?.floatingDmg !== false;
    this.shakeOn = this.stateRef?.settings?.shake !== false;
    this.quality = this.stateRef?.settings?.quality || 'high';

    this.stats = { kills: 0, airKills: 0, eliteKills: 0, bossKills: 0, goldEarned: 0, towersBuilt: 0, abilitiesUsed: 0, skillsUsed: 0, leaks: 0, goldSpent: 0 };
    this.builtTypes = new Set();
    this.towerKills = {};

    // ----- abilities -----
    this.abilities = {};
    for (const a of Object.values(ABILITY_MAP)) {
      const lvl = cfg.abilityLvl?.(a.id) ?? 0;
      const unlocked = cfg.abilityUnlocked?.(a.id) ?? false;
      if (!unlocked) continue;
      this.abilities[a.id] = {
        id: a.id, def: a, lvl: Math.max(1, lvl),
        cd: 0, maxCd: a.cd(Math.max(1, lvl)) * this.cdMult,
        armed: false,
      };
    }

    // ----- build tray (owned towers / draft) -----
    if (cfg.draft) this.buildable = [...cfg.draft];
    else this.buildable = TOWER_IDS.filter(id => cfg.ownsTower?.(id));
    this.towerMeta = id => cfg.towerMetaLvl?.(id) ?? 1;

    // ----- heroes -----
    const team = cfg.team || [];
    team.forEach((hid, i) => {
      if (!hid) return;
      const def = HERO_MAP[hid];
      if (!def) return;
      const h = new Hero(this, def, cfg.heroLvl?.(hid) ?? 1, cfg.heroAwaken?.(hid) ?? 0, i);
      h.skillMax = def.skill.cd * this.cdMult * (1 - (cfg.heroAwaken?.(hid) ?? 0) * 0.06);
      this.heroes.push(h);
    });

    // ----- input state -----
    this.selBuild = null;      // tower id selected in tray
    this.selSlot = null;       // slot being inspected
    this.dragHero = null;      // {hero, fromChip, idx, valid, x, y}
    this.hover = null;         // {x,y}
    this.meteorReticle = null;

    // ----- loop -----
    this.lastT = 0;
    this.time = 0;
    this._raf = null;
    this.bannerQ = null;
    this.loop = this.loop.bind(this);

    this.recomputePassives();
  }

  t(key) { return i18n(key); }
  fmtDmg(n) { return n >= 10000 ? fmt(n) : Math.round(n).toString(); }

  // ============================================================
  // lifecycle
  // ============================================================
  start() {
    preloadSprites([...new Set([
      ...this.collectSpriteIds(),
    ])], ['walk', 'idle', 'attack'], 128);
    TOWER_IDS.forEach(id => getSprite(id, 'idle', 0, 128));
    playMusic(this.mode === 'proof' ? 'proof' : 'battle');
    this.lastT = performance.now();
    this._raf = requestAnimationFrame(this.loop);
    this.bannerText(this.startBannerText(), '#ffe9a8');
  }
  startBannerText() {
    if (this.stage.boss) return '⚔ ' + i18n('battle.boss');
    return this.theme ? tData(this.theme, 'name') : '';
  }
  collectSpriteIds() {
    const ids = [];
    this.waves.forEach(w => {
      if (w.boss) {
        const b = BOSS_MAP[w.boss];
        if (b) ids.push(b.sprite);
      }
      w.groups.forEach(g => { const e = ENEMY_MAP[g.id]; if (e) ids.push(e.sprite); });
    });
    Object.values(ENEMY_MAP).forEach(e => ids.push(e.sprite)); // splits/summons
    this.heroes.forEach(h => ids.push(h.def.sprite));
    ids.push('soldier', 'wolfpup', 'golemguard');
    return ids;
  }
  destroy() {
    this.destroyed = true;
    if (this._raf) cancelAnimationFrame(this._raf);
    this._raf = null;
  }
  pause() { this.paused = true; }
  resume() { this.paused = false; this.lastT = performance.now(); }
  setSpeed(n) { this.speed = n; sfx.click(); }

  loop(ts) {
    if (this.destroyed) return;
    this._raf = requestAnimationFrame(this.loop);
    let dt = Math.min(0.05, (ts - this.lastT) / 1000);
    this.lastT = ts;
    if (this.paused) { this.render(); return; }
    const steps = this.speed >= 2 ? 2 : 1;
    for (let i = 0; i < steps; i++) this.update(dt);
    this.render();
  }

  // ============================================================
  // update
  // ============================================================
  update(dt) {
    this.time += dt;
    const wasFrozen = this.freezeT > 0;
    this.frozen = wasFrozen;
    if (this.freezeT > 0) this.freezeT -= dt;
    if (this.goldRushT > 0) { this.goldRushT -= dt; if (this.goldRushT <= 0) this.goldRushMult = this.abilities.rush ? 1 : 1; }
    if (this.anthemT > 0) this.anthemT -= dt;
    if (this.sanctuaryZone) {
      this.sanctuaryZone.t -= dt;
      if (this.sanctuaryZone.hero?.deployed) { this.sanctuaryZone.x = this.sanctuaryZone.hero.x; this.sanctuaryZone.y = this.sanctuaryZone.hero.y; }
      if (this.sanctuaryZone.t <= 0) this.sanctuaryZone = null;
    }
    if (this.towerSlowDebuff) { this.towerSlowDebuff.t -= dt; if (this.towerSlowDebuff.t <= 0) this.towerSlowDebuff = null; }
    if (this.grabFx) { this.grabFx.t -= dt; if (this.grabFx.t <= 0) this.grabFx = null; }
    if (this.bannerQ) { this.bannerQ.t -= dt; if (this.bannerQ.t <= 0) this.bannerQ = null; }

    // timers (setTimeout0)
    for (let i = this.timers.length - 1; i >= 0; i--) {
      this.timers[i].t -= dt;
      if (this.timers[i].t <= 0) { const fn = this.timers[i].fn; this.timers.splice(i, 1); try { fn(); } catch (e) { console.error(e); } }
    }

    // ability cooldowns
    for (const a of Object.values(this.abilities)) { if (a.cd > 0) a.cd = Math.max(0, a.cd - dt); }

    // ---- wave machine ----
    this.updateWaves(dt);

    // ---- entities ----
    for (const e of this.enemies) {
      if (e.dead) continue;
      e.updateSlow(dt);
      if (e.shieldVisual) e.shieldVisual.t -= dt;
      if (e.isBoss) updateBoss(this, e, dt);
      e.update(dt);
    }
    // cultist aura recalc (cheap, throttled)
    this.cultT = (this.cultT || 0) - dt;
    if (this.cultT <= 0) {
      this.cultT = 0.3;
      const cultists = this.enemies.filter(e => !e.dead && e.def.debuffAura);
      for (const tw of this.towers) {
        tw.cultistDebuff = cultists.some(c => dist2(c.x, c.y, tw.x, tw.y) < (c.def.debuffAura.radius * T) ** 2);
      }
    }
    for (const tw of this.towers) {
      if (tw.rateDebuffT > 0) { tw.rateDebuffT -= dt; if (tw.rateDebuffT <= 0) tw.rateDebuff = 0; }
      tw.update(dt);
    }
    for (const h of this.heroes) if (h.deployed) h.update(dt);
    for (const a of this.allies) if (!a.dead) a.update(dt);
    for (const p of this.projectiles) if (!p.dead) p.update(dt);
    for (const hz of this.hazards) if (!hz.dead) hz.update(dt);
    this.projectiles = this.projectiles.filter(p => !p.dead);
    this.hazards = this.hazards.filter(h => !h.dead);

    this.fx.update(dt);
    if (this.quality !== 'low') this.ambient.update(dt);

    // win/lose checks
    if (this.phase === 'victory' || this.phase === 'defeat') return;
    if (this.lives <= 0) this.finish(false);
  }

  updateWaves(dt) {
    if (this.phase === 'victory' || this.phase === 'defeat') return;
    if (this.phase === 'prep') {
      this.prepLeft -= dt;
      this.waveIncoming = this.prepLeft;
      if (this.prepLeft <= 0) this.startWave();
      return;
    }
    // spawning
    if (this.spawnQueue.length) {
      for (let i = this.spawnQueue.length - 1; i >= 0; i--) {
        this.spawnQueue[i].t -= dt;
        if (this.spawnQueue[i].t <= 0) {
          const s = this.spawnQueue.splice(i, 1)[0];
          this.spawnEnemy(s.id, { d: s.d, elite: s.elite });
        }
      }
    }
    // wave cleared? (bossIncoming guards the 2.2s boss spawn delay)
    if (!this.spawnQueue.length && this.enemies.length === 0 && !this.bossIncoming) {
      if (this.wave >= this.nWaves) {
        this.finish(true);
      } else {
        // wave bonus
        const bonus = Math.round((18 + this.wave * 5) * (1 + this.regionIdx * 0.4));
        this.addGold(bonus, W / 2, 60, false, false, false, true);
        this.phase = 'prep';
        this.prepLeft = this.prepTime = this.wave === 1 ? 14 : 11;
        this.waveActive = false;
        if (this.boss && this.boss.dead) { this.boss = null; if (!this.destroyed) playMusic(this.mode === 'proof' ? 'proof' : 'battle'); }
      }
    }
  }

  startWave() {
    const w = this.waves[this.wave];
    if (!w) { this.finish(true); return; }
    this.wave++;
    this.phase = 'active';
    this.waveActive = true;
    sfx.waveStart();
    // banner
    const typeKey = w.type && w.type !== 'mixed' ? 'wave.' + ({ stealthish: 'stealth', mage: 'mage', mixed: 'mixed' }[w.type] || w.type) : null;
    const label = w.boss ? i18n('battle.boss') : (typeKey ? i18n(typeKey) || w.type.toUpperCase() : '');
    this.bannerText(`${i18n('battle.wave', { a: this.wave, b: this.nWaves })}${label ? ' · ' + label : ''}`, w.boss ? '#ff8a7d' : '#ffe9a8', w.boss ? 2.6 : 1.8);
    // schedule spawns
    for (const g of w.groups) {
      const def = ENEMY_MAP[g.id];
      if (!def) continue;
      let id = g.id;
      if (this.airBias && !def.flying && Math.random() < 0.4) id = 'harpy';
      const count = g.count;
      for (let i = 0; i < count; i++) {
        this.spawnQueue.push({
          t: (g.delay || 0) + i * (g.gap || 0.8),
          id, elite: g.elite,
          d: g.t0 ? g.t0 * this.map.pathLen : 0,
        });
      }
    }
    this.spawnQueue.sort((a, b) => a.t - b.t);
    // boss spawn
    if (w.boss) {
      this.bossIncoming = true;
      this.spawnQueue.push({ t: 2.2, id: '@boss', bossId: w.boss });
      // handled in spawnEnemy special-case below via timeout
      setTimeout0(this, 2.2, () => this.spawnBoss(w.boss));
      this.spawnQueue = this.spawnQueue.filter(s => s.id !== '@boss');
      setTimeout0(this, 2.0, () => {
        playMusic('boss');
        this.fx.screenFlash('#ff5a4a', 0.3, 0.8);
        sfx.bossRoar();
      });
    }
  }

  callWaveEarly() {
    if (this.phase !== 'prep') return;
    const bonus = Math.round(this.prepLeft * (6 + this.regionIdx * 2));
    if (bonus > 0) {
      this.addGold(bonus, W / 2, 70, false, false, false, true);
      this.fx.text(W / 2, 100, i18n('battle.earlyBonus') || `EARLY BONUS +${bonus}💰`, { color: '#ffd966', size: 17, crit: true, life: 1.2, vy: -30 });
    }
    sfx.bigCoin();
    this.startWave();
  }

  aliveCount() { return this.enemies.length; }

  spawnEnemy(id, opts = {}) {
    if (this.enemies.length >= this.MAX_ENEMIES) return null;
    const def = ENEMY_MAP[id];
    if (!def) return null;
    if (opts.elite && !opts.affix) {
      opts = { ...opts, affix: pick([null, 'furious', 'fortified', 'regenerating', 'shielded']) };
    }
    const e = new Enemy(this, def, opts);
    if (opts.hpOverride) { e.maxHp = Math.round(opts.hpOverride); e.hp = e.maxHp; }
    if (opts.elite) {
      e.isElite = true;
      if (e.affix === 'furious') e.baseSpd *= 1.25;
      if (e.affix === 'fortified') e.armor *= 1.6;
      if (e.affix === 'regenerating') e.regen += 0.02;
      if (e.affix === 'shielded') { e.shield = e.shieldMax = Math.round(e.maxHp * 0.25); }
      e.maxHp = Math.round(e.maxHp * 2.9); e.hp = Math.max(e.hp, e.maxHp);
      e.size *= 1.22;
      e.gold = Math.round(e.gold * 2.4);
    }
    this.enemies.push(e);
    this.codex(id);
    if (!opts.quiet) {
      this.fx.ring(e.x, e.y - 10, { r: 26, color: '#c05af0', life: 0.4, lw: 2 });
    }
    return e;
  }

  spawnBoss(bossId, opts = {}) {
    const def = BOSS_MAP[bossId];
    if (!def) return null;
    const fakeDef = {
      id: def.id, sprite: def.sprite, attr: def.attr, hp: def.hp, spd: def.spd,
      armor: def.armor, mres: def.mres, gold: def.gold, dmg: def.dmg, size: def.size,
      heavy: def.heavy, flying: def.flying, undead: def.undead,
      name: def.name,
    };
    const hpMult = (this.stage.bossHpMult || 1) * (opts.hpMult || 1);
    const e = new Enemy(this, fakeDef, { boss: true, d: opts.d ?? 0, hpMult, sizeMult: opts.sizeMult || 1, absolute: true });
    e.bossName = tData(def, 'name');
    e.bossTitle = tData(def, 'title');
    attachBoss(this, e, def, { hpMult: 1, echo: opts.echo });
    e.gold = Math.round(def.gold * (opts.echo ? 0.3 : 1));
    this.enemies.push(e);
    if (!opts.echo) {
      this.boss = e;
      this.bossIncoming = false;
      this.codexBoss(def.id);
    }
    this.fx.ring(e.x, e.y - 20, { r: 90, color: '#ff5a4a', life: 0.9, lw: 5, fill: '#ff5a4a' });
    this.fx.shake(8, 0.5);
    return e;
  }
  spawnBossEcho(bossId, d) {
    const def = BOSS_MAP[bossId];
    if (!def) return;
    // echo = elite-strength mini boss without full behaviors
    const fakeDef = {
      id: def.id + '_echo', sprite: def.sprite, attr: def.attr,
      hp: def.hp * 0.14, spd: def.spd * 1.12, armor: def.armor * 0.7, mres: def.mres,
      gold: Math.round(def.gold * 0.12), dmg: Math.max(2, Math.round(def.dmg * 0.4)), size: def.size * 0.9,
      heavy: def.heavy, flying: def.flying, undead: def.undead, name: def.name,
    };
    const e = new Enemy(this, fakeDef, { boss: false, elite: false, d, absolute: true });
    e.isEcho = true;
    this.enemies.push(e);
    this.codex(def.id);
    this.fx.ring(e.x, e.y - 16, { r: 60, color: '#ff5fa2', life: 0.7, lw: 4, fill: '#ff5fa2' });
  }

  removeEnemy(e) {
    const i = this.enemies.indexOf(e);
    if (i >= 0) this.enemies.splice(i, 1);
  }
  removeAlly(a) {
    const i = this.allies.indexOf(a);
    if (i >= 0) this.allies.splice(i, 1);
  }

  onBossDeath(e) {
    return bossDeathCheck(this, e);
  }

  bossAlive() { return this.boss && !this.boss.dead; }

  leak(e) {
    const dmg = e.isBoss ? e.leakDmg : e.leakDmg;
    this.lives -= dmg;
    this.stats.leaks++;
    const p = this.map.path[this.map.path.length - 1];
    this.fx.screenFlash('#f0564a', 0.4, 0.5);
    this.fx.shake(9, 0.4);
    this.fx.text(p.x - 30, p.y - 30, i18n('battle.leak', { n: dmg }), { color: '#ff8a7d', size: 20, crit: true, life: 1.1 });
    this.fx.burst(p.x, p.y, { n: 18, color: '#f0564a', speed: 180, life: 0.6, size: 4 });
    sfx.leak();
    duckMusic(0.4, 0.4);
    if (this.lives <= 0) { this.lives = 0; }
  }

  addGold(n, x, y, big = false, quiet = false, fountain = false, waveBonus = false) {
    this.gold += n;
    this.stats.goldEarned += n;
    if (!quiet && n > 0) {
      if (x !== undefined) {
        this.fx.text(x, y ?? 40, '+' + n, { color: '#ffd966', size: big ? 20 : 13, life: big ? 1.1 : 0.7, vy: big ? -50 : -38, shadow: big ? '#f5c542' : null, crit: big });
        if (!fountain && !waveBonus) this.fx.spawn({ x, y: (y ?? 40) + 6, vx: 0, vy: -30, g: 60, life: 0.5, size: 3, color: '#ffd966', kind: 'star', glow: true });
      }
      if (big) sfx.bigCoin(); else if (!waveBonus && Math.random() < 0.5) sfx.coin();
    }
  }

  // ============================================================
  // BUFF CALCULATIONS
  // ============================================================
  heroPassive(hid) { return this.heroes.some(h => h.deployed && h.def.id === hid); }
  heroById(hid) { return this.heroes.find(h => h.deployed && h.def.id === hid); }

  towerDmgBuff(tw) {
    let m = this.dmgMultMod;
    if (this.resonance) m *= 1.05;
    if (this.anthemT > 0) m *= 1; // anthem is rate
    // orchid aura
    for (const o of this.towers) {
      if (o !== tw && o.def.id === 'orchid' && !o.disabled) {
        const rad = (o.mech.buffAura.radius + (o.lvl - 1) * 0.15) * T;
        if (dist2(o.x, o.y, tw.x, tw.y) < rad ** 2) m *= 1 + o.mech.buffAura.dmg + (o.lvl - 1) * 0.05;
      }
    }
    if (this.heroPassive('aria')) m *= 1.05;
    const arthur = this.heroById('arthur');
    if (arthur && dist2(arthur.x, arthur.y, tw.x, tw.y) < (2 * T) ** 2) m *= 1.10;
    if (this.heroPassive('freya') && tw.def.attr === 'rock') m *= 1.15;
    return m;
  }
  towerRateBuff(tw) {
    let m = 1;
    if (this.anthemT > 0) m *= 1.25;
    for (const o of this.towers) {
      if (o !== tw && !o.disabled) {
        if (o.def.id === 'orchid') {
          const rad = (o.mech.buffAura.radius + (o.lvl - 1) * 0.15) * T;
          if (dist2(o.x, o.y, tw.x, tw.y) < rad ** 2) m *= 1 + o.mech.buffAura.atkSpd;
        }
        if (o.def.id === 'nun') {
          let rad = o.range * (this.heroPassive('marco') ? 1.3 : 1);
          if (dist2(o.x, o.y, tw.x, tw.y) < rad ** 2) m *= 1 + o.mech.blessAura.atkSpd + (o.lvl - 1) * 0.03;
        }
      }
    }
    if (this.sanctuaryZone && dist2(this.sanctuaryZone.x, this.sanctuaryZone.y, tw.x, tw.y) < this.sanctuaryZone.r ** 2) m *= 1.2;
    if (this.towerSlowDebuff) m *= 1 - this.towerSlowDebuff.pct;
    if (tw.rateDebuff > 0) m *= 1 - tw.rateDebuff;
    if (tw.cultistDebuff) m *= 0.88;
    return m;
  }
  towerRangeBuff(tw) {
    let m = 1;
    const sylph = this.heroById('sylph');
    if (sylph && tw.def.range >= 2.5 && dist2(sylph.x, sylph.y, tw.x, tw.y) < (2.5 * T) ** 2) m *= 1.08;
    return m;
  }
  heroDmgBuff(h) {
    let m = 1;
    if (this.resonance) m *= 1.05;
    if (this.anthemT > 0) m *= 1.25;
    if (this.heroPassive('freya') && h.def.attr === 'rock') m *= 1.15;
    if (h.def.id === 'rin' && this.heroPassive === undefined) { }
    // rin passive: near scissors tower
    if (h.def.id === 'rin') {
      const near = this.towers.some(tw => tw.def.attr === 'scissors' && !tw.disabled && dist2(tw.x, tw.y, h.x, h.y) < (2 * T) ** 2);
      if (near) m *= 1.0; // rate passive below
    }
    return m;
  }
  heroRateBuff(h) {
    let m = 1;
    if (h.def.id === 'rin') {
      const near = this.towers.some(tw => tw.def.attr === 'scissors' && !tw.disabled && dist2(tw.x, tw.y, h.x, h.y) < (2 * T) ** 2);
      if (near) m *= 1.12;
    }
    return m;
  }

  recomputePassives() {
    // attribute resonance: all 3 attrs among deployed heroes + built towers
    const attrs = new Set();
    this.heroes.forEach(h => { if (h.deployed) attrs.add(h.def.attr); });
    this.towers.forEach(tw => attrs.add(tw.def.attr));
    this.resonance = attrs.size >= 3;
    // volt chain bonus
    const volt = this.heroById('volt');
    this.towers.forEach(tw => {
      tw.chainBonus = 0;
      if (volt && tw.def.id === 'lightning' && dist2(volt.x, volt.y, tw.x, tw.y) < (2.5 * T) ** 2) tw.chainBonus = 1;
    });
  }

  // ============================================================
  // BUILD / UPGRADE / SELL
  // ============================================================
  towerCost(id) {
    const def = TOWER_MAP[id];
    return Math.round(def.cost * this.costMult);
  }
  canBuild(id) { return this.gold >= this.towerCost(id) && this.buildable.includes(id); }
  buildAt(slot, id) {
    if (!slot || slot.tower) return false;
    if (!this.canBuild(id)) { sfx.error(); return false; }
    const def = TOWER_MAP[id];
    const cost = this.towerCost(id);
    this.gold -= cost;
    this.stats.goldSpent += cost;
    this.stats.towersBuilt++;
    const tw = new Tower(this, slot, def, this.towerMeta(id));
    tw.refineMult = this.cfg.refineBonus?.(id) ?? 1;
    tw.spendGold = cost;
    slot.tower = tw;
    this.towers.push(tw);
    this.builtTypes.add(id);
    this.fx.ring(slot.x, slot.y - 10, { r: 34, color: '#ffd966', life: 0.5, lw: 3, fill: '#ffd966' });
    this.fx.burst(slot.x, slot.y - 14, { n: 10, color: '#ffe08a', speed: 120, life: 0.5, size: 3, g: 240 });
    this.fx.smoke(slot.x, slot.y - 6, { n: 5, color: '#8a8494', life: 0.5, size: 8 });
    sfx.build();
    this.recomputePassives();
    return true;
  }
  upgradeTower(tw) {
    const cost = tw.upgradeCost();
    if (cost === null) { sfx.error(); return false; }
    if (this.gold < cost) { sfx.error(); return false; }
    this.gold -= cost;
    this.stats.goldSpent += cost;
    tw.spendGold += cost;
    tw.lvl++;
    this.fx.ring(tw.x, tw.y - 16, { r: 40, color: '#57d97a', life: 0.6, lw: 4, fill: '#57d97a' });
    this.fx.stars(tw.x, tw.y - 40, 8, '#ffe08a');
    this.fx.text(tw.x, tw.y - 56, 'LV.' + tw.lvl, { color: '#57d97a', size: 16, crit: true, life: 0.9 });
    sfx.upgrade();
    this.recomputePassives();
    return true;
  }
  sellTower(tw) {
    const val = tw.sellValue;
    this.gold += val;
    // remove summons
    tw.summons.forEach(a => { a.dead = true; this.removeAlly(a); this.fx.smoke(a.x, a.y - 10, { n: 4, color: '#8a8494' }); });
    const i = this.towers.indexOf(tw);
    if (i >= 0) this.towers.splice(i, 1);
    tw.slot.tower = null;
    this.fx.burst(tw.x, tw.y - 16, { n: 12, color: '#ffd966', speed: 140, life: 0.5, size: 3 });
    this.fx.text(tw.x, tw.y - 40, '+' + val + '💰', { color: '#ffd966', size: 15, life: 0.9 });
    sfx.sell();
    this.recomputePassives();
    return true;
  }
  cycleTargetMode(tw) {
    tw.targetMode = (tw.targetMode + 1) % 4;
    sfx.click();
    this.fx.text(tw.x, tw.y - 52, ['FIRST', 'LAST', 'STRONG', 'CLOSE'][tw.targetMode], { color: '#8fd8ff', size: 12, life: 0.8 });
  }
  disableTower(tw, dur, fx2) {
    if (tw.disabled > 0) return;
    tw.disabled = dur;
    tw.disableFx = fx2;
    this.fx.ring(tw.x, tw.y - 18, { r: 30, color: '#ff5a4a', life: 0.4, lw: 2 });
  }

  // ============================================================
  // HEROES
  // ============================================================
  validHeroPos(x, y, hero) {
    if (x < 16 || x > W - 16 || y < 40 || y > H - 30) return false;
    // not on path
    const c = Math.floor(x / T), r = Math.floor(y / T);
    if (this.map.isPath(c, r)) return false;
    // also check distance to path line (path is thick)
    for (let i = 0; i < this.map.path.length; i += 3) {
      const p = this.map.path[i];
      if ((p.x - x) ** 2 + (p.y - y) ** 2 < (T * 0.42) ** 2) return false;
    }
    // not on occupied slot
    for (const s of this.map.slots) {
      if (s.tower && dist2(s.x, s.y, x, y) < (T * 0.5) ** 2) return false;
    }
    // not overlapping other heroes
    for (const h of this.heroes) {
      if (h !== hero && h.deployed && dist2(h.x, h.y, x, y) < (T * 0.45) ** 2) return false;
    }
    return true;
  }
  deployHero(idx, x, y) {
    const h = this.heroes[idx];
    if (!h) return false;
    if (!this.validHeroPos(x, y, h)) return false;
    const first = !h.deployed;
    h.place(x, y);
    this.fx.ring(x, y - 8, { r: 36, color: '#57d97a', life: 0.55, lw: 3, fill: '#57d97a' });
    this.fx.burst(x, y - 10, { n: 12, color: '#9affb8', speed: 140, life: 0.5, size: 3 });
    if (first) sfx.build(); else sfx.click();
    this.recomputePassives();
    return true;
  }
  heroAt(x, y) {
    for (const h of this.heroes) {
      if (h.deployed && dist2(h.x, h.y - 16, x, y) < (T * 0.55) ** 2) return h;
    }
    return null;
  }

  // ============================================================
  // ABILITIES
  // ============================================================
  abilityReady(id) { const a = this.abilities[id]; return a && a.cd <= 0; }
  armAbility(id) {
    const a = this.abilities[id];
    if (!a || a.cd > 0) { sfx.error(); return; }
    if (id === 'meteor') {
      a.armed = !a.armed;
      Object.values(this.abilities).forEach(o => { if (o !== a) o.armed = false; });
      sfx.click();
    } else {
      this.castAbility(id);
    }
  }
  castAbility(id, x, y) {
    const a = this.abilities[id];
    if (!a || a.cd > 0) return false;
    const def = a.def, lvl = a.lvl;
    a.cd = a.maxCd;
    a.armed = false;
    this.stats.abilitiesUsed++;
    switch (id) {
      case 'meteor': {
        if (x === undefined) { a.cd = 0; return false; }
        const dmg = def.dmg(lvl) * (1 + this.regionIdx * 0.0); // absolute scaling vs stage hp handled below
        const scaled = dmg * Math.max(1, this.hpMult * 0.35);
        const r = def.radius * T;
        // telegraph then impact
        this.fx.ring(x, y, { r, color: '#ff5a4a', life: 0.55, lw: 3 });
        sfx.meteor();
        setTimeout0(this, 0.55, () => {
          this.fx.burst(x, y, { n: 34, color: '#ff9a3a', speed: 320, life: 0.7, size: 5, g: 300 });
          this.fx.burst(x, y, { n: 16, color: '#555068', speed: 120, life: 0.9, size: 9, kind: 'smoke', g: -40 });
          this.fx.ring(x, y, { r: r * 1.3, color: '#ffb04a', life: 0.5, lw: 6, fill: '#ff7a3a' });
          this.fx.decal(x, y, r * 0.8, '#241a14', 6, 'scorch');
          this.fx.shake(12, 0.5);
          this.fx.screenFlash('#ff9a3a', 0.25, 0.3);
          sfx.boom(true);
          duckMusic(0.4, 0.4);
          for (const e of this.enemies) {
            if (e.dead || !e.targetable) continue;
            const d2v = dist2(x, y, e.x, e.y);
            if (d2v < (r * 1.15) ** 2) {
              const fall = 1 - Math.sqrt(d2v) / (r * 1.15) * 0.4;
              e.takeDamage(scaled * fall, { type: 'magic', color: '#ff9a3a', crit: false });
              e.applyBurn(scaled * 0.12, 3);
            }
          }
        });
        return true;
      }
      case 'freeze': {
        const dur = def.dur(lvl);
        this.freezeT = Math.max(this.freezeT, dur);
        this.fx.screenFlash('#8fd8ff', 0.3, 0.6);
        this.fx.ring(W / 2, H / 2, { r: 640, color: '#cfeaff', life: 0.8, lw: 5 });
        for (const e of this.enemies) {
          if (!e.dead) {
            this.fx.burst(e.x, e.y - 14, { n: 5, color: '#cfeaff', speed: 70, life: 0.5, size: 3 });
          }
        }
        for (let i = 0; i < 30; i++) {
          this.fx.spawn({ x: Math.random() * W, y: -10, vx: (Math.random() - 0.5) * 40, vy: 120 + Math.random() * 160, g: 0, life: 1.4, size: 2.5, color: '#e8f8ff', kind: 'dot' });
        }
        sfx.freeze();
        return true;
      }
      case 'rush': {
        this.goldRushT = 12;
        this.goldRushMult = def.mult(lvl);
        const g = Math.round(def.instant(lvl) * (1 + this.regionIdx * 0.5));
        this.addGold(g, W / 2, 70, true);
        this.fx.text(W / 2, 110, 'x' + this.goldRushMult.toFixed(1) + ' GOLD!', { color: '#ffd966', size: 22, crit: true, life: 1.4, vy: -24 });
        for (let i = 0; i < 16; i++) this.fx.stars(W / 2 + (Math.random() - 0.5) * 300, 60 + Math.random() * 60, 1, '#ffd966');
        sfx.bigCoin();
        return true;
      }
      case 'holy': {
        const dmg = def.dmg(lvl) * Math.max(1, this.hpMult * 0.3);
        this.fx.screenFlash('#fff4c8', 0.5, 0.7);
        this.fx.shake(8, 0.4);
        for (let i = 0; i < 24; i++) {
          const x2 = Math.random() * W, y2 = Math.random() * H * 0.8;
          this.fx.lightningBolt(x2, -20, y2, '#ffe9a8', 0.4);
        }
        for (const e of this.enemies) {
          if (e.dead) continue;
          if (e.stealthed) { e.stealthed = false; e.reveal = 3; }
          e.takeDamage(dmg * (e.undead ? 1.8 : 1), { type: 'magic', color: '#ffe9a8' });
        }
        const heal = 1 + Math.floor(lvl / 5);
        if (this.lives < this.maxLives) {
          this.lives = Math.min(this.maxLives, this.lives + heal);
          this.fx.text(W / 2, H / 2, `+${heal} ❤`, { color: '#ff9a8a', size: 22, crit: true, life: 1.2 });
        }
        sfx.holy();
        return true;
      }
    }
    return false;
  }

  densestEnemyPoint(nearX, nearY, maxDist) {
    let best = null, bestN = 0;
    for (const e of this.enemies) {
      if (e.dead || !e.targetable) continue;
      if (nearX !== undefined && dist2(nearX, nearY, e.x, e.y) > maxDist ** 2) continue;
      let n = 0;
      for (const o of this.enemies) {
        if (o.dead || !o.targetable) continue;
        if (dist2(e.x, e.y, o.x, o.y) < (T * 1.3) ** 2) n++;
      }
      if (n > bestN) { bestN = n; best = e; }
    }
    return best;
  }

  fxCone(x, y, ang, len, halfAng, color) {
    // quick cone visual via ring segments
    for (let i = 0; i < 8; i++) {
      const a = ang + (Math.random() - 0.5) * halfAng * 2;
      const d = len * (0.4 + Math.random() * 0.6);
      this.fx.spawn({ x: x + Math.cos(a) * d * 0.4, y: y + Math.sin(a) * d * 0.4, vx: Math.cos(a) * 260, vy: Math.sin(a) * 260, g: 0, life: 0.4, size: 6, color, kind: 'smoke', glow: true, drag: 2 });
    }
    this.fx.ring(x + Math.cos(ang) * len * 0.4, y + Math.sin(ang) * len * 0.4, { r: len * 0.5, color, life: 0.35, lw: 4 });
  }

  bannerText(txt, color = '#ffe9a8', dur = 1.8) {
    this.bannerQ = { txt, color, t: dur, dur };
  }
  telegraph(e, kind) { /* reserved */ }

  codex(id) { this.stateRef && this.cfg.codexUnlock?.(id); }
  codexBoss(id) { this.stateRef && this.cfg.codexUnlock?.('boss_' + id); }
  onHeroSkill(h) { /* hook for UI pulse */ }
  onBossPhase(e, phase) {
    this.bannerText(`${e.bossName} — ${i18n('battle.phase', { n: phase + 1 }) || 'PHASE ' + (phase + 1)}`, '#ff8a7d', 1.6);
  }

  // ============================================================
  // FINISH
  // ============================================================
  finish(won) {
    if (this.phase === 'victory' || this.phase === 'defeat') return;
    this.phase = won ? 'victory' : 'defeat';
    stopMusic();
    const types = this.builtTypes.size;
    const attrs = new Set();
    this.towers.forEach(tw => attrs.add(tw.def.attr));
    this.heroes.forEach(h => { if (h.deployed) attrs.add(h.def.attr); });
    const payload = {
      ...this.stats,
      wave: this.wave,
      lives: this.lives,
      towerTypes: types,
      singleAttr: attrs.size === 1 && (this.towers.length + this.heroes.filter(h => h.deployed).length) >= 3,
      stageId: this.stage.id,
      mode: this.mode,
      proofFloor: this.stage.proofFloor,
    };
    if (won) {
      this.fx.screenFlash('#ffe9a8', 0.4, 0.8);
      for (let i = 0; i < 40; i++) {
        setTimeout0(this, i * 0.05, () => this.fx.stars(Math.random() * W, H * 0.3 + Math.random() * H * 0.5, 2, pick(['#ffd966', '#ff8ad8', '#8fd8ff', '#9affb8'])));
      }
      sfx.fanfare();
    } else {
      this.fx.screenFlash('#f0564a', 0.3, 1.0);
      sfx.defeat();
    }
    setTimeout(() => { if (!this.destroyed) this.onEnd(won, payload); }, won ? 1700 : 1400);
  }

  // ============================================================
  // INPUT
  // ============================================================
  pointerDown(x, y) {
    if (this.phase === 'victory' || this.phase === 'defeat') return;
    // meteor targeting
    const meteor = this.abilities.meteor;
    if (meteor?.armed) {
      this.castAbility('meteor', x, y);
      return;
    }
    // hero drag start (field hero)
    const h = this.heroAt(x, y);
    if (h) {
      this.dragHero = { idx: this.heroes.indexOf(h), x, y, moved: false };
      return;
    }
    // slot interaction
    const slot = this.map.slotAtPixel(x, y);
    if (slot) {
      if (slot.tower) {
        this.selSlot = slot; this.selBuild = null;
        sfx.click();
        this.cfg.onSlotSelect?.(slot);
      } else if (this.selBuild) {
        if (this.buildAt(slot, this.selBuild)) {
          // keep selection for rapid building if still affordable
          if (!this.canBuild(this.selBuild)) this.selBuild = null;
          this.cfg.onSlotSelect?.(null);
          this.selSlot = null;
        }
      } else {
        this.selSlot = slot;
        sfx.click();
        this.cfg.onSlotSelect?.(slot); // open build menu
      }
      return;
    }
    this.cfg.onSlotSelect?.(null);
    this.selSlot = null;
    this.selBuild = null;
  }
  pointerMove(x, y) {
    this.hover = { x, y };
    if (this.dragHero) {
      this.dragHero.x = x; this.dragHero.y = y;
      this.dragHero.moved = true;
      this.dragHero.valid = this.validHeroPos(x, y, this.heroes[this.dragHero.idx]);
    }
  }
  pointerUp(x, y) {
    if (this.dragHero) {
      const d = this.dragHero;
      this.dragHero = null;
      if (d.moved) {
        if (this.validHeroPos(x, y, this.heroes[d.idx])) this.deployHero(d.idx, x, y);
        else {
          sfx.error();
          this.fx.text(x, y - 20, '✖', { color: '#ff8a7d', size: 18, life: 0.6 });
        }
      } else {
        // tap on hero: skill boost
        const h = this.heroes[d.idx];
        h?.tapBoost();
      }
    }
  }
  startHeroDragFromChip(idx) {
    if (!this.heroes[idx]) return;
    this.dragHero = { idx, x: W / 2, y: H / 2, moved: true, fromChip: true, valid: false };
  }

  // ============================================================
  // RENDER
  // ============================================================
  render() {
    const ctx = this.ctx;
    const sh = this.shakeOn ? this.fx.shakeOffset : [0, 0];
    ctx.save();
    ctx.clearRect(0, 0, W, H);
    ctx.translate(sh[0], sh[1]);
    // background
    ctx.drawImage(this.map.bgCanvas, 0, 0);
    // ground hazards (under units)
    for (const hz of this.hazards) hz.draw(ctx, this.time);
    this.fx.drawDecals(ctx);
    // ambient behind units
    if (this.quality !== 'low') this.ambient.draw(ctx);

    // slot highlights: build mode
    if (this.selBuild) {
      const def = TOWER_MAP[this.selBuild];
      for (const s of this.map.slots) {
        if (s.tower) continue;
        ctx.save();
        const pulse = 0.5 + Math.sin(this.time * 5) * 0.3;
        ctx.strokeStyle = rgba('#57d97a', 0.5 + pulse * 0.4);
        ctx.lineWidth = 2.5;
        ctx.beginPath(); ctx.arc(s.x, s.y, T * 0.36, 0, TAU); ctx.stroke();
        ctx.restore();
      }
      // hover range preview
      const hs = this.hover && this.map.slotAtPixel(this.hover.x, this.hover.y);
      if (hs && !hs.tower) {
        ctx.save();
        ctx.strokeStyle = rgba('#8fd8ff', 0.6); ctx.lineWidth = 2;
        ctx.fillStyle = rgba('#8fd8ff', 0.07);
        const r = def.range * T;
        ctx.beginPath(); ctx.arc(hs.x, hs.y, r, 0, TAU); ctx.fill(); ctx.stroke();
        ctx.globalAlpha = 0.65;
        const spr = getSprite(def.sprite, 'idle', 0, 128);
        ctx.drawImage(spr, hs.x - T * 0.53, hs.y - T * 0.61, T * 1.06, T * 1.06);
        ctx.restore();
      }
    }
    // selected slot range ring
    if (this.selSlot?.tower) {
      const tw = this.selSlot.tower;
      ctx.save();
      ctx.strokeStyle = rgba('#ffd966', 0.7); ctx.lineWidth = 2;
      ctx.setLineDash([6, 6]);
      ctx.beginPath(); ctx.arc(tw.x, tw.y, tw.range, 0, TAU); ctx.stroke();
      ctx.setLineDash([]);
      ctx.restore();
    }
    // sanctuary zone
    if (this.sanctuaryZone) {
      const z = this.sanctuaryZone;
      ctx.save();
      ctx.strokeStyle = rgba('#ffe9a8', 0.5); ctx.lineWidth = 2;
      ctx.setLineDash([4, 8]);
      ctx.beginPath(); ctx.arc(z.x, z.y, z.r, this.time, TAU + this.time); ctx.stroke();
      ctx.setLineDash([]);
      const g = ctx.createRadialGradient(z.x, z.y, 4, z.x, z.y, z.r);
      g.addColorStop(0, rgba('#ffe9a8', 0.10)); g.addColorStop(1, rgba('#ffe9a8', 0));
      ctx.fillStyle = g;
      ctx.beginPath(); ctx.arc(z.x, z.y, z.r, 0, TAU); ctx.fill();
      ctx.restore();
    }

    // dynamic portal/gate glow
    this.drawPortalGate(ctx);

    // draw entities sorted by y for depth
    const drawList = [];
    for (const tw of this.towers) drawList.push({ y: tw.y, fn: () => tw.draw(ctx, this.time) });
    for (const a of this.allies) if (!a.dead) drawList.push({ y: a.y, fn: () => a.draw(ctx) });
    for (const e of this.enemies) if (!e.dead) drawList.push({ y: e.y + (e.flying ? 200 : 0), fn: () => e.draw(ctx, this.time) });
    for (const h of this.heroes) if (h.deployed && (!this.dragHero || this.heroes[this.dragHero.idx] !== h)) drawList.push({ y: h.y, fn: () => h.draw(ctx, this.time) });
    drawList.sort((a, b) => a.y - b.y);
    for (const d of drawList) d.fn();

    // boss shield visual
    if (this.boss && !this.boss.dead && this.boss.bossData?.shieldActive) {
      const b = this.boss;
      ctx.save();
      const col = b.shieldVisual?.color || '#8fd8ff';
      ctx.strokeStyle = rgba(col, 0.8); ctx.lineWidth = 3;
      ctx.shadowColor = col; ctx.shadowBlur = 14;
      ctx.beginPath(); ctx.ellipse(b.x, b.y - 30, 46 * b.size, 52 * b.size, 0, 0, TAU); ctx.stroke();
      ctx.globalAlpha = 0.12;
      ctx.fillStyle = col;
      ctx.fill();
      ctx.restore();
    }
    // obelisk links
    if (this.boss && !this.boss.dead && this.boss.bossData?.obeliskShield) {
      for (const o of this.enemies) {
        if (o.dead || o.id !== 'obelisk') continue;
        ctx.save();
        ctx.strokeStyle = rgba('#ffd966', 0.4 + Math.sin(this.time * 6) * 0.2);
        ctx.lineWidth = 2.5;
        ctx.setLineDash([8, 6]);
        ctx.beginPath(); ctx.moveTo(o.x, o.y - 20); ctx.lineTo(this.boss.x, this.boss.y - 30); ctx.stroke();
        ctx.restore();
      }
    }
    // grab tentacle
    if (this.grabFx && this.boss && !this.boss.dead) {
      const h = this.grabFx.hero;
      ctx.save();
      ctx.strokeStyle = '#5a3a9a'; ctx.lineWidth = 9; ctx.lineCap = 'round';
      const mx = (this.boss.x + h.x) / 2, my = Math.min(this.boss.y, h.y) - 80 + Math.sin(this.time * 8) * 10;
      ctx.beginPath(); ctx.moveTo(this.boss.x, this.boss.y - 30);
      ctx.quadraticCurveTo(mx, my, h.x, h.y - 16); ctx.stroke();
      ctx.strokeStyle = '#8a6ac8'; ctx.lineWidth = 4;
      ctx.stroke();
      ctx.restore();
    }

    // projectiles
    for (const p of this.projectiles) p.draw(ctx);

    // hero drag ghost
    if (this.dragHero) {
      const d = this.dragHero;
      const h = this.heroes[d.idx];
      ctx.save();
      // valid position tint over field
      ctx.globalAlpha = 0.9;
      const px = T * 0.95;
      const spr = getSprite(h.def.sprite, 'idle', 0, 128);
      ctx.globalAlpha = d.valid || !d.moved ? 0.85 : 0.4;
      ctx.drawImage(spr, d.x - px / 2, d.y - px * 0.96, px, px);
      // range circle
      ctx.globalAlpha = 0.5;
      ctx.strokeStyle = d.valid ? rgba('#57d97a', 0.8) : rgba('#f0564a', 0.8);
      ctx.lineWidth = 2;
      ctx.setLineDash([5, 5]);
      ctx.beginPath(); ctx.arc(d.x, d.y, h.range, 0, TAU); ctx.stroke();
      ctx.setLineDash([]);
      ctx.restore();
    }

    // meteor reticle
    if (this.abilities.meteor?.armed) {
      const hx = this.hover?.x ?? W / 2, hy = this.hover?.y ?? H / 2;
      const r = this.abilities.meteor.def.radius * T;
      ctx.save();
      ctx.strokeStyle = rgba('#ff5a4a', 0.9); ctx.lineWidth = 2.5;
      ctx.setLineDash([8, 6]);
      ctx.beginPath(); ctx.arc(hx, hy, r, this.time * 2, TAU + this.time * 2); ctx.stroke();
      ctx.setLineDash([]);
      ctx.strokeStyle = rgba('#ff9a3a', 0.5);
      ctx.beginPath(); ctx.moveTo(hx - r - 8, hy); ctx.lineTo(hx + r + 8, hy);
      ctx.moveTo(hx, hy - r - 8); ctx.lineTo(hx, hy + r + 8); ctx.stroke();
      const g = ctx.createRadialGradient(hx, hy, 2, hx, hy, r);
      g.addColorStop(0, rgba('#ff7a3a', 0.2)); g.addColorStop(1, rgba('#ff7a3a', 0));
      ctx.fillStyle = g;
      ctx.beginPath(); ctx.arc(hx, hy, r, 0, TAU); ctx.fill();
      ctx.restore();
    }

    // freeze overlay
    if (this.freezeT > 0) {
      ctx.save();
      ctx.globalAlpha = clamp(this.freezeT * 0.6, 0, 0.22);
      ctx.fillStyle = '#8fd8ff';
      ctx.fillRect(0, 0, W, H);
      ctx.restore();
    }
    // gold rush overlay
    if (this.goldRushT > 0) {
      ctx.save();
      ctx.globalAlpha = 0.06 + Math.sin(this.time * 6) * 0.02;
      ctx.fillStyle = '#ffd966';
      ctx.fillRect(0, 0, W, H);
      ctx.restore();
    }
    // low lives vignette
    if (this.lives <= 5 && this.phase !== 'victory' && this.phase !== 'defeat') {
      const pulse = 0.5 + Math.sin(this.time * 4) * 0.5;
      const g = ctx.createRadialGradient(W / 2, H / 2, H * 0.3, W / 2, H / 2, H * 0.75);
      g.addColorStop(0, 'rgba(240,86,74,0)');
      g.addColorStop(1, rgba('#f0564a', 0.16 + pulse * 0.14));
      ctx.fillStyle = g;
      ctx.fillRect(0, 0, W, H);
    }

    // particles & texts on top
    this.fx.draw(ctx);
    ctx.restore();

    // banner (screen-space, no shake)
    if (this.bannerQ) {
      const b = this.bannerQ;
      const k = b.t / b.dur;
      ctx.save();
      ctx.globalAlpha = k < 0.2 ? k / 0.2 : (k > 0.85 ? (1 - k) / 0.15 : 1);
      ctx.font = '900 30px "Segoe UI",system-ui,sans-serif';
      ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
      ctx.shadowColor = '#000'; ctx.shadowBlur = 8;
      ctx.strokeStyle = '#0d0a17'; ctx.lineWidth = 6; ctx.lineJoin = 'round';
      ctx.strokeText(b.txt, W / 2, H * 0.2);
      ctx.fillStyle = b.color;
      ctx.fillText(b.txt, W / 2, H * 0.2);
      ctx.restore();
    }
  }

  drawPortalGate(ctx) {
    const p0 = this.map.path[0];
    const p1 = this.map.path[this.map.path.length - 1];
    const pulse = 0.6 + Math.sin(this.time * 3) * 0.4;
    ctx.save();
    // portal swirl
    ctx.translate(p0.x, p0.y);
    ctx.rotate(this.time * 0.8);
    ctx.strokeStyle = rgba('#c05af0', 0.5 * pulse);
    ctx.lineWidth = 2.5;
    ctx.beginPath(); ctx.ellipse(0, 0, T * 0.34, T * 0.46, 0, 0.6, TAU - 0.6); ctx.stroke();
    ctx.beginPath(); ctx.ellipse(0, 0, T * 0.24, T * 0.34, 0, 2.2, TAU + 1.2); ctx.stroke();
    ctx.restore();
    ctx.save();
    // gate heartbeat
    const g2 = ctx.createRadialGradient(p1.x, p1.y, 4, p1.x, p1.y, T * (0.7 + pulse * 0.15));
    g2.addColorStop(0, rgba('#ffe08a', 0.25 * pulse));
    g2.addColorStop(1, rgba('#ffe08a', 0));
    ctx.fillStyle = g2;
    ctx.beginPath(); ctx.arc(p1.x, p1.y, T * 0.85, 0, TAU); ctx.fill();
    ctx.restore();
  }
}
