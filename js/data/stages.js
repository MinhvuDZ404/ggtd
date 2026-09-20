// ============================================================
// GTDM stages — 10 regions × 20 stages, procedural waves,
// plus Daily Challenge / Tower of Proof / Boss Rush generators
// ============================================================
import { mulberry32, hashStr, dayKey, pick } from '../core/util.js';
import { ENEMY_MAP, BOSSES } from './enemies.js';

export const REGIONS = [
  {
    id: 0, name: { vi: 'Cánh Đồng Ngọc Lục', en: 'Emerald Fields' }, icon: '🌿',
    desc: { vi: 'Những đồng cỏ xanh mướt nơi vương quốc bắt đầu.', en: 'Lush green meadows where the kingdom begins.' },
    ground: ['#2c4a24', '#35562b'], path: ['#8a6b45', '#a0814f'], deco: 'tree',
    ambient: { type: 'leaf', color: '#9ed671' }, sky: ['#7ec8f0', '#cfe9ff'],
  },
  {
    id: 1, name: { vi: 'Sa Mạc Nắng Cháy', en: 'Sunscorch Desert' }, icon: '🏜️',
    desc: { vi: 'Cát vàng vô tận chôn vùi những vương quốc cổ.', en: 'Endless golden sands burying ancient kingdoms.' },
    ground: ['#c9a86a', '#d8b978'], path: ['#a5824c', '#b8935a'], deco: 'cactus',
    ambient: { type: 'sand', color: '#e8d5a3' }, sky: ['#f0c87e', '#ffe9c0'],
  },
  {
    id: 2, name: { vi: 'Đỉnh Băng Giá', en: 'Frostpeak Mountains' }, icon: '🏔️',
    desc: { vi: 'Núi tuyết vĩnh cửu, gió lạnh cắt da.', en: 'Eternal snow peaks under a biting wind.' },
    ground: ['#c8d8e8', '#dbe8f2'], path: ['#8fa8c0', '#a3b8cc'], deco: 'pine',
    ambient: { type: 'snow', color: '#ffffff' }, sky: ['#a8c8e8', '#e8f4ff'],
  },
  {
    id: 3, name: { vi: 'Rừng Thầm Thì', en: 'Whispering Woods' }, icon: '🌲',
    desc: { vi: 'Khu rừng cổ thì thầm những bí mật bị lãng quên.', en: 'An ancient forest whispering forgotten secrets.' },
    ground: ['#2a4030', '#334c3a'], path: ['#6b5a3a', '#7d6b47'], deco: 'bigtree',
    ambient: { type: 'firefly', color: '#d8f08a' }, sky: ['#5a8a6a', '#a8c8a0'],
  },
  {
    id: 4, name: { vi: 'Tàn Tích Chìm', en: 'Sunken Ruins' }, icon: '🏛️',
    desc: { vi: 'Đầm lầy nuốt trọn đền đài của nền văn minh đã mất.', en: 'A swamp swallowing the temples of a lost civilization.' },
    ground: ['#3a4a3c', '#46584a'], path: ['#6e6a52', '#7f7a60'], deco: 'ruin',
    ambient: { type: 'bubble', color: '#9ad0a8' }, sky: ['#6a8a7a', '#b0c8b8'],
  },
  {
    id: 5, name: { vi: 'Núi Lửa Đỏ', en: 'Crimson Volcano' }, icon: '🌋',
    desc: { vi: 'Dung nham rực đỏ chảy dọc sườn núi tử thần.', en: 'Red lava flows down the slopes of death.' },
    ground: ['#4a2c26', '#5a3730'], path: ['#7a4a3a', '#8c5844'], deco: 'rock',
    ambient: { type: 'ember', color: '#ff9a5c' }, sky: ['#a04a3a', '#e08a5a'],
  },
  {
    id: 6, name: { vi: 'Thành Đài Trên Mây', en: 'Sky Citadel' }, icon: '☁️',
    desc: { vi: 'Pháo đài bay lơ lửng giữa biển mây trắng.', en: 'A fortress floating amid a sea of white clouds.' },
    ground: ['#8aa8d8', '#9ab8e4'], path: ['#d8e4f4', '#e8f0fc'], deco: 'cloud',
    ambient: { type: 'star', color: '#ffffff' }, sky: ['#6a9ae0', '#b8d8ff'],
  },
  {
    id: 7, name: { vi: 'Vực Thẳm Bóng Đêm', en: 'Shadow Abyss' }, icon: '🌑',
    desc: { vi: 'Bóng tối vĩnh hằng, nơi ánh sáng không thể tới.', en: 'Eternal darkness where light dare not go.' },
    ground: ['#221a30', '#2c2340'], path: ['#443a5c', '#524670'], deco: 'spire',
    ambient: { type: 'wisp', color: '#a06bf0' }, sky: ['#1a1228', '#3a2a58'],
  },
  {
    id: 8, name: { vi: 'Bình Nguyên Bí Ẩn', en: 'Arcane Expanse' }, icon: '🔮',
    desc: { vi: 'Tinh thể phép thuật mọc lên từ đất như nấm.', en: 'Arcane crystals sprout from the earth like mushrooms.' },
    ground: ['#2e2450', '#3a2e60'], path: ['#5c4a8c', '#6e5aa0'], deco: 'crystal',
    ambient: { type: 'sparkle', color: '#c9a2ff' }, sky: ['#2a1f4a', '#5a3f8a'],
  },
  {
    id: 9, name: { vi: 'Ngai Vàng Hoàng Kim', en: 'Golden Throne' }, icon: '👑',
    desc: { vi: 'Trái tim hắc ám của đế chế Midas — trận chiến cuối cùng.', en: 'The dark heart of Midas\u2019 empire — the final battle.' },
    ground: ['#4a3a1c', '#5c4a24'], path: ['#8c6f2e', '#a0822f'], deco: 'pillar',
    ambient: { type: 'gold', color: '#ffd966' }, sky: ['#3a2a10', '#8a6a20'],
  },
];

