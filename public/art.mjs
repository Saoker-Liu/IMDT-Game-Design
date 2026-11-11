/** Original art presentation. No gameplay state is stored in the artwork layer. */
const lengths = { battleship: 4, cruiser: 3, destroyer: 2, frigate: 1 };
export function vesselArt(ship, extra = '') {
  const length = lengths[ship.type] || 1;
  return `<span class="vessel ${ship.type}${ship.vertical ? ' vertical' : ''} ${extra}" style="--ship-length:${length}" aria-hidden="true"><span class="vessel-waterline"></span><img class="ship-art" src="./assets/fleet-${ship.type}.webp" alt="" draggable="false" decoding="async"><span class="vessel-debris"></span></span>`;
}
export function shipOverlay(ship, { selected = false, wreck = false } = {}) {
  return `<div class="ship-overlay${selected ? ' selected' : ''}${wreck ? ' wreck-overlay' : ''}" style="left:${ship.x*10}%;top:${ship.y*10}%;width:${(ship.vertical?1:ship.length)*10}%;height:${(ship.vertical?ship.length:1)*10}%">${vesselArt(ship,wreck?'wreck':'')}${selected?'<span class="ship-selection-corner tl"></span><span class="ship-selection-corner br"></span>':''}</div>`;
}
export function impactArt(status) {
  if (status === 'hit') return `<span class="impact impact-hit" aria-hidden="true"><span class="impact-embers"></span><img class="fire-art" src="./assets/impact-fire.webp" alt="" draggable="false" decoding="async"></span>`;
  if (status === 'miss') return `<span class="impact impact-miss" aria-hidden="true"><i class="water-ring outer"></i><i class="water-ring inner"></i><i class="water-dot"></i><i class="water-glint"></i></span>`;
  if (status === 'sunk') return `<span class="impact impact-sunk" aria-hidden="true"><i class="oil-slick"></i><i class="wreck-splinter one"></i><i class="wreck-splinter two"></i><i class="wreck-splinter three"></i><i class="wreck-bubble"></i></span>`;
  return '';
}
export function boardFurniture(own) {
  return `<div class="chart-furniture" aria-hidden="true"><span class="chart-bearing">${own?'N 31° 14′':'E 121° 28′'}</span><span class="chart-classification">${own?'FLEET POSITION / 01':'UNIDENTIFIED WATERS / 02'}</span><svg class="chart-compass" viewBox="0 0 80 80" fill="none"><circle cx="40" cy="40" r="30"/><circle cx="40" cy="40" r="23"/><path d="m40 7 5 28 28 5-28 5-5 28-5-28-28-5 28-5Z"/><path d="m19 19 17 17m8 8 17 17m0-42L44 36M36 44 19 61"/><path d="m40 15 4 24-4 1-4-1Z" fill="currentColor"/><text x="40" y="5" text-anchor="middle" stroke="none" fill="currentColor" font-size="6">N</text></svg></div>`;
}
