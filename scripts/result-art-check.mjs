import assert from 'node:assert/strict';
import {once} from 'node:events';
import {mkdir} from 'node:fs/promises';
import {chromium} from 'playwright-core';
import {createGameServer} from '../server.mjs';
const server=createGameServer();server.listen(0,'127.0.0.1');await once(server,'listening');
const base=`http://127.0.0.1:${server.address().port}`;
let browser;
try {
  async function api(route,body,session){
    const r=await fetch(`${base}/api/${route}`,{method:'POST',headers:{'Content-Type':'application/json',...(session?{Authorization:`Bearer ${session.token}`}:{})},body:JSON.stringify(body)});
    const data=await r.json();assert.equal(r.status,200,data.error);return data;
  }
  const host=await api('create',{name:'北海舰队',roomName:'结算画面验收',mapId:'archipelago'});
  const guest=await api('join',{name:'远洋舰队',roomId:host.roomId});
  for(const s of [host,guest])await api('action',{type:'ready'},s);
  for(const s of [host,guest]){await api('action',{type:'auto'},s);await api('action',{type:'confirm'},s);}
  browser=await chromium.launch({channel:'msedge'});
  const context=await browser.newContext({viewport:{width:1440,height:900}});
  await context.route(/fonts\.(googleapis|gstatic)\.com/,r=>r.abort());
  await context.addInitScript(s=>sessionStorage.setItem('deepblue-session',JSON.stringify(s)),host);
  const page=await context.newPage(),errors=[];page.on('pageerror',e=>errors.push(e.message));
  await page.goto(base);await page.waitForSelector('.coastal-hand');
  await api('leave',{},guest);await page.waitForSelector('.result-card');
  assert.match(await page.locator('.result-chart-name').textContent(),/星罗棋布/);
  assert.match(await page.locator('.result-card').textContent(),/一位指挥官已离开/);
  assert.ok(await page.locator('[data-action="rematch"]').isDisabled());
  await mkdir('test-results/results',{recursive:true});
  await page.locator('.result-card').screenshot({path:'test-results/results/real-result.png'});
  await page.locator('[data-action="aftermath"]').click();await page.waitForSelector('.boards');
  await page.locator('[data-action="aftermath"]').click();assert.equal(await page.locator('.boards').count(),0);
  await page.setViewportSize({width:390,height:844});
  assert.ok(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth));
  await page.locator('.result-card [data-action="exit"]').click();await page.waitForSelector('.map-selection');
  assert.deepEqual(errors,[]);
  console.log('PASS: real result, disconnected opponent, battle recap toggle, mobile layout and return to lobby');
} finally {if(browser)await browser.close();await new Promise(resolve=>server.close(resolve));}
