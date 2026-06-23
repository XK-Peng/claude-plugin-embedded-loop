// PreCompact hook —— 在「上下文压缩」(手动 /compact 或自动触发) 发生之前运行。
// 作用：把会不可逆丢失的关键状态固化到 .embedded-loop/memory/longterm.md，
// 这样压缩后 SessionStart 仍能把要点重新注入 —— 实现「压缩但不失忆」。
//
// 注意：本 hook 不阻断压缩（exit 0）。它只负责落盘 + 给 Claude 一条指令，
// 让 Claude 在压缩前把「本轮决策/未决问题/坑」追加进 longterm.md。
import { appendFileSync, existsSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { ensureDir, loopDir, readState, readHookInput } from './lib/state.mjs';

const input = await readHookInput();
const dir = ensureDir(join(loopDir(input.cwd), 'memory'));
const mem = join(dir, 'longterm.md');
if (!existsSync(mem)) writeFileSync(mem, '# 长期记忆（PreCompact 自动维护）\n\n');

const st = readState(input.cwd);
const stamp = new Date().toISOString();
const trigger = input.trigger || 'auto';
appendFileSync(
  mem,
  `\n## ${stamp}（压缩快照 / ${trigger}）\n` +
    `- 板子: ${st.activeBoard || '?'}，当前需求: ${st.currentReq || '?'}\n` +
    `- 各需求状态: ${st.requirements.map((r) => `${r.id}:${r.status}`).join(' ') || '（空）'}\n` +
    `- 最近构建: ${st.lastBuild ? (st.lastBuild.ok ? 'OK' : 'FAIL') : '?'}，最近验证: ${st.lastVerify ? (st.lastVerify.pass ? 'PASS' : 'FAIL') : '?'}\n`
);

// 把「让 Claude 主动补充记忆」作为额外上下文交回，借压缩前最后的机会榨取要点
const payload = {
  hookSpecificOutput: {
    hookEventName: 'PreCompact',
    additionalContext:
      '上下文即将压缩。请用一段话把以下内容追加到 .embedded-loop/memory/longterm.md：' +
      '（1）当前需求尚未解决的根因假设；（2）已排除的方案；' +
      '（3）硬件相关的坑（时序/寄存器/管脚），便于压缩后无损接续。'
  }
};
process.stdout.write(JSON.stringify(payload));
process.exit(0);
