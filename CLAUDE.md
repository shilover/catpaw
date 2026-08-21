# Tiny Fish 项目规范

> 休闲切鱼小手游（划屏切割 + 精度评分），基于 **Phaser 4.2.1 + 纯 JavaScript + Vite 5**。
> 本文件按仓库实际代码核实过（2026-08-21 全量通读 `src/`），不是通用 Phaser 模板文档。
> 项目现状与待办清单见 [docs/AUDIT.md](docs/AUDIT.md)。

---

## 🎯 这是个什么游戏

屏幕上一次出现一条鱼，玩家**划一刀**把它切成两半。评分看"较小那半的面积占比"与随机目标百分比
（10%~50%，5% 步进）有多接近 —— 越接近分越高，完全命中（差值 0）判定为 Perfect，会弹出一只章鱼
奖励，点中额外加分。回合固定 60 秒，期间难度按 `DIFFICULTY_STAGES` 分 4 档递增（洋流变强、单条鱼
的倒计时变短）。

三种模式：

| 模式 | 场景 key | 画布 | 说明 |
|---|---|---|---|
| Arc | `ArcMode` | 横屏 1280×720 | 单人，冲高分 |
| Co-op | `CoopMode` | 竖屏 540×960 | 双人上下分屏，**共享同一条鱼**，谁先切谁定结果，双方同享 |
| Versus | `VersusMode` | 竖屏 540×960 | 双人上下分屏，各切各的鱼；Perfect 给对手泼墨，差一档让对手的鱼抖动 |

双人模式的物理场景是：**一台手机平放在桌上，两人对坐**，所以上半屏的相机旋转 180°，让对面那位玩家
看到的是正的。这条前提决定了分屏的相机 / 输入 / UI 布局写法，改动前务必理解（见下文"分屏"）。

---

## 🔒 红线

- **禁止**在代码中硬编码密钥、Token、API 端点。
- **禁止**直接操作 `Phaser.Game` / 场景实例的私有属性（以 `_` 开头）。
- 改动 `src/utils/storage.js` 的存档 key 或数据结构前先确认影响范围，别静默破坏已有玩家的本地存档。
- 目前项目**没有任何二进制资源**（贴图全部程序化生成）。如果要引入真实美术/音频资源，先跟我确认
  资源方案（目录、格式、加载流程），不要顺手塞几个文件进来。

---

## 🤝 协作偏好

- **不要偷懒，不要故意没做/漏做，不要简化**：这是最重要的一条。需求里的每一部分都要做到，做不完
  或者有困难要明说，不能默默跳过、缩水、用简化版本糊弄过去。动手前先把需求完全理解清楚——
  不确定的地方问清楚或去核实，不要一知半解就开始写。
- **默认用中文回复**，除非我明确要求用英文。
- **每完成一个任务，主动做一句话总结**：改了什么、结果如何，不用等我问。
- **不要凭空猜测/手推结论**：不确定的地方去读代码 / 读 `node_modules/phaser/src/` 的源码核实，不要
  "大概率是这样"就下结论。尤其是 Phaser 4 的 API（相机变换、遮罩、命中测试、滤镜）——**Phaser 4 跟
  Phaser 3 有大量破坏性差异，网上搜到的 Phaser 3 写法经常是错的，必须去本地源码里确认**。
- **涉及"看起来对不对"的改动，必须实际截图验证**（见下文"验证方式"），没截图对照过不能说"修好了"。
- **不要擅自扩大改动范围**：只做明确要求的事；发现要做的事跟现有功能冲突，把冲突点列出来问我。

---

## 🏗️ 目录结构

