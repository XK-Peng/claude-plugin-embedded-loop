---
name: hw-monitor
description: Capture and interpret real hardware output — serial/UART logs, pin levels, timing, current, register dumps, fault registers — and reduce it to a few machine-checkable facts. Use this skill WHENEVER you need to observe what the board is actually doing after flashing, read the serial port, watch for test markers, or diagnose a HardFault. Always save raw evidence to a file and return only the distilled metrics; never dump raw waveforms or long logs into context.
---

# hw-monitor — 采集并解读 DUT 自身真机输出（对内 / 白盒）

> 这是**对内白盒**通道:盯被测件(DUT)自己串口打印的 log 和寄存器状态。
> **对外黑盒**(外部检测设备测继电器/电压等真实状态)由 `blackbox-feedback` 负责,别混。

## 何时用
烧录后需要看 DUT 真实行为、读它自己的串口、等测试打点、抓 HardFault、采时序/功耗证据时。

## 数据来源（按可得性选用）
- **被动后台监控**：插件的 `hw-serial-monitor` 常驻 tail `.embedded-loop/logs/serial.log`，只把命中信号正则（ERROR/ASSERT/FAIL/PASS/HARDFAULT/`[TEST]`/`[REQ-xx]`）的行作为通知推给你。把你的串口终端输出重定向到该文件即可接入。
- **交互式读写**：若配了 serial MCP（serial-mcp-server），可主动 open/read/write 端口，发激励、读响应。
- **仪器/探针**：逻辑分析仪、示波器、电流计的数据 —— 先存文件，再提指标。

## 铁律：证据落盘，上下文只放结论
- 原始波形/长 dump **一律存文件**（logs/ 下），**绝不**整段灌进对话。
- 真机采集与解析建议交给 `hw-verifier` 子 agent：它在隔离上下文里读原始证据，回报极少量数字（Vpp、频率、上升时间、电流均值、寄存器值、命中的测试打点）。这是把"硬件噪声"挡在主上下文外、控制 token 的关键。

## HardFault / 异常诊断
拿到异常/fault 的寄存器或调用栈时，按 `state.env.identity` 的内核与架构去对应手册（资料夹或已抽取的 SVD）解读异常状态位，并先 `kb.mjs query --topic "fault 异常"` 查同架构的已知坑，定位疑似函数，给出根因假设（栈溢出 / 空指针 / 非对齐访问 等），把结论写进 `tests/<REQ>.md` 的证据区与 longterm.md。

## 输出
把「这次真机实际表现」整理成结构化证据交给 verify-iterate：
`{ tid, observed: <关键数字/打点>, evidenceRef: logs/xxx }`。
