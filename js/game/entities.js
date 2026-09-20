// ============================================================
// GTDM battle entities — enemies, towers, heroes, allies,
// projectiles, hazards. Pure simulation (no DOM).
// B = battle world (see battle.js)
// ============================================================
import { TAU, clamp, dist, dist2, lerp, angLerp, rgba, shade, pick } from '../core/util.js';
import { K, attrMult, IB_DMG, IB_RATE, IB_RANGE, IB_COST_MULT } from '../data/defs.js';
import { ENEMY_MAP } from '../data/enemies.js';
import { getSprite, getSilhouette } from './sprites.js';
import { sfx } from '../core/audio.js';

const T = K.TILE;
const W = K.W, H = K.H;

// ============================================================
// ENEMY
// ============================================================
let entId = 1;
export class Enemy {
  constructor(B, def, opts = {}) {
    this.uid = entId++;
    this.B = B;
    this.def = def;
    this.id = def.id;
    this.attr = opts.attr || def.attr;
    this.isBoss = !!opts.boss;
    this.isElite = !!opts.elite;
    this.isEcho = !!opts.echo;
    const hpS = (opts.absolute ? 1 : B.hpMult) * (opts.hpMult || 1);
    this.maxHp = Math.round(def.hp * hpS);
    this.hp = this.maxHp;
    this.baseSpd = def.spd * (opts.absolute ? 1 : B.spdMult);
    this.armor = (def.armor || 0) + (opts.absolute ? 0 : B.armorAdd);
    this.mres = def.mres || 0;
    this.gold = Math.round(def.gold * (opts.absolute ? 1 : B.goldMult));
    this.leakDmg = def.dmg ?? 1;
    this.size = (def.size || 0.8) * (opts.sizeMult || 1);
    this.flying = !!def.flying;
    this.undead = !!def.undead;
    this.heavy = !!def.heavy;
    this.still = !!def.still;
    this.d = opts.d ?? 0;                 // distance along path
    this.x = 0; this.y = 0; this.ang = 0;
    this.dead = false; this.leaked = false;
    this.flash = 0;
    // status
    this.slow = 0; this.slowT = 0;        // pct (0..0.9)
    this.stunT = 0;
    this.burn = null; this.bleed = []; this.poison = null;
    this.mark = 0; this.markT = 0;        // dmg taken multiplier
    this.shredT = 0; this.shred = 0;      // armor reduction pct
    this.shield = 0; this.shieldMax = 0; this.shieldRegenT = 0;
    this.pullV = 0;                        // backward px/s from void
    this.reveal = 0;                       // forced-visible timer
    // stealth cycle
    this.stealthed = false;
    if (def.stealth) this.stT = def.stealth.off * Math.random();
    // blink
    this.blinkT = def.blink ? def.blink.cd * (0.5 + Math.random() * 0.5) : 0;
    // attr shift
    this.shiftT = def.attrShift ? def.attrShift.cd : 0;
    this.attrOrder = ['scissors', 'rock', 'paper'];
    this.attrI = this.attrOrder.indexOf(this.attr);
    // rush
    this.rushT = def.rush ? def.rush.cd * Math.random() : 0;
    this.rushLeft = 0;
    // summon/heal/shieldAura/debuff handled in update via timers
    this.sumT = def.summon ? def.summon.cd * (0.4 + Math.random() * 0.4) : 0;
    this.summonCount = 0;
    this.healT = 0;
    this.auraT = def.shieldAura ? def.shieldAura.cd * Math.random() : 0;
    this.smashT = def.smash ? def.smash.cd * Math.random() : 0;
    // regen
    this.regen = def.regen || 0;
    this.affix = opts.affix || null;
    // boss extras (filled by boss module)
    this.bossData = opts.bossData || null;
    this.speedBuffs = [];  // {mult, t}
    this.anim = Math.random() * 10;
    this.spawnT = 0.35;    // spawn-in scale anim
    // fight blockers
    this.fighting = null;
    this.atkT = 0;
    this.updatePos();
  }

  updatePos() {
    const p = this.B.map.posAt(this.d);
    this.x = p.x; this.y = p.y; this.ang = p.ang;
    if (this.flying) this.y -= 10 + Math.sin(this.anim * 2.4) * 3;
  }

  get effectiveSpd() {
    let s = this.baseSpd;
    s *= (1 - Math.min(0.85, this.slow));
    for (const b of this.speedBuffs) s *= b.mult;
    if (this.rushLeft > 0 && this.def.rush) s *= this.def.rush.mult;
    return s;
  }

  get targetable() {
    if (this.dead) return false;
    if (this.stealthed && this.reveal <= 0) return false;
    return true;
  }

  update(dt) {
    const B = this.B, def = this.def;
    this.anim += dt;
    if (this.spawnT > 0) this.spawnT -= dt;
    if (this.flash > 0) this.flash -= dt;
    if (this.markT > 0) { this.markT -= dt; if (this.markT <= 0) this.mark = 0; }
    if (this.shredT > 0) { this.shredT -= dt; if (this.shredT <= 0) this.shred = 0; }
    if (this.reveal > 0) this.reveal -= dt;
    for (let i = this.speedBuffs.length - 1; i >= 0; i--) { this.speedBuffs[i].t -= dt; if (this.speedBuffs[i].t <= 0) this.speedBuffs.splice(i, 1); }

    // freeze (global) or stun
    const frozen = B.freezeT > 0;
    if (this.stunT > 0) this.stunT -= dt;
    const immobile = frozen || this.stunT > 0;

    // dots
    if (this.burn) {
      this.burn.t -= dt;
      this.burn.acc += this.burn.dps * dt;
      if (this.burn.acc >= 4) { const dmg = this.burn.acc; this.burn.acc = 0; this.takeDamage(dmg, { type: 'magic', silent: true, color: '#ff9a3a' }); }
      if (this.burn.t <= 0) this.burn = null;
      else if (Math.random() < dt * 6) B.fx.embers(this.x, this.y - this.size * 20, 1, '#ff9a3a');
    }
    for (let i = this.bleed.length - 1; i >= 0; i--) {
      const b = this.bleed[i]; b.t -= dt; b.acc += b.dps * dt;
      if (b.acc >= 4) { const dmg = b.acc; b.acc = 0; this.takeDamage(dmg, { type: 'phys', silent: true, color: '#ff5a5a' }); }
      if (b.t <= 0) this.bleed.splice(i, 1);
    }
    if (this.poison) {
      this.poison.t -= dt; this.poison.acc += this.poison.dps * dt;
      if (this.poison.acc >= 4) { const dmg = this.poison.acc; this.poison.acc = 0; this.takeDamage(dmg, { type: 'magic', silent: true, color: '#7dff5a' }); }
      if (this.poison.t <= 0) this.poison = null;
    }
    if (this.dead) return;

    // regen
    if (this.regen && this.hp < this.maxHp && !immobile) {
      this.hp = Math.min(this.maxHp, this.hp + this.maxHp * this.regen * dt);
    }
    // shield regen
    if (this.def.shield && this.shield < this.def.shield.amt) {
      this.shieldRegenT += dt;
      if (this.shieldRegenT >= this.def.shield.regenAfter) { this.shield = this.def.shield.amt; this.shieldRegenT = 0; B.fx.ring(this.x, this.y - 14, { r: 22, color: '#8fd8ff', life: 0.4, lw: 2 }); }
    } else if (this.shieldRegenT < 99) this.shieldRegenT += dt * 0; // noop

    // stealth cycle
    if (def.stealth) {
      this.stT -= dt * (frozen ? 0 : 1);
      if (this.stT <= 0) {
        this.stealthed = !this.stealthed;
        this.stT = this.stealthed ? def.stealth.on : def.stealth.off;
        if (this.stealthed) B.fx.smoke(this.x, this.y - 12, { n: 4, color: '#5a4a7a', life: 0.5, size: 8 });
      }
    }
    // attr shift
    if (def.attrShift && !immobile) {
      this.shiftT -= dt;
      if (this.shiftT <= 0) {
        this.shiftT = def.attrShift.cd;
        this.attrI = (this.attrI + 1) % 3;
        this.attr = this.attrOrder[this.attrI];
        B.fx.ring(this.x, this.y - 14, { r: 26, color: attrColor(this.attr), life: 0.5, lw: 3 });
      }
    }
    // rush
    if (def.rush) {
      if (this.rushLeft > 0) this.rushLeft -= dt;
      else {
        this.rushT -= dt * (immobile ? 0 : 1);
        if (this.rushT <= 0) { this.rushT = def.rush.cd; this.rushLeft = def.rush.dur; B.fx.burst(this.x, this.y - 10, { n: 5, color: '#ffd966', speed: 60, life: 0.4, size: 3 }); }
      }
    }
    // blink
    if (def.blink && !immobile) {
      this.blinkT -= dt;
      const panic = def.panicBlink && this.hp < this.maxHp * 0.45;
      if (this.blinkT <= 0) { this.blinkT = def.blink.cd * (panic ? 0.5 : 1); this.doBlink(def.blink.tiles); }
    }
    // healer
    if (def.heal && !immobile) {
      this.healT -= dt;
      if (this.healT <= 0) {
        this.healT = def.heal.cd;
        let healed = false;
        for (const e of B.enemies) {
          if (e === this || e.dead || e.hp >= e.maxHp) continue;
          if (dist2(this.x, this.y, e.x, e.y) < (def.heal.radius * T) ** 2) {
            e.hp = Math.min(e.maxHp, e.hp + e.maxHp * def.heal.pct);
            healed = true;
            B.fx.beam(this.x, this.y - 16, e.x, e.y - 12, { color: '#7dff8a', life: 0.25, lw: 2, jag: 0.05 });
          }
        }
        if (healed) B.fx.ring(this.x, this.y - 10, { r: def.heal.radius * T, color: '#7dff8a', life: 0.5, lw: 2 });
      }
    }
    // summoner
    if (def.summon && !immobile && B.aliveCount() < B.MAX_ENEMIES) {
      this.sumT -= dt;
      if (this.sumT <= 0) {
        this.sumT = def.summon.cd;
        if (this.summonCount < (def.summon.max ?? 99)) {
          this.summonCount++;
          B.spawnEnemy(def.summon.id, { d: Math.max(0, this.d - 12), quiet: true });
          B.fx.ring(this.x, this.y - 8, { r: 30, color: '#7dffb0', life: 0.5 });
          B.fx.smoke(this.x, this.y - 6, { n: 5, color: '#3a5a44', life: 0.6 });
        }
      }
    }
    // shield aura
    if (def.shieldAura && !immobile) {
      this.auraT -= dt;
      if (this.auraT <= 0) {
        this.auraT = def.shieldAura.cd;
        for (const e of B.enemies) {
          if (e.dead || e.shield > 0) continue;
          if (dist2(this.x, this.y, e.x, e.y) < (def.shieldAura.radius * T) ** 2) {
            e.shield = e.shieldMax = Math.round(def.shieldAura.amt * B.hpMult * 0.5 + def.shieldAura.amt);
            B.fx.ring(e.x, e.y - 12, { r: 18, color: '#c05af0', life: 0.4, lw: 2 });
          }
        }
        B.fx.ring(this.x, this.y - 10, { r: def.shieldAura.radius * T, color: '#c05af0', life: 0.6, lw: 2 });
      }
    }
    // siege smash
    if (def.smash && !immobile) {
      this.smashT -= dt;
      if (this.smashT <= 0) {
        this.smashT = def.smash.cd;
        const tower = B.towers.filter(t => !t.disabled && dist2(t.x, t.y, this.x, this.y) < (1.9 * T) ** 2)
          .sort((a, b) => dist2(a.x, a.y, this.x, this.y) - dist2(b.x, b.y, this.x, this.y))[0];
        if (tower) {
          B.disableTower(tower, def.smash.dur, 'smash');
          B.fx.shards(tower.x, tower.y - 20, 8, '#8a92a4');
          B.fx.shake(4, 0.2);
          sfx.hit();
        }
      }
    }

    // ---- movement / blocking ----
    if (immobile) { this.fighting = null; }
    else {
      // check blockers in contact (ground enemies only)
      if (!this.flying) {
        const contact = this.findBlocker();
        if (contact) {
          this.fighting = contact;
          this.atkT -= dt;
          if (this.atkT <= 0) {
            this.atkT = this.isBoss ? 0.55 : 0.85;
            const dmg = (this.isBoss ? 60 : 9 + this.maxHp * 0.006) * (B.difficultyAtk || 1);
            contact.takeDamage(dmg, this);
            B.fx.burst(contact.x, contact.y - 12, { n: 3, color: '#ff9a8a', speed: 70, life: 0.3, size: 2.5 });
            if (this.isBoss) { B.fx.shake(2.5, 0.12); }
          }
          if (this.isBoss) {
            // bosses crush through (slowly)
            this.d += this.effectiveSpd * T * dt * 0.35;
          }
        } else {
          this.fighting = null;
          this.d += this.effectiveSpd * T * dt;
        }
      } else {
        this.d += this.effectiveSpd * T * dt;
      }
      // void pull
      if (this.pullV > 0) this.d -= this.pullV * dt;
      this.d = Math.max(0, this.d);
    }
    this.updatePos();
    if (this.d >= B.map.pathLen && !this.dead && !this.still) {
      this.leak();
    }
  }

