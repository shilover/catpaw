# Tiny Fish 项目调研报告

> 调研日期：2026-08-21 · 调研范围：`src/` 全部 17 个文件 + `index.html` / `package.json` / 构建产物
> 依据：逐文件通读 + Phaser 4.2.1 源码核实（`node_modules/phaser/src/`）+ 实际 `npm run build`

---

## 0. 前置发现

**旧 `CLAUDE.md` 描述的是另一个项目。** 它写的是 "TFPhaser 手机塔防"：TypeScript、`public/assets/configs/` JSON 配置表体系、
Spine 骨骼动画、5 种战斗场景 + BattleRouter、`battle/core/` 确定性战斗内核。本仓库实际是纯 JavaScript、无 `public/`
目录、7 个场景的切鱼小游戏，两者没有任何交集。`README.md` 也只有 "catpaw / Catpawclub From Moechina" 两行残留。

→ 已在本次调研后重写 `CLAUDE.md`。

---

## 1. 项目实际形态

| 项 | 值 |
|---|---|
| 技术栈 | Phaser **4.2.1** + Vite 5 + **纯 JavaScript**（无 TypeScript） |
| 源码规模 | 17 个文件 / 2333 行 |
| 美术资源 | **0 个二进制资源**，全部贴图由 `BootScene` 用 `Graphics.generateTexture()` 程序化生成 |
| 音频 | **完全没有** |
| 构建产物 | 单 chunk 1727 kB（gzip 393 kB），构建通过无报错 |
| 渲染器 | `Phaser.CANVAS`（强制，非 AUTO） |

**核心玩法**：屏幕上一次出现一条鱼，玩家划一刀把它切成两半，按"较小那半的面积占比"与随机目标百分比
（10%~50%，5% 步进）的接近程度评分。完美切割（差值 0）会弹出一只章鱼奖励，点中加 50 分。
回合固定 60 秒，期间难度按 `DIFFICULTY_STAGES` 分 4 档递增（洋流强度 ↑、单条鱼倒计时 ↓）。

**三种模式**：Arc（单人横屏 1280×720）、Co-op（双人竖屏 540×960 上下分屏，共享同一条鱼）、
Versus（同样分屏，各切各的，完美切割给对手泼墨、差一档让对手的鱼抖动）。

---

## 2. 缺失的功能模块

### P0 — 作为可发布手游的硬缺口

| 模块 | 现状与依据 |
|---|---|
| **音频系统** | 全项目 0 处 `this.load.audio` / `this.sound`。`storage.js:40` 的 `setMusicEnabled` 只写 localStorage，`MainMenuScene.js:103` 的 ♪ 按钮是纯装饰的死开关 |
| **真实美术资源** | `BootScene.js` 283 行用 Graphics 画了 5 条鱼 + 章鱼 + 背景 + 气泡 + 猫爪。没有 `public/assets/`、没有 Preloader、没有加载进度条。属原型态 |
| **多点触控** | 已核实 `node_modules/phaser/src/core/Config.js:281`：`input.activePointers` **默认为 1**，`main.js` 未配置也未调 `addPointer()`。→ **双人同屏时两人同时划屏，只有先按下的那根手指有效**，双人模式的核心前提是破的 |
| **移动端 H5 基建** | `index.html` viewport 缺 `maximum-scale=1, user-scalable=no`（触控会误缩放页面）；无 favicon（必 404）、无 `apple-mobile-web-app-capable`、无 og meta、无横竖屏提示、无全屏 API、无 `navigator.vibrate` |

### P1 — 留存骨架整块缺失

- **关卡 / 进度系统**：只有一个写死 60 秒的回合，无关卡推进、无难度选择、无解锁
- **成就 / 每日任务 / 每日挑战**：无
- **货币 / 皮肤 / 道具**：无
- **Combo 连击系统**：切鱼类玩法最核心的爽点，无
- **鱼种差异化**：`fishData.js` 里 5 条鱼的 `baseScore`（10~25）字段**定义了但全项目零引用** —— 实际得分只看
  `scoreForDiff(diff)`，切哪条鱼对分数毫无影响，5 条鱼等概率随机出且完全等价
- **新手引导**：只有主菜单 ℹ 弹窗里一段英文说明
- **排行榜 / 分享**：`pushScoreListEntry` 存了 `date` 字段但列表 UI 只显示分数；无截图分享
- **i18n**：UI 全英文，项目与提交信息全中文，无语言层

### P1 — 工程侧

- **无 `vite.config.js`** → `base` 默认 `/`，部署到 GitHub Pages / 任何子路径会直接白屏
- **无 lint / 测试 / CI**。`polygonCut.js` 是纯几何模块、天然可单测，却零用例
- 无错误上报、无 analytics

