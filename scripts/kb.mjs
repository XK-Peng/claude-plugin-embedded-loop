// 经验库命令行。模型在 loop 中只调这些命令，不手改 JSON。
//   node kb.mjs query [--topic "关键词"] [--limit N] [--json]   按当前工程身份检索
//   node kb.mjs pending add  <json | --file f | ->              记一条待提炼候选（loop 中随手记）
//   node kb.mjs pending list | clear
//   node kb.mjs promote <json | --file f | ->                   提炼后的经验入库（自动查重合并）
//   node kb.mjs feedback <id[,id]> injected|helped|refuted
//   node kb.mjs list [--all]   |  show <id>  |  retire <id>  |  stats  |  where
// JSON 参数在 Windows cmd 里难写引号时，用 --file 或从 stdin 传（- 表示 stdin）。
import { readFileSync } from 'node:fs';
import { loopDir, readState } from './lib/state.mjs';
import * as kb from './lib/kb.mjs';

const [cmd, sub, ...rest] = process.argv.slice(2);
const flag = (name) => { const a = process.argv.slice(2); const i = a.indexOf(name); return i >= 0 ? a[i + 1] : null; };
const has = (name) => process.argv.slice(2).includes(name);
const die = (msg) => { console.error(msg); process.exit(1); };

async function readJsonArg(arg) {
  let raw;
  if (arg === '-' ) { const c = []; for await (const x of process.stdin) c.push(x); raw = Buffer.concat(c).toString('utf8'); }
  else if (arg === '--file') raw = readFileSync(flag('--file'), 'utf8');
  else raw = arg;
  if (!raw) die('缺少 JSON 参数');
  try { return JSON.parse(raw); } catch (e) { die('JSON 解析失败：' + e.message); }
}

const st = readState();
const identity = st.env.identity || { chip: st.env.chip };
const loop = loopDir();

switch (cmd) {
  case 'query': {
    const r = kb.match(identity, { topic: flag('--topic') || '', limit: Number(flag('--limit') || 12) });
    if (has('--json')) console.log(JSON.stringify(r, null, 2));
    else if (!r.length) console.log('（经验库里没有匹配当前身份的经验）');
    else r.forEach((x) => console.log(kb.oneLine(x.lesson)));
    break;
  }
  case 'pending': {
    if (sub === 'add') {
      const obj = await readJsonArg(rest[0]);
      kb.addPending(loop, { identity, req: st.currentReq, ...obj });
      console.log('pending +1（共 ' + kb.readPending(loop).length + ' 条）');
    } else if (sub === 'list') {
      const p = kb.readPending(loop);
      console.log(p.length ? p.map((x, i) => `${i + 1}. [${x.req || '-'}] ${x.symptom || ''} | 假设:${x.hypothesis || x.cause || ''} | 改:${x.fix || ''} | 结果:${x.result || ''}`).join('\n') : '（无待提炼）');
    } else if (sub === 'clear') { kb.clearPending(loop); st.lessons.distillRequestedFor = null; (await import('./lib/state.mjs')).writeState(st); console.log('pending 已清空'); }
    else die('pending add|list|clear');
    break;
  }
  case 'promote': {
    const obj = await readJsonArg(sub);
    const list = Array.isArray(obj) ? obj : [obj];
    for (const o of list) {
      try { const r = kb.upsert(o); console.log(`${r.action} ${r.id}`); } catch (e) { console.log('跳过：' + e.message); }
    }
    break;
  }
  case 'feedback': {
    if (!sub || !rest[0]) die('feedback <id[,id]> injected|helped|refuted');
    kb.feedback(sub.split(','), rest[0]);
    console.log(`已记录 ${rest[0]}：${sub}`);
    break;
  }
  case 'list': {
    const all = kb.loadLessons().filter((l) => has('--all') || l.status !== 'retired');
    console.log(all.length ? all.map((l) => `${kb.oneLine(l)}  (注入${l.stats?.injected || 0}/有用${l.stats?.helped || 0}/推翻${l.stats?.refuted || 0}${l.status === 'retired' ? '/已退役' : ''})`).join('\n') : '（经验库为空）');
    break;
  }
  case 'show': { const l = kb.loadLessons().find((x) => x.id === sub); console.log(l ? JSON.stringify(l, null, 2) : '未找到 ' + sub); break; }
  case 'retire': console.log(kb.setStatus(sub, 'retired') ? '已退役 ' + sub : '未找到 ' + sub); break;
  case 'stats': {
    const all = kb.loadLessons();
    const byFacet = {};
    for (const l of all) for (const f of kb.FACETS) if (l.scope?.[f]) byFacet[f] = (byFacet[f] || 0) + 1;
    console.log(`经验 ${all.length} 条（退役 ${all.filter((l) => l.status === 'retired').length}）；按范围：${JSON.stringify(byFacet)}；当前工程可命中 ${kb.match(identity, { limit: 999 }).length} 条`);
    break;
  }
  case 'where': console.log(kb.kbDir()); break;
  default:
    console.log('用法：kb.mjs query|pending add|pending list|pending clear|promote|feedback|list|show|retire|stats|where');
}