  findBlocker() {
    // nearest ally blocker ahead within contact distance on path
    let best = null;
    for (const a of this.B.allies) {
      if (a.dead || a.flying) continue;
      if (Math.abs(a.d - this.d) < T * 0.42 && a.d >= this.d - T * 0.5) {
        if (!best || a.d < best.d) best = a;
      }
    }
    // darkblades hunt blockers within a wider window
    if (!best && this.def.huntBlockers) {
      for (const a of this.B.allies) {
        if (a.dead) continue;
        if (a.d > this.d && a.d - this.d < T * 3) { best = a; this.d = Math.min(this.d + this.effectiveSpd * T * 0.016 * 2, a.d - T * 0.3); break; }
      }
    }
    return best;
  }

  doBlink(tiles) {
    const B = this.B;
    const oldX = this.x, oldY = this.y;
    B.fx.smoke(oldX, oldY - 12, { n: 6, color: '#c05af0', life: 0.45 });
    this.d = Math.min(B.map.pathLen - 4, this.d + tiles * T);
    this.updatePos();
    B.fx.ring(this.x, this.y - 12, { r: 24, color: '#c05af0', life: 0.4 });
    B.fx.smoke(this.x, this.y - 12, { n: 6, color: '#c05af0', life: 0.45 });
    sfx.magic();
  }

  // dmgType: phys | magic | true
  takeDamage(amount, opts = {}) {
    if (this.dead) return 0;
    const B = this.B;
    const type = opts.type || 'phys';
    let dmg = amount;
    // attribute triangle
    if (opts.attr) dmg *= attrMult(opts.attr, this.attr);
    // mark & passives
    dmg *= (1 + this.mark);
    if (B.heroPassive('luna') && this.slow > 0) dmg *= 1.12;
    if (opts.vsBossLike && (this.isBoss || this.isElite)) dmg *= opts.vsBossLike;
    if (opts.srcHero === 'nyx' && (this.slow > 0 || this.pullV > 0)) dmg *= 1.2;
    if (opts.srcHero === 'grimm' && (this.isBoss || this.isElite)) dmg *= 1.25;
    if (opts.crit) { /* already multiplied */ }
    // dodge
    if (this.def.dodge && opts.projectile && Math.random() < this.def.dodge) {
      B.fx.text(this.x, this.y - 34, B.t('miss') || 'MISS', { color: '#cfd6e4', size: 12, life: 0.6 });
      return 0;
    }
    // defenses
    if (type === 'phys') {
      const armor = this.armor * (1 - this.shred) * (1 - (opts.pierceArmor || 0));
      dmg = Math.max(dmg * 0.12, dmg - armor);
    } else if (type === 'magic') {
      const mr = this.mres * (1 - (opts.pierceRes || 0));
      dmg *= (1 - mr);
      if (opts.trueDmgPct) dmg = dmg * (1 - opts.trueDmgPct) + amount * opts.trueDmgPct * (opts.attr ? attrMult(opts.attr, this.attr) : 1);
    }
    // boss shield phases
    if (this.shieldPhase && this.shieldPhase.active) dmg *= (1 - this.shieldPhase.reduction);
    if (this.bossData && this.bossData.shieldActive) dmg *= (1 - this.bossData.shieldActive);
    // warlock-style absorb shield
    if (this.shield > 0 && dmg > 0) {
      const absorbed = Math.min(this.shield, dmg);
      this.shield -= absorbed; dmg -= absorbed;
      this.shieldRegenT = 0;
      B.fx.burst(this.x, this.y - 16, { n: 3, color: '#c9a2ff', speed: 80, life: 0.3, size: 2.5 });
      if (this.shield <= 0) B.fx.ring(this.x, this.y - 14, { r: 24, color: '#c9a2ff', life: 0.35, lw: 2 });
    }
    dmg = Math.max(0, dmg);
    this.hp -= dmg;
    this.flash = 0.09;
    if (!opts.silent && dmg > 0) {
      const col = opts.color || (opts.crit ? '#ffd966' : '#ffffff');
      const showD = B.showFloat;
      if (showD) {
        B.fx.text(this.x + (opts.fx ?? 0) + (Math.random() * 12 - 6), this.y - this.size * 34 - 6, B.fmtDmg(dmg), { color: col, size: opts.crit ? 17 : this.isBoss ? 15 : 12.5, crit: !!opts.crit, life: opts.crit ? 1.0 : 0.7, shadow: opts.crit ? '#f5c542' : null });
      }
      if (this.goldOnHit && Math.random() < this.goldOnHit.chance) {
        B.addGold(this.goldOnHit.gold, this.x, this.y);
      }
    }
    if (opts.applyStatus) opts.applyStatus(this);
    if (this.hp <= 0) this.die(opts);
    return dmg;
  }

  die(opts = {}) {
    if (this.dead) return;
    const B = this.B;
    // boss revive check (Phoenix Emperor etc.)
    if (this.isBoss && B.onBossDeath && B.onBossDeath(this) === 'revive') return;
    this.dead = true;
    // ember wildfire spread
    if (this.burn && B.heroPassive('ember')) {
      const near = B.enemies.filter(e => !e.dead && e !== this && dist2(e.x, e.y, this.x, this.y) < (T * 1.2) ** 2)[0];
      if (near) applyBurn(near, this.burn.dps, this.burn.t, B);
    }
    // death gold
    let gold = this.gold;
    if (B.goldRushT > 0) gold = Math.round(gold * B.goldRushMult);
    if (B.heroPassive('leo')) gold = Math.round(gold * 1.1);
    if (this.bossData?.deathGold) gold += this.bossData.deathGold;
    B.addGold(gold, this.x, this.y, this.isBoss);
    B.stats.kills++;
    if (this.flying) B.stats.airKills++;
    if (this.isElite) B.stats.eliteKills++;
    if (this.isBoss) { B.stats.bossKills++; B.codexBoss(this.id); }
    B.codex(this.id);
    // chrys nearby kill bonus
    for (const t of B.towers) {
      if (t.def.id === 'chrys' && !t.disabled && dist2(t.x, t.y, this.x, this.y) < (t.range + T) ** 2) {
        B.addGold(t.mech.goldPerKillNear || 2, this.x, this.y, false, true);
      }
    }
    // splits
    if (this.def.split && !opts.noSplit) {
      const sd = this.def.split;
      for (let i = 0; i < sd.count; i++) {
        B.spawnEnemy(sd.id, { d: Math.max(0, this.d - 8 + i * 10), quiet: true, hpMult: 1 });
      }
      B.fx.burst(this.x, this.y - 12, { n: 10, color: shade(attrColor(this.attr), 0), speed: 120, life: 0.5, size: 4 });
    }
    // boss death handled by boss module via B.onBossDeath
    if (this.isBoss) B.onBossDeath(this);
    // fx
    const col = attrColor(this.attr);
    B.fx.burst(this.x, this.y - this.size * 20, { n: this.isBoss ? 40 : 10, color: col, speed: this.isBoss ? 260 : 130, life: this.isBoss ? 0.9 : 0.5, size: this.isBoss ? 6 : 3.5, g: 260 });
    B.fx.burst(this.x, this.y - this.size * 20, { n: this.isBoss ? 20 : 5, color: '#ffffff', speed: this.isBoss ? 200 : 90, life: 0.4, size: this.isBoss ? 5 : 2.5, g: 200 });
    if (this.isBoss) {
      B.fx.shake(14, 0.8); B.fx.screenFlash('#ffffff', 0.5, 0.5);
      B.fx.ring(this.x, this.y - 20, { r: 160, color: '#ffd966', life: 0.9, lw: 6, fill: '#ffd966' });
      sfx.boom(true);
    } else sfx.die();
    B.removeEnemy(this);
  }

  leak() {
    if (this.leaked || this.dead) return;
    this.leaked = true; this.dead = true;
    const B = this.B;
    B.leak(this);
    B.removeEnemy(this);
  }

  applySlow(pct, dur) {
    if (this.isBoss) { pct *= 0.55; dur *= 0.7; }
    if (pct >= this.slow || this.slowT <= 0) this.slow = Math.max(this.slow, pct);
    this.slowT = Math.max(this.slowT, dur);
  }
  updateSlow(dt) {
    if (this.slowT > 0) { this.slowT -= dt; if (this.slowT <= 0) this.slow = 0; }
  }
  applyStun(dur) {
    if (this.isBoss) dur *= 0.4;
    this.stunT = Math.max(this.stunT, dur);
  }
  applyBurn(dps, dur) { applyBurn(this, dps, dur, this.B); }

  // ---------- rendering ----------
  draw(ctx, time) {
    const B = this.B;
    const s = this.size;
    const spawnK = this.spawnT > 0 ? 1 - this.spawnT / 0.35 : 1;
    const px = s * T * 0.92 * (this.isBoss ? 1.05 : 1);
    ctx.save();
    ctx.translate(this.x, this.y);
    if (spawnK < 1) { ctx.globalAlpha = spawnK; ctx.scale(0.6 + spawnK * 0.4, 0.6 + spawnK * 0.4); }
    // shadow
    ctx.fillStyle = 'rgba(0,0,0,0.32)';
    ctx.beginPath(); ctx.ellipse(0, this.flying ? 16 : 2, px * 0.32, px * 0.12, 0, 0, TAU); ctx.fill();
    // freeze tint backdrop
    if (B.freezeT > 0 || this.stunT > 0) {
      ctx.save();
      ctx.globalAlpha = 0.5;
      ctx.fillStyle = B.freezeT > 0 ? 'rgba(140,215,255,0.4)' : 'rgba(255,230,140,0.25)';
      ctx.beginPath(); ctx.ellipse(0, -px * 0.32, px * 0.42, px * 0.5, 0, 0, TAU); ctx.fill();
      ctx.restore();
    }
    // sprite
    const walking = !this.fighting && B.freezeT <= 0 && this.stunT <= 0 && !this.still;
    const pose = walking ? 'walk' : (this.fighting ? 'attack' : 'idle');
    const nf = pose === 'walk' ? 6 : pose === 'attack' ? 3 : 4;
    const rate = this.flying ? 1.4 : clamp(this.effectiveSpd * 0.55, 0.5, 2.2);
    const frame = Math.floor(this.anim * nf * rate) % nf;
    const flip = Math.cos(this.ang) < 0;
    const spr = this.flash > 0
      ? getSilhouette(this.def.sprite, pose, frame, 128, this.isBoss ? '#ffd0d0' : '#ffffff')
      : getSprite(this.def.sprite, pose, frame, 128);
    ctx.save();
    if (flip) ctx.scale(-1, 1);
    // stealth alpha
    if (this.stealthed) {
      ctx.globalAlpha = this.reveal > 0 ? 0.75 : 0.22;
    }
    ctx.drawImage(spr, -px / 2, -px * 0.92, px, px);
    ctx.restore();

    // elite/boss decor
    if (this.isElite) {
      ctx.save();
      ctx.shadowColor = '#ffd966'; ctx.shadowBlur = 8;
      ctx.fillStyle = '#ffd966';
      const cy = -px * 0.98;
      ctx.font = `${px * 0.26}px serif`;
      ctx.textAlign = 'center';
      ctx.fillText('♛', 0, cy);
      ctx.restore();
    }
    // statuses
    const st = [];
    if (this.burn) st.push('#ff9a3a');
    if (this.bleed.length) st.push('#ff5a5a');
    if (this.poison) st.push('#7dff5a');
    if (this.slow > 0) st.push('#8fd8ff');
    if (this.mark > 0) st.push('#c05af0');
    if (st.length && !this.isBoss) {
      const y = -px * 1.02 - (this.isElite ? 8 : 0);
      st.forEach((c, i) => {
        ctx.fillStyle = c;
        ctx.beginPath(); ctx.arc((i - (st.length - 1) / 2) * 7, y, 2.4, 0, TAU); ctx.fill();
      });
    }
    // hp bar
    if (!this.isBoss && this.hp < this.maxHp) {
      const bw = px * 0.62, bh = this.isElite ? 5 : 4;
      const by = -px * 0.92 - 7 - (this.isElite ? 8 : 0);
      ctx.fillStyle = 'rgba(10,6,20,0.72)';
      ctx.fillRect(-bw / 2 - 1, by - 1, bw + 2, bh + 2);
      const pct = clamp(this.hp / this.maxHp, 0, 1);
      ctx.fillStyle = pct > 0.5 ? '#57d97a' : pct > 0.25 ? '#ffd966' : '#f0564a';
      ctx.fillRect(-bw / 2, by, bw * pct, bh);
      if (this.shield > 0) {
        ctx.fillStyle = rgba('#8fd8ff', 0.9);
        ctx.fillRect(-bw / 2, by - 2.5, bw * clamp(this.shield / Math.max(1, this.shieldMax), 0, 1), 2);
      }
    }
    // attr pip (only when shifted species or elite) — small readable dot
    if (this.id === 'prism' || this.bossData?.attrShifting) {
      ctx.fillStyle = attrColor(this.attr);
      ctx.shadowColor = ctx.fillStyle; ctx.shadowBlur = 6;
      ctx.beginPath(); ctx.arc(px * 0.36, -px * 0.5, 3.4, 0, TAU); ctx.fill();
      ctx.shadowBlur = 0;
    }
    ctx.restore();
    // slow timer decay handled in battle update
  }
}

export function attrColor(a) { return a === 'scissors' ? '#ff9a5c' : a === 'rock' ? '#b0b8cc' : '#8fe0a8'; }

