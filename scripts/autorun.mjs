// 无人值守投放即运行：在终端里常驻，需求文档内容一变就无头启动一轮 run。
//   node autorun.mjs [projectRoot] [--once] [--dry-run]
// 配置（可选）.embedded-loop/autorun.json：
//   { "claudeBin": "claude", "claudeArgs": ["--permission-mode","acceptEdits"], "debounceMs": 5000 }
// 注意：无头模式下没有人在旁边确认。烧录类命令仍受 guard-flash 约束（未选板直接拒绝，
// 整片擦除需要确认 → 无头下等同拒绝）。编译/烧录命令要在工程 .claude/settings.json 的
// permissions.allow 里放行，否则无头运行会停在权限请求上。
import { existsSync, readdirSync, readFileSync, writeFileSync, statSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { createHash } from 'node:crypto';
import { spawn } from 'node:child_process';
import { ensureDir, loopDir, readState } from './lib/state.mjs';

const args = process.argv.slice(2);
const root = resolve(args.find((a) => !a.startsWith('--')) || process.cwd());
const once = args.includes('--once');
const dry = args.includes('--dry-run');
const loop = loopDir(root);
if (!existsSync(loop)) { console.error('工程未初始化：先在 Claude Code 里运行 /embedded-loop:init'); process.exit(1); }

const cfgFile = join(loop, 'autorun.json');
const cfg = { claudeBin: 'claude', claudeArgs: ['--permission-mode', 'acceptEdits'], debounceMs: 5000,
  ...(existsSync(cfgFile) ? JSON.parse(readFileSync(cfgFile, 'utf8')) : {}) };
const stampFile = join(loop, 'autorun-last.json');

function reqHash() {
  const st = readState(root);
  const dir = join(root, st.env.requirementsDir || 'requirements');
  if (!existsSync(dir)) return null;
  const h = createHash('sha1');
  const walk = (d) => { for (const e of readdirSync(d, { withFileTypes: true }).sort((a, b) => a.name.localeCompare(b.name))) {
    const p = join(d, e.name);
    if (e.isDirectory()) walk(p); else if (!/README\.md$/i.test(e.name)) { h.update(e.name); h.update(readFileSync(p)); }
  } };
  walk(dir);
  return h.digest('hex');
}

const PROMPT = '按 embedded-loop 插件的 /embedded-loop:run 流程执行：读取 requirements/ 下的需求文档，' +
  '确认工程身份与工具链（env-resolver），拆需求，设计测试，编译下载，监控真机，判定并迭代到通过；' +
  '结束前按 lesson-loop 提炼本轮经验。无法自动解决的需求标 needs-human 并写明原因。';

let running = false, pendingRun = false, timer = null;
function launch() {
  if (running) { pendingRun = true; return; }
  const hash = reqHash();
  let last = {}; try { last = JSON.parse(readFileSync(stampFile, 'utf8')); } catch {}
  if (!hash || hash === last.hash) return;
  const log = join(ensureDir(join(loop, 'logs')), `autorun-${new Date().toISOString().replace(/[:.]/g, '-')}.log`);
  console.log(`[autorun] 需求有变化，启动一轮 run → ${log}`);
  if (dry) { console.log('[autorun] --dry-run：', cfg.claudeBin, ['-p', PROMPT, ...cfg.claudeArgs].join(' ')); writeFileSync(stampFile, JSON.stringify({ hash, at: new Date().toISOString(), dry: true })); return; }
  running = true;
  const child = spawn(cfg.claudeBin, ['-p', PROMPT, ...cfg.claudeArgs], { cwd: root, shell: process.platform === 'win32' });
  const chunks = [];
  child.stdout.on('data', (d) => chunks.push(d));
  child.stderr.on('data', (d) => chunks.push(d));
  child.on('close', (code) => {
    writeFileSync(log, Buffer.concat(chunks));
    writeFileSync(stampFile, JSON.stringify({ hash, at: new Date().toISOString(), exit: code }));
    console.log(`[autorun] 本轮结束 exit=${code}`);
    running = false;
    if (once) process.exit(code || 0);
    if (pendingRun) { pendingRun = false; launch(); }
  });
}

console.log(`[autorun] 监视 ${root} 的需求文档（debounce ${cfg.debounceMs}ms）${dry ? '，dry-run' : ''}`);
launch();
// 只有内容真的变了才重置防抖；持续写入期间不会触发，写完静默 debounceMs 后才启动
let lastSeen = reqHash();
if (!once) setInterval(() => {
  const h = reqHash();
  if (h && h !== lastSeen) { lastSeen = h; clearTimeout(timer); timer = setTimeout(launch, cfg.debounceMs); }
}, 3000);