// Path templates: waypoints in tile coords (16×9 grid). Spawn = first, exit = last.
const TEMPLATES = [
  { id: 'sCurve', pts: [[0, 4], [4, 4], [4, 1], [9, 1], [9, 7], [13, 7], [13, 4], [15, 4]] },
  { id: 'zigzag', pts: [[0, 1], [3, 1], [3, 7], [7, 7], [7, 3], [11, 3], [11, 7], [15, 7]] },
  { id: 'bigU', pts: [[0, 0], [0, 6], [5, 6], [5, 2], [10, 2], [10, 6], [15, 6]] },
  { id: 'spiral', pts: [[0, 4], [6, 4], [6, 1], [13, 1], [13, 7], [3, 7], [3, 5], [8, 5], [8, 3], [11, 3], [15, 3]] },
  { id: 'switchback', pts: [[0, 7], [12, 7], [12, 4], [2, 4], [2, 1], [15, 1]] },
  { id: 'twinGate', pts: [[0, 2], [7, 2], [7, 6], [15, 6]] },
  { id: 'serpent', pts: [[0, 4], [2, 4], [2, 1], [6, 1], [6, 7], [10, 7], [10, 1], [13, 1], [13, 4], [15, 4]] },
  { id: 'drop', pts: [[7, 0], [7, 3], [2, 3], [2, 7], [13, 7], [13, 4], [15, 4]] },
];

export const REGION_HP = [1, 1.8, 3.0, 4.8, 7.2, 10.5, 15, 21, 29, 40];
export function hpScale(region, idx) { return REGION_HP[region] * Math.pow(1.062, idx); }
export function goldScale(region, idx) { return Math.pow(REGION_HP[region], 0.85) * Math.pow(1.05, idx); }
export function armorAdd(region, idx) { return region * 2.2 + idx * 0.14; }
export function spdScale(region, idx) { return 1 + region * 0.013 + idx * 0.0016; }

