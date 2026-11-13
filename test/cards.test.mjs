import test from 'node:test';
import assert from 'node:assert/strict';
import { once } from 'node:events';
import { makePlayer, makeGame, act, tick, cells, viewFor, TURN_MS } from '../public/engine.mjs';
import { CARD_TYPES, makeDeck, dealCards, DECK_SIZE } from '../public/cards.mjs';
import { chooseBotAction } from '../public/bot.mjs';
import { createGameServer } from '../server.mjs';
import { giveHand } from '../test-support/cards.mjs';

function battle(map='open-sea') {
  const game=makeGame([makePlayer('a','甲'),makePlayer('b','乙')],map);
  act(game,'a',{type:'ready'},1000);act(game,'b',{type:'ready'},1000);
  const placements=[[0,0],[0,2],[5,2],[0,4],[3,4],[6,4],[0,6],[2,6],[4,6],[6,6]];
  for(const p of game.players) {
    p.ships.forEach((ship,i)=>act(game,p.id,{type:'place',id:ship.id,x:placements[i][0],y:placements[i][1],vertical:false},1001));
    act(game,p.id,{type:'confirm'},1002,()=>0);
  }
  return game;
}
const play=(g,card,fields={},now=1100)=>act(g,'a',{type:'play-card',cardId:card.id,...fields},now);
function conservation(g) {
  for(const p of g.players) {
    const all=[...p.hand,...p.deck];
    assert.equal(all.length,DECK_SIZE);assert.equal(new Set(all.map(c=>c.id)).size,DECK_SIZE);
    assert.ok(p.actionPoints>=0&&p.actionPoints<=3);
  }
}

test('each independent deck contains exactly twenty unique provisional cards',()=>{
  const a=makePlayer('a','甲'),b=makePlayer('b','乙');
  assert.equal(makeDeck().length,20);
  assert.deepEqual(Object.fromEntries(Object.keys(CARD_TYPES).map(type=>[type,a.deck.filter(c=>c.type===type).length])),{shell:8,move:6,recon:4,torpedo:2});
  a.deck[0].type='changed';assert.equal(b.deck[0].type,'shell');
  dealCards(b,()=>0);assert.equal(b.hand.length,4);assert.equal(b.deck.length,16);
});

test('opening deals four to both players; every own turn, including the first, draws two and grants three AP',()=>{
  const g=battle(),[a,b]=g.players;
  assert.equal(a.hand.length,6);assert.equal(a.deck.length,14);assert.equal(a.actionPoints,3);assert.equal(a.turns,1);
  assert.equal(b.hand.length,4);assert.equal(b.deck.length,16);assert.equal(b.actionPoints,0);assert.equal(b.turns,0);
  act(g,'a',{type:'pass'},1100);
  assert.equal(b.hand.length,6);assert.equal(b.actionPoints,3);assert.equal(b.turns,1);assert.equal(a.actionPoints,0);
  for(let i=0;i<5;i++) {viewFor(g,'b');tick(g,1101);}
  assert.equal(b.hand.length,6);conservation(g);
});

test('successful play returns that physical card to the bottom, spends AP, and preserves the turn deadline',()=>{
  const g=battle(),p=g.players[0];giveHand(p,['shell','shell','move']);
  const card=p.hand[0],pile=structuredClone(p.deck),deadline=g.deadline;
  play(g,card,{cell:90});
  assert.equal(g.turn,0);assert.equal(g.deadline,deadline);assert.equal(p.actionPoints,2);assert.equal(p.hand.length,2);
  assert.deepEqual(p.deck,[...pile,card]);assert.equal(viewFor(g,'a').enemyCells[90],'miss');
  const snapshot=structuredClone(g);
  assert.throws(()=>play(g,card,{cell:91}),/不在.*手牌/);assert.deepEqual(g,snapshot);conservation(g);
});

