/** Inspect the complete map paintings against real room geography in an isolated browser. */
import assert from 'node:assert/strict';
import { once } from 'node:events';
import { mkdir } from 'node:fs/promises';
import path from 'node:path';
import { chromium } from 'playwright-core';
import { createGameServer } from '../server.mjs';
import { terrainFor } from '../public/terrain.mjs';

const output = path.resolve(process.env.ART_CHECK_OUTPUT || 'test-results/charts');
await mkdir(output, { recursive: true });
const server = createGameServer();
server.listen(0, '127.0.0.1');
await once(server, 'listening');
const base = `http://127.0.0.1:${server.address().port}`;
const errors = [];
let browser;
try {
  browser = await chromium.launch({ channel: 'msedge', headless: true });
  async function api(route, body, session) {
    const response = await fetch(`${base}/api/${route}`, {
      method: 'POST', headers: { 'Content-Type': 'application/json', ...(session ? { Authorization: `Bearer ${session.token}` } : {}) }, body: JSON.stringify(body),
    });
    const data = await response.json();
    assert.equal(response.status, 200, data.error);
    return data;
  }
  async function screenshot(page, file, selector) {
    await page.evaluate(async () => {
      await document.fonts.ready;
      const urls = new Set();
      for (const el of document.querySelectorAll('.terrain-layer, .terrain-layer *, .map-mini, .map-mini *, .terrain-guide-art'))
        for (const match of getComputedStyle(el).backgroundImage.matchAll(/url\(["']?([^"')]+)["']?\)/g)) urls.add(match[1]);
      await Promise.all([...urls].map(async src => { const img = new Image(); img.src = src; await img.decode(); }));
    });
    await page.mouse.move(1, 1);
    await (selector ? page.locator(selector) : page).screenshot({ path: path.join(output, file), animations: 'disabled', ...(!selector ? { fullPage: true } : {}) });
    assert.ok(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1));
  }
  async function checkGeography(page, mapId, coastal = false) {
    const expected = [terrainFor(mapId, 0), terrainFor(mapId, 1)];
    const result = await page.evaluate(({ expected, mapId, coastal }) => {
      const problems = [];
      for (const [side, selector] of ['.friendly-chart', '.hostile-chart'].entries()) {
        const board = document.querySelector(selector);
        const scene = board.querySelector('.terrain-layer');
        if (scene.dataset.chart !== mapId) problems.push(`${selector}: wrong chart`);
        if (mapId !== 'open-sea' && Number(scene.dataset.facing) !== side) problems.push(`${selector}: wrong shore`);
        const painting = coastal ? `.coastal-art-${side}` : '.sea-paint';
        if (scene.querySelectorAll(painting).length !== 1 || scene.querySelector('.terrain-tile')) problems.push(`${selector}: expected one whole painting`);
        const svg = scene.querySelector('svg');
        const regions = [...scene.querySelectorAll('.terrain-region')];
        for (let c = 0; c < 100; c++) {
          const cell = board.querySelector(`[data-cell="${c}"]`);
          if (getComputedStyle(cell).backgroundImage !== 'none') problems.push(`${selector}: individual cell image at ${c}`);
          const rect = cell.getBoundingClientRect();
          // Probe the center and four interior corners, in real rendered screen coordinates.
          for (const [u, v] of [[.5,.5], [.12,.12], [.88,.12], [.12,.88], [.88,.88]]) {
            const p = new DOMPoint(rect.x + rect.width * u, rect.y + rect.height * v);
            const matches = svg ? regions.filter(region => region.isPointInFill(p.matrixTransform(svg.getScreenCTM().inverse()))).map(region => region.dataset.terrain) : [];
            const actual = expected[side][c];
            const target = actual === 'reef' ? 'deep' : actual;
            if ((target === 'deep' && matches.length) || (target !== 'deep' && (matches.length !== 1 || matches[0] !== target))) problems.push(`${selector}: ${c} ${u},${v} expected ${target}, got ${matches}`);
          }
        }
      }
      return problems;
    }, { expected, mapId, coastal });
    assert.deepEqual(result, [], 'Painted zone contours agree with all playable cells, for both shores');
  }
  for (const mapId of ['archipelago', 'undertow', 'blue-frontier', 'open-sea']) {
    const host = await api('create', { name: '海域指挥官', roomName: '统一海域美术检查', mapId });
    const guest = await api('join', { name: '远洋舰队', roomId: host.roomId });
    await api('action', { type: 'ready' }, host);
    await api('action', { type: 'ready' }, guest);
    const context = await browser.newContext({ viewport: { width: 1440, height: 1120 }, reducedMotion: 'reduce' });
    await context.route(/fonts\.(googleapis|gstatic)\.com/, r => r.abort());
    await context.addInitScript(s => sessionStorage.setItem('deepblue-session', JSON.stringify(s)), host);
    const page = await context.newPage();
    page.on('pageerror', e => errors.push(e.message));
    page.on('request', request => { if (/terrain-atlas|shoal-variants/.test(request.url())) errors.push('Retired cell texture was requested'); });
    await page.goto(base);
    await page.waitForSelector('#own-grid');
    await screenshot(page, `${mapId}-boards.png`, '.boards');
    await checkGeography(page, mapId);
    if (mapId === 'archipelago' || mapId === 'undertow' || mapId === 'blue-frontier') {
      await page.setViewportSize({ width: 390, height: 844 });
      await screenshot(page, `${mapId}-mobile.png`);
      await checkGeography(page, mapId);
      await page.setViewportSize({ width: 768, height: 1024 });
      await checkGeography(page, mapId);
      await page.setViewportSize({ width: 1440, height: 1120 });
    }
    if (mapId === 'undertow') {
      await page.locator('[data-action="terrain-guide"]').first().click();
      assert.equal(await page.locator('.terrain-guide-art .sea-paint').count(), 4);
      await screenshot(page, 'terrain-guide.png', '#modal');
    }
    await context.close();
  }
  const context = await browser.newContext({ viewport: { width: 1440, height: 1120 } });
  await context.route(/fonts\.(googleapis|gstatic)\.com/, r => r.abort());
  const page = await context.newPage();
  await page.goto(base);
  await screenshot(page, 'map-library.png', '.map-selection');
  await context.close();

  // Exercise the released Archipelago art through the normal practice workflow.
  const practice = await browser.newContext({viewport: {width: 1440, height: 900}});
  await practice.route(/fonts\.(googleapis|gstatic)\.com/, route => route.abort());
  await practice.addInitScript(() => {
    window.coastalClock = 1000;
    Date.now = () => window.coastalClock;
    Math.random = () => .9999999;
  });
  const drill = await practice.newPage();
  drill.on('pageerror', error => errors.push(error.message));
  await drill.goto(`${base}/?card-preview=1&map=archipelago`);
  await drill.waitForSelector('.map-selection');
  assert.equal(await drill.locator('.hand-panel, .dock').count(), 0);
  await drill.locator('.map-card[data-map="archipelago"]').click();
  await drill.locator('[data-action="practice"]').first().click();
  await drill.waitForSelector('.dock');
  await checkGeography(drill, 'archipelago', true);
  await drill.locator('[data-action="auto"]').click();
  await drill.evaluate(() => window.coastalClock = 2100);
  await drill.locator('[data-action="confirm"]').click();
  await drill.waitForSelector('.coastal-hand');
  assert.equal(await drill.locator('.hand-cards .card-illustrated').count(), 6);
  await drill.locator('.card-library-button').click();
  assert.equal(await drill.locator('.illustrated-guide .card-illustrated').count(), 20);
  await drill.keyboard.press('Escape');

  for (const width of [1440, 768, 390, 320]) {
    await drill.setViewportSize({width, height: width > 680 ? 900 : 844});
    await checkGeography(drill, 'archipelago', true);
    const hand = await drill.locator('.coastal-hand').boundingBox();
    const friendly = await drill.locator('#own-grid').boundingBox();
    const enemy = await drill.locator('#enemy-grid').boundingBox();
    const command = await drill.locator('.command-card').boundingBox();
    if (width > 680) {
      assert.ok(Math.abs(friendly.y - enemy.y) < 1);
      assert.ok(Math.abs(friendly.x + friendly.width - enemy.x) < 2);
      assert.ok(hand.y >= enemy.y + enemy.height - 1);
    } else {
      assert.ok(hand.y + hand.height <= enemy.y && enemy.y + enemy.height <= command.y && command.y + command.height <= friendly.y);
    }
    if (width !== 320) await screenshot(drill, `archipelago-practice-${width}.png`);
  }

  await drill.locator('.hand-cards [data-card-type="main"]').click();
  await drill.locator('#enemy-grid [data-cell="23"]').click();
  await drill.locator('[data-action="fire"]').click();
  await drill.waitForSelector('.hostile-chart .strike-flash');
  await drill.waitForSelector('.hostile-chart .strike-splash');
  assert.equal(await drill.locator('.friendly-chart .strike-burst').count(), 0);
  await drill.waitForSelector('.strike-burst', {state: 'detached'});
  await drill.emulateMedia({reducedMotion: 'reduce'});
  await drill.locator('.hand-cards [data-card-type="secondary"]').click();
  await drill.locator('#enemy-grid [data-cell="99"]').click();
  await drill.locator('[data-action="fire"]').click();
  await drill.waitForSelector('#enemy-grid [data-cell="99"].miss');
  assert.equal(await drill.locator('.strike-burst').count(), 0);
  assert.equal(await drill.locator('.action-points').getAttribute('data-ap'), '0');
  assert.ok(await drill.locator('[data-action="pass"]').isEnabled());
  await practice.close();
  assert.deepEqual(errors, []);
  console.log(`PASS: LAN and practice chart geometry, responsive coastal hand, card guide, strike feedback and reduced motion. Screenshots: ${output}`);
} finally {
  if (browser) await browser.close();
  await new Promise(resolve => server.close(resolve));
}
