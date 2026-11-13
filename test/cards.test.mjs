import test from 'node:test';
import assert from 'node:assert/strict';
import { makeGame,makePlayer,act,tick,cells,isSunk,viewFor,canPlace } from '../public/engine.mjs';
import { CARD_TYPES,makeDeck,dealCards,canUseCard,cardContext } from '../public/cards.mjs';
import { radiusCells,shape,reachableMoves,lineCells } from '../public/geometry.mjs';
import { nearestSource,prepareCard,torpedoRows } from '../public/combat.mjs';
import { chooseBotAction } from '../public/bot.mjs';
import { giveHand,FIXED_PLACEMENTS } from '../test-support/cards.mjs';
export function fixture(map='open-sea') {
  const g=makeGame([makePlayer('a','甲'),makePlayer('b','乙')],map);
  for(const id of ['a','b'])act(g,id,{type:'ready'},1000);
  for(const p of g.players){for(const [id,x,y]of FIXED_PLACEMENTS)act(g,p.id,{type:'place',id,x,y,vertical:false},1001);act(g,p.id,{type:'confirm'},1002,()=>0);}
  return g;
}
const play=(g,type,fields={},index=0,rng=()=>1)=>act(g,g.players[index].id,{type:'play-card',cardId:`${type}-1`,...fields},1100,rng);
const cycle=g=>{if(g.turn===0)act(g,'a',{type:'pass'},1100);act(g,'b',{type:'pass'},1100);};
const conserve=g=>{for(const p of g.players){const all=[...p.hand,...p.deck];assert.equal(all.length,20);assert.equal(new Set(all.map(c=>c.id)).size,20);assert.ok(p.actionPoints>=0);}};
const unchanged=(g,run,pattern)=>{const before=structuredClone(g);assert.throws(run,pattern);assert.deepEqual(g,before);};

test('the twenty named cards each have one physical copy and the specified costs',()=>{
  const deck=makeDeck();assert.equal(deck.length,20);assert.equal(new Set(deck.map(c=>c.type)).size,20);
  assert.deepEqual(Object.values(CARD_TYPES).map(c=>c.cost),[1,2,3,3,2,3,0,0,1,2,3,1,2,3,3,2,2,2,2,3]);
  assert.equal(CARD_TYPES.big.name,'来个大家伙！');assert.equal(CARD_TYPES.speed.name,'40节航速！');
  const p=makePlayer('p','P');dealCards(p,()=>0);assert.equal(p.hand.length,4);assert.equal(p.deck.length,16);
});

test('opening, turn draws, FIFO recycling, no duplicate draw on refresh, and conservation of twenty cards',()=>{
  const g=fixture(),[a,b]=g.players;assert.equal(a.hand.length,6);assert.equal(b.hand.length,4);assert.equal(a.actionPoints,3);
  giveHand(a,['secondary']);const pile=[...a.deck],deadline=g.deadline;
  play(g,'secondary',{cell:90});assert.equal(a.actionPoints,2);assert.equal(g.turn,0);assert.equal(g.deadline,deadline);assert.equal(a.deck.at(-1).type,'secondary');
  assert.deepEqual(a.deck.slice(0,-1),pile);unchanged(g,()=>play(g,'secondary',{cell:91}),/手牌/);
  cycle(g);assert.equal(a.actionPoints,3);assert.equal(a.hand.length,2);assert.deepEqual(a.hand,pile.slice(0,2));
  const hand=structuredClone(a.hand);viewFor(g,'a');tick(g,1100);assert.deepEqual(a.hand,hand);conserve(g);
});

test('supply exceeds default AP; zero-cost cards remain usable at zero AP and draw before they recycle',()=>{
  const g=fixture(),a=g.players[0];giveHand(a,['big','supply','tactics']);
  play(g,'big',{cell:90});assert.equal(a.actionPoints,0);assert.equal(g.turn,0);
  play(g,'supply');assert.equal(a.actionPoints,2);assert.equal(g.turn,0);
  const top=a.deck.slice(0,2);play(g,'tactics');assert.deepEqual(a.hand.slice(-2),top);assert.equal(a.deck.at(-1).type,'tactics');conserve(g);
  const h=fixture(),p=h.players[0];giveHand(p,['supply']);play(h,'supply');assert.equal(p.actionPoints,5);
  const empty=fixture(),q=empty.players[0];giveHand(q,Object.keys(CARD_TYPES));assert.equal(q.deck.length,0);
  play(empty,'tactics');assert.equal(q.hand.some(c=>c.type==='tactics'),false);assert.equal(q.hand.length,19);assert.equal(q.deck[0].type,'tactics');conserve(empty);
});