test('three one-point cards can be played in one turn; only the last switches players and draws for the opponent',()=>{
  const g=battle(),[a,b]=g.players;giveHand(a,['shell','shell','shell']);
  const cards=[...a.hand],deadline=g.deadline;
  for(let i=0;i<3;i++) {
    play(g,cards[i],{cell:90+i},1100+i);
    assert.equal(g.turn,i===2?1:0);
    if(i<2) {assert.equal(g.deadline,deadline);assert.equal(b.hand.length,4);}
  }
  assert.equal(a.actionPoints,0);assert.equal(b.actionPoints,3);assert.equal(b.hand.length,6);
  assert.equal(g.deadline,1102+TURN_MS);assert.equal(g.round,2);conservation(g);
});

test('card cost and effect come from the catalog; forged cost, weapon and effect cannot bypass them',()=>{
  const g=battle(),p=g.players[0];giveHand(p,['torpedo','torpedo','shell']);
  play(g,p.hand[0],{cell:90,cost:0,weapon:'shell'});
  assert.equal(p.actionPoints,1);assert.equal(p.torpedoes,2);
  const snapshot=structuredClone(g);
  assert.throws(()=>play(g,p.hand[0],{cell:91,cost:0}),/行动力不足/);assert.deepEqual(g,snapshot);
  play(g,p.hand.find(c=>c.type==='shell'),{cell:0,weapon:'torpedo',effect:'sink',cost:0});
  assert.deepEqual(g.players[1].ships[0].hits,[0]);assert.equal(g.turn,1);conservation(g);
});

test('bare actions, cards still in the deck, and cards during the wrong phase or turn are rejected',()=>{
  const g=battle();
  for(const type of ['fire','move','recon']) {
    const snapshot=structuredClone(g);assert.throws(()=>act(g,'a',{type,cell:90,id:'FF-3',dx:1,dy:0},1100),/卡牌|手牌/);assert.deepEqual(g,snapshot);
  }
  const p=g.players[0],snapshot=structuredClone(g);
  for(const cardId of [p.deck[0].id,'invented',null,undefined]) assert.throws(()=>act(g,'a',{type:'play-card',cardId,cell:90},1100),/手牌/);
  assert.deepEqual(g,snapshot);
  assert.throws(()=>act(g,'b',{type:'play-card',cardId:g.players[1].hand[0].id,cell:90},1100),/等待/);
  g.phase='placement';assert.throws(()=>play(g,p.hand[0],{cell:90}),/等待/);
});

test('bad targets, blocked movement, repeated fire and exhausted ammunition consume neither cards nor AP',()=>{
  const g=battle(),p=g.players[0];giveHand(p,['shell','shell','move','torpedo']);
  const shot=p.hand[0],move=p.hand[2],torpedo=p.hand[3];
  for(const cell of [-1,100,1.5,'1',null]) {
    const snapshot=structuredClone(g);assert.throws(()=>play(g,shot,{cell}),/坐标/);assert.deepEqual(g,snapshot);
  }
  const snapshot=structuredClone(g);assert.throws(()=>play(g,move,{id:'BB-1',dx:-1,dy:0}),/无法航行/);assert.deepEqual(g,snapshot);
  p.torpedoes=0;const noAmmo=structuredClone(g);assert.throws(()=>play(g,torpedo,{cell:91}),/用尽/);assert.deepEqual(g,noAmmo);
  play(g,shot,{cell:90});const fired=structuredClone(g);
  assert.throws(()=>play(g,p.hand.find(c=>c.type==='shell'),{cell:90}),/已经攻击/);assert.deepEqual(g,fired);conservation(g);
});

test('passing and timeouts discard unused AP, preserve cards, and grant exactly one draw on the next turn',()=>{
  const g=battle(),[a,b]=g.players;
  act(g,'a',{type:'pass'},1100);assert.equal(a.hand.length,6);assert.equal(a.actionPoints,0);
  const deadline=g.deadline,bCount=b.hand.length;
  assert.equal(tick(g,deadline),true);assert.equal(a.hand.length,8);assert.equal(a.actionPoints,3);assert.equal(b.actionPoints,0);assert.equal(b.hand.length,bCount);
  assert.equal(tick(g,deadline),false);assert.equal(a.hand.length,8);
  const current=g.deadline;
  assert.throws(()=>play(g,a.hand[0],{cell:90},current),/等待/);
  assert.equal(b.hand.length,bCount+2);assert.equal(g.round,4);conservation(g);
});

