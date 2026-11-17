/** Inspect the complete map paintings against real room geography in an isolated browser. */
import assert from 'node:assert/strict';
import { once } from 'node:events';
import { mkdir } from 'node:fs/promises';
import path from 'node:path';
import { chromium } from 'playwright-core';
import { createGameServer } from '../server.mjs';
import { cells } from '../public/geometry.mjs';
import { terrainFor } from '../public/terrain.mjs';

const mapPaintings = {
  archipelago: 'archipelago-coastal-shelf.webp',
  undertow: 'open-sea-panorama.webp',
  'blue-frontier': 'blue-frontier-shore-and-fish.webp',
  'open-sea': 'open-sea-panorama.webp',
};
const output = path.resolve(process.env.ART_CHECK_OUTPUT || 'test-results/charts');
await mkdir(output, { recursive: true });
const server = createGameServer({ rng: () => .9999999 });
server.listen(0, '127.0.0.1');
await once(server, 'listening');
const base = `http://127.0.0.1:${server.address().port}`;
const errors = [];
let browser;
try {
  browser = await chromium.launch({ channel: 'msedge', headless: true });
  async function api(route, body, session) {
    const response = await fetch(`${base}/api/${route}`, {
      method: body ? 'POST' : 'GET',
      headers: { ...(body ? { 'Content-Type': 'application/json' } : {}), ...(session ? { Authorization: `Bearer ${session.token}` } : {}) },
      body: JSON.stringify(body),
    });
    const data = await response.json();
    assert.equal(response.status, 200, data.error);
    return data;
  }
  async function screenshot(page, file, selector) {
    await page.evaluate(async () => {
      await document.fonts.ready;
      const urls = new Set();
      for (const el of document.querySelectorAll('.terrain-layer, .terrain-layer *, .map-mini, .map-mini *, .terrain-guide-art, .coastal-hand'))
        for (const match of getComputedStyle(el).backgroundImage.matchAll(/url\(["']?([^"')]+)["']?\)/g)) urls.add(match[1]);
      await Promise.all([...urls].map(async src => { const img = new Image(); img.src = src; await img.decode(); }));
    });
    await page.mouse.move(1, 1);
    await (selector ? page.locator(selector) : page).screenshot({ path: path.join(output, file), animations: 'disabled', ...(!selector ? { fullPage: true } : {}) });
    assert.ok(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1));
  }
  async function checkGeography(page, mapId, me = 0) {
    const expected = [terrainFor(mapId, 0), terrainFor(mapId, 1)];
    const result = await page.evaluate(({ expected, mapId, asset, me }) => {
      const problems = [];
      for (const [side, selector] of [[me, '.friendly-chart'], [1 - me, '.hostile-chart']]) {
        const board = document.querySelector(selector);
        const scene = board.querySelector('.terrain-layer');
        if (scene.dataset.chart !== mapId) problems.push(`${selector}: wrong chart`);
        if (Number(board.dataset.side) !== side || Number(scene.dataset.facing) !== side) problems.push(`${selector}: wrong shore`);
        const painting = scene.querySelector(`.coastal-art-${side}`);
        if (!painting || !getComputedStyle(painting).backgroundImage.includes(asset) || scene.querySelector('.terrain-tile')) problems.push(`${selector}: expected one half of ${asset}`);
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
    }, { expected, mapId, me, asset: mapPaintings[mapId] });
    assert.deepEqual(result, [], 'Painted zone contours agree with all playable cells, for both shores');
  }
  async function checkSeam(page) {
    const left = await page.locator('.board-panel[data-side="0"] .board-grid').boundingBox();
    const right = await page.locator('.board-panel[data-side="1"] .board-grid').boundingBox();
    assert.ok(Math.abs(left.y - right.y) < 1 && Math.abs(left.height - right.height) < 1, 'Map halves have matching top and bottom edges');
    assert.ok(Math.abs(left.x + left.width - right.x) < 2, 'Map halves meet at their physical seam');
    const seam = await page.locator('.board-panel[data-side="1"] .terrain-layer').evaluate(el => getComputedStyle(el, '::after').borderLeftStyle);
    assert.equal(seam, 'dashed');
  }
  async function roomPage(session, reducedMotion) {
    const context = await browser.newContext({ viewport: { width: 1440, height: 1120 }, reducedMotion });
    await context.route(/fonts\.(googleapis|gstatic)\.com/, r => r.abort());
    await context.addInitScript(s => sessionStorage.setItem('deepblue-session', JSON.stringify(s)), session);
    const page = await context.newPage();
    page.on('pageerror', e => errors.push(e.message));
    page.on('request', request => { if (/terrain-atlas|shoal-variants/.test(request.url())) errors.push('Retired cell texture was requested'); });
    await page.goto(base);
    await page.waitForSelector('#own-grid');
    return page;
  }
  for (const mapId of Object.keys(mapPaintings)) {
    const host = await api('create', { name: '海域指挥官', roomName: '统一海域美术检查', mapId });
    const guest = await api('join', { name: '远洋联合舰队第二十特别分遣编队指挥官', roomId: host.roomId });
    await api('action', { type: 'ready' }, host);
    await api('action', { type: 'ready' }, guest);
    const page = await roomPage(host, 'reduce');
    const guestPage = await roomPage(guest, 'no-preference');
    await screenshot(page, `${mapId}-boards.png`, '.boards');
    await checkGeography(page, mapId);
    await checkSeam(page);
    await checkGeography(guestPage, mapId, 1);
    await checkSeam(guestPage);
    await guestPage.setViewportSize({ width: 681, height: 900 });
    await checkSeam(guestPage);
    await guestPage.setViewportSize({ width: 1440, height: 1120 });
    await page.setViewportSize({ width: 390, height: 844 });
    await screenshot(page, `${mapId}-mobile.png`);
    await checkGeography(page, mapId);
    await page.setViewportSize({ width: 768, height: 1024 });
    await checkGeography(page, mapId);
    await checkSeam(page);
    await page.setViewportSize({ width: 1440, height: 1120 });
    if (mapId === 'undertow') {
      await page.locator('[data-action="terrain-guide"]').first().click();
      assert.equal(await page.locator('.terrain-guide-art .sea-paint').count(), 4);
      await screenshot(page, 'terrain-guide.png', '#modal');
    }
    if (mapId === 'open-sea') {
      for (const player of [host, guest]) {
        await api('action', { type: 'auto' }, player);
        await api('action', { type: 'confirm' }, player);
      }
      await Promise.all([page, guestPage].map(peer => peer.waitForSelector('.coastal-hand')));
      const hostState = await api('state', undefined, host);
      const guestState = await api('state', undefined, guest);
      const empty = guestState.own.terrain.findIndex((_, cell) => !guestState.own.ships.some(ship => cells(ship).includes(cell)));
      const cruiser = guestState.own.ships.find(ship => ship.type === 'cruiser');
      const secondary = hostState.own.hand.find(card => card.type === 'secondary');
      const main = hostState.own.hand.find(card => card.type === 'main');
      await api('action', { type: 'play-card', cardId: secondary.id, cell: empty }, host);
      await guestPage.waitForSelector('.friendly-chart .strike-splash');
      await page.waitForSelector(`#enemy-grid [data-cell="${empty}"].miss`);
      assert.equal(await page.locator('.strike-burst').count(), 0, 'LAN respects reduced motion');
      await api('action', { type: 'play-card', cardId: main.id, cell: cells(cruiser)[0] }, host);
      await guestPage.waitForSelector('.friendly-chart .strike-flash');
      assert.equal(await guestPage.locator('.hostile-chart .strike-burst').count(), 0);
    }
    await Promise.all([page.context().close(), guestPage.context().close()]);
  }
  const context = await browser.newContext({ viewport: { width: 1440, height: 1120 } });
  await context.route(/fonts\.(googleapis|gstatic)\.com/, r => r.abort());
  const page = await context.newPage();
  await page.goto(base);
  await screenshot(page, 'map-library.png', '.map-selection');
  await context.close();

  // Exercise the same paintings and hand layout through the practice workflow.
  const practice = await browser.newContext({viewport: {width: 1440, height: 900}});
  await practice.route(/fonts\.(googleapis|gstatic)\.com/, route => route.abort());
  await practice.addInitScript(() => {
    window.coastalClock = 1000;
    Date.now = () => window.coastalClock;
    Math.random = () => .9999999;
  });
  const drill = await practice.newPage();
  drill.on('pageerror', error => errors.push(error.message));
  async function practiceStrike(card, cell) {
    await drill.locator(`.hand-cards [data-card-type="${card}"]`).click();
    await drill.locator(`#enemy-grid [data-cell="${cell}"]`).click();
    await drill.locator('[data-action="fire"]').click();
  }
  for (const [mapId, asset] of Object.entries(mapPaintings)) {
    await drill.emulateMedia({ reducedMotion: 'no-preference' });
    await drill.setViewportSize({ width: 1440, height: 900 });
    await drill.goto(`${base}/?card-preview=1&map=${mapId}`);
    await drill.waitForSelector('.map-selection');
    assert.equal(await drill.locator('.hand-panel, .dock').count(), 0);
    await drill.locator(`.map-card[data-map="${mapId}"]`).click();
    await drill.locator('[data-action="practice"]').first().click();
    await drill.waitForSelector('.dock');
    await checkGeography(drill, mapId);
    await drill.locator('[data-action="auto"]').click();
    await drill.evaluate(() => window.coastalClock = 2100);
    await drill.locator('[data-action="confirm"]').click();
    await drill.waitForSelector('.coastal-hand');
    assert.equal(await drill.locator('.hand-cards .card-illustrated').count(), 6);
    const widths = mapId === 'archipelago' ? [1440, 768, 390, 320] : [1440, 390];
    for (const width of widths) {
      const height = width > 680 ? (mapId === 'blue-frontier' ? 782 : 900) : 844;
      await drill.setViewportSize({ width, height });
      await checkGeography(drill, mapId);
      const handPanel = drill.locator('.coastal-hand');
      assert.ok((await handPanel.evaluate(el => getComputedStyle(el).backgroundImage)).includes(asset));
      const hand = await handPanel.boundingBox();
      const friendly = await drill.locator('#own-grid').boundingBox();
      const enemy = await drill.locator('#enemy-grid').boundingBox();
      const command = await drill.locator('.command-card').boundingBox();
      if (width > 680) {
        await checkSeam(drill);
        assert.ok(hand.y >= enemy.y + enemy.height - 1);
      } else {
        assert.ok(hand.y + hand.height <= enemy.y && enemy.y + enemy.height <= command.y && command.y + command.height <= friendly.y);
      }
      if (width === 1440 && mapId === 'blue-frontier') {
        assert.ok(await drill.locator('.hand-cards .card-illustrated').evaluateAll(cards => cards.every(card => {
          const bounds = card.getBoundingClientRect();
          return bounds.bottom <= innerHeight && bounds.right <= card.parentElement.getBoundingClientRect().right + 1;
        })), 'All six cards fit in the desktop opening viewport');
      }
      if (width !== 320) await screenshot(drill, `${mapId}-practice-${width}.png`);
    }
    if (mapId === 'archipelago') {
      await drill.locator('.card-library-button').click();
      assert.equal(await drill.locator('.card-guide-grid .card-face').count(), 20);
      await drill.keyboard.press('Escape');
      await practiceStrike('main', 23);
      await drill.waitForSelector('.hostile-chart .strike-flash');
      await drill.waitForSelector('.hostile-chart .strike-splash');
      assert.equal(await drill.locator('.friendly-chart .strike-burst').count(), 0);
      await drill.waitForSelector('.strike-burst', { state: 'detached' });
      await drill.emulateMedia({ reducedMotion: 'reduce' });
      await practiceStrike('secondary', 99);
      await drill.waitForSelector('#enemy-grid [data-cell="99"].miss');
      assert.equal(await drill.locator('.strike-burst').count(), 0);
      assert.equal(await drill.locator('.action-points').getAttribute('data-ap'), '0');
      assert.ok(await drill.locator('[data-action="pass"]').isEnabled());
    } else if (mapId === 'blue-frontier') {
      await practiceStrike('main', 45);
      assert.equal(await drill.locator('.action-points').getAttribute('data-ap'), '1');
    }
  }
  await practice.close();
  assert.deepEqual(errors, []);
  console.log(`PASS: LAN and practice chart geometry, responsive coastal hand, card guide, strike feedback and reduced motion. Screenshots: ${output}`);
} finally {
  if (browser) await browser.close();
  await new Promise(resolve => server.close(resolve));
}
