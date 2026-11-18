/** Inventory active game assets and validate fixed local references without changing artwork. */
import {readdir,readFile,stat,writeFile,mkdir} from 'node:fs/promises';
import path from 'node:path';
import {createHash} from 'node:crypto';
import {once} from 'node:events';
import assert from 'node:assert/strict';
import {chromium} from 'playwright-core';
import {CARD_TYPES} from '../public/cards.mjs';
import {TYPES} from '../public/engine.mjs';
import {createGameServer} from '../server.mjs';

const root=path.resolve('public'),assets=path.join(root,'assets');
async function walk(dir){const out=[];for(const item of await readdir(dir,{withFileTypes:true})){const file=path.join(dir,item.name);if(item.isDirectory())out.push(...await walk(file));else out.push(file);}return out;}
const known={
  'ocean-chart.webp':['基础海水与局部补水','art-source/ocean-original.png'],
  'open-sea-panorama.webp':['无垠深海／暗流涌动连续海图','art-source/open-sea-panorama.png'],
  'archipelago-coastal-shelf.webp':['星罗棋布海图与岩岸手牌背景','art-source/archipelago-coastal-shelf.png'],
  'blue-frontier-shore-and-fish.webp':['走向深海岸线、浅海与鱼群手牌背景','art-source/blue-frontier-shore-and-fish.png'],
  'impact-fire.webp':['持续燃烧与烟柱','art-source/impact-original.png'],
  'torpedo-foam.svg':['原创矢量鱼雷水花','public/assets/torpedo-foam.svg'],
};
const sources=await walk(root),missing=[],references=new Set();
for(const file of sources.filter(f=>/\.(css|mjs|html)$/.test(f))){
  const source=await readFile(file,'utf8');
  const patterns=[/\b(?:src|href)=["'](\.\.?\/[^"'<>]+)["']/g,/url\(\s*["']?(\.\.?\/[^"')\s]+)["']?\s*\)/g,/\b(?:from\s+|import\s*\(\s*)["'](\.\.?\/[^"']+)["']/g];
  for(const pattern of patterns)for(const match of source.matchAll(pattern)){
    if(match[1].includes('${'))continue;
    const target=path.resolve(path.dirname(file),match[1].split(/[?#]/)[0]);
    references.add(target);
    if(target===path.join(root,'art-assets.json'))continue; // This audit writes the referenced index below.
    try{await stat(target);}catch{missing.push(`${path.relative(root,file)} → ${match[1]}`);}
  }
}
for(const name of [...Object.keys(CARD_TYPES).map(type=>`cards/${type}.webp`),...TYPES.map(t=>`fleet-${t.type}.webp`),'cards/frame.webp','cards/title-sc.woff2','cards/OFL.txt']){
  try{await stat(path.join(assets,name));}catch{missing.push(name);}
}
assert.deepEqual(missing,[],'Fixed references and all card/fleet assets exist');
const server=createGameServer();server.listen(0,'127.0.0.1');await once(server,'listening');
let browser;
try{
  const files=await walk(assets);
  browser=await chromium.launch({channel:'msedge'});
  const page=await browser.newPage();
  await page.route(/fonts\.(googleapis|gstatic)\.com/,r=>r.abort());
  await page.goto(`http://127.0.0.1:${server.address().port}/`);
  const imagePaths=files.filter(f=>/\.(webp|png|svg)$/.test(f)).map(f=>path.relative(root,f).replaceAll('\\','/'));
  const sizes=await page.evaluate(async paths=>Object.fromEntries(await Promise.all(paths.map(async src=>{
    const img=new Image();img.src=src;await img.decode();return [src,{width:img.naturalWidth,height:img.naturalHeight}];
  }))),imagePaths);
  const inventory=[];
  for(const file of files){
    const name=path.relative(assets,file).replaceAll('\\','/'),sitePath=`assets/${name}`,data=await readFile(file);
    let role,source,maintenance;
    if(name.startsWith('cards/')){
      role=name.endsWith('.webp')?(name==='cards/frame.webp'?'共用卡框':CARD_TYPES[path.basename(name,'.webp')]?.name||'卡牌素材'):name.endsWith('.woff2')?'本地卡名字体':'字体许可';
      source=name.endsWith('.webp')?`art-source/${name.replace('.webp','.png')}`:`public/assets/${name}`;
      maintenance='卡牌插画、框形与内部排版沿用队友版本；外部位置尺寸由美术整合维护。';
    }else if(name.startsWith('fleet-')){
      const type=path.basename(name,'.webp').slice(6);role=TYPES.find(t=>t.type===type)?.name||'舰船';
      source=type==='carrier'?'art-source/carrier-original.png':'art-source/fleet-atlas.png';maintenance='透明、俯视、保持舰体完整与原比例。';
    }else if(known[name]){
      [role,source]=known[name];maintenance='按海图与特效规范维护，替换后复核原尺寸实机画面。';
    }else{
      role='旧版兼容海图';source=`art-source/${name.replace('.webp','.png')}`;maintenance='保留兼容记录；当前连续海图以全景素材为准。';
    }
    const sourceInSnapshot=await stat(path.resolve(source)).then(()=>true,()=>false);
    inventory.push({path:`public/${sitePath}`,role,bytes:data.length,sha256:createHash('sha256').update(data).digest('hex'),...(sizes[sitePath]?{renderedIntrinsicSize:sizes[sitePath]}:{}),source,sourceInSnapshot,maintenance});
  }
  inventory.sort((a,b)=>a.path.localeCompare(b.path));
  await mkdir('docs',{recursive:true});
  const output=JSON.stringify({basis:'3e42e3c plus accepted complex-scene fixes',scope:'Game assets under public/assets; promotional One Page assets are separate.',sourceNote:'Source paths refer to the full repository; sourceInSnapshot describes this checkout only. Do not delete remote source files absent from a local snapshot.',fixedReferencesChecked:references.size,assets:inventory},null,2)+'\n';
  await writeFile('docs/art-assets.json',output);
  await writeFile('public/art-assets.json',output);
  console.log(`PASS: ${references.size} fixed local references, ${inventory.length} assets, ${imagePaths.length} decoded images; inventory: docs/art-assets.json`);
}finally{if(browser)await browser.close();await new Promise(resolve=>server.close(resolve));}
