# TFPhaser 项目规范

> 手机塔防游戏，基于 Phaser 4.2.1 + TypeScript + Vite（`template-vite-ts` 官方模板起步，
> 已大幅魔改出自己的架构）。本文件按项目实际代码核实过，不是通用 Phaser 模板文档。

---

## 🔒 安全/风控红线

- **禁止修改 `public/assets/` 中已发布的资源文件**（图片、音频、JSON 配置表等）。新增资源可以，
  替换/删除已有文件必须先告知我。
- **禁止**在代码中硬编码密钥、Token、API 端点。
- **禁止**直接操作 `Phaser.Game`/场景实例的私有属性（以 `_` 开头）。
- 涉及存档数据（`src/game/systems/save/`）、未来的服务端同步逻辑的修改，先确认影响范围再动手，
  别静默改变存档 schema。

---

## 🤝 协作偏好

- **不要偷懒，不要故意没做/漏做，不要简化**：这是最重要的一条。需求里的每一部分都要做到，做不完
  或者有困难要明说，不能默默跳过、缩水、用简化版本糊弄过去。动手前先把需求完全理解清楚——
  不确定的地方问清楚或去核实，不要一知半解就开始写。
- **默认用中文回复**，除非我明确要求用英文。
- **每完成一个任务，主动做一句话总结**：改了什么、结果如何，不用等我问。
- **不要凭空猜测/手推结论**：不确定的地方去读代码/读文档核实，不要"大概率是这样"就直接下结论，
  尤其是 Spine 骨骼动画相关的关键帧数值、坐标变换这类容易出错又不好肉眼查的东西，必须找到明确
  依据（截图对照、日志、实际数据）才能说"确认/修好了"。
- **移植设计稿/规格时要如实实现，不要偷偷简化**：做不到的地方要明确指出来问我，不要自己悄悄换
  一种简化方案交差。Cocos 节点旋转是这类移植里的常见坑，特别注意。
- **不要擅自扩大改动范围**：只做明确要求的事；如果发现要做的事跟现有功能/其他约定冲突，把冲突点
  列出来问我，不要自己拍板取舍。
- **是否要跑 build/lint/test 验证会变，别凭旧印象猜**：这个仓库目前没有 lint/test 工具链（见下文），
  "要不要自测"这类工作流偏好按我当下的要求来，不要假设跟上次一样。

---

## 🏗️ 实际目录结构

```
TFPhaser/
├── public/assets/
│   ├── configs/          ← 所有 JSON 配置表（hero.json/monster.json/level.json/skill.json...）
│   ├── spine/            ← Spine 骨骼动画（esotericsoftware spine-phaser-v4）
│   ├── backgrounds/ map/ UI/ ...
├── src/
│   ├── main.ts            ← DOMContentLoaded 后调用 StartGame('game-container')
│   └── game/
│       ├── main.ts         ← Phaser.Game 配置 + 全部场景注册（数组里 import 各 Scene 类）
│       ├── scenes/         ← 一个场景一个文件，PascalCase 命名，非战斗场景平铺在这一层
│       │   └── battle/     ← 5种关卡类型对应的战斗场景 + BattleRouter 路由
│       ├── battle/
│       │   ├── core/       ← 战斗核心逻辑：必须 Phaser-free、确定性、固定 tick（见下文"战斗架构"）
│       │   └── assault/    ← 突击类玩法的引擎/特效
│       ├── data/            ← 每张配置表一个 `XxxConfig.ts`（类型定义 + XxxConfigManager 单例）
│       ├── entities/        ← Hero.ts / Equipment.ts 等运行时实体类
│       ├── systems/         ← ConfigManager（配置表加载入口）、DropSystem、PlayerManager、
│       │                        WaveRandomization、save/（存档）等跨场景系统
│       └── ui/               ← UiFactory / Theme / Animations / SceneTransition 等通用 UI 工具
├── tools/                  ← 离线工具（数值计算脚本、spine 合图工具、RandomMap 随机地图生成）
├── vite/config.dev.mjs / config.prod.mjs
└── ArknightsLevelData/     ← 明日方舟关卡数据本地镜像，仅供关卡设计参考，不接入构建
```

