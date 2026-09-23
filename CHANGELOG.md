# Changelog

## v0.5.0 — 去芯片硬编码 · 跨芯片经验回路 · 投放即运行
- **身份取证替代型号表**：新增 `probe-env.mjs`（`detect-env.mjs` 保留为别名）。只读标准格式：Keil `.uvprojx`、CMSIS `.pack/.pdsc`（零依赖 zip 读取）、IAR `.ewp`、`sdkconfig`、`.ioc`、`platformio.ini`、`-mcpu/-march`、启动文件、烧录器配置。输出 `evidence.json` 与带来源的候选身份，从 pack 抽取 SVD 到 `.embedded-loop/cache/`。
- **env-resolver 重写**：确认身份、补全架构、按身份查缺资料并记 `LINKS.md`、按构建系统定命令。`toolchains.md`（按厂商）→ `build-systems.md`（按构建系统）。
- **经验回路**：新增 `scripts/lib/kb.mjs`、`scripts/kb.mjs`、`lesson-loop` 技能、`lesson-harvester` 子 agent、`/lessons` 与 `/harvest` 命令。经验按 scope 分层（chip/family/core/arch/vendor/sdk/toolchain/buildSystem），会话开始按身份注入，loop 中记候选，结束时提炼，helped/refuted 反馈排序与自动退役；查重合并时保留更完整的描述。
- **投放即运行**：新增 `inbox-watch` monitor（资料变更自动重探测、需求变更提示 run、覆盖关闭期间投放）与 `autorun.mjs`（无人值守，内容哈希去重 + 防抖）。
- **修复**：Stop 闸在 needs-human 时无限顶回；当前需求通过后不推进下一条；hook/monitor 在未初始化项目中创建 `.embedded-loop/`（`readState` 改为只读，新增 `isInitialized` 守卫）。
- **清理**：技能、模板、guard-flash 中的芯片/厂商工具名全部移除（guard-flash 改为通用关键词 + 当前板子的烧录可执行文件）。
- 状态结构升级到 schema 3（`env.identity`、`lessons`、`lastTranscript`），旧 state.json 自动兼容。
- 新增 `.claude-plugin/marketplace.json`，仓库可直接作为 marketplace 安装。

## v0.4.0 — init/run 职责分离 + 项目芯片自动识别
- **init 改为只做初始化**：建目录结构 + 自动识别当前工程芯片并配工具链；**不再读需求、不再启动迭代**。解决了"没放需求文档就开始跑"的顺序问题。
- **新增 `scripts/detect-env.mjs`**：扫描工程已有文件（DFP 包、`*_Library`/`*_DFP`、`.uvprojx`、jlink）推断芯片/厂商/IDE/烧录器，生成 board 草稿。支持 Nations(N32)/ST/GD/ESP/Nordic/Artery/MindMotion/HKMicro/WCH/Geehy/Telink 前缀识别。
- **新增 `/embedded-loop:help`** 命令。
- **run 增加前置检查**：无需求内容时停下提示，并在工具链未确认时先确认再迭代。
- **兼容已有 `material/`（单数）资料夹**，不再强建 `materials/`。
- **env-resolver 双模式**：init 项目扫描 / run 结合需求文档。
- toolchains 参考新增 Nations 与"通用兜底（私有内核/RISC-V）"条目。

## v0.3.0 — 基线
- 需求文档夹/资料夹 + 确定性脚手架；对内(白盒)+对外(黑盒/产测)双通道测试；env-resolver/fixture-protocol-gen/blackbox-feedback；STM32 示例。（init 与 run 职责未分离）
