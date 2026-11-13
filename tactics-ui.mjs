import { MAPS, TERRAIN, mapInfo, terrainFor } from './terrain.mjs?v=3.3.0';
import { canMove, isSunk } from './engine.mjs?v=3.3.0';
import { terrainChart } from './chart-art.mjs?v=3.3.0';

export { terrainChart };

const guideMaps = { deep: 'open-sea', rock: 'archipelago', reef: 'undertow', shoal: 'blue-frontier' };
const regionNotes = { deep: '海面下也可能藏有暗礁', rock: '实线内禁止通行', reef: '外观同深海，发现后悬停查看', shoal: '长虚线内驶入会搁浅' };
export function mapPicker(selected) {
  return `<section class="map-selection" aria-label="选择作战地图"><div class="map-selection-heading"><div><span class="eyebrow">CHOOSE YOUR WATERS</span><h2>选择你的作战海域</h2></div><span>暗礁隐蔽 · 舰位隐蔽</span></div><div class="map-cards">${MAPS.map(m => `<button class="map-card ${selected === m.id ? 'selected' : ''}" data-action="select-map" data-map="${m.id}" aria-pressed="${selected === m.id}">${terrainChart(terrainFor(m.id), true, {mapId:m.id,side:0})}<span class="map-card-shade"></span><span class="map-card-number">0${MAPS.indexOf(m) + 1} / ${m.tag}</span><span class="map-card-body"><strong>${m.name}</strong><span>${m.summary}</span></span><span class="map-card-selected">${selected === m.id ? '✓ 已选海域' : '选择海域'}</span></button>`).join('')}</div><div class="map-selection-foot"><span>已选 <b>${mapInfo(selected).name}</b> · ${mapInfo(selected).detail}</span><button class="btn small primary" data-action="practice">进入此海域演习 →</button></div></section>`;
}
export function mapBrief(mapId, me = 0) {
  const m = mapInfo(mapId);
  return `<div class="map-brief"><span class="map-seal chart-thumb-${m.theme}"></span><div><b>${m.name}</b><span>${m.detail}${mapId==='blue-frontier'?` 虚线为浅滩边界；己方迎敌方向 ${me===0?'→':'←'}。`:''}</span></div><button class="text-button" data-action="terrain-guide">地形图鉴 ↗</button></div>`;
}
export function terrainLegend() {
  return `<div class="terrain-legend" aria-label="地形效果">${Object.entries(TERRAIN).map(([type, t]) => `<button data-action="terrain-guide" class="terrain-key"><span class="terrain-swatch chart-thumb-${type}"></span><span><b>${t.name}</b><small>${({deep:'鱼雷命中整舰沉没',rock:'禁止部署与航行',reef:'驶入 25% 触礁沉没',shoal:'驶入后永久搁浅'})[type]}</small></span></button>`).join('')}</div>`;
}
export function terrainGuide() {
  return `<p class="modal-description">格线用于定位，轮廓标明礁石与浅滩范围。暗礁始终与深海外观一致；炮击侦察或触礁后，仅悬停说明变为暗礁。敌舰仍隐蔽。</p><div class="terrain-guide">${Object.entries(TERRAIN).map(([type, t]) => `<div class="terrain-guide-card"><div class="terrain-guide-art">${terrainChart(terrainFor(guideMaps[type]), true, {mapId:guideMaps[type],side:0})}</div><div><small>${t.tag}</small><h3>${t.name}</h3><p>${t.effect}</p></div><span class="terrain-map-caption caption-${type}"><i></i>${regionNotes[type]}</span></div>`).join('')}</div><p class="terrain-rules-note">每回合可开火一次或平移一格，完成后立即换手。每方 3 枚鱼雷；炮弹无限。已中弹舰船与残骸不能航行。落空标记是历史情报，敌方机动后可复查。仅进入新的暗礁/浅滩格时触发效果，初始部署不会触发。</p><button class="btn primary full" data-action="close-modal">了解海况</button>`;
}
export function mobilityControls(player, selected, active) {
  const ship = player.ships.find(s => s.id === selected);
  const name = ship ? ({battleship:'战列舰',cruiser:'巡洋舰',destroyer:'驱逐舰',frigate:'护卫舰'})[ship.type] : '';
  const locked = ship && (isSunk(player, ship) ? '已沉没，残骸不能航行' : ship.grounded ? '已搁浅，无法再次航行' : ship.hits.length ? '舰体受损，无法航行' : '选择方向，整舰平移一格并结束回合');
  return `<div class="mobility-panel"><div><small>FLEET MANEUVER</small><b>${ship ? `${name} ${ship.id}` : '舰队机动'}</b><span>${!active ? '等待自己的回合后可选择舰船' : locked || '点选己方舰船，再选择航行方向'}</span></div><div class="move-pad" role="group" aria-label="舰船航行方向">${[[0,-1,'↑','向上航行'],[-1,0,'←','向左航行'],[1,0,'→','向右航行'],[0,1,'↓','向下航行']].map(([dx,dy,glyph,label]) => `<button data-action="move" data-dx="${dx}" data-dy="${dy}" class="move-direction ${dy < 0 ? 'north' : dy > 0 ? 'south' : dx < 0 ? 'west' : 'east'}" aria-label="${label}" ${!active || !ship || !canMove(player, ship.id, dx, dy) ? 'disabled' : ''}>${glyph}</button>`).join('')}<span class="move-center">✥</span></div></div>`;
}
