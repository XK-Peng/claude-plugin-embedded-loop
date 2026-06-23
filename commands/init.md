---
description: 仅初始化：建目录结构 + 自动识别当前项目芯片并配好编译/烧录工具链。不读需求、不开始迭代。
---

**只做初始化与环境准备，绝不读取需求文档、绝不开始任何编译/迭代。** 步骤：

1. **建脚手架（确定性）**：运行
   `node "${CLAUDE_PLUGIN_ROOT}/scripts/init-scaffold.mjs"`
   创建 `requirements/`、资料夹（若已有 `material/` 单数则沿用）、`.embedded-loop/{tests,boards,detectors,protocols,memory,logs}`，放好输入模板，初始化 state.json。已存在的文件不覆盖（可安全重复运行）。

2. **自动识别芯片 + 配工具链**：运行
   `node "${CLAUDE_PLUGIN_ROOT}/scripts/detect-env.mjs"`
   它扫描当前工程已有文件（DFP 包、`*_Library`/`*_DFP` SDK 目录、`.uvprojx`、jlink 等），推断芯片/厂商/IDE/烧录器，写入 `state.env`，并生成一份 `boards/<芯片>.json` 草稿（编译/烧录命令为最佳猜测+占位符）。把脚本输出原样转达用户。

3. **请用户确认/补全检测结果**（仍属初始化，不要开始跑）：
   - 若芯片识别成功（如 N32G003）：把草稿里的 Keil 安装路径、`.uvprojx`、产物路径、`COM` 口列给用户确认；确认后可把 `state.activeBoard` 设为该芯片名、`state.env.toolchainResolved=true`。
   - 若芯片未识别（例如该厂商不在内置表里）：告诉用户在 `requirements/REQUIREMENT.md` 第 2 节写明芯片/IDE，或直接给一条平时能编译/烧录的命令，由你填进 board 草稿。
   - 解读寄存器/管脚的资料以资料夹下的 PDF/DFP 为准，不臆测。

4. **结束初始化并给出下一步**（不要继续）：
   - 告诉用户：把需求写进 `requirements/REQUIREMENT.md`，把资料放进资料夹（或在其 README 列出位置）。
   - 提示：准备好后运行 `/embedded-loop:run` 才开始拆需求→测试→编译下载→迭代。
   - 想看完整用法可运行 `/embedded-loop:help`。

> 设计意图：init 与 run 职责分离。init 只把"结构 + 工具链"准备好；动态调度 skills 和自我迭代全部在 run 里发生。
