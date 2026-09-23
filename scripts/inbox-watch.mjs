// 后台 monitor：投放即触发。
// 盯 requirements/ 与资料夹，每一行 stdout 都会作为通知送给 Claude。
//  - 资料新增/变更 → 自动重跑 probe-env（只更新证据与候选身份，已确认身份不被覆盖），再通知
//  - 需求新增/变更 → 通知 Claude 按 /embedded-loop:run 流程处理
// 快照存在 .embedded-loop/inbox-snapshot.json：Claude 关闭期间放进来的文件，下次启动也会被报告。
// 工程未初始化（没有 .embedded-loop/）时只安静等待，不打扰其他项目。
import { existsSync, readdirSync, statSync, readFileSync, writeFileSync } from 'node:fs';
import { join, relative, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { spawnSync } from 'node:child_process';
import { loopDir, readState } from './lib/state.mjs';

const here = dirname(fileURLToPath(import.meta.url));
const root = process.env.CLAUDE_PROJECT_DIR || process.cwd();
const loop = loopDir(root);
const snapFile = join(loop, 'inbox-snapshot.json');
const IGNORE = /(^|[\\/])(README\.md|\.DS_Store|Thumbs\.db|~\$.*|.*\.tmp)$/i;

function scan(dir) {
  const out = {};
  (function walk(d, depth) {
    if (depth > 4) return;
    let ents; try { ents = readdirSync(d, { withFileTypes: true }); } catch { return; }
    for (const e of ents) {
      const p = join(d, e.name);
      if (e.isDirectory()) walk(p, depth + 1);
      else if (!IGNORE.test(p)) { try { const s = statSync(p); out[relative(root, p).split('\\').join('/')] = s.size + ':' + Math.round(s.mtimeMs); } catch {} }
    }
  })(dir, 0);
  return out;
}

function diff(prev, cur) {
  const added = [], changed = [];
  for (const k of Object.keys(cur)) { if (!(k in prev)) added.push(k); else if (prev[k] !== cur[k]) changed.push(k); }
  return { added, changed };
}

function tick() {
  if (!existsSync(loop)) return;                       // 未初始化：什么都不做
  const st = readState(root);
  const reqDir = join(root, st.env.requirementsDir || 'requirements');
  const matDir = join(root, st.env.materialsDir || 'materials');
  const cur = { req: scan(reqDir), mat: scan(matDir) };
  let prev = null;
  try { prev = JSON.parse(readFileSync(snapFile, 'utf8')); } catch {}
  if (!prev) { writeFileSync(snapFile, JSON.stringify(cur)); return; }   // 首次：建立基线，不报

  const m = diff(prev.mat || {}, cur.mat);
  if (m.added.length || m.changed.length) {
    spawnSync(process.execPath, [join(here, 'probe-env.mjs'), root, '--quiet'], { stdio: 'ignore' });
    const id = readState(root).env.identity || {};
    process.stdout.write(`[inbox] 资料${m.added.length ? '新增 ' + m.added.join(', ') : ''}${m.changed.length ? ' 变更 ' + m.changed.join(', ') : ''}。` +
      `已自动重新探测：器件 ${id.chip || '?'} / 内核 ${id.core || '?'}${id.confirmed ? '（身份已确认，未覆盖）' : '（未确认，需 env-resolver 确认）'}。\n`);
  }
  const r = diff(prev.req || {}, cur.req);
  if (r.added.length || r.changed.length) {
    const files = [...r.added, ...r.changed].join(', ');
    process.stdout.write(st.run.active
      ? `[inbox] 需求文档在 run 进行中被修改：${files}。完成当前需求后，重新执行 requirement-split 对比差异，只补拆新增/变化的部分。\n`
      : `[inbox] 需求文档${r.added.length ? '新增' : '变更'}：${files}。请按 /embedded-loop:run 流程处理（先确认身份与工具链，再拆需求）。\n`);
  }
  writeFileSync(snapFile, JSON.stringify(cur));
}

tick();
setInterval(tick, Number(process.env.INBOX_POLL_MS || 3000));
