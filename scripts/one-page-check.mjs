import assert from 'node:assert/strict';
import { once } from 'node:events';
import { mkdir } from 'node:fs/promises';
import { chromium } from 'playwright-core';
import { createGameServer } from '../server.mjs';

// An isolated browser checks the new public entry, including the existing game's subpath links.
const server=process.env.ONE_PAGE_URL?null:createGameServer();
if(server){server.listen(0,'127.0.0.1');await once(server,'listening');}
const site=process.env.ONE_PAGE_URL||`http://127.0.0.1:${server.address().port}/one-page/`;
const game=new URL('../',site).href,origin=new URL(site).origin;
const output='test-results/one-page';
await mkdir(output,{recursive:true});
let browser;
try{
  browser=await chromium.launch({headless:true,...(process.env.PLAYWRIGHT_EXECUTABLE_PATH?{executablePath:process.env.PLAYWRIGHT_EXECUTABLE_PATH}:{channel:'msedge'})});
  const context=await browser.newContext({viewport:{width:1440,height:1000},deviceScaleFactor:1,reducedMotion:'no-preference'});
  const errors=[],external=[];
  context.on('page',page=>{
    page.on('pageerror',error=>errors.push(error.message));
    page.on('response',response=>{
      // The existing game probes for a LAN backend, then uses practice mode on static hosting.
      const staticDiscovery=!server&&response.status()===404&&response.url()===new URL('api/health',game).href;
      if(response.status()>=400&&!staticDiscovery)errors.push(`${response.status()} ${response.url()}`);
    });
    page.on('request',request=>{
      const onSite=new URL(page.url()).pathname===new URL(site).pathname;
      if(onSite&&new URL(request.url()).origin!==origin)external.push(request.url());
    });
  });
  const page=await context.newPage();
  async function load(){await page.goto(site);await page.evaluate(()=>document.fonts.ready);await page.locator('.hero-art').evaluate(image=>image.decode());}
  async function stage(index){await page.locator(`.tactic-tab[data-stage="${index}"]`).click();assert.equal(await page.locator('#tactical-display').getAttribute('data-stage'),String(index));}
  async function screenshot(name,fullPage=false){await page.screenshot({path:`${output}/${name}.png`,fullPage,animations:'disabled'});}
  async function noOverflow(){assert.ok(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1),`Horizontal overflow at ${page.viewportSize().width}px`);}
  await load();
  assert.equal(await page.title(),'雾海对弈 FOGBOUND｜读懂迷雾，打出胜机。');
  assert.equal(await page.locator('#motion-toggle').getAttribute('aria-pressed'),'true');
  assert.ok(await page.evaluate(()=>document.fonts.check('600 48px "Maritime Serif"')&&document.fonts.check('600 40px "Maritime Display"')));
  assert.equal(await page.locator('.hero-actions .button-primary').getAttribute('href'),'../');
  await screenshot('desktop-hero');

  await page.locator('.main-nav a[href="#tactics"]').click();
  await page.waitForTimeout(850);
  await stage(0);await screenshot('desktop-recon');
  await stage(1);await page.waitForTimeout(1400);
  const moved=await page.locator('.demo-cruiser').boundingBox();
  await page.locator('#tab-move').focus();await page.keyboard.press('ArrowRight');
  assert.equal(await page.locator('#tab-strike').getAttribute('aria-selected'),'true');
  assert.equal(await page.locator('#tab-strike').evaluate(node=>node===document.activeElement),true);
  await page.waitForTimeout(900);
  const fired=await page.locator('.demo-cruiser').boundingBox();
  assert.ok(Math.abs(moved.x-fired.x)<1&&Math.abs(moved.y-fired.y)<1,'Salvo must hit the ship at its new location');
  assert.equal(await page.locator('.strike-zone i').count(),5);
  await page.waitForFunction(()=>Number(getComputedStyle(document.querySelector('.demo-fires')).opacity)>.99);
  await screenshot('desktop-salvo');
  await page.keyboard.press('Home');assert.equal(await page.locator('#tactical-display').getAttribute('data-stage'),'0');
  await page.locator('.demo-card[data-stage="2"]').click();
  assert.equal(await page.locator('#demo-play').getAttribute('aria-pressed'),'false');
  await stage(0);
  await page.locator('#demo-play').click();
  await page.evaluate(()=>{document.activeElement.blur();document.querySelector('#tactical-display').scrollIntoView({behavior:'instant',block:'center'});});
  await page.mouse.move(2,90);await page.waitForTimeout(6500);
  assert.equal(await page.locator('#tactical-display').getAttribute('data-stage'),'1','Visible demo should advance automatically');
  await page.locator('#motion-toggle').click();
  assert.equal(await page.locator('html').getAttribute('data-motion'),'off');
  assert.equal(await page.evaluate(()=>document.getAnimations().filter(animation=>animation.playState==='running').length),0);
  await page.reload();assert.equal(await page.locator('html').getAttribute('data-motion'),'off','Motion choice must persist');

  await page.locator('#fleet').scrollIntoViewIfNeeded();
  for(const [type,name] of [['battleship','战列舰'],['cruiser','巡洋舰'],['destroyer','驱逐舰'],['frigate','护卫舰'],['carrier','航空母舰']]){
    await page.locator(`[data-fleet="${type}"]`).click();
    await page.waitForFunction(type=>document.querySelector('.fleet-stage').dataset.ship===type,type);
    assert.equal(await page.locator('#fleet-name').textContent(),name);
    assert.ok(await page.locator('#fleet-hero-ship').evaluate(image=>image.complete&&image.naturalWidth>0));
    assert.equal(await page.locator(`[data-fleet="${type}"]`).getAttribute('aria-pressed'),'true');
  }
  await page.evaluate(()=>{document.querySelector('[data-fleet="battleship"]').click();document.querySelector('[data-fleet="carrier"]').click();});
  await page.waitForTimeout(300);assert.equal(await page.locator('.fleet-stage').getAttribute('data-ship'),'carrier','Latest fleet selection wins');
  await screenshot('desktop-fleet');
  await page.locator('#waters').scrollIntoViewIfNeeded();await screenshot('desktop-waters');

  for(const map of ['archipelago','undertow','blue-frontier']){
    await page.locator(`.map-panel[data-map="${map}"]`).click();
    await page.waitForURL(url=>url.href===game);
    await page.waitForSelector(`.map-card.selected[data-map="${map}"]`);
    assert.equal(await page.evaluate(()=>localStorage.getItem('fogbound-map')),map);
    await load();
  }
  for(const width of [1920,1440,1024,768,390,320]){
    await page.setViewportSize({width,height:width<600?844:1000});
    await page.evaluate(()=>scrollTo({top:0,behavior:'instant'}));await noOverflow();
    const heading=await page.locator('#hero-title').boundingBox(),header=await page.locator('#site-header').boundingBox();
    assert.ok(heading.y>=header.height,'Hero title must clear the fixed header');
    if(width>=350)assert.ok(await page.locator('.header-play').isVisible());
    for(const id of ['tactics','fleet','waters','sail']){await page.locator(`#${id}`).scrollIntoViewIfNeeded();await noOverflow();}
  }
  await page.setViewportSize({width:390,height:844});
  await page.evaluate(()=>scrollTo({top:0,behavior:'instant'}));await screenshot('mobile-hero');
  await page.locator('#menu-toggle').click();assert.equal(await page.locator('#menu-toggle').getAttribute('aria-expanded'),'true');
  await page.keyboard.press('Escape');assert.equal(await page.locator('#menu-toggle').getAttribute('aria-expanded'),'false');
  await page.locator('#menu-toggle').click();await page.locator('.main-nav a[href="#fleet"]').click();
  assert.equal(await page.locator('#menu-toggle').getAttribute('aria-expanded'),'false');
  await page.locator('#fleet').scrollIntoViewIfNeeded();await screenshot('mobile-fleet');
  await page.locator('#waters').scrollIntoViewIfNeeded();await screenshot('mobile-waters');
  await page.locator('#tactics').scrollIntoViewIfNeeded();await screenshot('mobile-tactics');
  await page.evaluate(()=>{document.querySelectorAll('[data-reveal]').forEach(node=>node.classList.add('is-visible'));document.activeElement.blur();scrollTo({top:0,behavior:'instant'});});
  await screenshot('mobile-full',true);
  await page.setViewportSize({width:1440,height:1000});await screenshot('desktop-full',true);
  await page.locator('.header-play').click();await page.waitForURL(url=>url.href===game);await page.waitForSelector('.map-selection');

  const reduced=await browser.newContext({viewport:{width:390,height:844},reducedMotion:'reduce'});
  const reducedPage=await reduced.newPage();await reducedPage.goto(site);
  assert.equal(await reducedPage.locator('html').getAttribute('data-motion'),'off');
  assert.equal(await reducedPage.locator('#demo-play').getAttribute('aria-pressed'),'false');
  await reducedPage.locator('#tactical-display').scrollIntoViewIfNeeded();
  assert.equal(await reducedPage.evaluate(()=>document.getAnimations().filter(animation=>animation.playState==='running').length),0);
  await reduced.close();
  const staticContext=await browser.newContext({javaScriptEnabled:false,viewport:{width:390,height:844}});
  const staticPage=await staticContext.newPage();await staticPage.goto(site);
  for(const title of await staticPage.locator('h1,h2').all())assert.ok(await title.isVisible());
  assert.equal(await staticPage.locator('.hero-actions .button-primary').getAttribute('href'),'../');
  assert.ok(await staticPage.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1));
  await staticContext.close();
  assert.deepEqual(errors,[]);assert.deepEqual(external,[]);
  console.log(`PASS: ${site}\nSix viewport widths, local fonts/assets, tactical sequence and autoplay, keyboard controls, five fleet types and selection races, all map/game links, mobile navigation, motion preferences and no-JavaScript reading. Screenshots: ${output}`);
}finally{
  if(browser)await browser.close();
  if(server)await new Promise(resolve=>server.close(resolve));
}