**没有** `src/constants/scene-keys.ts` 或 `animation-keys.ts` 这类统一常量文件——场景 key 就是
类名字符串（见下文场景规范），战斗场景的类型→key 映射集中在 `BattleRouter.ts` 里的
`BATTLE_SCENE_BY_TYPE`。新增同类映射就近放在对应模块，不要为了"规范"另起一个 constants 目录。

---

## 🧩 核心架构：配置表系统

所有可调数值/内容数据走**JSON配置表 + TS配置类**这一套，不要为单个数值散落写死在场景代码里：

1. 数据落地在 `public/assets/configs/*.json`（如 `hero.json`、`level.json`、`skill.json`）。
2. `src/game/data/XxxConfig.ts` 定义对应的 TS 类型 + `XxxConfigManager`（单例，持有解析后的数据，
   提供按 id 查询等方法）。
3. `src/game/systems/ConfigManager.ts` 集中登记 `CONFIG_PATHS`，由 `Preloader` 场景触发异步
   `fetch` 加载，写入各自的 Manager 单例。
4. 新增一张配置表：`public/assets/configs/` 加 json → `data/` 加对应 `XxxConfig.ts` →
   `ConfigManager.ts` 里登记路径 + 调用加载。

---

## 🎮 场景系统

- 一个场景一个文件，**类名 = 文件名，PascalCase**（`BaseScene.ts`、`HeroListScene.ts`、
  `BattleDrill.ts`），不是 kebab-case。
- 场景在 `src/game/main.ts` 的 `scene: [...]` 数组里显式 import 并注册，新场景要记得加进这个数组。
- 场景切换用**字符串字面量**（跟类名一致）：`this.scene.start('MainMenuScene')`、
  `this.scene.launch('HeroDetailScene', { heroId, tab })`。项目里没有用枚举/常量包装这一层，
  保持现有写法即可，不要新引入一套 scene-key 常量系统。
- 没有 EventBus / `current-scene-ready` 这类"给外部 React UI 层用"的模式——项目**不含 React**，
  纯 Phaser 场景，不要套用官方 `template-react-ts` 的写法。

### 战斗场景（5种关卡类型）

`scenes/battle/` 下 `BattleDrill`/`BattleHold`/`BattleAssault`/`BattleEscape`/`BattleFort` 五个
场景类对应 `LevelConfig` 里的 5 种 `LevelType`，由 `BattleRouter.startBattle()` 按类型路由。
共享逻辑放 `BattleSceneBase.ts`，不要在 5 个子类里各自重复。

---

## ⚔️ 战斗核心逻辑架构（`src/game/battle/core/`）

`FixedTickClock`/`SeededRandom`/`CombatFormula`/`BattleCommand` 这套战斗核心逻辑要求：

- **不依赖 Phaser**：不直接 import `Phaser.*` 类型，不碰 Scene/GameObject，保持能脱离渲染层单独跑。
- **确定性**：随机数走 `SeededRandom`，不用 `Math.random()`。
- **固定 tick**：战斗推进走 `FixedTickClock` 的固定步长，不依赖 `update(delta)` 的可变帧间隔。

这是为了让战斗逻辑可以脱离渲染做批量数值测试/回放（`tools/calc_*.js` 系列数值脚本、以及关卡平衡
测试都依赖这个前提）。`DamageNumberFx.ts`（跳字特效）等纯表现层代码不受此约束，可以依赖 Phaser。

---

## 📦 资源加载规范

- 图片/音频等资源**不要**在 `src/` 里 `import`，Phaser 的加载系统走自己的路径解析，跟 Vite 的
  import 处理会冲突。
