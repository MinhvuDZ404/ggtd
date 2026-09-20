// ============================================================
// GTDM game state — meta progression, economy, missions
// ============================================================
import { bus, dayKey, daysBetween, mulberry32, hashStr, pick, deepClone } from '../core/util.js';
import { loadGame, saveGame, saveImmediate, wipeSave } from '../core/save.js';
import { K, RARITY_IDX } from '../data/defs.js';
import { TOWER_MAP, STARTER_TOWERS } from '../data/towers.js';
import { HERO_MAP, STARTER_HEROES, ABILITIES } from '../data/heroes.js';
import { TOTAL_STAGES, stageRegion, getDailyChallenge } from '../data/stages.js';

export let S = null; // global save state

function defaultState() {
  return {
    v: 3,
    created: Date.now(),
    settings: { lang: 'vi', music: 0.55, sfx: 0.8, quality: 'high', muted: false, floatingDmg: true, shake: true },
    cur: { gold: 500, diamond: 300, ruby: 40, magic: 10, mileage: 0, mineral: 0, card: 12, soul: 0 },
    acct: { lvl: 1, xp: 0 },
    towers: Object.fromEntries(STARTER_TOWERS.map(t => [t, { lvl: 1 }])),
    heroes: Object.fromEntries(STARTER_HEROES.map(h => [h, { lvl: 1, awaken: 0 }])),
    team: ['arthur', 'rin', null],
    abilities: { meteor: { lvl: 0 }, freeze: { lvl: 0 }, rush: { lvl: 0 }, holy: { lvl: 0 } },
    stages: {},            // id -> {stars, cleared, first:bool, bestLives}
    maxStage: 1,
    proof: { best: 0, runs: 0, totalRewards: 0, daily: {} },
    daily: { lastKey: null, done: false, bestScore: 0, streak: 0, totalRuns: 0 },
    bossrush: { done: {} },// bossId -> {times, best}
    gacha: { pityRare: 0, pityLegend: 0, total: 0, lastFreeKey: null, log: [] },
    missions: { dailyKey: null, daily: [], weeklyKey: null, weekly: [], achieve: {} },
    attend: { lastClaim: null, streak: 0, totalDays: 0, cycleClaimed: [] },
    mail: [],
    codex: {},             // enemy/boss id -> true
    stats: {
      kills: 0, airKills: 0, bossKills: 0, eliteKills: 0, wins: 0, losses: 0, perfects: 0,
      goldEarned: 0, towersBuilt: 0, abilitiesUsed: 0, skillsUsed: 0, summons: 0,
      leaks: 0, proofBest: 0, dailiesDone: 0, singleAttrWins: 0, threeTypeWins: 0, noLeakWins: 0,
      starsTotal: 0, playTime: 0, highestWave: 0,
    },
    unlocks: { daily: false, proof: false, bossrush: false, sweep: false },
    flags: {},
  };
}

const ACHIEVE_DEFS = null; // defined in missions data module
export async function initState() {
  const raw = await loadGame();
  if (raw && raw.data) {
    S = mergeDefaults(raw.data, defaultState());
  } else {
    S = defaultState();
    // welcome mails
    S.mail.push(
      mkMail('welcome', { vi: 'Chào mừng đến Gold Tower Defence M!', en: 'Welcome to Gold Tower Defence M!' },
        { vi: 'Vương quốc cần ngươi, Chỉ huy! Đây là quà khởi đầu: 10 Thẻ Tháp và 500 Vàng. Hãy xây tháp, triệu hồi anh hùng và chặn đứng quân đoàn hắc ám!', en: 'The kingdom needs you, Commander! A starter gift: 10 Tower Cards and 500 Gold. Build towers, summon heroes, and hold back the dark legion!' },
        [{ id: 'card', n: 10 }, { id: 'gold', n: 500 }], '🎁'),
    );
    saveImmediate(serialize());
  }
  ensureMissions();
  bus.emit('state');
  return S;
}

function mergeDefaults(data, def) {
  const out = deepClone(def);
  const walk = (d, s) => {
    for (const k in s) {
      if (d[k] === undefined) continue;
      if (s[k] && typeof s[k] === 'object' && !Array.isArray(s[k])) walk(d[k], s[k]);
      else d[k] = s[k];
    }
    return d;
  };
  return walk(out, data);
}

const serialize = () => JSON.parse(JSON.stringify(S));
let saveThrottle = 0;
export function persist(force = false) {
  const t = Date.now();
  if (!force && t - saveThrottle < 1500) return;
  saveThrottle = t;
  saveGame(serialize());
}
export function persistNow() { saveImmediate(serialize()); }
export async function resetSave() { await wipeSave(); location.reload(); }

