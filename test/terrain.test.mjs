import test from 'node:test';
import assert from 'node:assert/strict';
import { MAPS, terrainFor, REEF_RISK } from '../public/terrain.mjs';
import { makeGame, makePlayer, act, tick, cells, autoPlace, canMove, isSunk, viewFor, PREP_MS } from '../public/engine.mjs';

function preparation(map = 'open-sea') {
  const g = makeGame([makePlayer('a','甲'), makePlayer('b','乙')], map);
  act(g,'a',{type:'ready'},1000); act(g,'b',{type:'ready'},1000);
  return g;
}
function battle() {
  const g = preparation();
  const placements = [[0,0,false],[0,2,false],[5,2,false],[0,4,false],[3,4,false],[6,4,false],[0,6,false],[2,6,false],[4,6,false],[6,6,false]];
  for (const p of g.players) {
    p.ships.forEach((s,i) => { const [x,y,vertical]=placements[i]; act(g,p.id,{type:'place',id:s.id,x,y,vertical},1100); });
    act(g,p.id,{type:'confirm'},1100);
  }
  return g;
}
const move = (id,dx,dy) => ({type:'move',id,dx,dy});

test('four maps use deep water by default and rotate the opposing shore fairly',()=>{
  assert.ok(terrainFor().every(t=>t==='deep'));
  for (const m of MAPS) {
    const a=terrainFor(m.id),b=terrainFor(m.id,1);
    assert.equal(a.length,100);assert.deepEqual(a.toReversed(),b);
    assert.ok(a.every(t=>['deep','rock','reef','shoal'].includes(t)));
  }
  const shore=terrainFor('blue-frontier');
  for(let c=0;c<100;c++) assert.equal(shore[c],c%10<3?'shoal':'deep');
  assert.equal(terrainFor('archipelago').filter(t=>t==='rock').length,16);
  assert.ok(terrainFor('undertow').filter(t=>t==='reef').length>15);
  assert.throws(()=>makeGame([], 'missing'),/地图/);
});

test('rocks block deployment; random and timed completion preserve manual ships on every map',()=>{
  const blocked=preparation('archipelago');
  assert.throws(()=>act(blocked,'a',{type:'place',id:'BB-1',x:1,y:1,vertical:false},1100),/礁石/);
  assert.equal(blocked.players[0].ships[0].x,null);
  for (const m of MAPS) for(let n=0;n<12;n++) {
    const g=preparation(m.id);
    act(g,'a',{type:'place',id:'BB-1',x:0,y:9,vertical:false},1100);
    autoPlace(g.players[0]);
    assert.deepEqual(cells(g.players[0].ships[0]),[90,91,92,93]);
    tick(g,1000+PREP_MS);
    assert.equal(g.phase,'battle');
    for(const p of g.players) {
      const occupied=p.ships.flatMap(cells);
      assert.equal(new Set(occupied).size,20);
      assert.ok(occupied.every(c=>p.terrain[c]!=='rock'));
    }
  }
});

test('one-cell movement consumes a turn, preserves a whole hull, and rejects illegal movement atomically',()=>{
  const g=battle(),p=g.players[0];
  assert.throws(()=>act(g,'b',move('FF-3',1,0),1200),/等待/);
  for(const [dx,dy] of [[1,1],[2,0],[0,0],[.5,0]]) assert.throws(()=>act(g,'a',move('FF-3',dx,dy),1200));
  act(g,'a',move('FF-3',1,0),1200);
  assert.equal(p.ships.find(s=>s.id==='FF-3').x,5);assert.equal(g.turn,1);
  act(g,'b',{type:'pass'},1201);
  const version=g.version;
  assert.throws(()=>act(g,'a',move('FF-3',1,0),1202),/无法航行/);
  assert.equal(g.turn,0);assert.equal(g.version,version);
  assert.equal(p.ships.find(s=>s.id==='FF-3').x,5);
  p.terrain[64]='rock';assert.equal(canMove(p,'FF-3',-1,0),false);
  assert.throws(()=>act(g,'a',move('FF-3',-1,0),1202),/礁石/);
  assert.equal(canMove(p,'BB-1',-1,0),false);
});

test('a moved ship entering an old miss is neither damaged nor revealed; that cell can be scanned again',()=>{
  const g=battle(),enemy=g.players[1],ship=enemy.ships.find(s=>s.id==='FF-3');
  act(g,'a',{type:'fire',cell:65},1200);
  act(g,'b',move('FF-3',1,0),1201);
  let view=viewFor(g,'a');
  assert.deepEqual(ship.hits,[]);assert.equal(view.enemyCells[65],'miss');
  assert.ok(view.rescanCells.includes(65));assert.deepEqual(view.enemyWrecks,[]);
  const event=view.history.at(-1);
  assert.deepEqual(Object.keys(event).sort(),['at','id','playerId','type']);
  assert.equal(view.players[1].ships,undefined);
  act(g,'a',{type:'fire',cell:65},1202);
  view=viewFor(g,'a');assert.equal(view.enemyCells[65],'sunk');
  assert.equal(isSunk(enemy,ship),true);
});

