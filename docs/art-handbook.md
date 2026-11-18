# 雾海对弈 · 美术制作与交接规范

更新：2026-11-18。当前视觉基线为已合并的 `3e42e3c`，并包含之后已验收的斜向／单格鱼雷与照明叠烟幕修正。复杂场景修正与本交接包已验收，作为同一美术交接批次提交。

本文件记录当前执行标准；早期生成提示词与素材来源继续保留在[美术设定](art-direction.md)、[卡牌美术](card-art.md)、[连续海图](unified-map-art.md)中。

## 视觉方向

精细绘制的俯视微缩舰队，放在连续深石油蓝海图上。海水、旧钢、暖木甲板、象牙与旧黄铜保持同一光照和材质。大面积海面保持开阔，低对比纹理承托舰位与操作信息。

| 组成 | 执行标准 |
| --- | --- |
| 舰船 | 完整舰体、透明背景、俯视、保持原比例；炮塔与舰桥在 40–60px 小尺寸仍有区分。 |
| 海图 | 自然连续的波纹、岸线与礁群；主岩体落在实际禁航格群，浪花和细碎岩石可略跨线。 |
| 界面 | 深海面板、象牙文字、旧黄铜细边与低调罗盘；操作主色保留薄荷绿。 |
| 卡面 | 卡图、框形、圆角、费用圆座与内部版式沿用队友版本。外部尺寸、位置、间距由整合样板确定。 |
| 情报 | 明确区分历史落点、实时照明、持续烟幕和残骸；动画不能扩展可见格。 |

## 配色与字体

下列是当前样式中的色值，不替代插画中的自然明暗。

| 用途 | 色值／字体 | 实现位置 |
| --- | --- | --- |
| 面板／边框 | `#142b31`／`#a69b72` | `public/interface-art.css` |
| 主文字／辅助文字 | `#e6dfc9`／`#adbbb3` | `public/interface-art.css` |
| 主要操作 | `#91e4c6` | `public/style.css` |
| 火力／侦察／机动墨色 | `#773d2b`／`#2c5269`／`#385c44` | `public/card-face.css` |
| 支援／航空墨色 | `#6f512a`／`#554367` | `public/card-face.css` |
| 正文 | Noto Sans SC，回退 Microsoft YaHei | `public/style.css` |
| 数字、坐标、英文注记 | Space Grotesk，回退 Consolas | `public/style.css` |
| 卡名、费用 | 本地 Noto Serif SC 700 子集 | `public/assets/cards/title-sc.woff2`，同目录保留 `OFL.txt` |

## 尺度与构图

| 部分 | 当前值／约定 |
| --- | --- |
| 卡面 | 严格 `2∶3`，宽度随容器等比缩放。桌面手牌约 104–148px；图鉴可单独放大。状态文字留在卡面外，避免裁切插画。 |
| 桌面首屏 | 棋盘、六张开局手牌、执行按钮同屏；手牌接在海域下方，统计位于左侧。 |
| 手机 | 保留可读尺寸；手牌在区内横向查看，敌方海域、执行区域、己方海域纵向安排。 |
| 四图地理 | 一张海图分左右两半，双方保持同一物理方向。访客己方在右，不能翻转整张画造成光照或岸线颠倒。 |
| 星罗棋布 | 上部 76% 海图，下部岩岸承托手牌；礁群位置微调见 `archipelago-art.mjs`。 |
| 无垠深海／暗流涌动 | 共用上部 74% 深海的全景素材。暗礁位置不增加可见纹理或轮廓。 |
| 走向深海 | 沿用浅岸向深海过渡与下部金色线描鱼群；裁切与左侧过渡见 `archipelago-art.css`。 |

地图与卡牌的实际规则范围以现有规则数据为准。美术参数中的“格”只描述视觉尺度。

## 特效

