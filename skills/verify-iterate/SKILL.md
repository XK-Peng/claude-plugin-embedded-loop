---
name: verify-iterate
description: Judge a requirement's test cases against real hardware evidence (pass/fail via each test's oracle), record the verdict in state.json, and drive the next iteration — diagnose the failure, propose a fix, rebuild/reflash, and re-verify — until the board genuinely satisfies the requirement or the iteration cap is hit. Use this skill WHENEVER hardware results come back, a test needs judging, or the loop must decide whether to iterate again.
---

# verify-iterate — 判定 + 驱动迭代闭环

## 何时用
hw-monitor 给回真机证据后；需要判 pass/fail；需要决定「再迭代一轮还是收工」时。这是闭环的判定与推进器。

## 判定（内 + 外,两边都过才算过）
1. 取当前 REQ 的全部测试用例（`.embedded-loop/tests/<REQ>.md`）,按 `channel` 分组:
   - host / inward 用例 → 证据来自 hw-monitor（DUT 自身串口/寄存器）。
   - outward 用例 → 证据来自 blackbox-feedback（外部检测设备现场读的真值）。
2. 对每条用例用其 `oracle`（正则 / 数值阈值 / 基线比对）判定 observed vs expected。
3. 写回 `state.requirements[].result = { inward, outward }`,两类分别记 pass/fail,**都保留**。
4. **只有 inward 与 outward(若该 REQ 有 outward 用例)都通过**,REQ 才记 `pass`;任一不过 → `fail`,记录失败用例 + 证据 ref 到 `state.lastVerify`。
   若 `state.detector` 为 null,或该 REQ 没有 outward 用例(需求文档写明"仅白盒"),则**只按 inward 判定**,outward 记 null,不影响 pass 与自动迭代。

## 迭代（fail 时）
0. **先查经验**：`node "${CLAUDE_PLUGIN_ROOT}/scripts/kb.mjs" query --topic "<症状关键词>"`。同身份（同芯片/同内核/同 SDK/同构建系统）以前踩过的坑会被召回，先对照再假设。
1. **定位**：用失败证据（测试打点 / 波形指标 / fault 寄存器）形成单一最可能根因假设。host 能复现的先在主机复现，别浪费烧录。
2. **改**：遵守 SPEC 架构铁律改代码（HAL/BSP 分层、静态内存、ISR 解耦…）。涉及管脚/寄存器映射的改动需对照原理图/datasheet，不臆测。
3. **回闭环**：board-flash 重新编译下载 → hw-monitor 重采 → 回到本技能再判。
4. **计数**：每完成一轮 `iterations += 1` 写回 state。
5. **记一笔**（经验回路，一行命令）：`kb.mjs pending add '{"symptom":"…","hypothesis":"…","fix":"…","result":"pass|fail|ruled-out","evidence":"logs/…"}'`。被排除的假设也记，它能帮下一次少走弯路。

## 通过时
- 对 `state.lessons.injected` 中这次确实用上的经验执行 `kb.mjs feedback <id> helped`；被证据推翻的执行 `refuted`。
- 提炼入库在 run 结束时由 Stop hook 提醒，按 **lesson-loop** 技能做。

## 收敛与刹车（防死循环 / 防烧录损耗）
- `pass`：把 REQ 标 `pass`，推进到下一条未完成 REQ；全部 pass 则结束 run。
- 达到 `maxIterations` 仍不过：汇总每轮失败证据 + 根因，把状态置 `needs-human`，向用户报告，**不要**再盲目迭代。
- Stop hook 会据此放行或顶回：只要还有未通过且未到上限的 REQ，回合不会被允许结束。

## 记录
每轮把「假设 → 改动 → 结果」一行追加到 `.embedded-loop/memory/longterm.md`，使压缩后仍可无损接续，也避免重复踩同一个坑。
