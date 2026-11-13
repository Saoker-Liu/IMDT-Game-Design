/** Compose actual before/after browser captures into reviewable HTML reports. */
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { chromium } from 'playwright-core';

if (!process.argv[2]) throw new Error('Usage: node scripts/chart-report.mjs <capture folder containing before/ and after/>');
const input = path.resolve(process.argv[2]);
const output = path.resolve(import.meta.dirname, '../docs/images');
await mkdir(output, { recursive: true });
const maps = [['archipelago', '星罗棋布', '完整礁群与连贯海面'], ['undertow', '暗流涌动', '连续水下岩脊与区域轮廓'], ['blue-frontier', '走向深海', '浅海自然过渡至深海']];
async function picture(stage, id) {
  const bytes = await readFile(path.join(input, stage, `${id}-boards.png`));
  return `<div class="shot"><img src="data:image/png;base64,${bytes.toString('base64')}"/></div>`;
}
const style = `<style>*{box-sizing:border-box}body{margin:0;padding:30px;background:#0c1720;color:#e3dcc5;font-family:'Microsoft YaHei',sans-serif}h1{font-size:25px;letter-spacing:3px;margin:0 0 9px}p{color:#9bb3b0;font-size:13px;margin:0 0 24px}main{display:grid;gap:18px}section{min-width:0;padding:13px;border:1px solid #40585a;border-radius:5px;background:#15262c}h2{font-size:17px;letter-spacing:2px;margin:1px 0 6px}small{display:block;font-size:11px;color:#94afa8;margin-bottom:12px}.shot{position:relative;width:100%;aspect-ratio:550/637;overflow:hidden}.shot img{position:absolute;top:0;left:0;display:block;height:100%;width:auto;max-width:none}.pair{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:20px}.pair b{display:block;margin:0 0 8px;font-size:12px;font-weight:400;color:#b8c2ac}</style>`;
const overview = `${style}<h1>雾海对弈 · 连续海域</h1><p>统一海面、光照与地貌尺度；格线定位，轮廓标明地形范围。</p><main style="grid-template-columns:repeat(3,minmax(0,1fr))">${(await Promise.all(maps.map(async ([id, name, note]) => `<section><h2>${name}</h2><small>${note}</small>${await picture('after', id)}</section>`))).join('')}</main>`;
const comparison = `${style}<h1>从地块拼贴到完整海图</h1><p>同一实机视角 · 礁石与暗礁地图修改前后</p><main>${(await Promise.all(maps.slice(0, 2).map(async ([id, name]) => `<section><h2>${name}</h2><div class="pair"><div><b>修改前 · 逐格贴图</b>${await picture('before', id)}</div><div><b>修改后 · 连续海域 + 规则轮廓</b>${await picture('after', id)}</div></div></section>`))).join('')}</main>`;
const browser = await chromium.launch({ channel: 'msedge', headless: true });
try {
  const page = await browser.newPage({ viewport: { width: 1280, height: 1000 }, deviceScaleFactor: 1 });
  for (const [name, html] of [['unified-map-overview', overview], ['unified-map-comparison', comparison]]) {
    await writeFile(path.join(input, `${name}.html`), `<!doctype html>${html}`);
    await page.setContent(`<!doctype html>${html}`);
    await page.evaluate(async () => { await document.fonts.ready; await Promise.all([...document.images].map(img => img.decode())); });
    await page.locator('body').screenshot({ path: path.join(output, `${name}.png`) });
  }
} finally { await browser.close(); }
console.log(`Saved map review reports to ${output}`);
