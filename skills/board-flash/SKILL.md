---
name: board-flash
description: Compile and flash firmware to a specific target board by reading its profile from .embedded-loop/boards/<name>.json (build command, flash command, serial port, defines). Use this skill WHENEVER the user wants to build, compile, download, flash, or burn firmware, switch target boards, or when the loop needs to deploy before hardware verification. Always select/confirm the active board first; never guess the toolchain invocation.
---

# board-flash — 按板子 profile 自动编译 + 下载

## 何时用
需要编译、下载、烧录、切板子时；或闭环里验证前需要把固件部署到真机时。

## 板子 profile（templates/board.template.json → .embedded-loop/boards/<name>.json）
每块板子一个 JSON，**编译/烧录命令由用户填**（不同工具链差异大，绝不臆测）。字段：
```json
{
  "name": "tlsr8208d-evk",
  "mcu": "TLSR8208D",
  "package": "SOP16",
  "defines": ["BOARD_TLSR8208D=1"],
  "build":  { "command": "<在此填你的编译命令，输出 .bin>", "artifact": "build/app.bin", "cwd": "." },
  "flash":  { "command": "<在此填你的烧录命令，对 ${ARTIFACT} 烧录>" },
  "monitor":{ "port": "COM5", "baud": 115200 },
  "host_test": { "command": "<主机侧单元测试的编译+运行命令, 可选>" }
}
```
> Telink TLSR82xx 提示：编译器通常是 `tc32`（Telink 定制 GCC）产出 `.bin`；烧录常经 BDT/SWS 单线接口。把你本机实际用的命令原样填进 `build.command` / `flash.command` 即可。

## 步骤
1. 确认/选择 `activeBoard`，写入 `state.json`。（未选板时 PreToolUse 钩子会拦下烧录命令。）
2. 跑 `build.command`。**构建建议交给 `build-runner` 子 agent**：把冗长的编译日志隔离在子上下文里，只回报「成功/失败 + 失败的关键报错」，主上下文不被日志淹没。日志全文落 `.embedded-loop/logs/build-<时间戳>.log`。
3. 构建成功 → 跑 `flash.command`（artifact 路径用 build 产物）。失败则把 `state.lastBuild.ok=false` 并把首要报错交给 verify-iterate 进入修复迭代。
4. 写回 `state.lastBuild` / `state.lastFlash`，把当前 REQ 状态推进到 `built`/`flashed`。
5. 烧录成功后，确保真机串口输出在被监控：要么后台 monitor 已在 tail `logs/serial.log`，要么提示用户把串口重定向到该文件 / 用 serial MCP 打开端口。

## 切板子
切换 `activeBoard` 后，defines/port 随 profile 改变；同一套 REQ/测试可在多块板上分别跑，结果按 board 分别记录在 state。