const POOLS = [
  ['goblin', 'wolf', 'orc'],
  ['goblin', 'wolf', 'orc', 'shaman', 'harpy', 'batswarm'],
  ['orc', 'shaman', 'harpy', 'batswarm', 'golem', 'slime', 'wolf'],
  ['golem', 'slime', 'wraith', 'troll', 'necro', 'harpy', 'orc'],
  ['wraith', 'troll', 'necro', 'imp', 'warlock', 'golem', 'harpy'],
  ['imp', 'warlock', 'wyvern', 'cultist', 'slime', 'troll', 'batswarm'],
  ['wyvern', 'cultist', 'siege', 'darkblade', 'imp', 'warlock', 'troll'],
  ['siege', 'darkblade', 'shieldbearer', 'wyvern', 'wraith', 'cultist', 'necro'],
  ['shieldbearer', 'voidling', 'darkblade', 'wyvern', 'wraith', 'warlock', 'siege'],
  ['voidling', 'prism', 'shieldbearer', 'wyvern', 'darkblade', 'warlock', 'cultist'],
];

// total stage ids: 1..200 (region = floor((id-1)/20), idx = (id-1)%20)
export function stageRegion(id) { return Math.floor((id - 1) / 20); }
export function stageIdx(id) { return (id - 1) % 20; }
export function isBossStage(id) { const i = stageIdx(id); return i === 9 || i === 19; }
export function stageBoss(id) {
  const r = stageRegion(id), i = stageIdx(id);
  if (i !== 9 && i !== 19) return null;
  return BOSSES.find(b => b.region === r && b.slot === (i === 9 ? 'mini' : 'lord')) || null;
}
export const TOTAL_STAGES = 200;

export function stageSeed(id) { return hashStr('gtdm-stage-' + id); }

// Build map layout: path polyline (px), build slots (tiles), spawn/exit
export function genLayout(id, seedOverride = null) {
  const seed = seedOverride ?? stageSeed(id);
  const rnd = mulberry32(seed ^ 0x9e3779b9);
  let tpl = TEMPLATES[Math.floor(rnd() * TEMPLATES.length)];
  let pts = tpl.pts.map(p => [p[0], p[1]]);
  // vertical mirror for variety
  if (rnd() < 0.5) pts = pts.map(p => [p[0], 8 - p[1]]);
  return { tplId: tpl.id, pts, seed };
}

// wave archetypes
const ARCHETYPES = ['mixed', 'swarm', 'air', 'armor', 'split', 'fast', 'regen', 'ambush', 'elite', 'mage'];

function waveArchetype(region, idx, w, nWaves, rnd) {
  // first 2 waves are gentle mixed
  if (w < 2) return 'mixed';
  const pool = [];
  const add = (a, wt) => pool.push([wt, a]);
  add('mixed', 30); add('swarm', 16); add('fast', 10);
  if (region >= 1) add('air', 14);
  if (region >= 0) add('armor', 12);
  if (region >= 2) add('split', 10);
  if (region >= 3) add('regen', 8);
  if (region >= 3) add('mage', 8);
  if (region >= 4) add('ambush', 8);
  if (w >= nWaves - 3 || (idx >= 5 && rnd() < 0.2)) add('elite', 12);
  if (idx >= 15 && region >= 6) add('stealthish', 6);
  let total = 0; pool.forEach(p => total += p[0]);
  let r = rnd() * total;
  for (const p of pool) { r -= p[0]; if (r <= 0) return p[1]; }
  return 'mixed';
}

function pickFrom(pool, rnd, avoidHeavyAir = null) {
  return pool[Math.floor(rnd() * pool.length)];
}

