---
description: 查看/管理经验库：当前工程会命中哪些经验、全部经验、退役某条
argument-hint: 可选：all | show <id> | retire <id> | stats | 关键词
---

根据 $ARGUMENTS 运行 `node "${CLAUDE_PLUGIN_ROOT}/scripts/kb.mjs"`：
- 空 → `query`（当前工程身份会命中的经验）+ `stats`
- `all` → `list --all`；`show <id>` / `retire <id>` / `stats` 原样转发
- 其他文字 → `query --topic "<文字>"`
把结果原样给用户，不加解读，除非用户追问。