| 效果 | 当前执行值 | 核对重点 |
| --- | --- | --- |
| 持续火焰 | 图片盒宽 0.86 格、高 1.12 格、底部距格底 0.12 格 | 原素材含透明烟缘；连续命中时主烟柱不要遮住上方邻格。 |
| 鱼雷 | 弹体盒约 0.62×0.21 格 | 有弹头、尾翼和箍带；各方向旋转后中心仍落在航迹格心，单格航迹不能漂移。 |
| 水花 | 横截面约 0.28 格宽 | 随实际路径展开，旧段先淡、新段后淡，单段约 1050ms 消退。 |
| 鱼雷航行 | 每路径格约 160ms，整体限制在 500–1800ms | 三行分别推进、分别结束；遇阻后的航程取自回执。 |
| 照明 | 爆闪约 480ms，中心在 220ms 后开始亮起，每圈延后 220ms，单格淡入 460ms | 照明格与当前可见格取交集；旧照明保留；烟幕覆盖格不能被展开动画误亮。 |
| 烟幕 | 多层灰雾约 1100ms 淡入 | 保留己方舰体和格线辨识，不画成规则圆形光斑。 |
| 减少动画 | 直接呈现正确的持续状态 | 不依靠移动、爆闪或颜色变化才能读出结果。 |

## 文件与维护分工

| 调整内容 | 主要文件 |
| --- | --- |
| 卡图／卡框／卡名内部位置 | `public/assets/cards/`、`public/card-face.css`、`public/cards-ui.mjs`；以队友设计为准。 |
| 手牌外部布局 | `public/archipelago-art.css`、`public/cards.css`。 |
| 连续海图、裁切、中央水色 | `public/archipelago-art.css`、`public/chart-art.mjs`。 |
| 礁群位置／比例 | `public/archipelago-art.mjs`；不要移动规则坐标来迁就画面。 |
| 特效造型／动画 | `public/art.mjs`、`public/naval.css`、`public/visual.css`。水花原生矢量为 `public/assets/torpedo-foam.svg`。 |
| 大厅缩略图／地形图鉴 | `public/tactics-ui.mjs`、`public/terrain.css`；复用实战绘制。 |
| 弹窗／表单／短提示／状态条 | `public/interface-art.css`、`public/app.mjs`。 |
| 结算 | `public/result-ui.mjs`、`public/result-art.css`；样板与正式对局共用。 |

完整素材索引为 [art-assets.json](art-assets.json)：包含 38 项的用途、游戏文件、源文件路径、尺寸和 SHA-256。源文件路径指向完整仓库；本地快照未携带的源文件仍须保留在仓库中。

替换卡牌或舰船时，从原 PNG 等比导出相应 WebP，保留透明通道与完整主体。字体替换时一并维护许可文件。历史兼容海图不作为新素材模板；需要清理时先核对引用。

## 制作与交接流程

1. 核对队友最新更新，明确改动属于插画、卡面内部还是外部布局。
2. 在实机尺寸对照当前样板。仅放大原画无法判断费用、卡名或舰型在小尺寸是否可读。
3. 修改后运行 `node scripts/art-assets-audit.mjs`，更新文档与网页素材清单。
4. 在正常大厅进入真实对局检查，再使用对应样板核对边界、方向、重播和叠加效果。缓存版本由入口及相关模块引用同步更新。
5. 验收后按文件清单提交；合并前核对主分支。原目录未提交的玩法改动、快照缺失的源图与历史文档不纳入覆盖。

| 检查范围 | 检查入口／命令 |
| --- | --- |
| 配色、字体、素材位置 | `public/art-reference.html` |
| 四图、双方方向、禁航轮廓 | `public/map-art-review.html`、`npm run check:charts` |
| 特效、尺寸、重播、复杂叠加 | `public/combat-art-review.html`、`node scripts/tactical-art-check.mjs`、`node scripts/tactical-complex-check.mjs` |
| 手册、图鉴与表单 | `node scripts/interface-art-check.mjs` |
| 六牌首屏与手机布局 | `ART_REQUIRE_FIT=1 node scripts/art-integration-check.mjs`（PowerShell 用 `$env:ART_REQUIRE_FIT='1'` 设置） |
| 二十张牌与真实对局 | `npm run check:naval` |
| 结算与战况查看 | `public/result-art-review.html`、`node scripts/result-art-check.mjs` |
| 规则与静态构建 | `npm test`、`npm run build` |

当次实际检查结果见相应整合记录；无需在每次微调时重复运行全部检查。
