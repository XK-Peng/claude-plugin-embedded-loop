// PreToolUse hook (matcher: Bash) —— 在执行 Bash 命令前拦一道。
// 作用：
//  1) 烧录/擦除类命令必须先选定板子（state.activeBoard），否则拦下，防止
//     往错误的板子/错误的接口写程序。
//  2) 整片擦除(mass erase)这类破坏性操作，降级为「ask」让用户确认。
//  3) 其余命令放行。
//
// 注意：这里只做轻量启发式匹配命令字符串。真正的烧录命令由 boards/<name>.json
// 提供，用户可按需扩展下面的关键词。
import { readState, readHookInput, isInitialized } from './lib/state.mjs';

const input = await readHookInput();
if (!isInitialized(input.cwd)) process.exit(0);   // 未初始化的项目：静默

const cmd = (input.tool_input && input.tool_input.command) || '';
const st = readState(input.cwd);

// 不写死任何厂商工具名：通用关键词 + 当前板子 profile 里烧录命令的可执行文件名
import { existsSync as _ex, readFileSync as _rf } from 'node:fs';
import { join as _j, basename as _b } from 'node:path';
import { loopDir as _ld } from './lib/state.mjs';
let boardExe = null;
try {
  const bf = _j(_ld(input.cwd), 'boards', `${st.activeBoard}.json`);
  if (st.activeBoard && _ex(bf)) {
    const cmd0 = (JSON.parse(_rf(bf, 'utf8')).flash || {}).command || '';
    const exe = (cmd0.match(/^\s*"([^"]+)"/) || cmd0.match(/^\s*(\S+)/) || [])[1];
    if (exe && !exe.startsWith('<')) boardExe = _b(exe.replace(/\\/g, '/')).toLowerCase();
  }
} catch {}
const GENERIC = /\b(flash|download|burn|program|erase|upload)\b/i;
const FLASH_HINTS = { test: (c) => GENERIC.test(c) || (!!boardExe && c.toLowerCase().includes(boardExe) && /\s-f\s|flash|download|-w\s|write/i.test(c)) };
const ERASE_HINTS = /\b(mass[_-]?erase|chip[_-]?erase|erase[_-]?all|--erase-all|full[_-]?erase)\b/i;

function allow() { process.exit(0); }
function decide(decision, reason) {
  process.stdout.write(JSON.stringify({
    hookSpecificOutput: {
      hookEventName: 'PreToolUse',
      permissionDecision: decision,            // allow | deny | ask
      permissionDecisionReason: reason
    }
  }));
  process.exit(0);
}

if (!FLASH_HINTS.test(cmd)) allow();

if (!st.activeBoard) {
  decide('deny',
    '检测到烧录/下载命令，但尚未选择板子。请先用 board-flash 选定目标板' +
    '（写入 state.activeBoard），确认编译/烧录命令来自对应的 boards/<name>.json，再执行。');
}

if (ERASE_HINTS.test(cmd)) {
  decide('ask',
    `这是对板子「${st.activeBoard}」的整片擦除操作，不可逆。确认无误再继续。`);
}

decide('allow', `烧录命令针对板子「${st.activeBoard}」，已放行。`);