// Generate waves for a stage. Returns array of wave objects:
// { type, groups:[{id,count,gap,delay,t0,elite}], boss? }
export function genWaves(id, seedOverride = null) {
  const region = stageRegion(id), idx = stageIdx(id);
  const rnd = mulberry32(seedOverride ?? stageSeed(id));
  const pool = POOLS[region];
  const nWaves = 8 + Math.floor(idx / 4) + Math.floor(region / 2) + (isBossStage(id) ? 1 : 0);
  const boss = stageBoss(id);
  const waves = [];
  for (let w = 0; w < nWaves; w++) {
    const isLast = w === nWaves - 1;
    if (isLast && boss) {
      const groups = [];
      // boss support escorts
      const esc1 = pool[Math.floor(rnd() * pool.length)];
      groups.push({ id: esc1, count: 3 + Math.floor(idx / 6), gap: 0.9, delay: 3.5, elite: idx >= 12 });
      if (region >= 3 && rnd() < 0.7) groups.push({ id: pickFrom(pool, rnd), count: 3, gap: 1.0, delay: 14, elite: false });
      if (idx === 19 && region >= 5) groups.push({ id: pickFrom(pool, rnd), count: 4, gap: 0.8, delay: 26 });
      waves.push({ type: 'boss', groups, boss: boss.id });
      continue;
    }
    const arch = waveArchetype(region, idx, w, nWaves, rnd);
    const groups = [];
    const power = 1 + w * 0.16 + idx * 0.05; // composition size
    const baseCount = Math.round((3.2 + w * 0.9 + idx * 0.22 + region * 0.4) * (arch === 'swarm' ? 1.7 : arch === 'elite' ? 0.45 : 1));
    switch (arch) {
      case 'swarm': {
        const cheap = pool.filter(p => ['goblin', 'wolf', 'batswarm', 'minislime', 'skeleton', 'imp', 'darkblade'].includes(p));
        const idc = cheap.length ? pickFrom(cheap, rnd) : 'goblin';
        groups.push({ id: idc, count: baseCount, gap: 0.42, delay: 0 });
        if (w > 3 && rnd() < 0.5) groups.push({ id: pickFrom(pool, rnd), count: Math.ceil(baseCount / 3), gap: 0.7, delay: baseCount * 0.2 });
        break;
      }
      case 'air': {
        const air = pool.filter(p => ENEMY_MAP[p]?.flying);
        const idc = air.length ? pickFrom(air, rnd) : 'harpy';
        groups.push({ id: idc, count: Math.max(3, Math.round(baseCount * 0.8)), gap: 0.6, delay: 0 });
        if (rnd() < 0.55) groups.push({ id: pickFrom(pool.filter(p => !ENEMY_MAP[p]?.flying), rnd), count: Math.ceil(baseCount / 2), gap: 0.8, delay: 2 });
        break;
      }
      case 'armor': {
        const arm = pool.filter(p => (ENEMY_MAP[p]?.armor ?? 0) >= 3);
        groups.push({ id: arm.length ? pickFrom(arm, rnd) : 'orc', count: Math.max(2, Math.round(baseCount * 0.6)), gap: 1.0, delay: 0 });
        groups.push({ id: pickFrom(pool, rnd), count: Math.ceil(baseCount / 2), gap: 0.7, delay: 3 });
        break;
      }
      case 'split': {
        const spl = pool.filter(p => ENEMY_MAP[p]?.split);
        groups.push({ id: spl.length ? pickFrom(spl, rnd) : 'slime', count: Math.max(3, Math.round(baseCount * 0.7)), gap: 0.9, delay: 0 });
        break;
      }
      case 'fast': {
        const fast = pool.filter(p => (ENEMY_MAP[p]?.spd ?? 1) >= 1.8);
        groups.push({ id: fast.length ? pickFrom(fast, rnd) : 'wolf', count: Math.round(baseCount * 0.9), gap: 0.5, delay: 0 });
        break;
      }
      case 'regen': {
        const reg = pool.filter(p => ENEMY_MAP[p]?.regen || ENEMY_MAP[p]?.heal);
        groups.push({ id: reg.length ? pickFrom(reg, rnd) : 'troll', count: Math.max(2, Math.round(baseCount * 0.5)), gap: 1.1, delay: 0 });
        groups.push({ id: pickFrom(pool, rnd), count: Math.ceil(baseCount * 0.7), gap: 0.7, delay: 1.5 });
        break;
      }
      case 'mage': {
        const sup = pool.filter(p => ENEMY_MAP[p]?.shieldAura || ENEMY_MAP[p]?.debuffAura || ENEMY_MAP[p]?.summon || ENEMY_MAP[p]?.heal);
        groups.push({ id: sup.length ? pickFrom(sup, rnd) : 'warlock', count: Math.max(2, Math.round(baseCount * 0.4)), gap: 1.2, delay: 0 });
        groups.push({ id: pickFrom(pool, rnd), count: Math.round(baseCount * 0.8), gap: 0.65, delay: 1 });
        break;
      }
      case 'ambush': {
        groups.push({ id: pickFrom(pool, rnd), count: Math.ceil(baseCount / 2), gap: 0.8, delay: 0 });
        groups.push({ id: pickFrom(pool, rnd), count: Math.ceil(baseCount / 2), gap: 0.55, delay: 2.5, t0: 0.42 + rnd() * 0.2 });
        break;
      }
      case 'elite': {
        groups.push({ id: pickFrom(pool, rnd), count: Math.max(2, Math.round(baseCount)), gap: 1.4, delay: 0, elite: true });
        break;
      }
      case 'stealthish': {
        const st = ['wraith', 'darkblade', 'voidling'];
        groups.push({ id: pickFrom(st, rnd), count: Math.round(baseCount * 0.7), gap: 0.8, delay: 0 });
        groups.push({ id: pickFrom(pool, rnd), count: Math.ceil(baseCount / 2), gap: 0.7, delay: 2 });
        break;
      }
      default: { // mixed — 2-3 types
        const nTypes = rnd() < 0.45 ? 3 : 2;
        const chosen = [];
        for (let i = 0; i < nTypes; i++) {
          const c = pickFrom(pool, rnd);
          if (!chosen.includes(c)) chosen.push(c);
        }
        chosen.forEach((c, i) => {
          groups.push({ id: c, count: Math.max(2, Math.round(baseCount / nTypes) + (w > nWaves - 3 ? 2 : 0)), gap: 0.75, delay: i * 2.2 });
        });
      }
    }
    // late-wave sprinkles of new menace
    if (w >= nWaves - 2 && region >= 2 && rnd() < 0.4) {
      const menace = POOLS[Math.min(9, region + 1)].filter(p => !pool.includes(p));
      if (menace.length) groups.push({ id: pickFrom(menace, rnd), count: 2 + Math.floor(idx / 8), gap: 0.9, delay: 5 });
    }
    waves.push({ type: arch, groups });
  }
  return waves;
}

