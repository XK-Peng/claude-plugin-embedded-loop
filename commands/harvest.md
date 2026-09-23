---
description: 从本次（或指定）会话记录里补捞已验证的踩坑经验，并提炼入经验库
argument-hint: 可选：会话记录 .jsonl 路径（默认 state.lastTranscript）
---

1. 派 **lesson-harvester** 子 agent 读会话记录（$ARGUMENTS 或 `state.lastTranscript`），把已验证的"症状→原因→做法"记为 pending。
2. 按 **lesson-loop** 技能提炼：合并重复、判断 scope 层级、`kb.mjs promote` 入库、`kb.mjs pending clear`。
3. 汇报：新增/合并了哪些经验、各自 scope。
