// ============================================================
// GTDM hero roster — mobile champions with skills & passives
// ============================================================

export const HEROES = [
  {
    id: 'arthur', name: { vi: 'Arthur Thiết Kỵ', en: 'Arthur Ironhoof' }, sprite: 'arthur',
    rarity: 'blue', attr: 'rock', role: { vi: 'Đấu sĩ cận chiến', en: 'Melee fighter' },
    dmg: 26, rate: 1.1, range: 1.15, melee: true, cleave: 3,
    skill: {
      id: 'shieldbash', icon: '🛡️', cd: 14,
      name: { vi: 'Khiên Chấn', en: 'Shield Bash' },
      desc: { vi: 'Nện khiên xuống đất, làm Choáng mọi kẻ địch xung quanh 2 giây và gây 150% sát thương.', en: 'Slams his shield, Stunning all nearby enemies for 2s and dealing 150% damage.' },
    },
    passive: {
      name: { vi: 'Tường Thành', en: 'Bulwark' },
      desc: { vi: 'Tháp cạnh Arthur (2 ô) +10% sát thương.', en: 'Towers within 2 tiles of Arthur gain +10% damage.' },
    },
    unlock: 'start',
  },
  {
    id: 'luna', name: { vi: 'Luna Nguyệt Ảo', en: 'Luna Moondream' }, sprite: 'luna',
    rarity: 'purple', attr: 'paper', role: { vi: 'Pháp sư kiểm soát', en: 'Control mage' },
    dmg: 30, rate: 0.9, range: 2.9, melee: false,
    skill: {
      id: 'blizzard', icon: '❄️', cd: 17,
      name: { vi: 'Bão Tuyết', en: 'Blizzard' },
      desc: { vi: 'Tạo bão tuyết tại vị trí: Làm Chậm 45% trong 4 giây và gây sát thương băng liên tục.', en: 'Summons a blizzard at her position: 45% Slow for 4s with ticking frost damage.' },
    },
    passive: {
      name: { vi: 'Hàn Khí', en: 'Permafrost' },
      desc: { vi: 'Kẻ địch bị Luna làm chậm nhận thêm 12% sát thương từ mọi nguồn.', en: 'Enemies slowed by Luna take +12% damage from all sources.' },
    },
    unlock: 'stage3',
  },
  {
    id: 'rin', name: { vi: 'Rin Ảnh Nhẫn', en: 'Rin Shadoblade' }, sprite: 'rin',
    rarity: 'green', attr: 'scissors', role: { vi: 'Sát thủ tốc độ', en: 'Speed assassin' },
    dmg: 15, rate: 2.4, range: 1.1, melee: true,
    skill: {
      id: 'shadowstep', icon: '🌀', cd: 12,
      name: { vi: 'Ảnh Bộ Tam Trảm', en: 'Shadow Step' },
      desc: { vi: 'Biến mất, dịch chuyển tới kẻ địch mạnh nhất trong tầm và tung 3 đòn chí mạng 200%.', en: 'Vanishes, teleports to the strongest enemy in range and lands 3 guaranteed 200% crits.' },
    },
    passive: {
      name: { vi: 'Song Hành', en: 'Kindred Edge' },
      desc: { vi: '+12% tốc đánh khi đứng gần một tháp hệ Kéo.', en: '+12% attack speed while near a Scissors tower.' },
    },
    unlock: 'start',
  },
  {
    id: 'marco', name: { vi: 'Tu Sĩ Marco', en: 'Brother Marco' }, sprite: 'marco',
    rarity: 'green', attr: 'paper', role: { vi: 'Hỗ trợ thánh', en: 'Holy support' },
    dmg: 16, rate: 1.0, range: 1.5, melee: true,
    skill: {
      id: 'sanctuary', icon: '✨', cd: 16,
      name: { vi: 'Thánh Vực', en: 'Sanctuary' },
      desc: { vi: 'Vùng thánh quanh Marco 6 giây: tháp +20% tốc đánh, hồi nhanh kỹ năng tướng trong vùng.', en: 'Blessed zone for 6s: towers +20% attack speed and heroes inside recharge skills rapidly.' },
    },
    passive: {
      name: { vi: 'Đức Tin', en: 'Faith' },
      desc: { vi: 'Kéo dài thời gian hiệu ứng của tháp Nữ Tu thêm 30%.', en: 'Extends Sanctum Nun effect duration by 30%.' },
    },
    unlock: 'stage8',
  },
  {
    id: 'sylph', name: { vi: 'Sylph Phong Tiễn', en: 'Sylph Windarrow' }, sprite: 'sylph',
    rarity: 'blue', attr: 'scissors', role: { vi: 'Xạ thủ tầm xa', en: 'Ranger' },
    dmg: 24, rate: 1.3, range: 3.4, melee: false,
    skill: {
      id: 'piercingrain', icon: '🏹', cd: 13,
      name: { vi: 'Mưa Tiễn Xuyên', en: 'Piercing Rain' },
      desc: { vi: 'Bắn 6 mũi tên xuyên thẳng hàng, mỗi mũi 130% sát thương, xuyên mọi giáp.', en: 'Fires 6 arrows in a piercing line, 130% damage each, ignoring all armor.' },
    },
    passive: {
      name: { vi: 'Gió Dẫn', en: 'Windguide' },
      desc: { vi: 'Tháp bắn xa (tầm ≥ 2.5) quanh Sylph +8% tầm bắn.', en: 'Long-range towers (2.5+) near Sylph gain +8% range.' },
    },
    unlock: 'stage12',
  },
  {
    id: 'grimm', name: { vi: 'Grimm Tử Ấn', en: 'Grimm Deathmark' }, sprite: 'grimm',
    rarity: 'purple', attr: 'scissors', role: { vi: 'Săn Boss', en: 'Boss hunter' },
    dmg: 40, rate: 0.9, range: 1.3, melee: true, crit: { chance: 0.25, mult: 2.2 },
    skill: {
      id: 'deathmark', icon: '💀', cd: 15,
      name: { vi: 'Ấn Tử Thần', en: 'Death Mark' },
      desc: { vi: 'Đánh dấu kẻ địch mạnh nhất: nhận +35% sát thương mọi nguồn trong 6 giây. Khắc dấu tử thần.', en: 'Marks the strongest enemy: takes +35% damage from all sources for 6s.' },
    },
    passive: {
      name: { vi: 'Đao Phủ', en: 'Executioner' },
      desc: { vi: '+25% sát thương lên Boss và Tinh Anh.', en: '+25% damage vs Bosses and Elites.' },
    },
    unlock: 'stage25',
  },
  {
    id: 'terra', name: { vi: 'Terra Thạch Mẫu', en: 'Terra Stonemother' }, sprite: 'terra',
    rarity: 'purple', attr: 'rock', role: { vi: 'Triệu hồi sư', en: 'Summoner' },
    dmg: 22, rate: 0.7, range: 2.4, melee: false,
    skill: {
      id: 'golemsummon', icon: '🗿', cd: 18,
      name: { vi: 'Đá Thành Nhân', en: 'Living Boulder' },
      desc: { vi: 'Tri hồi Hộ Vệ Đá chặn đường 14 giây: máu dày, đấm Choáng kẻ địch bị chặn.', en: 'Summons a Stone Guardian that blocks the path for 14s: huge HP, stunning punches.' },
    },
    passive: {
      name: { vi: 'Thạch Giáp', en: 'Granite Blessing' },
      desc: { vi: 'Lính và sói triệu hồi +25% máu và +15% sát thương.', en: 'All summoned soldiers/wolves gain +25% HP and +15% damage.' },
    },
    unlock: 'stage18',
  },
  {
    id: 'aria', name: { vi: 'Aria Chiến Ca', en: 'Aria Warsong' }, sprite: 'aria',
    rarity: 'legendary', attr: 'paper', role: { vi: 'Nhạc công chiến trận', en: 'Battle bard' },
    dmg: 18, rate: 1.2, range: 2.6, melee: false,
    skill: {
      id: 'waranthem', icon: '🎺', cd: 20,
      name: { vi: 'Chiến Ca Hùng Tráng', en: 'War Anthem' },
      desc: { vi: 'Khúc ca toàn bản đồ: MỌI tháp +25% tốc đánh, mọi tướng +25% sát thương trong 7 giây.', en: 'A whole-map song: ALL towers +25% attack speed, ALL heroes +25% damage for 7s.' },
    },
    passive: {
      name: { vi: 'Âm Vang', en: 'Resonance' },
      desc: { vi: 'Mọi tháp trên bản đồ +5% sát thương vĩnh viễn khi Aria ra trận.', en: 'All towers gain a permanent +5% damage while Aria is deployed.' },
    },
    unlock: 'stage45',
  },
  {
    id: 'ember', name: { vi: 'Ember Hỏa Kiếm', en: 'Ember Flamebrand' }, sprite: 'ember',
    rarity: 'legendary', attr: 'rock', role: { vi: 'Kỵ sĩ lửa', en: 'Fire knight' },
    dmg: 44, rate: 0.95, range: 1.25, melee: true, cleave: 2,
    skill: {
      id: 'flamewave', icon: '🔥', cd: 14,
      name: { vi: 'Sóng Lửa Địa Ngục', en: 'Hellfire Wave' },
      desc: { vi: 'Quét kiếm tạo sóng lửa hình quạt: 260% sát thương và Thiêu Đốt 4 giây.', en: 'Sweeps a flaming arc: 260% damage and a 4s Burn.' },
    },
    passive: {
      name: { vi: 'Lan Lửa', en: 'Wildfire' },
      desc: { vi: 'Kẻ địch cháy khi chết sẽ lan Thiêu Đốt sang 1 kẻ gần nhất.', en: 'Burning enemies that die spread Burn to a nearby foe.' },
    },
    unlock: 'stage60',
  },
  {
    id: 'volt', name: { vi: 'Volt Lôi Đồng', en: 'Volt Thunderkin' }, sprite: 'volt',
    rarity: 'blue', attr: 'paper', role: { vi: 'Pháp sư bão', en: 'Storm mage' },
    dmg: 22, rate: 1.0, range: 2.5, melee: false, chain: 2,
    skill: {
      id: 'thunderstorm', icon: '⛈️', cd: 15,
      name: { vi: 'Thiên Lôi Bát Trận', en: 'Thunderstorm' },
      desc: { vi: 'Gọi 9 tia sét giáng xuống vùng kẻ địch dày nhất, mỗi tia 90% sát thương.', en: 'Calls 9 lightning bolts onto the densest enemy cluster, 90% damage each.' },
    },
    passive: {
      name: { vi: 'Dẫn Lôi', en: 'Conductor' },
      desc: { vi: 'Tháp Sấm Sét trong 2.5 ô +1 mục tiêu dây chuyền.', en: 'Lightning Coil towers within 2.5 tiles gain +1 chain target.' },
    },
    unlock: 'stage30',
  },
  {
    id: 'leo', name: { vi: 'Vua Vàng Leo', en: 'Gold King Leo' }, sprite: 'leo',
    rarity: 'legendary', attr: 'rock', role: { vi: 'Kinh tế hoàng gia', en: 'Royal economist' },
    dmg: 30, rate: 0.8, range: 1.4, melee: true,
    skill: {
      id: 'goldfountain', icon: '💰', cd: 16,
      name: { vi: 'Đài Phun Vàng', en: 'Gold Fountain' },
      desc: { vi: 'Phun mưa vàng: nhận ngay 55 + 10×cấp vàng trong trận và +30% vàng rơi 8 giây.', en: 'Rains gold: instantly gain 55 + 10×hero-level battle gold and +30% gold drops for 8s.' },
    },
    passive: {
      name: { vi: 'Thuế Hoàng Gia', en: 'Royal Tax' },
      desc: { vi: '+10% vàng rơi từ kill khi Leo ra trận.', en: '+10% gold from kills while Leo is deployed.' },
    },
    unlock: 'stage35',
  },
  {
    id: 'freya', name: { vi: 'Freya Thánh Dực', en: 'Freya Skyvalkyrie' }, sprite: 'freya',
    rarity: 'mythic', attr: 'rock', role: { vi: 'Nữ thần bay', en: 'Flying valkyrie' },
    dmg: 52, rate: 1.05, range: 1.6, melee: true, flying: true,
    skill: {
      id: 'judgment', icon: '🌟', cd: 18,
      name: { vi: 'Thánh Phạt', en: 'Divine Judgment' },
      desc: { vi: 'Bay lên giáng ngọn giáo phán xét theo đường thẳng: 380% sát thương thánh + Choáng 1.5 giây.', en: 'Soars and drives a judgment spear in a line: 380% holy damage + 1.5s Stun.' },
    },
    passive: {
      name: { vi: 'Thần Uy', en: 'Awe of Gods' },
      desc: { vi: 'Mọi đơn vị hệ Búa của ta +15% sát thương. Freya bay qua mọi địa hình.', en: 'All our Rock units gain +15% damage. Freya flies over any terrain.' },
    },
    unlock: 'stage140',
  },
  {
    id: 'nyx', name: { vi: 'Nyx Hư Ảo', en: 'Nyx Voidqueen' }, sprite: 'nyx',
    rarity: 'mythic', attr: 'scissors', role: { vi: 'Nữ hoàng bóng đêm', en: 'Shadow sovereign' },
    dmg: 46, rate: 1.0, range: 2.7, melee: false,
    skill: {
      id: 'voidzone', icon: '🌑', cd: 19,
      name: { vi: 'Vực Hư Không', en: 'Void Zone' },
      desc: { vi: 'Mở vực tối 5 giây: HÚT kẻ địch vào tâm, gây sát thương liên tục và Làm Chậm 35%.', en: 'Opens a 5s void: PULLS enemies to its center with continuous damage and 35% Slow.' },
    },
    passive: {
      name: { vi: 'Bóng Đêm Nuốt Chửng', en: 'Devouring Dark' },
      desc: { vi: '+20% sát thương lên kẻ địch đang bị Làm Chậm hoặc bị Kéo.', en: '+20% damage vs enemies that are Slowed or Pulled.' },
    },
    unlock: 'stage170',
  },
];