function applyBurn(e, dps, dur, B) {
  if (e.isBoss) { dps *= 0.5; dur *= 0.6; }
  if (!e.burn || e.burn.dps < dps) e.burn = { dps, t: Math.max(dur, e.burn?.t ?? 0), acc: e.burn?.acc ?? 0 };
  else e.burn.t = Math.max(e.burn.t, dur);
}

// ============================================================
// ALLY SUMMONS (soldiers, wolves, golem guardians)
// ============================================================
export class Ally {
  constructor(B, kind, opts = {}) {
    this.B = B; this.uid = entId++;
    this.kind = kind; // 'soldier' | 'wolf' | 'golemg'
    this.def = ENEMY_MAP[kind === 'soldier' ? 'skeleton' : kind === 'wolf' ? 'wolf' : 'golem']; // reuse base stats
    this.sprite = kind === 'soldier' ? 'soldier' : kind === 'wolf' ? 'wolfpup' : 'golemguard';
    const terraBuff = B.heroPassive('terra');
    if (kind === 'soldier') {
      this.maxHp = (90 + B.wave * 14) * (terraBuff ? 1.25 : 1);
      this.dmg = (7 + B.wave * 1.1) * (terraBuff ? 1.15 : 1);
      this.spd = 0; // stationary blocker
      this.range = T * 0.5;
      this.rate = 1.1;
    } else if (kind === 'wolf') {
      this.maxHp = (70 + B.wave * 10) * (terraBuff ? 1.25 : 1);
      this.dmg = (10 + B.wave * 1.4) * (terraBuff ? 1.15 : 1);
      this.spd = 3.4;
      this.range = T * 0.55;
      this.rate = 1.8;
      this.flying = false;
    } else { // golem guardian
      this.maxHp = (420 + B.wave * 60) * (terraBuff ? 1.25 : 1);
      this.dmg = (26 + B.wave * 4) * (terraBuff ? 1.15 : 1);
      this.spd = 0;
      this.range = T * 0.6;
      this.rate = 0.7;
      this.stunHit = true;
      this.expire = opts.expire ?? 14;
    }
    this.hp = this.maxHp;
    this.d = opts.d ?? 0;
    this.homeD = this.d;
    this.x = 0; this.y = 0;
    this.dead = false;
    this.atkT = 0;
    this.target = null;
    this.anim = Math.random() * 10;
    this.flash = 0;
    this.updatePos();
  }
  updatePos() {
    const p = this.B.map.posAt(this.d);
    this.x = p.x; this.y = p.y;
    this.flip = Math.cos(p.ang) < 0;
  }
  takeDamage(dmg, from) {
    this.hp -= dmg;
    this.flash = 0.08;
    if (this.hp <= 0 && !this.dead) {
      this.dead = true;
      this.B.fx.burst(this.x, this.y - 14, { n: 12, color: this.kind === 'wolf' ? '#7a94b8' : '#cfd6e4', speed: 130, life: 0.55, size: 3.5, g: 300 });
      this.B.fx.shards(this.x, this.y - 10, 5, '#cfd6e4');
      sfx.die();
      this.B.removeAlly(this);
    }
  }
  update(dt) {
    const B = this.B;
    this.anim += dt;
    if (this.flash > 0) this.flash -= dt;
    if (this.expire !== undefined) { this.expire -= dt; if (this.expire <= 0) { this.dead = true; B.fx.smoke(this.x, this.y - 12, { n: 6, color: '#8a8494' }); B.removeAlly(this); return; } }
    // find target
    if (this.kind === 'wolf') {
      // hunt: move toward nearest enemy ahead (or behind within 4 tiles)
      let best = null, bd = 1e9;
      for (const e of B.enemies) {
        if (e.dead || e.flying || !e.targetable) continue;
        const dd = e.d - this.d;
        if (dd > -T * 2 && Math.abs(dd) < bd) { bd = Math.abs(dd); best = e; }
      }
      this.target = best;
      if (best) {
        const dd = best.d - this.d;
        if (Math.abs(dd) > T * 0.34) {
          this.d += Math.sign(dd) * Math.min(Math.abs(dd), this.spd * T * dt);
          this.updatePos();
        } else {
          this.atkT -= dt;
          if (this.atkT <= 0) {
            this.atkT = 1 / this.rate;
            best.takeDamage(this.dmg * attrMult('scissors', best.attr), { type: 'phys', attr: 'scissors', silent: false, color: '#cfe0f0' });
            if (Math.random() < 0.18) best.applyStun(0.3);
            B.fx.burst(best.x, best.y - 14, { n: 4, color: '#ff9a8a', speed: 90, life: 0.3, size: 2.5 });
            sfx.hit();
          }
        }
      } else {
        // drift back home
        if (Math.abs(this.d - this.homeD) > T) { this.d += Math.sign(this.homeD - this.d) * this.spd * T * dt * 0.6; this.updatePos(); }
      }
    } else {
      // blocker: attack enemies in contact
      let best = null;
      for (const e of B.enemies) {
        if (e.dead || e.flying || !e.targetable) continue;
        if (Math.abs(e.d - this.d) < T * 0.5) { if (!best || e.d < best.d) best = e; }
      }
      this.target = best;
      if (best) {
        this.atkT -= dt;
        if (this.atkT <= 0) {
          this.atkT = 1 / this.rate;
          best.takeDamage(this.dmg * attrMult('rock', best.attr), { type: 'phys', attr: 'rock', color: '#ffe9a8' });
          if (this.stunHit) best.applyStun(0.5);
          B.fx.burst(best.x, best.y - 14, { n: 3, color: '#ffd966', speed: 70, life: 0.28, size: 2.5 });
          sfx.hit();
        }
      }
    }
  }
  draw(ctx) {
    const px = (this.kind === 'golemg' ? 1.15 : this.kind === 'wolf' ? 0.85 : 0.9) * T * 0.8;
    ctx.save();
    ctx.translate(this.x, this.y);
    ctx.fillStyle = 'rgba(0,0,0,0.3)';
    ctx.beginPath(); ctx.ellipse(0, 2, px * 0.3, px * 0.11, 0, 0, TAU); ctx.fill();
    // team glow ring
    ctx.save();
    ctx.strokeStyle = rgba('#57d97a', 0.5); ctx.lineWidth = 2;
    ctx.shadowColor = '#57d97a'; ctx.shadowBlur = 6;
    ctx.beginPath(); ctx.ellipse(0, 2, px * 0.34, px * 0.13, 0, 0, TAU); ctx.stroke();
    ctx.restore();
    const pose = this.target ? 'attack' : 'idle';
    const nf = pose === 'attack' ? 3 : 4;
    const frame = Math.floor(this.anim * (this.kind === 'wolf' ? 3 : 1.6)) % nf;
    const spr = this.flash > 0 ? getSilhouette(this.sprite, pose, frame, 96, '#ffffff') : getSprite(this.sprite, pose, frame, 96);
    ctx.save();
    if (this.flip) ctx.scale(-1, 1);
    ctx.drawImage(spr, -px / 2, -px * 0.92, px, px);
    ctx.restore();
    // hp bar
    if (this.hp < this.maxHp) {
      const bw = px * 0.5;
      ctx.fillStyle = 'rgba(10,6,20,0.7)'; ctx.fillRect(-bw / 2 - 1, -px * 0.98, bw + 2, 4.5);
      ctx.fillStyle = '#57d97a'; ctx.fillRect(-bw / 2, -px * 0.98 + 1, bw * clamp(this.hp / this.maxHp, 0, 1), 2.5);
    }
    if (this.expire !== undefined) {
      ctx.fillStyle = rgba('#a8e06a', 0.8);
      ctx.fillRect(-px * 0.25, -px * 1.08, px * 0.5 * clamp(this.expire / 14, 0, 1), 2);
    }
    ctx.restore();
  }
}

// ============================================================
// TOWER
// ============================================================
const TARGET_MODES = ['first', 'last', 'strong', 'close'];
export class Tower {
  constructor(B, slot, def, metaLvl) {
    this.B = B; this.uid = entId++;
    this.slot = slot; this.def = def;
    this.metaLvl = metaLvl;
    this.lvl = 1; // in-battle 1..3
    this.x = slot.x; this.y = slot.y;
    this.cd = 0;
    this.angle = -Math.PI / 2;
    this.targetMode = 0;
    this.disabled = 0;        // seconds remaining
    this.disableFx = null;    // 'ice'|'gold'|'hex'|'smash'|'meteor'|'sheep'|'root'|'poison'
    this.recoil = 0;
    this.anim = Math.random() * 10;
    this.totalDmg = 0;
    this.kills = 0;
    this.spendGold = 0;
    this.summons = [];        // allied units owned
    this.respawnT = 0;
    this.goldTick = 0;
    this.chainBonus = 0;
    this.lastShot = 0;
    this.novaT = 0;
    this.rateDebuff = 0;
  }
  get mech() { return this.def.mech || {}; }
  get dmg() {
    const B = this.B;
    let d = this.def.dmg * IB_DMG[this.lvl - 1] * K.towerMetaBonus(this.metaLvl) * (this.refineMult || 1);
    d *= B.towerDmgBuff(this);
    return d;
  }
  get rate() {
    const B = this.B;
    let r = this.def.rate * IB_RATE[this.lvl - 1];
    r *= B.towerRateBuff(this);
    return Math.max(0.05, r);
  }
  get range() {
    const B = this.B;
    return this.def.range * T * IB_RANGE[this.lvl - 1] * K.towerMetaRange(this.metaLvl) * B.rangeMult * B.towerRangeBuff(this);
  }
  get sellValue() {
    return Math.floor(this.spendGold * K.SELL_RATIO);
  }
  dpsEst() {
    if (this.disabled) return 0;
    const m = this.mech;
    let d = this.def.dmg * this.rate;
    if (m.chain) d *= m.chain.count;
    if (m.splash) d *= 1.8;
    if (m.nova) d *= 2.2;
    if (m.stormStrikes) d *= m.stormStrikes.count;
    if (m.summon) d = 40 + this.lvl * 20;
    if (m.goldGen) d = 1;
    return d * (1 + (this.metaLvl - 1) * 0.05);
  }
  upgradeCost() {
    if (this.lvl >= K.INBATTLE_MAX) return null;
    return Math.round(this.def.cost * IB_COST_MULT[this.lvl] * (this.B.costMult || 1));
  }

  findTarget() {
    const B = this.B;
    const mode = TARGET_MODES[this.targetMode];
    const r2 = this.range ** 2;
    let best = null, bestV = -1e9;
    for (const e of B.enemies) {
      if (e.dead || !e.targetable) continue;
      if (e.flying && this.def.air === false) continue;
      if (!e.flying && this.def.ground === false) continue;
      const d2 = dist2(this.x, this.y, e.x, e.y);
      if (d2 > r2) continue;
      let v;
      switch (mode) {
        case 'first': v = e.d; break;
        case 'last': v = -e.d; break;
        case 'strong': v = e.hp; break;
        default: v = -d2; break;
      }
      if (v > bestV) { bestV = v; best = e; }
    }
    return best;
  }
  densestPoint(radius) {
    // point with most enemies clustered (for clouds/nova)
    const B = this.B;
    let best = null, bestN = 0;
    for (const e of B.enemies) {
      if (e.dead || !e.targetable) continue;
      let n = 0;
      for (const o of B.enemies) {
        if (o.dead || !o.targetable) continue;
        if (dist2(e.x, e.y, o.x, o.y) < (radius * T) ** 2) n++;
      }
      if (n > bestN) { bestN = n; best = e; }
    }
    return bestN >= 2 ? best : null;
  }

