# 调用关系（谁触发谁、谁读写什么）

## 总览：一切围绕 state.json
`.embedded-loop/state.json` 是中枢。所有 skill / hook / 子 agent 都读写它（经 `scripts/lib/state.mjs`）。没有任何组件靠"记在上下文里"传状态——这是省 token 和可恢复的根。

```
                 你（在工程根运行 Claude Code）
                          │ /embedded-loop:init  /run  /status
                          ▼
            ┌─────────── 命令(commands/) 编排 ───────────┐
            │                                            │
            ▼                                            ▼
   init-scaffold.mjs (建夹+模板+state)         env-resolver ──读──> requirements/REQUIREMENT.md
            │                                            │            materials/*(PDF/网址)
   建 requirements/ materials/ .embedded-loop/           └─写─> boards/<board>.json(编译/烧录命令)
                                                                    state.env.toolchainResolved=true
                          │
                          ▼
   requirement-split ──读 requirements/──> 写 requirements.md + state.requirements[]
       └(复杂时)派子agent req-analyst（隔离探索，只回需求表）
                          │
                          ▼
   spec-keeper ──写──> .embedded-loop/SPEC.md（精简，单一事实来源）
                          │
        ┌─────────────────┴───────────────（每条 REQ 循环）──────────────┐
        ▼                                                               │
   test-design ──写──> tests/<REQ>.md（host / inward / outward 用例）     │
        ▼                                                               │
   board-flash ──读 boards/<board>.json──> 跑编译/烧录                    │
        └派子agent build-runner（隔离编译日志→只回"过没过+关键报错"）        │
        └写 state.lastBuild / lastFlash，日志落 logs/build-*.log          │
        ▼                                                               │
   hw-monitor（对内/inward）──读 DUT 串口/寄存器──> 证据落 logs/serial.log │
        └派子agent hw-verifier（隔离原始波形/长串口→只回少量数字）          │
        ▼                                                               │
   blackbox-feedback（对外/outward，仅当有检测设备）                       │
        └用 fixture driver 现场命令/读检测设备真值（detectors/+protocols/）│
        ▼                                                               │
   verify-iterate ──读 tests/<REQ>.md + 证据──> 判 pass/fail              │
        └写 state.requirements[].result.{inward,outward} / lastVerify     │
        └fail：定位→改源码→回到 board-flash（iterations+1）───────────────┘
        └pass：推进下一条 REQ

   fixture-protocol-gen（一次性/测试项扩展时）──读 protocols/<n>.md + items──> 生成 driver 注入你的 test/fixture/
   memory-compact（上下文长时）──写──> memory/longterm.md
```

## Hooks 何时自动触发（不需你调用）
- **SessionStart**：开/恢复会话 → `session-start.mjs` 读 SPEC.md + state + longterm.md，注入精简上下文。
- **UserPromptSubmit**：每条消息前 → `userprompt-context.mjs` 注入一行当前状态。
- **PreToolUse(Bash)**：执行 Bash 前 → `guard-flash.mjs` 拦烧录（未选板 deny / 整片擦除 ask）。
- **Stop**：Claude 想收工时 → `stop-gate.mjs` 查 state：当前 REQ 未 pass 且未到 maxIterations 就 `block` 顶回继续；到上限转 needs-human。
- **PreCompact**：压缩前 → `precompact-save.mjs` 把要点写进 longterm.md（压缩不失忆）。

## 后台监控（monitors/monitors.json）
`serial-tail.mjs` 整个会话常驻，tail `logs/serial.log`（或直读 COM 口），只把命中信号正则的行作为通知推给 Claude。它喂的是 inward 证据来源之一，被 hw-monitor 使用。

## 输入/输出目录约定
- 输入（你维护）：`requirements/`（需求文档）、`materials/`（资料，文档里指向它）。
- 工作区（框架维护）：`.embedded-loop/`（SPEC/state/tests/boards/detectors/protocols/memory/logs）。
- 你的源码：工程其余部分（src/ 等）——verify-iterate 失败时改的就是这里。

---

## v0.5.0 新增：身份取证 · 经验回路 · 投放触发

```
工程文件 ─probe-env.mjs─> evidence.json + identity(候选) + boards 草稿
                              │ env-resolver：补 arch、确认、按身份找资料(LINKS.md)、定工具链
                              ▼
SessionStart ──kb.match(identity)──> 注入相关经验，记 state.lessons.injected，stats.injected+1
                              │
run 内循环 verify-iterate：先 kb query --topic 症状 → 假设 → 改 → 编译下载验证
                              └─ 每轮 kb pending add（含被排除的假设）→ .embedded-loop/memory/lessons-pending.jsonl
                              │
通过时：用上的注入经验 → kb feedback helped；被推翻 → refuted（≥3 且多于 helped 自动退役）
                              │
Stop hook：全部需求结束后，若有 pending → 顶回一次 → lesson-loop 判定 scope → kb promote（查重合并）→ pending clear
                              ▼
全局经验库 ~/.embedded-loop/kb/lessons.jsonl ──> 下一个身份匹配的工程（可以是别家芯片）
```

投放触发：
- `inbox-watch`（monitor，会话内）：资料变更 → 自动 probe-env（不覆盖已确认身份）→ 通知；需求变更 → 提示走 run。快照机制覆盖"关闭期间放入"。
- `autorun.mjs`（终端常驻，无人值守）：需求内容哈希变化且静默 debounce 后 → `claude -p` 跑一轮；同一内容不重复触发。

未初始化保护：`readState` 不再建目录；所有 hook 以 `isInitialized()` 开头，无关项目中零副作用。