// Full stage config (cached)
const stageCache = new Map();
export function getStage(id) {
  if (stageCache.has(id)) return stageCache.get(id);
  const region = stageRegion(id), idx = stageIdx(id);
  const boss = stageBoss(id);
  const st = {
    id, region, idx, boss: boss ? boss.id : null,
    theme: REGIONS[region],
    layout: genLayout(id),
    waves: genWaves(id),
    startGold: 240 + idx * 10 + region * 40,
    lives: 20,
    hpMult: hpScale(region, idx),
    goldMult: goldScale(region, idx),
    armorAdd: armorAdd(region, idx),
    spdMult: spdScale(region, idx),
    rewards: {
      gold: Math.round((90 + idx * 14) * Math.pow(REGION_HP[region], 0.9)),
      first: boss ? (idx === 19
        ? { diamond: 120 + region * 30, card: 8 + region * 2, soul: 6 + region * 2, mineral: 4 + region }
        : { diamond: 60 + region * 15, card: 5 + region, soul: 3 + region, mineral: 3 })
        : { diamond: idx % 5 === 4 ? 30 + region * 5 : 0, gold: Math.round((120 + idx * 20) * Math.pow(REGION_HP[region], 0.9)), card: 1 + Math.floor(region / 2) },
    },
  };
  stageCache.set(id, st);
  return st;
}

