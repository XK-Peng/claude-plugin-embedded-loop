---
name: lesson-loop
description: Capture, scope, and feed back hardware lessons learned during the embedded loop, so future sessions on ANY chip sharing the same core, architecture, SDK or toolchain start with the right pitfalls. Use WHENEVER a fail→fix iteration resolves (or rules out) a hypothesis, when the Stop hook asks to distill pending lessons, when an injected lesson turned out useful or wrong, or when the user says a problem is solved and wants it remembered. Never keyed by a hardcoded chip list — scope comes from the current session's identity and the model's judgment of which layer the lesson belongs to.
---

# lesson-loop — 从 loop 里长出来的踩坑经验，按"适用范围"回馈给下一次 loop

所有操作都通过 `node "${CLAUDE_PLUGIN_ROOT}/scripts/kb.mjs" …` 完成，不手改文件。
经验库是**全局的**（默认 `~/.embedded-loop/kb/`，环境变量 `EMBEDDED_LOOP_KB` 可改），跨工程共享。

## 回路四步
1. **注入**（自动）：SessionStart 按当前工程身份检索，注入最相关的 ≤10 条，并把 id 记进 `state.lessons.injected`。
2. **记录**（loop 中随手）：verify-iterate 每结束一轮"假设→改动→结果"，都记一条候选，**失败被排除的路径同样要记**：
   `kb.mjs pending add '{"symptom":"…","hypothesis":"…","fix":"…","result":"pass|fail|ruled-out","evidence":"logs/…"}'`
   Windows cmd 引号麻烦时：写入临时文件后 `kb.mjs pending add --file tmp.json`。
3. **提炼**（run 结束，Stop hook 会提醒一次）：`kb.mjs pending list` → 合并同一问题的多轮记录 → 只保留经过真机验证的结论 → `kb.mjs promote <json>` 入库 → `kb.mjs pending clear`。
4. **回馈**：对 `state.lessons.injected` 里的每条，判断这次是否真的用上：
   - 按它做了且问题解决 → `kb.mjs feedback <id> helped`
   - 证据表明它不适用或是错的 → `kb.mjs feedback <id> refuted`（累计推翻多于帮助且 ≥3 次自动退役）
   - 没涉及 → 不回馈

## 最关键的判断：scope 定在哪一层
scope 决定这条经验以后会在哪些工程里被召回。**只填必要的维度，定到"成立的最宽一层"**，但不能超出证据：

| 维度 | 何时用 | 例 |
|---|---|---|
| `chip` | 只属于这颗芯片：外设寄存器、时钟树、勘误、引脚复用 | 某器件 ADC 需先校准再使能 |
| `family` | 同系列共享的外设实现 | 同系列 USART 的 IDLE 标志清除顺序 |
| `core` / `arch` | 属于内核/指令集，**换厂商也成立** | ARMv6-M/ARMv8-M Baseline 不支持非对齐访问 → HardFault |
| `vendor` / `sdk` | 厂商库/SDK 的用法与坑 | 某 SDK 的初始化函数会覆盖用户中断优先级 |
| `toolchain` / `buildSystem` | 编译器、链接、构建系统、烧录工具 | Keil 命令行 `-b` 退出码 1 仅表示有警告 |

判断方法：问"把这颗芯片换成**同内核别家**的，这个坑还在吗？"在 → 往 core/arch 放；不在 → 再问"换成**同厂商别系列**还在吗？"在 → vendor/sdk；否则 chip/family。
值要写成**能前缀匹配**的形式：`"chip":"GD32E230"` 会命中 `GD32E230C8T6`；`"arch":"ARMv8-M.base"` 需与身份里的 arch 写法一致，拿不准时 `kb.mjs query --json` 看当前身份的写法。
arch 是多值时用数组：`"arch":["ARMv6-M","ARMv8-M.base"]`（任一命中即算）。

## 入库格式
```json
{"kind":"pitfall","scope":{"arch":["ARMv6-M","ARMv8-M.base"]},
 "symptom":"结构体强转后读 uint32 字段进 HardFault",
 "cause":"Baseline 指令集不支持非对齐访问，packed 结构体字段地址非 4 字节对齐",
 "fix":"逐字节 memcpy 或去掉 packed 并调整字段顺序",
 "verify":"HardFault 消失，串口 [TEST] 用例通过",
 "topics":["hardfault","packed","对齐"],"evidence":["IRAD_RKC REQ-003 iter2"]}
```
kind：`pitfall`（坑）/ `fix`（固定解法）/ `toolchain`（构建烧录经验）/ `constraint`（硬约束）。

## 不入库的
- 只在这个项目的业务代码里成立的事（写进工程的 SPEC.md 或 longterm.md 即可）
- 没有经过真机或编译器验证的猜测
- 对插件本身的改进建议 —— 交给插件自我完善流程（如 embedded-loop-evolve 技能/LESSONS 台账），不混进硬件经验库

## 会话记录补捞
loop 过程中漏记的，用 `/embedded-loop:harvest`：派 lesson-harvester 子 agent 读 `state.lastTranscript` 指向的会话记录，只抽"已验证的症状→原因→做法"写成 pending，再按第 3 步提炼。