test('zero AP without any zero-cost cards still waits for explicit confirmation, including across long idle periods',()=>{
  const g=fixture();giveHand(g.players[0],['secondary','recon','maneuver']);
  play(g,'secondary',{cell:90});play(g,'recon',{cell:55});play(g,'maneuver',{id:'FF-3',cell:65});
  assert.equal(g.players[0].actionPoints,0);assert.equal(g.turn,0);assert.equal(g.players[1].hand.length,4);
  const before=structuredClone(g);assert.equal(tick(g,86_400_000),false);assert.deepEqual(g,before);
  act(g,'a',{type:'pass'},86_400_000);assert.equal(g.turn,1);assert.equal(g.players[1].actionPoints,3);assert.equal(g.players[1].hand.length,6);conserve(g);
  const h=fixture();giveHand(h.players[0],['big','supply']);play(h,'big',{cell:90});assert.equal(h.turn,0);
  assert.equal(tick(h,86_400_000),false);play(h,'supply');assert.equal(h.players[0].actionPoints,2);assert.equal(h.turn,0);conserve(h);
});

test('all card target validation occurs before spending AP or recycling; client effects cannot override the catalog',()=>{
  const g=fixture(),a=g.players[0];giveHand(a,['secondary','barrage','torpedoPlane','repair']);
  for(const cell of [-1,100,'1',null])unchanged(g,()=>play(g,'secondary',{cell}),/目标/);
  unchanged(g,()=>play(g,'barrage',{cells:Array(10).fill(90)}),/10/);
  unchanged(g,()=>play(g,'torpedoPlane',{cell:80,end:80}),/终点/);
  unchanged(g,()=>play(g,'repair',{cell:0}),/受损|修复/);
  play(g,'secondary',{cell:0,effect:'main',cost:0,weapon:'torpedo',id:'CV-1'});assert.equal(a.actionPoints,2);assert.deepEqual(g.players[1].ships[0].hits,[]);
  unchanged(g,()=>play(g,'barrage',{cells:[80,81,82,83,84,85,86,87,88,89]}),/行动力/);
  for(const type of ['fire','move','recon'])unchanged(g,()=>act(g,'a',{type,cell:90},1100),/卡牌|手牌/);
});

test('ship prerequisites include damaged survivors, exclude sunk ships, and never allow carriers as gun sources',()=>{
  const g=fixture(),a=g.players[0];giveHand(a,Object.keys(CARD_TYPES));
  for(const ship of a.ships)if(ship.type!=='carrier')ship.hits=cells(ship);
  for(const type of ['secondary','main','big','barrage','torpedo','triple','flare','lamp','smoke'])assert.equal(canUseCard(a,a.hand.find(c=>c.type===type)),false,type);
  for(const type of ['fighter','bomber','torpedoPlane','seaplane'])assert.equal(canUseCard(a,a.hand.find(c=>c.type===type)),true,type);
  const b=fixture().players[0];b.ships[0].hits=[0];assert.ok(canUseCard(b,{type:'big'}));
  const cv=b.ships.find(s=>s.type==='carrier');cv.hits=cells(cv);for(const type of ['fighter','bomber','torpedoPlane'])assert.equal(canUseCard(b,{type}),false);
});

test('closest eligible hull supplies gunfire on both shores; request-supplied source IDs are ignored',()=>{
  const g=fixture(),a=g.players[0];giveHand(a,['secondary']);
  assert.equal(nearestSource(a,'surface',0,0).id,'CG-2');assert.equal(nearestSource(g.players[1],'surface',9,1).id,'BB-1');
  play(g,'secondary',{cell:90,id:'CV-1'});assert.ok(!a.lastAction.sources.includes('CV-1'));
  const opponent=viewFor(g,'b');assert.equal(opponent.players[0].lastAction,undefined);assert.equal(opponent.history.at(-1).sources,undefined);
});

test('secondary fire ignores battleship armor but damages other hulls, including a carrier',()=>{
  for(const [cell,expected]of [[0,'immune'],[20,'hit'],[60,'sunk'],[87,'hit']]){
    const g=fixture();giveHand(g.players[0],['secondary']);play(g,'secondary',{cell});
    assert.equal(g.players[0].lastAction.results[0].result,expected);assert.equal(viewFor(g,'a').enemyCells[cell],expected);
  }
});

