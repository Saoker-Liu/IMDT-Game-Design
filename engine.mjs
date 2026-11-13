/** Authoritative, transport-independent rules. Shared by the LAN server and practice mode. */
import { terrainFor, terrainAt, MAPS } from './terrain.mjs?v=5.0.0';
import { CARD_TYPES, ACTIONS_PER_TURN, makeDeck, dealCards, drawCards, canUseCard } from './cards.mjs?v=5.0.0';
import { cells, shape, isSunk, canPlace, canMove, validCell } from './geometry.mjs?v=5.0.0';
import { prepareCard, resolveCard, visibleCells } from './combat.mjs?v=5.0.0';
export { cells, shape, isSunk, canPlace, canMove };
export const SIZE = 10;
export const PREP_MS = 90_000;
export const TURN_MS = 10_000;
export const TYPES = [
  { type: 'battleship', name: '战列舰', length: 4, count: 1, code: 'BB' },
  { type: 'cruiser', name: '巡洋舰', length: 3, count: 2, code: 'CG' },
  { type: 'destroyer', name: '驱逐舰', length: 2, count: 3, code: 'DD' },
  { type: 'frigate', name: '护卫舰', length: 1, count: 4, code: 'FF' },
  { type: 'carrier', name: '航空母舰', length: 3, width: 2, count: 1, code: 'CV' },
];
export const TOTAL_CELLS = 26;
export const TOTAL_SHIPS = TYPES.reduce((n,t)=>n+t.count,0);