```
tinyfishphaser/
├── index.html            ← Vite 入口，#app 容器 + 全屏样式
├── vite.config.js        ← base 路径 / 构建配置
├── docs/AUDIT.md         ← 项目调研报告 + 待办清单
├── src/
│   ├── main.js            ← Phaser.Game 配置 + 场景注册数组
│   ├── data/
│   │   ├── displayConfig.js  ← 画布尺寸、分屏布局、贴图尺寸等**所有跨文件共享的常量**
│   │   ├── fishData.js       ← 鱼种表（含价值/稀有度）、目标规则、评分公式、连击、难度分段
│   │   └── achievements.js   ← 成就定义 + 生涯统计合并（纯函数，有单测）
│   ├── scenes/            ← 一个场景一个文件，PascalCase
│   │   ├── SplitScreenSceneBase.js  ← Co-op / Versus 的公共基类（见下文"分屏"）
│   │   ├── DailyChallengeScene.js   ← 继承 ArcModeScene，只换成种子随机源
│   │   └── TutorialScene.js         ← 首次进入的分步引导（跑真实 GameplayLane）
│   ├── objects/           ← 运行时实体：CuttableFish / BonusOctopus / GameplayLane
│   ├── audio/
│   │   ├── synth.js       ← 程序化合成全部音效与音乐（启动时渲染成 AudioBuffer）
│   │   └── audio.js       ← 播放层：开关、重触发节流、音乐生命周期
│   ├── i18n/
│   │   ├── index.js       ← t() 查表 + 语言切换/持久化
│   │   └── en.js / zh.js  ← 文案表
│   ├── ui/                ← createButton / targetBar / backgroundEffects /
│   │                          impact（打击感）/ cutGuide（理想切线教学）
│   └── utils/             ← polygonCut（纯几何）/ pieceTexture（碎片烘焙）/
│                              paper（纸感后处理）/ share（分享降级链）/
│                              random（种子随机）/ storage（存档）/ format（mm:ss）
tests/                     ← Node 内置 test runner，只覆盖零 Phaser 依赖的纯逻辑
.github/workflows/ci.yml   ← 每次 push / PR 跑 npm test + npm run build（不含部署）
```

**没有** `public/` 目录、**没有** TypeScript、**没有** React、**没有**统一的 scene-key 常量文件 ——
场景 key 就是构造函数里传的字符串字面量（`super('ArcMode')`），切换直接写
`this.scene.start('MainMenu')`。保持这个写法，不要新引入一套 key 枚举系统。

---

## 🧩 核心架构

### `GameplayLane` 是整个玩法的中枢

`src/objects/GameplayLane.js` 封装了**一个玩家的完整战场**：出鱼、倒计时、划屏判定、切割几何、
计分、HUD、Versus 干扰效果。它接收一个世界坐标矩形（`{x, y, width, height}`），自己不关心这块
区域最终怎么呈现在屏幕上 —— 单人模式是整屏，分屏模式是半屏 + 一台可能旋转 180° 的相机。

> **新增玩法逻辑优先加在 `GameplayLane` 里，而不是往三个场景各抄一遍。** 三种模式的差异应该通过
> 构造参数（`onCutResolved` / `onMissed` / `onRoundAdvance` / `fishScaleMultiplier` 等回调与开关）
> 表达。

`GameplayLane` **完全由帧驱动**：拥有它的场景必须每帧调 `lane.update(time, delta)`，并在
`shutdown` 时调 `lane.destroy()`。鱼的浮动/洋流、倒计时、碎片回收、Versus 抖动全部走这条路径，
**不要再引入 `time.addEvent` 定时器**（唯一保留的定时器是各模式那个 1 秒一次的回合时钟）。

### 切割几何（`src/utils/polygonCut.js`）

- 鱼身被近似成一个**椭圆多边形**（`buildEllipsePolygon`，28 段），玩家的划线是一条直线，
  用 Sutherland-Hodgman 把凸多边形裁成两半（`cutPolygon`），算面积（`polygonArea`）得出占比。
- 这个模块是**纯函数、零 Phaser 依赖**，请保持这个性质 —— 它是唯一可以脱离渲染做单元测试的部分。
- 注意：鱼贴图上的鳍/尾巴是伸出椭圆之外的，切割只按椭圆算 —— 这是有意的近似，不是 bug。

### 音频也是程序化生成的

跟贴图同一套思路：`audio/synth.js` 在启动时用振荡器 + 确定性噪声把所有音效和一段 8 秒循环
音乐渲染成 `AudioBuffer`，直接塞进 `game.cache.audio`（`WebAudioSound` 就是从这里按 key 取
buffer 的），因此播放走 `this.sound`，自动继承 Phaser 的静音/音量与自动播放解锁。

