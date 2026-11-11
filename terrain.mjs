/** Public geography. Both players receive the same chart, rotated for the opposite shore. */
export const REEF_RISK = 0.25;
export const TORPEDO_COUNT = 3;
export const TERRAIN = {
  deep: { name: '深海', tag: 'DEEP WATER', row: 0, effect: '鱼雷命中此格内的舰船，整舰沉没。' },
  rock: { name: '礁石', tag: 'ROCKS', row: 1, effect: '露出水面的礁石，禁止部署和航行。' },
  reef: { name: '暗礁', tag: 'HIDDEN REEF', row: 2, effect: '航行进入新暗礁格时，每次机动有 25% 概率整舰触礁沉没。' },
  shoal: { name: '浅滩', tag: 'SHOALS', row: 3, effect: '航行进入新浅滩格后永久搁浅；初始部署不会触发。' },
};
export const MAPS = [
  { id: 'open-sea', name: '无垠深海', tag: 'OPEN OCEAN', theme: 'deep', summary: '全域深海，自由布阵，谨防鱼雷。', detail: '经典开阔海域；未特别标注的单元格均为深海。' },
  { id: 'archipelago', name: '星罗棋布', tag: 'THE SCATTERED ISLES', theme: 'rock', summary: '礁群散布，穿行于狭窄的航道。', detail: '多组露出水面的礁群阻挡布阵和移动，剩余海域为深海。' },
  { id: 'undertow', name: '暗流涌动', tag: 'THE UNDERTOW', theme: 'reef', summary: '暗礁连片，每次转进都是抉择。', detail: '中央斜向暗礁带可部署舰船；航行进入时有 25% 概率触礁沉没。' },
  { id: 'blue-frontier', name: '走向深海', tag: 'INTO THE BLUE', theme: 'shoal', summary: '从浅色沙洲驶向幽蓝深海。', detail: '后方三列为浅滩，迎敌一侧为深海。进入浅滩会搁浅，深海则暴露于鱼雷威胁。' },
];
export const mapInfo = id => MAPS.find(m => m.id === id) || MAPS[0];
export function terrainFor(id = 'open-sea', playerIndex = 0) {
  const terrain = Array(100).fill('deep');
  if (id === 'archipelago') {
    for (const c of [11,12,22,6,7,17,45,55,56,60,61,71,78,88,87,94]) terrain[c] = 'rock';
  } else if (id === 'undertow') {
    for (let y = 1; y < 9; y++) for (let x = 1; x < 9; x++)
      if (Math.abs(x - (8 - y * .7)) < 1.65) terrain[y * 10 + x] = 'reef';
  } else if (id === 'blue-frontier') {
    // Physical left/right shores mirror across the two side-by-side boards.
    for (let y = 0; y < 10; y++) for (let x = 0; x < 3; x++) terrain[y * 10 + x] = 'shoal';
  }
  return playerIndex % 2 ? terrain.reverse() : terrain;
}
export const terrainAt = (terrain, cell) => terrain?.[cell] || 'deep';
export const tileVariant = cell => (cell % 10 * 7 + Math.floor(cell / 10) * 11) % 4;
