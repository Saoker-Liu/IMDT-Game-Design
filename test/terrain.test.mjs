import test from 'node:test';
import assert from 'node:assert/strict';
import { MAPS,terrainFor,REEF_RISK } from '../public/terrain.mjs';
import { makeGame,makePlayer,makeFleet,act,tick,cells,canPlace,isSunk,viewFor,PREP_MS } from '../public/engine.mjs';
import { shape,reachableMoves } from '../public/geometry.mjs';
import { giveHand,FIXED_PLACEMENTS } from '../test-support/cards.mjs';
function preparation(map='open-sea') {const g=makeGame([makePlayer('a','A'),makePlayer('b','B')],map);for(const p of g.players)act(g,p.id,{type:'ready'},1000);return g;}
function battle(){const g=preparation();for(const p of g.players){for(const [id,x,y]of FIXED_PLACEMENTS)act(g,p.id,{type:'place',id,x,y,vertical:false},1001);act(g,p.id,{type:'confirm'},1002);}return g;}

test('four terrain maps preserve mirrored shores and fit the full eleven-ship twenty-six-cell fleet',()=>{
  assert.ok(terrainFor().every(t=>t==='deep'));
  for(const map of MAPS){assert.deepEqual(terrainFor(map.id).toReversed(),terrainFor(map.id,1));for(let n=0;n<8;n++){
    const g=preparation(map.id);tick(g,1000+PREP_MS,()=>Math.random());assert.equal(g.phase,'battle');
    for(const p of g.players){const occupied=p.ships.flatMap(cells);assert.equal(occupied.length,26);assert.equal(new Set(occupied).size,26);assert.ok(occupied.every(c=>p.terrain[c]!=='rock'));}
  }}
});

test('carrier has six cells in either orientation and obeys full-rectangle collision and boundary rules',()=>{
  const p=makePlayer('a','A'),cv=p.ships.find(s=>s.type==='carrier');Object.assign(cv,{x:7,y:8});
  assert.deepEqual(cells(cv),[87,88,89,97,98,99]);assert.deepEqual(shape(cv),{width:3,height:2});
  assert.equal(canPlace(p.ships,cv.id,8,8,false),false);assert.equal(canPlace(p.ships,cv.id,7,8,true),false);
  Object.assign(cv,{x:8,y:7,vertical:true});assert.deepEqual(cells(cv),[78,79,88,89,98,99]);
  const frigate=p.ships.find(s=>s.type==='frigate');Object.assign(frigate,{x:9,y:9});assert.equal(canPlace(p.ships,cv.id,8,7,true),false);
  frigate.x=null;frigate.y=null;const terrain=terrainFor();terrain[89]='rock';assert.equal(canPlace(p.ships,cv.id,8,7,true,terrain),false);
});

test('partial carrier deployment is preserved during timed completion and the carrier is required before confirming',()=>{
  const g=preparation();act(g,'a',{type:'place',id:'CV-1',x:7,y:8,vertical:false},1001);tick(g,1000+PREP_MS);
  assert.deepEqual(cells(g.players[0].ships.find(s=>s.type==='carrier')),[87,88,89,97,98,99]);assert.equal(g.phase,'battle');
  const h=preparation();for(const [id,x,y]of FIXED_PLACEMENTS.filter(([id])=>id!=='CV-1'))act(h,'a',{type:'place',id,x,y,vertical:false},1001);
  assert.throws(()=>act(h,'a',{type:'confirm'},1002),/11/);
});

test('a six-cell carrier entering multiple reefs rolls only once for that movement step and discloses only actual newly entered reefs',()=>{
  const g=battle(),p=g.players[0],cv=p.ships.find(s=>s.type==='carrier');Object.assign(cv,{x:4,y:7,vertical:true});
  for(const c of [73,83,93])p.terrain[c]='reef';giveHand(p,['maneuver']);let rolls=0;
  act(g,'a',{type:'play-card',cardId:'maneuver-1',id:cv.id,cell:73},1100,()=>{rolls++;return REEF_RISK-.001;});
  assert.equal(rolls,1);assert.ok(isSunk(p,cv));assert.equal(cv.hits.length,6);assert.deepEqual(p.knownOwnReefs,[73,83,93]);
  assert.equal(viewFor(g,'a').own.terrain[74],'deep');assert.ok(viewFor(g,'b').enemyTerrain.every(t=>t==='deep'));
});

test('reef loss of the last living ship awards the opponent victory immediately',()=>{
  const g=battle(),p=g.players[0];for(const ship of p.ships)if(ship.id!=='FF-3')ship.hits=cells(ship);
  p.terrain[65]='reef';giveHand(p,['maneuver']);act(g,'a',{type:'play-card',cardId:'maneuver-1',id:'FF-3',cell:65},1100,()=>0);
  assert.equal(g.phase,'result');assert.equal(g.winner,1);assert.equal(g.deadline,null);
});

test('damaged, grounded and sunken ships cannot move; wreck rectangles remain obstacles',()=>{
  for(const state of ['hurt','grounded','sunk']){
    const g=battle(),p=g.players[0],ship=p.ships[0];if(state==='grounded')ship.grounded=true;else ship.hits=state==='sunk'?cells(ship):[0];
    assert.equal(reachableMoves(p,ship.id,100).size,0);
  }
});
