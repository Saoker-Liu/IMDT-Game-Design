import test from 'node:test';
import assert from 'node:assert/strict';
import { once } from 'node:events';
import { createGameServer } from '../server.mjs';
import { terrainFor } from '../public/terrain.mjs';
import { FIXED_PLACEMENTS,cardSessionActions } from '../test-support/cards.mjs';

async function setup(t,mapId='open-sea') {
  let clock=1000;const server=createGameServer({now:()=>clock,rng:()=>0});server.listen(0,'127.0.0.1');await once(server,'listening');
  t.after(()=>new Promise(resolve=>server.close(resolve)));
  const base=`http://127.0.0.1:${server.address().port}`;
  async function raw(route,body,s) {
    const response=await fetch(`${base}/api/${route}`,{method:body?'POST':'GET',headers:{...(body?{'Content-Type':'application/json'}:{}),...(s?{Authorization:`Bearer ${s.token}`}:{})},...(body?{body:JSON.stringify(body)}:{})});
    return {status:response.status,data:await response.json()};
  }
  async function api(route,body,s){const r=await raw(route,body,s);assert.equal(r.status,200,r.data.error);return r.data;}
  const host=await api('create',{name:'甲',mapId}),guest=await api('join',{name:'乙',roomId:host.roomId});
  const state=s=>api('state',null,s),send=(s,a)=>api('action',a,s);
  async function battle(){for(const s of [host,guest])await send(s,{type:'ready'});for(const s of [host,guest]){for(const [id,x,y]of FIXED_PLACEMENTS)await send(s,{type:'place',id,x,y,vertical:false});await send(s,{type:'confirm'});}}
  const {findCard}=cardSessionActions(send,state,[host,guest]);
  return {host,guest,state,send,raw,api,base,battle,findCard,setClock:value=>clock=value};
}

test('real peers discover rooms, deploy carriers, keep hands private and restore reef reconnaissance on refresh',async t=>{
  const {host,guest,state,send,raw,api,base,battle,findCard,setClock}=await setup(t,'undertow');
  assert.equal((await fetch(base)).status,200);assert.equal((await fetch(`${base}/cards.mjs`)).status,200);
  assert.equal((await api('health')).version,'5.0.0');assert.equal((await api('rooms')).rooms[0].mapId,'undertow');
  assert.equal((await raw('join',{roomId:host.roomId})).status,409);assert.equal((await raw('state')).status,401);
  await battle();let view=await state(host);assert.equal(view.own.ships.length,11);assert.equal(view.own.hand.length,6);assert.equal(view.players[1].handCount,4);
  assert.equal(view.players[1].hand,undefined);assert.equal(view.players[1].ships,undefined);assert.equal(view.own.deck,undefined);
  const recon=await findCard(host,'recon');view=await send(host,{type:'play-card',cardId:recon.id,cell:55});
  assert.ok(view.own.knownOwnReefs.length>0);assert.ok(view.enemyTerrain.every(t=>t==='deep'));
  const restored=await state(host);assert.deepEqual(restored.own,view.own);assert.equal(restored.deadline,view.deadline);
  const opponent=await state(guest);assert.ok(opponent.enemyTerrain.every(t=>t==='deep'));assert.equal(opponent.players[0].knownOwnReefs,undefined);
  setClock(view.deadline);view=await state(host);assert.equal(view.turn,1);assert.equal(view.own.actionPoints,0);
  await api('leave',{},host);const result=await state(guest);assert.equal(result.phase,'result');assert.equal(result.winner,1);
  assert.equal((await raw('state',null,host)).status,401);
});

test('HTTP card requests enforce costs, zero-AP supply, replay protection and concurrent single-use consumption',async t=>{
  const {host,guest,state,send,raw,battle}=await setup(t);await battle();
  for(let i=0;i<18;i++){const view=await state(host);await send(view.turn===0?host:guest,{type:'pass'});}
  let view=await state(host);assert.equal(view.own.hand.length,20);assert.equal(view.turn,0);
  const responses=await Promise.all([raw('action',{type:'play-card',cardId:'secondary-1',cell:90,cost:0},host),raw('action',{type:'play-card',cardId:'secondary-1',cell:91,cost:0},host)]);
  assert.deepEqual(responses.map(r=>r.status).sort(),[200,409]);view=await state(host);assert.equal(view.own.actionPoints,2);assert.equal(view.own.hand.length,19);assert.equal(view.own.deckCount,1);
  assert.equal((await raw('action',{type:'play-card',cardId:'big-1',cell:90,cost:0},host)).status,409);
  view=await send(host,{type:'play-card',cardId:'recon-1',cell:55});assert.equal(view.own.actionPoints,1);
  view=await send(host,{type:'play-card',cardId:'maneuver-1',id:'FF-3',cell:65});assert.equal(view.own.actionPoints,0);assert.equal(view.turn,0);
  view=await send(host,{type:'play-card',cardId:'supply-1'});assert.equal(view.own.actionPoints,2);assert.equal(view.turn,0);
  assert.equal((await raw('action',{type:'fire',cell:92},host)).status,409);
  assert.equal((await raw('action',{type:'play-card',cardId:'secondary-1',cell:92},guest)).status,409);
  const same=await state(host);assert.deepEqual(same.own,view.own);
});

test('two clients enforce carrier bombers, repairs, active air control and temporary full-map sight',async t=>{
  const {host,guest,state,send,raw,battle}=await setup(t);await battle();
  for(let i=0;i<18;i++){const v=await state(host);await send(v.turn===0?host:guest,{type:'pass'});}
  let v=await send(host,{type:'play-card',cardId:'bomber-1',cell:1});assert.deepEqual(v.enemyCells.slice(0,4),['hit','hit','hit','unknown']);
  await send(host,{type:'pass'});v=await send(guest,{type:'play-card',cardId:'repair-1',cell:0});assert.equal(v.own.ships[0].hits.includes(0),false);
  assert.equal((await state(host)).enemyCells[0],'unknown');await send(guest,{type:'pass'});
  await send(host,{type:'play-card',cardId:'fighter-1'});await send(host,{type:'pass'});
  assert.equal((await raw('action',{type:'play-card',cardId:'bomber-1',cell:90},guest)).status,409);
  assert.equal((await raw('action',{type:'play-card',cardId:'fighter-1'},guest)).status,409);
  await send(guest,{type:'pass'});v=await send(host,{type:'play-card',cardId:'seaplane-1'});assert.equal(v.enemyVisible.length,100);
  const hidden=await state(guest);assert.equal(hidden.enemyVisible.length,0);assert.equal(hidden.players[0].scans,undefined);
  await send(host,{type:'pass'});await send(guest,{type:'pass'});assert.equal((await state(host)).enemyVisible.length,0);
});

test('static traversal, cross-origin writes, malformed requests and anonymous actions remain rejected',async t=>{
  const {base}=await setup(t);
  assert.equal((await fetch(`${base}/%2e%2e%2fpackage.json`)).status,403);
  assert.equal((await fetch(`${base}/api/create`,{method:'POST',headers:{Origin:'https://example.com'},body:'{}'})).status,403);
  for(const body of ['{bad','null'])assert.equal((await fetch(`${base}/api/create`,{method:'POST',body})).status,400);
  assert.equal((await fetch(`${base}/api/action`,{method:'POST',body:'{}'})).status,401);
});
