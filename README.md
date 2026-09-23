# embedded-loop

Claude Code 插件：在嵌入式工程里自动「识别硬件 → 拆需求 → 设计测试 → 编译下载 → 监控真机 → 判定 → 失败迭代」，并把每次踩坑沉淀成按适用范围组织的经验，回馈给之后的每一个工程。

**插件里不写死任何芯片。** 硬件身份从工程自己的标准格式文件里取证（IDE 工程、CMSIS pack、构建脚本、启动文件），芯片知识从 loop 里长出来。

## 安装
```
/plugin marketplace add XK-Peng/embedded-loop      # 或本地路径
/plugin install embedded-loop@xk-embedded
```
依赖：Node.js ≥ 18（hook 与脚本均为零依赖 .mjs，Windows / WSL / Linux / macOS 通用）。后台监控需 Claude Code v2.1.105+。

## 用法
```
/embedded-loop:init      建目录 + 取证识别身份 + 工具链草稿（不读需求、不迭代）
/embedded-loop:run       闭环迭代到真机通过
/embedded-loop:status    进度
/embedded-loop:lessons   经验库
/embedded-loop:harvest   从会话记录补捞经验
/embedded-loop:help      完整说明
```
投放即运行：会话内由后台 `inbox-watch` 监控需求夹/资料夹；无人值守用 `node scripts/autorun.mjs <工程>`。

## 三个核心机制
1. **取证识别**（`probe-env.mjs`）：读 `.uvprojx <Device>/<Cpu>`、`.pdsc Dname/Dcore/memory/svd`、`sdkconfig`、`.ioc`、`-mcpu/-march`、启动文件与烧录器配置，给出带来源的候选身份，由 env-resolver 确认、补全架构、按身份查找缺失资料，并按**构建系统**（非芯片）生成编译/烧录命令。
2. **经验回路**（`kb.mjs` + lesson-loop 技能）：全局经验库，每条经验带 scope（chip/family/core/arch/vendor/sdk/toolchain/buildSystem）。会话开始按身份检索注入 → loop 中逐轮记候选 → run 结束提炼入库 → helped/refuted 回馈调整排序，反复被推翻的自动退役。内核/架构级的坑换厂商也会被召回。
3. **闭环门控**（hooks）：Stop 闸保证需求逐条推进、未过继续迭代、到上限转人工且只汇报一次、结束时提醒提炼经验；烧录安全闸；压缩前落盘。未初始化的项目中所有 hook/monitor 完全静默，不创建任何文件。

## 目录
```
.claude-plugin/   plugin.json, marketplace.json
skills/           env-resolver(+references/build-systems.md) requirement-split spec-keeper test-design
                  fixture-protocol-gen board-flash hw-monitor blackbox-feedback verify-iterate
                  memory-compact lesson-loop
agents/           build-runner hw-verifier req-analyst lesson-harvester
commands/         init run status lessons harvest help
hooks/hooks.json  SessionStart UserPromptSubmit PreToolUse Stop PreCompact
monitors/         hw-serial-monitor inbox-watch
scripts/          probe-env kb inbox-watch autorun init-scaffold serial-tail + hook 脚本, lib/{state,kb,zip}
templates/
```
工程侧：`requirements/`、资料夹（输入）；`.embedded-loop/`（SPEC、state、evidence、tests、boards、cache/SVD、memory、logs）。
经验库：`~/.embedded-loop/kb/lessons.jsonl`（`EMBEDDED_LOOP_KB` 可改）。

详细调用关系见 ARCHITECTURE.md，版本记录见 CHANGELOG.md。