- **所有播放走 `audio/audio.js` 的 `playSfx` / `startMusic`**，不要直接调 `this.sound.play`——
  播放层负责开关判断、缺失兜底和同音效 60ms 重触发节流。
- 音乐由 Sound Manager 持有而非场景，跨场景不中断；`startMusic()` 幂等，每个场景 create 里调一次即可。
- 无音频环境（`NoAudioSoundManager`）下全部静默降级，**不要假设 `scene.sound.context` 一定存在**。
- 新增音效 = 在 `synth.js` 写一个 `makeXxx(ctx)` + 登记进 `SFX` 与 `factories`。

### 所有玩家可见的文字都走 i18n

**场景里不许出现任何字面量文案**，一律 `t('key')`（`src/i18n/index.js`）。新增文案 = 在
`en.js` 和 `zh.js` **同时**加一行；缺翻译会回退英文再回退 key 本身，不会显示 undefined。
占位符写成 `{name}`，用 `t('score', { score: 12 })` 传参。

- 字体统一走 `displayConfig.js` 的 `FONT_FAMILY`（CJK 字体在前，Arial 兜底）——
  **不要写死 `'Arial, sans-serif'`**，那样中文会变成豆腐块。
- 加了新按钮要**两种语言都截图看一遍**：按钮宽度是写死的，中英文宽度差异容易撑破。
- ⚠️ `GameplayLane.js` 里 `t` 是翻译函数，**不要再用 `t` 当局部变量名**（插值系数、Text 对象
  之类），会静默遮蔽掉它。

### 新手引导与理想切线（`TutorialScene.js` / `ui/cutGuide.js`）

- **理想切线**是这个游戏最核心的教学手段：目标百分比是个抽象数字，玩家很难换算成一条线的位置。
  切完之后画一条**与玩家实际切线平行**的虚线，标出目标真正在哪。几次之后玩家就学会了。
- 几何在 `polygonCut.js` 的 `idealChordDistance()`：把椭圆缩放成单位圆后面积比不变、直线仍是直线，
  而圆上的答案只跟距离有关、与方向无关，再按同一个长度缩放回去。**有单测覆盖 7 个角度 × 5 个
  目标的往返一致性**，改这块必须让那条测试继续过。
- 显示时机走三态设置（`auto` / `on` / `off`，默认 `auto`）：`auto` 只在生涯切鱼数少于
  `GUIDE_AUTO_CUTS` 时显示。完美切割不显示——没什么可教的。
- **引导用真实的 `GameplayLane` 跑**，只是关掉了单条鱼倒计时（`timedFish: false`）和自动出鱼
  （`onRoundAdvance: () => {}`），由脚本按"玩家做到了才推进"控制节奏，不用计时器赶人。
- 首次启动由 `BootScene` 路由到 `Tutorial` 而不是 `MainMenu`；帮助弹窗里可以重玩。

### 弹窗布局（`MainMenuScene.showPopup`）

**按内容自动算高度**，不要再传写死的 `panelHeight`：正文先测量，按钮从底部往上堆，关闭按钮永远
是最后一行。之前手挑高度的版本在加了两个控件后立刻把它们埋到了关闭按钮下面。中英文正文长度差异
明显，靠猜必然出事。

### 打击感（`src/ui/impact.js`）

游戏的核心动词是"切"，所以那一瞬间要有物理反馈：每刀都甩纸屑，**完美切割**额外触发顿帧 + 震屏。

- **顿帧靠暂停 arcade world + 在场景 `update` 里扣真实 delta 实现，不要改 `time.timeScale`** ——
  时间缩放会把"负责恢复"的那个定时器一起缩掉，`timeScale = 0` 时恢复永远不会触发。
- 顿帧期间**必须同时冻结单条鱼的倒计时**（`GameplayLane.update` 里判 `impact.frozen`），
  否则等于白扣玩家的时间。
- 分屏两条 lane **共享同一个物理世界**，所以 `ImpactFx` 挂在场景上、两条 lane 共用一个实例；
  震屏则各用各的相机（lane 的 `camera` 参数）。
