import { cardSessionActions } from '../test-support/cards.mjs';
/** Isolated browser QA using real game APIs; never connects to a personal browser profile. */
import assert from 'node:assert/strict';
import { once } from 'node:events';
import { mkdir } from 'node:fs/promises';
import path from 'node:path';
import { chromium } from 'playwright-core';
import { createGameServer } from '../server.mjs';

const output = path.resolve(process.env.ART_CHECK_OUTPUT || 'test-results/art');
await mkdir(output, { recursive: true });
let now = Date.now();
const server = createGameServer({ now: () => now });
server.listen(0, '127.0.0.1');
await once(server, 'listening');
const base = `http://127.0.0.1:${server.address().port}`;
let browser;
const errors = [];
try {
  browser = await chromium.launch({ headless: true,
    ...(process.env.PLAYWRIGHT_EXECUTABLE_PATH ? { executablePath: process.env.PLAYWRIGHT_EXECUTABLE_PATH }
      : { channel: process.env.PLAYWRIGHT_CHANNEL || 'msedge' }),
  });
  async function context(options = {}) {
    const ctx = await browser.newContext({ viewport: { width: 1440, height: 1120 }, reducedMotion: 'reduce', ...options });
    // Check the local-font fallback too; remote font services are not needed for play.
    await ctx.route(/fonts\.(googleapis|gstatic)\.com/, route => route.abort());
    ctx.on('page', page => page.on('pageerror', e => errors.push(e.message)));
    return ctx;
  }
  async function artReady(page) {
    await page.waitForFunction(() => [...document.images].every(img => img.complete && img.naturalWidth > 0));
    await page.evaluate(() => document.fonts.ready);
  }
  async function capture(page, name, selector) {
    await artReady(page);
    await (selector ? page.locator(selector) : page).screenshot({ path: path.join(output, name), animations: 'disabled', ...(!selector ? { fullPage: true } : {}) });
  }
  async function noOverflow(page) {
    assert.ok(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1), 'Layout must not overflow horizontally');
  }

  const practiceContext = await context({ viewport: { width: 1440, height: 1500 } });
  const practice = await practiceContext.newPage();
  await practice.goto(base);
  await practice.locator('[data-action="practice"]').first().click();
  await practice.waitForSelector('#own-grid');
  await artReady(practice);
  const piece = await practice.locator('.dock-piece[data-ship="BB-1"]').boundingBox();
  const target = await practice.locator('#own-grid [data-cell="22"]').boundingBox();
  await practice.mouse.move(piece.x + piece.width / 2, piece.y + piece.height / 2);
  await practice.mouse.down();
  await practice.mouse.move(target.x + target.width / 2, target.y + target.height / 2, { steps: 16 });
  await practice.mouse.up();
  await practice.waitForSelector('.friendly-chart .ship-overlay');
  assert.equal(await practice.locator('.friendly-chart .ship-overlay').count(), 1, 'Drag deploys one intact ship');
  await practice.keyboard.press('r');
  await practice.waitForSelector('.friendly-chart .vessel.vertical');
  const vertical = await practice.locator('.friendly-chart .ship-overlay').boundingBox();
  assert.ok(vertical.height > vertical.width * 3.5, 'Rotation preserves the four-cell footprint');
  const visual = await practice.locator('.friendly-chart .ship-art').boundingBox();
  assert.ok(visual.width <= vertical.width + 2 && visual.height <= vertical.height + 2, 'Rotated artwork fits its legal cells');
  await practice.keyboard.press('Escape');
  await capture(practice, 'deployment-drag.png', '.game-wrap:has(.game-header)');
  await noOverflow(practice);
  await practiceContext.close();
  console.log('PASS: pointer drag, 90° rotation, sprite bounds and asset decoding');

  async function api(route, body, session) {
    const response = await fetch(`${base}/api/${route}`, { method: body ? 'POST' : 'GET',
      headers: { ...(body ? { 'Content-Type': 'application/json' } : {}), ...(session ? { Authorization: `Bearer ${session.token}` } : {}) },
      ...(body ? { body: JSON.stringify(body) } : {}),
    });
    const data = await response.json();
    assert.equal(response.status, 200, `API ${route}: ${data.error || response.status}`);
    return data;
  }
  const host = await api('create', { name: '北海指挥官', roomName: '北纬 31° · 雾海演习' });
  const guest = await api('join', { name: '远洋舰队', roomId: host.roomId });
  const {action,findCard}=cardSessionActions((s,a)=>api('action',a,s),s=>api('state',null,s),[host,guest]);
  await action(host, { type: 'ready' });
  await action(guest, { type: 'ready' });
  const placements = [
    ['BB-1', 1, 1, false], ['CG-1', 2, 4, false], ['CG-2', 8, 1, true],
    ['DD-1', 0, 6, true], ['DD-2', 5, 7, false], ['DD-3', 6, 5, true],
    ['FF-1', 1, 9, false], ['FF-2', 4, 9, false], ['FF-3', 9, 8, false], ['FF-4', 5, 3, false],
  ];
  for (const session of [host, guest]) for (const [id, x, y, vertical] of placements)
    await action(session, { type: 'place', id, x, y, vertical });
  const desktopContext = await context();
  await desktopContext.addInitScript(session => { if (location.protocol === 'http:') sessionStorage.setItem('deepblue-session', JSON.stringify(session)); }, host);
  const desktop = await desktopContext.newPage();
  await desktop.goto(base);
  await desktop.waitForSelector('.friendly-chart .ship-overlay');
  await capture(desktop, 'deployment-desktop.png');
  await capture(desktop, 'boards-deployment.png', '.boards');
  assert.equal(await desktop.locator('.friendly-chart .ship-overlay').count(), 10);
  assert.equal(await desktop.locator('.hostile-chart .ship-art').count(), 0, 'Fog must not contain enemy hull images');
  await noOverflow(desktop);
  console.log('PASS: ten-ship deployment and opaque opponent fog');

  await action(host, { type: 'confirm' });
  await action(guest, { type: 'confirm' });
  // Real alternating cannon shots create representative damage states on both boards.
  const hostShots = [11, 12, 13, 14, 18, 91, 0, 44];
  const guestShots = [11, 42, 43, 44, 60, 91, 99, 24];
  for (let i = 0; i < hostShots.length; i++) {
    await action(host, { type: 'fire', cell: hostShots[i] });
    await action(guest, { type: 'fire', cell: guestShots[i] });
  }
  await desktop.waitForSelector('.hostile-chart .wreck-overlay');
  await desktop.waitForFunction(() => document.querySelectorAll('.hostile-chart .impact-hit').length === 2);
  assert.equal(await desktop.locator('.hostile-chart .ship-art').count(), 2, 'Only the two fully sunk ships have hull art');
  assert.equal(await desktop.locator('.hostile-chart .impact-sunk').count(), 5);
  assert.equal(await desktop.locator('.hostile-chart .impact-miss').count(), 1);
  const shell=await findCard(host,'shell');
  await desktop.waitForSelector(`[data-card="${shell.id}"]:not(:disabled)`);await desktop.locator(`[data-card="${shell.id}"]`).click();
  await desktop.locator('#enemy-grid [data-cell="55"]').click();
  await capture(desktop, 'battle-desktop.png');
  await capture(desktop, 'boards-battle.png', '.boards');
  assert.equal(await desktop.locator('.cell.aim').count(), 1);
  await desktop.locator('[data-action="fire"]').click();
  await desktop.waitForFunction(() => document.querySelectorAll('.hostile-chart .impact-miss').length === 2);
  const fired = await api('state', null, host);
  assert.equal(fired.enemyCells[55], 'miss');
  assert.equal(fired.turn, 0, 'UI card fire preserves the turn while AP remain');
  assert.equal(fired.own.actionPoints,2);
  await action(host,{type:'pass'});
  await action(guest, { type: 'pass' });
  console.log('PASS: hit/smoke, sunk hulls, water splash, aim and fire through the UI');

  const mobileContext = await context({ viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true, deviceScaleFactor: 2 });
  await mobileContext.addInitScript(session => { if (location.protocol === 'http:') sessionStorage.setItem('deepblue-session', JSON.stringify(session)); }, host);
  const mobile = await mobileContext.newPage();
  await mobile.goto(base);
  await mobile.waitForSelector('.hostile-chart .wreck-overlay');
  await capture(mobile, 'battle-mobile.png');
  await noOverflow(mobile);
  const enemy = await mobile.locator('.hostile-chart').boundingBox();
  const own = await mobile.locator('.friendly-chart').boundingBox();
  assert.ok(enemy.y < own.y, 'Mobile battle places the attack board first');
  const command = await mobile.locator('.command-card').boundingBox();
  assert.ok(command.y > enemy.y && command.y < own.y, 'Touch firing controls stay beside the enemy board');
  assert.ok(await mobile.locator('.hostile-chart .impact-hit .fire-art').count() > 0);
  console.log('PASS: 390px touch layout, attack-board priority, reduced-motion damage states');
  for (const [width, height] of [[768, 1024], [1024, 768], [1280, 720]]) {
    await desktop.setViewportSize({ width, height });
    await noOverflow(desktop);
  }
  console.log('PASS: tablet and compact desktop layouts at 768, 1024 and 1280px');
  assert.deepEqual(errors, [], 'Browser must not raise JavaScript exceptions');
  console.log(`Artwork checks passed. Screenshots: ${output}`);
} finally {
  if (browser) await browser.close();
  await new Promise(resolve => server.close(resolve));
}
