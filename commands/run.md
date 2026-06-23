---
description: 从 requirements/ 读需求，动态调度 skills 并自我迭代：拆分→测试→编译下载→监控→(可选产测)→判定→迭代。
argument-hint: 可留空(读 requirements/REQUIREMENT.md)；或直接给需求/REQ-id
---

用户输入：$ARGUMENTS （留空则读 `requirements/REQUIREMENT.md`）

前置检查：若 `requirements/` 下没有任何需求内容且 $ARGUMENTS 为空 → 停下并提示用户先填写需求文档（不要凭空编需求）。

全程以 `.embedded-loop/state.json` 为准，置 `state.run.active=true`：

1. **确认环境**：读 `state.env`。
   - 若 `toolchainResolved=false` 或 board 命令仍是占位符 → 调用 **env-resolver** 结合需求文档把 chip/os/ide 与编译/烧录命令补全并请用户确认，置 `toolchainResolved=true`、设 `activeBoard`。
   - 若 init 已确认好 → 直接用，不重复问。
2. **拆需求**：调用 **requirement-split**（读 requirements/）拆成原子 REQ，登记 state（复杂探索派 req-analyst）。让用户确认需求表。
3. **固化规约**：调用 **spec-keeper** 同步进精简 SPEC.md。
4. **是否需要对外检测**：需求写"仅白盒"或 `state.detector` 为 null → 跳过黑盒，只做对内测试；否则确保 fixture driver 就绪（fixture-protocol-gen）。
5. 对每条未通过 REQ（按 priority + deps），设 `currentReq`，循环：
   a. **设计测试**：调用 **test-design**（host + inward [+ outward]）。
   b. **编译下载**：调用 **board-flash**（构建派 build-runner 子 agent 隔离日志）。
   c. **对内监控**：调用 **hw-monitor** 读 DUT 串口/寄存器（采集派 hw-verifier）。
   d. **（有检测设备）对外产测**：调用 **blackbox-feedback** 现场读真值。
   e. **判定迭代**：调用 **verify-iterate**；仅白盒时 inward 过即 pass；有检测设备则内外都过。fail 则定位→改源码→回 b；每轮 iterations+1。
   f. Stop hook 在「未通过且未到上限」时自动顶回继续。
6. 全部 REQ 通过、或某条 needs-human → 汇总状态/证据/迭代次数。置 `state.run.active=false`。
7. 上下文变长时调用 **memory-compact**（PreCompact hook 也会自动落盘）。

目标：动态调度上述 skills，迭代到真机满足所有需求与测试为止。