test('main guns and heavy guns use Euclidean cell-center radius and can damage battleships',()=>{
  const g=fixture();giveHand(g.players[0],['main']);play(g,'main',{cell:1});assert.deepEqual(g.players[1].ships[0].hits,[0,1,2]);
  assert.deepEqual(g.players[0].lastAction.results.map(r=>r.cell),[0,1,2,11]);
  assert.equal(radiusCells(55,1).length,5);assert.equal(radiusCells(55,2).length,13);assert.equal(radiusCells(55,3).length,29);
  const h=fixture();giveHand(h.players[0],['big']);play(h,'big',{cell:2});assert.ok(isSunk(h.players[1],h.players[1].ships[0]));
  assert.ok(!radiusCells(55,1).includes(44));assert.ok(radiusCells(55,2).includes(44));
});

test('barrage requires ten unique chosen cells and resolves ten individual secondary strikes',()=>{
  const g=fixture();giveHand(g.players[0],['barrage']);const targets=[0,1,2,3,20,21,22,60,62,64];
  play(g,'barrage',{cells:targets});const results=g.players[0].lastAction.results;
  assert.equal(results.length,10);assert.equal(results.filter(r=>r.result==='immune').length,4);assert.deepEqual(g.players[1].ships[0].hits,[]);
  assert.equal(g.players[0].lastAction.sources.length,new Set(g.players[0].lastAction.sources).size);conserve(g);
});

test('row torpedoes require an escort in that row and select its forward-most hull on each shore',()=>{
  const g=fixture();giveHand(g.players[0],['torpedo']);assert.deepEqual(torpedoRows(g.players[0]),[4,6]);
  unchanged(g,()=>play(g,'torpedo',{row:5}),/该行/);
  const plan=prepareCard(g,0,{cardId:'torpedo-1',row:4});assert.deepEqual(plan.sources,['DD-3']);assert.equal(plan.rays[0][0],40);
  giveHand(g.players[1],['torpedo']);g.players[1].actionPoints=3;const reverse=prepareCard(g,1,{cardId:'torpedo-1',row:4});assert.deepEqual(reverse.sources,['DD-1']);assert.equal(reverse.rays[0][0],49);
  play(g,'torpedo',{row:4});assert.ok(isSunk(g.players[1],g.players[1].ships.find(s=>s.id==='DD-1')));assert.deepEqual(g.players[0].lastAction.traces,[[40]]);
  assert.equal(g.players[0].torpedoes,undefined);
});

test('torpedoes stop at rocks and wrecks, and cannot pass through the first live target',()=>{
  for(const obstacle of ['rock','wreck']){
    const g=fixture(),target=g.players[1];giveHand(g.players[0],['torpedo']);
    if(obstacle==='rock')target.terrain[40]='rock';else target.ships.find(s=>s.id==='DD-1').hits=[40,41];
    play(g,'torpedo',{row:4});assert.deepEqual(g.players[0].lastAction.traces,[[40]]);assert.deepEqual(target.ships.find(s=>s.id==='DD-2').hits,[]);
  }
});

test('each reef crossed by a torpedo gets an independent 25 percent block roll without identifying terrain',()=>{
  const g=fixture(),a=g.players[0],b=g.players[1];giveHand(a,['torpedoPlane']);
  for(const c of [81,82,83])b.terrain[c]='reef';const rolls=[.9,.25,.249];let calls=0;
  play(g,'torpedoPlane',{cell:80,end:86},0,()=>rolls[calls++]);assert.equal(calls,3);assert.deepEqual(a.lastAction.traces,[[80,81,82,83]]);
  assert.equal(a.lastAction.results.at(-1).result,'blocked');assert.ok(viewFor(g,'a').enemyTerrain.every(t=>t==='deep'));assert.deepEqual(b.knownOwnReefs,[]);
});

test('triple torpedoes launch three lanes or two at an edge, preserving row direction and clipping the map',()=>{
  const g=fixture();giveHand(g.players[0],['triple']);play(g,'triple',{row:4});assert.equal(g.players[0].lastAction.traces.length,3);
  const h=fixture(),escort=h.players[0].ships.find(s=>s.id==='FF-1');escort.x=4;escort.y=0;giveHand(h.players[0],['triple']);play(h,'triple',{row:0});
  assert.equal(h.players[0].lastAction.traces.length,2);assert.ok(h.players[0].lastAction.traces.flat().every(c=>c>=0&&c<20));
});

