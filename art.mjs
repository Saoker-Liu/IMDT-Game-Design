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

/** Presentation only: use the received visible cells and traced path, never infer hidden positions. */
export function playTacticalEntrance(app, { illumination = false, illuminationCells = [], illuminationCenter = null, previousLit = [], smokeOwn = [], smokeEnemy = [], traces = [] } = {}) {
  if (matchMedia('(prefers-reduced-motion: reduce)').matches) return;
  const board = app.querySelector('.hostile-chart .board-matrix');
  if (illumination && board && illuminationCells.length) {
    const xs=illuminationCells.map(c=>c%10),ys=illuminationCells.map(c=>Math.floor(c/10));
    const center=illuminationCenter ?? Math.round((Math.min(...ys)+Math.max(...ys))/2)*10+Math.round((Math.min(...xs)+Math.max(...xs))/2);
    const cx=center%10,cy=Math.floor(center/10);
    const light=board.querySelector('.sight-light');
    const stage=document.createElement('div');stage.className='illumination-reveal';stage.setAttribute('aria-hidden','true');
    stage.innerHTML=illuminationArt(previousLit);
    board.append(stage);if(light)light.style.opacity='0';
    const burst=document.createElement('span');burst.className='illumination-burst';
    burst.style.cssText=`left:${cx*10}%;top:${cy*10}%;`;stage.append(burst);
    const flash=burst.animate([{opacity:0,transform:'scale(.15)'},{opacity:1,transform:'scale(.85)',offset:.25},{opacity:0,transform:'scale(1.4)'}],{duration:480,easing:'ease-out'});
    flash.onfinish=()=>burst.remove();
    let end=0;
    for(const cell of illuminationCells) {
      const ring=Math.max(Math.abs(cell%10-cx),Math.abs(Math.floor(cell/10)-cy));
      const delay=220+ring*220;end=Math.max(end,delay+460);
      const tile=document.createElement('span');tile.className='illumination-tile';tile.dataset.lightCell=cell;
      tile.style.cssText=`left:${cell%10*10}%;top:${Math.floor(cell/10)*10}%;`;stage.append(tile);
      tile.animate([{opacity:0},{opacity:1}],{duration:460,delay,fill:'both',easing:'ease-out'});
    }
    // The original hull masks still limit information; this extra clip opens from the impact cell.
    const hulls=board.querySelectorAll('.sighted-hull');
    const radius=Math.max(...illuminationCells.map(c=>Math.max(Math.abs(c%10-cx),Math.abs(Math.floor(c/10)-cy))));
    const clips=Array.from({length:radius+2},(_,i)=>{
      const r=Math.max(0,i-1);
      return {clipPath:`inset(${Math.max(0,cy-r)*10}% ${Math.max(0,9-cx-r)*10}% ${Math.max(0,9-cy-r)*10}% ${Math.max(0,cx-r)*10}%)`,opacity:i?1:0,offset:i/(radius+1)};
    });
    for(const hull of hulls) if(!previousLit.length) hull.animate(clips,{duration:end,easing:'steps(1,end)'});
    setTimeout(()=>{if(light)light.style.opacity='';stage.remove();},end+20);
  }
  for (const [side,cells] of [['friendly-chart',smokeOwn],['hostile-chart',smokeEnemy]]) {
    for (const cell of cells) app.querySelector(`.${side} .smoke-cell[data-cell="${cell}"]`)?.animate([
      {opacity:0}, {opacity:1}
    ], {duration:1100,delay:(cell%3)*60,easing:'ease-out'});
  }
  if (!board) return;
  for (const trace of traces.filter(path=>path.length)) {
    const duration = Math.min(1800,Math.max(500,trace.length*160));
    const first=trace[0],last=trace.at(-1);
    const angle=Math.atan2(Math.floor(last/10)-Math.floor(first/10),last%10-first%10)*180/Math.PI;
    trace.forEach((cell,index)=>{
      const wake=app.querySelector(`.hostile-chart .cell[data-cell="${cell}"] .torpedo-wake`);
      if(wake){wake.style.rotate=`${angle}deg`;wake.animate([
        {opacity:0},{opacity:.9,offset:.12},{opacity:.5,offset:.45},{opacity:0}
      ],{duration:1050,delay:index/Math.max(1,trace.length-1)*duration,fill:'both'});}
    });
    const dart=document.createElement('span');
    dart.className='torpedo-dart'; dart.setAttribute('aria-hidden','true'); board.append(dart);
    dart.style.rotate=`${angle}deg`;
    dart.innerHTML='<svg viewBox="0 0 100 34" aria-hidden="true"><path fill="#839b9d" stroke="#34494d" stroke-width="2" d="M4 2h18l12 11v8L22 32H4l8-15Z"/><path fill="#bfd0cc" stroke="#34494d" stroke-width="2" d="M18 9h53c31 0 31 16 0 16H18Z"/><path fill="#789ca1" d="M58 9h7v16h-7Z"/><path fill="none" stroke="#eaf0df" stroke-width="2" d="M25 12h47q13 0 17 5"/><path fill="#b1a46a" d="M20 10h3v14h-3Z"/><path stroke="#40595d" stroke-width="2" d="M7 17h16m-8-7v14"/></svg>';
    const points=trace.map((cell,index)=>({left:`${cell%10*10+5}%`,top:`${Math.floor(cell/10)*10+5}%`,offset:trace.length===1?0:index/(trace.length-1)}));
    if(points.length===1)points.push({...points[0],offset:1});
    const travel=dart.animate(points,{duration,easing:'linear'});
    travel.onfinish=()=>dart.remove(); travel.oncancel=()=>dart.remove();
  }
}

/** Keep the hull aligned to its board position as illumination changes. */
export function sightedHullArt(part, {type, length, width = 1}, {offset, vertical}, sunk) {
  const firstCell = part[0];
  const hull = {type, length, width, vertical};
  const footprintWidth = shape(hull).width;
  hull.x = firstCell % SIZE - offset % footprintWidth;
  hull.y = Math.floor(firstCell / SIZE) - Math.floor(offset / footprintWidth);
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