  update(dt) {
    const B = this.B;
    this.anim += dt;
    if (this.recoil > 0) this.recoil -= dt * 4;
    if (this.disabled > 0) {
      this.disabled -= dt;
      if (this.disabled <= 0) { this.disableFx = null; B.fx.ring(this.x, this.y - 18, { r: 30, color: '#57d97a', life: 0.4 }); }
      return;
    }
    // ---- special always-on mechanics ----
    const m = this.mech;
    // barracks / wolf den summon management
    if (m.summon) {
      this.summons = this.summons.filter(a => !a.dead);
      const want = m.summon.count + (this.lvl >= 3 ? 1 : 0);
      if (this.summons.length < want) {
        this.respawnT -= dt;
        if (this.respawnT <= 0) {
          const unit = m.summon.unit === 'wolf' ? 'wolf' : 'soldier';
          const dSpawn = m.summon.hunt ? Math.max(0, this.nearestPathD() - T * 0.5) : this.nearestPathD();
          const a = new Ally(B, unit, { d: dSpawn });
          a.homeD = dSpawn;
          a.owner = this;
          B.allies.push(a);
          this.summons.push(a);
          B.fx.ring(a.x, a.y - 10, { r: 24, color: '#8fd8ff', life: 0.45 });
          this.respawnT = m.summon.respawn || 9;
        }
      } else if (this.respawnT > 2) this.respawnT = 2;
    }
    // chrys gold gen
    if (m.goldGen) {
      this.goldTick += dt;
      if (this.goldTick >= 1) {
        this.goldTick -= 1;
        B.addGold(Math.round((m.goldGen + (this.lvl - 1) * 3) * B.goldGenMult), this.x, this.y - 30, false, true);
        B.fx.stars(this.x, this.y - 34, 2, '#ffe08a');
      }
    }
    // holy nova pulse
    if (m.nova) {
      this.novaT -= dt;
      if (this.novaT <= 0) {
        this.novaT = 1 / this.rate;
        const dmg = this.dmg * (1 + (this.lvl - 1) * 0.1);
        const rad = m.nova.radius * T * (1 + (this.lvl - 1) * 0.12);
        let hit = false;
        for (const e of B.enemies) {
          if (e.dead) continue;
          if (dist2(this.x, this.y, e.x, e.y) < rad ** 2) {
            if (e.stealthed && m.nova.reveal) { e.reveal = 3; e.stealthed = false; }
            const mult = e.undead ? (1 + (m.nova.undeadBonus || 0)) : 1;
            e.takeDamage(dmg * mult, { type: 'magic', attr: this.attrNow(), color: '#ffe9a8', src: this });
            hit = true;
          }
        }
        if (hit) {
          B.fx.ring(this.x, this.y - 10, { r: rad, color: '#ffe9a8', life: 0.55, lw: 4, fill: '#ffd966' });
          B.fx.stars(this.x, this.y - 30, 5, '#fff4c8');
          sfx.holy();
          this.recoil = 1;
        }
      }
      return;
    }
    // storm strikes
    if (m.stormStrikes) {
      this.cd -= dt;
      if (this.cd <= 0) {
        const inRange = B.enemies.filter(e => !e.dead && e.targetable && dist2(this.x, this.y, e.x, e.y) < this.range ** 2);
        if (inRange.length) {
          this.cd = 1 / this.rate;
          const n = m.stormStrikes.count + Math.floor((this.lvl - 1) / 1);
          for (let i = 0; i < n; i++) {
            const e = inRange[Math.floor(Math.random() * inRange.length)];
            if (!e || e.dead) continue;
            setTimeout0(B, i * 0.12, () => {
              if (e.dead) return;
              B.fx.lightningBolt(e.x, e.y - 220, e.y - 8, '#8fd8ff', 0.3);
              e.takeDamage(this.dmg * 0.8, { type: 'magic', attr: this.attrNow(), color: '#8fd8ff', src: this });
              if (Math.random() < (m.stormStrikes.stunChance || 0)) e.applyStun(0.6);
              B.fx.burst(e.x, e.y - 14, { n: 6, color: '#8fd8ff', speed: 130, life: 0.35, size: 3, glow: true });
              sfx.zap();
            });
          }
          this.recoil = 1;
        }
      }
      return;
    }
    // auras (orchid, nun) are passive — computed in buff functions
    if (this.def.dmg === 0 && !m.summon && !m.goldGen && !m.buffAura && !m.blessAura) return;

    // ---- normal targeting & firing ----
    this.cd -= dt;
    if (this.cd > 0) return;
    const target = this.findTarget();
    if (!target) return;
    this.angle = angLerp(this.angle, Math.atan2(target.y - this.y, target.x - this.x), 1);
    this.fire(target);
    this.cd = 1 / this.rate;
  }

  attrNow() { return this.def.attr; }
  nearestPathD() {
    const B = this.B;
    let bd = 1e9, bestD = 0;
    for (let i = 0; i < B.map.path.length; i += 4) {
      const p = B.map.path[i];
      const d2v = (p.x - this.x) ** 2 + (p.y - this.y) ** 2;
      if (d2v < bd) { bd = d2v; bestD = p.d; }
    }
    return bestD;
  }

  fire(target) {
    const B = this.B, m = this.mech;
    this.recoil = 1;
    const dmg = this.dmg;
    const attr = this.attrNow();
    const src = this;
    const sx = this.x, sy = this.y - T * 0.42;
    const critInfo = m.crit ? (Math.random() < (m.crit.chance + (this.lvl - 1) * 0.04) ? m.crit.mult + (this.lvl - 1) * 0.15 : 1) : 1;
    const crit = critInfo > 1;
    const finalDmg = dmg * critInfo;
    switch (this.def.id) {
      case 'thorn':
        B.projectiles.push(new Projectile(B, { x: sx, y: sy, target, speed: 460, dmg: finalDmg, type: 'phys', attr, src, crit, kind: 'dart', color: '#a8d86a', size: 4, apply: e => { addBleed(e, (m.bleed.dps + this.lvl * 2) * K.towerMetaBonus(this.metaLvl), m.bleed.dur, m.bleed.stack, B); } }));
        sfx.shoot(1.2);
        break;
      case 'icearrow': {
        const slowPct = Math.min(0.6, m.slow.pct + (this.lvl - 1) * 0.07);
        B.projectiles.push(new Projectile(B, { x: sx, y: sy, target, speed: 520, dmg: finalDmg, type: 'phys', attr, src, crit, kind: 'ice', color: '#8fd8ff', size: 5, apply: e => e.applySlow(slowPct, m.slow.dur + (this.lvl - 1) * 0.4) }));
        sfx.arrow();
        break;
      }
      case 'shuriken':
        B.projectiles.push(new Projectile(B, { x: sx, y: sy, target, speed: 640, dmg: finalDmg, type: 'phys', attr, src, crit, kind: 'shuriken', color: '#cfd6e4', size: 7, ricochet: (m.ricochet || 1) + (this.lvl >= 3 ? 1 : 0) }));
        sfx.shoot(1.5);
        break;
      case 'bat': {
        const n = (m.swarmBurst || 1) + (this.lvl - 1);
        for (let i = 0; i < n; i++) {
          const t2 = i === 0 ? target : (B.enemies.filter(e => !e.dead && e.flying && e.targetable && dist2(this.x, this.y, e.x, e.y) < this.range ** 2)[i] || target);
          B.projectiles.push(new Projectile(B, { x: sx, y: sy, target: t2, speed: 380, dmg: finalDmg / n * 1.4, type: 'phys', attr, src, crit, kind: 'bat', color: '#5a4a7a', size: 8, homing: true, delay: i * 0.12 }));
        }
        sfx.shoot(0.8);
        break;
      }
      case 'cannon':
        B.projectiles.push(new Projectile(B, { x: sx, y: sy, target, speed: 300, dmg: finalDmg, type: 'phys', attr, src, crit, kind: 'shell', color: '#2c3040', size: 7, arc: true, splash: (m.splash + (this.lvl - 1) * 0.18) * T, groundOnly: true }));
        sfx.shoot(0.5);
        B.fx.smoke(sx, sy, { n: 2, color: '#8a8494', life: 0.4, size: 6 });
        break;
      case 'magic':
        B.projectiles.push(new Projectile(B, { x: sx, y: sy, target, speed: 420, dmg: finalDmg, type: 'magic', attr, src, crit, kind: 'bolt', color: '#c9a2ff', size: 6, homing: true, trueDmgPct: m.trueDmg }));
        sfx.magic();
        break;
      case 'blossom': {
        const dense = this.densestPoint(1.1) || target;
        B.projectiles.push(new Projectile(B, { x: sx, y: sy, tx: dense.x, ty: dense.y, speed: 260, kind: 'seed', color: '#b06af0', size: 5, arc: true, onLand: (x, y) => {
          B.hazards.push(new Hazard(B, { kind: 'cloud', x, y, r: (m.cloud.radius + (this.lvl - 1) * 0.14) * T, dps: (m.cloud.dps + this.lvl * 4) * K.towerMetaBonus(this.metaLvl) * B.towerDmgBuff(this), dur: m.cloud.dur, color: '#7dff5a', attr, src }));
          sfx.magic();
        } }));
        break;
      }
      case 'bamboo':
        B.projectiles.push(new Projectile(B, { x: sx, y: sy, target, speed: 480, dmg: finalDmg, type: 'phys', attr, src, crit, kind: 'bamboo', color: '#6ab84a', size: 6, apply: e => {
          if (!e.heavy || !m.knock.heavyImmune) {
            e.d = Math.max(0, e.d - m.knock.dist * T * (1 + (this.lvl - 1) * 0.2));
            e.updatePos();
            B.fx.burst(e.x, e.y - 12, { n: 6, color: '#a8e06a', speed: 110, life: 0.35, size: 3 });
          }
          if (Math.random() < 0.3 + this.lvl * 0.05) e.applyStun(m.knock.stun);
        } }));
        sfx.shoot(0.9);
        break;
      case 'assassin':
        B.projectiles.push(new Projectile(B, { x: sx, y: sy, target, speed: 900, dmg: finalDmg, type: 'phys', attr, src, crit, kind: 'kunai', color: '#ff4a6a', size: 5, vsBossLike: 1 + (m.bossBonus || 0) + (this.lvl - 1) * 0.1 }));
        sfx.shoot(1.8);
        break;
      case 'lightning': {
        // instant chain
        const chains = (m.chain.count + (this.lvl - 1)) + this.chainBonus;
        let cur = target;
        const hitSet = new Set();
        let dmgNow = finalDmg;
        let px = sx, py = sy;
        for (let i = 0; i < chains && cur; i++) {
          hitSet.add(cur.uid);
          B.fx.beam(px, py, cur.x, cur.y - 10, { color: '#8fd8ff', life: 0.22, lw: 3.4 - i * 0.5 });
          cur.takeDamage(dmgNow, { type: 'magic', attr, src, crit: crit && i === 0, color: '#8fd8ff' });
          B.fx.burst(cur.x, cur.y - 14, { n: 4, color: '#8fd8ff', speed: 100, life: 0.3, size: 2.6, glow: true });
          dmgNow *= m.chain.falloff;
          px = cur.x; py = cur.y - 10;
          // next nearest
          let nx = null, nd = (T * 1.8) ** 2;
          for (const e of B.enemies) {
            if (e.dead || !e.targetable || hitSet.has(e.uid)) continue;
            const d2v = dist2(px, py, e.x, e.y);
            if (d2v < nd) { nd = d2v; nx = e; }
          }
          cur = nx;
        }
        sfx.zap();
        break;
      }
      case 'sniper': {
        // hitscan
        B.fx.beam(sx, sy - 6, target.x, target.y - 12, { color: '#ffe08a', life: 0.14, lw: 2.2, jag: 0.02 });
        let kill = false;
        if (!target.isBoss && m.execute && target.hp / target.maxHp < m.execute + (this.lvl - 1) * 0.02) kill = true;
        if (kill) {
          target.takeDamage(target.hp + target.shield + 1, { type: 'true', src, color: '#ffd966', crit: true });
          B.fx.text(target.x, target.y - 40, B.t('execute') || 'EXECUTE!', { color: '#ffd966', size: 15, crit: true, life: 0.9 });
        } else {
          let d2 = finalDmg;
          if (target.flying) d2 *= 1 + (m.airBonus || 0);
          target.takeDamage(d2, { type: 'phys', attr, src, crit, pierceArmor: m.pierceArmor, color: '#ffe08a' });
        }
        B.fx.burst(sx, sy, { n: 3, color: '#ffe08a', speed: 90, life: 0.25, size: 2.5, glow: true });
        B.fx.smoke(sx, sy, { n: 2, color: '#aaa4b8', life: 0.5, size: 5 });
        B.fx.shake(1.6, 0.08);
        sfx.crit();
        break;
      }
      case 'magma': {
        const dense = this.densestPoint(0.9) || target;
        B.projectiles.push(new Projectile(B, { x: sx, y: sy, tx: dense.x, ty: dense.y, speed: 300, dmg: finalDmg, type: 'magic', attr, src, crit, kind: 'firebomb', color: '#ff7a3a', size: 8, arc: true, splash: T * 0.7, onLand: (x, y) => {
          B.hazards.push(new Hazard(B, { kind: 'lava', x, y, r: (m.lavaPool.radius + (this.lvl - 1) * 0.1) * T, dps: (m.lavaPool.dps + this.lvl * 8) * K.towerMetaBonus(this.metaLvl) * B.towerDmgBuff(this), dur: m.lavaPool.dur, color: '#ff7a3a', attr, src }));
          B.fx.decal(x, y, T * 0.8, '#3a1a10', m.lavaPool.dur, 'lava');
          B.fx.embers(x, y, 10);
          sfx.boom(false);
        } }));
        break;
      }
      case 'void':
        B.projectiles.push(new Projectile(B, { x: sx, y: sy, target, speed: 380, dmg: finalDmg, type: 'magic', attr, src, crit, kind: 'voidorb', color: '#c05af0', size: 8, homing: true, vsBossLike: 1 + (m.bossBonus || 0), apply: e => {
          e.shred = Math.max(e.shred, m.shred.pct + (this.lvl - 1) * 0.05);
          e.shredT = Math.max(e.shredT, m.shred.dur);
          if (!e.heavy && !e.isBoss) { e.pullV = Math.max(e.pullV, 34 + this.lvl * 8); setTimeout0(B, 0.45, () => { e.pullV = 0; }); }
        } }));
        sfx.magic();
        break;
      case 'holynova': case 'storm': break; // handled above
      case 'barracks': case 'wolf': case 'orchid': break; // no direct attack
      case 'nun': {
        // occasional holy bolt
        if (this.cd <= 0 && target) {
          B.projectiles.push(new Projectile(B, { x: sx, y: sy, target, speed: 420, dmg: (m.holyBolt + this.lvl * 4) * K.towerMetaBonus(this.metaLvl), type: 'magic', attr, src, kind: 'holybolt', color: '#ffe9a8', size: 5, homing: true, reveal: true }));
          this.cd = 1 / this.rate;
          sfx.magic();
        }
        break;
      }
      default:
        // generic single-target projectile
        B.projectiles.push(new Projectile(B, { x: sx, y: sy, target, speed: 480, dmg: finalDmg, type: 'phys', attr, src, crit, kind: 'dart', color: '#cfd6e4', size: 4 }));
        sfx.shoot();
    }
  }

