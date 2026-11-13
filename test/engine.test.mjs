import { scenarioAct } from '../test-support/cards.mjs';
import test from 'node:test';
import assert from 'node:assert/strict';
import { makeFleet, makeGame, makePlayer, tick, cells, canPlace, autoPlace, isSunk, viewFor, PREP_MS, TURN_MS } from '../public/engine.mjs';

function game(now=1000) {
  const g=makeGame([makePlayer('a','甲'),makePlayer('b','乙')]);
  scenarioAct(g,'a',{type:'ready'},now);scenarioAct(g,'b',{type:'ready'},now);
  return g;
}
function battle() {
  const g=game();
  for(const id of ['a','b']){scenarioAct(g,id,{type:'auto'},1100);scenarioAct(g,id,{type:'confirm'},1100);}
  return g;
}
test('fleet has the exact ten ships and twenty occupied cells',()=>{
  const ships=makeFleet();assert.equal(ships.length,10);assert.equal(ships.reduce((n,s)=>n+s.length,0),20);
  assert.deepEqual([1,2,3,4].map(n=>ships.filter(s=>s.length===n).length),[4,3,2,1]);
});
test('both lobby players must ready before the 90 second deployment starts',()=>{
  const g=makeGame([makePlayer('a','甲'),makePlayer('b','乙')]);
  scenarioAct(g,'a',{type:'ready'},100);assert.equal(g.phase,'lobby');assert.equal(g.deadline,null);
  scenarioAct(g,'b',{type:'ready'},200);assert.equal(g.phase,'placement');assert.equal(g.deadline,200+PREP_MS);
  assert.ok(g.players.every(p=>p.ships.every(s=>s.x===null)));
});
test('placement rejects collision, overflow, bad coordinates and bad orientation',()=>{
  const g=game();scenarioAct(g,'a',{type:'place',id:'BB-1',x:0,y:0,vertical:false},1001);
  for(const patch of [{id:'CG-1',x:2,y:0,vertical:true},{id:'BB-1',x:9,y:0,vertical:false},{id:'BB-1',x:-1,y:0,vertical:false},{id:'BB-1',x:.5,y:0,vertical:false},{id:'BB-1',x:0,y:0,vertical:'yes'}])
    assert.throws(()=>scenarioAct(g,'a',{type:'place',...patch},1002));
  assert.ok(canPlace(g.players[0].ships,'BB-1',0,0,true));
  scenarioAct(g,'a',{type:'place',id:'BB-1',x:0,y:0,vertical:true},1002);
  assert.deepEqual(cells(g.players[0].ships[0]),[0,10,20,30]);
});
test('random completion preserves manual ships and creates 20 distinct legal cells',()=>{
  for(let iteration=0;iteration<100;iteration++){
    const p=makePlayer('a','甲');Object.assign(p.ships[0],{x:6,y:3,vertical:false});autoPlace(p,true);
    assert.deepEqual(cells(p.ships[0]),[36,37,38,39]);
    const all=p.ships.flatMap(cells);assert.equal(new Set(all).size,20);assert.ok(all.every(c=>c>=0&&c<100));
  }
});
test('confirmation requires all ships; a confirmed fleet cannot be changed',()=>{
  const g=game();assert.throws(()=>scenarioAct(g,'a',{type:'confirm'},1001),/10/);
  scenarioAct(g,'a',{type:'auto'},1001);scenarioAct(g,'a',{type:'confirm'},1002);assert.equal(g.phase,'placement');
  for(const type of ['clear','auto','remove','place'])assert.throws(()=>scenarioAct(g,'a',{type,id:'BB-1',x:0,y:0,vertical:false},1003));
  scenarioAct(g,'b',{type:'auto'},1003);scenarioAct(g,'b',{type:'confirm'},1004);
  assert.equal(g.phase,'battle');assert.equal(g.turn,0);assert.equal(g.deadline,1004+TURN_MS);
});
test('90 second deadline fills only missing ships and starts battle',()=>{
  const g=game();scenarioAct(g,'a',{type:'place',id:'BB-1',x:0,y:0,vertical:false},1001);
  assert.equal(tick(g,1000+PREP_MS-1),false);assert.equal(tick(g,1000+PREP_MS),true);
  assert.equal(g.phase,'battle');assert.deepEqual(cells(g.players[0].ships[0]),[0,1,2,3]);
  assert.ok(g.players.every(p=>p.confirmed&&new Set(p.ships.flatMap(cells)).size===20));
});
test('fog redacts unhit enemy locations in all phases, including results',()=>{
  const g=battle();const v=viewFor(g,'a');
  assert.equal(v.enemyCells.filter(c=>c==='unknown').length,100);
  assert.equal(v.players[1].ships,undefined);assert.equal(v.players[1].shots,undefined);assert.equal(v.enemy,undefined);
  assert.equal(v.own.ships.length,10);
  assert.deepEqual(v.enemyWrecks,[]);
  // Mutating a view must never mutate the game itself.
  v.own.ships[0].x=999;assert.notEqual(g.players[0].ships[0].x,999);
});
test('hit on the last AP reveals one segment, switches turns and hides ship identity',()=>{
  const g=battle(),c=cells(g.players[1].ships[0])[0];
  scenarioAct(g,'a',{type:'fire',cell:c},1200);
  assert.equal(g.turn,1);assert.equal(g.deadline,1200+TURN_MS);
  const v=viewFor(g,'a');assert.equal(v.enemyCells[c],'hit');assert.equal(v.enemyCells.filter(c=>c!=='unknown').length,1);
  assert.equal(v.history.at(-1).shipType,undefined);
  assert.deepEqual(v.enemyWrecks,[]);
  assert.throws(()=>scenarioAct(g,'a',{type:'fire',cell:99},1201),/等待/);
});
test('a missed shot reveals water, duplicates and invalid coordinates consume no turn',()=>{
  const g=battle();const occupied=g.players[1].ships.flatMap(cells);const c=Array.from({length:100},(_,n)=>n).find(c=>!occupied.includes(c));
  scenarioAct(g,'a',{type:'fire',cell:c},1200);assert.equal(viewFor(g,'a').enemyCells[c],'miss');
  scenarioAct(g,'b',{type:'pass'},1201);
  for(const cell of [c,-1,100,1.5,'1'])assert.throws(()=>scenarioAct(g,'a',{type:'fire',cell},1202));
  assert.equal(g.turn,0);assert.equal(g.players[1].shots.length,1);
});
test('a ship becomes wreckage only after all of its segments are hit',()=>{
  const g=battle(),ship=g.players[1].ships[0],targets=cells(ship);
  targets.forEach((c,i)=>{scenarioAct(g,'a',{type:'fire',cell:c},1200+i*2);if(i<targets.length-1){assert.equal(isSunk(g.players[1],ship),false);scenarioAct(g,'b',{type:'pass'},1201+i*2);}});
  assert.equal(isSunk(g.players[1],ship),true);
  assert.ok(targets.every(c=>viewFor(g,'a').enemyCells[c]==='sunk'));
  assert.deepEqual(viewFor(g,'a').enemySunk,['battleship']);
  const wrecks=viewFor(g,'a').enemyWrecks;
  assert.deepEqual(wrecks,[{type:ship.type,length:ship.length,x:ship.x,y:ship.y,vertical:ship.vertical}]);
  assert.ok(wrecks.flatMap(cells).every(c=>viewFor(g,'a').enemyCells[c]==='sunk'));
  wrecks[0].x=999;assert.notEqual(ship.x,999);
});
test('10 second deadline skips a turn; an attack arriving at the deadline is rejected',()=>{
  const g=battle(),deadline=g.deadline;
  assert.throws(()=>scenarioAct(g,'a',{type:'fire',cell:50},deadline),/等待/);
  assert.equal(g.turn,1);assert.equal(g.round,2);assert.equal(g.players[1].shots.length,0);
  assert.equal(g.deadline,deadline+TURN_MS);assert.equal(g.history.at(-1).type,'timeout');
});
test('destroying the entire fleet ends the match; both players must agree to rematch',()=>{
  const g=battle();const targets=g.players[1].ships.flatMap(cells);
  for(const [i,c] of targets.entries()){scenarioAct(g,'a',{type:'fire',cell:c},1200+i*2);if(i<targets.length-1)scenarioAct(g,'b',{type:'pass'},1201+i*2);}
  assert.equal(g.phase,'result');assert.equal(g.winner,0);assert.equal(g.deadline,null);
  assert.equal(viewFor(g,'a').enemySunk.length,10);
  assert.throws(()=>scenarioAct(g,'b',{type:'fire',cell:99},1300));
  scenarioAct(g,'a',{type:'rematch'},1300);assert.equal(g.phase,'result');
  const version=g.version;scenarioAct(g,'b',{type:'rematch'},1301);
  assert.equal(g.phase,'lobby');assert.ok(g.version>version);assert.ok(g.players.every(p=>!p.ready&&p.shots.length===0&&p.ships.every(s=>s.x===null)));
});
