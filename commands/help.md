---
description: 显示 embedded-loop 的用法、命令、目录结构与典型流程。
---

向用户输出下面这份用法说明（按当前工程实际情况，可读 state.json 补充"当前环境/进度"一行）：

## embedded-loop 用法

**它做什么**：给一个嵌入式工程，自动「拆需求 → 生成测试 → 编译下载 → 监控真机 → 判定 → 失败迭代」，直到硬件满足需求；上下文快满时自动压缩。

**三步上手**
1. `/embedded-loop:init` — 只做初始化：建目录结构（requirements/、资料夹、.embedded-loop/）、**自动识别当前工程芯片并配好编译/烧录工具链**。不读需求、不迭代。
2. 在 `requirements/REQUIREMENT.md` 写需求，把资料（datasheet/DFP/原理图）放进资料夹。
3. `/embedded-loop:run` — 读需求，动态调度 skills 并自我迭代到通过。

**命令**
- `/embedded-loop:init`   初始化 + 芯片识别 + 工具链配置（不迭代）
- `/embedded-loop:run`    启动需求→测试→编译下载→迭代闭环
- `/embedded-loop:status` 查看进度（板子/各需求状态/迭代次数/最近构建与验证）
- `/embedded-loop:help`   显示本说明

**目录结构（工程根下）**
- `requirements/REQUIREMENT.md` — 你写需求的地方（输入）
- `materials/`（或已有的 `material/`） — datasheet/DFP/原理图/网址（输入）
- `.embedded-loop/` — 框架工作区：SPEC.md、state.json、tests/、boards/、detectors/、protocols/、memory/、logs/

**典型流程**：init（识别到芯片、生成 board 草稿）→ 确认编译/烧录命令 → 写需求 → run → 看着它编译/烧录/读串口/判定/迭代 → status 跟进。

**只白盒、不接检测设备**：在需求文档第 6 节写"否，仅白盒"，框架只读 DUT 自身串口/寄存器判定，不影响自动迭代。

**安全与上下文**：未选板子的烧录会被拦下；迭代有上限（state.maxIterations，默认 5）；编译日志/原始波形交子 agent 隔离、只回结论；上下文压缩前自动把要点存进 memory/longterm.md。

**回退框架版本**：插件目录是个 git 仓库，`git tag` 可看版本，`git checkout v0.3.0` 可回到旧版。