export function makeFleet() {
  return TYPES.flatMap(t => Array.from({ length: t.count }, (_, i) => ({
    id: `${t.code}-${i + 1}`, type: t.type, length: t.length, width: t.width || 1,
    x: null, y: null, vertical: false, hits: [], grounded: false,
  })));
}
export function makePlayer(id, name) {
  return { id, name, ready:false, confirmed:false, rematch:false, ships:makeFleet(), shots:[], shotRounds:{}, shotResults:{}, lastMove:0, knownOwnReefs:[],
    deck:makeDeck(), hand:[], actionPoints:0, turns:0, scans:[], smoke:[], concealed:[], lastAction:null, stats:{attacks:0,hits:0} };
}
export function makeGame(players, mapId = 'open-sea') {
  if (!MAPS.some(m => m.id === mapId)) throw new Error('未知的作战地图');
  players.forEach((p, i) => { p.terrain = terrainFor(mapId, i); });
  return { phase: 'lobby', players, mapId, turn: 0, deadline: null, winner: null,
    round: 1, history: [], version: 0, startedAt: null, endedAt: null, airControl:null };
}
export function autoPlace(player, preserve = true, rng = Math.random) {
  if (!preserve) player.ships = makeFleet();
  // Backtrack around terrain instead of committing to an unlucky greedy packing.
  const pending = player.ships.filter(s => s.x === null).sort((a, b) => b.length*(b.width||1) - a.length*(a.width||1));
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
export function canFireAt(player, c) {
  if (!Number.isInteger(c) || c < 0 || c >= 100 || terrainAt(player.terrain, c) === 'rock') return false;
  if (player.ships.some(s => s.hits.includes(c))) return false;
  return !player.shots.includes(c) || player.shotRounds[c] < player.lastMove;
}
function log(game, event, now) {
  game.history.push({ id: game.history.length + 1, at: now, ...event });
}
function beginTurn(game, now) {
  const player = game.players[game.turn];
  player.actionPoints = ACTIONS_PER_TURN;
  player.turns++;
  player.scans=player.scans.filter(effect=>player.turns<effect.expiresTurn);
  player.smoke=player.smoke.filter(effect=>player.turns<effect.expiresTurn);
  if(game.airControl&&game.players[game.airControl.owner].turns>=game.airControl.expiresTurn)game.airControl=null;
  drawCards(player);
  game.deadline = now + TURN_MS;
}
function startBattle(game, now, rng) {
  game.phase = 'battle';
  game.turn = 0;
  game.startedAt = now;
  for (const player of game.players) dealCards(player, rng);
  beginTurn(game, now);
  log(game, { type: 'start' }, now);
}
function advance(game, now) {
  game.players[game.turn].actionPoints = 0;
  game.turn = 1 - game.turn;
  game.round++;
  beginTurn(game, now);
}
export function finish(game, winner, now, reason = 'destroyed') {
  game.phase = 'result';
  game.winner = winner;
  game.deadline = null;
  game.endedAt = now;
  log(game, { type: 'end', winner, reason }, now);
  game.version++;
}
export function tick(game, now = Date.now(), rng = Math.random) {
  if (game.deadline === null || now < game.deadline) return false;
  if (game.phase === 'placement') {
    for (const p of game.players) {
      if (!p.confirmed) { autoPlace(p, true, rng); p.confirmed = true; }
    }
    log(game, { type: 'autoplaced' }, now);
    startBattle(game, now, rng);
  } else if (game.phase === 'battle') {
    log(game, { type: 'timeout', playerId: game.players[game.turn].id }, now);
    advance(game, now);
  } else return false;
  game.version++;
  return true;
}
function requireRule(value, message) { if (!value) throw new Error(message); }
export function act(game, playerId, action, now = Date.now(), rng = Math.random) {
  tick(game, now, rng);
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
      requireRule(p.ships.every(s => s.x !== null), `请先部署全部 ${TOTAL_SHIPS} 艘舰船`);
      p.confirmed = true;
      if (game.players.every(p => p.confirmed)) startBattle(game, now, rng);
      break;
    }
    case 'play-card': {
      requireRule(game.phase==='battle'&&index===game.turn,'请等待你的回合');
      const plan=prepareCard(game,index,action);
      p.hand.splice(p.hand.findIndex(c=>c.id===plan.card.id),1);
      p.actionPoints-=plan.d.cost;
      resolveCard(game,index,plan,now,rng);
      // Resolve draw effects before returning the used card, preventing self-draw loops.
      p.deck.push(plan.card);
      const target=game.players[1-index];
      if(p.ships.every(s=>isSunk(p,s)))finish(game,1-index,now);
      else if(target.ships.every(s=>isSunk(target,s)))finish(game,index,now);
      else if(p.actionPoints===0&&!p.hand.some(c=>CARD_TYPES[c.type].cost===0&&canUseCard(p,c)))advance(game,now);
      break;
    }
    case 'fire': case 'move': case 'recon':
      throw new Error('请使用对应的手牌完成侦察、移动或攻击');
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
/** Enemy hulls are sent only as individual cells in live vision, or fully revealed wrecks. */
export function viewFor(game,playerId) {
  const me=game.players.findIndex(p=>p.id===playerId);requireRule(me!==-1,'你不在这个房间中');
  const own=game.players[me],other=game.players[1-me];
  const visible=other?visibleCells(own,other):new Set(),enemyCells=Array(100).fill('unknown'),enemySight=Array(100).fill(null);
  if(other) {
    for(const c of other.shots)if(!other.concealed.includes(c)) {
      const ship=other.ships.find(s=>s.hits.includes(c));
      enemyCells[c]=ship?(isSunk(other,ship)?'sunk':'hit'):(['immune','blocked'].includes(other.shotResults[c])?other.shotResults[c]:'miss');
    }
    for(const c of visible) {
      const ship=other.ships.find(s=>cells(s).includes(c));
      enemyCells[c]=ship?(isSunk(other,ship)?'sunk':ship.hits.includes(c)?'hit':'contact'):'clear';
      enemySight[c]=ship?{type:ship.type,damaged:ship.hits.includes(c),sunk:isSunk(other,ship)}:{empty:true};
    }
  }
  const knownTerrain=(terrain,known)=>terrain.map((t,c)=>t==='reef'&&!known.has(c)?'deep':t);
  const ownView=structuredClone(own);ownView.terrain=knownTerrain(own.terrain,new Set(own.knownOwnReefs));ownView.deckCount=own.deck.length;delete ownView.deck;
  const publicPlayer=p=>({id:p.id,name:p.name,ready:p.ready,confirmed:p.confirmed,rematch:p.rematch,actionPoints:p.actionPoints,handCount:p.hand.length,deckCount:p.deck.length});
  const enemyWrecks=other?other.ships.filter(s=>isSunk(other,s)&&cells(s).every(c=>!other.concealed.includes(c)||visible.has(c)))
    .map(s=>({type:s.type,length:s.length,width:s.width,x:s.x,y:s.y,vertical:s.vertical})):[];
  return {
    phase:game.phase,mapId:game.mapId,turn:game.turn,deadline:game.deadline,winner:game.winner,round:game.round,version:game.version,startedAt:game.startedAt,endedAt:game.endedAt,
    me,players:game.players.map(publicPlayer),own:ownView,enemyCells,enemySight,enemyVisible:[...visible],
    enemyTerrain:knownTerrain(other?other.terrain:terrainFor(game.mapId,1-me),visible),
    enemySunk:other?other.ships.filter(s=>isSunk(other,s)).map(s=>s.type):[],enemyWrecks,
    enemySmoke:other?[...new Set(other.smoke.filter(s=>other.turns<s.expiresTurn).flatMap(s=>s.cells))]:[],
    enemyRecon:[...visible].map(cell=>({cell,contact:!!enemySight[cell]&&!enemySight[cell].empty,stale:false})),rescanCells:[],
    airControl:game.airControl?{owner:game.airControl.owner,remaining:game.airControl.expiresTurn-game.players[game.airControl.owner].turns}:null,
    visionEffects:own.scans.filter(s=>own.turns<s.expiresTurn).map(s=>({cardType:s.cardType,remaining:s.expiresTurn-own.turns,cells:[...s.cells]})),
    history:structuredClone(game.history.slice(-200)),
  };
}