// ---------- currencies ----------
export function addCur(id, n, silent = false) {
  if (!S.cur.hasOwnProperty(id)) return;
  S.cur[id] = Math.max(0, Math.round(S.cur[id] + n));
  if (!silent) bus.emit('cur', id);
  persist();
}
export function addCurMany(obj, silent = false) { for (const k in obj) addCur(k, obj[k], silent); }
export function spend(id, n) {
  if (S.cur[id] < n) return false;
  S.cur[id] -= n; bus.emit('cur', id); persist(); return true;
}
export function canAfford(costs) { return Object.entries(costs).every(([k, v]) => (S.cur[k] ?? 0) >= v); }
export function spendMany(costs) {
  if (!canAfford(costs)) return false;
  for (const k in costs) { S.cur[k] -= costs[k]; bus.emit('cur', k); }
  persist(); return true;
}
export const hasCur = (id, n) => (S.cur[id] ?? 0) >= n;

// ---------- account xp ----------
export function addXp(n) {
  S.acct.xp += n;
  let leveled = false;
  while (S.acct.xp >= K.xpFor(S.acct.lvl)) {
    S.acct.xp -= K.xpFor(S.acct.lvl);
    S.acct.lvl++;
    leveled = true;
    // level reward
    const reward = { gold: 800 * S.acct.lvl, diamond: S.acct.lvl % 5 === 0 ? 100 : 20, card: S.acct.lvl % 3 === 0 ? 5 : 2 };
    S.mail.push(mkMail('lvlup' + S.acct.lvl,
      { vi: `Thăng cấp ${S.acct.lvl}!`, en: `Account level ${S.acct.lvl}!` },
      { vi: 'Phần thưởng thăng cấp đang chờ trong hòm thư.', en: 'Your level-up reward awaits.' }, reward, '🎖️'));
  }
  bus.emit('xp'); persist();
  return leveled;
}

// ---------- collection helpers ----------
export const ownsTower = id => !!S.towers[id];
export const towerLvl = id => S.towers[id]?.lvl ?? 0;
export const ownsHero = id => !!S.heroes[id];
export const heroLvl = id => S.heroes[id]?.lvl ?? 0;
export const heroAwaken = id => S.heroes[id]?.awaken ?? 0;
export const abilityLvl = id => S.abilities[id]?.lvl ?? 0;
export const abilityUnlocked = id => S.maxStage > (ABILITIES.find(a => a.id === id)?.unlockStage ?? 1e9);

export function grantTower(id) {
  if (S.towers[id]) return false;
  S.towers[id] = { lvl: 1 }; bus.emit('collection'); persist();
  return true;
}
export function grantHero(id) {
  if (S.heroes[id]) return false;
  S.heroes[id] = { lvl: 1, awaken: 0 }; bus.emit('collection'); persist();
  return true;
}

export function towerUpCost(id) {
  const def = TOWER_MAP[id]; if (!def) return null;
  const lvl = towerLvl(id); const max = [10, 15, 20, 25, 30, 35][RARITY_IDX[def.rarity]];
  if (lvl >= max) return null;
  const c = { gold: K.towerUpCost(def.rarity, lvl), card: K.towerUpCards(def.rarity, lvl) };
  const m = K.towerUpMineral(def.rarity, lvl); if (m) c.mineral = m;
  return c;
}
export function upgradeTower(id) {
  const cost = towerUpCost(id); if (!cost) return false;
  if (!spendMany(cost)) return false;
  S.towers[id].lvl++;
  bus.emit('collection'); addXp(20); persist();
  return true;
}

export function heroUpCost(id) {
  const lvl = heroLvl(id); if (!lvl || lvl >= 30) return null;
  const c = { gold: K.heroUpCost(lvl) };
  const r = K.heroUpRuby(lvl); if (r) c.ruby = r;
  return c;
}
export function upgradeHero(id) {
  const cost = heroUpCost(id); if (!cost) return false;
  if (!spendMany(cost)) return false;
  S.heroes[id].lvl++;
  bus.emit('collection'); addXp(15); persist();
  return true;
}
export function heroAwakenCost(id) {
  const h = S.heroes[id]; if (!h || h.awaken >= 3) return null;
  return { soul: K.heroAwakenCost(h.awaken + 1), ruby: K.heroAwakenRuby(h.awaken + 1) };
}
export function awakenHero(id) {
  const cost = heroAwakenCost(id); if (!cost) return false;
  if (!spendMany(cost)) return false;
  S.heroes[id].awaken++;
  bus.emit('collection'); addXp(120); persist();
  return true;
}
export function upgradeAbility(id) {
  const a = ABILITIES.find(x => x.id === id); if (!a) return false;
  const lvl = abilityLvl(id); if (lvl >= a.maxLvl) return false;
  if (!abilityUnlocked(id) && lvl === 0) { /* lvl 0 => unlocked automatically at stage; upgrading requires unlock */ }
  if (!spend('magic', K.abilityUpCost(lvl + 1))) return false;
  S.abilities[id].lvl = lvl + 1;
  bus.emit('abilities'); addXp(30); persist();
  return true;
}

