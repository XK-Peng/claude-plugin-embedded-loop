---
name: memory-compact
description: Compress the working context into a small, durable long-term memory file when the conversation grows large, so the loop keeps its essential facts (decisions, root-cause findings, hardware gotchas, current REQ status) without letting context bloat. Use this skill WHENEVER context is getting long, before a /compact, when token usage is climbing, or when finishing a work block. Keep only what's needed to resume losslessly; push detail to files.
---

# memory-compact — 主动压缩，保住长期记忆，控制上下文膨胀

## 何时用
- 上下文变长 / token 上涨明显时。
- 手动 `/compact` 之前（PreCompact hook 也会自动落盘一份快照，但主动整理质量更高）。
- 一个工作段落收尾时。

## 怎么压（原则：结论进记忆，细节进文件）
把当前对话里**只在脑子里、还没落盘**的关键信息蒸馏进 `.embedded-loop/memory/longterm.md`：
1. **当前进度**：activeBoard、currentReq、各 REQ 状态、iteration 计数（其实 state.json 已有，这里写人读摘要 + 指针）。
2. **未决根因**：当前 REQ 失败的最新根因假设、已排除的方案（避免下次重试同一条死路）。
3. **硬件坑**：时序/寄存器/管脚/功耗相关的踩坑结论。
4. **设计决策**：本段定稿的架构/接口决定（同时同步进 SPEC.md 的「已定决策」）。

## 压缩后如何"不失忆"
- `longterm.md` 由 SessionStart hook 在每次开/恢复会话时注入前若干行；细节让 agent 按需读全文。
- 大块原始材料（日志、波形、dump）**不进记忆文件**，只留文件路径引用。
- 压缩本身**不丢可验证事实**：需求/测试/状态分别在 requirements.md / tests/ / state.json，记忆文件只承载"叙事性"信息。

## 输出
更新 `longterm.md`（带时间戳的小节），必要时同步精简 SPEC.md。给用户一句话总结「已保留哪些要点、可以安全压缩了」。
