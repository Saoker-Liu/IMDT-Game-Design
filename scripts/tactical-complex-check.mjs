import assert from 'node:assert/strict';
import {once} from 'node:events';
import {mkdir} from 'node:fs/promises';
import {chromium} from 'playwright-core';
import {createGameServer} from '../server.mjs';
const server=createGameServer();server.listen(0,'127.0.0.1');await once(server,'listening');
let browser;
try {
  browser=await chromium.launch({channel:'msedge'});
  const page=await browser.newPage({viewport:{width:1200,height:900}}),errors=[];
  page.on('pageerror',e=>errors.push(e.message));
  await page.route(/fonts\.(googleapis|gstatic)\.com/,r=>r.abort());
  await page.goto(`http://127.0.0.1:${server.address().port}/combat-art-review.html`);
  await page.waitForSelector('#scene option[value="diagonal"]',{state:'attached'});
  for(const trace of [[11,22,33,44,55,66,77,88],[88,77,66,55,44,33,22,11],[11,21,31,41,51,61,71,81],[44],[50,51,52,53,54,55,56,57]]) {
    const result=await page.evaluate(async trace=>{
      const {playTacticalEntrance}=await import('./art.mjs?v=5.2.17');
      const board=document.querySelector('.board-matrix');board.innerHTML='';
      playTacticalEntrance(document,{traces:[trace]});
      const dart=board.querySelector('.torpedo-dart'),animation=dart.getAnimations()[0];
      animation.pause();animation.currentTime=Number(animation.effect.getTiming().duration)/2;
      await new Promise(requestAnimationFrame);
      const r=board.getBoundingClientRect(),d=dart.getBoundingClientRect();
      const first=trace[0],last=trace.at(-1);
      const expectedX=r.x+((first%10+last%10)/2+.5)*r.width/10;
      const expectedY=r.y+((Math.floor(first/10)+Math.floor(last/10))/2+.5)*r.height/10;
      const error=Math.hypot(d.x+d.width/2-expectedX,d.y+d.height/2-expectedY);
      const size=Math.max(d.width,d.height)/(r.width/10);animation.cancel();
      return {error,size};
    },trace);
    assert.ok(result.error<1,`Projectile center follows its path: ${trace}, error ${result.error}`);
    assert.ok(result.size<1,'Rotated projectile stays smaller than one cell');
  }
  await mkdir('test-results/tactical-complex',{recursive:true});
  for(const scene of ['triple','diagonal','overlap']) {
    await page.selectOption('#scene',scene);await page.locator('#replay').click();
    await page.waitForTimeout(720);
    if(scene==='overlap') {
      const cells=await page.locator('.illumination-tile').evaluateAll(nodes=>nodes.map(n=>Number(n.dataset.lightCell)).sort((a,b)=>a-b));
      assert.deepEqual(cells,[24,25,26,34,44],'Smoke-covered cells never receive temporary illumination tiles');
      const mask=await page.locator('.sighted-hull').getAttribute('style');
      assert.ok(decodeURIComponent(mask).includes('x="5" y="2"'),'Partial hull retains the visible-cell mask');
    } else assert.equal(await page.locator('.torpedo-dart').count(),scene==='triple'?3:1);
    await page.screenshot({path:`test-results/tactical-complex/${scene}.png`});
    await page.waitForTimeout(3000);
    assert.equal(await page.locator('.torpedo-dart,.illumination-reveal').count(),0,'Effects clean up fully');
  }
  await page.setViewportSize({width:390,height:844});await page.selectOption('#scene','triple');
  await page.locator('#replay').click();await page.waitForTimeout(720);
  assert.ok(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth));
  await page.screenshot({path:'test-results/tactical-complex/triple-mobile.png'});
  await page.emulateMedia({reducedMotion:'reduce'});await page.selectOption('#scene','overlap');await page.locator('#replay').click();await page.waitForTimeout(720);
  assert.equal(await page.locator('.illumination-reveal,.torpedo-dart').count(),0);
  assert.deepEqual(errors,[]);
  console.log('PASS: five path directions, centered sprites, triple lanes, smoke-clipped illumination, cleanup, mobile and reduced motion');
} finally {if(browser)await browser.close();await new Promise(resolve=>server.close(resolve));}
