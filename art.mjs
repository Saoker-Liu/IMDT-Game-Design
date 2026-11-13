/** Original art presentation. No gameplay state is stored in the artwork layer. */
const lengths = { battleship: 4, cruiser: 3, destroyer: 2, frigate: 1, carrier: 3 };
export function vesselArt(ship, extra = '') {
  const length = lengths[ship.type] || 1;
  const carrier=`<svg class="ship-art carrier-art" viewBox="0 0 300 200" aria-hidden="true"><path d="M17 48 238 33 282 99 239 166 17 151 29 101Z" fill="#213238" stroke="#9b9b7f" stroke-width="3"/><path d="M24 53 234 40 270 99 234 158 24 145Z" fill="#666e66" stroke="#b2ab88" stroke-width="2"/><path d="M40 99h213" stroke="#d0c5a0" stroke-width="2" stroke-dasharray="10 7"/><path d="M47 65h168M47 132h168" stroke="#bfb490" stroke-width="2"/><path d="m75 49 12 105m15-107 12 108m15-109 12 111m15-113 12 115" stroke="#303e3b" stroke-width="3" opacity=".55"/><rect x="110" y="45" width="70" height="29" rx="4" fill="#303e40" stroke="#c3b798"/><rect x="126" y="42" width="31" height="24" rx="3" fill="#7e8471"/><path d="M143 42V26m-14 8h28" stroke="#c1c3ab" stroke-width="2"/>${[64,105,146,187].map(x=>`<path d="m${x} 120 9-15 4 10 13 4-13 3-4 10-3-10Z" fill="#c5c3a2" stroke="#374746"/>`).join('')}<path d="m225 62 28 37-28 38" stroke="#d0b880" stroke-width="2" fill="none"/></svg>`;
  return `<span class="vessel ${ship.type}${ship.vertical ? ' vertical' : ''} ${extra}" style="--ship-length:${length}" aria-hidden="true"><span class="vessel-waterline"></span>${ship.type==='carrier'?carrier:`<img class="ship-art" src="./assets/fleet-${ship.type}.webp?v=2.0.1" alt="" draggable="false" decoding="async">`}<span class="vessel-debris"></span></span>`;
}
export function shipOverlay(ship, { selected = false, wreck = false, firing = false } = {}) {
  return `<div class="ship-overlay${selected ? ' selected' : ''}${wreck ? ' wreck-overlay' : ''}${ship.grounded&&!wreck?' grounded':''}${firing?' firing':''}" style="left:${ship.x*10}%;top:${ship.y*10}%;width:${(ship.vertical?(ship.width||1):ship.length)*10}%;height:${(ship.vertical?ship.length:(ship.width||1))*10}%">${vesselArt(ship,wreck?'wreck':'')}${ship.grounded&&!wreck?'<span class="ship-status-anchor" aria-hidden="true">⚓</span>':''}${selected?'<span class="ship-selection-corner tl"></span><span class="ship-selection-corner br"></span>':''}</div>`;
}
export function impactArt(status) {
  if (status === 'hit') return `<span class="impact impact-hit" aria-hidden="true"><span class="impact-embers"></span><img class="fire-art" src="./assets/impact-fire.webp?v=2.0.1" alt="" draggable="false" decoding="async"></span>`;
  if (status === 'miss') return `<span class="impact impact-miss" aria-hidden="true"><i class="water-ring outer"></i><i class="water-ring inner"></i><i class="water-dot"></i><i class="water-glint"></i></span>`;
  if (status === 'sunk') return `<span class="impact impact-sunk" aria-hidden="true"><i class="oil-slick"></i><i class="wreck-splinter one"></i><i class="wreck-splinter two"></i><i class="wreck-splinter three"></i><i class="wreck-bubble"></i></span>`;
  return '';
}
export function boardFurniture(own) {
  return `<div class="chart-furniture" aria-hidden="true"><span class="chart-bearing">${own?'N 31° 14′':'E 121° 28′'}</span><span class="chart-classification">${own?'FLEET POSITION / 01':'UNIDENTIFIED WATERS / 02'}</span><svg class="chart-compass" viewBox="0 0 80 80" fill="none"><circle cx="40" cy="40" r="30"/><circle cx="40" cy="40" r="23"/><path d="m40 7 5 28 28 5-28 5-5 28-5-28-28-5 28-5Z"/><path d="m19 19 17 17m8 8 17 17m0-42L44 36M36 44 19 61"/><path d="m40 15 4 24-4 1-4-1Z" fill="currentColor"/><text x="40" y="5" text-anchor="middle" stroke="none" fill="currentColor" font-size="6">N</text></svg></div>`;
}
