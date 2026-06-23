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
  schema: 2,
  project: '',
  // 从需求文档解析出的工程环境（env-resolver 技能填写）
  env: {
    chip: null,                 // 如 "TLSR8208D" / "STM32F103C8T6"
    os: null,                   // 如 "Windows" / "Linux" / "macOS"
    ide: null,                  // 如 "Keil MDK" / "STM32CubeIDE" / "Telink IDE" ...
    requirementsDir: 'requirements', // 需求文档夹（工程根下,你写需求的地方）
    materialsDir: 'materials',  // 需求资料夹（datasheet PDF/原理图/网址清单…）
    docsDir: null,              // 兼容旧字段:资料目录(默认同 materialsDir)
    toolchainResolved: false    // 工具链是否已解析并写入 board profile
  },
  activeBoard: null,            // boards/<name>.json 里的 name（被测件 DUT）
  // 对外检测设备（黑盒/产测）。可为 null = 仅做对内白盒测试
  detector: null,               // { name, port, baud, protocolRef, lang, items: [] }
  currentReq: null,             // 当前正在迭代的需求 id，如 "REQ-003"
  maxIterations: 5,             // 单个需求允许的自动迭代上限（防死循环 / 防烧录损耗）
  requirements: [],             // [{ id, title, status, iterations, result }]
  // status: "todo" | "in-progress" | "built" | "flashed" | "pass" | "fail" | "needs-human"
  // result: { inward: "pass"|"fail"|null, outward: "pass"|"fail"|null }
  run: { active: false, startedAt: null },
  lastBuild: null,              // { board, ok, at, logRef }
  lastFlash: null,              // { board, ok, at }
  lastVerify: null,             // { req, inwardPass, outwardPass, pass, at, evidenceRef }
  updatedAt: null
};

export function readState(cwdHint) {
  const dir = ensureDir(loopDir(cwdHint));
  const f = join(dir, 'state.json');
  if (!existsSync(f)) {
    const s = structuredClone(DEFAULT_STATE);
    s.updatedAt = new Date().toISOString();
    writeFileSync(f, JSON.stringify(s, null, 2));
    return s;
  }
  try {
    return { ...structuredClone(DEFAULT_STATE), ...JSON.parse(readFileSync(f, 'utf8')) };
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
