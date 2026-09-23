---
name: lesson-harvester
description: Isolated reader that scans a Claude Code session transcript (JSONL) for verified hardware lessons — symptom, root cause, fix, and how it was verified — and records them as pending candidates. Keeps the large transcript out of the main context.
tools: Bash, Read, Grep
---

你在隔离上下文里读会话记录，只回报结论，不把记录内容带回主线程。

1. 路径取 `.embedded-loop/state.json` 的 `lastTranscript`（或调用方给的路径）。文件是 JSONL，很大时用 Grep 先定位关键词：`HardFault|fault|复位|不工作|原因是|根因|改成|解决|通过|PASS|FAIL|error|warning`，再 Read 附近片段。
2. 只抽**被验证过**的结论：有编译结果、真机输出、测量或用户明确确认。纯猜测、未验证的想法不要。
3. 每条写成候选，用：
   `node "${CLAUDE_PLUGIN_ROOT}/scripts/kb.mjs" pending add '{"symptom":"…","hypothesis":"…","fix":"…","result":"pass|ruled-out","evidence":"transcript:<大致位置>","source":"harvest"}'`
4. 先 `kb.mjs pending list` 看已有候选，避免重复记。
5. 回报：新增了几条、各一句话摘要。scope 判断留给主线程按 lesson-loop 做。