- **场景 `shutdown` 必须调 `impact.destroy()`**，否则中途离开会把共享物理世界永久卡在暂停态。
- 纸屑用 tween 不用物理体：纯装饰、寿命固定，这样不需要回收清单，也不会活过场景。

### 种子随机与每日挑战（`src/utils/random.js`）

**凡是决定"这一局长什么样"的随机都必须走 `lane.random`**（鱼种、目标百分比、出生位置、洋流相位、
浮动相位），这样同一个种子能完整复现一局。纯装饰性抖动（碎片速度、气泡、纸屑）不受此约束。

- `DailyChallengeScene` 继承 `ArcModeScene`，只重写 `createLaneRandom()` 返回按当天日期播种的
  生成器 —— 全球玩家当天拿到完全一样的鱼序。
- 日期用**本地时区**（`dailyKey()`），因为"今天"是玩家体感的今天。
- 新增出鱼相关随机时，用 `randomInt/randomFloat/pickRandom(this.random, ...)`，
  **不要用 `Phaser.Math.Between` 或 `GetRandom`**（它们内部走 `Math.random`，会破坏确定性）。

### 纸感（`src/utils/paper.js`）

美术风格是"手工剪纸"：`paperize()` 在启动时对 `generateTexture` 产出的画布做后处理——纤维颗粒、
压边暗角、以及带噪声的毛边侵蚀。切开时 `pieceTexture.js` 会沿**刀口**描一条纸芯色的线
（`PAPER_CORE`），只描刀口那条边、不描鱼自身的毛边轮廓——两者靠"边中点到椭圆中心的归一化半径"
区分。鱼还会带一个偏移阴影和几度随机倾斜（`PAPER_TILT_DEGREES`）。

⚠️ **倾斜角必须保持很小**：切割判定用的是精灵**未旋转**的半径算出来的椭圆，角度一大，画出来的
形状就会跟被判定的形状对不上。

### 鱼种差异化与成就

- **鱼种价值**：`baseScore` 通过 `fishValueMultiplier()` 换算成倍率（以 `FISH_VALUE_REFERENCE = 15`
  为基准），和连击倍率一起乘进得分。**稀有度是这笔交易的另一半**——`spawnWeight` 让值钱的鱼出得更少，
  出怪一律走 `pickWeightedFish()`，不要再用 `GetRandom(CUT_FISH_TYPES)`。
- **鱼名是玩家可见的**，必须走 i18n（`fish_<key>` 键）。
- **成就**（`data/achievements.js`）：`check(round, lifetime)` 必须是**纯函数**，会在每次回合结束
  和成就列表每次重绘时调用。带 `goal` 的必须同时给 `progress`，否则列表里的进度条是空的。
  新增成就 = 加一条定义 + 在 `en.js`/`zh.js` 各加 `ach_<id>` 与 `ach_<id>_desc` 两行。
- 生涯统计与已解锁 id 存在 `tinyfish.lifetime` / `tinyfish.achievements`，`mergeLifetime()`
  **不修改传入对象**（有单测钉住）。

### 分享（`src/utils/share.js`）

三级降级：`navigator.share` 带截图 → `navigator.share` 纯文本 → 剪贴板。每一级都有 try/catch，
用户取消（`AbortError`）不算失败。截图有 1.5 秒兜底超时，避免 `snapshot` 不回调时卡住分享。
调用方只拿到 `'shared' | 'copied' | 'failed'` 三种结果去弹 toast。

### 数据表（`src/data/fishData.js`）

鱼种、目标百分比规则、评分公式（`scoreForDiff`）、难度分段（`DIFFICULTY_STAGES`）、连击、
**节奏参数**（`CUT_SETTLE_MS` / `NEXT_FISH_DELAY_MS`）、**打击感参数**都集中在这里。
**可调数值一律放这个文件，不要散落到场景代码里写死。** 目前是 JS 常量导出而非外部 JSON —— 规模还
不需要配置表体系，别为了"规范"引入一套 JSON + Manager 的加载层。

### 贴图是程序化生成的 + 超采样

`BootScene` 用 `Graphics.generateTexture()` 现画所有贴图（5 条鱼 + 章鱼 + 背景 + 气泡 + 猫爪）。
新增一种鱼 = 在 `fishData.js` 加一行 + 在 `BootScene` 加一个 `drawXxx` 方法并登记进 `drawers` 映射。