test('own reconnaissance permanently identifies only own reefs within radius three and never damages ships',()=>{
  const g=fixture(),a=g.players[0];giveHand(a,['recon']);for(const c of [0,3,22,30,33])a.terrain[c]='reef';
  play(g,'recon',{cell:0});assert.deepEqual(a.knownOwnReefs,[0,3,22,30]);assert.equal(viewFor(g,'a').own.terrain[33],'deep');
  assert.ok(viewFor(g,'b').enemyTerrain.every(t=>t==='deep'));assert.ok(a.ships.every(s=>s.hits.length===0));assert.equal(viewFor(g,'b').history.at(-1).cell,undefined);
});

test('signals give live clipped vision with no partial hull leaks and expire after exactly three owner turns',()=>{
  const g=fixture(),[a,b]=g.players;giveHand(a,['flare']);giveHand(b,['maneuver']);play(g,'flare',{cell:64});
  let view=viewFor(g,'a');assert.equal(view.enemyCells[64],'contact');assert.equal(view.enemySight[64].type,'frigate');assert.equal(view.enemyWrecks.length,0);assert.equal(view.visionEffects[0].remaining,3);
  assert.equal(view.players[1].ships,undefined);assert.equal(view.enemy,undefined);
  act(g,'a',{type:'pass'},1100);play(g,'maneuver',{id:'FF-3',cell:65},1);
  view=viewFor(g,'a');assert.equal(view.enemyCells[64],'clear');assert.equal(view.enemyCells[65],'contact');
  cycle(g);assert.equal(viewFor(g,'a').visionEffects[0].remaining,2);cycle(g);assert.equal(viewFor(g,'a').visionEffects[0].remaining,1);cycle(g);
  assert.equal(viewFor(g,'a').visionEffects.length,0);assert.equal(viewFor(g,'a').enemyCells[65],'unknown');conserve(g);
});

test('large illumination lasts four owner turns and full-map seaplane vision lasts one',()=>{
  for(const [type,duration,count]of [['lamp',4,29],['seaplane',1,100]]){
    const g=fixture();giveHand(g.players[0],[type]);play(g,type,{cell:55});assert.equal(viewFor(g,'a').enemyVisible.length,count);
    for(let remaining=duration-1;remaining>=0;remaining--){cycle(g);assert.equal(viewFor(g,'a').visionEffects[0]?.remaining||0,remaining);}
    assert.ok(viewFor(g,'a').enemyCells.every(s=>s==='unknown'));
  }
});

test('carrier fighters deny enemy non-fighter aircraft for three owner turns while allowing fighter launches',()=>{
  const g=fixture(),[a,b]=g.players;giveHand(a,['fighter']);giveHand(b,['fighter','bomber','seaplane','torpedoPlane','secondary']);play(g,'fighter');act(g,'a',{type:'pass'},1100);
  for(const type of ['bomber','seaplane','torpedoPlane'])unchanged(g,()=>play(g,type,{cell:90,end:91},1),/制空权/);
  assert.ok(canUseCard(b,{type:'fighter'},cardContext(viewFor(g,'b'))));
  assert.ok(canUseCard(b,{type:'secondary'},cardContext(viewFor(g,'b'))));
  for(let n=0;n<3;n++)cycle(g);assert.equal(g.airControl,null);act(g,'a',{type:'pass'},1100);assert.ok(canUseCard(b,{type:'bomber'},cardContext(viewFor(g,'b'))));
});

test('a fighter steals enemy air control, pays its cost, and resets expiry using the new controller’s turns',()=>{
  const g=fixture(),[a,b]=g.players;
  giveHand(a,['fighter','seaplane']);giveHand(b,['fighter','bomber','supply']);
  play(g,'fighter');act(g,'a',{type:'pass'},1100);
  assert.equal(chooseBotAction(viewFor(g,'b')).cardId,'supply-1');
  const enemyView=viewFor(g,'b');enemyView.own.hand=enemyView.own.hand.filter(c=>c.type!=='supply');
  assert.equal(chooseBotAction(enemyView).cardId,'fighter-1');
  play(g,'fighter',{},1);
  assert.equal(b.actionPoints,1);assert.equal(g.airControl.owner,1);assert.equal(viewFor(g,'b').airControl.remaining,3);
  assert.equal(b.hand.some(c=>c.type==='fighter'),false);assert.equal(b.deck.at(-1).type,'fighter');
  play(g,'supply',{},1);play(g,'bomber',{cell:90},1);
  act(g,'b',{type:'pass'},1100);
  unchanged(g,()=>play(g,'seaplane'),/制空权/);
  cycle(g);assert.equal(viewFor(g,'b').airControl.remaining,2);
  cycle(g);assert.equal(viewFor(g,'b').airControl.remaining,1);assert.equal(g.airControl.owner,1);
  cycle(g);assert.equal(g.airControl,null);conserve(g);
});

