// ============================================================
// GTDM tower roster — every tower solves a different problem
// dmg/rate/range are base at meta-lv1; in-battle levels multiply
// ============================================================

// role tags: dps, slow, aoe, air, support, economy, summon, control, dot, buffer, anti-boss
export const TOWERS = [
  {
    id: 'thorn', name: { vi: 'Tháp Gai', en: 'Thorn Tower' }, sprite: 'thorn',
    rarity: 'gray', attr: 'scissors', cost: 60, dmg: 9, rate: 1.4, range: 1.7,
    air: true, roles: ['dot', 'dps'], unlock: 0,
    mech: { bleed: { dps: 5, dur: 2.5, stack: 3 } },
    desc: {
      vi: 'Phóng gai tầm gần gây Chảy Máu (cộng dồn 3 lần). Rẻ, hiệu quả đầu trận, đánh được cả không quân.',
      en: 'Fires close-range barbs that cause Bleed (stacks 3×). Cheap early-game workhorse; hits air.',
    },
  },
  {
    id: 'icearrow', name: { vi: 'Mũi Tên Băng', en: 'Ice Arrow' }, sprite: 'icearrow',
    rarity: 'green', attr: 'paper', cost: 90, dmg: 12, rate: 1.0, range: 2.6,
    air: true, roles: ['slow', 'dps'], unlock: 1,
    mech: { slow: { pct: 0.32, dur: 2.0 } },
    desc: {
      vi: 'Bắn mũi tên băng làm Chậm 32% kẻ địch. Khắc chế quân tốc độ cao.',
      en: 'Chilling arrows Slow enemies by 32%. The classic answer to speed rushes.',
    },
  },
  {
    id: 'shuriken', name: { vi: 'Tháp Phi Tiêu', en: 'Shuriken Tower' }, sprite: 'shuriken',
    rarity: 'gray', attr: 'scissors', cost: 70, dmg: 6, rate: 2.6, range: 2.0,
    air: true, roles: ['dps'], unlock: 0,
    mech: { ricochet: 1 },
    desc: {
      vi: 'Ném phi tiêu cực nhanh, nảy thêm sang 1 mục tiêu lân cận.',
      en: 'Throws shuriken at blistering speed; ricochets to 1 nearby target.',
    },
  },
  {
    id: 'bat', name: { vi: 'Tháp Dơi', en: 'Bat Roost' }, sprite: 'bat',
    rarity: 'gray', attr: 'scissors', cost: 55, dmg: 7, rate: 1.8, range: 2.8,
    air: true, ground: false, roles: ['air', 'dps'], unlock: 2,
    mech: { swarmBurst: 2 },
    desc: {
      vi: 'Thả đàn dơi tấn công CHỈ không quân — rẻ nhất để phòng không.',
      en: 'Releases bats that strike AIR units only — the cheapest anti-air option.',
    },
  },
  {
    id: 'cannon', name: { vi: 'Đại Bác', en: 'Cannon Tower' }, sprite: 'cannon',
    rarity: 'blue', attr: 'rock', cost: 140, dmg: 34, rate: 0.55, range: 2.4,
    air: false, roles: ['aoe', 'dps'], unlock: 3,
    mech: { splash: 0.9 },
    desc: {
      vi: 'Bắn đạn nổ sát thương diện rộng. Không đánh được không quân. Khắc Búa đối phương cực mạnh.',
      en: 'Lobs explosive shells with wide splash. Cannot hit air. Devastating vs clustered ground waves.',
    },
  },
  {
    id: 'magic', name: { vi: 'Tháp Pháp Thuật', en: 'Arcane Spire' }, sprite: 'magic',
    rarity: 'blue', attr: 'paper', cost: 130, dmg: 18, rate: 1.05, range: 2.8,
    air: true, roles: ['dps', 'air'], unlock: 4,
    mech: { trueDmg: 0.6 },
    desc: {
      vi: 'Bắn đạn phép truy đuổi, 60% sát thương bỏ qua giáp. Đánh được không quân.',
      en: 'Homing arcane bolts; 60% of damage ignores armor. Hits air.',
    },
  },
  {
    id: 'barracks', name: { vi: 'Trại Lính', en: 'Barracks' }, sprite: 'barracks',
    rarity: 'green', attr: 'rock', cost: 110, dmg: 8, rate: 1.0, range: 1.6,
    air: false, roles: ['summon', 'control'], unlock: 5,
    mech: { summon: { unit: 'soldier', count: 2, respawn: 9 } },
    desc: {
      vi: 'Sinh 2 lính chặn đường, giữ chân kẻ địch cho hỏa lực bắn. Lính tự hồi sinh.',
      en: 'Deploys 2 soldiers that BLOCK enemies on the path, holding them under your fire. Soldiers respawn.',
    },
  },
  {
    id: 'wolf', name: { vi: 'Hang Sói', en: 'Wolf Den' }, sprite: 'wolf',
    rarity: 'blue', attr: 'scissors', cost: 150, dmg: 0, rate: 1, range: 3.0,
    air: false, roles: ['summon', 'dps'], unlock: 7,
    mech: { summon: { unit: 'wolf', count: 2, respawn: 12, hunt: true } },
    desc: {
      vi: 'Thả 2 con sói chạy dọc đường cắn xé kẻ địch (cắn nhanh, gây Choáng nhẹ).',
      en: 'Unleashes 2 wolves that sprint along the path, savaging enemies (fast bites with a micro-stun).',
    },
  },
  {
    id: 'blossom', name: { vi: 'Hoa Độc', en: 'Blossom Bloom' }, sprite: 'blossom',
    rarity: 'green', attr: 'paper', cost: 100, dmg: 4, rate: 0.7, range: 2.2,
    air: true, roles: ['dot', 'aoe'], unlock: 6,
    mech: { cloud: { dps: 9, radius: 1.15, dur: 4.5 } },
    desc: {
      vi: 'Phun đám mây độc bao phủ một vùng, gây sát thương liên tục lên mọi kẻ địch đi qua (kể cả bay).',
      en: 'Puffs a poison cloud over an area, dealing continuous damage to everything inside — air included.',
    },
  },
  {
    id: 'bamboo', name: { vi: 'Tháp Tre', en: 'Bamboo Kick' }, sprite: 'bamboo',
    rarity: 'blue', attr: 'rock', cost: 120, dmg: 16, rate: 0.9, range: 2.3,
    air: false, roles: ['control'], unlock: 8,
    mech: { knock: { dist: 0.85, stun: 0.45, heavyImmune: true } },
    desc: {
      vi: 'Bắn đốt tre ĐẨY LÙI kẻ địch về phía sau kèm Choáng nhẹ. Vô hiệu với hạng nặng.',
      en: 'Fires bamboo joints that KNOCK enemies backward with a small stun. Heavy units are immune.',
    },
  },
  {
    id: 'nun', name: { vi: 'Nữ Tu', en: 'Sanctum Nun' }, sprite: 'nun',
    rarity: 'green', attr: 'paper', cost: 105, dmg: 0, rate: 0.8, range: 2.4,
    air: false, roles: ['support', 'buffer'], unlock: 9,
    mech: { blessAura: { atkSpd: 0.12, healHero: 6 }, holyBolt: 10 },
    desc: {
      vi: 'Ban phước: +12% tốc đánh cho tháp lân cận, hồi kỹ năng cho tướng gần đó, thi thoảng phóng tia thánh nhỏ.',
      en: 'Blessings: +12% attack speed to nearby towers, slowly recharges deployed heroes\u2019 skills, and flicks small holy bolts.',
    },
  },
  {
    id: 'orchid', name: { vi: 'Phong Lan', en: 'Orchid Muse' }, sprite: 'orchid',
    rarity: 'purple', attr: 'paper', cost: 170, dmg: 8, rate: 0.8, range: 2.2,
    air: true, roles: ['buffer', 'support'], unlock: 12,
    mech: { buffAura: { dmg: 0.18, atkSpd: 0.10, radius: 1.9 } },
    desc: {
      vi: 'Hương lan mê hoặc: +18% sát thương & +10% tốc đánh cho mọi tháp trong bán kính. Trồng cạnh tháp chủ lực!',
      en: 'Intoxicating fragrance: +18% damage & +10% attack speed to all towers in radius. Plant it beside your carries!',
    },
  },
  {
    id: 'assassin', name: { vi: 'Sát Thủ', en: 'Shadow Assassin' }, sprite: 'assassin',
    rarity: 'purple', attr: 'scissors', cost: 210, dmg: 46, rate: 0.5, range: 3.2,
    air: true, roles: ['dps', 'anti-boss'], unlock: 14,
    mech: { crit: { chance: 0.3, mult: 2.6 }, bossBonus: 0.6 },
    desc: {
      vi: 'Ra đòn chí mạng 2.6 lần (30%). +60% sát thương lên Boss/Tinh Anh. Chuyên trị mục tiêu máu trâu.',
      en: 'Strikes from the shadows with 2.6× crits (30%). +60% damage vs Bosses/Elites. The tank-melter.',
    },
  },
  {
    id: 'lightning', name: { vi: 'Tháp Sấm Sét', en: 'Lightning Coil' }, sprite: 'lightning',
    rarity: 'purple', attr: 'paper', cost: 220, dmg: 24, rate: 0.85, range: 2.7,
    air: true, roles: ['aoe', 'air', 'dps'], unlock: 11,
    mech: { chain: { count: 3, falloff: 0.75 } },
    desc: {
      vi: 'Phóng tia điện giật dây chuyền 3 mục tiêu (giảm 25% mỗi lần nhảy). Dọn bầy cực tốt.',
      en: 'Arcs lightning that chains across 3 targets (−25% per jump). Excellent crowd control.',
    },
  },
  {
    id: 'sniper', name: { vi: 'Diều Hâu Bắn Tỉa', en: 'Hawk Sniper' }, sprite: 'sniper',
    rarity: 'legendary', attr: 'scissors', cost: 300, dmg: 95, rate: 0.35, range: 5.2,
    air: true, roles: ['dps', 'air', 'anti-boss'], unlock: 25,
    mech: { pierceArmor: 0.5, airBonus: 0.5, execute: 0.12 },
    desc: {
      vi: 'Tầm bắn toàn bản đồ. Xuyên 50% giáp, +50% lên không quân, KẾT LIỄU mục tiêu dưới 12% máu (không áp dụng Boss).',
      en: 'Map-spanning range. Ignores 50% armor, +50% vs air, and EXECUTES non-boss targets below 12% HP.',
    },
  },
  {
    id: 'chrys', name: { vi: 'Cúc Hoàng Kim', en: 'Chrysanth of Gold' }, sprite: 'chrys',
    rarity: 'legendary', attr: 'rock', cost: 250, dmg: 10, rate: 0.6, range: 2.0,
    air: true, roles: ['economy'], unlock: 20,
    mech: { goldGen: 7, goldPerKillNear: 2 },
    desc: {
      vi: 'Đóa cúc hoàng kim: tự sinh +7 vàng/giây và +2 vàng cho mỗi kill gần đó. Đầu tư sớm, lãi dài lâu.',
      en: 'The golden bloom: generates +7 gold/sec and +2 gold per nearby kill. An investment that pays for itself.',
    },
  },
  {
    id: 'magma', name: { vi: 'Lò Magma', en: 'Magma Forge' }, sprite: 'magma',
    rarity: 'legendary', attr: 'rock', cost: 290, dmg: 30, rate: 0.6, range: 2.5,
    air: false, roles: ['aoe', 'dot'], unlock: 40,
    mech: { lavaPool: { dps: 26, dur: 5, radius: 1.0 } },
    desc: {
      vi: 'Ném bom lửa tạo VỮNG DUNG NHAM cháy 5 giây trên đường — kẻ địch đi qua liên tục bốc cháy.',
      en: 'Hurls firebombs that leave a burning LAVA POOL for 5s — anything walking through keeps cooking.',
    },
  },
  {
    id: 'holynova', name: { vi: 'Tân Tinh Thánh', en: 'Holy Nova' }, sprite: 'holynova',
    rarity: 'mythic', attr: 'paper', cost: 380, dmg: 40, rate: 0.5, range: 2.9,
    air: true, roles: ['aoe', 'support'], unlock: 80,
    mech: { nova: { radius: 2.2, reveal: true, undeadBonus: 1.0 } },
    desc: {
      vi: 'Định kỳ giải phóng vòng sáng thánh: sát thương diện rộng, LỘ DIỆN tàng hình, x2 lên vong hồn.',
      en: 'Periodically erupts a holy ring: wide damage, REVEALS stealth, double damage to undead.',
    },
  },
  {
    id: 'storm', name: { vi: 'Người Gọi Bão', en: 'Stormcaller' }, sprite: 'storm',
    rarity: 'mythic', attr: 'paper', cost: 400, dmg: 55, rate: 0.45, range: 3.4,
    air: true, roles: ['aoe', 'air', 'dps'], unlock: 100,
    mech: { stormStrikes: { count: 3, stunChance: 0.18 } },
    desc: {
      vi: 'Tri hồi 3 cột sét đánh ngẫu nhiên kẻ địch trong tầm, 18% Choáng mỗi tia. Bão tố không chừa một ai.',
      en: 'Calls down 3 random lightning strikes in range; 18% stun each. The storm spares no one.',
    },
  },
  {
    id: 'void', name: { vi: 'Cổng Hư Không', en: 'Void Gate' }, sprite: 'void',
    rarity: 'mythic', attr: 'scissors', cost: 420, dmg: 34, rate: 0.7, range: 2.6,
    air: true, roles: ['control', 'anti-boss'], unlock: 120,
    mech: { pull: { dist: 1.1 }, shred: { pct: 0.25, dur: 4 }, bossBonus: 0.35 },
    desc: {
      vi: 'Xoáy hư không KÉO LÙI kẻ địch và BÀO 25% giáp trong 4 giây. +35% sát thương Boss.',
      en: 'A gravity vortex PULLS enemies backward and SHREDS 25% armor for 4s. +35% damage vs bosses.',
    },
  },
];

export const TOWER_MAP = Object.fromEntries(TOWERS.map(t => [t.id, t]));

// starter towers every player owns
export const STARTER_TOWERS = ['thorn', 'shuriken', 'icearrow', 'bat'];
