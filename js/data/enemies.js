// ============================================================
// GTDM enemies + bosses
// hp/gold are BASE values at first appearance; stages.js scales.
// spd = tiles/sec. dmg = lives lost on leak. armor = flat DR.
// mres = magic resist (0..0.8). Bosses use behavior scripts.
// ============================================================

export const ENEMIES = [
  {
    id: 'goblin', sprite: 'goblin', attr: 'scissors', hp: 42, spd: 1.55, armor: 0, mres: 0, gold: 6, dmg: 1, size: 0.72, region: 0, w: 10,
    name: { vi: 'Yêu Tinh Lục', en: 'Green Goblin' },
    desc: { vi: 'Lính trơn của quân đoàn hắc ám. Đông, yếu, ồn ào.', en: 'Fodder of the dark legion. Numerous, weak, loud.' },
  },
  {
    id: 'wolf', sprite: 'wolf', attr: 'scissors', hp: 34, spd: 2.9, armor: 0, mres: 0, gold: 7, dmg: 1, size: 0.78, region: 0, w: 7,
    name: { vi: 'Sói Hoang', en: 'Feral Wolf' },
    desc: { vi: 'Chạy nhanh gấp đôi yêu tinh. Cần tháp chậm hoặc khống chế.', en: 'Twice as fast as goblins. Needs slows or crowd control.' },
    rush: { cd: 4, dur: 1.2, mult: 1.7 },
  },
  {
    id: 'orc', sprite: 'orc', attr: 'rock', hp: 95, spd: 1.15, armor: 4, mres: 0, gold: 10, dmg: 1, size: 0.95, region: 0, w: 6, heavy: true,
    name: { vi: 'Orc Thiết Giáp', en: 'Iron Orc' },
    desc: { vi: 'Da dày giáp nặng, giảm sát thương vật lý. Sét và phép xuyên tốt hơn.', en: 'Thick hide and heavy plate shrug off physical hits. Lightning and magic cut through.' },
  },
  {
    id: 'shaman', sprite: 'shaman', attr: 'paper', hp: 58, spd: 1.25, armor: 0, mres: 0.2, gold: 12, dmg: 1, size: 0.8, region: 1, w: 4,
    name: { vi: 'Pháp Sư Bộ Lạc', en: 'Tribal Shaman' },
    desc: { vi: 'Hồi máu cho đồng đội xung quanh. Ưu tiên tiêu diệt trước!', en: 'Heals nearby allies over time. Kill it first!' },
    heal: { pct: 0.035, radius: 1.8, cd: 1.4 },
  },
  {
    id: 'harpy', sprite: 'harpy', attr: 'scissors', hp: 48, spd: 2.15, armor: 0, mres: 0, gold: 10, dmg: 1, size: 0.8, region: 1, w: 6, flying: true,
    name: { vi: 'Mỹ Điểu Harpy', en: 'Sky Harpy' },
    desc: { vi: 'Bay lượn bỏ qua lính chặn. Chỉ tháp đánh không mới với tới.', en: 'Flies over blockers. Only anti-air towers can reach it.' },
  },
  {
    id: 'batswarm', sprite: 'batswarm', attr: 'scissors', hp: 22, spd: 3.1, armor: 0, mres: 0, gold: 4, dmg: 1, size: 0.55, region: 1, w: 8, flying: true,
    name: { vi: 'Bầy Dơi', en: 'Bat Swarm' },
    desc: { vi: 'Đàn dơi nhanh như chớp, xuất hiện với số lượng lớn.', en: 'Lightning-fast bats that arrive in swarms.' },
  },
  {
    id: 'golem', sprite: 'golem', attr: 'rock', hp: 280, spd: 0.8, armor: 9, mres: 0.1, gold: 26, dmg: 2, size: 1.15, region: 2, w: 3, heavy: true,
    name: { vi: 'Thạch Nhân', en: 'Stone Golem' },
    desc: { vi: 'Khổng lồ đá chậm chạp. Khi chết VỠ thành 2 mảnh nhỏ hơn.', en: 'A lumbering boulder. On death it SPLITS into two smaller shards.' },
    split: { id: 'rockling', count: 2 },
  },
  {
    id: 'rockling', sprite: 'rockling', attr: 'rock', hp: 74, spd: 1.7, armor: 3, mres: 0, gold: 6, dmg: 1, size: 0.62, region: 2, w: 0, heavy: false,
    name: { vi: 'Mảnh Thạch Nhân', en: 'Rock Shard' },
    desc: { vi: 'Mảnh vỡ của Thạch Nhân, nhanh và hung hăng.', en: 'Golem fragments — quick and angry.' },
  },
  {
    id: 'slime', sprite: 'slime', attr: 'paper', hp: 120, spd: 1.1, armor: 0, mres: 0.35, gold: 12, dmg: 1, size: 0.9, region: 2, w: 5,
    name: { vi: 'Sửu Bào Băng', en: 'Frost Slime' },
    desc: { vi: 'Kháng phép tốt. Chết TÁCH thành 3 giọt nhỏ tốc độ cao.', en: 'Magic-resistant goo. Splits into 3 fast droplets on death.' },
    split: { id: 'minislime', count: 3 },
  },
  {
    id: 'minislime', sprite: 'minislime', attr: 'paper', hp: 32, spd: 2.3, armor: 0, mres: 0.3, gold: 3, dmg: 1, size: 0.5, region: 2, w: 0,
    name: { vi: 'Giọt Sửu', en: 'Slime Drop' },
    desc: { vi: 'Những giọt nhỏ tinh nghịch chạy rất nhanh.', en: 'Giggling droplets that scamper fast.' },
  },
  {
    id: 'wraith', sprite: 'wraith', attr: 'paper', hp: 85, spd: 1.75, armor: 0, mres: 0.25, gold: 14, dmg: 1, size: 0.85, region: 3, w: 5, flying: true, undead: true,
    name: { vi: 'U Hồn', en: 'Wraith' },
    desc: { vi: 'Bay và TÀNG HÌNH theo chu kỳ. Cần Tân Tinh Thánh hoặc kỹ năng LỘ DIỆN.', en: 'Flies and phases INVISIBLE on a cycle. Needs Holy Nova or reveal effects.' },
    stealth: { on: 1.9, off: 2.6 },
  },
  {
    id: 'troll', sprite: 'troll', attr: 'rock', hp: 210, spd: 1.0, armor: 5, mres: 0, gold: 20, dmg: 2, size: 1.05, region: 3, w: 4, heavy: true,
    name: { vi: 'Quỷ Lùn Hồi Sinh', en: 'Regen Troll' },
    desc: { vi: 'Hồi 3% máu mỗi giây. Phải dồn sát thương kết liễu nhanh.', en: 'Regenerates 3% HP per second. Focus fire to burst it down.' },
    regen: 0.03,
  },
  {
    id: 'necro', sprite: 'necro', attr: 'paper', hp: 95, spd: 1.05, armor: 0, mres: 0.2, gold: 16, dmg: 1, size: 0.88, region: 3, w: 3, undead: true,
    name: { vi: 'Chiêu Hồn Sư', en: 'Necromancer' },
    desc: { vi: 'Liên tục triệu hồi bộ xương. Giết sớm trước khi quân số áp đảo.', en: 'Keeps raising skeletons. Kill it before the swarm snowballs.' },
    summon: { id: 'skeleton', cd: 5.5, count: 1, max: 4 },
  },
  {
    id: 'skeleton', sprite: 'skeleton', attr: 'rock', hp: 26, spd: 2.1, armor: 1, mres: 0, gold: 2, dmg: 1, size: 0.62, region: 3, w: 0, undead: true,
    name: { vi: 'Bộ Xương', en: 'Skeleton' },
    desc: { vi: 'Xương sống dậy, chạy nhanh, dễ vỡ.', en: 'Rattling bones — fast and fragile.' },
  },
  {
    id: 'imp', sprite: 'imp', attr: 'scissors', hp: 62, spd: 1.9, armor: 0, mres: 0.1, gold: 11, dmg: 1, size: 0.68, region: 4, w: 5,
    name: { vi: 'Tiểu Quỷ Dịch Chuyển', en: 'Blink Imp' },
    desc: { vi: 'DỊCH CHUYỂN NHÁY về trước mỗi 5 giây. Rất khó trúng.', en: 'BLINKS forward every 5 seconds. Slippery little menace.' },
    blink: { cd: 5, tiles: 1.8 },
  },
  {
    id: 'warlock', sprite: 'warlock', attr: 'paper', hp: 105, spd: 1.1, armor: 0, mres: 0.3, gold: 16, dmg: 1, size: 0.88, region: 4, w: 3,
    name: { vi: 'Warlock Khiên Đen', en: 'Dark Warlock' },
    desc: { vi: 'Phủ khiên hấp thụ cho đồng đội xung quanh (tự hồi sau 4 giây).', en: 'Grants absorbing shields to nearby allies (recharges after 4s).' },
    shieldAura: { amt: 45, radius: 2.0, cd: 5, dur: 4 },
  },
  {
    id: 'wyvern', sprite: 'wyvern', attr: 'rock', hp: 190, spd: 1.55, armor: 6, mres: 0, gold: 24, dmg: 2, size: 1.05, region: 5, w: 4, flying: true, heavy: true,
    name: { vi: 'Rồng Bay Wyvern', en: 'Armored Wyvern' },
    desc: { vi: 'Không quân bọc giáp. Kết hợp tháp băng + sét để hạ.', en: 'Armored air. Pair slows with lightning to bring it down.' },
  },
  {
    id: 'cultist', sprite: 'cultist', attr: 'paper', hp: 72, spd: 1.35, armor: 0, mres: 0.2, gold: 12, dmg: 1, size: 0.8, region: 5, w: 4,
    name: { vi: 'Tà Giáo Đồ', en: 'Cult Acolyte' },
    desc: { vi: 'Hào quang nguyền rủa: tháp gần đó -12% tốc đánh. Diệt sớm!', en: 'Curse aura: nearby towers lose 12% attack speed. Kill quickly!' },
    debuffAura: { atkSpd: -0.12, radius: 2.0 },
  },
  {
    id: 'siege', sprite: 'siege', attr: 'rock', hp: 320, spd: 0.7, armor: 13, mres: 0, gold: 30, dmg: 3, size: 1.2, region: 6, w: 2, heavy: true,
    name: { vi: 'Xe Công Thành', en: 'Siege Breaker' },
    desc: { vi: 'Nện búa khi đi ngang: VÔ HIỆU HÓA tháp gần đường chốc lát.', en: 'Hammers as it rolls: periodically DISABLES a tower next to the path.' },
    smash: { cd: 7, dur: 3 },
  },
  {
    id: 'darkblade', sprite: 'darkblade', attr: 'scissors', hp: 96, spd: 2.5, armor: 2, mres: 0, gold: 15, dmg: 1, size: 0.82, region: 6, w: 4,
    name: { vi: 'Hắc Kiếm Sĩ', en: 'Darkblade' },
    desc: { vi: 'Nhanh, né 25% đạn bắn, ưu tiên hạ lính chặn đường.', en: 'Fast, dodges 25% of projectiles, and hunts your blockers first.' },
    dodge: 0.25, huntBlockers: true,
  },
  {
    id: 'shieldbearer', sprite: 'shieldbearer', attr: 'rock', hp: 250, spd: 1.0, armor: 6, mres: 0, gold: 26, dmg: 2, size: 1.0, region: 7, w: 3, heavy: true,
    name: { vi: 'Vệ Binh Khiên', en: 'Shieldbearer' },
    desc: { vi: 'Khiên lớn hấp thụ 110 sát thương, tự hồi sau 4 giây không trúng đòn.', en: 'A greatshield absorbs 110 damage, recharging 4s after the last hit.' },
    shield: { amt: 110, regenAfter: 4 },
  },
  {
    id: 'voidling', sprite: 'voidling', attr: 'paper', hp: 130, spd: 1.85, armor: 0, mres: 0.35, gold: 18, dmg: 1, size: 0.8, region: 8, w: 5, flying: true,
    name: { vi: 'Hư Không Tinh', en: 'Voidling' },
    desc: { vi: 'Bay, kháng phép, dịch chuyển ngắn khi bị dồn sát thương.', en: 'Flies, resists magic, and blinks away when burst.' },
    blink: { cd: 6, tiles: 1.4 }, panicBlink: true,
  },
  {
    id: 'prism', sprite: 'prism', attr: 'rock', hp: 220, spd: 1.2, armor: 5, mres: 0.2, gold: 28, dmg: 2, size: 0.95, region: 9, w: 4,
    name: { vi: 'Lăng Kính Đổi Hệ', en: 'Prism Shifter' },
    desc: { vi: 'ĐỔI HỆ mỗi 5 giây (Kéo→Búa→Lá). Đọc màu trước khi bắn!', en: 'SHIFTS attribute every 5s (Scissors→Rock→Paper). Read the color before you commit!' },
    attrShift: { cd: 5 },
  },
  {
    id: 'obelisk', sprite: 'obelisk', attr: 'rock', hp: 420, spd: 0, armor: 8, mres: 0.4, gold: 15, dmg: 0, size: 1.0, region: 1, w: 0, still: true,
    name: { vi: 'Phương Ấn Bảo Hộ', en: 'Ward Obelisk' },
    desc: { vi: 'Cọc bảo vệ chúa tể. Còn sống thì boss giảm 70% sát thương nhận vào.', en: 'Protective ward. While standing, its lord takes 70% less damage.' },
  },
];
export const ENEMY_MAP = Object.fromEntries(ENEMIES.map(e => [e.id, e]));

