# 雾海对弈 · 美术设定与素材来源

## 视觉方向

微缩舰船模型置于军用海图之上。以深石油蓝海面、暖象牙甲板、旧黄铜刻度和枪灰金属边框为主，兼顾小尺寸识别与结构细节。参考海战棋插画的俯视舰队表现，以及航海图的坐标、罗盘和海域标识。舰型轮廓、炮塔、舰桥、烟囱与艇具均有区别。

| 项目 | 处理 |
| --- | --- |
| 海面 | 原创生成的细密波纹、深浅洋流，叠加低对比 10 × 10 海图网格 |
| 棋盘 | 金属包边、四角铆钉、刻度、罗盘、海域铭文 |
| 舰船 | 四张独立透明 WebP，连续覆盖舰船占据的格子，支持整体旋转 |
| 未知海域 | 连贯的蓝灰海雾；准备阶段增加雷达徽记 |
| 落空 | 浅色椭圆水环、小水花与落点 |
| 命中 | 逐格火焰、灰色烟柱、余烬与暖色照明 |
| 沉没 | 整舰暗化与断裂、散落金属片、油迹和气泡 |

关键色：海水 `#102b37 / #205867`、金属 `#263b45 / #657b83`、旧黄铜 `#bdab7b`、象牙 `#e6dcc0`、木甲板 `#97794e`、火焰 `#d95f2e / #ffad4a`。

美术不改变交战信息：敌方未击沉舰型与轮廓不显示；每个命中格独立显示火焰；仅在整舰全部格子命中后传递其残骸轮廓。规则测试覆盖残骸数据的保密边界。

## 风格检索

2026-11-11 检索了 GameUI.net、Pinterest、Behance 和 ArtStation。GameUI.net 返回 403，因此使用可检索的作者作品作为风格参考：

