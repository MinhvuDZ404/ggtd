// ============================================================
// GTDM gacha — rates, pity, dupes (refine), banners
// ============================================================
import { S, addCurMany, grantTower, persist, bumpSession } from './state.js';
import { TOWERS, TOWER_MAP } from '../data/towers.js';
import { K, RARITIES, RARITY_IDX, RARITY_WEIGHT } from '../data/defs.js';
import { wpick, mulberry32, hashStr, dayKey, pick } from '../core/util.js';

export function rollRarity(guarantee = null) {
  if (guarantee) {
    // guarantee: 'purple+' or 'legendary+'
    const min = guarantee === 'legendary+' ? 4 : 3;
    const items = RARITIES.filter(r => RARITY_IDX[r] >= min).map(r => [RARITY_WEIGHT[r], r]);
    return wpick(items);
  }
  return wpick(RARITIES.map(r => [RARITY_WEIGHT[r], r]));
}

export function featuredBanner() {
  // weekly rotation: pick 2 rate-up towers (purple+) deterministically by week
  const d = new Date();
  const wk = Math.floor(d.getTime() / (7 * 864e5));
  const rnd = mulberry32(hashStr('feat-' + wk));
  const cands = TOWERS.filter(t => RARITY_IDX[t.rarity] >= 3);
  const a = cands[Math.floor(rnd() * cands.length)];
  let b = cands[Math.floor(rnd() * cands.length)];
  let guard = 0;
  while (b.id === a.id && guard++ < 20) b = cands[Math.floor(rnd() * cands.length)];
  return { key: 'wk' + wk, towers: [a.id, b.id], endsIn: 7 - d.getUTCDay() };
}

function rollTower(rarity, featured = null) {
  if (featured && RARITY_IDX[rarity] >= 3 && Math.random() < 0.5) {
    const fT = featured.towers.filter(id => TOWER_MAP[id] && RARITY_IDX[TOWER_MAP[id].rarity] === RARITY_IDX[rarity]);
    // featured units keep their own rarity: 50% chance to BE a featured unit (at its own rarity)
    if (Math.random() < 0.5) return pick(featured.towers);
    if (fT.length) return pick(fT);
  }
  const pool = TOWERS.filter(t => t.rarity === rarity);
  return pick(pool).id;
}

export function doPull(n, featured = null) {
  // cost check
  const results = [];
  let pityTriggered = false;
  for (let i = 0; i < n; i++) {
    S.gacha.pityRare++;
    S.gacha.pityLegend++;
    let guarantee = null;
    if (S.gacha.pityLegend >= K.PITY_LEGEND) { guarantee = 'legendary+'; }
    else if (S.gacha.pityRare >= K.PITY_RARE) { guarantee = 'purple+'; }
    let rarity = rollRarity(guarantee);
    if (guarantee) pityTriggered = true;
    let id = rollTower(rarity, featured);
    // featured rate-up: if rarity matches a featured unit's rarity, 50%
    if (featured) {
      const fid = featured.towers.find(f => TOWER_MAP[f].rarity === rarity);
      if (fid && Math.random() < 0.5) id = fid;
    }
    const isNew = !S.towers[id];
    let dupe = null;
    if (isNew) grantTower(id);
    else {
      dupe = { ...K.DUPE_CONV[rarity] };
      // refine (max +5)
      const rec = S.towers[id];
      if ((rec.refine || 0) < 5) { rec.refine = (rec.refine || 0) + 1; dupe.refine = true; }
    }
    if (RARITY_IDX[rarity] >= 3) { S.gacha.pityRare = 0; }
    if (RARITY_IDX[rarity] >= 4) { S.gacha.pityLegend = 0; }
    results.push({ id, rarity, isNew, dupe });
  }
  // 10-pull guarantee: at least blue+
  if (n >= 10 && !results.some(r => RARITY_IDX[r.rarity] >= 2)) {
    const r = results[n - 1];
    const newId = rollTower('blue', featured);
    r.id = newId; r.rarity = 'blue';
    if (!S.towers[newId]) { r.isNew = true; grantTower(newId); r.dupe = null; }
  }
  // mileage + dupe rewards
  const mileage = n * K.MILEAGE_PER_PULL;
  const dupeTotals = {};
  results.forEach(r => {
    if (r.dupe) for (const k in r.dupe) { if (k !== 'refine') dupeTotals[k] = (dupeTotals[k] || 0) + r.dupe[k]; }
  });
  dupeTotals.mileage = (dupeTotals.mileage || 0) + mileage;
  addCurMany(dupeTotals, true);
  S.gacha.total += n;
  bumpSession('summons', n);
  S.stats.summons += n;
  S.gacha.log = results.slice(0, 6).concat(S.gacha.log).slice(0, 30);
  persist();
  return { results, pityTriggered, dupeTotals };
}

export function freePullAvailable() {
  return S.gacha.lastFreeKey !== dayKey();
}
export function markFreePull() {
  S.gacha.lastFreeKey = dayKey();
  persist();
}

export function pityState() {
  return {
    rare: { cur: S.gacha.pityRare, max: K.PITY_RARE },
    legend: { cur: S.gacha.pityLegend, max: K.PITY_LEGEND },
  };
}

// refine bonus for tower damage
export function refineBonus(id) { return 1 + (S.towers[id]?.refine || 0) * 0.02; }