// ---------- team ----------
export function setTeamHero(slot, heroId) {
  if (heroId && !ownsHero(heroId)) return false;
  S.team[slot] = heroId;
  // no duplicates
  const seen = new Set();
  S.team = S.team.map(h => { if (!h || seen.has(h)) return null; seen.add(h); return h; });
  bus.emit('team'); persist(); return true;
}
export function autoTeam() {
  const owned = Object.keys(S.heroes)
    .sort((a, b) => (RARITY_IDX[HERO_MAP[b].rarity] - RARITY_IDX[HERO_MAP[a].rarity]) || (S.heroes[b].lvl - S.heroes[a].lvl))
    .slice(0, 3);
  S.team = [owned[0] || null, owned[1] || null, owned[2] || null];
  bus.emit('team'); persist();
}

// ---------- stage progression ----------
export function stageStars(id) { return S.stages[id]?.stars ?? 0; }
export function stageCleared(id) { return !!S.stages[id]?.cleared; }
export function isStageUnlocked(id) {
  if (id <= 1) return true;
  return stageCleared(id - 1) || (S.maxStage >= id);
}
export function regionStars(r) {
  let n = 0;
  for (let i = 0; i < 20; i++) n += stageStars(r * 20 + i + 1);
  return n;
}
export function totalStars() {
  let n = 0; for (const k in S.stages) n += S.stages[k].stars ?? 0;
  return n;
}

export function recordStageWin(stageId, lives, maxLives, payload = {}) {
  const st = S.stages[stageId] || {};
  const first = !st.cleared;
  let stars = 1;
  if (lives >= Math.ceil(maxLives * 0.5)) stars = 2;
  if (lives >= maxLives) stars = 3;
  st.stars = Math.max(st.stars ?? 0, stars);
  st.cleared = true;
  st.bestLives = Math.max(st.bestLives ?? 0, lives);
  S.stages[stageId] = st;
  S.maxStage = Math.max(S.maxStage, stageId + 1);
  S.stats.wins++;
  if (stars === 3) S.stats.perfects++;
  S.stats.starsTotal = totalStars();
  // unlocks
  if (stageId >= 5) S.unlocks.daily = true;
  if (stageId >= 10) S.unlocks.proof = true;
  if (stageId >= 30) S.unlocks.bossrush = true;
  if (stageId >= 15) S.unlocks.sweep = true;
  ingestPayload(payload);
  addXp(30 + stageRegion(stageId) * 12 + stars * 10);
  bus.emit('progress'); persist();
  return { first, stars };
}
export function recordStageLoss(stageId, payload = {}) {
  S.stats.losses++;
  ingestPayload(payload, true);
  addXp(10);
  persist();
}

// generic counters from battle result payloads
function ingestPayload(p, loss = false) {
  const st = S.stats;
  st.kills += p.kills ?? 0;
  st.airKills += p.airKills ?? 0;
  st.eliteKills += p.eliteKills ?? 0;
  st.bossKills += p.bossKills ?? 0;
  st.goldEarned += p.goldEarned ?? 0;
  st.towersBuilt += p.towersBuilt ?? 0;
  st.abilitiesUsed += p.abilitiesUsed ?? 0;
  st.skillsUsed += p.skillsUsed ?? 0;
  st.leaks += p.leaks ?? 0;
  if (!loss) {
    if ((p.leaks ?? 0) === 0) st.noLeakWins++;
    if (p.singleAttr) st.singleAttrWins++;
    if (p.towerTypes && p.towerTypes <= 3) st.threeTypeWins++;
    st.highestWave = Math.max(st.highestWave, p.wave ?? 0);
  }
  trackMissions(p, loss);
  checkAchievements();
}

