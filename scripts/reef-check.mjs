/** Verify hidden reef appearance, hover disclosure and session privacy in real browsers. */
import assert from 'node:assert/strict';
import { once } from 'node:events';
import { mkdir } from 'node:fs/promises';
import path from 'node:path';
import { chromium } from 'playwright-core';
import { createGameServer } from '../server.mjs';
import { cells } from '../public/engine.mjs';
import { terrainFor } from '../public/terrain.mjs';

const output=path.resolve(process.env.ART_CHECK_OUTPUT||'test-results/reefs');
await mkdir(output,{recursive:true});
const server=createGameServer({now:()=>1000,rng:()=>0});
server.listen(0,'127.0.0.1');await once(server,'listening');
const base=`http://127.0.0.1:${server.address().port}`;
const errors=[],requests=[];
let browser;
try {
  browser=await chromium.launch({channel:'msedge',headless:true});
  async function api(route,body,session) {
    const response=await fetch(`${base}/api/${route}`,{method:body?'POST':'GET',headers:{...(body?{'Content-Type':'application/json'}:{}),...(session?{Authorization:`Bearer ${session.token}`}:{})},...(body?{body:JSON.stringify(body)}:{})});
    const data=await response.json();assert.equal(response.status,200,data.error);return data;
  }
  const action=(session,body)=>api('action',body,session);
  async function pageFor(session) {
    const context=await browser.newContext({viewport:{width:1440,height:1120},reducedMotion:'reduce'});
    await context.route(/fonts\.(googleapis|gstatic)\.com/,r=>r.abort());
    if(session)await context.addInitScript(s=>sessionStorage.setItem('deepblue-session',JSON.stringify(s)),session);
    const page=await context.newPage();
    page.on('pageerror',e=>errors.push(e.message));page.on('request',r=>requests.push(r.url()));
    await page.goto(base);return page;
  }
  const title=(page,board,c)=>page.locator(`#${board}-grid [data-cell="${c}"]`).getAttribute('title');
  const waitTitle=(page,board,c)=>page.waitForFunction(({board,c})=>document.querySelector(`#${board}-grid [data-cell="${c}"]`)?.title.startsWith('暗礁'),{board,c});
  const waitShot=(page,c)=>page.waitForFunction(c=>['miss','hit','sunk'].some(status=>document.querySelector(`#enemy-grid [data-cell="${c}"]`)?.classList.contains(status)),c);
  const waitTurn=page=>page.waitForSelector('#enemy-grid .cell:not(:disabled)');
  async function seaStyle(page) {
    return page.locator('.friendly-chart .sea-paint').evaluate(el=>({image:getComputedStyle(el).backgroundImage,size:getComputedStyle(el).backgroundSize,position:getComputedStyle(el).backgroundPosition}));
  }
  async function checkSea(page,style) {
    assert.deepEqual(await seaStyle(page),style);
    assert.equal(await page.locator('.region-reef,.terrain-layer [data-terrain="reef"]').count(),0);
    assert.ok((await seaStyle(page)).image.includes('ocean-chart.webp'));
  }
  async function capture(page,name) {
    await page.evaluate(async()=>{
      await document.fonts.ready;
      for(const el of document.querySelectorAll('.sea-paint'))for(const m of getComputedStyle(el).backgroundImage.matchAll(/url\(["']?([^"')]+)["']?\)/g)){const img=new Image();img.src=m[1];await img.decode();}
    });
    await page.mouse.move(1,1);
    if(page.viewportSize().width<680)await page.screenshot({path:path.join(output,name),animations:'disabled',fullPage:true});
    else await page.locator('.boards').screenshot({path:path.join(output,name),animations:'disabled'});
    assert.ok(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1));
  }
  const host=await api('create',{name:'北海指挥官',mapId:'undertow'}),guest=await api('join',{name:'远洋舰队',roomId:host.roomId});
  await action(host,{type:'ready'});await action(guest,{type:'ready'});
  const placements=[['BB-1',0,0],['CG-1',0,2],['CG-2',5,2],['DD-1',0,4],['DD-2',3,4],['DD-3',6,4],['FF-1',0,6],['FF-2',2,6],['FF-3',4,6],['FF-4',6,6]];
  for(const s of [host,guest]) {
    for(const [id,x,y]of placements)await action(s,{type:'place',id,x,y,vertical:false});
    await action(s,{type:'confirm'});
  }
  const own=await pageFor(host),other=await pageFor(guest);
  await own.waitForSelector('#own-grid');await other.waitForSelector('#own-grid');
  const style=await seaStyle(own);
  const occupied=(await api('state',null,guest)).own.ships.flatMap(cells);
  const reef=terrainFor('undertow',1).findIndex((type,c)=>type==='reef'&&!occupied.includes(c));
  assert.ok((await title(own,'own',65)).startsWith('深海'));
  assert.ok((await title(own,'enemy',reef)).startsWith('深海'));
  assert.equal(await own.locator('.cell.terrain-reef').count(),0);
  await checkSea(own,style);await capture(own,'reef-undiscovered.png');

  await own.locator(`#enemy-grid [data-cell="${reef}"]`).click();
  await own.locator('[data-action="fire"]').click();await waitShot(own,reef);
  await own.locator(`#enemy-grid [data-cell="${reef}"]`).hover({force:true});
  assert.ok((await title(own,'enemy',reef)).startsWith('深海'));
  assert.equal(await own.locator('#enemy-grid .terrain-reef').count(),0);
  assert.ok((await title(other,'own',reef)).startsWith('深海'));
  await checkSea(own,style);
  await own.reload();await own.waitForSelector('#own-grid');
  assert.ok((await title(own,'enemy',reef)).startsWith('深海'));
  await checkSea(own,style);
  console.log('PASS: shell attacks keep reef hover text as deep water, including after refresh');

  await action(guest,{type:'pass'});await waitTurn(own);
  await own.locator('#own-grid [data-cell="64"]').click();
  await own.locator('[data-action="move"][data-dx="1"][data-dy="0"]').click();
  await waitTitle(own,'own',65);await own.waitForSelector('.friendly-chart .wreck-overlay');
  assert.ok((await title(own,'own',64)).startsWith('深海'));
  assert.ok((await title(other,'enemy',65)).startsWith('深海'));
  await checkSea(own,style);await capture(own,'reef-discovered.png');
  await own.reload();await waitTitle(own,'own',65);await checkSea(own,style);
  await own.locator('[data-action="terrain-guide"]').first().click();
  const guideStyles=await own.locator('.terrain-guide-art .sea-paint').evaluateAll(nodes=>nodes.map(node=>getComputedStyle(node).backgroundImage));
  assert.equal(guideStyles[0],guideStyles[2]);
  assert.equal(await own.locator('.terrain-guide .region-reef').count(),0);
  await own.locator('[data-action="close-modal"]').first().click();
  await own.setViewportSize({width:390,height:844});await checkSea(own,style);await capture(own,'reef-mobile.png');
  assert.ok((await title(own,'own',65)).startsWith('暗礁'));
  console.log('PASS: collision changes only entered reef hover text; discovery survives refresh, with no reef outline on desktop/mobile or in guide');

  const practice=await pageFor();
  const previewStyles=await practice.locator('.map-mini .sea-paint').evaluateAll(nodes=>nodes.map(node=>getComputedStyle(node).backgroundImage));
  assert.equal(previewStyles[0],previewStyles[2]);
  await practice.locator('[data-action="select-map"][data-map="undertow"]').click();
  await practice.locator('[data-action="practice"]').first().click();await practice.waitForSelector('#own-grid');
  assert.equal(await practice.locator('.cell.terrain-reef').count(),0);
  await checkSea(practice,style);
  await practice.locator('[data-action="auto"]').click();await practice.locator('[data-action="confirm"]').click();await waitTurn(practice);
  const target=terrainFor('undertow',1).findIndex(type=>type==='reef');
  assert.ok((await title(practice,'enemy',target)).startsWith('深海'));
  await practice.locator(`#enemy-grid [data-cell="${target}"]`).click();await practice.locator('[data-action="fire"]').click();
  await waitShot(practice,target);await checkSea(practice,style);
  assert.ok((await title(practice,'enemy',target)).startsWith('深海'));
  assert.equal(await practice.locator('#enemy-grid .terrain-reef').count(),0);
  assert.ok(!requests.some(url=>/chart-undertow|terrain-atlas|shoal-variants/.test(url)));
  assert.deepEqual(errors,[]);
  console.log(`PASS: map previews and practice use deep-water art; practice attacks never identify reefs. Screenshots: ${output}`);
} finally {
  if(browser)await browser.close();
  await new Promise(resolve=>server.close(resolve));
}