// ============================================================
// BOSSES — 2 lords per region (stage 10 mini-lord, stage 20 lord)
// behaviors are interpreted by the battle engine.
// ============================================================
export const BOSSES = [
  { // R1 mini
    id: 'grulk', slot: 'mini', region: 0, sprite: 'boss_grulk', attr: 'rock', size: 1.5,
    name: { vi: 'Grulk Trư Cuồng', en: 'Grulk the Warhog' }, title: { vi: 'Tướng Lĩnh Heo Rừng', en: 'Warhog Chieftain' },
    hp: 6500, spd: 1.0, armor: 4, mres: 0.1, dmg: 5, gold: 220, heavy: true,
    desc: { vi: 'Con heo rừng khổng lồ nện móng giận dữ. Càng bị đánh đau càng nổi điên.', en: 'A colossal warhog that stomps in fury. Hurting it only makes it angrier.' },
    phases: [{ at: 1 }, { at: 0.5, enrage: 1.45 }],
    behaviors: [
      { type: 'summon', cd: 9, id: 'goblin', count: 2, after: 5 },
      { type: 'charge', cd: 7.5, dur: 1.1, mult: 2.7 },
      { type: 'stomp', cd: 6, dur: 1.0 }, // stuns blockers nearby
    ],
  },
  { // R1 lord
    id: 'ironback', slot: 'lord', region: 0, sprite: 'boss_ironback', attr: 'scissors', size: 1.65,
    name: { vi: 'Ironback Gai Sắt', en: 'Ironback Alpha' }, title: { vi: 'Chúa Tể Bầy Đàn', en: 'Lord of the Pack' },
    hp: 16000, spd: 1.15, armor: 6, mres: 0.1, dmg: 8, gold: 450, heavy: true,
    desc: { vi: 'Alpha của mọi bầy sói, gai sắt phủ lưng. Gọi bầy, lao xé đội hình.', en: 'Alpha of all wolves, iron spines along its back. Calls the pack and charges through formations.' },
    phases: [{ at: 1 }, { at: 0.6, enrage: 1.3 }, { at: 0.3, enrage: 1.6 }],
    behaviors: [
      { type: 'summon', cd: 8, id: 'wolf', count: 2, after: 4 },
      { type: 'charge', cd: 7, dur: 1.2, mult: 3.0 },
      { type: 'howl', cd: 14, dur: 5, mult: 1.25 }, // buffs all enemies speed
    ],
  },
  { // R2 mini
    id: 'vizier', slot: 'mini', region: 1, sprite: 'boss_vizier', attr: 'scissors', size: 1.5,
    name: { vi: 'Vizier Bò Cạp', en: 'Scorpion Vizier' }, title: { vi: 'Tể Tướng Sa Mạc', en: 'Desert Chancellor' },
    hp: 13500, spd: 1.05, armor: 5, mres: 0.15, dmg: 5, gold: 380, heavy: true,
    desc: { vi: 'Tể tướng sa mạc, đuôi tẩm độc xanh. Phun độc làm tháp tê liệt tạm thời.', en: 'Venom-tailed desert chancellor. Its toxin spray paralyzes towers briefly.' },
    phases: [{ at: 1 }, { at: 0.5, enrage: 1.35 }],
    behaviors: [
      { type: 'poisonTower', cd: 9, count: 1, dur: 4.5, after: 6 },
      { type: 'summon', cd: 10, id: 'batswarm', count: 3, after: 8 },
    ],
  },
  { // R2 lord
    id: 'amenhotep', slot: 'lord', region: 1, sprite: 'boss_amenhotep', attr: 'rock', size: 1.7,
    name: { vi: 'Amenhotep Hắc Ám', en: 'Dark Amenhotep' }, title: { vi: 'Pharaoh Bất Tử', en: 'The Undying Pharaoh' },
    hp: 30000, spd: 0.95, armor: 9, mres: 0.2, dmg: 8, gold: 700, heavy: true, undead: true,
    desc: { vi: 'Pharaoh cổ đại đội vương miện đen. Dựng Phương Ấn để tự che chở — phá cọc trước!',
      en: 'An ancient pharaoh in a black crown. Raises Ward Obelisks to shield itself — break the wards first!' },
    phases: [{ at: 1 }, { at: 0.55, enrage: 1.3 }],
    behaviors: [
      { type: 'obelisks', cd: 17, id: 'obelisk', count: 2, reduction: 0.7, after: 7 },
      { type: 'summon', cd: 7, id: 'skeleton', count: 2, after: 5 },
      { type: 'summon', cd: 26, id: 'shaman', count: 1, after: 16 },
    ],
  },
  { // R3 mini
    id: 'yeti', slot: 'mini', region: 2, sprite: 'boss_yeti', attr: 'rock', size: 1.6,
    name: { vi: 'Yeti Răng Băng', en: 'Frostfang Yeti' }, title: { vi: 'Khổng Nhân Tuyết', en: 'The Snow Giant' },
    hp: 24000, spd: 1.0, armor: 8, mres: 0.15, dmg: 6, gold: 560, heavy: true,
    desc: { vi: 'Người tuyết khổng lồ đóng băng cả tháp pháo. Đấm đất rung chuyển chiến trường.', en: 'A towering yeti that flash-freezes your towers. Its ground punches shake the battlefield.' },
    phases: [{ at: 1 }, { at: 0.5, enrage: 1.4 }],
    behaviors: [
      { type: 'freezeSlots', cd: 12, count: 2, dur: 4, after: 6 },
      { type: 'stomp', cd: 8, dur: 1.2 },
    ],
  },
  { // R3 lord
    id: 'siva', slot: 'lord', region: 2, sprite: 'boss_siva', attr: 'paper', size: 1.65,
    name: { vi: 'Nữ Hoàng Siva', en: 'Glacier Queen Siva' }, title: { vi: 'Băng Mẫu Vĩnh Cửu', en: 'Mother of Eternal Ice' },
    hp: 52000, spd: 1.05, armor: 10, mres: 0.25, dmg: 8, gold: 1000, heavy: false, flying: true,
    desc: { vi: 'Nữ hoàng băng giá bay trên chiến trường. Bão tuyết của bà làm chậm mọi tháp và biến đường thành sân băng.',
      en: 'The ice queen glides above the field. Her blizzards slow every tower and turn the path into a skating rink.' },
    phases: [{ at: 1 }, { at: 0.6, enrage: 1.25 }, { at: 0.3, enrage: 1.5 }],
    behaviors: [
      { type: 'slowTowers', cd: 15, dur: 6, pct: 0.3, after: 8 },
      { type: 'icepath', cd: 20, dur: 8, mult: 1.3, after: 12 }, // all enemies speed up
      { type: 'summon', cd: 9, id: 'harpy', count: 2, after: 6 },
      { type: 'freezeSlots', cd: 14, count: 2, dur: 3.5, after: 10 },
    ],
  },
  { // R4 mini
    id: 'treant', slot: 'mini', region: 3, sprite: 'boss_treant', attr: 'rock', size: 1.7,
    name: { vi: 'Cổ Thụ Thức Tỉnh', en: 'Ancient Treant' }, title: { vi: 'Người Canh Rừng', en: 'Warden of the Woods' },
    hp: 42000, spd: 0.85, armor: 11, mres: 0.1, dmg: 6, gold: 850, heavy: true,
    desc: { vi: 'Cây cổ thụ biết đi, tự hồi sinh mạnh mẽ. Rễ của nó trói chặt tháp pháo. Khi ngã xuống sẽ tách làm đôi.',
      en: 'A walking ancient tree with powerful regeneration. Its roots snare towers, and it splits in two when felled.' },
    phases: [{ at: 1 }],
    behaviors: [
      { type: 'regen', pct: 0.018 },
      { type: 'root', cd: 11, dur: 6, after: 5 }, // disables top-dps tower
      { type: 'splitPhase', at: 0, into: { id: 'treantling', count: 2, hp: 14000 } },
    ],
  },
  { // R4 lord
    id: 'morgana', slot: 'lord', region: 3, sprite: 'boss_morgana', attr: 'paper', size: 1.55,
    name: { vi: 'Phù Thủy Morgana', en: 'Verdant Witch Morgana' }, title: { vi: 'Nữ Chúa Rừng Xanh', en: 'Mistress of the Green' },
    hp: 88000, spd: 1.1, armor: 8, mres: 0.35, dmg: 8, gold: 1500,
    desc: { vi: 'Mụ phù thủy rừng xanh hóa phép tháp mạnh nhất của ngươi thành ếch. Độc của mụ nuôi sống mụ.',
      en: 'The forest witch hexes your strongest tower into a frog. Your own kill pressure feeds her rituals.' },
    phases: [{ at: 1 }, { at: 0.5, enrage: 1.3 }],
    behaviors: [
      { type: 'hex', cd: 15, dur: 7, after: 7 },
      { type: 'healAllies', cd: 11, pct: 0.06, after: 10 },
      { type: 'summon', cd: 9, id: 'slime', count: 2, after: 5 },
      { type: 'poisonTower', cd: 8, count: 2, dur: 3.5, after: 12 },
    ],
  },
  { // R5 mini
    id: 'hydra', slot: 'mini', region: 4, sprite: 'boss_hydra', attr: 'paper', size: 1.75,
    name: { vi: 'Hydra Vực Sâu', en: 'Hydra of the Deep' }, title: { vi: 'Đa Đầu Xà', en: 'The Many-Headed' },
    hp: 72000, spd: 0.95, armor: 9, mres: 0.25, dmg: 7, gold: 1300, heavy: true,
    desc: { vi: 'Chặt một đầu, hai đầu khác mọc lên. Cắt đầu nó ở mốc 55% và 25% máu.',
      en: 'Cut one head, two take its place. It splinters at 55% and 25% HP.' },
    phases: [{ at: 1 }, { at: 0.55, enrage: 1.15 }, { at: 0.25, enrage: 1.3 }],
    behaviors: [
      { type: 'splitPhase', at: 0.55, into: { id: 'hydrahead', count: 2, hp: 15000 } },
      { type: 'splitPhase', at: 0.25, into: { id: 'hydrahead', count: 2, hp: 9000 } },
      { type: 'acid', cd: 10, count: 1, dur: 3, after: 6 }, // disables a tower
    ],
  },
  { // R5 lord
    id: 'kraken', slot: 'lord', region: 4, sprite: 'boss_kraken', attr: 'rock', size: 1.9,
    name: { vi: 'Kraken Chúa Vực', en: 'Kraken Lord' }, title: { vi: 'Kinh Hoàng Đầm Lầy', en: 'Terror of the Deep Mire' },
    hp: 145000, spd: 0.9, armor: 12, mres: 0.3, dmg: 10, gold: 2400, heavy: true,
    desc: { vi: 'Quái vật đầm lầy với xúc tu khổng lồ: nghiền tháp, bắt tướng, mở vực triệu quân từ hư không.',
      en: 'A mire monster with colossal tentacles: it crushes towers, snatches heroes, and opens rifts to summon reinforcements.' },
    phases: [{ at: 1 }, { at: 0.6, enrage: 1.25 }, { at: 0.3, enrage: 1.5 }],
    behaviors: [
      { type: 'grabHero', cd: 13, dur: 5, after: 8 },
      { type: 'meteorSlots', cd: 16, count: 3, dur: 4, after: 10 },
      { type: 'rift', cd: 22, dur: 14, id: 'cultist', after: 14 },
      { type: 'summon', cd: 10, id: 'imp', count: 2, after: 6 },
    ],
  },
  { // R6 mini
    id: 'colossus', slot: 'mini', region: 5, sprite: 'boss_colossus', attr: 'rock', size: 1.8,
    name: { vi: 'Khổng Lồi Magma', en: 'Magma Colossus' }, title: { vi: 'Trái Tim Núi Lửa', en: 'Heart of the Volcano' },
    hp: 120000, spd: 0.8, armor: 14, mres: 0.15, dmg: 7, gold: 2100, heavy: true,
    desc: { vi: 'Người đá dung nham nóng chảy. Giáp dày khủng khiếp — cần sát thương phép/xuyên giáp. Khi chết nổ kho vàng!',
      en: 'Molten stone giant with terrifying armor — bring magic or armor-pierce. Its death bursts a golden core!' },
    phases: [{ at: 1 }, { at: 0.4, enrage: 1.5 }],
    behaviors: [
      { type: 'summon', cd: 9, id: 'imp', count: 2, after: 5 },
      { type: 'deathGold', gold: 260 },
    ],
  },
  { // R6 lord
    id: 'phoenix', slot: 'lord', region: 5, sprite: 'boss_phoenix', attr: 'paper', size: 1.8,
    name: { vi: 'Hoàng Đế Phượng Hoàng', en: 'Phoenix Emperor' }, title: { vi: 'Tái Sinh Trong Lửa', en: 'Reborn in Flame' },
    hp: 130000, spd: 1.25, armor: 10, mres: 0.35, dmg: 10, gold: 3600, flying: true,
    desc: { vi: 'Chúa phượng hoàng bay rực lửa. Chết đi sống lại HAI LẦN, mỗi lần nhanh hơn và dữ hơn. Thiên thạch lửa nã xuống tháp.',
      en: 'The blazing sky-lord. It dies and REVIVES TWICE, each time faster and fiercer, raining meteors on your towers.' },
    phases: [{ at: 1 }, { at: 0.5, enrage: 1.2 }],
    behaviors: [
      { type: 'revive', count: 2, hpPct: 0.45, spdAdd: 0.25, after: 0 },
      { type: 'meteorSlots', cd: 14, count: 2, dur: 4.5, after: 8 },
      { type: 'summon', cd: 12, id: 'wyvern', count: 1, after: 20 },
    ],
  },
  { // R7 mini
    id: 'roc', slot: 'mini', region: 6, sprite: 'boss_roc', attr: 'scissors', size: 1.85,
    name: { vi: 'Lôi Điểu Roc', en: 'Thunder Roc' }, title: { vi: 'Bão Cánh Sấm', en: 'Storm of Wings' },
    hp: 190000, spd: 1.35, armor: 8, mres: 0.2, dmg: 8, gold: 3200, flying: true,
    desc: { vi: 'Chim thần sấm sét BAY lượn — đại bác vô dụng! Sét của nó giáng xuống làm tê liệt tháp.',
      en: 'A FLYING thunder-god bird — cannons are useless here! Its lightning paralyzes towers.' },
    phases: [{ at: 1 }, { at: 0.5, enrage: 1.4 }],
    behaviors: [
      { type: 'summon', cd: 10, id: 'batswarm', count: 4, after: 5 },
      { type: 'meteorSlots', cd: 11, count: 1, dur: 3.5, after: 7, fx: 'lightning' },
    ],
  },
  { // R7 lord
    id: 'malakar', slot: 'lord', region: 6, sprite: 'boss_malakar', attr: 'paper', size: 1.8,
    name: { vi: 'Malakar Sa Ngã', en: 'Malakar the Fallen' }, title: { vi: 'Thiên Thần Hắc Ám', en: 'The Dark Seraph' },
    hp: 380000, spd: 1.2, armor: 11, mres: 0.3, dmg: 12, gold: 5200, flying: true, undead: true,
    desc: { vi: 'Thiên thần sáu cánh đen tự hồi sinh bằng thánh hỏa hắc ám. Tia phán xét vô hiệu hóa cả dãy tháp.',
      en: 'A six-winged fallen angel that mends itself with dark fire. Its judgment beams disable whole rows of towers.' },
    phases: [{ at: 1 }, { at: 0.6, enrage: 1.2 }, { at: 0.3, enrage: 1.45 }],
    behaviors: [
      { type: 'healSelf', cd: 12, pct: 0.07, after: 8 },
      { type: 'summon', cd: 11, id: 'wyvern', count: 1, after: 6 },
      { type: 'summon', cd: 16, id: 'harpy', count: 2, after: 10 },
      { type: 'meteorSlots', cd: 13, count: 3, dur: 5, after: 12, fx: 'holy' },
    ],
  },
  { // R8 mini
    id: 'reaper', slot: 'mini', region: 7, sprite: 'boss_reaper', attr: 'scissors', size: 1.7,
    name: { vi: 'Tử Thần Bóng Ảnh', en: 'Shadow Reaper' }, title: { vi: 'Lưỡi Hái Hư Vô', en: 'The Null Scythe' },
    hp: 300000, spd: 1.3, armor: 9, mres: 0.3, dmg: 10, gold: 4600, undead: true,
    desc: { vi: 'Biến mất vào bóng tối, gặt linh hồn lính của ngươi. Chỉ hiện ra trong chớp mắt — hãy canh thời điểm.',
      en: 'Vanishes into shadow and reaps your summons. It surfaces only in flickers — time your bursts.' },
    phases: [{ at: 1 }, { at: 0.5, enrage: 1.4 }],
    behaviors: [
      { type: 'stealth', cd: 10, dur: 2.6, after: 6 },
      { type: 'summon', cd: 9, id: 'wraith', count: 2, after: 5 },
      { type: 'reap', cd: 8, after: 10 }, // instantly kills a summon
    ],
  },
  { // R8 lord
    id: 'leviathan', slot: 'lord', region: 7, sprite: 'boss_leviathan', attr: 'rock', size: 2.0,
    name: { vi: 'Leviathan Hư Không', en: 'Void Leviathan' }, title: { vi: 'Kẻ Nuốt Chửng Thế Giới', en: 'World-Devourer' },
    hp: 600000, spd: 0.95, armor: 14, mres: 0.35, dmg: 14, gold: 7500, heavy: true,
    desc: { vi: 'Quái vật hư không XUYÊN KHÔNG GIAN nhảy cóc về trước. Vực của nó phun trào quân đoàn bóng tối.',
      en: 'A spatial horror that WARPS forward, skipping the path. Its rifts vomit legions of shadow.' },
    phases: [{ at: 1 }, { at: 0.6, enrage: 1.25 }, { at: 0.3, enrage: 1.5 }],
    behaviors: [
      { type: 'teleport', cd: 15, tiles: 2.6, after: 9 },
      { type: 'rift', cd: 18, dur: 12, id: 'voidling', after: 8 },
      { type: 'reap', cd: 9, after: 12 },
      { type: 'summon', cd: 12, id: 'darkblade', count: 2, after: 14 },
    ],
  },
  { // R9 mini
    id: 'runeprime', slot: 'mini', region: 8, sprite: 'boss_runeprime', attr: 'rock', size: 1.75,
    name: { vi: 'Cự Cấu Rune', en: 'Rune Construct Prime' }, title: { vi: 'Cỗ Máy Cổ Ngữ', en: 'The Glyph Engine' },
    hp: 480000, spd: 1.0, armor: 16, mres: 0.3, dmg: 12, gold: 7000, heavy: true,
    desc: { vi: 'Cỗ máy rune ĐỔI HỆ liên tục Kéo→Búa→Lá. Khiên rune giảm nửa sát thương — đánh vào lúc khiên tắt!',
      en: 'A glyph engine that CYCLES Scissors→Rock→Paper. Its rune shield halves damage — strike when it drops!' },
    phases: [{ at: 1 }, { at: 0.5, enrage: 1.3 }],
    behaviors: [
      { type: 'attrShift', cd: 8, after: 3 },
      { type: 'shield', cd: 13, dur: 4.5, reduction: 0.5, after: 6 },
      { type: 'summon', cd: 11, id: 'prism', count: 1, after: 10 },
    ],
  },
  { // R9 lord
    id: 'solus', slot: 'lord', region: 8, sprite: 'boss_solus', attr: 'paper', size: 1.7,
    name: { vi: 'Đại Pháp Sư Solus', en: 'Archmage Eternal Solus' }, title: { vi: 'Kẻ Vượt Thời Gian', en: 'He Who Outlived Time' },
    hp: 950000, spd: 1.1, armor: 12, mres: 0.4, dmg: 14, gold: 11000,
    desc: { vi: 'Pháp sư tối thượng bẻ cong thời gian: tăng tốc toàn quân, biến tháp thành cừu, và tự tách thành ảo ảnh.',
      en: 'The supreme mage bends time: hastening his army, polymorphing towers into sheep, and splitting into mirages.' },
    phases: [{ at: 1 }, { at: 0.6, enrage: 1.2 }, { at: 0.3, enrage: 1.4 }],
    behaviors: [
      { type: 'timewarp', cd: 17, dur: 7, pct: 0.4, after: 7 },
      { type: 'hex', cd: 14, dur: 6, fx: 'sheep', after: 10 },
      { type: 'cloneIllusion', at: 0.5, id: 'solusmirage', count: 2, hp: 90000 },
      { type: 'summon', cd: 12, id: 'prism', count: 1, after: 6 },
    ],
  },
  { // R10 mini
    id: 'aurelion', slot: 'mini', region: 9, sprite: 'boss_aurelion', attr: 'rock', size: 1.7,
    name: { vi: 'Kỵ Sĩ Aurelion', en: 'Golden Champion Aurelion' }, title: { vi: 'Vệ Thần Hoàng Kim', en: 'Champion of the Gilded Throne' },
    hp: 800000, spd: 1.15, armor: 15, mres: 0.35, dmg: 14, gold: 10000, heavy: true,
    desc: { vi: 'Nhà vô địch hoàng kim. Giáp hắn rơi ra VÀNG khi bị đánh — vừa đau ví vừa đau đầu. Khiên vàng bất khả xâm phạm định kỳ.',
      en: 'The gilded champion. His armor flakes into GOLD when struck — a bounty and a burden. Periodic invulnerable golden shields.' },
    phases: [{ at: 1 }, { at: 0.5, enrage: 1.4 }],
    behaviors: [
      { type: 'goldOnHit', chance: 0.06, gold: 8 },
      { type: 'shield', cd: 12, dur: 2.6, reduction: 1.0, after: 8 },
      { type: 'summon', cd: 10, id: 'shieldbearer', count: 1, after: 6 },
    ],
  },
  { // R10 lord — FINAL
    id: 'midas', slot: 'lord', region: 9, sprite: 'boss_midas', attr: 'rock', size: 2.1,
    name: { vi: 'MIDAS Chúa Tể Hắc Ám', en: 'MIDAS, the Dark Sovereign' }, title: { vi: 'Bàn Tay Vàng Nhuốm Máu', en: 'The Blood-Golden Touch' },
    hp: 1600000, spd: 1.05, armor: 16, mres: 0.35, dmg: 20, gold: 25000, heavy: true,
    desc: { vi: 'Chúa tể của mọi chúa tể. Ba giai đoạn: Bàn Tay Vàng hóa đá tháp pháo → Triệu hồi vong linh các chúa tể đã ngã → Cuồng nộ đen tối với mưa thiên thạch.',
      en: 'The lord above all lords. Three phases: the Golden Touch petrifies towers → Echoes of fallen lords rise → Dark rage with meteor rain.' },
    phases: [{ at: 1 }, { at: 0.66, enrage: 1.15 }, { at: 0.33, enrage: 1.45 }],
    behaviors: [
      { type: 'goldTouch', cd: 14, count: 2, dur: 6, after: 6, phase3: { count: 3 } },
      { type: 'echoes', at: 0.66, count: 4 }, // summons mini-boss echoes as elites
      { type: 'shield', cd: 16, dur: 3, reduction: 0.8, after: 12 },
      { type: 'meteorSlots', cd: 12, count: 3, dur: 4.5, after: 8, onlyPhase: 3 },
      { type: 'regen', pct: 0.004, onlyPhase: 3 },
      { type: 'summon', cd: 11, id: 'shieldbearer', count: 1, after: 5 },
    ],
  },
];
export const BOSS_MAP = Object.fromEntries(BOSSES.map(b => [b.id, b]));

