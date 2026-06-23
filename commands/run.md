---
description: 从 requirements/ 读需求,启动「解析环境→拆分→测试→编译下载→监控→(可选产测)→判定→迭代」闭环
argument-hint: 可留空(读 requirements/REQUIREMENT.md);或直接给需求/REQ-id
---

用户输入：$ARGUMENTS （留空则读 `requirements/REQUIREMENT.md`）

全程以 `.embedded-loop/state.json` 为准，`state.run.active=true`：

1. **解析环境**（若未解析）：调用 **env-resolver** 从需求文档读 chip/os/ide + materials/ 资料 → 解析编译/烧录命令写入 board profile，用户确认。
2. **拆需求**：调用 **requirement-split**（读 requirements/ 的需求文档）拆成原子 REQ，登记 state（复杂探索派 req-analyst）。用户确认需求表。
3. **固化规约**：调用 **spec-keeper** 同步进 SPEC.md（保持精简）。
4. **判断是否需要对外检测**：需求文档第 6 节写"仅白盒"或 `state.detector` 为 null → 跳过黑盒,只做对内测试。否则确保 fixture driver 已就绪。
5. 对每条未通过 REQ（按 priority + deps），设 `currentReq`，循环：
   a. **设计测试**：调用 **test-design** 生成 host + inward(+ outward 若有检测设备) 用例。
   b. **编译下载**：调用 **board-flash**，构建交 **build-runner** 子 agent（隔离日志）。
   c. **对内监控**：调用 **hw-monitor** 读 DUT 自身串口/寄存器（inward 证据），采集交 **hw-verifier**。
   d. **（有检测设备时）对外产测**：调用 **blackbox-feedback** 现场读真实对外状态（outward）。
   e. **判定迭代**：调用 **verify-iterate**；仅白盒时 inward 过即 pass；有检测设备则内外都过才 pass。fail 则定位→改→回 b；每轮 iterations+1。
   f. Stop hook 在「未通过且未到上限」时自动顶回继续。
6. 全部 REQ 通过、或某条 needs-human → 汇总每条 REQ 状态/证据/迭代次数。`state.run.active=false`。
7. 上下文变长时调用 **memory-compact**（PreCompact hook 也会自动落盘）。

目标：迭代到真机满足所有需求与测试为止（仅白盒时即 DUT 自身验证全部通过）。