⚠️ **鱼的贴图必须以画布几何中心为原点绘制**（`cx = w/2, cy = h/2`）—— 切割数学假设
`fish.x / fish.y` 就是鱼身椭圆的中心，画偏了切割占比就全错。

⚠️ **鱼贴图是按 `FISH_SUPERSAMPLE` 倍超采样光栅化的**（鱼在屏幕上要放大约 4 倍显示，1:1 贴图会糊）。
所有绘制代码用「设计单位」（`FISH_TEXTURE_W/H` = 140×96）书写，`BootScene` 靠 `g.setScale()` 放大
光栅化；**任何用鱼贴图建 Sprite 的地方，缩放都必须走 `fishSpriteScale(size)`**，直接 `setScale(size)`
会大 3 倍。装饰性用途同理要除以 `FISH_SUPERSAMPLE`。

### 切开后的碎片（`src/utils/pieceTexture.js`）

切割瞬间把每一半**烘焙成一张独立的 canvas 贴图**（2D canvas 的 `destination-in` 合成），之后就是
普通 Sprite。不要改回"遮罩一个完整鱼精灵"的做法：Phaser 4 的 `GeometryMask` **只支持 Canvas 渲染器**，
而 WebGL 的替代品 `filters.internal.addMask(gameObject)` 会把遮罩对象渲染进一张跟对象滤镜帧缓冲同尺寸的
DynamicTexture，世界坐标下的遮罩 Graphics 会落到画面外、碎片整个不显示（已实测截图确认）。

每片碎片的贴图是一次性的，**必须跟着精灵一起 `destroyPieceTexture()` 回收**，否则会在 Texture Manager
里越堆越多。

---

## 🎮 场景系统

- 一个场景一个文件，**类名 = 文件名，PascalCase**；场景 key 是构造函数里的字符串（通常去掉 `Scene` 后缀）。
- 新场景要显式 import 并加进 `src/main.js` 的 `scene: [...]` 数组。
- **每个进入游戏的场景都要自己 `this.scale.setGameSize(...)`** —— 单人是横屏、双人是竖屏，画布尺寸
  是全局的，谁进来谁负责设成自己要的尺寸，否则会继承上一个场景的画布。

### 分屏（Co-op / Versus）

`CoopModeScene` / `VersusModeScene` 都继承 `SplitScreenSceneBase`，基类负责画布尺寸、两个 lane 区域、
相机、分隔线、每半屏的角落 HUD（计时 + 暂停）、输入分流、回合时钟、逐帧驱动和 shutdown 回收；
子类只提供 `createLanes()` / `goToResults()`，以及可选的 `buildExtras()` / `afterCreate()`。
**两个模式共有的东西加在基类里，不要再往两个子类各抄一份。**

这是全项目最容易改错的地方：

- 上半屏（region A）用 `cameras.main`，**`setRotation(Math.PI)` 旋转 180°**；下半屏（region B）是
  新加的 `camB`，不旋转。
- **两个 lane 的 UI 元素用完全相同的、未旋转的本地布局来写**。相机的旋转已经把它看到的一切都转过来了，
  再给元素自己加一次 `angle` 就会转两次。
- 输入必须**手动按 `pointer.y` 分流到对应相机**，再用 `cam.getWorldPoint()` 转成世界坐标交给对应的
  lane —— 不能直接用 `pointer.worldX/worldY`。
- Phaser 4 在"存在第二台旋转相机 + 多个 interactive 对象"时，自带的命中测试会漏掉对象。项目里因此
  有手写矩形命中兜底（`SplitScreenSceneBase.hitsAnyPauseButton` / `PauseScene.routePointer`）。
  碰到"按钮点不动"先怀疑这个，不要怀疑按钮本身。**注意兜底和 Phaser 自身的 `pointerup` 可能都会触发，
  一次性动作要自己去重**（见 `PauseScene.claim()`）。
- **Phaser 会复用场景实例**：任何一次性标记（比如 `PauseScene.acted`）必须在 `init()` 里重置，
  否则第二次进这个场景时还是上次的值。