test('damaged ships cannot move and incoming damage stays at the hit hull',()=>{
  const g=battle();act(g,'a',{type:'pass'},1200);act(g,'b',{type:'fire',cell:0},1201);
  assert.equal(canMove(g.players[0],'BB-1',0,1),false);
  assert.throws(()=>act(g,'a',move('BB-1',0,1),1202),/中弹/);
  assert.deepEqual(g.players[0].ships[0].hits,[0]);
});

test('reef risk is rolled once per maneuver, including a long ship entering several reef cells',()=>{
  const g=battle(),p=g.players[0];
  for(const c of [10,11,12,13]) p.terrain[c]='reef';
  let rolls=0;act(g,'a',move('BB-1',0,1),1200,()=>{rolls++;return REEF_RISK-.001;});
  assert.equal(rolls,1);assert.equal(isSunk(p,p.ships[0]),true);
  assert.deepEqual(p.ships[0].hits,[10,11,12,13]);
  assert.equal(p.ships[0].sunkBy,'reef');assert.equal(g.turn,1);
  const view=viewFor(g,'b');assert.equal(view.enemyWrecks.length,1);
  assert.ok([10,11,12,13].every(c=>view.enemyCells[c]==='sunk'));
  const safe=battle();safe.players[0].terrain[65]='reef';
  act(safe,'a',move('FF-3',1,0),1200,()=>REEF_RISK);
  assert.equal(isSunk(safe.players[0],safe.players[0].ships.find(s=>s.id==='FF-3')),false);
});

test('a last ship wrecked by a reef ends the battle and awards the opponent victory',()=>{
  const g=battle(),p=g.players[0];
  for(const s of p.ships) if(s.id!=='FF-3') s.hits=cells(s);
  p.terrain[65]='reef';act(g,'a',move('FF-3',1,0),1200,()=>0);
  assert.equal(g.phase,'result');assert.equal(g.winner,1);assert.equal(g.deadline,null);
});

test('entering a new shoal grounds a ship permanently; shallow-water deployment itself is safe',()=>{
  const g=battle(),p=g.players[0],s=p.ships.find(s=>s.id==='FF-3');
  p.terrain[64]='shoal';p.terrain[65]='shoal';
  assert.equal(canMove(p,s.id,1,0),true);
  act(g,'a',move(s.id,1,0),1200);assert.equal(s.grounded,true);assert.equal(g.turn,1);
  act(g,'b',{type:'pass'},1201);
  assert.throws(()=>act(g,'a',move(s.id,-1,0),1202),/搁浅/);
  assert.equal(s.x,5);assert.equal(s.hits.length,0);
  const view=viewFor(g,'b');assert.deepEqual(view.enemyWrecks,[]);assert.equal(view.enemyCells[65],'unknown');
});

test('deep-water torpedoes sink the full ship, while other terrain takes one segment of damage',()=>{
  const g=battle();act(g,'a',{type:'fire',cell:0,weapon:'torpedo'},1200);
  assert.equal(g.players[0].torpedoes,2);assert.equal(isSunk(g.players[1],g.players[1].ships[0]),true);
  assert.ok([0,1,2,3].every(c=>viewFor(g,'a').enemyCells[c]==='sunk'));
  assert.equal(viewFor(g,'a').history.at(-1).weapon,'torpedo');
  for(const type of ['shoal','reef']) {
    const h=battle();h.players[1].terrain[0]=type;
    act(h,'a',{type:'fire',cell:0,weapon:'torpedo'},1200);
    assert.deepEqual(h.players[1].ships[0].hits,[0]);assert.equal(isSunk(h.players[1],h.players[1].ships[0]),false);
    act(h,'b',{type:'pass'},1201);act(h,'a',{type:'fire',cell:1,weapon:'torpedo'},1202);
    assert.equal(isSunk(h.players[1],h.players[1].ships[0]),true);
  }
});

test('torpedoes are finite and invalid shots spend neither ammunition nor turns',()=>{
  const g=battle();
  for(let n=0;n<3;n++) {act(g,'a',{type:'fire',cell:90+n,weapon:'torpedo'},1200+n*2);act(g,'b',{type:'pass'},1201+n*2);}
  assert.equal(g.players[0].torpedoes,0);
  assert.throws(()=>act(g,'a',{type:'fire',cell:95,weapon:'torpedo'},1210),/用尽/);
  assert.equal(g.turn,0);assert.equal(g.players[1].shots.includes(95),false);
  assert.throws(()=>act(g,'a',{type:'fire',cell:95,weapon:'laser'},1210),/武器/);
  act(g,'a',{type:'fire',cell:95},1211);assert.equal(g.turn,1);
});

test('terrain and view data are copied; rematches preserve the map and restore ships/ammunition',()=>{
  const g=preparation('blue-frontier'),view=viewFor(g,'a');
  view.enemyTerrain[99]='rock';assert.notEqual(g.players[1].terrain[99],'rock');
  g.phase='result';g.players[0].torpedoes=0;
  act(g,'a',{type:'rematch'},1200);act(g,'b',{type:'rematch'},1201);
  assert.equal(g.mapId,'blue-frontier');assert.equal(g.phase,'lobby');
  assert.ok(g.players.every(p=>p.torpedoes===3&&p.ships.every(s=>!s.grounded&&!s.hits.length)));
  assert.deepEqual(g.players[1].terrain,terrainFor('blue-frontier',1));
});
