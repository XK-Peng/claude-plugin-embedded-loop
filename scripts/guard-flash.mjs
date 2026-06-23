// PreToolUse hook (matcher: Bash) —— 在执行 Bash 命令前拦一道。
// 作用：
//  1) 烧录/擦除类命令必须先选定板子（state.activeBoard），否则拦下，防止
//     往错误的板子/错误的接口写程序。
//  2) 整片擦除(mass erase)这类破坏性操作，降级为「ask」让用户确认。
//  3) 其余命令放行。
//
// 注意：这里只做轻量启发式匹配命令字符串。真正的烧录命令由 boards/<name>.json
// 提供，用户可按需扩展下面的关键词。
import { readState, readHookInput } from './lib/state.mjs';

const input = await readHookInput();
const cmd = (input.tool_input && input.tool_input.command) || '';
const st = readState(input.cwd);

const FLASH_HINTS = /\b(flash|download|burn|program|bdt|tlsr|openocd|jlink|j-link|nrfjprog|st-?flash|esptool|west\s+flash)\b/i;
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
