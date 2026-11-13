# FOGBOUND One Page Site

网页地址：**https://saoker-liu.github.io/IMDT-Game-Design/one-page/**

2026-11-13，根据原有 [One Page PDF](fogbound-one-page.pdf) 与 [设计文稿](design.md)，新增独立的游戏宣传网页。游戏仍从仓库根路径进入。网页只介绍已经实现的人机演习、局域网对战与卡牌玩法；PDF 中的战役设想没有被写成可玩的功能。

## 画面与内容

把文档式说明改为以画面和操作串联的单页：海雾中的舰队主视觉 → 侦察、机动与炮击演示 → 五舰型档案 → 三张主题海域 → 进入游戏。每段保留短标题和一句引导，不复制规则表、卡牌清单或大段世界观。

统一使用深石油蓝海面、温润木甲板、旧钢铁、暗黄铜与象牙色文字。中文标题采用衬线字体，英文使用古典展示字体；细刻度、海图坐标、罗盘和金属边框延续现有棋盘。所有舰船与海图直接复用游戏内素材，暗礁海域仍呈现与深海相同的海面，浅滩使用完整连续海图。

研究参考：[Anno 117 官方页面](https://www.anno-union.com/games/anno-117-pax-romana/)、[Frostpunk 2 PlayStation 页面](https://www.playstation.com/en-us/games/frostpunk-2/)。参考其主视觉优先、分段叙事、短文案和清晰试玩入口的展示方式。未复制其商标、美术、截图或网页代码。

## 原创主视觉与字体

本次通过 **内置 imagegen 模式**生成原创海雾舰队插画。参考输入均为项目自己的 `ocean-chart.webp`、`fleet-battleship.webp`、`fleet-carrier.webp`。生成后检查整体光照、海面、木甲板和舰艇细节，再作为网页主视觉。

- 原始图：[`art-source/one-page-hero-original.png`](../../art-source/one-page-hero-original.png)，1672 × 941。
- 网页图：[`public/one-page/assets/hero.webp`](../../public/one-page/assets/hero.webp)，同尺寸，250,650 字节；Pillow 转 RGB，WebP quality=89、method=6。保留原图，没有放大或重绘。
- 中文：Google Fonts 的 [Noto Serif SC](https://fonts.google.com/specimen/Noto+Serif+SC)，600 字重，按网页与动态文案字符集请求子集，65,052 字节。
- 英文：[Cormorant Garamond](https://fonts.google.com/specimen/Cormorant+Garamond)，600 字重，拉丁字符子集，12,192 字节。
- 字体均按 SIL Open Font License 使用；官方许可原文存于 `public/one-page/assets/notoserifsc-OFL.txt` 和 `cormorantgaramond-OFL.txt`。下载自 Google Fonts CSS 接口与 `google/fonts` 官方仓库。网页运行时不请求第三方字体、图片、脚本或统计服务。

完整生成提示词：

```text
Use case: stylized-concept. Asset type: original cinematic hero key art for the FOGBOUND naval strategy game's official promotional one-page website. The input images are the game's OWN ART STYLE REFERENCES: its petroleum teal sea surface, overhead weathered battleship miniature, and overhead aircraft carrier miniature. Make a polished premium game key visual in exactly this finely painted realistic miniature-model visual family, with weathered warm teak decks, muted gunmetal/steel hulls and understated aged brass details. Wide landscape 16:9 composition. A beautiful imposing aircraft carrier and one battleship sail through layered silver-blue sea mist on a deep dark petroleum-teal ocean; a tiny distant escort gives scale. Slightly elevated overhead three-quarter aerial camera, with no horizon, no land. Fleet occupies the RIGHT TWO THIRDS; a large beautifully detailed carrier crosses diagonally from lower right toward upper center, its long flight deck readable with tiny parked propeller aircraft, its warm deck subtly lit. The battleship follows further back through the mist. The LEFT THIRD is quieter, darker open sea and subtle fog with generous negative space for website typography, softly blending into the fleet with NO hard split. Restrained cinematic light from the upper left breaks through sea fog, catching ivory edges and old copper/teak; cool blue shadows. Dense painterly ocean ripples consistent with the reference, fine natural wakes, volumetric fog at several depths, and exquisite miniature-material structure. Visually sophisticated, atmospheric, tactile, like a premium naval board-game campaign illustration brought to life. Clear large silhouettes and carefully controlled contrast. No giant explosions, no fire, no orange sky, no modern jets, no neon, no sci-fi, no cartoon, no low-poly, no pixel art, no flat vectors. Do not create a website mockup: produce only the full-bleed artwork. No text, logos, flags, UI, frames, game grid, labels or watermarks. Nontransparent ocean background.
```

## 交互、动效与可访问性

- 首屏仅使用缓慢海雾和轻微指针视差。进入下方内容后暂停首屏海雾；切到后台暂停动画与战术轮播。
- 战术演示可用左侧三个标签或下方卡牌切换。可见时每 6.2 秒推进一段；指针悬停、键盘焦点进入或手动选择时暂停自动切换，保留独立播放按钮。标签支持方向键、Home、End，并同步选中状态与说明。
- 演示中的巡洋舰先被发现，再移动一格横向、一格纵向；主炮半径一格的十字范围在新位置命中其三个部位。明确标注“机制示意”，不冒充实时游戏录像。
- 五舰型按钮切换真实完整舰体、名称和职责，异步加载以最后一次选择为准。三张海域画面可直接进入游戏，并保留所选地图。
- 顶栏“动态”开关记住选择；系统减少动画偏好默认关闭动效与自动轮播。没有 JavaScript 时仍能读取正文和使用锚点、试玩链接。
- 手机使用专门的主视觉裁切、单列地图和可收起导航。首屏加载图片与本地字体，其余图片延后加载；没有引入第三方运行库。

## 文件与验证

`public/one-page/index.html`、`site.css`、`site.mjs` 与 `assets/` 组成独立静态页。现有构建脚本会一并复制到 `dist/`；现有 GitHub Pages `gh-pages` 分支发布整个 `public/`。本地 Node 服务补充目录索引和 WOFF2 内容类型，原游戏路径保持可用。

运行 `npm run check:onepage` 使用隔离的无头 Edge 验证：320、390、768、1024、1440、1920 像素布局；本地字体与图片；战术三阶段和自动播放；键盘操作；五舰型切换与快速选择；三张地图入口和原游戏链接；手机导航、动画开关、系统减少动画偏好与无脚本阅读。截图输出至忽略的 `test-results/one-page/`。`ONE_PAGE_URL` 可指定部署后的完整页面 URL 复用验证。

另运行 `npm test` 检查游戏规则及目录索引 HTTP 响应，`npm run build` 验证静态构建。部署后再检查线上资源、交互与试玩链接。

本次验收：49 项规则与 HTTP 测试通过，静态构建通过，宣传页浏览器验证在本地与 GitHub Pages 均通过。[Pages 部署记录](https://github.com/Saoker-Liu/IMDT-Game-Design/actions/runs/43453176696)。线上原游戏会请求一次 `/api/health` 判断是否存在局域网服务；静态托管返回 404 后进入人机模式，验证脚本只豁免这个已知的服务探测响应。
