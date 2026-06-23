// Stop hook —— Claude 想结束回合时触发。
// 作用：只要存在「正在进行的 run」且当前需求还没在真机上通过，就用
// {"decision":"block"} 把它顶回去继续迭代 —— 实现「迭代到硬件确实满足为止」。
//
// 安全闸：iterations 达到 maxIterations 或状态为 needs-human 时放行，
// 避免无限循环、避免无意义地反复烧录消耗 flash 寿命。
import { loopDir, readState, readHookInput } from './lib/state.mjs';

const input = await readHookInput();
const st = readState(input.cwd);

function allow() { process.exit(0); }                       // 不输出 = 允许停止
function block(reason) {
  process.stdout.write(JSON.stringify({ decision: 'block', reason }));
  process.exit(0);
}

if (!st.run.active || !st.currentReq) allow();

const r = st.requirements.find((x) => x.id === st.currentReq);
if (!r) allow();

if (r.status === 'pass') allow();
if (r.status === 'needs-human') {
  block(`需求 ${r.id} 已标记 needs-human（自动迭代无法解决）。请向用户报告当前阻塞点与证据，` +
        `而不是静默结束。报告后可由用户决定下一步。`);
}
if ((r.iterations || 0) >= st.maxIterations) {
  block(`需求 ${r.id} 已达到自动迭代上限 ${st.maxIterations} 次仍未通过。` +
        `请：1) 汇总每次迭代的失败证据；2) 给出最可能的根因；3) 把该需求状态改为 needs-human；` +
        `然后再结束。`);
}

// 还没通过、也没到上限 —— 顶回去继续走「编译→下载→监控→验证」闭环
block(`需求 ${r.id}（${r.title}）当前状态为 "${r.status}"，尚未在真机上验证通过。` +
      `请继续闭环：board-flash 编译下载 → hw-monitor 采集真机输出 → verify-iterate 判定。` +
      `每完成一轮，把 iterations 写回 state.json。当前 ${r.iterations || 0}/${st.maxIterations}。`);
