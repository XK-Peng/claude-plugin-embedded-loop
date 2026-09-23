// Stop hook —— Claude 想结束回合时触发。决定"放行"还是"顶回去继续"。
// 顺序：
//  1) run 进行中且还有未完成需求 → 顶回继续（当前需求未过则继续迭代；已过则推进下一条）
//  2) 到迭代上限 → 标 needs-human，只顶回一次要求汇报，之后放行（修复 v0.4.0 的死循环）
//  3) 全部完成后，若本轮 loop 记了待提炼经验 → 顶回一次要求提炼入库（经验回路）
//  4) 其余放行
import { loopDir, readState, writeState, readHookInput, isInitialized } from './lib/state.mjs';
import { readPending } from './lib/kb.mjs';

const input = await readHookInput();
if (!isInitialized(input.cwd)) process.exit(0);   // 未初始化的项目：静默

const st = readState(input.cwd);
const allow = () => process.exit(0);
const block = (reason) => { process.stdout.write(JSON.stringify({ decision: 'block', reason })); process.exit(0); };

if (st.run.active) {
  const open = st.requirements.filter((x) => x.status !== 'pass' && x.status !== 'needs-human');
  const cur = st.requirements.find((x) => x.id === st.currentReq);

  // 当前需求到上限：转人工，汇报一次
  if (cur && cur.status !== 'pass' && cur.status !== 'needs-human' && (cur.iterations || 0) >= st.maxIterations) {
    cur.status = 'needs-human';
    cur.reported = true;
    writeState(st, input.cwd);
    block(`需求 ${cur.id} 已迭代 ${st.maxIterations} 次仍未通过，已标记 needs-human。` +
      `请汇总每轮的失败证据与最可能根因，并把每轮"假设→改动→结果"用 kb.mjs pending add 记下（失败的排除路径同样是经验）。` +
      `然后继续处理其余需求，或向用户报告。`);
  }

  const next = open.find((x) => x.id !== st.currentReq) || open[0];
  if (cur && cur.status !== 'pass' && cur.status !== 'needs-human') {
    block(`需求 ${cur.id}（${cur.title}）状态 "${cur.status}"，尚未在真机上通过（${cur.iterations || 0}/${st.maxIterations}）。` +
      `继续：board-flash → hw-monitor →（有检测设备则 blackbox-feedback）→ verify-iterate，每轮 iterations+1。`);
  }
  if (next) {
    block(`需求 ${st.currentReq || '-'} 已结束，但还有未完成需求：${open.map((x) => x.id).join(', ')}。` +
      `把 currentReq 设为 ${next.id} 继续闭环。`);
  }
  // 全部完成（pass 或 needs-human）
  st.run.active = false;
  writeState(st, input.cwd);
}

// 经验回路：本工程有未提炼的候选 → 只提醒一次
const pending = readPending(loopDir(input.cwd));
if (pending.length && st.lessons.distillRequestedFor !== pending.length) {
  st.lessons.distillRequestedFor = pending.length;
  writeState(st, input.cwd);
  block(`本轮 loop 记下了 ${pending.length} 条待提炼经验（kb.mjs pending list 查看）。` +
    `按 lesson-loop 技能提炼：判断每条属于哪一层（chip/family/core/arch/vendor/sdk/toolchain），` +
    `用 kb.mjs promote 入库；对本次注入且确实用上的经验执行 kb.mjs feedback <id> helped，被证伪的执行 refuted；` +
    `最后 kb.mjs pending clear。不值得入库的可以直接丢弃。`);
}
allow();
