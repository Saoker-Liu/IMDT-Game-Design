/** Spatial guides for whole-chart illustration; these diagrams are not game textures. */
import { mkdir, readFile } from 'node:fs/promises';
import path from 'node:path';
import { chromium } from 'playwright-core';
import { terrainFor } from '../public/terrain.mjs';

const root = path.resolve(import.meta.dirname, '..');
const output = path.join(root, 'art-source', 'map-layouts');
await mkdir(output, { recursive: true });
const ocean = (await readFile(path.join(root, 'art-source', 'ocean-original.png'))).toString('base64');
const browser = await chromium.launch({ channel: 'msedge', headless: true });
try {
  const page = await browser.newPage({ viewport: { width: 1000, height: 1000 }, deviceScaleFactor: 1 });
  for (const map of ['archipelago', 'undertow']) for (const side of [0, 1]) {
    const terrain = terrainFor(map, side);
    const type = map === 'archipelago' ? 'rock' : 'reef';
    const marks = terrain.flatMap((t, c) => t !== type ? [] : [`<rect x="${c % 10 * 100 + 7}" y="${Math.floor(c / 10) * 100 + 7}" width="86" height="86" rx="30" fill="${type === 'rock' ? '#c9c2a4' : '#5f8e8a'}"/>`]).join('');
    await page.setContent(`<html><body style="margin:0"><svg xmlns="http://www.w3.org/2000/svg" width="1000" height="1000" viewBox="0 0 1000 1000"><image href="data:image/png;base64,${ocean}" width="1000" height="1000"/>${marks}</svg></body></html>`);
    await page.locator('svg').screenshot({ path: path.join(output, `${map}-${side}.png`) });
  }
} finally { await browser.close(); }
console.log(`Saved spatial guides to ${output}`);
