// monitors/monitors.json 调用的后台监控脚本。
// Claude Code 的 monitor：进程在整个会话期间常驻，每打印一行 stdout 就作为
// 一条通知喂给 Claude。所以这里只打印「有信号的行」，避免刷屏。
//
// 两种模式（自动选择）：
//  A. 默认零依赖模式：tail .embedded-loop/logs/serial.log
//     （由你的串口终端 / board-flash 步骤把真机输出重定向到该文件）
//  B. 直读串口模式：若已 `npm i -g serialport` 且 state.json 里配置了
//     activeBoard 对应 boards/<name>.json 的 monitor.port，则直接读 COM 口。
//
// 只有匹配「信号正则」的行才会上报（默认：ERROR/ASSERT/FAIL/PASS/HARDFAULT/[TEST]）。
import { existsSync, readFileSync, watchFile, statSync } from 'node:fs';
import { join } from 'node:path';
import { loopDir, readState, isInitialized } from './lib/state.mjs';

const dir = loopDir();
// 未初始化的项目：安静等待，初始化后再开始（不创建任何文件）
while (!isInitialized()) await new Promise((r) => setTimeout(r, 10000));
const st = readState();

const SIGNAL = /(ERROR|ASSERT|FAIL|PASS|HARDFAULT|HARD FAULT|PANIC|\[TEST\]|\[REQ-\d+\])/i;
function emit(line) {
  const t = line.trim();
  if (t && SIGNAL.test(t)) process.stdout.write(`[hw] ${t}\n`);
}

// ---- 模式 B：直读串口（可选）----
async function trySerial() {
  let port = null, baud = 115200;
  try {
    const bf = join(dir, 'boards', `${st.activeBoard}.json`);
    if (st.activeBoard && existsSync(bf)) {
      const b = JSON.parse(readFileSync(bf, 'utf8'));
      port = b.monitor && b.monitor.port;
      baud = (b.monitor && b.monitor.baud) || 115200;
    }
  } catch {}
  if (!port) return false;
  try {
    const { SerialPort } = await import('serialport');
    const { ReadlineParser } = await import('@serialport/parser-readline');
    const sp = new SerialPort({ path: port, baudRate: baud });
    const parser = sp.pipe(new ReadlineParser({ delimiter: '\n' }));
    parser.on('data', emit);
    sp.on('error', (e) => process.stderr.write(`serial error: ${e.message}\n`));
    process.stdout.write(`[hw] 串口直读已启动 ${port}@${baud}\n`);
    return true;
  } catch {
    return false; // serialport 没装就回落到文件模式
  }
}

// ---- 模式 A：tail 日志文件（默认）----
function tailFile() {
  const logf = join(dir, 'logs', 'serial.log');
  let size = existsSync(logf) ? statSync(logf).size : 0;
  process.stdout.write(`[hw] 监控日志 ${logf}（把真机串口输出重定向到此文件即可被监控）\n`);
  watchFile(logf, { interval: 500 }, () => {
    try {
      const s = statSync(logf).size;
      if (s < size) size = 0;                 // 文件被截断/重写
      if (s > size) {
        const buf = readFileSync(logf, 'utf8').slice(size);
        size = s;
        buf.split('\n').forEach(emit);
      }
    } catch {}
  });
}

if (!(await trySerial())) tailFile();
