// ============================================================
// GTDM core definitions — attributes, rarities, constants
// ============================================================

// Scissors > Rock > Paper > Scissors
export const ATTRS = ['scissors', 'rock', 'paper'];
export const ATTR_BEATS = { scissors: 'rock', rock: 'paper', paper: 'scissors' };
export const ATTR_ICON = { scissors: '✂️', rock: '🪨', paper: '📜' };
export const ATTR_COLOR = { scissors: '#ff9a5c', rock: '#b0b8cc', paper: '#8fe0a8' };

// damage multiplier attacker->defender
export function attrMult(a, d) {
  if (!a || !d) return 1;
  if (ATTR_BEATS[a] === d) return 1.35;
  if (ATTR_BEATS[d] === a) return 0.75;
  return 1;
}

export const RARITIES = ['gray', 'green', 'blue', 'purple', 'legendary', 'mythic'];
export const RARITY_IDX = { gray: 0, green: 1, blue: 2, purple: 3, legendary: 4, mythic: 5 };
export const RARITY_COLOR = {
  gray: '#9aa0b0', green: '#57d97a', blue: '#4aa8f0',
  purple: '#a06bf0', legendary: '#f5c542', mythic: '#ff5fa2',
};
export const RARITY_MAXLVL = { gray: 10, green: 15, blue: 20, purple: 25, legendary: 30, mythic: 35 };
export const RARITY_WEIGHT = { gray: 46, green: 28, blue: 15, purple: 8, legendary: 2.6, mythic: 0.4 };

export const CURRENCIES = [
  { id: 'gold', icon: '💰', cls: 'gold' },
  { id: 'diamond', icon: '💎', cls: 'diamond' },
  { id: 'ruby', icon: '🔴', cls: 'ruby' },
  { id: 'magic', icon: '🔮', cls: 'magic' },
  { id: 'mileage', icon: '🎟️', cls: 'mileage' },
  { id: 'mineral', icon: '🪙', cls: 'mineral' },
  { id: 'card', icon: '🎴', cls: 'card' },
  { id: 'soul', icon: '🌀', cls: 'soul' },
];

// ---------- balance constants ----------
export const K = {
  START_LIVES: 20,
  TILE: 60,
  COLS: 16, ROWS: 9,
  W: 960, H: 540,
  SELL_RATIO: 0.7,
  INBATTLE_MAX: 3,           // tower level cap inside a battle
  EARLY_CALL_BONUS: 0.35,    // fraction of remaining countdown → gold
  HERO_TEAM_SIZE: 3,
  HERO_SKILL_TAP_REFRESH: 0.25, // tapping deployed hero refreshes 25% cd, 15s internal cd per hero
  // meta upgrade costs
  towerUpCost(rarity, lvl) { // gold cost tower lvl -> lvl+1
    const base = [60, 110, 220, 480, 1000, 2100][RARITY_IDX[rarity]] ?? 100;
    return Math.round(base * Math.pow(1.32, lvl - 1) + 40 * lvl);
  },
  towerUpCards(rarity, lvl) {
    const base = [1, 2, 3, 5, 8, 12][RARITY_IDX[rarity]] ?? 1;
    return Math.min(60, Math.ceil(base * (1 + (lvl - 1) * 0.45)));
  },
  towerUpMineral(rarity, lvl) { // required from lvl 10+
    if (lvl < 10) return 0;
    return [2, 3, 5, 8, 12, 18][RARITY_IDX[rarity]] + Math.floor((lvl - 10) * 1.6);
  },
  heroUpCost(lvl) { return Math.round(120 * Math.pow(1.30, lvl - 1) + 80); },
  heroUpRuby(lvl) { return lvl >= 10 ? Math.ceil((lvl - 8) * 1.6) : 0; },
  heroAwakenCost(star) { return [0, 40, 120, 300][star] ?? 0; },   // soul stones for ★1..3
  heroAwakenRuby(star) { return [0, 60, 180, 450][star] ?? 0; },
  abilityUpCost(lvl) { return 8 + lvl * 6; }, // magic stones
  // meta stat scaling
  towerMetaBonus(lvl) { return 1 + (lvl - 1) * 0.055; }, // +5.5% dmg per meta lvl
  towerMetaRange(lvl) { return 1 + (lvl - 1) * 0.008; },
  heroMetaBonus(lvl, awaken) { return (1 + (lvl - 1) * 0.05) * (1 + awaken * 0.22); },
  // XP / account
  xpFor(lvl) { return Math.round(80 * Math.pow(1.22, lvl - 1)); },
  // gacha
  PULL_COST_CARD: 1,
  PULL10_COST_DIAMOND: 900,
  PULL1_COST_DIAMOND: 100,
  PITY_RARE: 10,     // guaranteed purple+ every 10
  PITY_LEGEND: 50,   // guaranteed legendary+ every 50
  MILEAGE_PER_PULL: 10,
  // dupe conversion
  DUPE_CONV: { gray: { card: 2 }, green: { card: 4 }, blue: { card: 8 }, purple: { card: 15, soul: 2 }, legendary: { card: 30, soul: 8, mineral: 10 }, mythic: { card: 60, soul: 25, mineral: 30 } },
  // daily challenge / proof
  PROOF_REWARD_EVERY: 5,
};

// Tower in-battle stat multipliers per level [1,2,3]
export const IB_DMG = [1, 1.55, 2.25];
export const IB_RATE = [1, 1.12, 1.26];
export const IB_RANGE = [1, 1.08, 1.16];
export const IB_COST_MULT = [0, 0.8, 1.35]; // upgrade cost as multiple of base build cost
