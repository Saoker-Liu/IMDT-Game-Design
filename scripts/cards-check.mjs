/** Card interactions in real LAN clients and the static practice app. */
import assert from 'node:assert/strict';
import { once } from 'node:events';
import { mkdir } from 'node:fs/promises';
import path from 'node:path';
import { chromium } from 'playwright-core';
import { createGameServer } from '../server.mjs';
import { cardSessionActions } from '../test-support/cards.mjs';

const output=path.resolve(process.env.ART_CHECK_OUTPUT||'test-results/cards');
await mkdir(output,{recursive:true});
let clock=1000;
const server=createGameServer({now:()=>clock,rng:()=>0});
server.listen(0,'127.0.0.1');await once(server,'listening');
const base=`http://127.0.0.1:${server.address().port}`,errors=[];
let browser;
try {
  browser=await chromium.launch({headless:true,...(process.env.PLAYWRIGHT_EXECUTABLE_PATH?{executablePath:process.env.PLAYWRIGHT_EXECUTABLE_PATH}:{channel:process.env.PLAYWRIGHT_CHANNEL||'msedge'})});
  async function api(route,body,s) {
    const r=await fetch(`${base}/api/${route}`,{method:body?'POST':'GET',headers:{...(body?{'Content-Type':'application/json'}:{}),...(s?{Authorization:`Bearer ${s.token}`}:{})},...(body?{body:JSON.stringify(body)}:{})});
    const data=await r.json();assert.equal(r.status,200,data.error);return data;
  }
  const send=(s,a)=>api('action',a,s),state=s=>api('state',null,s);
  const host=await api('create',{name:'北海指挥官',roomName:'卡牌战术 · 海域演习',mapId:'undertow'});
  const guest=await api('join',{name:'远洋舰队',roomId:host.roomId});
  for(const s of [host,guest])await send(s,{type:'ready'});
  const placements=[['BB-1',0,0],['CG-1',0,2],['CG-2',5,2],['DD-1',0,4],['DD-2',3,4],['DD-3',6,4],['FF-1',0,6],['FF-2',2,6],['FF-3',4,6],['FF-4',6,6]];
  for(const s of [host,guest]) {
    for(const [id,x,y]of placements)await send(s,{type:'place',id,x,y,vertical:false});
    await send(s,{type:'confirm'});
  }
  const {findCard}=cardSessionActions(send,state,[host,guest]);
  async function context(session,mobile=false) {
    const ctx=await browser.newContext({viewport:mobile?{width:390,height:844}:{width:1440,height:1120},reducedMotion:'reduce',...(mobile?{isMobile:true,hasTouch:true,deviceScaleFactor:2}:{})});
    await ctx.route(/fonts\.(googleapis|gstatic)\.com/,r=>r.abort());
    ctx.on('page',p=>p.on('pageerror',e=>errors.push(e.message)));
    if(session)await ctx.addInitScript(s=>{if(location.protocol==='http:')sessionStorage.setItem('deepblue-session',JSON.stringify(s));},session);
    return ctx;
  }
  async function screenshot(page,name) {
    await page.evaluate(async()=>{await document.fonts.ready;await Promise.all([...document.images].map(img=>img.decode()));});
    assert.ok(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1),'No document overflow');
    await page.screenshot({path:path.join(output,name),animations:'disabled',fullPage:true});
  }
  const page=await (await context(host)).newPage();await page.goto(base);await page.waitForSelector('.hand-panel');
  assert.equal(await page.locator('[data-hand-count]').textContent(),'6');assert.equal(await page.locator('[data-deck-count]').textContent(),'14');
  assert.equal(await page.locator('.action-points').getAttribute('data-ap'),'3');
  assert.equal(await page.locator('#enemy-grid .cell:not(:disabled)').count(),0);
  assert.equal(await page.locator('[data-action="move"]:not(:disabled)').count(),0);
  assert.equal(await page.locator('.hostile-chart .ship-art').count(),0);
  await screenshot(page,'cards-desktop.png');
  async function choose(page,card) {
    const selector=`[data-action="select-card"][data-card="${card.id}"]:not(:disabled)`;
    await page.waitForSelector(selector);await page.locator(selector).click();
  }
  const shots=(await state(host)).own.hand.filter(c=>c.type==='shell').slice(0,3);
  for(const [i,card]of shots.entries()) {
    await choose(page,card);await page.locator(`#enemy-grid [data-cell="${90+i}"]`).click();await page.locator('[data-action="fire"]').click();
    await page.waitForFunction(ap=>document.querySelector('.action-points')?.dataset.ap===String(ap),i===2?0:2-i);
  }
  let v=await state(host);assert.equal(v.turn,1);assert.equal(v.own.hand.length,3);assert.equal(v.own.deckCount,17);
  assert.equal(await page.locator('.tactical-card:not(:disabled)').count(),0);
  assert.ok((await page.locator('#enemy-grid [data-cell="90"]').getAttribute('title')).startsWith('深海'));
  await page.reload();await page.waitForSelector('.hand-panel');assert.equal(await page.locator('[data-hand-count]').textContent(),'3');assert.equal(await page.locator('.action-points').getAttribute('data-ap'),'0');
  console.log('PASS: LAN opening, gated controls, three consecutive plays, AP exhaustion and refresh without duplicate draws');

  const recon=await findCard(host,'recon');await choose(page,recon);
  await page.locator('#enemy-grid [data-cell="0"]').click();await page.locator('[data-action="fire"]').click();
  await page.waitForSelector('#enemy-grid [data-cell="0"].recon-contact');
  v=await state(host);assert.equal(v.enemyCells[0],'unknown');assert.equal(v.enemyTerrain[0],'deep');assert.equal(v.enemyRecon.find(i=>i.cell===0).contact,true);
  assert.deepEqual((await state(guest)).enemyRecon,[]);
  assert.equal(await page.locator('.hostile-chart .ship-art,.hostile-chart .impact-hit').count(),0);
  const shell=await findCard(host,'shell');await choose(page,shell);await page.locator('#enemy-grid [data-cell="0"]').click();await page.locator('[data-action="fire"]').click();
  await page.waitForSelector('#enemy-grid [data-cell="0"].hit');
  const move=await findCard(host,'move');await choose(page,move);await page.locator('#own-grid [data-cell="64"]').click();
  await page.locator('[data-action="move"][data-dx="1"][data-dy="0"]').click();
  await page.waitForFunction(()=>document.querySelector('#own-grid [data-cell="65"]')?.title.startsWith('暗礁'));
  assert.equal((await state(guest)).enemyTerrain[65],'deep');assert.equal(await page.locator('.region-reef').count(),0);
  await screenshot(page,'cards-recon-and-reef.png');
  console.log('PASS: reconnaissance card, private contact intel, cannon card and maneuver card; only grounding identifies a reef');

  const mobile=await (await context(host,true)).newPage();await mobile.goto(base);await mobile.waitForSelector('.hand-panel');
  const mobileShell=await findCard(host,'shell');await choose(mobile,mobileShell);
  const before=(await state(host)).own.actionPoints;
  await mobile.locator('#enemy-grid [data-cell="93"]').tap();await mobile.locator('[data-action="fire"]').tap();
  await mobile.waitForSelector('#enemy-grid [data-cell="93"].miss');assert.equal((await state(host)).own.actionPoints,before-1);
  await screenshot(mobile,'cards-mobile.png');
  const enemy=await mobile.locator('.hostile-chart').boundingBox(),command=await mobile.locator('.command-card').boundingBox(),own=await mobile.locator('.friendly-chart').boundingBox();
  assert.ok(enemy.y<command.y&&command.y<own.y,'Mobile keeps command controls after the enemy chart');
  for(const width of [768,1024,1280]) {await page.setViewportSize({width,height:1000});assert.ok(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1));}
  console.log('PASS: touch card/target/confirm flow, hand scrolling and 390/768/1024/1280px layouts');

  const practiceContext=await context();
  await practiceContext.route('**/api/**',r=>r.fulfill({status:404,body:'{}'}));
  await practiceContext.addInitScript(()=>{window.__cardTestNow=1000;Date.now=()=>window.__cardTestNow;Math.random=()=>0;});
  const demo=await practiceContext.newPage();await demo.goto(base);await demo.locator('[data-action="practice"]').first().click();await demo.locator('[data-action="auto"]').click();
  await demo.evaluate(()=>window.__cardTestNow=2001);await demo.locator('[data-action="confirm"]').click();await demo.waitForSelector('.hand-panel');
  assert.equal(await demo.locator('[data-hand-count]').textContent(),'6');
  for(let i=0;i<3;i++) {
    await demo.locator('[data-card-type="shell"]:not(:disabled)').first().click();await demo.locator(`#enemy-grid [data-cell="${90+i}"]`).click();await demo.locator('[data-action="fire"]').click();
    await demo.waitForFunction(ap=>document.querySelector('.action-points')?.dataset.ap===String(ap),i===2?0:2-i);
  }
  await demo.waitForFunction(()=>document.querySelector('.turn-status')?.textContent.includes('对手回合'));
  await demo.waitForTimeout(350); // Let the bot schedule its first action at the frozen time.
  await demo.evaluate(()=>window.__cardTestNow=4000);await demo.waitForFunction(()=>document.querySelector('.turn-status')?.textContent.includes('剩余 2'));
  await demo.evaluate(()=>window.__cardTestNow=6000);await demo.waitForFunction(()=>document.querySelector('.turn-status')?.textContent.includes('剩余 1'));
  await demo.evaluate(()=>window.__cardTestNow=8000);await demo.waitForFunction(()=>document.querySelector('.action-points')?.dataset.ap==='3');
  assert.equal(await demo.locator('[data-hand-count]').textContent(),'5');
  await screenshot(demo,'cards-practice.png');
  assert.deepEqual(errors,[]);console.log('PASS: static practice app and AI use cards, spend AP, draw on the next turn, and raise no JavaScript exceptions');
  console.log(`Card checks passed. Screenshots: ${output}`);
} finally {
  if(browser)await browser.close();
  await new Promise(resolve=>server.close(resolve));
}
