// UserPromptSubmit hook —— 每次用户发消息前，注入「一行」当前状态。
// 刻意只输出一行，避免每轮都膨胀上下文；没有进行中的 run 时不输出任何东西。
import { readState, readHookInput } from './lib/state.mjs';

const input = await readHookInput();
const st = readState(input.cwd);

if (!st.run.active || !st.currentReq) process.exit(0);
const r = st.requirements.find((x) => x.id === st.currentReq);
const line = `[embedded-loop] 板=${st.activeBoard || '?'} 需求=${st.currentReq}` +
  `${r ? `(${r.status} ${r.iterations}/${st.maxIterations})` : ''}`;

process.stdout.write(JSON.stringify({
  hookSpecificOutput: { hookEventName: 'UserPromptSubmit', additionalContext: line }
}));
process.exit(0);
