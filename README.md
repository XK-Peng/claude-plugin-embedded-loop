# embedded-loop —— 嵌入式固件「需求→环境解析→测试(内+外)→编译下载→真机→迭代」闭环插件

给它你的**需求文档**:它从文档读出芯片/OS/IDE/资料目录 → 解析编译下载工具链 → 拆需求 → 生成内+外测试 → 编译下载 → 对内监控 DUT 自身 + 对外用检测设备做产测 → 内外都通过才算过 → 失败自动迭代,直到真机内外都满足;上下文快满时自动压缩且不失忆。

```
需求文档（含 芯片/OS/IDE/资料目录 + 测试需求 + 检测设备协议）
   │
   ▼
env-resolver        读 chip/os/ide/docsDir → 解析编译/烧录命令 → 写入 board profile
requirement-split   细分成原子可验证需求 (REQ-001…)                 ├ 子agent req-analyst
spec-keeper         固化进精简 SPEC.md (单一事实来源, 省token)
fixture-protocol-gen 按检测设备串口协议+测试项 生成读真值driver,注入测试代码
test-design         每条需求 → host单测 + inward(白盒) + outward(黑盒)用例
   │
   ▼  对每条 REQ 循环：
board-flash         按板子profile 编译+下载                         ├ 子agent build-runner(隔离编译日志)
hw-monitor          对内:读 DUT 自身串口log/寄存器(inward)          ├ 子agent hw-verifier(隔离原始波形)
blackbox-feedback   对外:驱动检测设备现场读真实状态(outward,产测)
verify-iterate      inward & outward 都过→pass;否则定位→改→重来
   │  ▲__________________________________________________│  (Stop hook 顶回,直到内外都过或到迭代上限)
   ▼
全部 REQ 在真机上内外测试都通过
```
外加:上下文快满时自动压缩并保住长期记忆(PreCompact + memory-compact + SessionStart 注入)。

## 0. 它跑在什么 OS/IDE? 怎么找编译下载指令?
- 插件本身**不绑定任何 OS/IDE**,hook/脚本是纯 Node,Windows/Linux/macOS 通用。
- 编译/下载指令由 **env-resolver** 解决:从需求文档读出 `chip/os/ide/docsDir`,对照 `skills/env-resolver/references/toolchains.md`(Telink/STM32/nRF/ESP32/Keil/IAR/Arduino…)解析出命令写进 `boards/<name>.json`,再让你确认。表里没有的芯片,你在需求里直接给一条能跑通的命令即可。
- 这些可写在需求文档里,也可在 /run 时口头补充。

## 1. 十个 skills
- **env-resolver** 解析芯片/OS/IDE/资料→工具链→board profile
- **requirement-split** 拆原子需求 ·  **spec-keeper** 维护精简 SPEC.md
- **test-design** 生成 host+inward+outward 用例
- **fixture-protocol-gen** 按检测设备协议+测试项生成读真值driver并注入(协议不变、项扩展只增量加)
- **board-flash** 按板子编译下载 ·  **hw-monitor** 对内读 DUT 串口/寄存器
- **blackbox-feedback** 对外产测,驱动检测设备现场读真值
- **verify-iterate** 内外都过才pass,否则定位改重来 ·  **memory-compact** 主动压缩保记忆

## 2. 三个子 agent（控 token 膨胀）
build-runner(隔离编译日志)、hw-verifier(隔离原始波形/长串口)、req-analyst(隔离需求探索)。主线程只拿"过没过+几个数字+文件引用"。

## 3. 五类 hooks
SessionStart(注入精简SPEC+环境+进度+记忆)、UserPromptSubmit(一行状态)、PreToolUse/Bash(烧录安全闸:未选板deny、整片擦除ask)、Stop(内或外未过不许收工,顶回;到上限转needs-human)、PreCompact(压缩前落盘记忆)。

## 4. 目录结构
```
embedded-loop/
├── .claude-plugin/plugin.json
├── skills/  env-resolver{+references/toolchains.md} requirement-split spec-keeper
│            test-design fixture-protocol-gen board-flash hw-monitor
│            blackbox-feedback verify-iterate memory-compact
├── agents/  build-runner hw-verifier req-analyst
├── hooks/hooks.json   monitors/monitors.json
├── scripts/ session-start userprompt-context guard-flash stop-gate
│            precompact-save serial-tail lib/state.mjs
├── commands/ init run status
├── templates/ SPEC requirements test-case board detector protocol-spec fixture-driver longterm
├── .mcp.json   settings.json
```
工程侧（/embedded-loop:init 生成）：
```
<project>/.embedded-loop/
├── SPEC.md  state.json  requirements.md
├── tests/<REQ>.md          内+外测试用例+结果
├── boards/<name>.json      DUT 板(编译/烧录命令)
├── detectors/<n>.json      外部检测设备(端口/协议/测试项)
├── protocols/<n>.md        你贴的检测设备串口协议
├── memory/longterm.md      跨压缩长期记忆
└── logs/                   build-*.log / serial.log / 检测设备回报
```

## 5. 三条设计原则
1. 状态在磁盘(state.json),不在上下文。
2. 大材料落文件,子 agent 只回结论。
3. 压缩但不失忆(PreCompact 落盘 + SessionStart 注入)。

## 6. 对内 vs 对外（双保险）
- inward(保留):读 DUT 自己串口log/寄存器,它"自认为"做了什么 → hw-monitor。
- outward(产测):外部检测设备物理探测真实对外状态(继电器真吸合、OUT真有电压),经它自己串口回报 → fixture-protocol-gen 生成driver、blackbox-feedback 现场读真值。
- 两个串口别混:DUT 串口给 hw-monitor;检测设备串口给 fixture driver。
- verify-iterate 要求内外都过,两类结果都存 state.requirements[].result.{inward,outward}。

## 7. 安装
```
/plugin marketplace add D:\path\to\embedded-loop-pkg
/plugin install embedded-loop@my-fw-tools
```
后台监控需 Claude Code v2.1.105+。

## 8. 用法
```
/embedded-loop:init                       # 解析环境 + 脚手架 + DUT板 + 检测设备/协议
/embedded-loop:run <需求文档 + 测试需求>  # 启动内外闭环
/embedded-loop:status                     # 进度(含内/外状态)
```

## 9. 扩展
多板/多芯片→env-resolver 重解析或加 board profile;测试项扩展→fixture-protocol-gen 增量加处理函数;迭代上限/信号过滤/host单测→state.maxIterations / serial-tail.mjs 的 SIGNAL / board profile 的 host_test.command。