// special summoned units used by bosses (defined as enemies)
export const EXTRA_UNITS = [
  {
    id: 'treantling', sprite: 'treantling', attr: 'rock', hp: 14000, spd: 1.3, armor: 6, mres: 0.1, gold: 120, dmg: 3, size: 1.0, region: 3, w: 0,
    name: { vi: 'Mầm Cổ Thụ', en: 'Treant Sapling' }, desc: { vi: 'Mảnh sống của Cổ Thụ.', en: 'A living shard of the Ancient.' },
    regen: 0.01,
  },
  {
    id: 'hydrahead', sprite: 'hydrahead', attr: 'paper', hp: 15000, spd: 1.5, armor: 4, mres: 0.2, gold: 150, dmg: 3, size: 1.05, region: 4, w: 0,
    name: { vi: 'Đầu Hydra', en: 'Hydra Head' }, desc: { vi: 'Một cái đầu rắn khổng lồ tách ra.', en: 'A severed head that keeps biting.' },
  },
  {
    id: 'solusmirage', sprite: 'solusmirage', attr: 'paper', hp: 90000, spd: 1.4, armor: 6, mres: 0.4, gold: 400, dmg: 6, size: 1.4, region: 8, w: 0,
    name: { vi: 'Ảo Ảnh Solus', en: 'Solus Mirage' }, desc: { vi: 'Bản sao ảo của Đại Pháp Sư.', en: 'A shimmering duplicate of the Archmage.' },
  },
];
EXTRA_UNITS.forEach(u => ENEMY_MAP[u.id] = u);
