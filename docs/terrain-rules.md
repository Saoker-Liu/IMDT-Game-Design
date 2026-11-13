# 地形海域 · 规则与美术沿革

当前 v4.0.0 使用 [卡牌与行动力规则](card-system.md)，所有侦察、机动与攻击均须出牌。暗礁始终与深海外观一致，仅触礁后仅悬停信息改变，见 [暗礁情报规则](hidden-reefs.md)。礁石与浅滩沿用完整海图；v3.2 的原图与生成记录见 [完整海图美术修订](unified-map-art.md)。下文保留早期素材研究和原始提示词。

v3.1 将浅滩改为与深海统一的连续海域绘图，同步更新地图预览与图鉴；问题分析、对比图、原图和提示词见 [浅滩美术修订](coast-art-fix.md)。

## 地形与地图

在现有俯视微缩舰船美术基础上，引入深海、礁石、暗礁、浅滩四类地形，以及三个主题海域，并保留全深海的「无垠深海」地图。大厅可选地图直接演习；创建双人房间时也可选择地图，房间列表与等待界面显示地图名称。

| 地图 | 地形布局 | 战术 |
| --- | --- | --- |
| 无垠深海 | 默认深海覆盖整个海域 | 自由航行；需要提防有限的鱼雷 |
| 星罗棋布 | 16 个礁石格，组成多组散布礁群 | 礁石限制部署和航道；其他格为深海 |
| 暗流涌动 | 中部斜向连续暗礁带 | 可以部署；驶入新暗礁格时有沉没风险 |
| 走向深海 | 各方后方三列为浅滩，迎敌侧七列为深海 | 进入浅滩会失去机动，驶向深海会受到鱼雷威胁 |

双方实际地形以旋转 180° 的方式镜像，格数与可用空间相同。礁石与浅滩公开；未发现暗礁在玩家视图中记为深海，未经侦察与命中的敌舰位置不公开。走向深海的地图说明标出当前阵营的迎敌方向。

## 规则的具体定义

| 地形 | 部署 | 航行进入 | 鱼雷命中舰船 |
| --- | --- | --- | --- |
| 深海 | 允许 | 允许 | 整舰立即沉没 |
| 礁石 | 禁止 | 禁止 | 不能选择为攻击目标 |
| 暗礁 | 允许 | 每次机动判定一次，25% 概率整舰触礁沉没 | 只损伤命中的部位 |
| 浅滩 | 允许 | 永久搁浅，不能再移动 | 只损伤命中的部位 |

未标注的格子显示为深海，其中可能有尚未发现的暗礁。暗礁与浅滩效果只在舰船进入**新占据的格子**时触发，初始部署不会触发；一艘长舰一次移入多个暗礁格仍只进行一次 25% 判定。若同一次移动同时进入暗礁与浅滩，先判定触礁，幸存则搁浅。

为了让新增效果能实际游玩，接入了以下最小航行与武器规则：

- 每回合 10 秒，抓 2 张手牌并恢复 3 点行动力，依靠对应卡牌侦察、攻击或整舰平移一格。行动力用尽、主动结束或超时后换手。
- 交战中舰船不能旋转、重叠、越界或经过礁石；沉船残骸仍占据原格。
- 已有部位中弹的舰船不能航行，避免既有命中标记与移动舰体产生歧义。
- 炮弹与鱼雷都需要对应指令卡；每方每局有 3 枚鱼雷，落空也消耗鱼雷。鱼雷对深海的特殊效果取决于**命中格**的地形；跨越浅滩与深海的舰船，只有深海中的部位被鱼雷命中才会整舰沉没。
- 击沉原因可以是全部部位中弹、深海鱼雷或触礁。全部舰船沉没即失败，包括自己移动导致最后一艘触礁的情况。
- 再战保留所选地图，重置舰船、搁浅状态、伤害与鱼雷数量。

先选择机动指令卡，再用鼠标或触控点选己方舰船，最后点航行方向；选中后也可使用方向键或 WASD。不能航行的方向禁用。搁浅舰船显示船锚徽记。攻击须先选择炮击 / 鱼雷卡；面板显示当前卡牌、费用和鱼雷余量。

## 移动后的情报与保密

伤害记录在舰船上，落空记录保留为历史侦察，二者独立。舰船驶入曾经落空的格子，不会自动受损，也不会变成可见目标。

敌方完成机动后，所有旧落空格均可再次侦察；不会只开放实际经过的格子。已命中格与残骸不能重复攻击。对外的正常机动和搁浅日志不包含舰船编号、舰型、位置或位移；只有已沉没舰船的残骸轮廓公开。AI 仅使用经过过滤的视图和自身已知地形选择攻击、武器或移动。

所有地形、伤害、概率、弹药、回合和胜负在局域网服务端判定；练习模式共用同一引擎。随机补齐采用回溯搜索，并在手动布阵时保证剩余舰船仍有合法排布，避免倒计时结束时无处补齐。

## v3.0 美术检索与素材存档

2026-11-11 先检索素材站，参考了以下公开作品的地块组织方式、水深差异、海底石纹与沙洲材质：

