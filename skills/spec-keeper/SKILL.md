---
name: spec-keeper
description: Create and maintain a single lean, long-lived SPEC.md (the project's source of truth, similar in spirit to CLAUDE.md/spec.md) that every agent reads accurately and cheaply. Use this skill WHENEVER requirements change, a decision is finalized, the spec drifts from reality, or you need to compress the project's truth into a token-efficient form. Always keep SPEC.md small, current, and unambiguous; prune anything stale.
---

# spec-keeper — 精简、长寿、省 token 的单一事实来源

## 目标
维护 `.embedded-loop/SPEC.md`：让 agent 每次读到的需求/约束**准确无歧义**，又**不浪费 token**。
SessionStart hook 会自动把整份 SPEC.md 注入上下文，所以它必须保持精简。

## 何时用
- 初始化工程（`/embedded-loop:init` 之后）。
- 需求被确认/变更，或某个设计决策定稿。
- 发现 SPEC 与实际代码/硬件不符（spec drift）。
- 需要把一堆讨论压缩成稳定事实。

## SPEC.md 结构（保持在 ~1 屏内，模板见 templates/SPEC.template.md）
1. **项目与目标**：1–2 句。
2. **硬件**：MCU 型号/封装、关键外设、目标板清单（指向 boards/）。
3. **架构铁律**：如六边形 HAL/BSP 分层、函数指针 ops 结构、纯静态内存、ISR 解耦事件上报 —— 这些是 agent 写代码时**不可违反**的硬约束。
4. **需求索引**：只放 `REQ-id → 一句话 + 状态`，细节留在 requirements.md（避免重复 = 避免 token 膨胀 + 避免两处不一致）。
5. **关键约定**：编译/烧录工具链、串口波特率、日志格式标记（如 `[TEST]`/`[REQ-00x]`）。
6. **已定决策 & 禁区**：踩过的坑、明确不做的方案。

## 维护规则（重要）
- **不重复**：同一事实只存一处。SPEC 放索引与铁律，明细放各自文件，靠 id 关联。
- **可被机器读**：需求状态等结构化信息以 state.json 为准，SPEC 里的状态是人读摘要。
- **prune**：每次更新顺手删掉过期内容。SPEC 越短，每个会话越省 token、agent 越不容易读偏。
- 变更时同步：requirements.md / state.json / SPEC.md 三者一致。