  draw(ctx, time) {
    const B = this.B;
    ctx.save();
    ctx.translate(this.x, this.y);
    const dis = this.disabled > 0;
    // disabled visuals
    if (dis) {
      ctx.save();
      ctx.globalAlpha = 0.9;
      if (this.disableFx === 'ice') {
        ctx.fillStyle = rgba('#8fd8ff', 0.4);
        ctx.beginPath(); ctx.ellipse(0, -18, 26, 30, 0, 0, TAU); ctx.fill();
        ctx.strokeStyle = rgba('#e8f8ff', 0.8); ctx.lineWidth = 2;
        ctx.beginPath(); ctx.moveTo(-14, -34); ctx.lineTo(-4, -20); ctx.lineTo(-16, -8); ctx.stroke();
        ctx.beginPath(); ctx.moveTo(12, -36); ctx.lineTo(6, -18); ctx.lineTo(16, -6); ctx.stroke();
      } else if (this.disableFx === 'gold' || this.disableFx === 'sheep') {
        ctx.shadowColor = this.disableFx === 'gold' ? '#ffd966' : '#ffb8d8';
        ctx.shadowBlur = 14;
        ctx.fillStyle = this.disableFx === 'gold' ? rgba('#ffd966', 0.55) : rgba('#ffb8d8', 0.5);
        ctx.beginPath(); ctx.ellipse(0, -20, 26, 30, 0, 0, TAU); ctx.fill();
        ctx.font = '20px serif'; ctx.textAlign = 'center';
        ctx.fillText(this.disableFx === 'gold' ? '🪙' : '🐑', 0, -34);
      } else {
        ctx.strokeStyle = rgba('#ff5a4a', 0.7); ctx.lineWidth = 3;
        ctx.beginPath(); ctx.arc(0, -20, 24, 0, TAU); ctx.stroke();
        ctx.beginPath(); ctx.moveTo(-16, -36); ctx.lineTo(16, -4); ctx.stroke();
      }
      ctx.restore();
    }
    // recoil scale pop
    const pop = 1 + Math.max(0, this.recoil) * 0.06;
    ctx.scale(pop, pop);
    const spr = getSprite(this.def.sprite, 'idle', dis ? 0 : Math.floor(time * 0.7) % 1, dis ? 96 : 128);
    const px = T * (dis ? 0.98 : 1.06);
    // ---- progression visuals: stone base + banners + aura ----
    if (!dis && this.lvl >= 2) {
      // fortified stone ring under the tower
      ctx.save();
      ctx.fillStyle = 'rgba(0,0,0,0.30)';
      ctx.beginPath(); ctx.ellipse(0, 2, px * 0.44, px * 0.16, 0, 0, TAU); ctx.fill();
      ctx.strokeStyle = this.lvl >= 3 ? '#c9a24a' : '#8a8494';
      ctx.lineWidth = 2.5;
      ctx.beginPath(); ctx.ellipse(0, 0, px * 0.40, px * 0.14, 0, 0, TAU); ctx.stroke();
      // side banners
      const bc = this.lvl >= 3 ? '#f5c542' : '#7b5ff0';
      for (const sd of [-1, 1]) {
        const bx = sd * px * 0.42, sway = Math.sin(time * 2.2 + sd) * 1.6;
        ctx.strokeStyle = '#5a4632'; ctx.lineWidth = 2;
        ctx.beginPath(); ctx.moveTo(bx, -2); ctx.lineTo(bx, -px * 0.62); ctx.stroke();
        ctx.fillStyle = bc;
        ctx.beginPath(); ctx.moveTo(bx, -px * 0.62);
        ctx.lineTo(bx + sd * 7 + sway, -px * 0.55);
        ctx.lineTo(bx, -px * 0.46); ctx.closePath(); ctx.fill();
      }
      ctx.restore();
    }
    if (!dis && this.lvl >= 3) {
      // golden champion aura
      const pulse = 0.5 + Math.sin(time * 3.1) * 0.5;
      ctx.save();
      const ag = ctx.createRadialGradient(0, -px * 0.4, 4, 0, -px * 0.4, px * 0.62);
      ag.addColorStop(0, rgba('#ffd966', 0.10 + pulse * 0.08));
      ag.addColorStop(1, 'rgba(255,217,102,0)');
      ctx.fillStyle = ag;
      ctx.beginPath(); ctx.arc(0, -px * 0.4, px * 0.62, 0, TAU); ctx.fill();
      // floating crown gem
      const gy = -px * 1.02 - pulse * 3;
      ctx.shadowColor = '#ffd966'; ctx.shadowBlur = 9;
      ctx.fillStyle = '#ffe08a';
      ctx.beginPath();
      ctx.moveTo(0, gy - 5); ctx.lineTo(4.5, gy); ctx.lineTo(0, gy + 5); ctx.lineTo(-4.5, gy); ctx.closePath(); ctx.fill();
      ctx.restore();
    }
    if (!dis && (this.refineMult || 1) > 1.04) {
      // refine sparkles orbiting
      ctx.save();
      const rn = Math.min(5, Math.round(((this.refineMult - 1) / 0.02)));
      for (let i = 0; i < rn; i++) {
        const a = time * 1.6 + i * (TAU / rn);
        const ox = Math.cos(a) * px * 0.46, oy = -px * 0.42 + Math.sin(a) * px * 0.18;
        ctx.fillStyle = rgba('#ff9ae0', 0.5 + 0.4 * Math.sin(time * 5 + i));
        ctx.beginPath(); ctx.arc(ox, oy, 1.8, 0, TAU); ctx.fill();
      }
      ctx.restore();
    }
    if (dis) { ctx.globalAlpha = 0.55; }
    ctx.drawImage(spr, -px / 2, -px * 0.96, px, px);
    ctx.globalAlpha = 1;
    // level pips
    for (let i = 0; i < this.lvl; i++) {
      ctx.save();
      ctx.shadowColor = '#ffd966'; ctx.shadowBlur = 5;
      ctx.fillStyle = this.lvl >= 3 ? '#ffe08a' : '#ffd966';
      ctx.beginPath(); ctx.arc(-8 + i * 8, 6, 2.6, 0, TAU); ctx.fill();
      ctx.restore();
    }
    // poison debuff indicator
    if (this.rateDebuff > 0) {
      ctx.fillStyle = rgba('#7dff5a', 0.85);
      ctx.font = '11px serif'; ctx.textAlign = 'center';
      ctx.fillText('☠', 0, -T * 0.95);
    }
    ctx.restore();
    // buff auras (orchid/nun) — subtle rings
    if ((this.mech.buffAura || this.mech.blessAura) && !dis) {
      const rad = (this.mech.buffAura?.radius ?? 2.2) * T;
      const pulse = 0.5 + Math.sin(time * 2.4) * 0.5;
      ctx.save();
      ctx.strokeStyle = rgba(this.def.id === 'orchid' ? '#ff8ad8' : '#ffe9a8', 0.12 + pulse * 0.1);
      ctx.lineWidth = 2;
      ctx.setLineDash([4, 8]);
      ctx.beginPath(); ctx.arc(this.x, this.y, rad * (1 + (this.lvl - 1) * 0.06), 0, TAU); ctx.stroke();
      ctx.restore();
    }
  }
}

function addBleed(e, dps, dur, maxStack, B) {
  if (e.isBoss) { dps *= 0.5; dur *= 0.6; }
  if (e.bleed.length >= maxStack) e.bleed.shift();
  e.bleed.push({ dps, t: dur, acc: 0 });
}

export function setTimeout0(B, delay, fn) {
  B.timers.push({ t: delay, fn });
}

// ============================================================
// HERO (deployed on field)
// ============================================================
export class Hero {
  constructor(B, def, metaLvl, awaken, slotIdx) {
    this.B = B; this.uid = entId++;
    this.def = def;
    this.metaLvl = metaLvl; this.awaken = awaken;
    this.slotIdx = slotIdx;
    this.x = 0; this.y = 0;
    this.deployed = false;
    this.angle = -Math.PI / 2;
    this.cd = 0;
    this.skillCd = 0; this.skillMax = def.skill.cd * (B.cdMult || 1);
    this.anim = Math.random() * 10;
    this.recoil = 0;
    this.stunned = 0; // kraken grab
    this.target = null;
    this.facing = 1;
    this.skillFxT = 0;
  }
  get dmg() { return this.def.dmg * K.heroMetaBonus(this.metaLvl, this.awaken) * this.B.heroDmgBuff(this); }
  get rate() { return this.def.rate * (1 + (this.awaken * 0.08)) * this.B.heroRateBuff(this); }
  get range() { return this.def.range * T * (1 + this.awaken * 0.05) * this.B.rangeMult; }

  place(x, y) { this.x = x; this.y = y; this.deployed = true; }