- [CraftPix — Seabed Pixel Art Top-Down Tileset](https://craftpix.net/product/seabed-pixel-art-top-down-tileset/)，及[作者发布的展示](https://www.newgrounds.com/art/view/craftpix/seabed-pixel-art-top-down-tileset)。
- [OpenGameArt — LPC Terrains](https://opengameart.org/content/lpc-terrains)。
- [itch.io — Top-Down Underwater Coral Reef 2D Mega Pack](https://nacl1234.itch.io/top-down-underwater-coral-reef-2d-mega-pack)。

本次未下载、切取或复用这些图包中的图片。使用内置 imagegen 工具独立生成与现有舰船相配的细节插画图集；外观不采用像素画。礁石露出水面并带有浪花，暗礁为半透明水面下的岩纹，浅滩为带焦散与海草的暖色沙洲，深海保持深蓝石油色调。

| 路径 | 内容 |
| --- | --- |
| `art-source/terrain-atlas-original.png` | 原始 4 × 4 高分辨率图集 |
| 原 `public/assets/terrain-atlas.webp` | 早期网页图集，已由 v3.2 完整海图取代并移出网页素材 |
| `scripts/prepare-terrain.py` | 按四行四列机械裁切、等比缩放、拼接并导出 |
| `public/terrain.mjs` | 地形定义、地图布局与可调整的概率 / 弹药常量 |
| `public/tactics-ui.mjs` | 地图卡片、地形图鉴、图例与航行面板 |
| `public/terrain.css` | 地图、单元格与操作面板样式 |

早期图集依次按行排列深海、礁石、暗礁、浅滩，每行四种变体。当时除开阔深海外，其他地形采用逐格贴图。v3.1 与 v3.2 依次将浅滩、礁石与暗礁替换为完整海域。原始图集及旧导出脚本作为美术过程存档保留；当前地图使用 `scripts/prepare-charts.py` 和 `scripts/prepare-coast.py` 导出的完整海图，运行游戏无需 Python。

## 验证

- `npm test`：45 项规则和真实双客户端 HTTP 测试，包括地形布局、非法布阵、计时补齐、移动碰撞、触礁边界、永久搁浅、跨地形鱼雷、弹药、旧落空格复查与保密。
- `npm run check:art`：原有拖拽、旋转、炮击效果与多尺寸布局回归。
- `npm run check:terrain`：真实创建房间和选图、礁石部署拒绝、界面航行、鱼雷 / 炮弹、确定性触礁、搁浅锚标、四类整图图鉴、桌面与 390px 手机布局。
- `npm run check:charts`：完整海图加载、双方朝向、每个格子中的五点轮廓覆盖检查，以及桌面、平板和手机布局。

浏览器检查使用隔离的无头 Edge，不读取个人资料。截图默认保存在 `test-results/terrain/`，可由 `ART_CHECK_OUTPUT` 指定。

## 最终生成提示词

内置 imagegen，单次新图生成，不透明背景；没有使用第三方图片作为编辑目标。导出脚本仅裁切、缩放与编码，不进行绘画修改。

```text
Use case: stylized-concept. Production 2D terrain TILESET ATLAS for FOGBOUND, a premium hand-painted overhead naval tactics game. Make a perfectly SQUARE 4 by 4 grid atlas of EXACTLY 16 square seamless-looking terrain tiles, arranged with NO gutters, NO margins, NO frames, NO text. Canvas 1536 by 1536, each tile 384 by 384; exact four columns and four rows. Camera true top down orthographic aerial, no horizon, no perspective. All tiles use the same finely illustrated semi-realistic miniature wargame art style, highly detailed painted water ripples and stone surfaces, warm ivory glints, navy petroleum teal base; upper-left sunlight. Each row is a distinct terrain type, each column an organic variant. ROW ONE: four DEEP OCEAN tiles, dark midnight petroleum navy #102b37 with fine pale-blue wavelets, darker blue-black depth currents, little foam, calm readable background for small warships. ROW TWO: four IMPASSABLE EXPOSED ROCK tiles, each a DIFFERENT striking clustered set of charcoal slate granite rocks visibly sticking out of teal sea, sharp striated sunlit gray-beige stone peaks, small clusters of barnacles, circular white surf froth around rocks, rock occupies central 65 percent of each square, dark sea at every outer edge. Variety: two jagged spires, a long broken rock ridge, three rounded sea boulders, a rugged crescent rock shelf. No vegetation, no islands. ROW THREE: four SUBMERGED HAZARDOUS REEF tiles, dark olive-gray sharp submerged rocks just beneath transparent turquoise blue sea, refracted light and white current streaks, clearly underwater not exposed, rough angular underwater stone shapes fill center, underwater shadows, desaturated teal water along every outside edge. No exposed brown land, no coral pink. ROW FOUR: four SHALLOW SANDBANK tiles, pale warm ochre ivory underwater rippled sandbanks seen through luminous jade turquoise water, delicate sun caustics, blue-green channels running across the tile, rich detailed hand-painted warm sand texture, small dark seagrass patches, NO above-water land, no dry beaches. Variants should relate to one another naturally when tiled. All terrain elements contained within their exact square; no rock crosses the boundary of any tile. Edges of all tiles should have compatible subtle teal ripples to integrate into a grid board. Refined detailed brushwork, convincing materials, readable at 50 pixels per tile, NOT pixel art, NOT flat vector icons, NOT low-poly 3D. No ships, people, compass, UI, grid lines, lettering, labels, numbers, logos or watermark. Fully opaque PNG atlas with only the sixteen terrain images filling all pixels.
```
