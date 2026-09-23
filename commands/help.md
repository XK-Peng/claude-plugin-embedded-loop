---
description: 显示 embedded-loop 的用法、命令、目录结构与经验回路说明。
---

向用户输出下面这份说明（可读 state.json 补一行"当前身份/进度"）：

## embedded-loop 用法

**它做什么**：在嵌入式工程里自动「识别硬件 → 拆需求 → 设计测试 → 编译下载 → 监控真机 → 判定 → 失败迭代」，并把每次踩坑沉淀成经验，下次同内核/同 SDK/同构建系统的工程自动带上。插件里不写死任何芯片。

**上手**
1. `/embedded-loop:init` —— 建目录；从 IDE 工程 / CMSIS pack / 构建脚本取证识别器件、内核、构建系统；生成工具链草稿请你确认。不读需求、不迭代。
2. 需求写进 `requirements/REQUIREMENT.md`，资料（datasheet、.pack、原理图）放进资料夹。
3. `/embedded-loop:run` 开始闭环。或者什么都不敲：放入需求后 inbox 监控会提醒；终端跑 `autorun.mjs` 则完全无人值守。

**命令**
- `/embedded-loop:init` 初始化与身份识别
- `/embedded-loop:run` 闭环迭代
- `/embedded-loop:status` 进度
- `/embedded-loop:lessons [all|show id|retire id|stats|关键词]` 经验库
- `/embedded-loop:harvest [transcript]` 从会话记录补捞经验
- `/embedded-loop:help` 本说明

**投放即运行**
- 会话内：后台 `inbox-watch` 监控需求夹与资料夹；资料变化自动重新识别，需求变化提示你跑 run。Claude 关闭期间放进来的文件，下次打开也会报告。
- 无人值守：`node <插件目录>/scripts/autorun.mjs [工程目录]`，需求内容变化且静默 5 秒后，用 `claude -p` 无头跑一轮。需要先在工程 `.claude/settings.json` 的 `permissions.allow` 里放行编译/烧录命令；可用 `.embedded-loop/autorun.json` 改参数；`--dry-run` 先演练。

**经验回路**
- 经验存在全局库 `~/.embedded-loop/kb/`（`EMBEDDED_LOOP_KB` 可改），跨工程共享。
- 每条经验带适用范围：chip / family / core / arch / vendor / sdk / toolchain / buildSystem。内核/架构级的坑（如 Baseline 不支持非对齐访问）换厂商也会被召回。
- 会话开始按当前身份注入最相关的经验；loop 中每轮记候选；run 结束提炼入库；用上的记 helped，被推翻的记 refuted，排序随之变化，反复被推翻的自动退役。

**目录**
- `requirements/`、资料夹（输入）；`.embedded-loop/`（SPEC、state、evidence、tests、boards、cache/SVD、memory、logs）

**只白盒**：需求文档写"否，仅白盒"即可，不影响迭代。
**回退版本**：插件目录是 git 仓库，`git tag` 看版本，`git checkout v0.4.0` 回到上一版。