---

## 3. 已开工但没做完 / 明确 Bug

1. **Co-op 团队分只算了一半** — `CoopModeScene.js:221` 结算只上报 `laneA.score`。两条 lane 各自独立加分
   （B 走 `resolveWithPercent` 也会加），P2 的全部得分被丢弃。
2. **Co-op 成绩污染单人最高分榜** — `FinalScoreScene.js:39-40` 的 `buildSoloOrCoop` 对 `mode === 'coop'`
   同样调用 `saveHighScore` + `pushScoreListEntry`。
3. **结算界面在双人模式下版式错乱** — `FinalScoreScene` 是全场景唯一没调 `setGameSize` 的
   （Arc/Coop/Versus/MainMenu 都调了）。从 Versus（540×960 竖屏）进来时画布仍是竖屏，却贴 Boot 期生成的
   1280×720 横屏背景纹理，且 `buildVersus` 的左右双列是按横屏设计的。
4. **暂停界面在双人模式下是颠倒的** — `PauseScene` 用全屏居中面板，不感知上下分屏与上半屏 180° 旋转相机，
   对坐在对面的玩家是倒的且没有自己的按钮。
5. **`onEitherMissed` 签名不一致** — 调用处传 `'A'`/`'B'`（`CoopModeScene.js:49,55`），
   定义处 `:174` 是无参函数，内部靠"找还有 currentFish 的 lane"猜对手。
6. **`resolveWithPercent` 的兜底会画出两条完整的鱼** — `GameplayLane.js:298`
   `cutPolygon(...) || [polygon, polygon]`，切线没穿过鱼时两半都退化成整鱼。
7. **音乐开关实现是占位级** — 切换后 `this.scene.restart()` 重建整个菜单，只为刷新一个图标颜色。
8. **难度曲线没调平** — 最后一档 `Riptide!` 第 52 秒才触发而回合总长 60 秒，最难阶段只存在 8 秒；
   `flashStageBanner` 对第一档静默跳过，首次难度提示要等到第 18 秒。
9. **`GameplayLane.destroy()` 写了但全项目零调用** — 三个战斗场景都没注册 `shutdown` 清理
   （只有 `backgroundEffects.js:74` 的气泡做了）。

---

## 4. 优化建议（按优先级）

### 性能与内存

1. **Canvas → WebGL。** `main.js:14` 强制 `Phaser.CANVAS`，注释理由是 "GeometryMask 在 Phaser 4 只有 Canvas 支持"。
   **该理由属实**（`src/display/mask/GeometryMask.js:28` 明确写了 *"GeometryMask is only supported in the Canvas
   Renderer"*），**但它同时给出了官方替代**：`FilterList#addMask`（已在 `src/gameobjects/components/FilterList.js:575`
   核实存在；且 `Components.Filters` 是混入基类 `GameObject.js:49` 的，**所有** GameObject 都能用
   `enableFilters()` + `filters.internal.addMask(graphics)`）。手机上 Canvas 跑一堆 Graphics + 遮罩精灵，帧率代价很大。
2. **把 20+ 个 `time.addEvent({delay:16, loop:true})` 换成 `update()`。** 鱼的浮动（`CuttableFish.js:25`）、洋流
   （`GameplayLane.js:209`）、碎片遮罩跟随（`:380`）、章鱼监视（`BonusOctopus.js:33`）、气泡
   （`backgroundEffects.js:60`）、Versus wobble（`GameplayLane.js:462`）全是独立 16ms 定时器 ——
   每条鱼 2 个、每片碎片 1 个，双人模式同时十几个各自调度。
3. **切割碎片的遮罩 Graphics 会泄漏。** `GameplayLane.js:364` 的 `make.graphics({...}, false)` 不进显示列表，
   只在碎片落到 `floorY` 之下时才 destroy。回合结束/切场景时仍在空中的碎片，其 `maskGfx` 永不回收。
   配合第 3.9 条（`destroy()` 无人调用），Replay 几次就会累积。
4. **包体 1.73 MB（gzip 393 kB）** 是 Phaser 全量。项目只用到 Arcade Physics + Graphics + Text + Camera，
   `node_modules/phaser/src/phaser-arcade-physics.js` 入口可剔除 Matter.js 等（min 产物 1266 kB vs 1376 kB）。

### 手感与玩法

5. **切割判定只取"按下点 → 抬起点"的直线**（`GameplayLane.js` 的 `tryCut`），中间划过的轨迹被完全忽略 ——
   玩家画弧线，游戏按弦切。`handlePointerMove` 的拖尾同样只画这一条直线，没有衰减刀光。
