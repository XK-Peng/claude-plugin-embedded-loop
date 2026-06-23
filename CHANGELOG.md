# Changelog

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
