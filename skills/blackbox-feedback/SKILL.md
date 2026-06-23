---
name: blackbox-feedback
description: Production-test (产测) orchestrator. For each outward/black-box test item, it drives the EXTERNAL detection device (via the generated fixture driver) to actuate and read the DUT's real physical output state live, then feeds that fresh real-world reading into verification — guaranteeing every test reflects actual external hardware, never cached or simulated values. Use this skill WHENEVER running outward tests, validating that real outputs (relay closure, voltage, GPIO level) actually happened, or running a production-test pass. Requires fixture-protocol-gen to have produced the driver and a configured detector.
---

# blackbox-feedback — 对外真实硬件状态的动态反馈(产测驱动)

## 何时用
跑对外/黑盒测试、验证"继电器真吸合/电压真出现"这类对外物理状态、或跑产测一轮时。前提:`fixture-protocol-gen` 已生成检测设备 driver,且 `state.detector` 已配置。

## 核心保证:每次测的都是"此刻的真实外部状态"
每个对外测试项执行时,本技能用生成的 driver:
1. (如需)**命令 DUT 产生该动作**(例如让固件去吸合继电器 K1);
2. **驱动检测设备现场测量/读回**该对外状态(K1 触点是否真导通、OUT2 是否真有 3.3V);
3. 拿到的是检测设备**当场回报的真值**,不使用任何缓存/默认/模拟值;
4. 把 `{ item, expected, observed(真实), raw, evidenceRef }` 交给 verify-iterate 判定。
读不到/超时/校验失败 → 记为该项失败并附原始证据,绝不"假设通过"。

## 闭环位置(对内 + 对外都要过)
- **对内(白盒)**:hw-monitor 读 DUT 自身串口 log / 寄存器(保留,见 test-design 的 inward 用例)。
- **对外(黑盒)**:本技能读检测设备的真实回报(outward 用例)。
- verify-iterate **要求 inward 与 outward 都通过**,该 REQ 才记 `pass`。两边结果都保留(`state.requirements[].result.{inward,outward}`),双保险。

## 流程
1. 取当前 REQ 的 outward 用例集合。
2. 逐项:按 fixture driver 的测试项处理函数,命令/读检测设备 → 得真值。
3. 汇总交 verify-iterate。原始回报落 `.embedded-loop/logs/`,上下文只放结论数字。
4. 测试项扩展时,先让 fixture-protocol-gen 增量生成对应处理函数,本技能即可驱动新项。

## 注意
- 检测设备串口与 DUT 调试串口是**两个不同端口**,别混。DUT 端口给 hw-monitor / 后台监控;检测设备端口给本技能的 driver。
- 动作有时序要求时(吸合需稳定 N ms 再测),按测试项需求加等待,确保测的是稳定后的真值。
