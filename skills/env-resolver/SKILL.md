---
name: env-resolver
description: Read the user's requirement document and extract the target chip/MCU, operating system, IDE/toolchain, and the docs/SDK folder, then resolve the exact compile and flash/download commands for that combination and write them into a board profile. Use this skill WHENEVER a new requirement doc arrives, the user names a chip/IDE/OS, the toolchain is unresolved, or board-flash has no real commands yet. Never hardcode the toolchain into the plugin — always resolve per project and confirm with the user before trusting a command.
---

# env-resolver — 从需求文档解析芯片/OS/IDE → 工具链 → 板子 profile

## 何时用
新需求文档进来、或用户提到芯片/IDE/OS、或 `state.env.toolchainResolved=false`、或 board-flash 还没有真实编译/烧录命令时。这是"自动找到对应硬件编译/下载指令"的入口。

## 两种模式
- **init 模式（项目扫描，不读需求）**：`/init` 已先跑 `scripts/detect-env.mjs`，从工程已有文件（DFP 包、`*_Library`/`*_DFP`、`.uvprojx`、jlink）推断芯片/厂商/IDE/烧录器并生成 board 草稿。本技能在此只负责把草稿里的占位命令**列给用户确认/补全**，不读需求、不迭代。
- **run 模式（结合需求文档）**：`/run` 时若工具链仍未确认，结合 `requirements/` 的需求文档把 chip/os/ide 与编译/烧录命令补全确认。

## 怎么做
0. **定位输入夹**：需求文档在工程根 `requirements/`，资料在 `materials/`（路径记于 `state.env.requirementsDir/materialsDir`）。读 `requirements/` 下的需求文档(通常 REQUIREMENT.md)。
1. **从需求文档抽取环境四要素**（用户在文档第 2 节写明，缺则问）：
   - `chip`：MCU 型号（如 STM32F103C8T6 / TLSR8208D / nRF52840 / ESP32-C3）
   - `os`：Windows / Linux / macOS（影响串口命名 COMx vs /dev/tty*、路径分隔符、shell）
   - `ide`：Keil MDK / STM32CubeIDE / Telink IDE / IAR / ESP-IDF / Zephyr-west / Arduino …
   - 已有可编译工程路径（如 Keil 的 `.uvprojx`）—— 用来直接拿编译/烧录命令。
   抽取后写入 `state.env`。
2. **读资料**：需求文档第 3 节会指明 `materials/` 下的资料（PDF/网址/原理图）。解读寄存器/管脚时**先读这些资料**：本地 PDF 直接读；网址用 web_fetch 抓。`docsDir` 默认指向 `materials/`。
3. **解析工具链**：读 `references/toolchains.md`，按 `chip + ide + os` 匹配出**编译命令**与**烧录命令**模板，标出占位符。
4. **落到 board profile**：写进 `.embedded-loop/boards/<name>.json` 的 `build.command` / `flash.command` / `monitor.port`，据 OS 选串口格式。
5. **必须人工确认**：把命令列给用户核对（安装路径、工程名、SWD/SWS/DFU、起始地址）。确认后置 `state.env.toolchainResolved=true`。
6. 解析完成后，后续 board-flash 直接用这套命令。

## 资料目录的用途
`docsDir` 一旦确定,解读寄存器位、管脚映射、外设时序时**先去读该目录下的 datasheet/SDK**,而不是凭记忆。管脚/寄存器映射涉及硬件正确性的,标 `> 💡 待核实` 让用户对原理图确认。

## 关键参考
- 工具链命令模板:见 `references/toolchains.md`（覆盖 Telink/STM32/nRF/ESP32/Keil/IAR/Arduino 等常见组合）。
- 表里没有的芯片/IDE:让用户直接给一条他平时能跑通的编译命令和烧录命令,原样填进 profile 即可。
