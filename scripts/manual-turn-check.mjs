/** A human retains a zero-AP turn across time and reload until explicitly ending it. */
import assert from 'node:assert/strict';
import { once } from 'node:events';
import { mkdir } from 'node:fs/promises';
import { chromium } from 'playwright-core';
import { createGameServer } from '../server.mjs';

let clock=1000,browser;
const server=createGameServer({now:()=>clock,rng:()=>0});server.listen(0,'127.0.0.1');await once(server,'listening');
const base=`http://127.0.0.1:${server.address().port}`,errors=[];
try {
  browser=await chromium.launch({channel:'msedge',headless:true});
  async function api(route,body,s) {
    const r=await fetch(`${base}/api/${route}`,{method:body?'POST':'GET',headers:{...(body?{'Content-Type':'application/json'}:{}),...(s?{Authorization:`Bearer ${s.token}`}:{})},...(body?{body:JSON.stringify(body)}:{})});
    const data=await r.json();assert.equal(r.status,200,data.error);return data;
  }
  const host=await api('create',{name:'北海指挥官',roomName:'不限时舰队演习'}),guest=await api('join',{name:'远洋舰队',roomId:host.roomId});
  const state=s=>api('state',null,s),send=(s,a)=>api('action',a,s);
  for(const s of [host,guest])await send(s,{type:'ready'});
  for(const s of [host,guest]){await send(s,{type:'auto'});await send(s,{type:'confirm'});}
  for(let i=0;i<18;i++){const v=await state(host);await send(v.turn===0?host:guest,{type:'pass'});}
  const context=await browser.newContext({viewport:{width:1440,height:1120},reducedMotion:'reduce'});
  await context.route(/fonts\.(googleapis|gstatic)\.com/,r=>r.abort());
  await context.addInitScript(s=>{if(location.protocol==='http:')sessionStorage.setItem('deepblue-session',JSON.stringify(s));},host);
  const page=await context.newPage();page.on('pageerror',e=>errors.push(e.message));await page.goto(base);await page.waitForSelector('.hand-panel');
  assert.equal(await page.locator('#timer-number,#timer-ring').count(),0);assert.ok((await page.locator('.turn-counter').textContent()).includes('不限时'));
  assert.equal(await page.locator('.friendly-chart img.carrier-art').count(),1);
  assert.ok((await page.locator('.friendly-chart img.carrier-art').getAttribute('src')).includes('fleet-carrier.webp'));
  assert.equal(await page.locator('svg.carrier-art').count(),0);
  async function use(type,cell,own=false) {
    await page.locator(`[data-card-type="${type}"]:not(:disabled)`).click();
    if(cell!==undefined)await page.locator(`#${own?'own':'enemy'}-grid [data-cell="${cell}"]`).click();
    await page.locator('[data-action="fire"]').click();await page.waitForFunction(()=>!document.querySelector('.tactical-card.selected'));
  }
  await use('supply');await use('secondary',90);await use('main',91);await use('tactics');await use('supply');await use('big',92);await use('recon',55,true);
  const before=await state(host);assert.equal(before.own.actionPoints,0);assert.equal(before.turn,0);assert.equal(before.deadline,null);
  assert.ok(!before.own.hand.some(c=>['supply','tactics'].includes(c.type)));
  assert.ok(await page.locator('[data-action="pass"]').isEnabled());
  clock=65_000;const waited=await state(host);await state(guest);
  assert.equal(waited.turn,0);assert.deepEqual(waited.own.hand,before.own.hand);assert.equal(waited.own.actionPoints,0);assert.equal(waited.round,before.round);
  await page.reload();await page.waitForSelector('.hand-panel');assert.equal(await page.locator('.action-points').getAttribute('data-ap'),'0');
  assert.equal(await page.locator('#timer-number,#timer-ring').count(),0);assert.ok(await page.locator('[data-action="pass"]').isEnabled());
  await mkdir('test-results/manual-turns',{recursive:true});await page.screenshot({path:'test-results/manual-turns/zero-ap-waiting.png',fullPage:true,animations:'disabled'});
  await page.locator('[data-action="pass"]').click();await page.waitForFunction(()=>document.querySelector('.turn-status')?.textContent.includes('对手回合'));
  const next=await state(guest);assert.equal(next.turn,1);assert.equal(next.own.actionPoints,3);assert.equal(next.round,before.round+1);assert.equal(next.deadline,null);
  await page.setViewportSize({width:390,height:844});assert.ok(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1));
  await page.screenshot({path:'test-results/manual-turns/mobile.png',fullPage:true,animations:'disabled'});
  assert.deepEqual(errors,[]);
  console.log('PASS: painted carrier asset, no battle timer, zero AP with no free cards retains the turn after 64 seconds and reload, and confirmation alone passes/draws/restores AP');
} finally {if(browser)await browser.close();await new Promise(resolve=>server.close(resolve));}