// ---------- proof / daily / bossrush ----------
export function recordProof(floor, payload = {}) {
  S.proof.runs++;
  if (floor > S.proof.best) { S.proof.best = floor; S.stats.proofBest = floor; }
  ingestPayload(payload);
  addXp(floor * 6);
  persist();
}
export function recordDaily(score, payload = {}) {
  const key = dayKey();
  S.daily.lastKey = key; S.daily.done = true; S.daily.totalRuns++;
  S.stats.dailiesDone++;
  S.daily.bestScore = Math.max(S.daily.bestScore, score);
  if (daysBetween(new Date(S.daily.lastStreakDate || Date.now() - 864e5 * 1.2), new Date()) === 1) S.daily.streak++;
  else S.daily.streak = 1;
  S.daily.lastStreakDate = Date.now();
  ingestPayload(payload);
  addXp(60 + Math.floor(score / 50));
  persist();
}
export function recordBossRush(bossId, won, payload = {}) {
  const b = S.bossrush.done[bossId] || { times: 0, best: 0 };
  if (won) b.times++;
  S.bossrush.done[bossId] = b;
  if (won) { ingestPayload({ ...payload, bossKills: (payload.bossKills ?? 0) + 1 }); addXp(80); }
  persist();
  return won;
}

// ---------- sweep (instant clear using best stars) ----------
export function canSweep(stageId) {
  return S.unlocks.sweep && stageCleared(stageId) && (S.stages[stageId].stars ?? 0) >= 1;
}

// ---------- mail ----------
let mailSeq = 1;
export function mkMail(id, title, text, attach, icon = '✉️', ttlDays = 30) {
  return { id: id + '_' + (mailSeq++), title, text, attach: attach || [], icon, read: false, claimed: false, ts: Date.now(), exp: Date.now() + ttlDays * 864e5 };
}
export function unreadMail() { return S.mail.filter(m => !m.read || (m.attach.length && !m.claimed)).length; }
export function claimMail(mid) {
  const m = S.mail.find(x => x.id === mid);
  if (!m || m.claimed || !m.attach.length) return false;
  m.claimed = true; m.read = true;
  addCurMany(Object.fromEntries(m.attach.map(a => [a.id, a.n])), true);
  bus.emit('mail'); bus.emit('cur'); persist();
  return true;
}
export function claimAllMail() {
  let n = 0;
  S.mail.forEach(m => { if (m.attach.length && !m.claimed) { claimMail(m.id); n++; } });
  return n;
}
export function pruneMail() {
  const now = Date.now();
  const before = S.mail.length;
  S.mail = S.mail.filter(m => m.exp > now && !(m.claimed && now - m.ts > 3 * 864e5));
  if (S.mail.length !== before) persist();
}

// ---------- codex ----------
export function codexUnlock(id) {
  if (!S.codex[id]) { S.codex[id] = true; bus.emit('codex'); persist(); return true; }
  return false;
}

