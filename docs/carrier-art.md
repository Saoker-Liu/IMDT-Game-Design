# 航母美术与不限时回合 · v5.1.0

## 统一美术方向

航母使用与既有舰队相同的精细俯视微缩模型风格：风化木甲板、低饱和钢灰舰体、旧黄铜与象牙色细节、左上方柔和光照。飞行甲板、舰岛、舰桥、栏杆、艇具和停放的螺旋桨飞机提供航母辨识度。

生成时直接参考项目的 [战列舰](../public/assets/fleet-battleship.webp) 和 [巡洋舰](../public/assets/fleet-cruiser.webp)，保持相同的材质和细节密度。航母与其他舰艇共用水线、命中火焰、沉没暗化、断裂与漂浮残骸效果，完整图像等比适配 3×2 占格并随舰体整体旋转为 2×3。

该要求同时记入根目录 [AGENTS.md](../AGENTS.md)，供后续美术修改沿用。

## 专业素材检索

2026-11-13 检索了 ArtStation 和 itch.io 的航母及俯视舰船素材。结构参考入口包括 [Sander Vonk 的航母模型与正交俯视展示](https://sandercvonk.artstation.com/projects/28VK4K) 和 [itch.io 的 naval / top-down 素材目录](https://itch.io/game-assets/tag-naval/tag-top-down)。外部作品用于航母结构检索，生产图片以本项目已有舰艇为直接风格参照，由内置 imagegen 独立生成。

## 文件与导出

| 文件 | 内容 |
| --- | --- |
| [art-source/carrier-original.png](../art-source/carrier-original.png) | 内置 imagegen 生成的原始透明 PNG，2172×724 |
| [public/assets/fleet-carrier.webp](../public/assets/fleet-carrier.webp) | 游戏透明棋子，1024×352，约 79 KiB |
| [scripts/prepare-carrier.py](../scripts/prepare-carrier.py) | 可重复的透明裁边、留白、等比缩放及 WebP 导出 |
| [public/art.mjs](../public/art.mjs) | 五类舰艇共用的位图与残骸展示逻辑 |

导出保留真实透明通道与原图比例，不进行重新绘制或拉伸。运行 `python scripts/prepare-carrier.py` 可由原图重新导出。网页无需 Python。

## 完整生成提示词

生成方式：内置 `image_gen`，`transparent_background=true`。参考图依次为现有战列舰和巡洋舰，角色均为风格参考。

```text
Use case: stylized-concept. Asset type: production transparent aircraft-carrier ship sprite for the existing FOGBOUND naval tabletop game. The two input images are STYLE REFERENCES ONLY: the existing battleship and cruiser miniatures; preserve their exact visual family, not their ship type. Generate ONE aircraft carrier, full vessel seen directly from above with the same tiny 2.5D dimensional bevels and fine realistic hand-painted miniature-model detailing as the reference ships. Bow points RIGHT, stern LEFT, horizontal centerline, no diagonal tilt. Weathered warm teak flight deck, muted gunmetal and desaturated steel-blue hull and island superstructure, old brass details, warm ivory rim highlights. Match the references' soft upper-left lighting, dense fine structural texture, restrained contrast and understated aged materials. Detailed long flight deck with subtle worn ivory runway guides, small island/bridge offset along the upper edge of the deck, tiny propeller aircraft neatly parked at stern, lifeboats, deck edge rails and narrow hull sponsons. Crisp readable silhouette at small game-board size. Match the historical miniature fleet, not a modern flat icon. The carrier should look like a carefully painted physical miniature viewed overhead, with fine ambient occlusion and realistic material texture; no bold vector outlines. Center the complete ship in a landscape canvas with generous transparent padding; use natural long carrier hull proportions, roughly 3 to 3.5 times as long as wide. This will be fitted, without stretching, inside a 3-by-2-cell rectangular game piece and rotated as a whole in game. Background must be actual transparent alpha. Outside the ship is completely transparent. No water, sea, wake, external cast shadow, background, horizon, grid, UI, lettering, badges, logos, flags, caption or border. Ship sprite only.
```

## 回合机制

交战取消所有倒计时与行动力耗尽自动换手。页面显示当前回合与「不限时决策」，只有玩家点击「确认结束回合」才换手。行动力为零且没有零费牌时仍会等待确认，刷新也不会自动抓牌、恢复行动力或切换玩家。AI 使用同一结束回合指令。布阵仍限 90 秒。

临时视野、烟幕和制空权继续按回合计数；长时间思考不会让这些效果按秒数过期。战斗机可在敌方制空期间起飞并夺取制空权，此规则一并保留。

## 验证

- 规则与真实双客户端测试：长时间等待、零行动力、刷新与确认换手、持续效果按回合过期，保留布阵超时补齐。
- `npm run check:turns`：无交战倒计时、无零费牌时 0 行动力等待、64 秒等待及刷新后状态保留，确认后才切换玩家并抓牌。
- `npm run check:naval`：航母六格拖拽、整体旋转、素材边界、二十种卡牌、残骸与触屏布局。
- `npm run check:air`：战斗机双方夺取与反夺、费用、飞机禁飞状态和新控制者的三回合计时。
