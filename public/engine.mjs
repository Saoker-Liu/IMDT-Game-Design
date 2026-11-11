/** Authoritative, transport-independent rules. Shared by the LAN server and practice mode. */
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
    x: null, y: null, vertical: false,
  })));
}
export function makePlayer(id, name) {
  return { id, name, ready: false, confirmed: false, rematch: false, ships: makeFleet(), shots: [] };
}
export function makeGame(players) {
  return { phase: 'lobby', players, turn: 0, deadline: null, winner: null,
    round: 1, history: [], version: 0, startedAt: null, endedAt: null };
}
export function cells(ship) {
  if (ship.x === null || ship.y === null) return [];
  return Array.from({ length: ship.length }, (_, n) =>
    (ship.y + (ship.vertical ? n : 0)) * SIZE + ship.x + (ship.vertical ? 0 : n));
}
export function isSunk(player, ship) {
  const occupied = cells(ship);
  return occupied.length > 0 && occupied.every(c => player.shots.includes(c));
}
export function canPlace(ships, id, x, y, vertical) {
  const ship = ships.find(s => s.id === id);
  if (!ship || !Number.isInteger(x) || !Number.isInteger(y) || typeof vertical !== 'boolean') return false;
  if (x < 0 || y < 0 || x + (vertical ? 1 : ship.length) > SIZE || y + (vertical ? ship.length : 1) > SIZE) return false;
  const next = cells({ ...ship, x, y, vertical });
  return !ships.some(s => s.id !== id && cells(s).some(c => next.includes(c)));
}
export function autoPlace(player, preserve = true, rng = Math.random) {
  if (!preserve) player.ships = makeFleet();
  // With only 20 occupied cells, preserving an arbitrary legal partial fleet always leaves space.
  // Longest remaining ships first, with a bounded exhaustive list rather than a retry loop.
  for (const ship of [...player.ships].sort((a, b) => b.length - a.length)) {
    if (ship.x !== null) continue;
    const options = [];
    for (let y = 0; y < SIZE; y++) for (let x = 0; x < SIZE; x++) {
      for (const vertical of [false, true]) {
        if (canPlace(player.ships, ship.id, x, y, vertical)) options.push({ x, y, vertical });
      }
    }
    if (!options.length) throw new Error('无法完成布阵，请重置后重试');
    Object.assign(ship, options[Math.min(options.length - 1, Math.floor(rng() * options.length))]);
  }
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
export function act(game, playerId, action, now = Date.now()) {
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
      requireRule(canPlace(p.ships, action.id, action.x, action.y, action.vertical), '舰船不能重叠或超出海域');
      Object.assign(p.ships.find(s => s.id === action.id), { x: action.x, y: action.y, vertical: action.vertical });
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
      autoPlace(p, p.ships.some(s => s.x === null));
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
    case 'fire': {
      requireRule(game.phase === 'battle' && index === game.turn, '请等待你的回合');
      const c = action.cell;
      requireRule(Number.isInteger(c) && c >= 0 && c < SIZE * SIZE, '无效坐标');
      const target = game.players[1 - index];
      requireRule(!target.shots.includes(c), '这个坐标已经攻击过了');
      target.shots.push(c);
      const ship = target.ships.find(s => cells(s).includes(c));
      const result = ship ? (isSunk(target, ship) ? 'sunk' : 'hit') : 'miss';
      log(game, { type: result, playerId, cell: c, ...(result === 'sunk' ? { shipType: ship.type } : {}) }, now);
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
        Object.assign(game, makeGame(game.players.map(p => makePlayer(p.id, p.name))), { version: game.version });
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
    const ship = other.ships.find(s => cells(s).includes(c));
    enemyCells[c] = ship ? (isSunk(other, ship) ? 'sunk' : 'hit') : 'miss';
  }
  const publicPlayer = p => ({ id: p.id, name: p.name, ready: p.ready, confirmed: p.confirmed, rematch: p.rematch });
  return {
    phase: game.phase, turn: game.turn, deadline: game.deadline, winner: game.winner,
    round: game.round, version: game.version, startedAt: game.startedAt, endedAt: game.endedAt,
    me, players: game.players.map(publicPlayer), own: structuredClone(own), enemyCells,
    enemySunk: other ? other.ships.filter(s => isSunk(other, s)).map(s => s.type) : [],
    // A complete wreck is public only after every segment has been revealed by cannon fire.
    enemyWrecks: other ? other.ships.filter(s => isSunk(other, s)).map(s => ({
      type: s.type, length: s.length, x: s.x, y: s.y, vertical: s.vertical,
    })) : [],
    history: structuredClone(game.history.slice(-200)),
  };
}
