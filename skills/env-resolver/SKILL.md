---
name: env-resolver
description: Establish the project's hardware identity (chip, core, architecture, vendor, SDK, build system, flasher) from evidence in the project files and materials — not from any built-in chip list — then confirm it with the user, locate or fetch the matching documentation, and resolve build/flash commands into a board profile. Use WHENEVER init runs, materials or project files change, the identity is unconfirmed, the toolchain is unresolved, or board commands still contain placeholders.
---

# env-resolver — 从证据确认工程身份，按身份找资料、定工具链

插件里**没有任何芯片表**。身份来自工程自己：`probe-env.mjs` 读标准格式文件取证，你负责判断、补全、确认。

## 1. 取证
运行 `node "${CLAUDE_PLUGIN_ROOT}/scripts/probe-env.mjs"`，再读 `.embedded-loop/evidence.json`。证据来源与可信度（高→低）：
- IDE 工程文件里的目标器件（`.uvprojx <Device>`、`.ewp`、`.ioc`、`sdkconfig CONFIG_IDF_TARGET`）——这是工程**实际在编译**的器件
- CMSIS pack 的 `.pdsc`（`Dname / Dcore / Dfpu / memory / svd`）——权威器件描述
- 构建脚本里的 `-mcpu / -march`、交叉编译器前缀
- 启动文件、链接脚本、SDK 目录名、烧录器配置文件名
- 资料夹里的 datasheet 与需求文档里的描述
多个来源冲突时，以"工程实际编译的目标"为准，并把冲突告诉用户。

## 2. 补全与确认身份
写入 `state.env.identity`：`chip / core / arch / vendor / family / sdk / buildSystem / flasher`。
- `arch` 脚本不填，由你从 pdsc/datasheet/内核手册判断，写成通用写法：如 `ARMv6-M`、`ARMv7E-M`、`ARMv8-M.base`、`ARMv8-M.main`、`Xtensa-LX7`、`RV32IMC`；私有内核直接写内核名。**经验库靠这些值匹配**，同一架构务必写法一致。
- 私有内核、非 ARM、SoC 平台（Cat.1 模组 OpenCPU、Linux SoC 等）同样适用：把能确定的维度填上，不确定的留空，不编造。
- 把身份列给用户确认，确认后置 `identity.confirmed = true`（probe 以后不会覆盖已确认的身份）。

## 3. 按身份找资料
对照 `evidence.json` 的 `materials` 与 `links`，检查是否已有：datasheet、参考手册/用户手册、SDK/固件库文档、原理图、勘误表。
- 缺失的：用网络搜索定位**原厂官方**链接，追加到资料夹 `LINKS.md`（写明文档名、版本、来源），需要下载时先征得用户同意。
- pack 里的 SVD 已由 probe 抽到 `.embedded-loop/cache/`，寄存器核对优先用它。
- 解读寄存器、管脚、时钟时，**只以资料为准**，不凭记忆；资料里查不到的标 `> 💡 待核实`。

## 4. 定工具链
读 `references/build-systems.md`，按 `identity.buildSystem` 取通用命令形态，结合 evidence（工程路径、产物名、烧录器）填 `boards/<name>.json`，去掉 `_draft`。
- 先查经验库有没有同身份的构建/烧录经验：`node "${CLAUDE_PLUGIN_ROOT}/scripts/kb.mjs" query --topic "编译 烧录 下载 toolchain"`。
- 命令必须先手动试跑一次成功，再置 `state.env.toolchainResolved = true`。跑通的非显然命令组合，按 lesson-loop 以 `toolchain`/`buildSystem` scope 入库，下次同构建系统的工程直接受益。
- 识别不出构建方式时，请用户给一条平时能跑通的编译命令和烧录命令，原样填入。
