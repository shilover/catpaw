# Tiny Fish

划一刀，把鱼切成刚好的比例。

一个用 **Phaser 4 + Vite** 写的休闲切鱼小游戏。屏幕上一次出现一条鱼，划一刀把它切成两半 ——
得分看**较小那半的面积占比**离随机目标百分比有多近。越准分越高；完全命中判定为 Perfect，会弹出
一只章鱼奖励，点中额外加分。连续切准会累积 Combo 倍率，切歪或漏切则清零。

整个游戏**不含任何二进制资源**：所有贴图由 `Graphics` 在启动时现画，所有音效与背景音乐由
Web Audio 在启动时现场合成。仓库里没有一张图、没有一个音频文件。

---

## 玩法

| 模式 | 画布 | 说明 |
|---|---|---|
| **Arc Mode** | 横屏 1280×720 | 单人冲高分 |
| **Co-op** | 竖屏 540×960 | 双人上下分屏，**共享同一条鱼**，谁先切谁定结果，双方同享 |
| **Versus** | 竖屏 540×960 | 双人上下分屏，各切各的；Perfect 给对手泼墨，差一档让对手的鱼抖动 |

双人模式的设定是**一台手机平放在桌上、两人对坐**：上半屏的相机旋转 180°，让对面那位玩家看到的
是正的。两人可以同时划屏。

一局 60 秒，期间难度分 4 档递增（洋流变强、单条鱼的倒计时变短）。

---

## 快速开始

```bash
npm install
npm run dev       # 开发服务器，默认 http://localhost:5173
```

| 命令 | 作用 |
|---|---|
| `npm run dev` | Vite 开发服务器（含 HMR） |
| `npm run build` | 生产构建 → `dist/` |
| `npm run preview` | 本地预览生产构建 |
| `npm test` | 跑单元测试（Node 内置 test runner，无额外依赖） |

构建产物用相对路径（`base: './'`），可以直接丢进任意子目录 / GitHub Pages / itch.io 压缩包。

---

## 代码结构

```
src/
├── main.js               Phaser.Game 配置 + 场景注册
├── data/
│   ├── displayConfig.js  画布尺寸、分屏布局、贴图尺寸等跨文件共享常量
│   └── fishData.js       鱼种表、目标百分比规则、评分公式、Combo、难度分段
├── scenes/               一个场景一个文件
│   └── SplitScreenSceneBase.js   Co-op / Versus 的公共基类
├── objects/
│   ├── GameplayLane.js   单个玩家的完整战场（出鱼/判定/计分/HUD），三种模式共用
│   ├── CuttableFish.js
│   └── BonusOctopus.js
├── audio/
│   ├── synth.js          程序化合成所有音效与音乐（振荡器 + 噪声）
│   └── audio.js          播放层（开关、节流、音乐生命周期）
├── ui/                   createButton / targetBar / backgroundEffects
└── utils/
    ├── polygonCut.js     切割几何（纯函数，零 Phaser 依赖，有单测覆盖）
    ├── pieceTexture.js   切割瞬间把碎片烘焙成独立贴图
    ├── storage.js        localStorage 存档
    └── format.js
tests/                    Node 内置 runner，只覆盖纯逻辑模块
```

**`GameplayLane` 是玩法中枢**——三种模式的差异通过构造参数（回调 + 开关）表达，不是各抄一份。
它完全由帧驱动：场景每帧调 `lane.update(time, delta)`，`shutdown` 时调 `lane.destroy()`。

**`polygonCut.js` 保持零 Phaser 依赖**——鱼身被近似成椭圆多边形，玩家的划线用
Sutherland-Hodgman 裁成两半再算面积。这是唯一能脱离渲染做单测的部分，请保持这个性质。

---

## 开发约定

详见 [CLAUDE.md](CLAUDE.md)，其中记录了 Phaser 4 的若干坑（遮罩只在 Canvas 可用、分屏旋转相机下
的命中测试、场景实例复用等）——这些踩过一遍了，改动前值得先看。

项目现状、已知缺口与待办清单见 [docs/AUDIT.md](docs/AUDIT.md)。

## 授权

Cat Paw Club.
