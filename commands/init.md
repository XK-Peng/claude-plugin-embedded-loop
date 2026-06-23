---
description: 初始化 embedded-loop（建需求夹/资料夹/工作区 + 解析环境工具链 + DUT板 + 可选检测设备）
---

为当前工程初始化 embedded-loop：

1. **建脚手架（确定性）**：运行
   `node "${CLAUDE_PLUGIN_ROOT}/scripts/init-scaffold.mjs"`
   它会创建 `requirements/`、`materials/` 和 `.embedded-loop/{tests,boards,detectors,protocols,memory,logs}`，并放好输入模板、初始化 state.json。把脚本输出转达用户。
2. 提示用户：把需求写进 `requirements/REQUIREMENT.md`，把资料(PDF/网址)放进 `materials/` 或在其 README 列出位置。
3. **解析环境**：调用 **env-resolver** 读 requirements/ + materials/，得出 chip/os/ide → 解析编译/烧录命令写入 `boards/<name>.json`，列给用户确认后置 `state.env.toolchainResolved=true`、设 `activeBoard`。
4. **固化规约**：调用 **spec-keeper** 把环境/架构铁律/需求索引写进 `.embedded-loop/SPEC.md`（精简）。
5. **（可选）对外检测设备**：仅当用户需要黑盒/产测时——把检测设备协议放 `protocols/`，用 detector.template.json 配 `detectors/<n>.json` 写入 `state.detector`，调用 **fixture-protocol-gen** 生成 driver。需求写"仅白盒"则跳过本步。
6. 指引：用 `/embedded-loop:run` 启动闭环。