- 双人同屏要两根手指同时生效，靠的是 `main.js` 里的 `input.activePointers`（Phaser 默认只有 1）。

---

## 📝 命名规范

| 类别 | 规范 | 示例 |
|---|---|---|
| 场景 / 实体类 | `PascalCase`，文件名 = 类名 | `ArcModeScene.js`, `GameplayLane.js` |
| 工具 / UI 模块 | `camelCase.js`，导出具名函数或 default class | `polygonCut.js`, `targetBar.js` |
| 函数 / 变量 / 属性 | `camelCase` | `roundTimeRemaining`, `isPerfect` |
| 模块级常量 | `UPPER_SNAKE_CASE` | `ROUND_TIME_LIMIT`, `SPLIT_Y` |
| localStorage key | `tinyfish.` 前缀 | `tinyfish.highScore` |

---

## 🛠️ 可用命令

```bash
npm install       # 安装依赖
npm run dev       # Vite 开发服务器
npm run build     # 生产构建 → dist/
npm run preview   # 本地预览生产构建
npm test          # 单元测试（Node 内置 runner，零额外依赖）
```

CI（`.github/workflows/ci.yml`）在每次 push / PR 上跑 `npm test` + `npm run build`。
**它不做任何部署**，只回答"代码还能不能编、测试还过不过"。

**测试用 Node 自带的 `node --test`，没有装 Vitest / Jest，也没有 lint / type-check** —— 不要假设
这些命令存在，也不要在没有明确要求的情况下擅自引入整套工具链。

测试只覆盖 `tests/` 下**零 Phaser 依赖**的纯逻辑（`polygonCut.js`、`fishData.js`）。需要渲染才能
验证的东西不要硬塞进单测，走下面的截图验证。

### 验证方式

改了任何影响画面的东西，**跑起来截图看**，不要靠读代码想象结果：

```bash
npm run dev          # 起服务（默认 http://localhost:5173）
```

然后用 Playwright 驱动截图（chromium 已装在本机 `~/AppData/Local/ms-playwright`）。
`main.js` 在开发模式下会把 game 实例挂到 `window.__PHASER_GAME__`，可以用它跳场景、注入状态、
读取分数来做自动化验证。**这个调试出口只在 `import.meta.env.DEV` 下存在，不会进生产包。**

---

## 📌 容易踩的坑

- ❌ **在 `update()` 里创建新的 GameObject** —— 内存泄漏。
- ❌ **用 `time.addEvent({delay:16, loop:true})` 代替 `update()`** —— 项目早期到处是这个写法，
  每条鱼/每片碎片一个独立定时器，开销和泄漏风险都很大。逐帧逻辑一律走场景的 `update(time, delta)`。
- ❌ **给 `polygonCut.js` 引入 Phaser 依赖** —— 会破坏它可脱离渲染测试的前提。
- ❌ **假设 Phaser 3 的 API 在 Phaser 4 里还一样** —— 遮罩、滤镜、命中测试、Graphics 曲线 API
  都有破坏性变化（例如 Phaser 4 的 `Graphics` 没有 `quadraticCurveTo`，项目里是手动采样贝塞尔的；
  `GeometryMask` 只在 Canvas 渲染器下可用，WebGL 要走 `filters.internal.addMask`）。**去读
  `node_modules/phaser/src/` 确认**。
- ❌ **给分屏模式的 UI 元素自己加 `angle`** —— 相机已经转过一次了。
- ❌ **忘记在新场景里 `setGameSize`** —— 会继承上一个场景的画布尺寸，横竖屏串味。
- ❌ **直接用 `pointer.worldX/worldY` 处理分屏输入** —— 必须走对应相机的 `getWorldPoint()`。
- ❌ **裸调 `localStorage.setItem`** —— iOS Safari 无痕模式会抛异常，一律走 `utils/storage.js` 的封装。

---

## Git 提交规范

**中文自然语言描述改动内容**（不是 Conventional Commits 的 `feat:` / `fix:` 前缀）。一句话概括改了
什么、为什么改；多个不相关改动用分号在同一条提交信息里分开说明。参考：

```
初始提交：Tiny Fish 切鱼小游戏（Phaser 4 + Vite）
```
