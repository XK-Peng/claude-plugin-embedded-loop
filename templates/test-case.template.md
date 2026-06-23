# 测试用例 — REQ-00X（内 inward + 外 outward 都要,两边过才算过）

## REQ-00X-T01  (channel: inward / 白盒)
- channel: inward
- setup: <编译选项 / 板子>
- stimulus: <命令 DUT 执行某动作>
- expected: <DUT 自身可机读信号,如 串口出现 [TEST] REQ-00X-T01 PASS / 寄存器==0xNN>
- oracle: <正则 / 数值阈值>
- evidence: <serial.log 行 / 波形指标>

## REQ-00X-T02  (channel: outward / 黑盒·产测)
- channel: outward
- setup: <检测设备测试项,如 K1-CLOSE>
- stimulus: <命令 DUT 产生该对外动作,如吸合 K1>
- expected: <检测设备回报的真实对外状态,如 K1 触点导通 / OUT2=3.3V±5%>
- oracle: <检测设备应答的判定规则>
- evidence: <检测设备回报 / logs 引用>
