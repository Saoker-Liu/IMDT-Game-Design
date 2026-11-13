/** Authoritative, transport-independent rules. Shared by the LAN server and practice mode. */
import { terrainFor, terrainAt, MAPS, REEF_RISK, TORPEDO_COUNT } from './terrain.mjs?v=3.3.1';
export const SIZE = 10;
export const PREP_MS = 90_000;
export const TURN_MS = 10_000;
export const TYPES = [
  { type: 'battleship', name: '战列舰', length: 4, count: 1, code: 'BB' },
  { type: 'cruiser', name: '巡洋舰', length: 3, count: 2, code: 'CG' },
  { type: 'destroyer', name: '驱逐舰', length: 2, count: 3, code: 'DD' },
  { type: 'frigate', name: '护卫舰', length: 1, count: 4, code: 'FF' },
];
export const TOTAL_CELLS = 20;

export function makeFleet() {
  return TYPES.flatMap(t => Array.from({ length: t.count }, (_, i) => ({
    id: `${t.code}-${i + 1}`, type: t.type, length: t.length,
    x: null, y: null, vertical: false, hits: [], grounded: false,
  })));
}
export function makePlayer(id, name) {
  return { id, name, ready: false, confirmed: false, rematch: false, ships: makeFleet(), shots: [], shotRounds: {}, lastMove: 0, torpedoes: TORPEDO_COUNT, knownOwnReefs: [] };
}
export function makeGame(players, mapId = 'open-sea') {
  if (!MAPS.some(m => m.id === mapId)) throw new Error('未知的作战地图');
  players.forEach((p, i) => { p.terrain = terrainFor(mapId, i); });
  return { phase: 'lobby', players, mapId, turn: 0, deadline: null, winner: null,
    round: 1, history: [], version: 0, startedAt: null, endedAt: null };
}
export function cells(ship) {
  if (ship.x === null || ship.y === null) return [];
  return Array.from({ length: ship.length }, (_, n) =>
    (ship.y + (ship.vertical ? n : 0)) * SIZE + ship.x + (ship.vertical ? 0 : n));
}
export function isSunk(player, ship) {
  const occupied = cells(ship);
  return occupied.length > 0 && occupied.every(c => ship.hits.includes(c));
}
export function canPlace(ships, id, x, y, vertical, terrain = null) {
  const ship = ships.find(s => s.id === id);
  if (!ship || !Number.isInteger(x) || !Number.isInteger(y) || typeof vertical !== 'boolean') return false;
  if (x < 0 || y < 0 || x + (vertical ? 1 : ship.length) > SIZE || y + (vertical ? ship.length : 1) > SIZE) return false;
  const next = cells({ ...ship, x, y, vertical });
  if (next.some(c => terrainAt(terrain, c) === 'rock')) return false;
  return !ships.some(s => s.id !== id && cells(s).some(c => next.includes(c)));
}
export function autoPlace(player, preserve = true, rng = Math.random) {
  if (!preserve) player.ships = makeFleet();
  // Backtrack around terrain instead of committing to an unlucky greedy packing.
  const pending = player.ships.filter(s => s.x === null).sort((a, b) => b.length - a.length);
  function fill(index) {
    if (index === pending.length) return true;
    const ship = pending[index];
    const options = [];
    for (let y = 0; y < SIZE; y++) for (let x = 0; x < SIZE; x++) {
      for (const vertical of [false, true]) {
        if (canPlace(player.ships, ship.id, x, y, vertical, player.terrain)) options.push({ x, y, vertical });
      }
    }
    for (let n = options.length - 1; n > 0; n--) {
      const other = Math.min(n, Math.max(0, Math.floor(rng() * (n + 1))));
      [options[n], options[other]] = [options[other], options[n]];
    }
    for (const option of options) {
      Object.assign(ship, option);
      if (fill(index + 1)) return true;
    }
    Object.assign(ship, { x: null, y: null, vertical: false });
    return false;
  }
  if (!fill(0)) throw new Error('当前布阵无法容纳剩余舰船，请调整位置');
}
export function canMove(player, id, dx, dy) {
  const ship = player.ships.find(s => s.id === id);
  return !!ship && ship.x !== null && !ship.grounded && ship.hits.length === 0
    && Number.isInteger(dx) && Number.isInteger(dy) && Math.abs(dx) + Math.abs(dy) === 1
    && canPlace(player.ships, id, ship.x + dx, ship.y + dy, ship.vertical, player.terrain);
}
export function canFireAt(player, c) {
  if (!Number.isInteger(c) || c < 0 || c >= 100 || terrainAt(player.terrain, c) === 'rock') return false;
  if (player.ships.some(s => s.hits.includes(c))) return false;
  return !player.shots.includes(c) || player.shotRounds[c] < player.lastMove;
}
function sink(player, ship, cause) {
  ship.hits = cells(ship);
  ship.sunkBy = cause;
  for (const c of ship.hits) if (!player.shots.includes(c)) player.shots.push(c);
}
function log(game, event, now) {
  game.history.push({ id: game.history.length + 1, at: now, ...event });
}
function startBattle(game, now) {
  game.phase = 'battle';
  game.turn = 0;
  game.deadline = now + TURN_MS;
  game.startedAt = now;
  log(game, { type: 'start' }, now);
}
function advance(game, now) {
  game.turn = 1 - game.turn;
  game.round++;
  game.deadline = now + TURN_MS;
}
export function finish(game, winner, now, reason = 'destroyed') {
  game.phase = 'result';
  game.winner = winner;
  game.deadline = null;
  game.endedAt = now;
  log(game, { type: 'end', winner, reason }, now);
  game.version++;
}
export function tick(game, now = Date.now()) {
  if (game.deadline === null || now < game.deadline) return false;
  if (game.phase === 'placement') {
    for (const p of game.players) {
      if (!p.confirmed) { autoPlace(p, true); p.confirmed = true; }
    }
    log(game, { type: 'autoplaced' }, now);
    startBattle(game, now);
  } else if (game.phase === 'battle') {
    log(game, { type: 'timeout', playerId: game.players[game.turn].id }, now);
    advance(game, now);
  } else return false;
  game.version++;
  return true;
}
function requireRule(value, message) { if (!value) throw new Error(message); }
export function act(game, playerId, action, now = Date.now(), rng = Math.random) {
  tick(game, now);
  const p = game.players.find(p => p.id === playerId);
  requireRule(p, '你不在这个房间中');
  const index = game.players.indexOf(p);
  requireRule(action && typeof action.type === 'string', '无效操作');
  switch (action.type) {
    case 'ready': {
      requireRule(game.phase === 'lobby', '当前无法切换准备状态');
      p.ready = !p.ready;
      if (game.players.length === 2 && game.players.every(p => p.ready)) {
        game.phase = 'placement'; game.deadline = now + PREP_MS;
        log(game, { type: 'placement' }, now);
      }
      break;
    }
    case 'place': {
      requireRule(game.phase === 'placement' && !p.confirmed, '现在无法调整舰队');
      requireRule(canPlace(p.ships, action.id, action.x, action.y, action.vertical, p.terrain), '舰船不能重叠、越界或占据礁石');
      const ship = p.ships.find(s => s.id === action.id);
      const previous = { x: ship.x, y: ship.y, vertical: ship.vertical };
      Object.assign(ship, { x: action.x, y: action.y, vertical: action.vertical });
      try { autoPlace(structuredClone(p), true, () => 0); }
      catch {
        Object.assign(ship, previous);
        throw new Error('此布阵会封死剩余舰船的航道，请调整位置');
      }
      break;
    }
    case 'remove': {
      requireRule(game.phase === 'placement' && !p.confirmed, '现在无法调整舰队');
      const ship = p.ships.find(s => s.id === action.id);
      requireRule(ship, '未找到舰船');
      Object.assign(ship, { x: null, y: null, vertical: false });
      break;
    }
    case 'auto': {
      requireRule(game.phase === 'placement' && !p.confirmed, '现在无法调整舰队');
      autoPlace(p, p.ships.some(s => s.x === null), rng);
      break;
    }
    case 'clear': {
      requireRule(game.phase === 'placement' && !p.confirmed, '现在无法调整舰队');
      p.ships = makeFleet();
      break;
    }
    case 'confirm': {
      requireRule(game.phase === 'placement' && !p.confirmed, '当前无法确认布阵');
      requireRule(p.ships.every(s => s.x !== null), '请先部署全部 10 艘舰船');
      p.confirmed = true;
      if (game.players.every(p => p.confirmed)) startBattle(game, now);
      break;
    }
    case 'move': {
      requireRule(game.phase === 'battle' && index === game.turn, '请等待你的回合');
      requireRule(canMove(p, action.id, action.dx, action.dy), '无法航行：舰船中弹、搁浅，或目标越界、存在礁石/其他舰船');
      const ship = p.ships.find(s => s.id === action.id);
      const old = cells(ship);
      ship.x += action.dx; ship.y += action.dy;
      const entered = cells(ship).filter(c => !old.includes(c));
      p.lastMove = game.round;
      const reefs = entered.filter(c => terrainAt(p.terrain, c) === 'reef');
      if (reefs.length && rng() < REEF_RISK) {
        for (const c of reefs) if (!p.knownOwnReefs.includes(c)) p.knownOwnReefs.push(c);
        sink(p, ship, 'reef');
        log(game, { type: 'reef-sunk', playerId, shipType: ship.type }, now);
      } else {
        ship.grounded = entered.some(c => terrainAt(p.terrain, c) === 'shoal');
        // Do not disclose ship identity, coordinates, or displacement to the opponent.
        log(game, { type: ship.grounded ? 'grounded' : 'move', playerId }, now);
      }
      if (p.ships.every(s => isSunk(p, s))) finish(game, 1 - index, now, 'destroyed');
      else advance(game, now);
      break;
    }
    case 'fire': {
      requireRule(game.phase === 'battle' && index === game.turn, '请等待你的回合');
      const c = action.cell;
      requireRule(Number.isInteger(c) && c >= 0 && c < SIZE * SIZE, '无效坐标');
      const target = game.players[1 - index];
      const weapon = action.weapon ?? 'shell';
      requireRule(weapon === 'shell' || weapon === 'torpedo', '无效武器');
      requireRule(canFireAt(target, c), '该坐标为礁石或已经攻击过；敌方机动后才可复查落空格');
      requireRule(weapon !== 'torpedo' || p.torpedoes > 0, '鱼雷已用尽');
      if (weapon === 'torpedo') p.torpedoes--;
      if (!target.shots.includes(c)) target.shots.push(c);
      target.shotRounds[c] = game.round;
      const ship = target.ships.find(s => cells(s).includes(c));
      if (ship) {
        ship.hits.push(c);
        if (weapon === 'torpedo' && terrainAt(target.terrain, c) === 'deep') sink(target, ship, 'torpedo');
      }
      const result = ship ? (isSunk(target, ship) ? 'sunk' : 'hit') : 'miss';
      log(game, { type: result, playerId, cell: c, weapon, ...(result === 'sunk' ? { shipType: ship.type } : {}) }, now);
      if (target.ships.every(s => isSunk(target, s))) finish(game, index, now);
      else advance(game, now);
      break;
    }
    case 'pass': {
      requireRule(game.phase === 'battle' && index === game.turn, '请等待你的回合');
      log(game, { type: 'pass', playerId }, now);
      advance(game, now);
      break;
    }
    case 'rematch': {
      requireRule(game.phase === 'result', '本局尚未结束');
      p.rematch = true;
      if (game.players.length === 2 && game.players.every(p => p.rematch)) {
        Object.assign(game, makeGame(game.players.map(p => makePlayer(p.id, p.name)), game.mapId), { version: game.version });
      }
      break;
    }
    default: throw new Error('不支持的操作');
  }
  game.version++;
  return game;
}
/** Never send unhit enemy locations, ship IDs or enemy incoming-shot arrays to a client. */
export function viewFor(game, playerId) {
  const me = game.players.findIndex(p => p.id === playerId);
  requireRule(me !== -1, '你不在这个房间中');
  const own = game.players[me];
  const other = game.players[1 - me];
  const enemyCells = Array(SIZE * SIZE).fill('unknown');
  if (other) for (const c of other.shots) {
    const ship = other.ships.find(s => s.hits.includes(c));
    enemyCells[c] = ship ? (isSunk(other, ship) ? 'sunk' : 'hit') : 'miss';
  }
  const publicPlayer = p => ({ id: p.id, name: p.name, ready: p.ready, confirmed: p.confirmed, rematch: p.rematch });
  const knownTerrain = (terrain, known) => terrain.map((type, cell) => type === 'reef' && !known.includes(cell) ? 'deep' : type);
  const ownView = structuredClone(own);
  ownView.terrain = knownTerrain(own.terrain, own.knownOwnReefs);
  return {
    phase: game.phase, mapId: game.mapId, turn: game.turn, deadline: game.deadline, winner: game.winner,
    round: game.round, version: game.version, startedAt: game.startedAt, endedAt: game.endedAt,
    me, players: game.players.map(publicPlayer), own: ownView, enemyCells,
    enemySunk: other ? other.ships.filter(s => isSunk(other, s)).map(s => s.type) : [],
    enemyTerrain: knownTerrain(other ? other.terrain : terrainFor(game.mapId, 1 - me), []),
    rescanCells: other ? other.shots.filter(c => canFireAt(other, c)) : [],
    // Cannon damage, torpedoes and a visible grounding wreck can reveal complete hulls.
    enemyWrecks: other ? other.ships.filter(s => isSunk(other, s)).map(s => ({
      type: s.type, length: s.length, x: s.x, y: s.y, vertical: s.vertical,
    })) : [],
    history: structuredClone(game.history.slice(-200)),
  };
}
