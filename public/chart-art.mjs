import { MAPS, terrainFor } from './terrain.mjs?v=3.3.1';

const charts = MAPS.flatMap(map => [0, 1].map(side => ({ mapId: map.id, side, terrain: terrainFor(map.id, side) })));

/** Artwork is one complete scene; only the rules array determines each region's boundary. */
export function chartFor(terrain) {
  return charts.find(chart => chart.terrain.length === terrain.length && chart.terrain.every((type, cell) => terrain[cell] === type))
    || { mapId: 'open-sea', side: 0 };
}

/** Trace the outside of adjoining cells, omitting their shared internal edges. */
export function regionContours(terrain, type) {
  const edges = [];
  const at = (x, y) => x >= 0 && x < 10 && y >= 0 && y < 10 && terrain[y * 10 + x] === type;
  for (let y = 0; y < 10; y++) for (let x = 0; x < 10; x++) if (at(x, y)) {
    if (!at(x, y - 1)) edges.push({ x, y, nx: x + 1, ny: y, dir: 0 });
    if (!at(x + 1, y)) edges.push({ x: x + 1, y, nx: x + 1, ny: y + 1, dir: 1 });
    if (!at(x, y + 1)) edges.push({ x: x + 1, y: y + 1, nx: x, ny: y + 1, dir: 2 });
    if (!at(x - 1, y)) edges.push({ x, y: y + 1, nx: x, ny: y, dir: 3 });
  }
  const starts = new Map();
  for (const edge of edges) {
    const key = `${edge.x},${edge.y}`;
    if (!starts.has(key)) starts.set(key, []);
    starts.get(key).push(edge);
  }
  const used = new Set(), contours = [];
  for (const first of edges) {
    if (used.has(first)) continue;
    const points = [[first.x, first.y]];
    let edge = first;
    do {
      used.add(edge);
      points.push([edge.nx, edge.ny]);
      if (edge.nx === first.x && edge.ny === first.y) break;
      const next = (starts.get(`${edge.nx},${edge.ny}`) || []).filter(candidate => !used.has(candidate));
      // Keep diagonally touching regions separate by following the inside on our right.
      const rank = candidate => [1, 0, 3, 2].indexOf((candidate.dir - edge.dir + 4) % 4);
      edge = next.sort((a, b) => rank(a) - rank(b))[0];
    } while (edge);
    contours.push(`M${points.map(([x, y]) => `${x * 10},${y * 10}`).join('L')}Z`);
  }
  return contours;
}

export function terrainChart(terrain, small = false, chart = chartFor(terrain)) {
  const { mapId, side } = chart;
  // Reefs never get a texture, tint, outline or marker, even after they are discovered.
  const regions = ['rock', 'shoal'].map(type => {
    const d = regionContours(terrain, type).join('');
    return d ? `<path class="terrain-region region-${type}" data-terrain="${type}" d="${d}" vector-effect="non-scaling-stroke"/>` : '';
  }).join('');
  return `<div class="${small ? 'map-mini' : 'terrain-layer'} chart-scene chart-${mapId}-${side}" data-chart="${mapId}" data-facing="${side}" aria-hidden="true"><span class="sea-paint"></span>${regions ? `<svg class="terrain-boundaries" viewBox="0 0 100 100" preserveAspectRatio="none">${regions}</svg>` : ''}</div>`;
}