test('hands have no invented limit, an empty pile draws nothing, and recycled cards return on a later turn in FIFO order',()=>{
  const g=battle(),[a,b]=g.players;
  for(let i=0;i<18;i++)act(g,g.players[g.turn].id,{type:'pass'},1100+i);
  assert.equal(a.hand.length,20);assert.equal(b.hand.length,20);assert.equal(a.deck.length,0);assert.equal(b.deck.length,0);
  const shots=a.hand.filter(c=>c.type==='shell').slice(0,3);
  for(const [i,card]of shots.entries())play(g,card,{cell:90+i},1200+i);
  assert.deepEqual(a.deck,shots);assert.equal(a.hand.length,17);
  act(g,'b',{type:'pass'},1204);
  assert.deepEqual(a.hand.slice(-2),shots.slice(0,2));assert.deepEqual(a.deck,[shots[2]]);conservation(g);
});

test('recon reveals only a private single-cell contact snapshot, causes no damage, and never identifies a reef',()=>{
  const g=battle('undertow'),p=g.players[0];giveHand(p,['recon','recon','shell']);
  g.players[1].terrain[0]='reef';g.players[1].terrain[90]='reef';
  play(g,p.hand[0],{cell:0});play(g,p.hand[0],{cell:90});
  const own=viewFor(g,'a'),other=viewFor(g,'b');
  assert.deepEqual(own.enemyRecon,[{cell:0,contact:true,stale:false},{cell:90,contact:false,stale:false}]);
  assert.deepEqual(g.players[1].ships[0].hits,[]);assert.deepEqual(g.players[1].shots,[]);
  assert.ok(own.enemyCells.every(c=>c==='unknown'));assert.equal(own.enemyTerrain[0],'deep');assert.equal(own.enemyTerrain[90],'deep');
  assert.deepEqual(other.enemyRecon,[]);assert.deepEqual(Object.keys(other.history.at(-1)).sort(),['at','id','playerId','type']);
  assert.equal(other.players[0].hand,undefined);assert.equal(other.players[0].deck,undefined);assert.equal(other.players[0].recon,undefined);assert.equal(own.own.deck,undefined);
  const snapshot=structuredClone(g);own.own.hand[0].type='torpedo';own.enemyRecon[0].contact=false;assert.deepEqual(g,snapshot);
});

test('fresh recon cannot be repeated; a maneuver makes old recon stale and permits a new card to rescout',()=>{
  const g=battle(),[a,b]=g.players;giveHand(a,['recon','recon','recon']);giveHand(b,['move']);
  play(g,a.hand[0],{cell:65});const snapshot=structuredClone(g);
  assert.throws(()=>play(g,a.hand[0],{cell:65}),/情报/);assert.deepEqual(g,snapshot);
  act(g,'a',{type:'pass'},1101);act(g,'b',{type:'play-card',cardId:b.hand[0].id,id:'FF-3',dx:1,dy:0},1102);
  assert.deepEqual(viewFor(g,'a').enemyRecon,[{cell:65,contact:false,stale:true}]);
  act(g,'b',{type:'pass'},1103);play(g,a.hand[0],{cell:65},1104);
  assert.deepEqual(viewFor(g,'a').enemyRecon,[{cell:65,contact:true,stale:false}]);
  assert.equal(viewFor(g,'a').enemyCells[65],'unknown');conservation(g);
});

test('a winning card settles immediately without drawing for the opponent; rematch resets all card and recon state',()=>{
  const g=battle(),[a,b]=g.players;giveHand(a,['shell']);
  for(const ship of b.ships)ship.hits=cells(ship);
  b.ships[0].hits=b.ships[0].hits.filter(c=>c!==0);const bCount=b.hand.length;
  play(g,a.hand[0],{cell:0});assert.equal(g.phase,'result');assert.equal(g.winner,0);assert.equal(b.hand.length,bCount);assert.equal(g.deadline,null);
  act(g,'a',{type:'rematch'},1101);act(g,'b',{type:'rematch'},1102);
  assert.equal(g.phase,'lobby');for(const p of g.players){assert.equal(p.hand.length,0);assert.equal(p.deck.length,20);assert.equal(p.actionPoints,0);assert.deepEqual(p.recon,{});}
  conservation(g);
});

