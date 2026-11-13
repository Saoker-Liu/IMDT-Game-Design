/** Practice AI consumes the same private view, cards and AP as a human client. */
import { canMove } from './engine.mjs?v=4.0.0';
import { CARD_TYPES, canUseCard } from './cards.mjs?v=4.0.0';

export function chooseBotAction(view, rng = Math.random) {
  const pick = items => items[Math.min(items.length - 1, Math.floor(rng() * items.length))];
  const playable = view.own.hand.filter(card => canUseCard(view.own, card));
  const targetable = c => view.enemyTerrain[c] !== 'rock' && (view.enemyCells[c] === 'unknown' || view.rescanCells.includes(c));
  const targets = Array.from({length:100},(_,c)=>c).filter(targetable);
  const scores = new Map();
  for (const info of view.enemyRecon) if (info.contact && targetable(info.cell)) scores.set(info.cell, info.stale ? 1 : 10);
  for (let c = 0; c < 100; c++) if (view.enemyCells[c] === 'hit') {
    for (const n of [c-10,c+10,...(c%10?[c-1]:[]),...(c%10<9?[c+1]:[])]) {
      if (targetable(n) && n >= 0 && n < 100) scores.set(n,(scores.get(n)||0)+2);
    }
  }
  const attacks = playable.filter(c => CARD_TYPES[c.type].effect === 'fire');
  const scouts = playable.filter(c => c.type === 'recon');
  const reconTargets = targets.filter(c => !view.enemyRecon.some(info => info.cell === c && !info.stale));
  if (scouts.length && reconTargets.length && (!attacks.length || (!scores.size && rng() < .3))) {
    return {type:'play-card',cardId:scouts[0].id,cell:pick(reconTargets)};
  }
  if (attacks.length && targets.length) {
    const cell = scores.size ? [...scores].sort((a,b)=>b[1]-a[1])[0][0] : pick(targets);
    const torpedo = attacks.find(c=>c.type==='torpedo');
    const card = torpedo && view.enemyTerrain[cell]==='deep' && (scores.size || rng()<.3) ? torpedo : attacks.find(c=>c.type==='shell') || attacks[0];
    return {type:'play-card',cardId:card.id,cell};
  }
  const move = playable.find(c=>c.type==='move');
  if (move) {
    const moves = view.own.ships.flatMap(ship => [[1,0],[-1,0],[0,1],[0,-1]]
      .filter(([dx,dy])=>canMove(view.own,ship.id,dx,dy))
      .map(([dx,dy])=>({type:'play-card',cardId:move.id,id:ship.id,dx,dy})));
    if (moves.length) return pick(moves);
  }
  return {type:'pass'};
}