export const HERO_MAP = Object.fromEntries(HEROES.map(h => [h.id, h]));
export const STARTER_HEROES = ['arthur', 'rin'];

// ---------- abilities (global battle spells) ----------
export const ABILITIES = [
  {
    id: 'meteor', icon: '☄️', unlockStage: 5, maxLvl: 10,
    name: { vi: 'Thiên Thạch', en: 'Meteor' },
    desc: { vi: 'Gọi thiên thạch thiêu rụi vùng chọn: 260 + 90/cấp sát thương lửa, Thiêu Đốt 3 giây.', en: 'Calls a meteor on target area: 260 + 90/lvl fire damage with a 3s Burn.' },
    cd: lvl => Math.max(20, 34 - lvl * 1.4),
    dmg: lvl => 260 + lvl * 90,
    radius: 1.7,
  },
  {
    id: 'freeze', icon: '🧊', unlockStage: 15, maxLvl: 10,
    name: { vi: 'Băng Giá', en: 'Freeze' },
    desc: { vi: 'Đóng băng TOÀN BỘ kẻ địch 2.2 + 0.35/cấp giây (Boss kháng 50% thời gian).', en: 'Freezes ALL enemies for 2.2 + 0.35/lvl seconds (Bosses resist 50% duration).' },
    cd: lvl => Math.max(28, 46 - lvl * 1.8),
    dur: lvl => 2.2 + lvl * 0.35,
  },
  {
    id: 'rush', icon: '💰', unlockStage: 30, maxLvl: 10,
    name: { vi: 'Bão Vàng', en: 'Gold Rush' },
    desc: { vi: '12 giây: x2 vàng rơi, +0.15/cấp. Nhận ngay 40 + 20/cấp vàng.', en: 'For 12s: gold drops ×2 (+0.15/lvl), and instantly gain 40 + 20/lvl gold.' },
    cd: lvl => Math.max(30, 50 - lvl * 2),
    mult: lvl => 2 + lvl * 0.15,
    instant: lvl => 40 + lvl * 20,
  },
  {
    id: 'holy', icon: '🌈', unlockStage: 60, maxLvl: 10,
    name: { vi: 'Thánh Quang', en: 'Holy Light' },
    desc: { vi: 'Thánh quang toàn bản đồ: 200 + 70/cấp sát thương thánh, LỘ DIỆN tàng hình, hồi 1 + cấp/5 Máu.', en: 'Map-wide holy burst: 200 + 70/lvl damage, REVEALS stealth, heals 1 + lvl/5 lives.' },
    cd: lvl => Math.max(36, 58 - lvl * 2),
    dmg: lvl => 200 + lvl * 70,
  },
];
export const ABILITY_MAP = Object.fromEntries(ABILITIES.map(a => [a.id, a]));
