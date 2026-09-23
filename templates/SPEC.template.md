# <项目名> 工程规约（SPEC.md · 单一事实来源 · 保持精简）

## 1. 目标
<1-2 句话说明这个固件要做什么>

## 2. 环境（env-resolver 解析,决定编译/下载工具链）
- 身份：由 env-resolver 从工程证据确认后写入（器件 / 内核 / 架构 / 厂商 / SDK / 构建系统 / 烧录器）
- 操作系统(os)：<Windows / Linux / macOS>
- 构建与烧录命令：见 .embedded-loop/boards/
- 资料目录(docsDir)：<datasheet/SDK/原理图 文件夹路径>

## 3. 硬件
- 被测件(DUT)：板清单见 .embedded-loop/boards/
- DUT 调试串口：<COMx @ 115200>；测试打点格式：`[TEST] <tid> PASS|FAIL`
- 外部检测设备(黑盒/产测)：见 .embedded-loop/detectors/ 与 protocols/
  - 端口：<COMy @ baud>；协议：<protocols/xxx.md>

## 4. 架构铁律（写代码不可违反）
- 六边形 / HAL ⊥ BSP 分层
- 外设走函数指针 ops 结构（如 hal_transport_t），SPI/UART 可切换
- 纯静态内存，禁止动态分配
- ISR 与业务解耦，事件上报不在中断里做重活
- <你的其它硬约束>

## 5. 需求索引（明细见 requirements.md，状态以 state.json 为准）
- REQ-001 — <一句话> — <todo/pass/...>
- REQ-002 — ...

## 6. 约定
- 编译命令 / 烧录命令：见 boards/<name>.json（env-resolver 填,用户确认）
- 日志/证据落 .embedded-loop/logs/

## 7. 已定决策 & 禁区
- <踩过的坑、明确不做的方案>
