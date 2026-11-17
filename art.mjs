/** Original art presentation. No gameplay state is stored in the artwork layer. */
import { SIZE, shape } from './geometry.mjs?v=5.1.0';

const lengths = { battleship: 4, cruiser: 3, destroyer: 2, frigate: 1, carrier: 3 };
export function vesselArt(ship, extra = '') {
  const length = lengths[ship.type] || 1;
  const assetVersion=ship.type==='carrier'?'5.1.0':'2.0.1';
  return `<span class="vessel ${ship.type}${ship.vertical ? ' vertical' : ''} ${extra}" style="--ship-length:${length}" aria-hidden="true"><span class="vessel-waterline"></span><img class="ship-art${ship.type==='carrier'?' carrier-art':''}" src="./assets/fleet-${ship.type}.webp?v=${assetVersion}" alt="" draggable="false" decoding="async"><span class="vessel-debris"></span></span>`;
}
export function shipOverlay(ship, { selected = false, wreck = false, firing = false } = {}) {
  return `<div class="ship-overlay${selected ? ' selected' : ''}${wreck ? ' wreck-overlay' : ''}${ship.grounded&&!wreck?' grounded':''}${firing?' firing':''}" style="left:${ship.x*10}%;top:${ship.y*10}%;width:${(ship.vertical?(ship.width||1):ship.length)*10}%;height:${(ship.vertical?ship.length:(ship.width||1))*10}%">${vesselArt(ship,wreck?'wreck':'')}${ship.grounded&&!wreck?'<span class="ship-status-anchor" aria-hidden="true">⚓</span>':''}${selected?'<span class="ship-selection-corner tl"></span><span class="ship-selection-corner br"></span>':''}</div>`;
}

function sightMask(cells) {
  const rectangles = cells.map(cell => `<rect x="${cell % SIZE}" y="${Math.floor(cell / SIZE)}" width="1" height="1"/>`).join('');
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${SIZE} ${SIZE}">${rectangles}</svg>`;
  return `mask-image:url('data:image/svg+xml,${encodeURIComponent(svg)}')`;
}

export function illuminationArt(cells) {
  if (!cells.length) return '';
  const mask = cells.length === SIZE ** 2 ? '' : ` style="${sightMask(cells)}"`;
  return `<div class="sight-light"${mask} aria-hidden="true"></div>`;
}

/** Position the painted model using only the revealed part's bounds. */
export function sightedHullArt(part, {type, length, width = 1}, sunk) {
  const columns = part.map(cell => cell % SIZE);
  const rows = part.map(cell => Math.floor(cell / SIZE));
  const left = Math.min(...columns), right = Math.max(...columns);
  const top = Math.min(...rows), bottom = Math.max(...rows);
  const hull = {type, length, width, vertical: bottom - top > right - left};
  const footprint = shape(hull);
  hull.x = (left + right + 1 - footprint.width) / 2;
  hull.y = (top + bottom + 1 - footprint.height) / 2;
  return `<div class="sighted-hull" style="${sightMask(part)}" aria-hidden="true">${shipOverlay(hull, {wreck: sunk})}</div>`;
}

export function impactArt(status) {
  if (status === 'hit') return `<span class="impact impact-hit" aria-hidden="true"><span class="impact-embers"></span><img class="fire-art" src="./assets/impact-fire.webp?v=2.0.1" alt="" draggable="false" decoding="async"></span>`;
  if (status === 'miss') return `<span class="impact impact-miss" aria-hidden="true"><i class="water-ring outer"></i><i class="water-ring inner"></i><i class="water-dot"></i><i class="water-glint"></i></span>`;
  if (status === 'sunk') return `<span class="impact impact-sunk" aria-hidden="true"><i class="oil-slick"></i><i class="wreck-splinter one"></i><i class="wreck-splinter two"></i><i class="wreck-splinter three"></i><i class="wreck-bubble"></i></span>`;
  return '';
}

/** Play a short effect on the cells named by a newly received strike. */
export function playStrikeEffects(app, strike, ownId) {
  if (matchMedia('(prefers-reduced-motion: reduce)').matches) return;
  const shore = strike.playerId === ownId ? 'hostile-chart' : 'friendly-chart';
  const cells = app.querySelector(`.${shore} .board-effects`)?.children;
  if (!cells) return;
  for (const {cell, result} of strike.results) {
    const target = cells[cell];
    if (!target || !['miss', 'hit', 'sunk'].includes(result)) continue;
    const burst = document.createElement('span');
    burst.className = `strike-burst ${result === 'miss' ? 'strike-splash' : 'strike-flash'}`;
    burst.setAttribute('aria-hidden', 'true');
    burst.innerHTML = '<i></i><i></i><i></i><i></i><i></i>';
    target.append(burst);
    setTimeout(() => burst.remove(), 750);
  }
}
export function boardFurniture(own) {
  return `<div class="chart-furniture" aria-hidden="true"><span class="chart-bearing">${own?'N 31° 14′':'E 121° 28′'}</span><span class="chart-classification">${own?'FLEET POSITION / 01':'UNIDENTIFIED WATERS / 02'}</span><svg class="chart-compass" viewBox="0 0 80 80" fill="none"><circle cx="40" cy="40" r="30"/><circle cx="40" cy="40" r="23"/><path d="m40 7 5 28 28 5-28 5-5 28-5-28-28-5 28-5Z"/><path d="m19 19 17 17m8 8 17 17m0-42L44 36M36 44 19 61"/><path d="m40 15 4 24-4 1-4-1Z" fill="currentColor"/><text x="40" y="5" text-anchor="middle" stroke="none" fill="currentColor" font-size="6">N</text></svg></div>`;
}
