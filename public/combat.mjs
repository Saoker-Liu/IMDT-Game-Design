import { CARD_TYPES, shipAlive, sourceMatches, unavailableReason, drawCards } from './cards.mjs?v=5.0.0';
import { cells, isSunk, validCell, radiusCells, hullRadius, reachableMoves, lineCells } from './geometry.mjs?v=5.0.0';
import { REEF_RISK } from './terrain.mjs?v=5.0.0';

const rule=(ok,message)=>{if(!ok)throw new Error(message);};
const emit=(game,event,now)=>game.history.push({id:game.history.length+1,at:now,...event});
export function nearestSource(player,requirement,target,index=0) {
  const x=target%10+(1-index)*10,y=Math.floor(target/10);
  return player.ships.filter(s=>shipAlive(s)&&sourceMatches(s,requirement)).map(ship=>({ship,
    distance:Math.min(...cells(ship).map(c=>(c%10+index*10-x)**2+(Math.floor(c/10)-y)**2))
  })).sort((a,b)=>a.distance-b.distance||a.ship.id.localeCompare(b.ship.id))[0]?.ship;
}
export function torpedoRows(player) {
  return [...new Set(player.ships.filter(s=>shipAlive(s)&&sourceMatches(s,'escort')).flatMap(s=>cells(s).map(c=>Math.floor(c/10))))].sort((a,b)=>a-b);
}
function frontEscort(player,row,index) {
  return player.ships.filter(s=>shipAlive(s)&&sourceMatches(s,'escort')&&cells(s).some(c=>Math.floor(c/10)===row))
    .sort((a,b)=>{
      const edge=s=>index?Math.min(...cells(s).map(c=>c%10)):Math.max(...cells(s).map(c=>c%10));
      return (index?edge(a)-edge(b):edge(b)-edge(a))||a.id.localeCompare(b.id);
    })[0];
}
export function prepareCard(game,index,action) {
  const player=game.players[index],card=player.hand.find(c=>c.id===action.cardId);
  rule(card,'这张卡牌不在你的手牌中');
  const d=CARD_TYPES[card.type];
  const reason=unavailableReason(player,card,{enemyAirControl:!!game.airControl&&game.airControl.owner!==index});
  rule(!reason,reason);
  const plan={card,d,cell:action.cell,sources:[],targets:[],rays:[]};
  if(['enemy-cell','own-cell','own-hit','enemy-line','own-move'].includes(d.target))rule(validCell(action.cell),'请选择有效的目标单元格');
  if(d.target==='enemy-many') {
    rule(Array.isArray(action.cells)&&action.cells.length===10&&new Set(action.cells).size===10&&action.cells.every(validCell),'弹幕需要选择 10 个不同的有效单元格');
    plan.targets=[...action.cells];
  } else if(d.target==='enemy-row') {
    rule(Number.isInteger(action.row)&&torpedoRows(player).includes(action.row),'该行没有存活的己方驱逐舰或护卫舰');
    const source=frontEscort(player,action.row,index);plan.sources=[source.id];
    for(let row=action.row-(d.spread||0);row<=action.row+(d.spread||0);row++)if(row>=0&&row<10)
      plan.rays.push(Array.from({length:10},(_,x)=>row*10+(index?9-x:x)));
  } else if(d.target==='enemy-line') {
    rule(validCell(action.end)&&action.end!==action.cell,'请选择与起点不同的鱼雷终点');
    plan.rays=[lineCells(action.cell,action.end)];
  } else if(d.target==='own-move') {
    const ship=player.ships.find(s=>s.id===action.id);
    rule(ship&&shipAlive(ship),'请选择存活的己方舰艇');
    if(d.effect==='smoke')rule(sourceMatches(ship,'escort'),'烟雾发生器只能选择驱逐舰或护卫舰');
    const same=action.cell===ship.y*10+ship.x;
    const path=reachableMoves(player,ship.id,d.range).get(action.cell);
    rule((d.effect==='smoke'&&same)||!!path?.length,'无法抵达：超出航程、舰体受损、搁浅，或航道被礁石/舰艇阻挡');
    plan.id=ship.id;plan.path=path||[];
  } else if(d.target==='own-hit') {
    const ship=player.ships.find(s=>cells(s).includes(action.cell));
    rule(ship&&shipAlive(ship)&&ship.hits.includes(action.cell),'只能修复尚未沉没舰艇的一个中弹部位');
    plan.id=ship.id;
  }
  if(d.target==='enemy-cell')plan.targets=radiusCells(action.cell,d.radius||0);
  if(['secondary','main','bomb'].includes(d.effect)) {
    const centers=d.target==='enemy-many'?plan.targets:[action.cell];
    plan.sources=centers.map(c=>nearestSource(player,d.requires,c,index).id);
  } else if(d.requires&&d.requires!=='damaged'&&!plan.sources.length&&!['move','smoke'].includes(d.effect)) {
    plan.sources=[nearestSource(player,d.requires,validCell(action.cell)?action.cell:45,index).id];
  }
  return plan;
}
export function sink(player,ship,cause) {
  ship.hits=cells(ship);ship.sunkBy=cause;
  for(const c of ship.hits){if(!player.shots.includes(c))player.shots.push(c);player.concealed=player.concealed.filter(n=>n!==c);}
}
function strike(target,c,weapon,round) {
  const ship=target.ships.find(s=>cells(s).includes(c));
  const status=target.terrain[c]==='rock'?'blocked':ship&&isSunk(target,ship)?'sunk':ship&&weapon==='secondary'&&ship.type==='battleship'?'immune':ship?'hit':'miss';
  if(!target.shots.includes(c))target.shots.push(c);
  target.shotRounds[c]=round;target.concealed=target.concealed.filter(n=>n!==c);
  if(status==='hit') {
    if(!ship.hits.includes(c))ship.hits.push(c);
    if(weapon==='torpedo'&&target.terrain[c]==='deep')sink(target,ship,'torpedo');
    if(isSunk(target,ship))sink(target,ship,weapon);
  }
  target.shotResults[c]=status==='hit'&&isSunk(target,ship)?'sunk':status;
  return {cell:c,result:target.shotResults[c],...(ship&&isSunk(target,ship)?{shipType:ship.type}:{})};
}
function traceTorpedo(target,ray,round,rng) {
  const trace=[],results=[];
  for(const c of ray) {
    trace.push(c);
    const ship=target.ships.find(s=>cells(s).includes(c));
    if(target.terrain[c]==='rock'||(ship&&isSunk(target,ship))){results.push(strike(target,c,'torpedo',round));break;}
    if(target.terrain[c]==='reef'&&rng()<REEF_RISK) {
      if(!target.shots.includes(c))target.shots.push(c);
      target.shotRounds[c]=round;target.shotResults[c]='blocked';target.concealed=target.concealed.filter(n=>n!==c);
      results.push({cell:c,result:'blocked'});break;
    }
    results.push(strike(target,c,'torpedo',round));
    if(ship)break;
  }
  return {trace,results};
}
function maneuver(player,ship,path,round,rng) {
  const visited=[],origin=hullRadius(ship,2);let event='move';
  for(const position of path) {
    const old=cells(ship);ship.x=position%10;ship.y=Math.floor(position/10);visited.push(position);
    const entered=cells(ship).filter(c=>!old.includes(c)),reefs=entered.filter(c=>player.terrain[c]==='reef');
    player.lastMove=round;
    if(reefs.length&&rng()<REEF_RISK) {
      player.knownOwnReefs=[...new Set([...player.knownOwnReefs,...reefs])];sink(player,ship,'reef');event='reef-sunk';break;
    }
    if(entered.some(c=>player.terrain[c]==='shoal')){ship.grounded=true;event='grounded';break;}
  }
  return {visited,origin,event};
}
export function resolveCard(game,index,plan,now,rng) {
  const player=game.players[index],target=game.players[1-index],{card,d}=plan;
  const receipt={id:game.version+1,at:now,cardType:card.type,sources:[...new Set(plan.sources)],results:[],traces:[]};
  if(['secondary','main','bomb'].includes(d.effect)) {
    receipt.results=plan.targets.map(c=>strike(target,c,d.effect,game.round));
  } else if(d.effect==='torpedo') {
    for(const ray of plan.rays){const result=traceTorpedo(target,ray,game.round,rng);receipt.results.push(...result.results);receipt.traces.push(result.trace);}
  } else if(d.effect==='draw')drawCards(player,2);
  else if(d.effect==='supply')player.actionPoints+=2;
  else if(d.effect==='recon') {
    receipt.cells=radiusCells(plan.cell,3);
    player.knownOwnReefs=[...new Set([...player.knownOwnReefs,...receipt.cells.filter(c=>player.terrain[c]==='reef')])];
  } else if(d.effect==='vision') {
    player.scans.push({cells:d.target==='none'?Array.from({length:100},(_,c)=>c):plan.targets,expiresTurn:player.turns+d.duration,cardType:card.type});
  } else if(d.effect==='air')game.airControl={owner:index,expiresTurn:player.turns+d.duration};
  else if(d.effect==='repair') {
    const ship=player.ships.find(s=>s.id===plan.id);ship.hits=ship.hits.filter(c=>c!==plan.cell);
    player.shots=player.shots.filter(c=>c!==plan.cell);delete player.shotRounds[plan.cell];delete player.shotResults[plan.cell];
  } else if(['move','smoke'].includes(d.effect)) {
    const ship=player.ships.find(s=>s.id===plan.id);
    const moved=maneuver(player,ship,plan.path,game.round,rng);
    receipt.path=moved.visited;receipt.shipId=ship.id;
    if(d.effect==='smoke') {
      const area=[...new Set([...moved.origin,...hullRadius(ship,2)])];
      player.smoke.push({cells:area,expiresTurn:player.turns+1});
      player.concealed=[...new Set([...player.concealed,...area])];
    }
    emit(game,{type:moved.event,playerId:player.id,...(moved.event==='reef-sunk'?{shipType:ship.type}:{})},now);
  }
  player.stats.attacks+=receipt.results.length;player.stats.hits+=receipt.results.filter(r=>['hit','sunk'].includes(r.result)).length;
  if(receipt.results.length)emit(game,{type:'strike',playerId:player.id,cardType:card.type,results:receipt.results},now);
  else emit(game,{type:'card',playerId:player.id,cardType:card.type},now);
  player.lastAction=receipt;
}

export function visibleCells(viewer,target) {
  const smoke=new Set(target.smoke.filter(s=>target.turns<s.expiresTurn).flatMap(s=>s.cells));
  return new Set(viewer.scans.filter(s=>viewer.turns<s.expiresTurn).flatMap(s=>s.cells).filter(c=>!smoke.has(c)));
}
