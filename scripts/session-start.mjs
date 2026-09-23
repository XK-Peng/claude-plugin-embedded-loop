// SessionStart hook —— stdout 会被注入为对话上下文。
// 目标：每次开新会话/恢复时，让 agent 立刻拿到「精简规约 + 当前进度」，
// 而不是去重新读一大堆 requirements/tests 文件，从源头控制 token。
import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { loopDir, readState, writeState, readHookInput, isInitialized } from './lib/state.mjs';
import { match, oneLine, feedback } from './lib/kb.mjs';

const input = await readHookInput();
if (!isInitialized(input.cwd)) process.exit(0);   // 未初始化的项目：静默


const dir = loopDir();
const out = [];

const specPath = join(dir, 'SPEC.md');
if (existsSync(specPath)) {
  out.push('# 工程规约（SPEC.md，单一事实来源）');
  out.push(readFileSync(specPath, 'utf8').trim());
} else {
  out.push('（尚未初始化 .embedded-loop/SPEC.md —— 运行 /embedded-loop:init 开始。）');
}

const st = readState(input.cwd);
if (input.transcript_path) st.lastTranscript = input.transcript_path;
const id = st.env.identity;
if (id && (id.chip || id.core)) {
  out.push('\n# 工程身份（probe-env 取证' + (id.confirmed ? '，已确认' : '，未确认——需 env-resolver 确认') + '）');
  out.push(`- 器件 ${id.chip || '?'} | 内核 ${id.core || '?'} | 架构 ${id.arch || '?'} | 厂商 ${id.vendor || '?'} | SDK ${id.sdk || '?'} | 构建 ${id.buildSystem || '?'} | 烧录 ${id.flasher || '?'}`);
  out.push(`- 工具链已确认: ${st.env.toolchainResolved ? '是' : '否'}；资料夹: ${st.env.materialsDir}/`);
}

// 经验回路：按当前身份检索经验库，注入最相关的若干条，并记下注入了哪些（供之后判断是否帮上忙）
const hits = id ? match(id, { limit: 10 }) : [];
if (hits.length) {
  out.push('\n# 相关经验（经验库按当前身份检索；用上了要回馈 helped，被证伪回馈 refuted）');
  hits.forEach((h) => out.push('- ' + oneLine(h.lesson)));
  const ids = hits.map((h) => h.lesson.id);
  st.lessons.injected = ids;
  feedback(ids, 'injected');
} else {
  st.lessons.injected = [];
}
writeState(st, input.cwd);
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