test('carrier bombers have radius-one damage, while torpedo bombers follow inclusive straight-line paths',()=>{
  const g=fixture();giveHand(g.players[0],['bomber']);play(g,'bomber',{cell:1});assert.deepEqual(g.players[1].ships[0].hits,[0,1,2]);
  const h=fixture();giveHand(h.players[0],['torpedoPlane']);play(h,'torpedoPlane',{cell:87,end:89});const cv=h.players[1].ships.find(s=>s.type==='carrier');assert.equal(cv.hits.length,6);assert.ok(isSunk(h.players[1],cv));
  assert.deepEqual(lineCells(0,22),[0,11,22]);assert.deepEqual(lineCells(29,20),[29,28,27,26,25,24,23,22,21,20]);
});

test('repair restores one segment and attack eligibility, and never resurrects a wreck',()=>{
  const g=fixture(),a=g.players[0],bb=a.ships[0];bb.hits=[0,1];a.shots=[0,1];a.shotResults={0:'hit',1:'hit'};giveHand(a,['repair']);
  play(g,'repair',{cell:0});assert.deepEqual(bb.hits,[1]);assert.equal(a.shots.includes(0),false);assert.equal(viewFor(g,'b').enemyCells[0],'unknown');
  const h=fixture();h.players[0].ships[0].hits=[0,1,2,3];giveHand(h.players[0],['repair']);unchanged(h,()=>play(h,'repair',{cell:0}),/受损|修复/);
});

test('two, four and unlimited-step maneuver cards use legal paths, never teleport through obstacles',()=>{
  for(const [type,destination,distance]of [['maneuver',84,2],['rapid',82,4],['speed',90,7]]){
    const g=fixture(),a=g.players[0];giveHand(a,[type]);const path=reachableMoves(a,'FF-3',CARD_TYPES[type].range).get(destination);assert.ok(path&&path.length<=distance);
    play(g,type,{id:'FF-3',cell:destination});assert.equal(a.ships.find(s=>s.id==='FF-3').y*10+a.ships.find(s=>s.id==='FF-3').x,destination);
  }
  const g=fixture();giveHand(g.players[0],['maneuver']);unchanged(g,()=>play(g,'maneuver',{id:'FF-3',cell:94}),/无法抵达/);
  const a=g.players[0];for(const c of [54,63,65,74])a.terrain[c]='rock';giveHand(a,['speed']);unchanged(g,()=>play(g,'speed',{id:'FF-3',cell:90}),/无法抵达/);
});

test('a multi-step route rolls hidden reefs en route, and shoals prevent moving beyond the grounding step',()=>{
  const g=fixture(),a=g.players[0];a.terrain[65]='reef';giveHand(a,['maneuver']);play(g,'maneuver',{id:'FF-3',cell:75},0,()=>0);
  const ship=a.ships.find(s=>s.id==='FF-3');assert.equal(ship.x,5);assert.ok(isSunk(a,ship));assert.equal(viewFor(g,'a').own.terrain[65],'reef');assert.equal(viewFor(g,'b').enemyTerrain[65],'deep');
  const h=fixture(),p=h.players[0];p.terrain[65]='shoal';for(const c of [54,63,74])p.terrain[c]='rock';giveHand(p,['maneuver']);const paths=reachableMoves(p,'FF-3',2);assert.ok(paths.has(65));assert.equal(paths.has(75),false);
  play(h,'maneuver',{id:'FF-3',cell:65});assert.equal(p.ships.find(s=>s.id==='FF-3').grounded,true);
});