test('practice AI completes card-based games on all terrain maps without bypassing AP, hands or fog',()=>{
  let seed=7941;const rng=()=>{seed=(seed*1664525+1013904223)>>>0;return seed/4294967296;};
  for(const map of ['open-sea','undertow','blue-frontier','archipelago']) {
    const g=makeGame([makePlayer('a','甲'),makePlayer('b','乙')],map);
    for(const id of ['a','b'])act(g,id,{type:'ready'},1000,rng);
    for(const id of ['a','b']){act(g,id,{type:'auto'},1001,rng);act(g,id,{type:'confirm'},1002,rng);}
    for(let i=0;i<1600&&g.phase==='battle';i++) {
      const p=g.players[g.turn],view=viewFor(g,p.id),action=chooseBotAction(view,rng);
      if(action.type==='play-card')assert.ok(p.hand.some(c=>c.id===action.cardId&&CARD_TYPES[c.type].cost<=p.actionPoints));
      act(g,p.id,action,1100+i,rng);conservation(g);
    }
    assert.equal(g.phase,'result',`${map} should finish`);
  }
});

test('two HTTP clients enforce multi-card turns, replay rejection, private hands and reconnect without drawing twice',async t=>{
  let clock=1000;const server=createGameServer({now:()=>clock,rng:()=>0});server.listen(0,'127.0.0.1');await once(server,'listening');
  t.after(()=>new Promise(resolve=>server.close(resolve)));
  const base=`http://127.0.0.1:${server.address().port}`;
  async function req(route,body,s) {
    const r=await fetch(`${base}/api/${route}`,{method:body?'POST':'GET',headers:{...(body?{'Content-Type':'application/json'}:{}),...(s?{Authorization:`Bearer ${s.token}`}:{})},...(body?{body:JSON.stringify(body)}:{})});
    return {status:r.status,data:await r.json()};
  }
  async function action(s,a){const r=await req('action',a,s);assert.equal(r.status,200,r.data.error);return r.data;}
  const a=(await req('create',{})).data,b=(await req('join',{roomId:a.roomId})).data;
  for(const s of [a,b])await action(s,{type:'ready'});
  for(const s of [a,b]){await action(s,{type:'auto'});await action(s,{type:'confirm'});}
  const opening=(await req('state',null,a)).data,cards=opening.own.hand.filter(c=>c.type==='shell').slice(0,3);
  assert.equal(cards.length,3);assert.equal(opening.own.deck,undefined);assert.equal(opening.players[1].hand,undefined);
  const requests=await Promise.all([req('action',{type:'play-card',cardId:cards[0].id,cell:90},a),req('action',{type:'play-card',cardId:cards[0].id,cell:91},a)]);
  assert.deepEqual(requests.map(r=>r.status).sort(),[200,409]);
  let state=(await req('state',null,a)).data;assert.equal(state.own.actionPoints,2);assert.equal(state.turn,0);assert.equal(state.own.hand.length,5);
  const restored=(await req('state',null,a)).data;assert.deepEqual(restored.own,state.own);assert.equal(restored.deadline,opening.deadline);
  assert.equal((await req('action',{type:'fire',cell:92},a)).status,409);
  for(const [i,card]of cards.slice(1).entries())state=await action(a,{type:'play-card',cardId:card.id,cell:92+i,cost:0});
  assert.equal(state.turn,1);assert.equal(state.own.actionPoints,0);assert.equal(state.players[1].handCount,6);
  assert.equal((await req('state',null,b)).data.own.actionPoints,3);
  clock=state.deadline;const next=(await req('state',null,a)).data;
  assert.equal(next.turn,0);assert.equal(next.own.actionPoints,3);assert.equal(next.own.hand.length,5);
  assert.deepEqual((await req('state',null,a)).data.own,next.own);
});