  update(dt) {
    const B = this.B;
    this.anim += dt;
    if (this.recoil > 0) this.recoil -= dt * 4;
    if (this.skillFxT > 0) this.skillFxT -= dt;
    if (this.stunned > 0) { this.stunned -= dt; return; }
    // skill recharge (nun bless accelerates)
    let charge = dt;
    for (const t of B.towers) {
      if (t.def.id === 'nun' && !t.disabled && dist2(t.x, t.y, this.x, this.y) < (t.range) ** 2) {
        charge *= 1 + 0.35 * (B.heroPassive('marco') ? 1.3 : 1);
      }
    }
    if (B.sanctuaryZone && pointInZone(this.x, this.y, B.sanctuaryZone)) charge *= 2.5;
    this.skillCd = Math.max(0, this.skillCd - charge);
    // auto attack
    this.cd -= dt;
    const target = this.findTarget();
    this.target = target;
    if (target) {
      this.angle = Math.atan2(target.y - this.y, target.x - this.x);
      this.facing = Math.cos(this.angle) >= 0 ? 1 : -1;
      if (this.cd <= 0) { this.attack(target); this.cd = 1 / this.rate; }
    }
    // auto skill when ready & meaningful
    if (this.skillCd <= 0 && this.shouldAutoSkill()) {
      this.castSkill();
    }
  }
  findTarget() {
    const B = this.B;
    const r2 = this.range ** 2;
    let best = null, bd = 1e9;
    for (const e of B.enemies) {
      if (e.dead || !e.targetable) continue;
      const d2 = dist2(this.x, this.y, e.x, e.y);
      if (d2 < r2 && d2 < bd) { bd = d2; best = e; }
    }
    return best;
  }
  attack(target) {
    const B = this.B, def = this.def;
    this.recoil = 1;
    let dmg = this.dmg;
    if (def.melee && target.flying && !def.flying) dmg *= 0.6; // leaping slash vs air
    const critInfo = def.crit ? (Math.random() < def.crit.chance ? def.crit.mult : 1) : 1;
    const crit = critInfo > 1;
    const fd = dmg * critInfo;
    if (def.melee) {
      // cleave
      const n = def.cleave || 1;
      const targets = B.enemies.filter(e => !e.dead && e.targetable && dist2(this.x, this.y, e.x, e.y) < this.range ** 2)
        .sort((a, b) => dist2(this.x, this.y, a.x, a.y) - dist2(this.x, this.y, b.x, b.y)).slice(0, n);
      for (const e of targets) {
        e.takeDamage(fd * attrMult(def.attr, e.attr) , { type: 'phys', attr: def.attr, srcHero: def.id, crit, color: '#ffe9a8' });
        B.fx.burst(e.x, e.y - 14, { n: 3, color: def.id === 'ember' ? '#ff9a3a' : '#ffd966', speed: 90, life: 0.3, size: 2.6 });
      }
      B.fx.beam(this.x + this.facing * 10, this.y - 18, target.x, target.y - 12, { color: rgba('#ffffff', 0.6), life: 0.1, lw: 2, jag: 0.1 });
      sfx.hit();
      if (def.id === 'ember') { for (const e of targets) e.applyBurn(fd * 0.25, 3); }
    } else {
      // ranged projectile
      const kind = def.id === 'luna' ? 'bolt' : def.id === 'volt' ? 'zapball' : def.id === 'nyx' ? 'voidorb' : def.id === 'sylph' ? 'arrow' : def.id === 'aria' ? 'note' : 'bolt';
      const color = def.id === 'luna' ? '#8fd8ff' : def.id === 'volt' ? '#8fd8ff' : def.id === 'nyx' ? '#c05af0' : def.id === 'sylph' ? '#e8f0d8' : def.id === 'aria' ? '#ffd966' : '#c9a2ff';
      B.projectiles.push(new Projectile(B, {
        x: this.x, y: this.y - 22, target, speed: 540, dmg: fd, type: def.id === 'volt' || def.id === 'luna' || def.id === 'nyx' ? 'magic' : 'phys',
        attr: def.attr, srcHero: def.id, crit, kind, color, size: 6, homing: kind === 'bolt' || kind === 'voidorb' || kind === 'zapball',
        chain: def.chain ? def.chain + (this.awaken >= 2 ? 1 : 0) : 0,
      }));
      sfx.shoot(1.1);
    }
  }
  shouldAutoSkill() {
    const B = this.B;
    if (!this.deployed || this.stunned > 0) return false;
    const sid = this.def.skill.id;
    const enemiesNear = B.enemies.filter(e => !e.dead && e.targetable && dist2(this.x, this.y, e.x, e.y) < (this.range * 1.4) ** 2).length;
    const anyEnemy = B.enemies.some(e => !e.dead && e.targetable);
    switch (sid) {
      case 'goldfountain': return anyEnemy || B.waveActive;
      case 'waranthem': return enemiesNear >= 2 || B.bossAlive();
      case 'sanctuary': return enemiesNear >= 1;
      case 'golemsummon': return enemiesNear >= 1 || B.waveIncoming < 3;
      case 'blizzard': case 'voidzone': case 'thunderstorm': case 'flamewave': case 'judgment': case 'shieldbash': case 'shadowstep': return enemiesNear >= (sid === 'shieldbash' ? 1 : 2);
      case 'piercingrain': return enemiesNear >= 2;
      case 'deathmark': {
        const strong = B.enemies.some(e => !e.dead && e.targetable && (e.isBoss || e.isElite || e.hp > 400));
        return strong && enemiesNear >= 1;
      }
      default: return enemiesNear >= 1;
    }
  }
  castSkill(manual = false) {
    if (this.skillCd > 0 || !this.deployed || this.stunned > 0) return false;
    const B = this.B, def = this.def, sid = def.skill.id;
    this.skillCd = this.skillMax;
    this.skillFxT = 0.6;
    B.stats.skillsUsed++;
    const p = this.dmg; // base power for skills
    sfx.skill();
    switch (sid) {
      case 'shieldbash': {
        B.fx.ring(this.x, this.y - 10, { r: this.range * 1.2, color: '#8fd8ff', life: 0.5, lw: 5, fill: '#8fd8ff' });
        B.fx.shake(5, 0.25);
        sfx.boom(false);
        for (const e of B.enemies) {
          if (e.dead) continue;
          if (dist2(this.x, this.y, e.x, e.y) < (this.range * 1.2) ** 2) {
            e.takeDamage(p * 1.5 * attrMult(def.attr, e.attr), { type: 'phys', attr: def.attr, srcHero: def.id, color: '#8fd8ff' });
            e.applyStun(2 + this.awaken * 0.4);
          }
        }
        break;
      }
      case 'blizzard': {
        B.hazards.push(new Hazard(B, { kind: 'blizzard', x: this.x, y: this.y, r: this.range * 1.15, dps: p * 0.5, dur: 4 + this.awaken, color: '#8fd8ff', slow: 0.45, attr: def.attr, srcHero: def.id, followHero: this }));
        B.fx.ring(this.x, this.y - 10, { r: this.range * 1.15, color: '#cfeaff', life: 0.7, lw: 3, fill: '#8fd8ff' });
        break;
      }
      case 'shadowstep': {
        // teleport to strongest enemy in extended range
        const cands = B.enemies.filter(e => !e.dead && e.targetable && dist2(this.x, this.y, e.x, e.y) < (this.range * 4) ** 2)
          .sort((a, b) => b.hp - a.hp);
        const t2 = cands[0];
        if (t2) {
          B.fx.smoke(this.x, this.y - 14, { n: 8, color: '#3a2c50', life: 0.5 });
          this.x = t2.x + 26; this.y = t2.y + 10;
          B.fx.smoke(this.x, this.y - 14, { n: 8, color: '#3a2c50', life: 0.5 });
          for (let i = 0; i < 3; i++) {
            setTimeout0(B, i * 0.14, () => {
              if (t2.dead) return;
              t2.takeDamage(p * 2.0 * attrMult(def.attr, t2.attr), { type: 'phys', attr: def.attr, srcHero: def.id, crit: true, color: '#ff4a6a' });
              B.fx.beam(this.x, this.y - 18, t2.x, t2.y - 12, { color: '#ff4a6a', life: 0.12, lw: 2 });
              B.fx.burst(t2.x, t2.y - 14, { n: 5, color: '#ff4a6a', speed: 120, life: 0.3, size: 3 });
              sfx.crit();
            });
          }
        }
        break;
      }
      case 'sanctuary': {
        B.sanctuaryZone = { x: this.x, y: this.y, r: this.range * 1.5, t: 6 + this.awaken, hero: this };
        B.fx.ring(this.x, this.y - 10, { r: this.range * 1.5, color: '#ffe9a8', life: 0.8, lw: 4, fill: '#ffd966' });
        sfx.heal();
        break;
      }
      case 'piercingrain': {
        // line of arrows toward target direction
        const ang = this.target ? Math.atan2(this.target.y - this.y, this.target.x - this.x) : this.angle;
        for (let i = 0; i < 6; i++) {
          const spread = (i - 2.5) * 0.09;
          B.projectiles.push(new Projectile(B, {
            x: this.x, y: this.y - 24, vx: Math.cos(ang + spread) * 700, vy: Math.sin(ang + spread) * 700,
            dmg: p * 1.3, type: 'phys', attr: def.attr, srcHero: def.id, kind: 'arrow', color: '#e8f0d8', size: 6, pierceAll: true, life: 0.9,
          }));
        }
        sfx.arrow();
        break;
      }
      case 'deathmark': {
        const cands = B.enemies.filter(e => !e.dead && e.targetable && dist2(this.x, this.y, e.x, e.y) < (this.range * 3) ** 2)
          .sort((a, b) => (b.isBoss * 1e9 + b.hp) - (a.isBoss * 1e9 + a.hp));
        const t2 = cands[0];
        if (t2) {
          t2.mark = 0.35 + this.awaken * 0.08; t2.markT = 6;
          B.fx.ring(t2.x, t2.y - 16, { r: 30, color: '#ff4a6a', life: 0.6, lw: 3 });
          B.fx.text(t2.x, t2.y - 46, '💀', { size: 20, life: 1.2, vy: -20 });
          B.fx.beam(this.x, this.y - 20, t2.x, t2.y - 14, { color: '#ff4a6a', life: 0.25, lw: 2.5 });
        }
        break;
      }
      case 'golemsummon': {
        const dSpawn = this.nearestPathD();
        const a = new Ally(B, 'golemg', { d: dSpawn, expire: 14 + this.awaken * 3 });
        B.allies.push(a);
        B.fx.ring(a.x, a.y - 14, { r: 40, color: '#a8e06a', life: 0.7, lw: 4, fill: '#a8e06a' });
        B.fx.shake(4, 0.2);
        sfx.build();
        break;
      }
      case 'waranthem': {
        B.anthemT = 7 + this.awaken;
        B.fx.screenFlash('#ffd966', 0.22, 0.5);
        B.fx.ring(this.x, this.y - 16, { r: 500, color: '#ffd966', life: 0.9, lw: 3 });
        for (let i = 0; i < 12; i++) B.fx.stars(this.x + (Math.random() - 0.5) * 200, this.y - 40 - Math.random() * 80, 1, '#ffe08a');
        sfx.fanfare();
        break;
      }
      case 'flamewave': {
        const ang = this.target ? Math.atan2(this.target.y - this.y, this.target.x - this.x) : this.angle;
        for (const e of B.enemies) {
          if (e.dead) continue;
          const a2 = Math.atan2(e.y - this.y, e.x - this.x);
          let da = Math.abs(((a2 - ang + Math.PI * 3) % TAU) - Math.PI);
          if (da < 1.0 && dist2(this.x, this.y, e.x, e.y) < (this.range * 2.1) ** 2) {
            e.takeDamage(p * 2.6 * attrMult(def.attr, e.attr), { type: 'magic', attr: def.attr, srcHero: def.id, color: '#ff9a3a' });
            e.applyBurn(p * 0.8, 4 + this.awaken);
          }
        }
        // cone visual
        B.fxCone(this.x, this.y - 16, ang, this.range * 2.1, 1.0, '#ff7a3a');
        B.fx.shake(4, 0.2);
        sfx.meteor();
        break;
      }
      case 'thunderstorm': {
        const dense = B.densestEnemyPoint(this.x, this.y, this.range * 3.2) || { x: this.x, y: this.y - 40 };
        for (let i = 0; i < 9; i++) {
          setTimeout0(B, i * 0.09, () => {
            const sx = dense.x + (Math.random() - 0.5) * T * 2.2, sy = dense.y + (Math.random() - 0.5) * T * 1.6;
            B.fx.lightningBolt(sx, sy - 240, sy, '#8fd8ff', 0.28);
            for (const e of B.enemies) {
              if (!e.dead && e.targetable && dist2(e.x, e.y, sx, sy) < (T * 0.55) ** 2) {
                e.takeDamage(p * 0.9 * attrMult(def.attr, e.attr), { type: 'magic', attr: def.attr, srcHero: def.id, color: '#8fd8ff' });
              }
            }
            sfx.zap();
          });
        }
        break;
      }
      case 'goldfountain': {
        const g = Math.round((55 + this.metaLvl * 10) * (1 + this.awaken * 0.3));
        B.addGold(g, this.x, this.y - 40, false, false, true);
        B.goldRushT = Math.max(B.goldRushT, 8);
        B.goldRushMult = Math.max(B.goldRushMult, 1.3);
        for (let i = 0; i < 14; i++) {
          setTimeout0(B, i * 0.04, () => B.fx.stars(this.x + (Math.random() - 0.5) * 90, this.y - 50 - Math.random() * 60, 2, '#ffd966'));
        }
        sfx.bigCoin();
        break;
      }
      case 'judgment': {
        const ang = this.target ? Math.atan2(this.target.y - this.y, this.target.x - this.x) : this.angle;
        // line beam
        const len = 620;
        const ex = this.x + Math.cos(ang) * len, ey = this.y + Math.sin(ang) * len;
        B.fx.beam(this.x, this.y - 26, ex, ey - 26, { color: '#ffe9a8', life: 0.4, lw: 10, jag: 0.01 });
        B.fx.beam(this.x, this.y - 26, ex, ey - 26, { color: '#ffffff', life: 0.4, lw: 4, jag: 0.01 });
        B.fx.screenFlash('#fff4c8', 0.3, 0.4);
        B.fx.shake(7, 0.3);
        for (const e of B.enemies) {
          if (e.dead) continue;
          // distance to line
          const dx = ex - this.x, dy = ey - this.y;
          const l2 = dx * dx + dy * dy;
          let tt = ((e.x - this.x) * dx + (e.y - this.y) * dy) / l2;
          tt = clamp(tt, 0, 1);
          const px2 = this.x + dx * tt, py2 = this.y + dy * tt;
          if (dist2(e.x, e.y, px2, py2) < (T * 0.6) ** 2) {
            e.takeDamage(p * 3.8 * attrMult(def.attr, e.attr), { type: 'magic', attr: def.attr, srcHero: def.id, color: '#ffe9a8', crit: true });
            e.applyStun(1.5 + this.awaken * 0.3);
          }
        }
        sfx.holy();
        break;
      }
      case 'voidzone': {
        const dense = B.densestEnemyPoint(this.x, this.y, this.range * 2.6) || { x: this.x, y: this.y };
        B.hazards.push(new Hazard(B, { kind: 'voidzone', x: dense.x, y: dense.y, r: this.range * 1.3, dps: p * 0.75, dur: 5 + this.awaken, color: '#c05af0', pull: 42, slow: 0.35, attr: def.attr, srcHero: def.id }));
        B.fx.ring(dense.x, dense.y - 10, { r: this.range * 1.3, color: '#c05af0', life: 0.6, lw: 4, fill: '#c05af0' });
        sfx.magic();
        break;
      }
    }
    B.onHeroSkill?.(this);
    return true;
  }
  nearestPathD() {
    const B = this.B;
    let bd = 1e9, bestD = 0;
    for (let i = 0; i < B.map.path.length; i += 4) {
      const p = B.map.path[i];
      const d2v = (p.x - this.x) ** 2 + (p.y - this.y) ** 2;
      if (d2v < bd) { bd = d2v; bestD = p.d; }
    }
    return bestD;
  }
  tapBoost() {
    if (this.skillCd > 0) {
      this.skillCd = Math.max(0, this.skillCd - this.skillMax * K.HERO_SKILL_TAP_REFRESH);
      this.B.fx.stars(this.x, this.y - 40, 3, '#b49aff');
      sfx.click();
    } else {
      this.B.fx.ring(this.x, this.y - 16, { r: 26, color: '#b49aff', life: 0.35 });
    }
  }
  draw(ctx, time) {
    const B = this.B;
    ctx.save();
    ctx.translate(this.x, this.y);
    // hero glow ring (team color)
    ctx.save();
    const pulse = 0.6 + Math.sin(time * 3) * 0.4;
    ctx.strokeStyle = rgba('#57d97a', 0.35 + pulse * 0.2);
    ctx.lineWidth = 2;
    ctx.shadowColor = '#57d97a'; ctx.shadowBlur = 8;
    ctx.beginPath(); ctx.ellipse(0, 4, 22, 9, 0, 0, TAU); ctx.stroke();
    ctx.restore();
    // range hint while dragging handled by battle
    ctx.fillStyle = 'rgba(0,0,0,0.3)';
    ctx.beginPath(); ctx.ellipse(0, 3, 16, 6, 0, 0, TAU); ctx.fill();
    const px = T * 0.95;
    const attacking = !!this.target;
    const pose = this.skillFxT > 0 ? 'attack' : attacking ? (this.def.melee ? 'attack' : 'walk') : 'idle';
    const nf = pose === 'walk' ? 6 : pose === 'attack' ? 3 : 4;
    const frame = Math.floor(this.anim * (attacking ? 3 : 1.4)) % nf;
    const flash = this.recoil > 0.6;
    const spr = flash ? getSilhouette(this.def.sprite, pose, frame, 128, '#fff4c8') : getSprite(this.def.sprite, pose, frame, 128);
    const pop = 1 + Math.max(0, this.recoil) * 0.05;
    ctx.save();
    ctx.scale(this.facing * pop, pop);
    ctx.drawImage(spr, -px / 2, -px * 0.96, px, px);
    ctx.restore();
    // stun indicator (kraken grab)
    if (this.stunned > 0) {
      ctx.strokeStyle = rgba('#c05af0', 0.8); ctx.lineWidth = 3;
      ctx.beginPath(); ctx.arc(0, -20, 24, 0, TAU); ctx.stroke();
      ctx.font = '14px serif'; ctx.textAlign = 'center';
      ctx.fillText('🐙', 0, -44);
    }
    // skill charge bar
    const cw = 34;
    const pct = 1 - clamp(this.skillCd / this.skillMax, 0, 1);
    ctx.fillStyle = 'rgba(10,6,20,0.7)';
    ctx.fillRect(-cw / 2 - 1, 9, cw + 2, 5);
    if (pct >= 1) {
      ctx.save(); ctx.shadowColor = '#b49aff'; ctx.shadowBlur = 6 + Math.sin(time * 6) * 3;
      ctx.fillStyle = '#d8c8ff';
      ctx.fillRect(-cw / 2, 10, cw, 3);
      ctx.restore();
    } else {
      ctx.fillStyle = '#8a6bf0';
      ctx.fillRect(-cw / 2, 10, cw * pct, 3);
    }
    // awaken stars
    for (let i = 0; i < this.awaken; i++) {
      ctx.fillStyle = '#ffd966';
      ctx.font = '8px serif'; ctx.textAlign = 'center';
      ctx.fillText('★', -10 + i * 10, 22);
    }
    ctx.restore();
  }
}

