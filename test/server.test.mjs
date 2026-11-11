import test from 'node:test';
import assert from 'node:assert/strict';
import { once } from 'node:events';
import { createGameServer } from '../server.mjs';
import { terrainFor } from '../public/terrain.mjs';

test('two real HTTP clients play a private-board game with room discovery, timeouts and reconnect',async t=>{
  let clock=1000;
  const server=createGameServer({now:()=>clock});
  server.listen(0,'127.0.0.1');await once(server,'listening');
  t.after(()=>new Promise(resolve=>server.close(resolve)));
  const base=`http://127.0.0.1:${server.address().port}`;
  async function req(route,body,token){const response=await fetch(`${base}/api/${route}`,{method:body?'POST':'GET',headers:{...(body?{'Content-Type':'application/json'}:{}),...(token?{Authorization:`Bearer ${token}`}:{})},...(body?{body:JSON.stringify(body)}:{})});return {status:response.status,data:await response.json()};}
  assert.equal((await fetch(base)).status,200);assert.equal((await fetch(`${base}/app.mjs`)).status,200);
  const sprite=await fetch(`${base}/assets/fleet-battleship.webp`);
  assert.equal(sprite.status,200);assert.equal(sprite.headers.get('content-type'),'image/webp');
  assert.equal((await req('health')).data.mode,'lan');
  const host=(await req('create',{name:'甲',roomName:'测试海域'})).data;
  let list=(await req('rooms')).data.rooms;assert.equal(list.length,1);assert.equal(list[0].count,1);assert.equal(list[0].name,'测试海域');assert.equal(list[0].token,undefined);
  assert.equal((await req('state')).status,401);
  const guest=(await req('join',{roomId:host.roomId,name:'乙'})).data;
  assert.equal((await req('join',{roomId:host.roomId,name:'丙'})).status,409);
  const action=(token,body)=>req('action',body,token);
  await action(host.token,{type:'ready'});const prep=await action(guest.token,{type:'ready'});
  assert.equal(prep.data.phase,'placement');
  await action(host.token,{type:'place',id:'BB-1',x:0,y:0,vertical:false});
  const guestView=(await req('state',null,guest.token)).data;
  assert.ok(guestView.enemyCells.every(c=>c==='unknown'));assert.equal(guestView.players[0].ships,undefined);
  await action(host.token,{type:'auto'});await action(guest.token,{type:'auto'});
  await action(host.token,{type:'confirm'});await action(guest.token,{type:'confirm'});
  const battle=(await req('state',null,host.token)).data;assert.equal(battle.phase,'battle');
  clock=battle.deadline;
  assert.equal((await action(host.token,{type:'fire',cell:0})).status,409);
  let view=(await action(guest.token,{type:'fire',cell:0})).data;
  assert.equal(view.enemyCells[0],'hit');assert.equal(view.turn,0);
  // Reconnect uses the same bearer token and restores state without joining again.
  const restored=(await req('state',null,guest.token)).data;assert.equal(restored.own.id,view.own.id);assert.equal(restored.enemyCells[0],'hit');
  assert.equal((await action(guest.token,{type:'fire',cell:0})).status,409);
  await req('leave',{},host.token);
  view=(await req('state',null,guest.token)).data;assert.equal(view.phase,'result');assert.equal(view.winner,1);assert.equal(view.opponentConnected,false);
  assert.equal((await req('state',null,host.token)).status,401);
  await req('leave',{},guest.token);assert.equal((await req('rooms')).data.rooms.length,0);
});

test('static traversal, cross-origin writes, malformed requests and anonymous actions are rejected',async t=>{
  const server=createGameServer();server.listen(0,'127.0.0.1');await once(server,'listening');
  t.after(()=>new Promise(resolve=>server.close(resolve)));
  const base=`http://127.0.0.1:${server.address().port}`;
  assert.equal((await fetch(`${base}/%2e%2e%2fpackage.json`)).status,403);
  assert.equal((await fetch(`${base}/api/create`,{method:'POST',headers:{Origin:'https://example.com'},body:'{}'})).status,403);
  assert.equal((await fetch(`${base}/api/create`,{method:'POST',body:'{bad'})).status,400);
  assert.equal((await fetch(`${base}/api/create`,{method:'POST',body:'null'})).status,400);
  assert.equal((await fetch(`${base}/api/action`,{method:'POST',body:'{}'})).status,401);
});

test('two HTTP peers share the selected terrain map and enforce torpedoes, maneuvering and grounding',async t=>{
  const server=createGameServer({now:()=>1000,rng:()=>0});server.listen(0,'127.0.0.1');await once(server,'listening');
  t.after(()=>new Promise(resolve=>server.close(resolve)));
  const base=`http://127.0.0.1:${server.address().port}`;
  async function req(route,body,session){
    const response=await fetch(`${base}/api/${route}`,{method:body?'POST':'GET',headers:{...(body?{'Content-Type':'application/json'}:{}),...(session?{Authorization:`Bearer ${session.token}`}:{})},...(body?{body:JSON.stringify(body)}:{})});
    return {status:response.status,data:await response.json()};
  }
  assert.equal((await req('create',{mapId:'invalid'})).status,400);
  const host=(await req('create',{name:'甲',mapId:'blue-frontier'})).data;
  const guest=(await req('join',{name:'乙',roomId:host.roomId})).data;
  const action=async(s,a)=>{const r=await req('action',a,s);assert.equal(r.status,200,r.data.error);return r.data;};
  assert.equal((await req('rooms')).data.rooms[0].mapId,'blue-frontier');
  const before=(await req('state',null,guest)).data;
  assert.deepEqual(before.own.terrain,terrainFor('blue-frontier',1));
  assert.deepEqual(before.enemyTerrain,terrainFor('blue-frontier'));
  assert.equal(before.players[0].ships,undefined);
  await action(host,{type:'ready'});await action(guest,{type:'ready'});
  const placements=[['BB-1',0,0],['CG-1',0,2],['CG-2',5,2],['DD-1',0,4],['DD-2',3,4],['DD-3',6,4],['FF-1',0,6],['FF-2',2,6],['FF-3',3,8],['FF-4',6,6]];
  for(const session of [host,guest])for(const [id,x,y]of placements)await action(session,{type:'place',id,x,y,vertical:false});
  await action(host,{type:'confirm'});await action(guest,{type:'confirm'});
  let view=await action(host,{type:'fire',cell:0,weapon:'torpedo'});
  assert.equal(view.own.torpedoes,2);assert.equal(view.enemyWrecks.length,1);
  assert.ok([0,1,2,3].every(c=>view.enemyCells[c]==='sunk'));
  await action(guest,{type:'pass'});
  view=await action(host,{type:'move',id:'FF-3',dx:-1,dy:0});
  assert.equal(view.own.ships.find(s=>s.id==='FF-3').grounded,true);assert.equal(view.turn,1);
  const opponent=(await req('state',null,guest)).data;
  assert.equal(opponent.enemyCells[82],'unknown');assert.equal(opponent.enemyWrecks.length,0);
  assert.equal(opponent.history.at(-1).cell,undefined);assert.equal(opponent.history.at(-1).shipType,undefined);
  await action(guest,{type:'pass'});
  assert.equal((await req('action',{type:'move',id:'FF-3',dx:1,dy:0},host)).status,409);
});