// ============================================================
// DAILY CHALLENGE — seeded by date, random modifiers & draft
// ============================================================
export const MODIFIERS = [
  { id: 'swift', icon: '💨', name: { vi: 'Gió Cuồng', en: 'Tailwind' }, desc: { vi: 'Kẻ địch +18% tốc độ', en: 'Enemies +18% speed' }, apply: s => { s.spdMult *= 1.18; } },
  { id: 'tough', icon: '🛡️', name: { vi: 'Da Cứng', en: 'Thick Hide' }, desc: { vi: 'Kẻ địch +40% máu', en: 'Enemies +40% HP' }, apply: s => { s.hpMult *= 1.4; } },
  { id: 'rich', icon: '💰', name: { vi: 'Mỏ Vàng', en: 'Gold Vein' }, desc: { vi: '+60% vàng rơi', en: '+60% gold drops' }, apply: s => { s.goldMult *= 1.6; } },
  { id: 'poor', icon: '📉', name: { vi: 'Bão Giá', en: 'Austerity' }, desc: { vi: 'Chi phí xây +25%', en: 'Build costs +25%' }, apply: s => { s.costMult = 1.25; } },
  { id: 'swarmy', icon: '🐜', name: { vi: 'Bầy Đàn', en: 'Swarmtide' }, desc: { vi: 'Đông hơn nhưng yếu hơn (-20% máu)', en: 'More but weaker (−20% HP)' }, apply: s => { s.hpMult *= 0.8; s.countMult = 1.5; } },
  { id: 'fog', icon: '🌫️', name: { vi: 'Sương Mù', en: 'Fog of War' }, desc: { vi: 'Tầm bắn tháp -12%', en: 'Tower range −12%' }, apply: s => { s.rangeMult = 0.88; } },
  { id: 'glass', icon: '🗡️', name: { vi: 'Dao Hai Lưỡi', en: 'Glass Cannon' }, desc: { vi: 'Tháp +30% sát thương, -15% tầm', en: 'Towers +30% dmg, −15% range' }, apply: s => { s.dmgMultMod = 1.3; s.rangeMult = (s.rangeMult || 1) * 0.85; } },
  { id: 'hearty', icon: '❤️', name: { vi: 'Trái Tim Thép', en: 'Iron Heart' }, desc: { vi: 'Bắt đầu với 30 Máu', en: 'Start with 30 lives' }, apply: s => { s.lives = 30; } },
  { id: 'airborne', icon: '🦅', name: { vi: 'Không Kích', en: 'Air Supremacy' }, desc: { vi: 'Nhiều không quân hơn hẳn', en: 'Far more air waves' }, apply: s => { s.airBias = true; } },
  { id: 'haste', icon: '⏩', name: { vi: 'Thời Gian Chảy', en: 'Rushing Hourglass' }, desc: { vi: 'Hồi kỹ năng & chiêu nhanh hơn 25%', en: 'Ability & skill cooldowns −25%' }, apply: s => { s.cdMult = 0.75; } },
];

export function getDailyChallenge(date = new Date()) {
  const key = dayKey(date);
  const seed = hashStr('gtdm-daily-' + key);
  const rnd = mulberry32(seed);
  const region = Math.floor(rnd() * 10);
  const mods = [];
  const modPool = [...MODIFIERS];
  const nMods = 2 + (rnd() < 0.35 ? 1 : 0);
  for (let i = 0; i < nMods; i++) {
    const m = modPool.splice(Math.floor(rnd() * modPool.length), 1)[0];
    if (m) mods.push(m.id);
  }
  // draft: 6 random towers offered, player uses all
  const towerIds = ['thorn', 'icearrow', 'shuriken', 'bat', 'cannon', 'magic', 'barracks', 'wolf', 'blossom', 'bamboo', 'nun', 'orchid', 'assassin', 'lightning', 'sniper', 'chrys', 'magma', 'holynova', 'storm', 'void'];
  const draft = [];
  const tp = [...towerIds];
  for (let i = 0; i < 6 && tp.length; i++) draft.push(tp.splice(Math.floor(rnd() * tp.length), 1)[0]);
  // stage-equivalent scale from a mid campaign point
  const equivStage = 40 + Math.floor(rnd() * 100);
  return { key, seed, region, mods, draft, equivStage, nWaves: 12 };
}