6. **`MIN_SWIPE_DISTANCE = 40` 是绝对像素**，在 540 宽竖屏分屏（鱼还缩到 0.4 倍）里门槛偏高，应按 lane 尺寸归一化。
7. **章鱼收集判定两套并存** — solo 靠 sprite 自身 `setInteractive`，分屏靠 `containsPoint` 手动命中；
   且 solo 场景从不调 `tryCollectOctopusAt`，同一次 `pointerdown` 既收集章鱼又开始划线。
8. **高 DPI 模糊** — 固定 1280×720 + `Scale.FIT`，未设 `resolution`/`zoom`，2x/3x 屏上是拉伸的低分辨率画面。

### 健壮性与工程

9. **localStorage 无保护** — `storage.js` 的 `saveHighScore` / `setMusicEnabled` / `pushScoreListEntry` 的
   `setItem` 都没 try/catch。iOS Safari 无痕模式下 `setItem` 抛异常，会在结算瞬间直接崩游戏
   （只有 `getScoreList` 包了 try）。
10. **生产环境残留调试出口** — `main.js:36` 的 `window.__PHASER_GAME__` 应由 `import.meta.env.DEV` 门控。
11. **分屏两个场景几乎逐字重复** — `CoopModeScene` / `VersusModeScene` 的 `setupCameras` / `buildCorner` /
    `routePointer` / `updateTimeTexts` / `endRound` / `openPause` 高度重合，应抽 `SplitScreenSceneBase`；
    `createButton` 里的命中区偏移 workaround 和两处 `hitsAnyPauseButton` 手写矩形应收敛成统一命中工具。
12. **魔数散落** — `PORTRAIT_W/H` / `SPLIT_Y` / `FISH_SCALE` 在 Coop 与 Versus 各定义一遍；
    `SAND_HEIGHT = 22` 靠注释在 `BootScene` 和 `ArcModeScene` 之间"人工同步"。应并入 `displayConfig.js`
    （目前该文件只有 2 个常量）。

---

## 5. 结论

核心切割玩法（几何切分 + 精度评分 + 难度分段）**已完整可玩**，但外围是原型态：音频 / 美术 / 多点触控三个
P0 硬缺口未做，关卡 / 成就 / 连击等留存系统整块缺失；确定性 Bug 4 个（Co-op 分数只算一半、Co-op 污染单人榜、
结算界面竖屏版式错乱、双人暂停界面颠倒）；性能上优先级最高的是 Canvas→WebGL 与 16ms 定时器收敛进 `update()`。

---

## 6. 处理进度（2026-08-21 本次改动）

按第 4 节的优先级依次落地。**每一项都用 Playwright 驱动真实浏览器截图 / 读取运行时状态验证过**，
验证脚本见 `docs/AUDIT.md` 末尾说明。

### 优化建议（第 4 节）——全部完成

| # | 项 | 结果 |
|---|---|---|
| 1 | Canvas → WebGL | ✅ `Phaser.AUTO`，实测跑在 WebGL。**没有**采用 `filters.internal.addMask`——实测该路径下碎片完全不渲染（遮罩 Graphics 落在对象滤镜帧缓冲之外）。改为切割瞬间把碎片烘焙成独立 canvas 贴图（`src/utils/pieceTexture.js`），两种渲染器共用一条路径 |
| 2 | 16ms 定时器 → `update()` | ✅ 7 处 `addEvent` 全部移除。实测单人游玩时活跃定时器数 **1**（只剩 1 秒一次的回合时钟） |
| 3 | 碎片遮罩泄漏 + `destroy()` 无人调用 | ✅ 碎片进 `lane.pieces` 统一回收，三个战斗场景注册 `shutdown → lane.destroy()`。实测 6 次切割后 `piece-*` 贴图数：游玩中 1、退出后 **0** |
| 4 | 包体 | ✅ 1727 kB / gzip 393 kB（单 chunk）→ **1608 kB / gzip 359 kB**，且拆成 phaser(1565 kB) + 游戏代码(43 kB) 两个 chunk，改代码只需重下 43 kB。同时补了 `vite.config.js` 的 `base: './'`（子路径部署不再白屏） |
| 5 | 切割只取首尾直线 | ✅ 改为采样整条划动轨迹，取**离鱼最近的那一段**做切割；拖尾也改成带粗细/透明度衰减的真实轨迹 |
| 6 | `MIN_SWIPE_DISTANCE` 绝对像素 | ✅ 改为 lane 短边的 9%（`MIN_SWIPE_FRACTION`） |
| 7 | 章鱼命中两套并存 | ✅ 统一走 `containsPoint` 手动命中，删掉 sprite 的 `setInteractive`；单人模式同一次 pointerdown 不再既收章鱼又起划线 |
| 8 | 高 DPI 模糊 | ✅ 根因不是 DPR 而是鱼贴图只有 140×96 却放大约 4 倍显示。改为 **3 倍超采样**光栅化（420×288）+ `fishSpriteScale()` 缩回，边缘实测变锐利 |
| 9 | localStorage 无保护 | ✅ 所有读写走 try/catch 封装 |
| 10 | 生产残留调试出口 | ✅ `import.meta.env.DEV` 门控，实测 dist 产物中 `__PHASER_GAME__` 出现 0 次 |
| 11 | 分屏两场景逐字重复 | ✅ 抽出 `SplitScreenSceneBase`（相机 / 角落 HUD / 输入分流 / 回合时钟 / 逐帧驱动 / 回收），Coop 从 232 行降到 83 行、Versus 从 210 行降到 58 行 |
| 12 | 魔数散落 | ✅ 全部并入 `displayConfig.js`（画布、分屏、HUD、贴图、沙地高度），`formatClock` 抽到 `utils/format.js` |

