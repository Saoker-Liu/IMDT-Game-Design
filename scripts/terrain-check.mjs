/** Exercises the new tactics through real HTTP sessions and an isolated browser. */
import assert from 'node:assert/strict';
import { once } from 'node:events';
import { mkdir } from 'node:fs/promises';
import path from 'node:path';
import { chromium } from 'playwright-core';
import { createGameServer } from '../server.mjs';
import { cells, canMove } from '../public/engine.mjs';

const output=path.resolve(process.env.ART_CHECK_OUTPUT||'test-results/terrain');
await mkdir(output,{recursive:true});
const server=createGameServer({now:()=>Date.now(),rng:()=>0});
server.listen(0,'127.0.0.1');await once(server,'listening');
const base=`http://127.0.0.1:${server.address().port}`;
const errors=[];
let browser;
try {
  browser=await chromium.launch({headless:true,...(process.env.PLAYWRIGHT_EXECUTABLE_PATH?{executablePath:process.env.PLAYWRIGHT_EXECUTABLE_PATH}:{channel:process.env.PLAYWRIGHT_CHANNEL||'msedge'})});
  async function context(session, mobile=false) {
    const ctx=await browser.newContext({viewport:mobile?{width:390,height:844}:{width:1440,height:1120},reducedMotion:'reduce',...(mobile?{isMobile:true,hasTouch:true,deviceScaleFactor:2}:{})});
    await ctx.route(/fonts\.(googleapis|gstatic)\.com/,r=>r.abort());
    ctx.on('page',p=>p.on('pageerror',e=>errors.push(e.message)));
    if(session)await ctx.addInitScript(s=>{if(location.protocol==='http:')sessionStorage.setItem('deepblue-session',JSON.stringify(s));},session);
    return ctx;
  }
  async function screenshot(p,name,selector) {
    await p.waitForFunction(()=>[...document.images].every(i=>i.complete&&i.naturalWidth>0));
    await p.evaluate(async()=>{await document.fonts.ready;const img=new Image();img.src='./assets/terrain-atlas.webp?v=3.0.0';await img.decode();});
    await (selector?p.locator(selector):p).screenshot({path:path.join(output,name),animations:'disabled',...(!selector?{fullPage:true}:{})});
    assert.ok(await p.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1),'No horizontal overflow');
  }
  async function api(route,body,session) {
    const r=await fetch(`${base}/api/${route}`,{method:body?'POST':'GET',headers:{...(body?{'Content-Type':'application/json'}:{}),...(session?{Authorization:`Bearer ${session.token}`}:{})},...(body?{body:JSON.stringify(body)}:{})});
    const data=await r.json();assert.equal(r.status,200,data.error);return data;
  }
  const action=(s,a)=>api('action',a,s);
  const state=s=>api('state',null,s);
  const waitTurn=p=>p.waitForFunction(()=>document.querySelector('#enemy-grid .cell:not(:disabled)'));
  const placements=[['BB-1',0,0],['CG-1',0,2],['CG-2',5,2],['DD-1',0,4],['DD-2',3,4],['DD-3',6,4],['FF-1',0,6],['FF-2',2,6],['FF-3',4,6],['FF-4',6,6]];
  async function prepared(mapId, coast=false) {
    const host=await api('create',{name:'北海指挥官',roomName:mapId==='undertow'?'暗礁航道 · 海域演习':'远海航线 · 海域演习',mapId});
    const guest=await api('join',{name:'远洋舰队',roomId:host.roomId});
    await action(host,{type:'ready'});await action(guest,{type:'ready'});
    for(const s of [host,guest])for(const [id,initialX,initialY]of placements){
      const x=coast&&id==='FF-3'?3:initialX,y=coast&&id==='FF-3'?8:initialY;
      await action(s,{type:'place',id,x,y,vertical:false});
    }
    await action(host,{type:'confirm'});await action(guest,{type:'confirm'});
    return {host,guest};
  }

  const archContext=await context(),arch=await archContext.newPage();
  await arch.goto(base);
  await arch.locator('[data-action="select-map"][data-map="archipelago"]').click();
  assert.equal(await arch.locator('.map-card.selected').getAttribute('data-map'),'archipelago');
  await screenshot(arch,'map-library.png','.map-selection');
  await arch.locator('[data-action="create"]').first().click();
  assert.equal(await arch.locator('#room-map').inputValue(),'archipelago');
  await arch.locator('#player-name').fill('北海指挥官');
  await arch.locator('#room-name').fill('星罗棋布 · 礁群海域');
  await arch.locator('#room-form [type="submit"]').click();
  await arch.waitForSelector('.waiting-room');
  const host=await arch.evaluate(()=>JSON.parse(sessionStorage.getItem('deepblue-session')));
  const guest=await api('join',{name:'远洋舰队',roomId:host.roomId});
  await arch.locator('[data-action="ready"]').click();await action(guest,{type:'ready'});
  await arch.waitForSelector('#own-grid');
  await arch.locator('.dock-piece[data-ship="BB-1"]').click();
  await arch.locator('#own-grid [data-cell="11"]').click();
  await arch.waitForFunction(()=>document.querySelector('#toast').textContent.includes('礁石'));
  assert.equal(await arch.locator('.friendly-chart .ship-overlay').count(),0);
  await arch.locator('[data-action="auto"]').click();
  await action(guest,{type:'auto'});await action(guest,{type:'confirm'});
  await arch.locator('[data-action="confirm"]').click();await waitTurn(arch);
  assert.equal(await arch.locator('.friendly-chart .terrain-layer .terrain-rock').count(),16);
  assert.equal(await arch.locator('.hostile-chart .ship-art').count(),0);
  const own=(await state(host)).own;
  const moves=own.ships.flatMap(s=>[[1,0],[-1,0],[0,1],[0,-1]].filter(([dx,dy])=>canMove(own,s.id,dx,dy)).map(([dx,dy])=>({ship:s,dx,dy})));
  const chosen=moves[0];assert.ok(chosen);
  await arch.locator(`#own-grid [data-cell="${cells(chosen.ship)[0]}"]`).click();
  await arch.locator(`[data-action="move"][data-dx="${chosen.dx}"][data-dy="${chosen.dy}"]`).click();
  await arch.waitForFunction(()=>document.querySelectorAll('#enemy-grid .cell:not(:disabled)').length===0);
  const moved=await state(host),movedShip=moved.own.ships.find(s=>s.id===chosen.ship.id);
  assert.equal(movedShip.x,chosen.ship.x+chosen.dx);assert.equal(movedShip.y,chosen.ship.y+chosen.dy);
  await action(guest,{type:'pass'});await waitTurn(arch);
  const foe=(await state(guest)).own,bb=foe.ships.find(s=>s.type==='battleship');
  await arch.locator(`#enemy-grid [data-cell="${cells(bb)[0]}"]`).click();
  await arch.locator('[data-action="weapon"][data-weapon="torpedo"]').click();
  await arch.locator('[data-action="fire"]').click();await arch.waitForSelector('.hostile-chart .wreck-overlay');
  assert.equal((await state(host)).own.torpedoes,2);
  const hostHull=(await state(host)).own.ships.find(s=>s.type==='battleship');
  await action(guest,{type:'fire',cell:cells(hostHull)[0]});await waitTurn(arch);
  const cruiser=foe.ships.find(s=>s.type==='cruiser');
  await arch.locator(`#enemy-grid [data-cell="${cells(cruiser)[0]}"]`).click();
  await arch.locator('[data-action="weapon"][data-weapon="shell"]').click();
  await arch.locator('[data-action="fire"]').click();await arch.waitForSelector('.hostile-chart .impact-hit');
  await screenshot(arch,'archipelago-boards.png','.boards');await screenshot(arch,'archipelago-desktop.png');
  await archContext.close();
  console.log('PASS: map selection/form, rock rejection, public geography, UI maneuver, torpedo and shell fire');

  const reef=await prepared('undertow'),reefContext=await context(reef.host),reefPage=await reefContext.newPage();
  await reefPage.goto(base);await reefPage.waitForSelector('#own-grid');await waitTurn(reefPage);
  await reefPage.locator('#own-grid [data-cell="64"]').click();
  await reefPage.locator('[data-action="move"][data-dx="1"][data-dy="0"]').click();
  await reefPage.waitForSelector('.friendly-chart .wreck-overlay');
  const reefView=await state(reef.guest);assert.equal(reefView.enemyCells[65],'sunk');assert.equal(reefView.enemyWrecks.length,1);
  await action(reef.guest,{type:'fire',cell:0});await waitTurn(reefPage);
  await screenshot(reefPage,'undertow-boards.png','.boards');
  await reefPage.locator('[data-action="terrain-guide"]').first().click();
  assert.equal(await reefPage.locator('.terrain-guide-card').count(),4);assert.equal(await reefPage.locator('.terrain-variants i').count(),16);
  await screenshot(reefPage,'terrain-guide.png','#modal');await reefContext.close();
  console.log('PASS: deterministic reef wreck through UI, private movement, four terrain types and sixteen variants');

  const coast=await prepared('blue-frontier',true),coastContext=await context(coast.host),coastPage=await coastContext.newPage();
  await coastPage.goto(base);await waitTurn(coastPage);
  await coastPage.locator('#own-grid [data-cell="83"]').click();
  await coastPage.locator('[data-action="move"][data-dx="-1"][data-dy="0"]').click();
  await coastPage.waitForSelector('.ship-status-anchor');
  await action(coast.guest,{type:'pass'});await waitTurn(coastPage);
  await coastPage.locator('#own-grid [data-cell="82"]').click();
  assert.equal(await coastPage.locator('.move-direction:not(:disabled)').count(),0);
  await screenshot(coastPage,'blue-frontier-boards.png','.boards');
  const mobileContext=await context(coast.host,true),mobile=await mobileContext.newPage();
  await mobile.goto(base);await mobile.waitForSelector('.ship-status-anchor');
  await screenshot(mobile,'blue-frontier-mobile.png');
  const attack=await mobile.locator('.hostile-chart').boundingBox(),command=await mobile.locator('.command-card').boundingBox(),friendly=await mobile.locator('.friendly-chart').boundingBox();
  assert.ok(attack.y<command.y&&command.y<friendly.y);
  assert.equal(await mobile.locator('.terrain-key').count(),4);
  assert.deepEqual(errors,[]);
  console.log('PASS: shoal grounding/anchor, locked move controls, mirrored shore and mobile firing layout');
  console.log(`All terrain browser checks passed. Screenshots: ${output}`);
} finally {
  if(browser)await browser.close();
  await new Promise(resolve=>server.close(resolve));
}