- 统一走 `this.load.setPath('assets')` + 相对文件名（`Preloader.ts` 里已设置好 base path），
  新增加载调用直接写相对路径，不用拼 `/assets/xxx` 绝对路径。
- Spine 骨骼动画走 `SpinePlugin`（已在 `game/main.ts` 的 `plugins.scene` 里注册，`mapping: 'spine'`），
  合图/转换工具在 `tools/pack_spine_atlas.js`。

---

## 📝 命名规范

| 类别 | 规范 | 示例 |
|------|------|------|
| 场景/类/配置类型 | `PascalCase`，文件名跟类名一致 | `HeroListScene.ts`, `HeroConfig.ts` |
| 函数/变量/属性 | `camelCase` | `playerSpeed`, `isGameOver` |
| 配置表 JSON 文件 | `camelCase.json` | `hero.json`, `dropGroup.json` |
| 枚举/联合类型值 | 优先字符串字面量联合类型而非数字枚举，便于跟 JSON 配置表互相映射（见 `GameConfig.ts` 开头注释） | `type LevelType = 'DRILL' \| 'HOLD' \| ...` |

---

## 🛠️ 实际可用命令

```bash
npm install          # 安装依赖
npm run dev           # 开发服务器（node log.js dev & vite --config vite/config.dev.mjs）
npm run build          # 生产构建（node log.js build & vite build --config vite/config.prod.mjs），
                        # 构建后自动跑 postbuild: compress-dist（压缩 dist/assets 下的图片）
npm run dev-nolog      # 不发送匿名统计数据的开发服务器
npm run build-nolog    # 不发送匿名统计数据的生产构建
npm run compress-images # 单独跑图片压缩工具（tools/compress_images.js）
```

- `runbuild.bat` / `rundev.bat` 只是 `npm run build` / `npm run dev` 的本地快捷方式。
- **项目目前没有配置 `lint`/`type-check`/`test:unit` 这几个 npm script，也没装 ESLint/Vitest/
  Prettier**——不要假设这些命令存在，也不要在没有明确要求的情况下擅自引入整套 lint/test 工具链。
  如果需要类型检查，直接用 `npx tsc --noEmit`。

---

## Git 提交规范

**实际约定是中文自然语言描述改动内容**（不是 Conventional Commits 的 `feat:`/`fix:` 前缀），
参考近期提交：

```
修复英雄迎敌/归位移动时骨骼形象不播走动动画的问题；归位途中朝向改为跟随真实行进方向
新增12个英雄及突刺(14号)方向技能，配套灵魂道具/招募池；主线1-20关怪物血量攻击按4卡点...重算并应用
```

一句话概括改了什么、为什么改；多个不相关改动可以用分号在同一条提交信息里分开说明。

---

## 📌 项目特定约定（容易忘/容易踩的坑）

### 英雄/技能/物品

- **新增英雄必须配套一个专属灵魂道具**：`hero.json` 加新英雄时，`item.json` 里要同步加一个对应的
  per-hero 灵魂道具，两者是强绑定关系。
- **新技能必须走技能系统，不能写成单个英雄的 ad-hoc 代码**：通过 `SkillConfig` + 技能效果实现层
  接入，不要为某个英雄单独写一套技能触发逻辑。

### 关卡/地图

- **关卡地形数据（`level.json` 的 `terrainGrid`）只存核心 roadlogic 网格**，不要把外围的
  padding（美术留白用的 `PAD_CELLS`）烘焙进 `terrainGrid`——那部分用 `backgroundPadCells` 单独
  表达。
- 关卡随机化：`WaveRandomization.ts` 目前只保留"方向锁定"和"双基地 boss 随机"两种随机机制，
  通用的出怪/怪物类型二次随机已经在之前的重构里删掉了（有过 stale-cache 的 bug 教训），不要
  凭印象以为还有更多随机层。
- 新的地形制作流程：在 Tiled 里用生成好的色块贴图画地形，再由 Claude 把导出的 `.tmj` 解码回
  `level.json`——不是手写 `terrainGrid` 字符网格。
