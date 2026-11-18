import assert from 'node:assert/strict';
import {once} from 'node:events';
import {mkdir} from 'node:fs/promises';
import {chromium} from 'playwright-core';
import {createGameServer} from '../server.mjs';
const server=createGameServer();server.listen(0,'127.0.0.1');await once(server,'listening');
let browser;
try {
  browser=await chromium.launch({channel:'msedge'});
  const page=await browser.newPage();const errors=[];
  page.on('pageerror',e=>errors.push(e.message));
  await page.route(/fonts\.(googleapis|gstatic)\.com/,r=>r.abort());
  await page.goto(`http://127.0.0.1:${server.address().port}`);
  await mkdir('test-results/interface',{recursive:true});
  const modal=page.locator('#modal');
  async function fits(){assert.ok(await modal.evaluate(el=>el.scrollWidth<=el.clientWidth+1),'Dialog content fits its width');assert.ok(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth));}
  for(const [width,height] of [[1440,900],[1366,700],[768,1024],[390,844]]) {
    await page.setViewportSize({width,height});
    await page.locator('[data-action="rules"]').first().click();
    assert.equal(await modal.locator('.rule-ship').count(),5);
    await modal.evaluate(async el=>Promise.all([...el.querySelectorAll('img')].map(i=>i.decode())));
    await fits();await modal.screenshot({path:`test-results/interface/rules-${width}.png`});
    await page.keyboard.press('Escape');assert.equal(await modal.evaluate(el=>el.open),false);
    await page.locator('[data-action="card-guide"]').first().click();
    assert.equal(await modal.locator('.card-face').count(),20);await fits();
    await modal.locator('[data-action="close-modal"]').first().click();
    await page.locator('[data-action="create"]').first().click();await fits();
    await page.locator('#player-name').fill('北海指挥官');
    await modal.screenshot({path:`test-results/interface/create-${width}.png`});
    await page.keyboard.press('Escape');
    await page.locator('[data-action="join-code"]').click();
    await page.locator('#player-name').fill('远洋舰队');await page.locator('#room-code').fill('FFFFFF');
    await modal.locator('[type="submit"]').click();
    await page.waitForFunction(()=>document.querySelector('#form-error')?.textContent.length>0);
    await fits();await modal.screenshot({path:`test-results/interface/join-error-${width}.png`});
    await page.keyboard.press('Escape');
  }
  assert.deepEqual(errors,[]);
  console.log('PASS: five-ship manual, twenty-card guide, room forms, validation feedback, Escape and four viewport sizes');
} finally {if(browser)await browser.close();await new Promise(resolve=>server.close(resolve));}
