/* Positions in cells on the combined 20 × 10 chart. */
const reefPatches = [
  { x:7.32, y:.94, rx:1.79, ry:1.09, dx:-.5, dy:0 }, // Friendly upper reef
  { x:6.30, y:4.96, rx:1.62, ry:1.37, dx:0, dy:1/3 }, // Friendly middle reef
  { x:4.63, y:9.03, rx:.81, ry:.66, dx:0, dy:.5, waterShift:1.15 }, // Friendly bottom outcrop
  { x:8.27, y:7.72, rx:1.48, ry:1.14, dx:-.10, dy:.24 }, // Friendly lower-right reef
  { x:11.52, y:1.84, rx:1.46, ry:1.17, dx:.26, dy:.09 }, // Enemy upper-left reef
  { x:15.32, y:.55, rx:.85, ry:.55, dx:.20, dy:0 }, // Enemy top outcrop
  { x:13.80, y:4.80, rx:1.49, ry:1.12, dx:.18, dy:.14 }, // Enemy center reef
  { x:12.4, y:7.75, rx:1.66, ry:1.30, dx:0, dy:1, scale:.78, pivot:13.8 }, // Enemy lower-left reef
  { x:17.97, y:7.79, rx:1.5, ry:1.13, dx:.15, dy:.22 }, // Enemy lower-right reef
];

export function alignedArchipelagoArt(side) {
  const pairs = reefPatches.map(({x,y,rx,ry,dx,dy,scale=1,pivot=x,waterShift}) => {
    const mask = `--x:${x*5}%;--y:${y*10}%;--rx:${rx*5}%;--ry:${ry*10}%;`;
    const water = waterShift ? ` local-water" style="${mask}--water-shift:${waterShift*10}%` : `" style="${mask}`;
    return {
      water: `<span class="reef-patch water${water}"></span>`,
      rock: `<span class="reef-patch rock" style="${mask}--dx:${dx*5}%;--dy:${dy*10}%;--scale:${scale};--pivot:${pivot*5}%"></span>`,
    };
  });
  return `<span class="coastal-art coastal-art-${side}">${pairs.map(patch => patch.water).join('')}${pairs.map(patch => patch.rock).join('')}</span>`;
}