const dailyStageCache = new Map();
// Turn a daily-challenge config into a full battle-ready stage
export function getDailyStage(dc) {
  if (dailyStageCache.has(dc.key)) return dailyStageCache.get(dc.key);
  const base = getStage(dc.equivStage);
  const seed = hashStr('gtdm-daily-' + dc.key);
  let waves = genWaves(dc.equivStage, seed).filter(w => !w.boss && w.type !== 'boss');
  while (waves.length < dc.nWaves) {
    const w = { ...waves[waves.length - 1], groups: waves[waves.length - 1].groups.map(g => ({ ...g, count: Math.ceil(g.count * 1.12) })) };
    waves.push(w);
  }
  waves = waves.slice(0, dc.nWaves);
  const st = {
    ...base, id: 9100 + (seed % 900), dailyKey: dc.key, seed,
    theme: REGIONS[dc.region],
    layout: genLayout(dc.equivStage, seed),
    waves, boss: null,
    lives: 20, startGold: Math.round(base.startGold * 1.15),
    mods: dc.mods, draft: dc.draft,
  };
  dailyStageCache.set(dc.key, st);
  return st;
}

// ============================================================
// TOWER OF PROOF — endless floors
// ============================================================
export function getProofFloor(floor, playerId = 1) {
  // floor 1.. ; difficulty curve
  const equivRegion = Math.min(9, Math.floor((floor - 1) / 3));
  const idx = Math.min(19, ((floor - 1) % 3) * 6 + 4);
  const base = getStage(equivRegion * 20 + idx + 1);
  const grow = Math.pow(1.085, floor - 1 - (equivRegion * 3 + Math.floor((floor - 1) / 3) * 0));
  const isBossFloor = floor % 5 === 0;
  const st = {
    ...base, id: 9000 + floor, proofFloor: floor,
    hpMult: base.hpMult * Math.pow(1.09, floor - 1) * 0.55,
    goldMult: base.goldMult * Math.pow(1.07, floor - 1) * 0.8,
    spdMult: Math.min(1.5, base.spdMult),
    lives: 10,
    startGold: 300 + floor * 22,
  };
  if (isBossFloor) {
    const lords = BOSSES.filter(b => b.region <= equivRegion && (floor >= 25 || b.slot === 'mini'));
    const boss = lords.length ? lords[Math.floor(mulberry32(floor * 7919)() * lords.length)] : BOSSES[0];
    st.boss = boss.id;
    const scaled = Math.pow(1.09, floor - 1);
    st.bossHpMult = 0.5 * scaled;
    st.waves = [{ type: 'boss', boss: boss.id, groups: [{ id: POOLS[equivRegion][0], count: 4, gap: 1.0, delay: 6 }] }];
  } else {
    st.waves = genWaves(base.id).slice(0, 3).map(w => ({ ...w }));
    st.waves.forEach(w => w.groups.forEach(g => { g.count = Math.ceil(g.count * (1 + floor * 0.05)); }));
  }
  return st;
}

export const PROOF_REWARDS = floor => {
  if (floor % 5 !== 0) return [];
  const t = floor / 5;
  const r = [{ id: 'mileage', n: 20 + t * 10 }, { id: 'gold', n: 2000 * t }];
  if (t % 2 === 0) r.push({ id: 'soul', n: 2 + t });
  if (t % 3 === 0) r.push({ id: 'mineral', n: 3 + t });
  if (t % 5 === 0) r.push({ id: 'diamond', n: 50 * (t / 5) });
  return r;
};

// ============================================================
// BOSS RUSH — rematch defeated lords
// ============================================================
export function getBossRushStage(bossId) {
  const boss = BOSSES.find(b => b.id === bossId);
  if (!boss) return null;
  const stageId = boss.region * 20 + (boss.slot === 'mini' ? 10 : 20);
  const base = getStage(stageId);
  return {
    ...base, id: 9500 + boss.region * 2 + (boss.slot === 'mini' ? 0 : 1),
    bossRush: bossId, lives: 15, startGold: base.startGold * 1.4,
    hpMult: base.hpMult * 1.25, goldMult: base.goldMult,
    waves: [{ type: 'boss', boss: bossId, groups: [] }],
  };
}