// ============================================================
// MISSIONS
// ============================================================
const DAILY_POOL = [
  { id: 'd_kills', icon: '⚔️', text: { vi: 'Tiêu diệt {n} kẻ địch', en: 'Defeat {n} enemies' }, key: 'kills', goal: [80, 120, 160], reward: [{ id: 'gold', n: 600 }, { id: 'card', n: 1 }] },
  { id: 'd_build', icon: '🔨', text: { vi: 'Xây {n} tháp trong trận', en: 'Build {n} towers in battle' }, key: 'towersBuilt', goal: [12, 16, 22], reward: [{ id: 'gold', n: 500 }, { id: 'mineral', n: 2 }] },
  { id: 'd_stages', icon: '🗺️', text: { vi: 'Hoàn thành {n} ải', en: 'Clear {n} stages' }, key: 'stageWins', goal: [2, 3, 4], reward: [{ id: 'diamond', n: 20 }, { id: 'gold', n: 400 }] },
  { id: 'd_air', icon: '🦅', text: { vi: 'Hạ {n} kẻ địch bay', en: 'Shoot down {n} flyers' }, key: 'airKills', goal: [20, 30, 45], reward: [{ id: 'gold', n: 550 }, { id: 'magic', n: 2 }] },
  { id: 'd_ability', icon: '☄️', text: { vi: 'Dùng {n} kỹ năng toàn cục', en: 'Use {n} global abilities' }, key: 'abilitiesUsed', goal: [4, 6, 9], reward: [{ id: 'magic', n: 3 }, { id: 'gold', n: 300 }] },
  { id: 'd_skill', icon: '🌟', text: { vi: 'Dùng {n} kỹ năng tướng', en: 'Cast {n} hero skills' }, key: 'skillsUsed', goal: [5, 8, 12], reward: [{ id: 'ruby', n: 6 }, { id: 'gold', n: 350 }] },
  { id: 'd_gold', icon: '💰', text: { vi: 'Kiếm {n} vàng trong trận', en: 'Earn {n} battle gold' }, key: 'goldEarned', goal: [3000, 5000, 8000], reward: [{ id: 'gold', n: 700 }, { id: 'card', n: 1 }] },
  { id: 'd_elite', icon: '👑', text: { vi: 'Hạ {n} Tinh Anh hoặc Boss', en: 'Slay {n} Elites or Bosses' }, key: 'eliteKills', goal: [4, 6, 10], reward: [{ id: 'soul', n: 2 }, { id: 'gold', n: 500 }] },
  { id: 'd_summon', icon: '🎴', text: { vi: 'Triệu hồi {n} lần', en: 'Summon {n} times' }, key: 'summons', goal: [2, 3, 5], reward: [{ id: 'card', n: 2 }, { id: 'mileage', n: 10 }] },
  { id: 'd_noleak', icon: '🛡️', text: { vi: 'Thắng {n} trận không thủng lưới', en: 'Win {n} battles without leaks' }, key: 'noLeakWins', goal: [1, 1, 2], reward: [{ id: 'diamond', n: 30 }, { id: 'ruby', n: 5 }] },
];
const WEEKLY_POOL = [
  { id: 'w_kills', icon: '💀', text: { vi: 'Tiêu diệt {n} kẻ địch', en: 'Defeat {n} enemies' }, key: 'kills', goal: [800, 1200], reward: [{ id: 'diamond', n: 120 }, { id: 'card', n: 6 }] },
  { id: 'w_stages', icon: '🚩', text: { vi: 'Hoàn thành {n} ải', en: 'Clear {n} stages' }, key: 'stageWins', goal: [15, 25], reward: [{ id: 'diamond', n: 150 }, { id: 'mineral', n: 10 }] },
  { id: 'w_boss', icon: '🐲', text: { vi: 'Hạ {n} Chúa tể', en: 'Slay {n} Lords' }, key: 'bossKills', goal: [3, 6], reward: [{ id: 'soul', n: 10 }, { id: 'ruby', n: 20 }] },
  { id: 'w_proof', icon: '🗼', text: { vi: 'Đạt sàn {n} Tháp Chứng Ngôn (trong 1 run)', en: 'Reach Tower of Proof floor {n} (single run)' }, key: 'proofFloor', goal: [8, 14], reward: [{ id: 'mileage', n: 80 }, { id: 'magic', n: 8 }] },
  { id: 'w_stars', icon: '⭐', text: { vi: 'Thu thập {n} sao', en: 'Collect {n} stars' }, key: 'starsGained', goal: [10, 18], reward: [{ id: 'diamond', n: 100 }, { id: 'gold', n: 3000 }] },
  { id: 'w_upgrade', icon: '⬆️', text: { vi: 'Nâng cấp {n} lần', en: 'Perform {n} upgrades' }, key: 'upgrades', goal: [6, 10], reward: [{ id: 'mineral', n: 12 }, { id: 'card', n: 4 }] },
];
export const ACHIEVEMENTS = [
  { id: 'a_kill100', icon: '⚔️', text: { vi: 'Tiêu diệt 100 kẻ địch', en: 'Defeat 100 enemies' }, key: 'kills', goal: 100, reward: [{ id: 'gold', n: 500 }] },
  { id: 'a_kill1k', icon: '⚔️', text: { vi: 'Tiêu diệt 1,000 kẻ địch', en: 'Defeat 1,000 enemies' }, key: 'kills', goal: 1000, reward: [{ id: 'diamond', n: 60 }] },
  { id: 'a_kill10k', icon: '💀', text: { vi: 'Tiêu diệt 10,000 kẻ địch', en: 'Defeat 10,000 enemies' }, key: 'kills', goal: 10000, reward: [{ id: 'diamond', n: 300, }, { id: 'soul', n: 20 }] },
  { id: 'a_air500', icon: '🦅', text: { vi: 'Hạ 500 kẻ địch bay', en: 'Down 500 flying enemies' }, key: 'airKills', goal: 500, reward: [{ id: 'magic', n: 12 }] },
  { id: 'a_stage25', icon: '🗺️', text: { vi: 'Vượt ải 25', en: 'Clear stage 25' }, key: 'stage25', goal: 1, reward: [{ id: 'diamond', n: 50 }] },
  { id: 'a_stage100', icon: '🗺️', text: { vi: 'Vượt ải 100', en: 'Clear stage 100' }, key: 'stage100', goal: 1, reward: [{ id: 'diamond', n: 200 }, { id: 'soul', n: 15 }] },
  { id: 'a_stage200', icon: '👑', text: { vi: 'Đánh bại MIDAS — hoàn thành chiến dịch!', en: 'Defeat MIDAS — complete the campaign!' }, key: 'stage200', goal: 1, reward: [{ id: 'diamond', n: 1000 }, { id: 'soul', n: 60 }, { id: 'mileage', n: 500 }] },
  { id: 'a_towers10', icon: '🗼', text: { vi: 'Sở hữu 10 loại tháp', en: 'Own 10 tower types' }, key: 'towersOwned', goal: 10, reward: [{ id: 'card', n: 8 }] },
  { id: 'a_towers20', icon: '🗼', text: { vi: 'Sở hữu toàn bộ 20 tháp', en: 'Own all 20 towers' }, key: 'towersOwned', goal: 20, reward: [{ id: 'diamond', n: 300 }, { id: 'mythicShard', n: 1 }] },
  { id: 'a_heroes6', icon: '🦸', text: { vi: 'Sở hữu 6 anh hùng', en: 'Own 6 heroes' }, key: 'heroesOwned', goal: 6, reward: [{ id: 'ruby', n: 30 }] },
  { id: 'a_heroes13', icon: '🦸', text: { vi: 'Sở hữu toàn bộ 13 anh hùng', en: 'Own all 13 heroes' }, key: 'heroesOwned', goal: 13, reward: [{ id: 'diamond', n: 400 }, { id: 'soul', n: 30 }] },
  { id: 'a_awaken1', icon: '✨', text: { vi: 'Thức tỉnh 1 anh hùng', en: 'Awaken a hero' }, key: 'awakens', goal: 1, reward: [{ id: 'soul', n: 10 }] },
  { id: 'a_mythic1', icon: '🌸', text: { vi: 'Sở hữu 1 tháp Thần Thoại', en: 'Own a Mythic tower' }, key: 'mythicOwned', goal: 1, reward: [{ id: 'diamond', n: 150 }] },
  { id: 'a_proof10', icon: '🗼', text: { vi: 'Tháp Chứng Ngôn: sàn 10', en: 'Tower of Proof: floor 10' }, key: 'proofBest', goal: 10, reward: [{ id: 'mileage', n: 60 }] },
  { id: 'a_proof30', icon: '🗼', text: { vi: 'Tháp Chứng Ngôn: sàn 30', en: 'Tower of Proof: floor 30' }, key: 'proofBest', goal: 30, reward: [{ id: 'mileage', n: 200 }, { id: 'soul', n: 15 }] },
  { id: 'a_daily7', icon: '📅', text: { vi: 'Hoàn thành 7 Thử Thách Ngày', en: 'Complete 7 Daily Challenges' }, key: 'dailiesDone', goal: 7, reward: [{ id: 'diamond', n: 200 }] },
  { id: 'a_perfect10', icon: '⭐', text: { vi: '10 trận thắng HOÀN HẢO (3★)', en: '10 PERFECT (3★) wins' }, key: 'perfects', goal: 10, reward: [{ id: 'diamond', n: 120 }] },
  { id: 'a_noleak25', icon: '🛡️', text: { vi: '25 trận không thủng lưới', en: '25 flawless victories' }, key: 'noLeakWins', goal: 25, reward: [{ id: 'soul', n: 12 }] },
  { id: 'a_singleattr', icon: '🎯', text: { vi: 'Thắng 1 trận Boss chỉ với 1 hệ trên sân', en: 'Win a boss stage with only one attribute deployed' }, key: 'singleAttrWins', goal: 1, reward: [{ id: 'ruby', n: 40 }] },
  { id: 'a_3types', icon: '🧩', text: { vi: 'Thắng với đúng ≤3 loại tháp', en: 'Win using 3 or fewer tower types' }, key: 'threeTypeWins', goal: 3, reward: [{ id: 'mineral', n: 15 }] },
  { id: 'a_gold100k', icon: '💰', text: { vi: 'Kiếm tổng 100,000 vàng trận', en: 'Earn 100,000 total battle gold' }, key: 'goldEarned', goal: 100000, reward: [{ id: 'diamond', n: 100 }] },
  { id: 'a_summon50', icon: '🎴', text: { vi: 'Triệu hồi 50 lần', en: 'Summon 50 times' }, key: 'summons', goal: 50, reward: [{ id: 'mileage', n: 150 }] },
  { id: 'a_meteor100', icon: '☄️', text: { vi: 'Dùng 100 kỹ năng toàn cục', en: 'Use 100 global abilities' }, key: 'abilitiesUsed', goal: 100, reward: [{ id: 'magic', n: 20 }] },
  { id: 'a_stars300', icon: '🌟', text: { vi: 'Thu thập 300 sao', en: 'Collect 300 stars' }, key: 'starsTotal', goal: 300, reward: [{ id: 'diamond', n: 500 }, { id: 'soul', n: 40 }] },
];

