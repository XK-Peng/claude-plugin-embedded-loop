// SessionStart hook —— stdout 会被注入为对话上下文。
// 目标：每次开新会话/恢复时，让 agent 立刻拿到「精简规约 + 当前进度」，
// 而不是去重新读一大堆 requirements/tests 文件，从源头控制 token。
import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { loopDir, readState } from './lib/state.mjs';

const dir = loopDir();
const out = [];

const specPath = join(dir, 'SPEC.md');
if (existsSync(specPath)) {
  out.push('# 工程规约（SPEC.md，单一事实来源）');
  out.push(readFileSync(specPath, 'utf8').trim());
} else {
  out.push('（尚未初始化 .embedded-loop/SPEC.md —— 运行 /embedded-loop:init 开始。）');
}

const st = readState();
if (st.env && st.env.chip) {
  out.push('\n# 工程环境（env）');
  out.push(`- 芯片: ${st.env.chip} | OS: ${st.env.os || '?'} | IDE: ${st.env.ide || '?'} | 资料: ${st.env.docsDir || '?'}`);
  out.push(`- 工具链已解析: ${st.env.toolchainResolved ? '是' : '否（需运行 env-resolver）'}`);
}
if (st.detector) {
  out.push(`- 检测设备(黑盒): ${st.detector.name || '?'} @ ${st.detector.port || '?'}，协议: ${st.detector.protocolRef || '?'}`);
}
if (st.run.active || st.currentReq) {
  const r = st.requirements.find((x) => x.id === st.currentReq);
  out.push('\n# 当前进度（state.json）');
  out.push(`- DUT 板子: ${st.activeBoard || '未选择'}`);
  out.push(`- 当前需求: ${st.currentReq || '无'}${r ? `（${r.title} / ${r.status} / 已迭代 ${r.iterations}/${st.maxIterations}）` : ''}`);
  if (r && r.result) out.push(`  内测: ${r.result.inward || '-'} | 外测: ${r.result.outward || '-'}`);
  const todo = st.requirements.filter((x) => x.status !== 'pass').map((x) => x.id);
  if (todo.length) out.push(`- 未通过需求: ${todo.join(', ')}`);
}

const mem = join(dir, 'memory', 'longterm.md');
if (existsSync(mem)) {
  out.push('\n# 长期记忆要点（详情见 .embedded-loop/memory/longterm.md）');
  // 只注入前 40 行，避免膨胀；需要细节让 agent 自己去读文件
  out.push(readFileSync(mem, 'utf8').split('\n').slice(0, 40).join('\n').trim());
}

process.stdout.write(out.join('\n') + '\n');
process.exit(0);