function pointInZone(x, y, z) { return (x - z.x) ** 2 + (y - z.y) ** 2 < z.r ** 2; }

// ============================================================
// PROJECTILE
// ============================================================
export class Projectile {
  constructor(B, o) {
    this.B = B;
    this.x = o.x; this.y = o.y;
    this.target = o.target || null;
    this.tx = o.tx; this.ty = o.ty;      // fixed point (arc shots)
    this.vx = o.vx; this.vy = o.vy;      // free-flight
    this.speed = o.speed || 500;
    this.dmg = o.dmg || 0;
    this.type = o.type || 'phys';
    this.attr = o.attr;
    this.src = o.src; this.srcHero = o.srcHero;
    this.crit = o.crit;
    this.kind = o.kind || 'dart';
    this.color = o.color || '#fff';
    this.size = o.size || 4;
    this.homing = o.homing || false;
    this.arc = o.arc || false;
    this.splash = o.splash || 0;
    this.groundOnly = o.groundOnly || false;
    this.ricochet = o.ricochet || 0;
    this.hitSet = new Set();
    this.pierceAll = o.pierceAll || false;
    this.chain = o.chain || 0;
    this.apply = o.apply || null;
    this.onLand = o.onLand || null;
    this.trueDmgPct = o.trueDmgPct || 0;
    this.vsBossLike = o.vsBossLike || 0;
    this.reveal = o.reveal || false;
    this.life = o.life || 3;
    this.dead = false;
    this.delay = o.delay || 0;
    this.z = 0; this.vz = 0;
    this.rot = Math.random() * TAU;
    this.trailT = 0;
    if (this.arc) {
      // compute arc flight to target position
      const tgt = this.target;
      const dx = (tgt ? tgt.x : this.tx) - this.x, dy = (tgt ? tgt.y : this.ty) - this.y;
      const d = Math.hypot(dx, dy);
      const flightT = d / this.speed;
      this.landX = tgt ? tgt.x : this.tx; this.landY = tgt ? tgt.y : this.ty;
      this.flightT = flightT; this.t = 0;
      this.startX = this.x; this.startY = this.y;
      // predict target movement
      if (tgt) {
        const lead = tgt.effectiveSpd * T * flightT * 0.6;
        this.landX += Math.cos(tgt.ang) * lead;
        this.landY += Math.sin(tgt.ang) * lead;
      }
    }
  }
  update(dt) {
    const B = this.B;
    if (this.delay > 0) { this.delay -= dt; return; }
    this.life -= dt;
    if (this.life <= 0) { this.explode(true); return; }
    this.rot += dt * 14;
    // trail
    this.trailT -= dt;
    if (this.trailT <= 0) {
      this.trailT = 0.03;
      if (this.kind !== 'shell') B.fx.spawn({ x: this.x, y: this.y - this.z, vx: 0, vy: 8, g: 0, life: 0.25, size: this.size * 0.5, color: this.color, kind: 'dot', alpha: 0.5, glow: true });
    }
    if (this.arc) {
      this.t += dt;
      const k = clamp(this.t / this.flightT, 0, 1);
      this.x = lerp(this.startX, this.landX, k);
      this.y = lerp(this.startY, this.landY, k);
      this.z = Math.sin(k * Math.PI) * Math.min(90, this.flightT * 120);
      if (k >= 1) { this.land(); return; }
      return;
    }
    // homing / direct
    let tvx, tvy;
    if (this.vx !== undefined) { tvx = this.vx; tvy = this.vy; }
    else {
      const tgt = this.target;
      if (!tgt || tgt.dead) {
        if (this.pierceAll) { this.life = 0; return; }
        this.explode(true); return;
      }
      const dx = tgt.x - this.x, dy = (tgt.y - 12) - this.y;
      const d = Math.hypot(dx, dy) || 1;
      tvx = dx / d * this.speed; tvy = dy / d * this.speed;
      if (!this.homing) { // lead slightly for straight shots
        const lead = d / this.speed;
        const px2 = tgt.x + Math.cos(tgt.ang) * tgt.effectiveSpd * T * lead * 0.7;
        const py2 = (tgt.y - 12) + Math.sin(tgt.ang) * tgt.effectiveSpd * T * lead * 0.7;
        const dx2 = px2 - this.x, dy2 = py2 - this.y, d2 = Math.hypot(dx2, dy2) || 1;
        tvx = dx2 / d2 * this.speed; tvy = dy2 / d2 * this.speed;
      }
    }
    this.x += tvx * dt; this.y += tvy * dt;
    // hit check
    if (this.pierceAll) {
      for (const e of B.enemies) {
        if (e.dead || !e.targetable || this.hitSet.has(e.uid)) continue;
        if (dist2(this.x, this.y, e.x, e.y - 12) < (T * 0.32) ** 2) {
          this.hitSet.add(e.uid);
          this.hitEnemy(e);
        }
      }
      if (this.x < -20 || this.x > W + 20 || this.y < -20 || this.y > H + 20) this.dead = true;
      return;
    }
    const tgt = this.target;
    if (tgt && !tgt.dead) {
      const hitR = T * 0.28 * (tgt.size + 0.4);
      if (dist2(this.x, this.y, tgt.x, tgt.y - 12 - (tgt.flying ? 10 : 0)) < hitR ** 2) {
        this.hitEnemy(tgt);
      }
    }
    if (this.x < -30 || this.x > W + 30 || this.y < -30 || this.y > H + 30) this.dead = true;
  }
  hitEnemy(e) {
    const B = this.B;
    if (this.groundOnly && e.flying) return; // shells pass under flyers
    if (this.reveal && e.stealthed) { e.reveal = 2.5; }
    e.takeDamage(this.dmg, {
      type: this.type, attr: this.attr, src: this.src, srcHero: this.srcHero,
      crit: this.crit, color: this.color, projectile: true, trueDmgPct: this.trueDmgPct,
      vsBossLike: this.vsBossLike, applyStatus: this.apply,
      pierceArmor: this.src?.mech?.pierceArmor || 0,
    });
    B.fx.burst(this.x, this.y, { n: this.crit ? 8 : 4, color: this.color, speed: this.crit ? 150 : 90, life: 0.3, size: this.crit ? 3.4 : 2.4, glow: true });
    if (this.crit) { sfx.crit(); B.fx.ring(this.x, this.y, { r: 18, color: '#ffd966', life: 0.3, lw: 2 }); }
    if (this.chain > 0) {
      // volt chain: jump to nearest other
      let nx = null, nd = (T * 2.2) ** 2;
      for (const o of B.enemies) {
        if (o.dead || !o.targetable || o === e) continue;
        const d2v = dist2(this.x, this.y, o.x, o.y);
        if (d2v < nd) { nd = d2v; nx = o; }
      }
      if (nx) {
        B.fx.beam(this.x, this.y, nx.x, nx.y - 10, { color: this.color, life: 0.15, lw: 2 });
        this.chain--;
        this.target = nx;
        this.dmg *= 0.75;
        return; // keep flying
      }
    }
    if (this.ricochet > 0) {
      let nx = null, nd = (T * 1.6) ** 2;
      for (const o of B.enemies) {
        if (o.dead || !o.targetable || o === e || this.hitSet.has(o.uid)) continue;
        if (this.groundOnly && o.flying) continue;
        const d2v = dist2(this.x, this.y, o.x, o.y);
        if (d2v < nd) { nd = d2v; nx = o; }
      }
      if (nx) {
        this.ricochet--;
        this.hitSet.add(e.uid);
        this.target = nx;
        this.dmg *= 0.7;
        return;
      }
    }
    if (this.splash) this.explode(false);
    else this.dead = true;
  }
  land() {
    const B = this.B;
    if (this.splash) this.explode(false);
    else if (this.onLand) { this.onLand(this.x, this.y); this.dead = true; }
    else this.dead = true;
  }
  explode(fizzle) {
    const B = this.B;
    this.dead = true;
    if (this.onLand) { this.onLand(this.x, this.y); }
    if (this.splash && !fizzle) {
      B.fx.burst(this.x, this.y, { n: 14, color: '#ff9a3a', speed: 210, life: 0.45, size: 4.5, g: 260 });
      B.fx.burst(this.x, this.y, { n: 8, color: '#555068', speed: 90, life: 0.6, size: 7, kind: 'smoke', g: -30 });
      B.fx.ring(this.x, this.y, { r: this.splash, color: '#ffb04a', life: 0.35, lw: 3, fill: '#ff7a3a' });
      B.fx.decal(this.x, this.y, this.splash * 0.6, '#241a14', 3.5, 'scorch');
      B.fx.shake(this.src?.def.id === 'cannon' ? 2.5 : 4, 0.15);
      sfx.boom(false);
      for (const e of B.enemies) {
        if (e.dead || !e.targetable) continue;
        if (this.groundOnly && e.flying) continue;
        const d2v = dist2(this.x, this.y, e.x, e.y);
        if (d2v < this.splash ** 2) {
          const falloff = 1 - Math.sqrt(d2v) / this.splash * 0.45;
          e.takeDamage(this.dmg * falloff, { type: this.type, attr: this.attr, src: this.src, crit: this.crit, color: '#ff9a3a' });
        }
      }
    } else if (fizzle) {
      B.fx.burst(this.x, this.y, { n: 3, color: this.color, speed: 40, life: 0.25, size: 2 });
    }
  }
  draw(ctx) {
    if (this.delay > 0) return;
    const B = this.B;
    ctx.save();
    ctx.translate(this.x, this.y - this.z);
    switch (this.kind) {
      case 'dart': case 'kunai': {
        const a = this.target && !this.target.dead ? Math.atan2(this.target.y - 12 - this.y, this.target.x - this.x) : Math.atan2(this.vy || 0, this.vx || 1);
        ctx.rotate(a);
        ctx.fillStyle = this.color;
        ctx.shadowColor = this.color; ctx.shadowBlur = 5;
        ctx.beginPath(); ctx.moveTo(this.size * 1.6, 0); ctx.lineTo(-this.size, this.size * 0.5); ctx.lineTo(-this.size, -this.size * 0.5); ctx.closePath(); ctx.fill();
        break;
      }
      case 'arrow': {
        const a = this.vx !== undefined ? Math.atan2(this.vy, this.vx) : (this.target ? Math.atan2(this.target.y - 12 - this.y, this.target.x - this.x) : 0);
        ctx.rotate(a);
        ctx.strokeStyle = '#8a5a30'; ctx.lineWidth = 2;
        ctx.beginPath(); ctx.moveTo(-8, 0); ctx.lineTo(6, 0); ctx.stroke();
        ctx.fillStyle = this.color;
        ctx.beginPath(); ctx.moveTo(10, 0); ctx.lineTo(4, -3); ctx.lineTo(4, 3); ctx.closePath(); ctx.fill();
        ctx.fillStyle = '#e8e4d8';
        ctx.beginPath(); ctx.moveTo(-8, 0); ctx.lineTo(-11, -3); ctx.lineTo(-11, 3); ctx.closePath(); ctx.fill();
        break;
      }
      case 'ice': {
        ctx.rotate(this.rot);
        ctx.shadowColor = this.color; ctx.shadowBlur = 8;
        ctx.fillStyle = rgba('#cfeaff', 0.95);
        ctx.beginPath();
        for (let i = 0; i < 6; i++) {
          const a = i * TAU / 6;
          ctx.lineTo(Math.cos(a) * this.size, Math.sin(a) * this.size);
          ctx.lineTo(Math.cos(a + TAU / 12) * this.size * 0.45, Math.sin(a + TAU / 12) * this.size * 0.45);
        }
        ctx.closePath(); ctx.fill();
        break;
      }
      case 'shuriken': {
        ctx.rotate(this.rot * 2);
        ctx.shadowColor = '#fff'; ctx.shadowBlur = 4;
        ctx.fillStyle = this.color;
        ctx.beginPath();
        for (let i = 0; i < 4; i++) {
          ctx.rotate(TAU / 4);
          ctx.lineTo(this.size, 0); ctx.lineTo(this.size * 0.3, this.size * 0.3);
        }
        ctx.closePath(); ctx.fill();
        ctx.strokeStyle = '#6a7080'; ctx.lineWidth = 1; ctx.stroke();
        break;
      }
      case 'shell': case 'firebomb': {
        ctx.rotate(this.rot * 0.6);
        if (this.kind === 'firebomb') { ctx.shadowColor = '#ff7a3a'; ctx.shadowBlur = 12; ctx.fillStyle = '#ff9a3a'; }
        else { ctx.fillStyle = this.color; }
        ctx.beginPath(); ctx.arc(0, 0, this.size, 0, TAU); ctx.fill();
        ctx.fillStyle = 'rgba(255,255,255,.35)';
        ctx.beginPath(); ctx.arc(-this.size * 0.3, -this.size * 0.3, this.size * 0.3, 0, TAU); ctx.fill();
        // ground shadow for arc
        ctx.restore();
        ctx.save();
        ctx.translate(this.x, this.y);
        ctx.fillStyle = `rgba(0,0,0,${clamp(0.35 - this.z * 0.003, 0.05, 0.35)})`;
        ctx.beginPath(); ctx.ellipse(0, 0, this.size * 0.8, this.size * 0.4, 0, 0, TAU); ctx.fill();
        break;
      }
      case 'bolt': case 'holybolt': case 'voidorb': case 'zapball': case 'note': {
        ctx.shadowColor = this.color; ctx.shadowBlur = 12;
        ctx.fillStyle = this.color;
        if (this.kind === 'note') {
          ctx.rotate(this.rot * 0.4);
          ctx.beginPath(); ctx.ellipse(-2, 2, 4, 3, -0.4, 0, TAU); ctx.fill();
          ctx.fillRect(1, -8, 1.8, 10);
        } else {
          ctx.beginPath(); ctx.arc(0, 0, this.size, 0, TAU); ctx.fill();
          ctx.fillStyle = rgba('#ffffff', 0.85);
          ctx.beginPath(); ctx.arc(0, 0, this.size * 0.45, 0, TAU); ctx.fill();
        }
        break;
      }
      case 'bat': {
        const flap = Math.sin(this.rot * 3) * 0.6;
        ctx.fillStyle = '#241a38';
        ell2(ctx, 0, 0, 4, 5.5, '#2c2044');
        ctx.save(); ctx.rotate(flap);
        ctx.beginPath(); ctx.moveTo(0, 0); ctx.quadraticCurveTo(-7, -5, -11, 0); ctx.quadraticCurveTo(-6, 1, 0, 2); ctx.fill();
        ctx.restore();
        ctx.save(); ctx.rotate(-flap);
        ctx.beginPath(); ctx.moveTo(0, 0); ctx.quadraticCurveTo(7, -5, 11, 0); ctx.quadraticCurveTo(6, 1, 0, 2); ctx.fill();
        ctx.restore();
        ctx.fillStyle = '#ff5a4a';
        ctx.fillRect(-2, -3, 1.4, 1.4); ctx.fillRect(1, -3, 1.4, 1.4);
        break;
      }
      case 'bamboo': {
        ctx.rotate(this.rot);
        ctx.fillStyle = this.color;
        rrect2(ctx, -this.size, -this.size * 0.42, this.size * 2, this.size * 0.84, 2);
        ctx.fillStyle = '#2c5018';
        ctx.fillRect(-1, -this.size * 0.42, 2, this.size * 0.84);
        break;
      }
      case 'seed': {
        ctx.shadowColor = this.color; ctx.shadowBlur = 8;
        ctx.fillStyle = this.color;
        ctx.beginPath(); ctx.arc(0, 0, this.size, 0, TAU); ctx.fill();
        break;
      }
      default: {
        ctx.fillStyle = this.color;
        ctx.beginPath(); ctx.arc(0, 0, this.size, 0, TAU); ctx.fill();
      }
    }
    ctx.restore();
  }
}
function ell2(ctx, x, y, rx, ry, fill) { ctx.beginPath(); ctx.ellipse(x, y, rx, ry, 0, 0, TAU); ctx.fillStyle = fill; ctx.fill(); }
function rrect2(ctx, x, y, w, h, r) { ctx.beginPath(); ctx.moveTo(x + r, y); ctx.arcTo(x + w, y, x + w, y + h, r); ctx.arcTo(x + w, y + h, x, y + h, r); ctx.arcTo(x, y + h, x, y, r); ctx.arcTo(x, y, x + w, y, r); ctx.closePath(); ctx.fill(); }

