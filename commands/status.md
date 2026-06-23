---
description: 打印当前 embedded-loop 工程进度（板子 / 当前需求 / 各需求状态 / 最近构建与验证）
---

读取 `.embedded-loop/state.json` 与 `.embedded-loop/SPEC.md`，向用户输出一张简表：
- activeBoard、currentReq、maxIterations
- 每条 REQ：id / title / status / iterations / 最近结果
- lastBuild / lastFlash / lastVerify 摘要
- 指出下一步建议（哪条 REQ 待推进，或哪条需要人工介入）。
不要贴原始日志，只给结论。