test('smoke hides old attack information and blocks active vision while moving an escort up to two steps',()=>{
  const g=fixture(),[a,b]=g.players;a.shots=[64];a.shotResults[64]='miss';b.scans=[{cells:Array.from({length:100},(_,c)=>c),expiresTurn:100,cardType:'seaplane'}];giveHand(a,['smoke']);
  assert.equal(viewFor(g,'b').enemyCells[64],'contact');play(g,'smoke',{id:'FF-3',cell:65});
  let view=viewFor(g,'b');assert.equal(view.enemyCells[64],'unknown');assert.equal(view.enemyCells[65],'unknown');assert.ok(view.enemySmoke.includes(65));assert.equal(a.ships.find(s=>s.id==='FF-3').x,5);
  cycle(g);view=viewFor(g,'b');assert.equal(view.enemyCells[65],'contact');assert.equal(a.smoke.length,0);
  const h=fixture();giveHand(h.players[0],['smoke']);unchanged(h,()=>play(h,'smoke',{id:'BB-1',cell:0}),/驱逐舰|护卫舰/);
});

test('AI plays legal card actions on every map using only its filtered view, and conserves the complete decks',()=>{
  let seed=553;const rng=()=>{seed=(seed*1664525+1013904223)>>>0;return seed/4294967296;};
  for(const map of ['open-sea','undertow','blue-frontier','archipelago']){
    const g=makeGame([makePlayer('a','A'),makePlayer('b','B')],map);for(const p of g.players)act(g,p.id,{type:'ready'},1000,rng);
    for(const p of g.players){act(g,p.id,{type:'auto'},1001,rng);act(g,p.id,{type:'confirm'},1002,rng);}
    for(let i=0;i<1200&&g.phase==='battle';i++){
      const p=g.players[g.turn],action=chooseBotAction(viewFor(g,p.id),rng);act(g,p.id,action,1100+i,rng);conserve(g);
    }
    assert.equal(g.phase,'result',`${map} finishes`);
  }
});

test('torpedoes harm battleships on all navigable terrain but only deep water sinks the entire hull',()=>{
  for(const terrain of ['deep','shoal','reef']) {
    const g=fixture();giveHand(g.players[0],['torpedoPlane']);g.players[1].terrain[0]=terrain;
    play(g,'torpedoPlane',{cell:0,end:1},0,()=>1);
    assert.equal(g.players[1].ships[0].hits.length,terrain==='deep'?4:1);
  }
});

test('a partially illuminated carrier exposes only individually visible cells, never its hidden rectangle',()=>{
  const g=fixture();giveHand(g.players[0],['flare']);play(g,'flare',{cell:87});const view=viewFor(g,'a');
  assert.ok(view.enemySight[87]);assert.equal(view.enemySight[99],null);assert.equal(view.enemyCells[99],'unknown');
  assert.deepEqual(Object.keys(view.enemySight[87]).sort(),['damaged','sunk','type']);assert.deepEqual(view.enemyWrecks,[]);
});

test('stationary smoke hides old damage without repairing it, and expired smoke does not restore historical intel',()=>{
  const g=fixture(),a=g.players[0],ship=a.ships.find(s=>s.id==='DD-2');ship.hits=[43];a.shots=[43];a.shotResults[43]='hit';giveHand(a,['smoke']);
  assert.equal(viewFor(g,'b').enemyCells[43],'hit');play(g,'smoke',{id:ship.id,cell:43});assert.deepEqual(ship.hits,[43]);assert.equal(viewFor(g,'b').enemyCells[43],'unknown');
  cycle(g);assert.equal(a.smoke.length,0);assert.equal(viewFor(g,'b').enemyCells[43],'unknown');assert.deepEqual(ship.hits,[43]);
});

test('live vision and air control do not expire with wall-clock time while the same battle turn is held',()=>{
  const g=fixture(),p=g.players[0];giveHand(p,['supply','fighter','seaplane']);play(g,'supply');play(g,'fighter');play(g,'seaplane');
  assert.equal(p.actionPoints,0);assert.equal(g.turn,0);assert.equal(viewFor(g,'a').enemyVisible.length,100);
  assert.equal(tick(g,86_400_000),false);assert.equal(viewFor(g,'a').enemyVisible.length,100);assert.equal(viewFor(g,'a').airControl.remaining,3);
  act(g,'a',{type:'pass'},86_400_000);act(g,'b',{type:'pass'},86_400_001);
  assert.equal(viewFor(g,'a').enemyVisible.length,0);assert.equal(viewFor(g,'a').airControl.remaining,2);
});