- [Larysa Kalynovska — 2D art and UI art for battle ship mobile game](https://www.behance.net/gallery/49006277/2D-art-and-UI-art-for-battle-ship-mobile-game)：舰船细节与俯视微缩质感。
- [Battleship Mobile Game](https://www.behance.net/gallery/57860025/Battleship-Mobile-Game)：海面网格与舰队尺度。
- [Viktoria — Unknown Horizons Game UI Redesign](https://devviktoria.artstation.com/projects/OGQL38)：航海主题的界面材质与图标气质。
- [该作者关联的 Pinterest mood board](https://hu.pinterest.com/devviki/unknown-horizons-ui-redesign-fan-proj-mood-board/)：海洋题材视觉检索入口。

没有下载、截取或复用这些作品的图片作为游戏素材。舰船、海面与火焰烟柱由内置 imagegen 工具独立生成，参考作品仅用于确定一般美术方向。金属框、罗盘、水花与残骸碎片由本项目 CSS / SVG 绘制。

## 文件与导出

| 文件 | 内容 |
| --- | --- |
| `art-source/fleet-atlas.png` | 保留透明通道的舰队原始图集 |
| `art-source/ocean-original.png` | 海面原始插画 |
| `art-source/impact-original.png` | 透明的火焰与烟柱原始插画 |
| `public/assets/fleet-battleship.webp` | 战列舰 |
| `public/assets/fleet-cruiser.webp` | 巡洋舰 |
| `public/assets/fleet-destroyer.webp` | 驱逐舰 |
| `public/assets/fleet-frigate.webp` | 护卫舰 |
| `public/assets/ocean-chart.webp` | 棋盘海面 |
| `public/assets/impact-fire.webp` | 细节火焰与烟柱 |
| `public/art.mjs` | 舰船、命中效果、海图装饰的展示层 |
| `public/visual.css` | 美术、材质、图层与响应式样式 |
| `scripts/prepare-art.py` | 可重复的图集裁切与 WebP 导出 |

导出脚本仅做机械裁切、等比缩小与编码，保留透明通道，不做绘画修改。需要重新导出时，在安装 Pillow 的 Python 环境运行 `python scripts/prepare-art.py`。运行游戏无需 Python 或 Pillow。

六张网页素材共 493,130 字节（约 482 KiB），静态构建一并复制。海面预加载，舰船图可在大厅进入时由示意海图预热。火焰烟柱使用同一张透明图，通过轻微缩放与透明度变化表现燃烧。

图集原图按四行分别生成战列舰、巡洋舰、驱逐舰、护卫舰；实际外接框不同，裁切分段记录在脚本中。各图在棋盘中按格宽适配，纵向部署旋转整张舰船图像，避免分段错位。减少动画偏好下保持火焰与烟柱静态可见。

## 生成提示词

工具：内置 imagegen，独立生成三张图。舰队与火焰启用透明背景，海面使用不透明背景。提示词未包含参考作品图片或受保护的游戏名称。

### Fleet atlas

```text
Use case: stylized-concept. Asset type: production sprite atlas for a refined naval tactics board game, not a UI mockup. Create ONE transparent PNG sprite sheet of FOUR different extremely finely painted miniature modern historical steel navy warships in four perfectly separate HORIZONTAL ROWS on a 1536x1024 transparent canvas. True orthographic TOP DOWN plan view, no isometric angle, ship bows point RIGHT, sterns LEFT, consistent 90-degree overhead camera. Exactly ONE ship in each of four equal 256-pixel high row bands, centered on y=128,384,640,896. All hulls aligned to horizontal centerline, centered horizontally on x=768. First row: large battleship, length about 1400px width 220px, ivory steel deck, many turrets with triple cannons pointing along ship, armored central bridge, radar antenna fine detail, teak brown deck inserts, dark slate gunmetal hull. Second row: cruiser, length 1050px width 200px, distinct slender hull, twin large gun turrets, blue-gray bridge, two golden brass exhaust funnels. Third row: destroyer, length 700px width 180px, sharper lean silhouette, one main gun, torpedo tubes, detailed small deck cranes and mast. Fourth row: short stout frigate patrol boat, length 350px width 180px, compact cabin and one little bow gun. Shared colors: warm ivory edge highlights, desaturated steel blue #657b83, gunmetal #263b45, dark copper #8c7252, weathered teak #97794e. Professional hand-painted 2.5D miniature game asset with realistic tiny structure, subtle ambient occlusion and rim lighting. Each ship has convincing layered hull bevels, polished superstructures, railings, hatches, lifeboats, ropes. Strong crisp silhouette and readable big shapes that still read well scaled to 40px tall. No water, no wakes, no ground shadow, no scene, no backgrounds, no words, no labels, no UI, no border, no logos, no flags. ALL outside hull is actual transparent alpha. Large safe empty gaps between rows, ships never touch row boundaries. This is a game art sprite asset sheet, not infographic.
```

### Fire and smoke

```text
Use case: stylized-concept. Production transparent game VFX sprite for a premium illustrated naval strategy board game. Exactly one small cluster of believable hand-painted FIRE with rising SMOKE, isolated on transparent alpha background, not an icon, no emoji shapes, no clean vector contours. Portrait composition on a square canvas, lower fire base centered around x=50%, y=78%, flame tongues reach y=44%, soft gray drifting smoke rises to y=12%. The burning area has many small thin irregular amber and golden flame tongues with pale yellow hot cores, deep burnt orange roots, subtly translucent wisps. A few tiny airborne orange sparks near the base. Smoke has intricately painted semi-transparent billowing blue-gray and charcoal turbulent curls, with soft lit pearl gray edges and darker central body, bending slightly to the upper right. Style should match finely painted miniature steel warships on petroleum teal seawater. Realistic painterly material and detailed texture, visible flame filaments, smoke volume, soft natural edges. Bright at the bottom fading to dark gray blue at the top. Strong legibility at 40 by 60 pixel thumbnail scale. The result is ONLY fire and smoke, without any hull, ship, wood, ground, shadow, water, border, frame, words or symbols. No red circle, no black backdrop, no white background. Real transparent alpha outside the flame and smoke. Avoid a large bloom or haze beyond the little fire cluster; keep whole sprite contained inside generous 10% margins.
```

### Ocean texture

```text
Use case: stylized-concept. Asset type: production ocean background texture for a refined naval tactics board game. Create a square 1536x1536 flat orthographic straight-down aerial ocean surface, entirely water, from the same view as overhead tiny miniature battleships. Rich deep petroleum teal with varied navy blue water currents, refined semi-realistic hand-painted waves, exquisite small scale wavelets and subtle very fine pale teal reflective streaks. Painterly but material, a tasteful premium tabletop wargame illustration. Colors dark #102b37, #164353, #205867, muted cyan #3f7b83, subdued ivory highlights. Light from upper left. Wide gently swirling water currents, smallest fine ripples, sparse tiny foam on top of little waves, no large dramatic crest. Darker edges, a slightly more luminous central diagonal water current, still fairly consistent exposure so cream colored ship miniatures can be legible above it. The image is the actual PLAYABLE BOARD's sea surface UNDER a 10x10 tactical grid, therefore it must be calm enough not to distract but genuinely detailed and textured, not a flat gradient, not neon, not a photograph. No islands, no coastline, no land, no ships, no birds, no markings, no grid, no letters, no text, no frame, no icons, no horizon or perspective. Very high quality painted environment tile.
```
