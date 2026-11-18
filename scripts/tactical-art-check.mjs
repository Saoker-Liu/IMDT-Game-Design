import assert from 'node:assert/strict';
import {once} from 'node:events';
import {mkdir} from 'node:fs/promises';
import {chromium} from 'playwright-core';
import {createGameServer} from '../server.mjs';

const server=createGameServer();server.listen(0,'127.0.0.1');await once(server,'listening');
await mkdir('test-results/tactical',{recursive:true});
let browser;
try {
  browser=await chromium.launch({channel:'msedge'});
  const page=await browser.newPage({viewport:{width:1200,height:900}});
  await page.route(/fonts\.(googleapis|gstatic)\.com/,r=>r.abort());
  const errors=[];page.on('pageerror',e=>errors.push(e.message));
  await page.goto(`http://127.0.0.1:${server.address().port}/combat-art-review.html`);

  for(const [scene,selector] of [['illumination','.sight-light'],['smoke','.smoke-cell'],['torpedo','.torpedo-wake']]) {
    for(const version of ['baseline','refined']) {
      await page.selectOption('#scene',scene);await page.selectOption('#version',version);
      assert.equal(await page.locator(selector).count(),0,'Starts with no effect');
      await page.locator('#replay').click();await page.waitForTimeout(200);
      assert.equal(await page.locator(selector).count(),0,'Preparation frame is visible');
      await page.waitForTimeout(500);
      assert.ok(await page.locator(selector).count()>0,'Effect appears after launch');
      const animations=await page.locator('.board-matrix').evaluate(el=>el.getAnimations({subtree:true}).length);
      assert.equal(animations>0,version==='refined','Refined version unfolds; baseline appears immediately');
      if(version==='refined' && scene==='illumination') {
        const opacity=await page.locator('.illumination-tile').evaluateAll(nodes=>nodes.map(n=>({cell:Number(n.dataset.lightCell),opacity:Number(getComputedStyle(n).opacity)})));
        assert.ok(opacity.find(n=>n.cell===35).opacity>opacity.find(n=>n.cell===24).opacity,'Center lights before neighboring cells');
        assert.ok(await page.locator('.illumination-burst').count()>0,'Center burst precedes lighting');
      }
      if(version==='refined' && scene==='torpedo') {
        const size=await page.locator('.torpedo-dart').evaluate(el=>({width:el.getBoundingClientRect().width,cell:el.parentElement.clientWidth/10,hasBody:!!el.querySelector('svg')}));
        assert.ok(size.hasBody && size.width<size.cell,'Torpedo silhouette fits inside one cell');
        assert.ok(await page.locator('.torpedo-wake').evaluateAll(nodes=>nodes.every(el=>el.getBoundingClientRect().height<el.parentElement.clientWidth/2)),'Foam is narrower than half a cell');
      }
      await page.screenshot({path:`test-results/tactical/${scene}-${version}-unfolding.png`});
      await page.waitForTimeout(2900);
      assert.equal(await page.locator('.torpedo-dart').count(),0,'Projectile leaves no stale node');
      if(version==='refined' && scene==='torpedo')assert.ok(await page.locator('.torpedo-wake').evaluateAll(nodes=>nodes.every(n=>Number(getComputedStyle(n).opacity)===0)),'Foam disappears after travel');
      assert.match(await page.locator('#playback').textContent(),/播放完成/);
    }
  }
  // Switching during a replay cancels its pending launch.
  await page.locator('#replay').click();await page.selectOption('#scene','smoke');await page.waitForTimeout(2500);
  assert.equal(await page.locator('.smoke-cell,.torpedo-dart').count(),0);
  await page.emulateMedia({reducedMotion:'reduce'});await page.locator('#replay').click();await page.waitForTimeout(700);
  assert.ok(await page.locator('.smoke-cell').count()>0);
  assert.equal(await page.locator('.board-matrix').evaluate(el=>el.getAnimations({subtree:true}).length),0);
  await page.setViewportSize({width:390,height:844});
  assert.ok(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth));
  assert.deepEqual(errors,[]);
  console.log('PASS: three independent replays, before/after motion, clean reset, reduced motion and mobile layout');
} finally {if(browser)await browser.close();await new Promise(resolve=>server.close(resolve));}
