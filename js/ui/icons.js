// ============================================================
// GTDM icon library — original SVG icons (assets/icons)
// ============================================================
export const ICON_PATH = {
  gold: 'assets/icons/gold.svg',
  diamond: 'assets/icons/diamond.svg',
  ruby: 'assets/icons/ruby.svg',
  magic: 'assets/icons/magic.svg',
  mileage: 'assets/icons/mileage.svg',
  mineral: 'assets/icons/mineral.svg',
  card: 'assets/icons/card.svg',
  soul: 'assets/icons/soul.svg',
  scissors: 'assets/icons/scissors.svg',
  rock: 'assets/icons/rock.svg',
  paper: 'assets/icons/paper.svg',
  dice: 'assets/icons/dice.svg',
  spire: 'assets/icons/spire.svg',
  skull: 'assets/icons/skull.svg',
  book: 'assets/icons/book.svg',
};

// inline <img> for DOM UI (crisp at any size, GPU-cheap)
export function ico(id, size = 16) {
  const p = ICON_PATH[id];
  if (!p) return '';
  return `<img class="ico" src="${p}" style="width:${size}px;height:${size}px" alt="" draggable="false">`;
}

// attribute icon
export const attrIco = (attr, size = 14) => ico(attr, size);