// ============================================================
// HAZARD (clouds, lava, blizzard, void zones, rifts)
// ============================================================
export class Hazard {
  constructor(B, o) {
    this.B = B;
    this.kind = o.kind;
    this.x = o.x; this.y = o.y;
    this.r = o.r;
    this.dps = o.dps || 0;
    this.dur = o.dur;
    this.t = 0;
    this.color = o.color || '#fff';
    this.attr = o.attr;
    this.src = o.src; this.srcHero = o.srcHero;
    this.slow = o.slow || 0;
    this.pull = o.pull || 0;
    this.followHero = o.followHero || null;
    this.tickAcc = {};
    this.dead = false;
    this.spawnId = o.spawnId || null; // rift
    this.pathD = o.pathD || 0;
    this.groundOnly = o.groundOnly || false;
    this.spawnT = 0;
    if (o.kind === 'blizzard') B.fx.decal(o.x, o.y, o.r * 0.9, '#8fd8ff', o.dur, 'ice');
  }
  update(dt) {
    const B = this.B;
    this.t += dt;
    if (this.t >= this.dur) { this.dead = true; return; }
    if (this.followHero && this.followHero.deployed) { this.x = this.followHero.x; this.y = this.followHero.y; }
    // rift spawns
    if (this.kind === 'rift') {
      this.spawnT -= dt;
      if (this.spawnT <= 0) {
        this.spawnT = 2.6;
        const d = this.pathD;
        B.spawnEnemy(this.spawnId, { d, quiet: true });
        B.fx.ring(this.x, this.y - 10, { r: 34, color: '#c05af0', life: 0.5, lw: 3 });
        sfx.magic();
      }
      return;
    }
    // tick damage / effects
    for (const e of B.enemies) {
      if (e.dead || !e.targetable) continue;
      if (this.groundOnly && e.flying) continue;
      const d2v = dist2(this.x, this.y - (e.flying ? 10 : 0), e.x, e.y - 8);
      if (d2v > this.r ** 2) continue;
      const key = e.uid;
      this.tickAcc[key] = (this.tickAcc[key] || 0) + dt;
      if (this.tickAcc[key] >= 0.5) {
        this.tickAcc[key] = 0;
        if (this.dps) {
          e.takeDamage(this.dps * 0.5, { type: this.kind === 'lava' || this.kind === 'cloud' ? 'magic' : 'magic', attr: this.attr, src: this.src, srcHero: this.srcHero, silent: true, color: this.color });
        }
        if (this.kind === 'cloud') {
          if (!e.poison || e.poison.dps < this.dps * 0.35) e.poison = { dps: this.dps * 0.35, t: 2.2, acc: 0 };
        }
      }
      if (this.slow) e.applySlow(this.slow, 0.6);
      if (this.pull && !e.heavy && !e.isBoss) {
        const a = Math.atan2(this.y - e.y, this.x - e.x);
        e.x += Math.cos(a) * this.pull * dt;
        e.y += Math.sin(a) * this.pull * dt * 0.6;
        // convert lateral pull into path pull-back
        e.d = Math.max(0, e.d - this.pull * dt * 0.4);
        e.updatePos();
      }
    }
    // visuals
    if (this.kind === 'cloud' && Math.random() < dt * 14) {
      B.fx.spawn({ x: this.x + (Math.random() - 0.5) * this.r * 1.6, y: this.y + (Math.random() - 0.5) * this.r, vx: (Math.random() - 0.5) * 8, vy: -14, g: -4, life: 0.9, size: 7 + Math.random() * 6, size2: 12, color: rgba('#7dff5a', 0.35), kind: 'smoke', alpha: 0.5 });
    }
    if (this.kind === 'lava' && Math.random() < dt * 10) B.fx.embers(this.x, this.y, 1);
    if (this.kind === 'blizzard' && Math.random() < dt * 20) {
      B.fx.spawn({ x: this.x + (Math.random() - 0.5) * this.r * 2, y: this.y - this.r + Math.random() * this.r * 0.6, vx: (Math.random() - 0.5) * 30, vy: 40 + Math.random() * 30, g: 0, life: 0.8, size: 2.2, color: '#e8f8ff', kind: 'dot', alpha: 0.9 });
    }
    if (this.kind === 'voidzone' && Math.random() < dt * 16) {
      const a = Math.random() * TAU, rr = this.r * (0.5 + Math.random() * 0.6);
      B.fx.spawn({ x: this.x + Math.cos(a) * rr, y: this.y + Math.sin(a) * rr * 0.6, vx: -Math.cos(a) * 60, vy: -Math.sin(a) * 40, g: 0, life: 0.6, size: 2.6, color: '#c05af0', kind: 'dot', glow: true });
    }
  }
  draw(ctx, time) {
    const B = this.B;
    const k = clamp(this.t / 0.3, 0, 1);
    const fade = clamp((this.dur - this.t) / 0.6, 0, 1);
    const a = Math.min(k, fade);
    ctx.save();
    ctx.globalAlpha = a;
    switch (this.kind) {
      case 'cloud': {
        const g = ctx.createRadialGradient(this.x, this.y, 4, this.x, this.y, this.r);
        g.addColorStop(0, rgba('#7dff5a', 0.28)); g.addColorStop(0.7, rgba('#4ac83a', 0.16)); g.addColorStop(1, rgba('#4ac83a', 0));
        ctx.fillStyle = g;
        ctx.beginPath(); ctx.ellipse(this.x, this.y, this.r, this.r * 0.7, 0, 0, TAU); ctx.fill();
        break;
      }
      case 'lava': {
        const g = ctx.createRadialGradient(this.x, this.y, 4, this.x, this.y, this.r);
        const fl = 0.7 + Math.sin(time * 8) * 0.3;
        g.addColorStop(0, rgba('#ffd966', 0.55 * fl)); g.addColorStop(0.5, rgba('#f05a1a', 0.4)); g.addColorStop(1, rgba('#8a2a10', 0));
        ctx.fillStyle = g;
        ctx.beginPath(); ctx.ellipse(this.x, this.y, this.r, this.r * 0.6, 0, 0, TAU); ctx.fill();
        break;
      }
      case 'blizzard': {
        ctx.strokeStyle = rgba('#cfeaff', 0.5); ctx.lineWidth = 2;
        ctx.setLineDash([6, 8]);
        ctx.beginPath(); ctx.ellipse(this.x, this.y, this.r, this.r * 0.65, 0, time * 0.8, TAU + time * 0.8); ctx.stroke();
        ctx.setLineDash([]);
        const g = ctx.createRadialGradient(this.x, this.y, 4, this.x, this.y, this.r);
        g.addColorStop(0, rgba('#e8f8ff', 0.18)); g.addColorStop(1, rgba('#8fd8ff', 0));
        ctx.fillStyle = g;
        ctx.beginPath(); ctx.ellipse(this.x, this.y, this.r, this.r * 0.65, 0, 0, TAU); ctx.fill();
        break;
      }
      case 'voidzone': {
        const g = ctx.createRadialGradient(this.x, this.y, 2, this.x, this.y, this.r);
        g.addColorStop(0, rgba('#1a0c28', 0.75)); g.addColorStop(0.7, rgba('#5a1a8a', 0.35)); g.addColorStop(1, rgba('#c05af0', 0));
        ctx.fillStyle = g;
        ctx.beginPath(); ctx.ellipse(this.x, this.y, this.r, this.r * 0.7, 0, 0, TAU); ctx.fill();
        ctx.save(); ctx.translate(this.x, this.y); ctx.rotate(-time * 2);
        ctx.strokeStyle = rgba('#e0a0ff', 0.6); ctx.lineWidth = 2;
        ctx.beginPath(); ctx.ellipse(0, 0, this.r * 0.65, this.r * 0.42, 0, 0.5, TAU - 0.2); ctx.stroke();
        ctx.beginPath(); ctx.ellipse(0, 0, this.r * 0.4, this.r * 0.26, 0, 2.2, TAU + 1.5); ctx.stroke();
        ctx.restore();
        break;
      }
      case 'rift': {
        ctx.save();
        ctx.translate(this.x, this.y);
        const pulse = 1 + Math.sin(time * 5) * 0.08;
        ctx.scale(pulse, pulse);
        const g = ctx.createRadialGradient(0, 0, 2, 0, 0, this.r);
        g.addColorStop(0, rgba('#1a0c28', 0.9)); g.addColorStop(0.6, rgba('#5a1a8a', 0.5)); g.addColorStop(1, rgba('#c05af0', 0));
        ctx.fillStyle = g;
        ctx.beginPath(); ctx.ellipse(0, -14, this.r * 0.7, this.r, 0, 0, TAU); ctx.fill();
        ctx.strokeStyle = rgba('#e0a0ff', 0.8); ctx.lineWidth = 2.5;
        ctx.beginPath(); ctx.ellipse(0, -14, this.r * 0.5, this.r * 0.8, 0, 0, TAU); ctx.stroke();
        ctx.restore();
        break;
      }
    }
    ctx.restore();
  }
}