function rollMissions(pool, n, seed, tier = 1) {
  const rnd = mulberry32(seed);
  const chosen = [];
  const p = [...pool];
  for (let i = 0; i < n && p.length; i++) chosen.push(p.splice(Math.floor(rnd() * p.length), 1)[0]);
  return chosen.map(m => ({
    id: m.id, key: m.key, icon: m.icon, text: m.text,
    goal: Array.isArray(m.goal) ? m.goal[Math.min(tier - 1, m.goal.length - 1)] : m.goal,
    reward: m.reward, progress: 0, claimed: false,
  }));
}

export function ensureMissions() {
  const dk = dayKey();
  const wk = weekKey();
  if (S.missions.dailyKey !== dk) {
    S.missions.dailyKey = dk;
    S.missions.daily = rollMissions(DAILY_POOL, 4, hashStr(dk + 'd') , 1 + Math.min(2, Math.floor(S.maxStage / 40)));
  }
  if (S.missions.weeklyKey !== wk) {
    S.missions.weeklyKey = wk;
    S.missions.weekly = rollMissions(WEEKLY_POOL, 3, hashStr(wk + 'w'), 1);
  }
}
function weekKey() {
  const d = new Date();
  const jan1 = new Date(d.getFullYear(), 0, 1);
  const w = Math.ceil(((d - jan1) / 864e5 + jan1.getDay() + 1) / 7);
  return `${d.getFullYear()}-w${w}`;
}

