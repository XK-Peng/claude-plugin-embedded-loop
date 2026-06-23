---
name: fixture-protocol-gen
description: Generate the host/test-equipment-side serial driver code that talks to an EXTERNAL detection/inspection device (the box that physically checks the DUT's outputs, e.g. whether a relay actually closed), from a user-supplied serial protocol spec plus a list of test items. Inject the generated driver into the user's test code. Use this skill WHENEVER the user provides a detection-device serial protocol, asks to read external/real hardware state, sets up a production-test (产测) fixture, or adds/extends test items on the same protocol. The protocol is given verbatim by the user — do not invent frame formats.
---

# fixture-protocol-gen — 按检测设备串口协议生成读取其真实状态的驱动代码

## 背景
这是"对外黑盒/产测"链路的**代码生成器**。被测件(DUT)跑你的固件;另一台**检测设备**物理探测 DUT 对外状态(继电器是否真吸合、电压是否真的出现、GPIO 实际电平…),并通过它**自己的串口**把真实状态回报。本技能把"测试设备如何读检测设备状态"的驱动代码生成出来,注入你的测试代码。

## 输入(都由用户给,不臆造)
1. **检测设备串口协议**:帧格式、命令、应答、校验、波特率等(用户直接贴,或放 `.embedded-loop/protocols/<name>.md`)。
2. **测试项需求**:要检测哪些对外状态(如"继电器 K1 吸合"、"OUT2 输出 3.3V")。**协议可能同一份,但测试项会扩展** —— 生成时按可扩展方式组织。
3. **目标语言**:测试 runner 用的语言(C / Python / Node…,记入 `state.detector.lang`)。

## 产物(注入用户代码,模板见 templates/fixture-driver.template.md)
分两层,便于"协议不变、测试项扩展":
1. **协议层 driver**(一次生成、长期复用):open/close、组帧/解帧、校验、send_cmd/read_resp 等纯协议原语。协议没变就不重生成。
2. **测试项处理层**(随测试项扩展而增量生成):每个测试项一个处理函数,内部调用协议层去**命令检测设备测量 / 读回真实状态**,返回结构化结果 `{ item, observed, raw }`。新增测试项 = 往注册表里加一项,复用同一协议层。

## 关键约束
- 帧格式/字段**严格照用户给的协议**,不自创;不确定的字段标 `> 💡 待核实`让用户确认。
- 生成的代码要落在用户工程里明确位置(如 `test/fixture/`),并登记到 `state.detector`(port/baud/protocolRef/lang/items)。
- 校验(CRC/checksum)、超时、重试要按协议实现,避免把噪声当真值。
- 同协议扩展测试项时:**只新增处理层 + 注册项**,不改协议层 —— 这是本技能的核心设计点。

## 与运行的衔接
生成的 driver 由 `blackbox-feedback` 在每轮测试时调用,确保每次读的都是检测设备此刻的真实回报。
