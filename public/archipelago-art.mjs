/* Positions in cells on the combined 20 × 10 chart. */
const reefPatches = [
  { x:7.32, y:.94, rx:1.79, ry:1.09, dx:-.45, dy:0, scale:.7, pivot:7.5 }, // Friendly G1/H1/H2: right 1/4 cell
  { x:6.30, y:4.96, rx:1.62, ry:1.37, dx:0, dy:1/3, scale:.74, pivot:5 }, // Friendly middle reef
  { x:.99, y:6.8, rx:1.5, ry:1.1, dx:0, dy:0, scale:.82, pivot:0 }, // Friendly lower-left reef
  { x:4.63, y:9.03, rx:.81, ry:.66, dx:0, dy:.5, scale:.85, pivot:4, waterShift:1.15 }, // Friendly bottom outcrop
  { x:8.27, y:7.72, rx:1.48, ry:1.14, dx:.2, dy:.24, scale:.75, pivot:7 }, // Friendly lower-right reef
  { x:11.52, y:1.84, rx:1.46, ry:1.17, dx:.26, dy:.09 }, // Enemy upper-left reef
  { x:15.32, y:.55, rx:.85, ry:.55, dx:.20, dy:0 }, // Enemy top outcrop
  { x:18.85, y:2.95, rx:1.2, ry:1.1, dx:.25, dy:0, scale:.85, pivot:18 }, // Enemy I3/I4/J4: right 1/4 cell
  { x:13.80, y:4.80, rx:1.49, ry:1.12, dx:.35, dy:.14, scale:.82, pivot:13 }, // Enemy D5/E5/E6: right 1/4 cell
  { x:12.4, y:7.75, rx:1.66, ry:1.30, dx:0, dy:1.25, scale:.78, pivot:13.8 }, // Enemy C9/C10/D10: down 1/4 cell
  { x:17.97, y:7.79, rx:1.5, ry:1.13, dx:.15, dy:.47, scale:.85, pivot:17 }, // Enemy H8/H9/I9: down 1/4 cell
];

function paintShore(side) {
  const water = [];
  const rocks = [];
  const patches = reefPatches.filter(({x}) => (x < 10 ? 0 : 1) === side);
  for (const {x, y, rx, ry, dx, dy, scale = 1, pivot = x, waterShift} of patches) {
    const mask = `--x:${x * 5}%;--y:${y * 10}%;--rx:${rx * 5}%;--ry:${ry * 10}%;`;
    const shift = waterShift ? `--water-shift:${waterShift * 10}%;` : '';
    const position = `--dx:${dx * 5}%;--dy:${dy * 10}%;--scale:${scale};--pivot:${pivot * 5}%;`;
    water.push(`<span class="reef-patch water${waterShift ? ' local-water' : ''}" style="${mask}${shift}"></span>`);
    rocks.push(`<span class="reef-patch rock" style="${mask}${position}"></span>`);
  }
  return `<span class="coastal-art coastal-art-${side}">${water.join('')}${rocks.join('')}</span>`;
}

const shores = [paintShore(0), paintShore(1)];
export const alignedArchipelagoArt = side => shores[side];
