/** Verify contested air control through two real browser clients. */
import assert from 'node:assert/strict';
import { once } from 'node:events';
import { mkdir } from 'node:fs/promises';
import { chromium } from 'playwright-core';
import { createGameServer } from '../server.mjs';

const server=createGameServer({now:()=>1000,rng:()=>0}),errors=[];
server.listen(0,'127.0.0.1');await once(server,'listening');
const base=`http://127.0.0.1:${server.address().port}`;let browser;
try {
  browser=await chromium.launch({channel:'msedge',headless:true});
  async function api(route,body,s) {
    const r=await fetch(`${base}/api/${route}`,{method:body?'POST':'GET',headers:{...(body?{'Content-Type':'application/json'}:{}),...(s?{Authorization:`Bearer ${s.token}`}:{})},...(body?{body:JSON.stringify(body)}:{})});
    const data=await r.json();assert.equal(r.status,200,data.error);return data;
  }
  const host=await api('create',{name:'甲',roomName:'制空权争夺'}),guest=await api('join',{name:'乙',roomId:host.roomId});
  const state=s=>api('state',null,s),send=(s,a)=>api('action',a,s);
  for(const s of [host,guest])await send(s,{type:'ready'});
  for(const s of [host,guest]){await send(s,{type:'auto'});await send(s,{type:'confirm'});}
  for(let i=0;i<18;i++){const v=await state(host);await send(v.turn===0?host:guest,{type:'pass'});}
  async function pageFor(session) {
    const context=await browser.newContext({viewport:{width:1440,height:1120},reducedMotion:'reduce'});
    await context.route(/fonts\.(googleapis|gstatic)\.com/,r=>r.abort());
    await context.addInitScript(s=>{if(location.protocol==='http:')sessionStorage.setItem('deepblue-session',JSON.stringify(s));},session);
    const page=await context.newPage();page.on('pageerror',e=>errors.push(e.message));await page.goto(base);await page.waitForSelector('.hand-panel');return page;
  }
  const a=await pageFor(host),b=await pageFor(guest);
  async function use(page,type) {
    await page.locator(`[data-card-type="${type}"]:not(:disabled)`).click();await page.locator('[data-action="fire"]').click();
    await page.waitForFunction(()=>!document.querySelector('.tactical-card.selected'));
  }
  await use(a,'fighter');assert.equal((await state(host)).airControl.owner,0);await a.locator('[data-action="pass"]').click();
  await b.waitForSelector('[data-card-type="fighter"]:not(:disabled)');
  for(const type of ['bomber','torpedoPlane','seaplane']) {
    assert.ok(await b.locator(`[data-card-type="${type}"]`).isDisabled());
    assert.ok((await b.locator(`[data-card-type="${type}"]`).getAttribute('title')).includes('敌方占据制空权'));
  }
  await use(b,'fighter');let v=await state(guest);
  assert.deepEqual(v.airControl,{owner:1,remaining:3});assert.equal(v.own.actionPoints,1);
  await a.waitForFunction(()=>document.querySelector('.battle-effects')?.textContent.includes('敌方制空权'));
  await use(b,'supply');assert.ok(await b.locator('[data-card-type="bomber"]').isEnabled());
  await b.locator('[data-action="pass"]').click();await a.waitForSelector('[data-card-type="fighter"]:not(:disabled)');
  assert.ok(await a.locator('[data-card-type="bomber"]').isDisabled());
  await use(a,'fighter');v=await state(host);assert.deepEqual(v.airControl,{owner:0,remaining:3});assert.equal(v.own.actionPoints,1);
  await b.reload();await b.waitForSelector('.hand-panel');assert.ok((await b.locator('.battle-effects').textContent()).includes('敌方制空权'));
  await mkdir('test-results/air',{recursive:true});await a.screenshot({path:'test-results/air/air-recaptured.png',fullPage:true,animations:'disabled'});
  for(let remaining=2;remaining>=0;remaining--) {
    await send(host,{type:'pass'});await send(guest,{type:'pass'});
    assert.equal((await state(host)).airControl?.remaining||0,remaining);
  }
  assert.deepEqual(errors,[]);
  console.log('PASS: fighters launch under enemy control, both sides capture and recapture, AP costs and aircraft restrictions update, refresh restores control, and the new three-turn duration expires correctly');
} finally {if(browser)await browser.close();await new Promise(resolve=>server.close(resolve));}
