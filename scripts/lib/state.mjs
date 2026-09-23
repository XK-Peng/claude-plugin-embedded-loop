// embedded-loop / scripts/lib/state.mjs
// 工程状态的"单一事实来源"。所有 skill / hook / 子 agent 都读写这个文件，
// 而不是把状态塞进对话上下文 —— 这是整套框架省 token 的核心。
//
// 状态文件落在每个工程的 .embedded-loop/state.json
// 路径解析顺序：环境变量 EMBEDDED_LOOP_DIR > $CLAUDE_PROJECT_DIR/.embedded-loop > $cwd/.embedded-loop
//
// 纯 Node.js，无任何第三方依赖，Windows(cmd.exe)/macOS/Linux 通用。

import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { join, resolve } from 'node:path';

export function loopDir(cwdHint) {
  if (process.env.EMBEDDED_LOOP_DIR) return resolve(process.env.EMBEDDED_LOOP_DIR);
  const base = process.env.CLAUDE_PROJECT_DIR || cwdHint || process.cwd();
  return join(resolve(base), '.embedded-loop');
}

export function ensureDir(dir) {
  if (!existsSync(dir)) mkdirSync(dir, { recursive: true });
  return dir;
}

const DEFAULT_STATE = {
  schema: 3,
  project: '',
  env: {
    // 身份由 probe-env.mjs 从工程文件格式里取证、env-resolver 确认。插件内不写死任何型号。
    identity: null,             // { chip, core, arch, vendor, family, sdk, buildSystem, flasher, sources, confirmed }
    chip: null,                 // 兼容字段 = identity.chip
    os: null,
    ide: null,
    requirementsDir: 'requirements',
    materialsDir: 'materials',
    docsDir: null,
    toolchainResolved: false
  },
  activeBoard: null,
  detector: null,               // 外部检测设备（黑盒/产测），null = 仅白盒
  currentReq: null,
  maxIterations: 5,
  requirements: [],             // [{ id, title, status, iterations, result:{inward,outward} }]
  run: { active: false, startedAt: null },
  // 经验回路：本会话注入了哪些经验、提炼请求是否已发出
  lessons: { injected: [], distillRequestedFor: null },
  lastTranscript: null,         // 最近会话记录路径（harvest 用）
  lastBuild: null,
  lastFlash: null,
  lastVerify: null,
  updatedAt: null
};

// 工程是否已被 /embedded-loop:init 初始化。hook 与 monitor 在未初始化的项目里必须静默，
// 不能创建任何文件（插件装上后会在所有项目里运行）。
export function isInitialized(cwdHint) {
  return existsSync(loopDir(cwdHint));
}

// 只读：文件不存在时返回默认值，不落盘（v0.4.0 这里会顺手建目录，导致无关项目被污染）
export function readState(cwdHint) {
  const f = join(loopDir(cwdHint), 'state.json');
  if (!existsSync(f)) return structuredClone(DEFAULT_STATE);
  try {
    const d = structuredClone(DEFAULT_STATE);
    const j = JSON.parse(readFileSync(f, 'utf8'));
    return { ...d, ...j, env: { ...d.env, ...(j.env || {}) }, lessons: { ...d.lessons, ...(j.lessons || {}) }, run: { ...d.run, ...(j.run || {}) } };
  } catch {
    return structuredClone(DEFAULT_STATE);
  }
}

export function writeState(state, cwdHint) {
  const dir = ensureDir(loopDir(cwdHint));
  state.updatedAt = new Date().toISOString();
  writeFileSync(join(dir, 'state.json'), JSON.stringify(state, null, 2));
  return state;
}

export function getReq(state, id) {
  return state.requirements.find((r) => r.id === id) || null;
}

// 从 stdin 读取 hook 的 JSON 信封（session_id / transcript_path / cwd / hook_event_name ...）
export async function readHookInput() {
  const chunks = [];
  for await (const c of process.stdin) chunks.push(c);
  const raw = Buffer.concat(chunks).toString('utf8').trim();
  if (!raw) return {};
  try { return JSON.parse(raw); } catch { return {}; }
}
