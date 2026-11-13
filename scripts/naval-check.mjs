import assert from 'node:assert/strict';
import { once } from 'node:events';
import { mkdir } from 'node:fs/promises';
import path from 'node:path';
import { chromium } from 'playwright-core';
import { createGameServer } from '../server.mjs';
import { CARD_TYPES } from '../public/cards.mjs';
import { FIXED_PLACEMENTS,cardSessionActions } from '../test-support/cards.mjs';

const output=path.resolve(process.env.ART_CHECK_OUTPUT||'test-results/naval');await mkdir(output,{recursive:true});
const server=createGameServer({now:()=>1000,rng:()=>0});server.listen(0,'127.0.0.1');await once(server,'listening');
const base=`http://127.0.0.1:${server.address().port}`,errors=[];let browser;
try {
  browser=await chromium.launch({headless:true,...(process.env.PLAYWRIGHT_EXECUTABLE_PATH?{executablePath:process.env.PLAYWRIGHT_EXECUTABLE_PATH}:{channel:process.env.PLAYWRIGHT_CHANNEL||'msedge'})});
  async function api(route,body,s){const r=await fetch(`${base}/api/${route}`,{method:body?'POST':'GET',headers:{...(body?{'Content-Type':'application/json'}:{}),...(s?{Authorization:`Bearer ${s.token}`}:{})},...(body?{body:JSON.stringify(body)}:{})});const data=await r.json();assert.equal(r.status,200,data.error);return data;}
  const send=(s,a)=>api('action',a,s),state=s=>api('state',null,s);
  async function room(mapId='open-sea') {
    const host=await api('create',{name:'北海指挥官',roomName:'舰队卡牌 · 战术演习',mapId}),guest=await api('join',{name:'远洋舰队',roomId:host.roomId});
    for(const s of [host,guest])await send(s,{type:'ready'});
    for(const s of [host,guest]){for(const [id,x,y]of FIXED_PLACEMENTS)await send(s,{type:'place',id,x,y,vertical:false});await send(s,{type:'confirm'});}
    return {host,guest,...cardSessionActions(send,state,[host,guest])};
  }
  async function pageFor(session,mobile=false) {
    const context=await browser.newContext({viewport:mobile?{width:390,height:844}:{width:1440,height:1120},reducedMotion:'reduce',...(mobile?{isMobile:true,hasTouch:true}:{})});
    await context.route(/fonts\.(googleapis|gstatic)\.com/,r=>r.abort());
    if(session)await context.addInitScript(s=>{if(location.protocol==='http:')sessionStorage.setItem('deepblue-session',JSON.stringify(s));},session);
    const page=await context.newPage();page.on('pageerror',e=>errors.push(e.message));await page.goto(base);return page;
  }
  async function capture(page,name,selector) {
    await page.evaluate(async()=>{await document.fonts.ready;await Promise.all([...document.images].map(img=>img.decode()));});
    assert.ok(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1),'No page overflow');
    await (selector?page.locator(selector):page).screenshot({path:path.join(output,name),animations:'disabled',...(!selector?{fullPage:true}:{})});
  }
  const lobby=await pageFor();await lobby.setViewportSize({width:1440,height:1700});await lobby.locator('[data-action="practice"]').first().click();await lobby.waitForSelector('.dock');
  assert.equal(await lobby.locator('.dock-piece').count(),11);
  const piece=await lobby.locator('.dock-piece[data-ship="CV-1"]').boundingBox(),target=await lobby.locator('#own-grid [data-cell="77"]').boundingBox();
  await lobby.mouse.move(piece.x+piece.width/2,piece.y+piece.height/2);await lobby.mouse.down();await lobby.mouse.move(target.x+target.width/2,target.y+target.height/2,{steps:12});await lobby.mouse.up();
  await lobby.waitForSelector('#own-grid [data-ship="CV-1"]');assert.equal(await lobby.locator('#own-grid [data-ship="CV-1"]').count(),6);
  await lobby.keyboard.press('r');await lobby.waitForSelector('.carrier.vertical');
  const cv=await lobby.locator('.ship-overlay:has(.carrier)').boundingBox(),art=await lobby.locator('.ship-overlay .carrier-art').boundingBox();
  assert.ok(cv.height>cv.width*1.4&&cv.height<cv.width*1.6);assert.ok(art.height<=cv.height+2&&art.width<=cv.width+2);
  assert.ok(await lobby.locator('[data-action="confirm"]').isDisabled());await capture(lobby,'carrier-deployment.png','.boards');
  await lobby.context().close();console.log('PASS: six-cell carrier drag, rectangular placement, rotation, art bounds and eleven-ship confirmation');

  const game=await room(),{host,guest,findCard}=game;
  for(let i=0;i<18;i++){const v=await state(host);await send(v.turn===0?host:guest,{type:'pass'});}
  const page=await pageFor(host);await page.waitForSelector('.hand-panel');assert.equal(await page.locator('[data-hand-count]').textContent(),'20');
  assert.equal(await page.locator('#enemy-grid .cell:not(:disabled)').count(),0);
  await page.locator('[data-action="card-guide"]').click();assert.equal(await page.locator('.card-guide-grid article').count(),20);await capture(page,'card-library.png','#modal');await page.locator('[data-action="close-modal"]').first().click();
  async function choose(type) {const card=await findCard(host,type);await page.waitForSelector(`[data-card="${card.id}"]:not(:disabled)`);await page.locator(`[data-card="${card.id}"]`).click();}
  const played=[];
  async function execute(type,select) {
    await choose(type);if(select)await select();assert.ok(await page.locator('[data-action="fire"]').isEnabled(),`${type} has a valid UI selection`);
    await page.locator('[data-action="fire"]').click();await page.waitForFunction(()=>!document.querySelector('.tactical-card.selected'));
    const v=await state(host);assert.equal(v.own.lastAction.cardType,type);assert.equal(v.own.hand.length+v.own.deckCount,20);played.push(type);return v;
  }
  const enemy=c=>page.locator(`#enemy-grid [data-cell="${c}"]`).click(),own=c=>page.locator(`#own-grid [data-cell="${c}"]`).click();
  let v=await execute('supply');assert.equal(v.own.actionPoints,5);assert.equal(await page.locator('.action-points').getAttribute('data-ap'),'5');
  v=await execute('secondary',()=>enemy(0));assert.equal(v.enemyCells[0],'immune');assert.deepEqual(v.own.lastAction.sources,['CG-2']);
  await execute('main',async()=>{await enemy(90);assert.equal(await page.locator('#enemy-grid .target-preview').count(),3);});
  await execute('big',()=>enemy(92));
  await execute('barrage',async()=>{for(let c=90;c<100;c++)await enemy(c);assert.equal(await page.locator('#enemy-grid .target-preview').count(),10);});
  await execute('torpedo',()=>enemy(44));await execute('triple',()=>enemy(44));
  await execute('tactics');await execute('recon',()=>own(55));
  v=await execute('flare',()=>enemy(64));assert.ok(v.enemyVisible.includes(64));assert.equal(v.enemySight[64].type,'frigate');
  await execute('lamp',()=>enemy(55));
  await execute('maneuver',async()=>{await own(64);await own(84);});assert.equal((await state(host)).own.ships.find(s=>s.id==='FF-3').y,8);
  await execute('rapid',async()=>{await own(81);});
  await execute('speed',async()=>{await own(10);});
  v=await execute('seaplane');assert.equal(v.enemyVisible.length,100);
  v=await execute('fighter');assert.equal(v.airControl.owner,0);
  await execute('bomber',()=>enemy(1));
  v=await execute('torpedoPlane',async()=>{await enemy(87);await enemy(89);assert.ok(await page.locator('[data-action="fire"]').isEnabled());});assert.ok(v.enemySunk.includes('carrier'));
  const current=await state(host);if(current.turn===0)await send(host,{type:'pass'});
  const main=await findCard(guest,'main');await send(guest,{type:'play-card',cardId:main.id,cell:0});await send(guest,{type:'pass'});
  v=await execute('repair',()=>own(0));assert.ok(!v.own.ships[0].hits.includes(0));
  v=await execute('smoke',async()=>{await own(62);await own(63);});assert.ok(v.own.smoke.length>0);assert.ok(v.own.ships.find(s=>s.id==='FF-2').x===3);
  assert.equal(new Set(played).size,20);await capture(page,'naval-desktop.png');
  console.log('PASS: all twenty cards through real UI, prerequisites, source selection, target previews, ten-cell barrage, lanes, lines, repairs, smoke and AP above three');

  const reef=await room('undertow'),reefPage=await pageFor(reef.host);await reefPage.waitForSelector('.hand-panel');
  assert.ok((await reefPage.locator('#own-grid [data-cell="65"]').getAttribute('title')).startsWith('深海'));
  const survey=await reef.findCard(reef.host,'recon');await reefPage.waitForSelector(`[data-card="${survey.id}"]:not(:disabled)`);await reefPage.locator(`[data-card="${survey.id}"]`).click();await reefPage.locator('#own-grid [data-cell="55"]').click();await reefPage.locator('[data-action="fire"]').click();
  await reefPage.waitForFunction(()=>document.querySelector('#own-grid [data-cell="65"]')?.title.startsWith('暗礁'));
  assert.ok((await state(reef.guest)).enemyTerrain.every(t=>t==='deep'));assert.equal(await reefPage.locator('.region-reef').count(),0);await reefPage.reload();await reefPage.waitForFunction(()=>document.querySelector('#own-grid [data-cell="65"]')?.title.startsWith('暗礁'));
  await capture(reefPage,'reef-survey.png','.boards');
  console.log('PASS: own-area reconnaissance identifies reefs, keeps sea artwork unchanged, stays private, and survives refresh');

  const mobile=await pageFor(host,true);await mobile.waitForSelector('.hand-panel');
  const available=await findCard(host,'recon');await mobile.waitForSelector(`[data-card="${available.id}"]:not(:disabled)`);await mobile.locator(`[data-card="${available.id}"]`).tap();await mobile.locator('#own-grid [data-cell="55"]').tap();await mobile.locator('[data-action="fire"]').tap();
  await mobile.waitForFunction(()=>!document.querySelector('.tactical-card.selected'));await capture(mobile,'naval-mobile.png');
  const enemyBox=await mobile.locator('.hostile-chart').boundingBox(),command=await mobile.locator('.command-card').boundingBox(),friendly=await mobile.locator('.friendly-chart').boundingBox();assert.ok(enemyBox.y<command.y&&command.y<friendly.y);
  for(const width of [768,1024,1280]){await page.setViewportSize({width,height:1000});assert.ok(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1));}
  console.log('PASS: 390px touch card flow and 768/1024/1280px responsive layouts');

  const practice=await pageFor();await practice.context().route('**/api/**',r=>r.fulfill({status:404,body:'{}'}));await practice.addInitScript(()=>{window.__navalNow=1000;Date.now=()=>window.__navalNow;Math.random=()=>0;});await practice.reload();
  await practice.locator('[data-action="practice"]').first().click();await practice.locator('[data-action="auto"]').click();await practice.evaluate(()=>window.__navalNow=2001);await practice.locator('[data-action="confirm"]').click();await practice.waitForSelector('.hand-panel');
  assert.equal(await practice.locator('[data-hand-count]').textContent(),'6');await practice.locator('[data-card-type="tactics"]:not(:disabled)').click();await practice.locator('[data-action="fire"]').click();await practice.waitForSelector('[data-card-type="supply"]:not(:disabled)');
  await practice.locator('[data-card-type="supply"]').click();await practice.locator('[data-action="fire"]').click();await practice.waitForFunction(()=>document.querySelector('.action-points')?.dataset.ap==='5');
  await practice.locator('[data-action="pass"]').click();await practice.waitForTimeout(350);await practice.evaluate(()=>window.__navalNow=4000);await practice.waitForFunction(()=>document.querySelector('.combat-log')?.textContent.includes('对手使用'));
  await capture(practice,'naval-practice.png');assert.deepEqual(errors,[]);console.log('PASS: static practice uses the twenty-card deck, zero-cost draw and supply, new AI, and no JavaScript exceptions');
  console.log(`Naval checks passed. Screenshots: ${output}`);
} finally {if(browser)await browser.close();await new Promise(resolve=>server.close(resolve));}