// session-scoped counters for mission tracking (reset on load)
const session = { stageWins: 0, summons: 0, upgrades: 0, awakens: 0, starsGained: 0, proofFloor: 0, noLeakWins: 0, singleAttrWins: 0, threeTypeWins: 0, bossKills: 0 };
export function bumpSession(key, n = 1) { session[key] = (session[key] ?? 0) + n; }

function trackMissions(p, loss) {
  if (!loss) session.stageWins += p.stageWins ?? 0;
  session.bossKills += p.bossKills ?? 0;
  if (p.proofFloor) session.proofFloor = Math.max(session.proofFloor, p.proofFloor);
  const ev = {
    kills: p.kills ?? 0, airKills: p.airKills ?? 0, eliteKills: p.eliteKills ?? 0,
    towersBuilt: p.towersBuilt ?? 0, abilitiesUsed: p.abilitiesUsed ?? 0,
    skillsUsed: p.skillsUsed ?? 0, goldEarned: p.goldEarned ?? 0,
    stageWins: session.stageWins, summons: session.summons, bossKills: session.bossKills,
    noLeakWins: (p.leaks === 0 && !loss && p.stageWins) ? 1 : 0, proofFloor: session.proofFloor,
    starsGained: session.starsGained,
  };
  let changed = false;
  [...S.missions.daily, ...S.missions.weekly].forEach(m => {
    const inc = ev[m.key] ?? 0;
    if (inc > 0 && !m.claimed) {
      if (m.key === 'stageWins' || m.key === 'summons' || m.key === 'proofFloor' || m.key === 'starsGained') m.progress = Math.min(m.goal, m.key === 'proofFloor' ? Math.max(m.progress, inc) : m.progress + inc);
      else m.progress = Math.min(m.goal, m.progress + inc);
      changed = true;
    }
  });
  if (changed) { bus.emit('missions'); persist(); }
}

export function claimMission(which, idx) {
  const list = which === 'daily' ? S.missions.daily : S.missions.weekly;
  const m = list[idx];
  if (!m || m.claimed || m.progress < m.goal) return false;
  m.claimed = true;
  addCurMany(Object.fromEntries(m.reward.map(r => [r.id, r.n])), true);
  bus.emit('missions'); bus.emit('cur'); addXp(25); persist();
  return true;
}

