---
name: requirement-split
description: Decompose a raw, fuzzy firmware/feature request into atomic, verifiable requirements with stable IDs (REQ-001...). Use this skill WHENEVER the user drops in a new feature description, a paragraph of "I want the board to do X", a datasheet behavior, or any goal that is not yet broken into testable units — even if they don't say "split" or "requirements". Always run this before writing code or tests for a new feature.
---

# requirement-split — 把模糊需求拆成可验证的原子需求

## 何时用
用户丢进来一段需求描述、一个功能目标、一段 datasheet 行为，但还没拆成「一条一条能单独测」的单元时。这是整条闭环的入口。

## 输入来源
读工程根 `requirements/` 下的需求文档（通常 REQUIREMENT.md）。文档第 3 节会指明 `materials/` 下的资料（PDF/网址）；需要寄存器/管脚等细节时按指针去读资料（本地 PDF 直接读，网址用 web_fetch）。

## 产物
写入 `.embedded-loop/requirements.md`，并把每条需求登记进 `state.json` 的 `requirements[]`。
模板见 `${CLAUDE_PLUGIN_ROOT}/templates/requirements.template.md`。

## 步骤
1. 读现有 `.embedded-loop/SPEC.md`（若存在），保证新需求与既有规约不冲突。复杂探索可派 `req-analyst` 子 agent，避免污染主上下文。
2. 把原始需求拆成**原子需求**。每条满足 INVEST 中最关键的两点：**独立可测**、**有明确验收信号**。一条需求只描述一个可观测行为。
3. 每条需求用稳定结构：
   - `id`: REQ-001、REQ-002…（一旦分配永不复用、永不改号）
   - `title`: 一句话
   - `behavior`: 期望的可观测行为（硬件层面：管脚电平/时序/串口输出/寄存器值/功耗）
   - `inputs`: 触发条件
   - `accept`: 验收标准（必须可被 hw-monitor 客观判定，禁止"工作正常"这种主观描述）
   - `priority`: P0/P1/P2
   - `deps`: 依赖的其它 REQ
4. 对**嵌入式特有的隐含约束**主动追问或显式标注（不要替用户臆测）：实时性/中断延迟、静态内存约束、ISR 解耦要求、低功耗状态、目标板差异。涉及管脚/寄存器映射的，标注「需人工从原理图核对」而非猜测。
5. 写入 `requirements.md` + 登记 `state.json`（status 全部初始为 `todo`）。
6. 输出一张简表（id / title / priority / 验收信号）让用户确认。确认后再进入 test-design。

## 原则
- 拆分粒度：能在一次「编译→下载→看一个硬件信号」内验证完的，就是合适粒度。
- 不确定的地方留 `> 💡 待核实：xxx`，绝不静默替用户决定 MCU 参数。
