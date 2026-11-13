/** Practice AI uses only its hand, own board and filtered enemy vision. */
import { CARD_TYPES, canUseCard, cardContext, shipAlive, sourceMatches } from './cards.mjs?v=5.0.0';
import { cells, radiusCells, reachableMoves } from './geometry.mjs?v=5.0.0';
import { torpedoRows } from './combat.mjs?v=5.0.0';
export function chooseBotAction(view,rng=Math.random) {
  const options=[],pick=items=>items[Math.min(items.length-1,Math.floor(rng()*items.length))];
  const knownContact=c=>view.enemySight[c]&&!view.enemySight[c].empty&&!view.enemySight[c].damaged&&!view.enemySight[c].sunk;
  const value=(c,secondary=false)=>knownContact(c)?secondary&&view.enemySight[c].type==='battleship'?-10:20:view.enemyCells[c]==='immune'?(secondary?-10:12):view.enemyCells[c]==='unknown'?2:view.enemyCells[c]==='clear'||view.enemyCells[c]==='miss'?0:-1;
  const bestCenter=(radius,secondary=false)=>Array.from({length:100},(_,c)=>({cell:c,score:radiusCells(c,radius).reduce((n,c)=>n+value(c,secondary),0)})).sort((a,b)=>b.score-a.score)[0];
  for(const card of view.own.hand.filter(card=>canUseCard(view.own,card,cardContext(view)))) {
    const d=CARD_TYPES[card.type],action={type:'play-card',cardId:card.id};let score=0;
    if(d.effect==='supply')score=1000;
    else if(d.effect==='draw')score=900;
    else if(d.effect==='repair') {
      const damaged=view.own.ships.find(s=>shipAlive(s)&&s.hits.length);if(!damaged)continue;action.cell=damaged.hits[0];score=150;
    } else if(d.effect==='air') {if(view.airControl?.owner===view.me&&view.airControl.remaining>1)continue;score=80;}
    else if(d.effect==='vision') {
      if(view.enemyVisible.length===100)continue;
      if(d.target!=='none')action.cell=bestCenter(d.radius).cell;
      score=d.target==='none'?110:50;
    } else if(d.effect==='recon') {
      const candidates=Array.from({length:100},(_,cell)=>({cell,score:radiusCells(cell,3).filter(c=>view.own.terrain[c]==='deep').length})).sort((a,b)=>b.score-a.score);
      action.cell=pick(candidates.slice(0,8)).cell;score=8;
    } else if(d.effect==='move'||d.effect==='smoke') {
      const candidates=view.own.ships.filter(s=>shipAlive(s)&&(d.effect!=='smoke'||sourceMatches(s,'escort'))).flatMap(ship=>[...reachableMoves(view.own,ship.id,d.range)]
        .filter(([cell,path])=>path.length&&view.own.terrain[cell]!=='reef'&&view.own.terrain[cell]!=='shoal').map(([cell])=>({id:ship.id,cell})));
      if(!candidates.length)continue;Object.assign(action,pick(candidates));score=d.effect==='smoke'?12:5;
    } else if(d.target==='enemy-many') {
      action.cells=Array.from({length:100},(_,c)=>c).sort((a,b)=>value(b,true)-value(a,true)).slice(0,10);score=45+action.cells.reduce((n,c)=>n+Math.max(0,value(c,true)),0);
    } else if(d.target==='enemy-row') {
      const rows=torpedoRows(view.own);if(!rows.length)continue;
      action.row=rows.map(row=>({row,score:Array.from({length:10},(_,x)=>value(row*10+x)).reduce((a,b)=>a+b,0)})).sort((a,b)=>b.score-a.score)[0].row;score=35;
    } else if(d.target==='enemy-line') {
      const center=bestCenter(0);action.cell=center.cell;action.end=center.cell%10<9?center.cell+1:center.cell-1;score=30+center.score;
    } else {
      const center=bestCenter(d.radius||0,d.effect==='secondary');action.cell=center.cell;score=40+center.score;
    }
    options.push({action,score});
  }
  return options.sort((a,b)=>b.score-a.score)[0]?.action||{type:'pass'};
}