- 主线战斗现在会先巡镜一遍出怪点/基地、播放"开始战斗"横幅，才正式进入战斗，由 `introPlaying`
  状态门控——改战斗开场流程时要留意这段。
- 招募界面的状态最终要做成服务端控制，不能靠客户端随便重置——目前是过渡阶段，新功能别依赖
  "客户端本地状态就是权威"这个假设。
- `Battletype1PreviewScene.ts` 是调试用的 UI 拼装展示场景，不是真实战斗场景，不要把它当正式战斗
  场景去扩展功能。Drill/Fort 顶部栏已经按真实 `Fight.prefab` 数据做了像素/字体级对齐，改动后要去
  "battletype1 UI预览"场景比对验证，不能凭肉眼感觉判断对不对。

### 数值平衡

- 怪物血量/攻击力的正式计算工具：`tools/calc_tight_monster_hp_batch.js`（血量）+
  `tools/calc_monster_attack.js`（攻击力）。
- 9005 关（demo 章节）是固定的单波次数值测试沙盒，用于验证怪物强度/部署配置，配套的 `deployCap`
  部署上限是同批做的正式功能，不是临时代码。
- 关卡/怪物数值平衡测试有一套可复用方法：Playwright 驱动 + 临时测试 hook，用"漏怪计数器"而不是
  "基地剩余血量"判定平衡结果更准；**测试用的 hook 是临时代码，验证完必须清理掉**，不要留在正式
  代码里。
- 做类似数值平衡工作前，建议先看一下之前那次血量公式返工的教训（错误的 C=4 假设、技能伤害没算进
  dps 模型、部署位置相关的 bug、改动范围失控这几类问题），避免重复踩同样的坑。

### Spine 骨骼动画

- 合图工具 `tools/pack_spine_atlas.js` 是零坐标变换版本（多页图集，JSON 逐字节透传）；旧的
  裁剪版留档在 `tools/pack_spine_atlas_legacy_cropped.js`，两者不要混用。
- 调试 Spine 相关问题时：核对具体命名的元素，不要凭经验手推关键帧数值/坐标变换；没有截图实际
  对照过，不能说"修好了"；注意合图工具的输出目录可能互相冲突覆盖；缺失的源数据字段不要自己加
  猜测性兜底值；`attachment.name` 不等于外层字典的 key，两者容易搞混。

### 版本状态

- Phaser 版本：`package.json` 显示当前已是 `4.2.1`。之前有过"验证过 4.0.0→4.2.1 升级安全，但先
  不在本项目升级"的决定，从依赖版本看这个升级看起来已经做完了——如果看到还在用旧写法/旧API，
  确认一下是不是遗留代码，而不是假设项目还停留在 4.0.0。

### ArknightsLevelData（关卡设计参考数据，非项目代码的一部分）

- `activities/`（1823个活动关卡）只作为跟主线关卡的对比参考，**不并入** `by_archetype/` 分类或
  ANALYSIS.md 里"给随机生成器的参数建议"这类统计口径，那些统计只用 `main/`（主线+磨难+支线）。

---

## ⚠️ 常见陷阱

- ❌ 在 `update()` 里创建新的 GameObject（内存泄漏）。
- ❌ 给战斗核心逻辑（`battle/core/`）引入 Phaser 依赖或 `Math.random()`——会破坏确定性/可脱离渲染
  测试的前提。
- ❌ 假设项目有 `lint`/`type-check`/`test`/ESLint/Vitest——目前没有，别凭空调用或引入。
- ❌ 套用 Phaser 官方 React 模板的 EventBus/`current-scene-ready` 模式——本项目不含 React。
- ❌ 新建场景/配置类时用 kebab-case 文件名——跟现有 PascalCase 约定不一致。
- ❌ 未经确认直接替换/删除 `public/assets/` 下已发布的资源文件。
