---
description: 初始化：建目录结构 + 从工程文件取证识别芯片/内核/构建系统 + 生成工具链草稿。不读需求、不开始迭代。
---

**只做初始化与环境准备，不读需求文档、不开始编译或迭代。**

1. 建脚手架：`node "${CLAUDE_PLUGIN_ROOT}/scripts/init-scaffold.mjs"`（已存在的文件不覆盖，可重复运行；已有 `material/` 单数资料夹则沿用）。
2. 取证识别：`node "${CLAUDE_PLUGIN_ROOT}/scripts/probe-env.mjs"`。它不认识任何型号，只读 IDE 工程、CMSIS pack、构建脚本等标准格式，生成 `evidence.json`、候选身份和 board 草稿。把输出原样转达用户。
3. 调用 **env-resolver**：补全 `arch`，把候选身份给用户确认；检查资料是否齐全，缺的按身份找原厂链接记到资料夹 `LINKS.md`；把 board 草稿里的占位命令确认或补全，能试跑就试跑一次。
4. 运行 `node "${CLAUDE_PLUGIN_ROOT}/scripts/kb.mjs" query`，告诉用户经验库里已有几条与本工程身份相关的经验（没有就说是新身份）。
5. 结束，给出下一步：
   - 把需求写进 `requirements/REQUIREMENT.md`（环境一节可不写），资料放进资料夹。
   - 会话内：放入/修改需求后，后台 inbox 监控会提示你运行 `/embedded-loop:run`。
   - 无人值守：终端里 `node "<插件目录>/scripts/autorun.mjs"`，需求一变就自动跑一轮。
   - 用法见 `/embedded-loop:help`。
