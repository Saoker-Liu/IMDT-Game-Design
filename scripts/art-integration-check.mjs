import assert from 'node:assert/strict';
import { once } from 'node:events';
import { mkdir, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { chromium } from 'playwright-core';
import { createGameServer } from '../server.mjs';

const output = path.resolve(process.env.ART_CHECK_OUTPUT || 'test-results/integration');
await mkdir(output, { recursive: true });
const server = createGameServer();
server.listen(0, '127.0.0.1');
await once(server, 'listening');
const base = `http://127.0.0.1:${server.address().port}`;
const browser = await chromium.launch({ channel: 'msedge' });
const measurements = [];
const errors = [];
try {
  for (const map of ['archipelago', 'blue-frontier', 'open-sea', 'undertow']) {
    const context = await browser.newContext();
    await context.route(/fonts\.(googleapis|gstatic)\.com/, route => route.abort());
    await context.addInitScript(() => {
      window.artClock = 1000;
      Date.now = () => window.artClock;
      Math.random = () => .9999999;
    });
    const page = await context.newPage();
    page.on('pageerror', error => errors.push(error.message));
    page.on('response', response => {
      if (response.url().startsWith(base) && response.status() >= 400) errors.push(`${response.status()} ${response.url()}`);
    });
    await page.goto(base);
    await page.locator(`.map-card[data-map="${map}"]`).click();
    await page.locator('[data-action="practice"]').first().click();
    await page.locator('[data-action="auto"]').click();
    await page.evaluate(() => { window.artClock = 2100; });
    await page.locator('[data-action="confirm"]').click();
    await page.waitForSelector('.coastal-hand');
    for (const [width, height] of [[1366, 700], [1440, 782], [1920, 1080], [390, 844]]) {
      await page.setViewportSize({ width, height });
      await page.evaluate(async () => {
        await document.fonts.ready;
        await Promise.all([...document.images].map(image => image.decode()));
        window.scrollTo(0, 0);
      });
      const result = await page.evaluate(() => {
        const rect = selector => document.querySelector(selector).getBoundingClientRect();
        const strip = rect('.hand-cards');
        const cards = [...document.querySelectorAll('.hand-cards .tactical-card')];
        const faces = cards.map(card => card.querySelector('.card-face').getBoundingClientRect());
        const bounds = cards.map(card => card.getBoundingClientRect());
        return {
          overflow: document.documentElement.scrollWidth > innerWidth + 1,
          gridWidth: rect('#own-grid').width,
          gridTop: Math.min(rect('#own-grid').top, rect('#enemy-grid').top),
          handBottom: Math.max(...bounds.map(r => r.bottom)),
          allSixVisible: bounds.every(r => r.left >= strip.left - 1 && r.right <= strip.right + 1 && r.bottom <= innerHeight),
          faceRatios: faces.map(r => r.width / r.height),
          clippedCards: cards.filter((card, i) => faces[i].bottom > card.getBoundingClientRect().bottom + 1).length,
          stripWidth: strip.width,
          cardWidths: bounds.map(r => r.width),
          commandsOnScreen: rect('[data-action="fire"]').bottom <= innerHeight,
        };
      });
      measurements.push({ map, width, height, ...result });
      assert.equal(result.overflow, false, 'Page should not overflow horizontally');
      for (const ratio of result.faceRatios) assert.ok(Math.abs(ratio - 2 / 3) < .002, 'Keep teammate card proportions');
      await page.screenshot({ path: path.join(output, `${map}-${width}.png`) });
      if (process.env.ART_REQUIRE_FIT && width > 680) {
        assert.ok(result.allSixVisible, `Opening hand fits ${map} ${width}×${height}`);
        assert.equal(result.clippedCards, 0);
        assert.ok(result.commandsOnScreen);
      }
    }
    await page.setViewportSize({ width: 1440, height: 782 });
    await page.locator('.hand-cards [data-card-type="main"]').click();
    assert.equal(await page.locator('.hand-cards [data-card-type="main"]').getAttribute('aria-pressed'), 'true');
    await page.locator('#enemy-grid .cell:not(.terrain-rock)').first().click();
    await page.locator('[data-action="fire"]').click();
    await page.waitForFunction(() => document.querySelector('.action-points')?.dataset.ap === '1');
    await context.close();
  }
  assert.deepEqual(errors, []);
} finally {
  await writeFile(path.join(output, 'measurements.json'), JSON.stringify(measurements, null, 2));
  console.log(`Checked ${measurements.length} map/viewport combinations. Measurements saved to ${output}`);
  await browser.close();
  await new Promise(resolve => server.close(resolve));
}
