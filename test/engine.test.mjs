import { giveHand } from '../test-support/cards.mjs';
import test from 'node:test';
import assert from 'node:assert/strict';
import { makeFleet, makeGame, makePlayer, act, tick, cells, canPlace, autoPlace, isSunk, viewFor, PREP_MS, TURN_MS } from '../public/engine.mjs';

function game(now=1000) {
  const g=makeGame([makePlayer('a','甲'),makePlayer('b','乙')]);
  act(g,'a',{type:'ready'},now);act(g,'b',{type:'ready'},now);
  return g;
}
function battle() {
  const g=game();
  for(const id of ['a','b']){act(g,id,{type:'auto'},1100);act(g,id,{type:'confirm'},1100);}
  return g;
}
test('fleet has the eleven ships including a rotatable six-cell carrier',()=>{
  const ships=makeFleet();assert.equal(ships.length,11);assert.equal(ships.reduce((n,s)=>n+s.length*(s.width||1),0),26);
  assert.deepEqual([1,2,3,4].map(n=>ships.filter(s=>s.width===1&&s.length===n).length),[4,3,2,1]);
});
test('both lobby players must ready before the 90 second deployment starts',()=>{
  const g=makeGame([makePlayer('a','甲'),makePlayer('b','乙')]);
  act(g,'a',{type:'ready'},100);assert.equal(g.phase,'lobby');assert.equal(g.deadline,null);
  act(g,'b',{type:'ready'},200);assert.equal(g.phase,'placement');assert.equal(g.deadline,200+PREP_MS);
  assert.ok(g.players.every(p=>p.ships.every(s=>s.x===null)));
});
test('placement rejects collision, overflow, bad coordinates and bad orientation',()=>{
  const g=game();act(g,'a',{type:'place',id:'BB-1',x:0,y:0,vertical:false},1001);
  for(const patch of [{id:'CG-1',x:2,y:0,vertical:true},{id:'BB-1',x:9,y:0,vertical:false},{id:'BB-1',x:-1,y:0,vertical:false},{id:'BB-1',x:.5,y:0,vertical:false},{id:'BB-1',x:0,y:0,vertical:'yes'}])
    assert.throws(()=>act(g,'a',{type:'place',...patch},1002));
  assert.ok(canPlace(g.players[0].ships,'BB-1',0,0,true));
  act(g,'a',{type:'place',id:'BB-1',x:0,y:0,vertical:true},1002);
  assert.deepEqual(cells(g.players[0].ships[0]),[0,10,20,30]);
});
test('random completion preserves manual ships and creates 26 distinct legal cells',()=>{
  for(let iteration=0;iteration<100;iteration++){
    const p=makePlayer('a','甲');Object.assign(p.ships[0],{x:6,y:3,vertical:false});autoPlace(p,true);
    assert.deepEqual(cells(p.ships[0]),[36,37,38,39]);
    const all=p.ships.flatMap(cells);assert.equal(new Set(all).size,26);assert.ok(all.every(c=>c>=0&&c<100));
  }
});
test('confirmation requires all ships; a confirmed fleet cannot be changed',()=>{
  const g=game();assert.throws(()=>act(g,'a',{type:'confirm'},1001),/11/);
  act(g,'a',{type:'auto'},1001);act(g,'a',{type:'confirm'},1002);assert.equal(g.phase,'placement');
  for(const type of ['clear','auto','remove','place'])assert.throws(()=>act(g,'a',{type,id:'BB-1',x:0,y:0,vertical:false},1003));
  act(g,'b',{type:'auto'},1003);act(g,'b',{type:'confirm'},1004);
  assert.equal(g.phase,'battle');assert.equal(g.turn,0);assert.equal(g.deadline,1004+TURN_MS);
});
test('90 second deadline fills only missing ships and starts battle',()=>{
  const g=game();act(g,'a',{type:'place',id:'BB-1',x:0,y:0,vertical:false},1001);
  assert.equal(tick(g,1000+PREP_MS-1),false);assert.equal(tick(g,1000+PREP_MS),true);
  assert.equal(g.phase,'battle');assert.deepEqual(cells(g.players[0].ships[0]),[0,1,2,3]);
  assert.ok(g.players.every(p=>p.confirmed&&new Set(p.ships.flatMap(cells)).size===26));
});
test('fog redacts unhit enemy locations in all phases, including results',()=>{
  const g=battle();const v=viewFor(g,'a');
  assert.equal(v.enemyCells.filter(c=>c==='unknown').length,100);
  assert.equal(v.players[1].ships,undefined);assert.equal(v.players[1].shots,undefined);assert.equal(v.enemy,undefined);
  assert.equal(v.own.ships.length,11);
  assert.deepEqual(v.enemyWrecks,[]);
  // Mutating a view must never mutate the game itself.
  v.own.ships[0].x=999;assert.notEqual(g.players[0].ships[0].x,999);
});
test('a late card is rejected after timeout without applying its damage or drawing twice',()=>{
  const g=battle();giveHand(g.players[0],['secondary']);const deadline=g.deadline;
  assert.throws(()=>act(g,'a',{type:'play-card',cardId:'secondary-1',cell:50},deadline),/等待/);
  assert.equal(g.turn,1);assert.equal(g.round,2);assert.equal(g.players[1].shots.length,0);
  const count=g.players[1].hand.length;assert.equal(tick(g,deadline),false);assert.equal(g.players[1].hand.length,count);
});

test('the final enemy segment settles immediately, and rematch resets fleet, cards, vision and air control',()=>{
  const g=battle(),target=g.players[1];giveHand(g.players[0],['main']);
  for(const ship of target.ships)ship.hits=cells(ship);
  const last=target.ships[0],cell=cells(last)[0];last.hits=last.hits.filter(c=>c!==cell);
  act(g,'a',{type:'play-card',cardId:'main-1',cell},1200);
  assert.equal(g.phase,'result');assert.equal(g.winner,0);assert.equal(g.deadline,null);assert.equal(viewFor(g,'a').enemySunk.length,11);
  act(g,'a',{type:'rematch'},1300);act(g,'b',{type:'rematch'},1301);
  assert.equal(g.phase,'lobby');assert.equal(g.airControl,null);
  for(const p of g.players){assert.equal(p.deck.length,20);assert.equal(p.hand.length,0);assert.equal(p.ships.length,11);assert.deepEqual(p.scans,[]);assert.deepEqual(p.knownOwnReefs,[]);}
});