### 顺带修掉的确定性 Bug（第 3 节）

- ✅ **Co-op 团队分丢掉 P2 贡献** —— 两条 lane 切的是同一条鱼，切割得分本就相同，唯一各自独立的是
  章鱼奖励。新增 `lane.bonusScore` 拆分统计，团队分 = `laneA.score + laneB.bonusScore`（不重复计分、
  不丢贡献），章鱼计数两边相加。
- ✅ **Co-op 污染单人最高分榜** —— 新增独立的 `tinyfish.coopHighScore`；主菜单同时显示 High Score 与
  Team Best；历史分数列表带上模式与日期。
- ✅ **结算界面在双人模式下版式错乱** —— `FinalScoreScene` 补 `setGameSize`，截图确认 Versus 结束后
  正常回到 1280×720 双列版式。
- ✅ **双人暂停界面颠倒** —— `PauseScene` 现在感知分屏，复刻父场景的相机布局，两半各一块正向面板
  （截图确认）。
- ✅ **`onEitherMissed` 签名不一致** —— 改为按 who 明确取对手 lane。
- ✅ **`resolveWithPercent` 兜底画出两条整鱼** —— 线性猜测换成二分求解水平弦位置（椭圆弓形面积无
  闭式反函数）。实测 Co-op 两条 lane 现在得分完全一致（78 / 78），此前会算错。
- ✅ **碎片分离方向** —— 原来按 centroid.x 判方向，水平切时两半会朝同一方向飞、完全挡住切口。改为
  沿切线法向推开，实测分离距离从 ~8px 提升到 ~110px。
- ✅ **音乐开关 `scene.restart()`** —— 改为只重建那一个按钮。

### 超出「优化建议」范围但一并处理的（已明确标注）

- **多点触控**：`main.js` 加 `input.activePointers: 3`。Phaser 默认只有 1 个触摸指针，双人同屏时
  第二根手指完全收不到事件——双人模式的核心前提是破的，属 1 行修复。实测 `input.pointers.length = 4`。
- **移动端 H5 基建**：`index.html` 补 `user-scalable=no` / `maximum-scale=1` / `touch-action: none`
  （否则快速划动会被识别成缩放手势）、内联 SVG favicon、`theme-color`、PWA meta。

### 仍未做（需要另行决策）

- 音频系统（需要确定资源方案；目前 ♪ 开关仍只写 localStorage）
- 真实美术资源 / Preloader
- 关卡、成就、每日任务、货币皮肤、Combo 连击等留存系统
- 鱼种 `baseScore` 差异化（字段仍未被读取）
- i18n、排行榜分享、新手引导
- lint / 单元测试 / CI（`polygonCut.js` 与弦位置二分是天然的单测目标）
- 难度曲线调平（`Riptide!` 仍是第 52 秒才触发，回合只有 60 秒）

### 验证方式

`window.__PHASER_GAME__`（仅 dev 构建存在）暴露 game 实例，可用 Playwright 跳场景、模拟划动、
读取 lane 分数 / 碎片坐标 / 贴图不透明像素数 / 活跃定时器数。本次用它验证了：渲染器类型、指针数量、
切割占比正确性、碎片分离距离、贴图泄漏、结算画布尺寸、双人暂停朝向、Co-op 双 lane 一致性，
以及生产构建的完整可玩流程。