function achieveProgress(a) {
  const st = S.stats;
  switch (a.key) {
    case 'kills': return st.kills;
    case 'airKills': return st.airKills;
    case 'stage25': return S.maxStage > 25 ? 1 : 0;
    case 'stage100': return S.maxStage > 100 ? 1 : 0;
    case 'stage200': return stageCleared(200) ? 1 : 0;
    case 'towersOwned': return Object.keys(S.towers).length;
    case 'heroesOwned': return Object.keys(S.heroes).length;
    case 'awakens': return Object.values(S.heroes).filter(h => h.awaken > 0).length;
    case 'mythicOwned': return Object.keys(S.towers).filter(t => TOWER_MAP[t]?.rarity === 'mythic').length;
    case 'proofBest': return S.proof.best;
    case 'dailiesDone': return S.stats.dailiesDone;
    case 'perfects': return st.perfects;
    case 'noLeakWins': return st.noLeakWins;
    case 'singleAttrWins': return st.singleAttrWins;
    case 'threeTypeWins': return st.threeTypeWins;
    case 'goldEarned': return st.goldEarned;
    case 'summons': return st.summons;
    case 'abilitiesUsed': return st.abilitiesUsed;
    case 'starsTotal': return st.starsTotal;
    default: return 0;
  }
}
function checkAchievements() {
  let changed = false;
  ACHIEVEMENTS.forEach(a => {
    const rec = S.missions.achieve[a.id] || { claimed: false, notified: false };
    rec.progress = Math.min(a.goal, achieveProgress(a));
    if (rec.progress >= a.goal && !rec.notified) { rec.notified = true; changed = true; }
    S.missions.achieve[a.id] = rec;
  });
  if (changed) bus.emit('missions');
}
export function claimAchievement(id) {
  const a = ACHIEVEMENTS.find(x => x.id === id);
  const rec = S.missions.achieve[id];
  if (!a || !rec || rec.claimed || rec.progress < a.goal) return false;
  rec.claimed = true;
  addCurMany(Object.fromEntries(a.reward.map(r => [r.id, r.n])), true);
  bus.emit('missions'); bus.emit('cur'); addXp(60); persist();
  return true;
}
export const achieveState = id => S.missions.achieve[id];

// ---------- attendance ----------
export const ATTEND_REWARDS = [
  { day: 1, icon: '💰', cur: 'gold', n: 800 },
  { day: 2, icon: '🎴', cur: 'card', n: 3 },
  { day: 3, icon: '💎', cur: 'diamond', n: 50 },
  { day: 4, icon: '🔮', cur: 'magic', n: 5 },
  { day: 5, icon: '🪙', cur: 'mineral', n: 8 },
  { day: 6, icon: '🔴', cur: 'ruby', n: 15 },
  { day: 7, icon: '🌀', cur: 'soul', n: 10 },
];
export const ATTEND_MILESTONES = [
  { days: 7, icon: '💎', reward: [{ id: 'diamond', n: 150 }, { id: 'card', n: 5 }] },
  { days: 14, icon: '🌀', reward: [{ id: 'soul', n: 25 }, { id: 'mineral', n: 15 }] },
  { days: 30, icon: '👑', reward: [{ id: 'diamond', n: 500 }, { id: 'card', n: 20 }, { id: 'soul', n: 50 }] },
];
export function attendToday() {
  const today = dayKey();
  if (S.attend.lastClaim === today) return null;
  const yesterday = dayKey(new Date(Date.now() - 864e5));
  if (S.attend.lastClaim === yesterday) S.attend.streak++;
  else S.attend.streak = 1;
  S.attend.lastClaim = today;
  S.attend.totalDays++;
  const dayInCycle = ((S.attend.streak - 1) % 7);
  S.attend.cycleClaimed[dayInCycle] = true;
  const rw = ATTEND_REWARDS[dayInCycle];
  addCur(rw.cur, rw.n, true);
  addXp(20);
  bus.emit('attend'); bus.emit('cur'); persist();
  return { rw, streak: S.attend.streak };
}
export function attendClaimable() { return S.attend.lastClaim !== dayKey(); }

// ---------- gacha pity ----------
export function gachaPulls(n, results) {
  S.gacha.total += n;
  bumpSession('summons', n);
  S.stats.summons += n;
  results.forEach(r => {
    if (r.isNew) { /* pity handled by caller via rarity */ }
  });
  bus.emit('missions'); persist();
}

// ---------- daily challenge access ----------
export function todayDaily() {
  const dc = getDailyChallenge();
  return { ...dc, done: S.daily.lastKey === dc.key && S.daily.done };
}

export { session, DAILY_POOL, WEEKLY_POOL };
