// 经验库（跨工程、全局）。经验不按芯片分目录，而是每条带 scope（适用范围），
// 检索时用当前工程的身份去匹配。scope 由 loop 中的模型按"这个坑属于哪一层"来定：
//   chip   —— 只属于这颗芯片（外设寄存器、时钟树、勘误）
//   family —— 同系列通用
//   core / arch —— 属于内核或指令集（如 Baseline 不支持非对齐访问）→ 换厂商也适用
//   vendor / sdk —— 属于厂商库/SDK 用法
//   toolchain / buildSystem —— 属于编译器、构建系统、烧录工具
// 反馈：injected / helped / refuted 三个计数决定排序与淘汰。
import { existsSync, mkdirSync, readFileSync, writeFileSync, appendFileSync } from 'node:fs';
import { join } from 'node:path';
import { homedir } from 'node:os';
import { createHash } from 'node:crypto';

export const FACETS = ['chip', 'family', 'core', 'arch', 'vendor', 'sdk', 'toolchain', 'buildSystem'];
// 越具体的维度匹配上，越相关
const WEIGHT = { chip: 8, family: 6, sdk: 5, vendor: 4, toolchain: 4, buildSystem: 3, core: 3, arch: 2 };

export function kbDir() {
  const d = process.env.EMBEDDED_LOOP_KB || join(homedir(), '.embedded-loop', 'kb');
  if (!existsSync(d)) mkdirSync(d, { recursive: true });
  return d;
}
const kbFile = () => join(kbDir(), 'lessons.jsonl');

export function loadLessons() {
  const f = kbFile();
  if (!existsSync(f)) return [];
  return readFileSync(f, 'utf8').split('\n').filter(Boolean).map((l) => { try { return JSON.parse(l); } catch { return null; } }).filter(Boolean);
}
export function saveLessons(all) {
  writeFileSync(kbFile(), all.map((x) => JSON.stringify(x)).join('\n') + (all.length ? '\n' : ''));
}

const norm = (s) => String(s || '').toLowerCase().replace(/[\s_\-.()]/g, '');
// 值匹配：经验里写的值是身份值的前缀即算命中（"gd32e230" 命中 "GD32E230C8T6"；"cortexm" 命中 "Cortex-M23"）
function facetHit(lessonVal, idVal) {
  const vals = Array.isArray(lessonVal) ? lessonVal : [lessonVal];
  const iv = norm(idVal);
  return !!iv && vals.some((v) => { const lv = norm(v); return lv && iv.startsWith(lv); });
}

export function confidence(l) {
  const s = l.stats || {};
  const helped = s.helped || 0, refuted = s.refuted || 0, injected = s.injected || 0;
  let c = (helped + 1) / (helped + refuted + 2);             // 拉普拉斯平滑
  if (injected >= 10 && helped === 0) c *= 0.5;               // 经常被注入却从没帮上忙 → 降权
  return c;
}

// 返回 [{lesson, score, matched:[facets]}]，按分数降序
export function match(identity, { topic = '', limit = 12, includeRetired = false } = {}) {
  if (!identity) return [];
  const words = norm(topic) ? topic.toLowerCase().split(/[\s,，;；/]+/).filter((w) => w.length >= 2) : [];
  const out = [];
  for (const l of loadLessons()) {
    if (!includeRetired && l.status === 'retired') continue;
    const facets = FACETS.filter((f) => l.scope && l.scope[f] != null && l.scope[f] !== '');
    if (!facets.length) continue;                              // 不允许"对一切生效"的经验
    if (!facets.every((f) => facetHit(l.scope[f], identity[f]))) continue;   // scope 里每一维都得命中
    let score = facets.reduce((a, f) => a + (WEIGHT[f] || 1), 0) * confidence(l);
    if (words.length) {
      const hay = [l.symptom, l.cause, l.fix, ...(l.topics || [])].join(' ').toLowerCase();
      const hits = words.filter((w) => hay.includes(w)).length;
      if (!hits) continue;                                     // 带 topic 查询时要求话题相关
      score *= 1 + hits;
    }
    out.push({ lesson: l, score: Math.round(score * 100) / 100, matched: facets });
  }
  return out.sort((a, b) => b.score - a.score).slice(0, limit);
}

// 注入用的一行紧凑格式
export function oneLine(l) {
  const sc = FACETS.filter((f) => l.scope && l.scope[f]).map((f) => `${f}=${[].concat(l.scope[f]).join('/')}`).join(',');
  return `[${l.id}|${sc}] ${l.symptom} → ${l.cause} → ${l.fix}`;
}

