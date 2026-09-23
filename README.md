# embedded-loop

> **一个 [Claude Code](https://docs.claude.com/en/docs/claude-code/overview) 插件（Plugin）**，面向嵌入式固件开发：在你的工程里自动完成「识别硬件 → 拆需求 → 设计测试 → 编译下载 → 监控真机 → 判定 → 失败迭代」的闭环，并把每次踩坑沉淀成可跨芯片复用的经验。
>
> *A Claude Code plugin that drives an autonomous firmware loop — hardware identification, requirement decomposition, test design, build & flash, on-target verification and iteration — with a cross-chip lesson memory.*

![version](https://img.shields.io/badge/version-0.5.0-blue) ![type](https://img.shields.io/badge/Claude%20Code-plugin-orange) ![node](https://img.shields.io/badge/node-%E2%89%A518-green)

---

## 目录
- [这是什么：Claude Code 插件](#这是什么claude-code-插件)
- [它能做什么](#它能做什么)
- [插件包含哪些组件](#插件包含哪些组件)
- [环境要求](#环境要求)
- [安装](#安装)
- [快速上手](#快速上手)
- [命令一览](#命令一览)
- [工作流程](#工作流程)
- [三个核心机制](#三个核心机制)
- [配置项](#配置项)
- [目录结构](#目录结构)
- [安全设计](#安全设计)
- [常见问题](#常见问题)
- [版本与回退](#版本与回退)

---

## 这是什么：Claude Code 插件

**Claude Code** 是 Anthropic 推出的智能编程工具，可以在终端、IDE（VS Code / JetBrains）和桌面应用中使用，直接读写你的代码、运行命令。

**插件（Plugin）** 是 Claude Code 的扩展机制：把 skills（技能）、subagents（子代理）、slash commands（斜杠命令）、hooks（生命周期钩子）、monitors（后台监控）、MCP servers 等打包在一个目录里，通过 marketplace 一条命令安装、统一启用/停用。插件的清单文件是 `.claude-plugin/plugin.json`。

**本仓库就是这样一个插件**，同时也是一个 marketplace（`.claude-plugin/marketplace.json`），所以可以直接用 GitHub 地址安装。它**不是**独立运行的程序——需要在 Claude Code 里加载后才会工作。

## 它能做什么

- **自动识别硬件**：从工程自己的文件里取证——Keil 工程、CMSIS Pack、IAR 工程、ESP-IDF `sdkconfig`、CubeMX `.ioc`、构建脚本里的 `-mcpu`——识别器件、内核、厂商、SDK、构建系统、烧录器。**插件里不写死任何芯片型号**，换一颗新芯片不需要改插件。
- **需求驱动的闭环**：把需求文档拆成可验证的原子需求，逐条生成测试，编译、下载到真机，读串口/寄存器判定，失败就定位原因、改代码、再来一轮，直到通过或达到迭代上限。
- **对内 + 对外测试**：对内读被测板自己的日志和寄存器（白盒）；可选接一台外部检测设备，按你给的串口协议读取真实对外状态，如继电器是否真的吸合（黑盒/产测）。
- **跨芯片经验回路**：每次踩坑都记录下来，按"属于哪一层"（芯片 / 系列 / 内核 / 架构 / SDK / 工具链）入库。下次遇到同内核、同架构、同 SDK 的工程——哪怕是别家芯片——会自动带上相关经验。
- **投放即运行**：把需求或资料放进指定文件夹就会被发现；也可以终端常驻无人值守。
- **控制上下文**：编译日志、原始波形交给子代理隔离处理，上下文压缩前自动保存要点，长时间迭代不"失忆"。

## 插件包含哪些组件

| Claude Code 组件类型 | 本插件中的内容 | 作用 |
|---|---|---|
| **Skills** 技能（11 个） | `env-resolver` `requirement-split` `spec-keeper` `test-design` `fixture-protocol-gen` `board-flash` `hw-monitor` `blackbox-feedback` `verify-iterate` `memory-compact` `lesson-loop` | 闭环中每一步的专业知识；Claude 根据任务自动调用 |
| **Subagents** 子代理（4 个） | `build-runner` `hw-verifier` `req-analyst` `lesson-harvester` | 在独立上下文里处理编译日志、真机原始数据、会话记录等大块内容，只把结论交回主对话 |
| **Slash commands** 命令（6 个） | `/embedded-loop:init` `run` `status` `lessons` `harvest` `help` | 你主动触发的入口 |
| **Hooks** 生命周期钩子（5 类） | SessionStart · UserPromptSubmit · PreToolUse(Bash) · Stop · PreCompact | 自动注入上下文与经验、烧录安全拦截、"未通过不许收工"、压缩前保存记忆 |
| **Monitors** 后台监控（2 个） | `hw-serial-monitor` `inbox-watch` | 常驻监听串口日志与需求/资料文件夹 |
| **MCP server**（可选） | `.mcp.json` 中的 `serial` | 让 Claude 交互式读写串口；未安装对应程序时可删除 |

所有 hook 和脚本都是零依赖的 Node.js（`.mjs`），不需要 `npm install`。

## 环境要求

- **Claude Code**（CLI、VS Code 扩展或桌面应用均可）；后台监控（monitors）需要 v2.1.105 及以上
- **Node.js ≥ 18**
- 你的嵌入式工具链本身：如 Keil MDK、GCC 交叉工具链、ESP-IDF 等，以及能在命令行调用的烧录工具
- 操作系统：Windows、WSL、Linux、macOS 均可

## 安装

### 方式一：从 GitHub 安装（推荐）

在 Claude Code 中输入：

```
/plugin marketplace add XK-Peng/claude-plugin-embedded-loop
/plugin install embedded-loop@xk-embedded
```

然后执行 `/reload-plugins` 或重启 Claude Code。输入 `/embedded-loop:help` 能看到说明即表示安装成功。

> 本仓库若为私有仓库，Claude Code 会使用本机的 git 凭据拉取，请确保本机 `git clone` 该仓库能成功。

### 方式二：从本地目录安装

```
/plugin marketplace add D:\path\to\embedded-loop
/plugin install embedded-loop@xk-embedded
```

### 更新 / 卸载

```
/plugin marketplace update xk-embedded
/plugin uninstall embedded-loop@xk-embedded
```

## 快速上手

1. **在你的固件工程根目录**打开 Claude Code。
2. 运行 `/embedded-loop:init`
   - 建立 `requirements/`、资料夹和 `.embedded-loop/` 工作区
   - 从工程文件识别硬件，列出识别结果及每条结论的来源，请你确认
   - 生成编译/烧录命令草稿，请你确认或补全（建议先手动跑通一次）
   - **不会**读需求、**不会**开始编译
3. 把需求写进 `requirements/REQUIREMENT.md`，把 datasheet、`.pack`、原理图放进资料夹。
4. 运行 `/embedded-loop:run`，开始闭环迭代。
5. 随时用 `/embedded-loop:status` 查看进度。

## 命令一览

| 命令 | 说明 |
|---|---|
| `/embedded-loop:init` | 初始化目录、取证识别硬件、生成工具链草稿。可重复运行，不覆盖已有文件 |
| `/embedded-loop:run [需求]` | 读取需求并闭环迭代到真机通过。留空则读 `requirements/REQUIREMENT.md` |
| `/embedded-loop:status` | 当前身份、各需求状态、迭代次数、最近一次编译与验证结果 |
| `/embedded-loop:lessons [all\|show id\|retire id\|stats\|关键词]` | 查看与管理经验库 |
| `/embedded-loop:harvest [会话记录路径]` | 从会话记录中补捞已验证但漏记的经验 |
| `/embedded-loop:help` | 使用说明 |

## 工作流程

```
init ──> 取证识别硬件 ──> 确认身份与工具链 ──> 按身份查找缺失资料
                                   │
run ──> 拆需求 ──> 固化规约 ──┐
                              ▼
        ┌──> 设计测试 ──> 编译下载 ──> 监控真机（对内 / 可选对外）──> 判定
        │                                                             │
        └──────── 失败：查经验 → 定位 → 改代码 ◄──────────────────────┘
                              │ 通过
                              ▼
                  下一条需求 …… 全部完成 ──> 提炼本轮经验入库
```

调用关系的完整说明见 [ARCHITECTURE.md](ARCHITECTURE.md)。

## 三个核心机制

### 1. 取证识别，而不是型号表
`scripts/probe-env.mjs` 只读取标准格式文件中已经写明的信息，每条结论都标注出处：

| 证据来源 | 读取内容 |
|---|---|
| Keil `.uvprojx` / `.uvproj` | `<Device>` `<Vendor>` `<Cpu>` 中的 CPUTYPE、输出目录与文件名 |
| CMSIS Pack `.pack` / `.pdsc` | 器件名、内核、FPU、存储布局、flash 算法、SVD（自动抽取到 `.embedded-loop/cache/`） |
| IAR `.ewp`、CubeMX `.ioc`、ESP-IDF `sdkconfig`、`platformio.ini` | 目标器件 / 板子 |
| CMake / Makefile | `-mcpu`、`-march`、交叉编译器前缀 |
| 文件名 | 启动文件、链接脚本、J-Link / OpenOCD / pyOCD 配置 |

编译与烧录命令按**构建系统**生成（Keil、IAR、CMake、Make、ESP-IDF、Zephyr、PlatformIO、Eclipse CDT），参考 `skills/env-resolver/references/build-systems.md`。

### 2. 跨芯片经验回路
经验库默认位于 `~/.embedded-loop/kb/lessons.jsonl`，所有工程共享。每条经验带适用范围 `scope`：

| scope | 含义 | 例 |
|---|---|---|
| `chip` / `family` | 只属于某颗芯片或某个系列 | 某器件外设标志位的清除顺序 |
| `core` / `arch` | 属于内核或指令集，**换厂商也成立** | ARMv6-M / ARMv8-M Baseline 不支持非对齐访问 |
| `vendor` / `sdk` | 属于厂商库或 SDK 用法 | 某 SDK 初始化函数会覆盖中断优先级 |
| `toolchain` / `buildSystem` | 属于编译器、构建系统、烧录工具 | Keil 命令行退出码 1 仅表示有警告 |

回路：会话开始按当前工程身份检索并注入 → 迭代中每轮记录候选（被排除的假设也记）→ run 结束时提炼入库并自动查重合并 → 用上的经验记 `helped`，被推翻的记 `refuted`，据此排序；反复被推翻的经验自动退役。

### 3. 投放即运行
- **会话内**：`inbox-watch` 监控需求夹与资料夹。资料变化时自动重新识别；需求变化时提示运行 run。Claude Code 关闭期间放入的文件，下次打开也会被报告。
- **无人值守**：终端运行 `node scripts/autorun.mjs <工程目录>`，需求内容变化并静默数秒后，用 `claude -p` 无头运行一轮。同一份需求不会重复触发。可先加 `--dry-run` 演练。

## 配置项

| 配置 | 说明 |
|---|---|
| 环境变量 `EMBEDDED_LOOP_KB` | 经验库目录。同时使用 WSL 与 Windows 时，建议指向同一个共享路径，否则会变成两个互不相通的库 |
| 环境变量 `KEIL_UV4` | Keil `UV4.exe` 的路径，用于生成编译命令草稿 |
| 环境变量 `INBOX_POLL_MS` | inbox 监控轮询间隔，默认 3000 |
| `.embedded-loop/state.json` 中 `maxIterations` | 单条需求的自动迭代上限，默认 5 |
| `.embedded-loop/autorun.json` | autorun 参数：`claudeBin`、`claudeArgs`、`debounceMs` |
| 工程 `.claude/settings.json` 的 `permissions.allow` | 无人值守运行时需放行编译与烧录命令，否则会停在权限确认上 |

## 目录结构

**插件仓库**
```
.claude-plugin/     plugin.json（插件清单）  marketplace.json（marketplace 清单）
skills/             11 个技能，每个目录含 SKILL.md（env-resolver 另含 references/）
agents/             4 个子代理定义
commands/           6 个斜杠命令
hooks/hooks.json    生命周期钩子配置
monitors/           后台监控配置
scripts/            hook 与工具脚本；lib/ 为共享库（state / kb / zip）
templates/          需求、规约、测试用例、板子配置等模板
.mcp.json           可选的串口 MCP server 配置
```

**你的固件工程**（`/embedded-loop:init` 生成）
```
requirements/            需求文档（你来写）
materials/ 或 material/  datasheet、.pack、原理图、LINKS.md（你来放）
.embedded-loop/
├── SPEC.md              精简的工程规约，每次会话自动注入
├── state.json           身份、需求状态、迭代计数（所有组件共享）
├── evidence.json        硬件识别证据
├── boards/              编译/烧录配置
├── tests/               测试用例与结果
├── cache/               从 pack 抽取的 SVD
├── memory/              长期记忆、待提炼经验
└── logs/                编译、烧录、串口日志
```

## 安全设计

- **烧录拦截**：未选定目标板时拒绝烧录命令；整片擦除需要你确认。
- **迭代上限**：达到上限的需求标记为需人工处理，只汇报一次，不会无限烧录。
- **不污染其他项目**：插件启用后会在所有项目中加载，但在未执行 init 的项目里，所有 hook 与监控完全静默，不创建任何文件。
- **身份需确认**：自动识别的结果只是候选，确认后才会被使用，之后的重新识别也不会覆盖已确认的身份。

## 常见问题

**装了插件但命令不出现？** 执行 `/reload-plugins` 或重启 Claude Code；用 `/plugin` 查看插件是否已启用。

**识别不出芯片？** 工程里没有 IDE 工程文件或 pack 时证据不足。可以在 `requirements/REQUIREMENT.md` 的环境一节写明，或直接提供一条能跑通的编译命令与烧录命令。

**提示 MCP server `serial` 启动失败？** 你没有安装 `serial-mcp-server`。不需要交互式串口读写的话，删除 `.mcp.json` 中的 `serial` 一段即可，被动串口监控不受影响。

**只做白盒测试可以吗？** 可以。在需求文档"外部检测设备"一节写"否，仅白盒"，不影响自动迭代。

**Windows 下编译命令路径怎么写？** JSON 里每个反斜杠要写成 `\\`；路径含空格时用 `\"...\"` 包起来。

## 版本与回退

每个版本都是 git 标签，完整记录见 [CHANGELOG.md](CHANGELOG.md)。

```bash
git tag                  # 查看所有版本
git checkout v0.4.0      # 回到某个版本
git checkout master      # 回到最新
```

## 作者与许可

作者：XK-Peng。许可协议见 `plugin.json` 中的 `license` 字段。
