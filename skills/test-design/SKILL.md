---
name: test-design
description: Turn each requirement (REQ-id) into concrete, objectively judgeable test cases for embedded firmware — host-side unit tests for logic plus hardware-in-the-loop (HIL) assertions on real signals (serial output, pin levels, timing, current, register values). Use this skill WHENEVER a requirement has been split out and needs tests, when the user provides "test requirements", or before iterating on hardware. Every test must have a machine-checkable pass/fail signal.
---

# test-design — 把需求细分成可客观判定的测试用例

## 何时用
某条 REQ 拆好后、或用户直接给了「测试需求」时。在 board-flash 之前生成测试，让闭环有判定依据。

## 分层（三类,内外都要,双保险）
1. **Host 单元测试（首选）**：因为架构是 HAL/BSP 分层 + 函数指针 ops,把外设接口 mock 掉,可在主机(MinGW/gcc)直接编译运行纯逻辑(状态机、协议解析、ring buffer 等),秒级反馈、不耗板子。
2. **对内 HIL（白盒, channel=inward）**：读 DUT **自身**串口 log / 寄存器状态,判断它"自认为"做了什么。由 hw-monitor 采集。
3. **对外 HIL（黑盒/产测, channel=outward）**：用**外部检测设备**物理测 DUT 对外真实状态(继电器真吸合、OUT 真有电压)。由 blackbox-feedback 驱动检测设备现场读真值。检测设备协议 + 测试项见 `state.detector`,driver 由 fixture-protocol-gen 生成。
> 对内可能"以为成功"但对外没真动作 —— 所以同一 REQ 通常**既要 inward 用例、也要 outward 用例**,两边都过才算过。

## 每条测试用例字段（模板见 templates/test-case.template.md，写入 .embedded-loop/tests/<REQ-id>.md）
- `tid`: <REQ-id>-T01…
- `channel`: host | inward | outward          ← 新增,标明内/外
- `setup`: 前置（编译选项、板子、外部激励、检测设备测试项）
- `stimulus`: 输入/触发（含"命令 DUT 产生该动作"）
- `expected`: **可机读的期望信号**：
  - host/inward 用例:串口出现 `[TEST] REQ-003 PASS`、GPIO ≤500us 翻转、电流均值<1mA、寄存器==0xNN…
  - outward 用例:检测设备回报"K1 触点导通"、"OUT2 = 3.3V±5%"等**对外真实状态**。
- `oracle`: 判定规则（正则 / 数值阈值 / 比对基线），保证 verify-iterate 能自动判 pass/fail。
- `evidence`: 证据采集方式（inward: serial.log 行 / 波形指标;outward: 检测设备回报 / logs 引用）。

## 产出建议
- 给被测固件加**结构化测试打点**：在关键路径用统一前缀打印，如 `printf("[TEST] %s %s\n", tid, ok?"PASS":"FAIL")`，让 oracle 用一条正则就能判定，避免把大段原始日志塞进上下文。
- HIL 证据**先落文件再提指标**：不要把整段波形/长 dump 灌进对话；存文件，让子 agent 解析出 Vpp/频率/上升沿/均值等少量数字回报。
- 为每条 REQ 至少 1 条 happy-path + 1 条边界/异常用例。