const tokens = (s) => new Set(norm(s).match(/[a-z0-9]{2,}|[\u4e00-\u9fff]/g) || []);
function similar(a, b) {
  const A = tokens(a.symptom + ' ' + a.cause), B = tokens(b.symptom + ' ' + b.cause);
  if (!A.size || !B.size) return 0;
  let inter = 0; for (const t of A) if (B.has(t)) inter++;
  return inter / (A.size + B.size - inter);
}
const sameScope = (a, b) => FACETS.every((f) => norm([].concat(a.scope?.[f] ?? []).join('|')) === norm([].concat(b.scope?.[f] ?? []).join('|')));

// 新增或合并。返回 { action: 'added'|'merged', id }
export function upsert(input) {
  const now = new Date().toISOString();
  if (!input.symptom || !input.cause || !input.fix) throw new Error('lesson 需要 symptom / cause / fix');
  if (!input.scope || !FACETS.some((f) => input.scope[f])) throw new Error('lesson 需要至少一个 scope 维度：' + FACETS.join('/'));
  const all = loadLessons();
  const dup = all.find((x) => x.status !== 'retired' && sameScope(x, input) && similar(x, input) >= 0.5);
  if (dup) {
    // 合并时不丢信息：同一字段保留更完整（更长）的那一版
    const richer = (a, b) => (String(b || '').length > String(a || '').length ? b : a);
    Object.assign(dup, { cause: richer(dup.cause, input.cause), fix: richer(dup.fix, input.fix),
      verify: richer(dup.verify, input.verify), kind: input.kind || dup.kind, updatedAt: now });
    dup.topics = [...new Set([...(dup.topics || []), ...(input.topics || [])])];
    dup.evidence = [...(dup.evidence || []), ...(input.evidence || [])].slice(-10);
    saveLessons(all);
    return { action: 'merged', id: dup.id };
  }
  const id = 'L-' + createHash('sha1').update(JSON.stringify(input.scope) + input.symptom + input.cause).digest('hex').slice(0, 6);
  all.push({ id, kind: input.kind || 'pitfall', scope: input.scope, symptom: input.symptom, cause: input.cause, fix: input.fix,
    verify: input.verify || '', topics: input.topics || [], evidence: input.evidence || [],
    stats: { injected: 0, helped: 0, refuted: 0 }, status: 'active', createdAt: now, updatedAt: now });
  saveLessons(all);
  return { action: 'added', id };
}

export function feedback(ids, kind) {
  if (!['injected', 'helped', 'refuted'].includes(kind)) throw new Error('kind 必须是 injected|helped|refuted');
  const set = new Set([].concat(ids));
  const all = loadLessons();
  const now = new Date().toISOString();
  for (const l of all) {
    if (!set.has(l.id)) continue;
    l.stats = l.stats || {};
    l.stats[kind] = (l.stats[kind] || 0) + 1;
    if (kind !== 'injected') l.stats.lastFeedback = now;
    // 多次被推翻且推翻多于帮助 → 退役（不删除，可用 --all 查看）
    if ((l.stats.refuted || 0) >= 3 && l.stats.refuted > (l.stats.helped || 0)) l.status = 'retired';
  }
  saveLessons(all);
}

export function setStatus(id, status) {
  const all = loadLessons();
  const l = all.find((x) => x.id === id);
  if (!l) return false;
  l.status = status; l.updatedAt = new Date().toISOString();
  saveLessons(all);
  return true;
}

// ---- 工程内的"待提炼"候选（loop 过程中随手记，run 结束时提炼）----
export function pendingFile(loopDirPath) { return join(loopDirPath, 'memory', 'lessons-pending.jsonl'); }
export function addPending(loopDirPath, obj) {
  const d = join(loopDirPath, 'memory');
  if (!existsSync(d)) mkdirSync(d, { recursive: true });
  appendFileSync(pendingFile(loopDirPath), JSON.stringify({ ...obj, at: new Date().toISOString() }) + '\n');
}
export function readPending(loopDirPath) {
  const f = pendingFile(loopDirPath);
  if (!existsSync(f)) return [];
  return readFileSync(f, 'utf8').split('\n').filter(Boolean).map((l) => { try { return JSON.parse(l); } catch { return null; } }).filter(Boolean);
}
export function clearPending(loopDirPath) {
  const f = pendingFile(loopDirPath);
  if (existsSync(f)) writeFileSync(f, '');
}
