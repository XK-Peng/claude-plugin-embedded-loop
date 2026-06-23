// 项目环境自动识别。由 /embedded-loop:init 调用（也可手动 node 运行）。
// 扫描当前工程已有的文件，从中推断：芯片、厂商、IDE、烧录器，
// 据此写 state.env 和一份 board profile 草稿（命令为最佳猜测，留待 run 时确认）。
// 不读需求文档、不启动任何迭代。纯 Node，无依赖，Windows/Linux/macOS 通用。
//
// 用法：node detect-env.mjs [projectRoot]
import { existsSync, readdirSync, statSync, writeFileSync, readFileSync } from 'node:fs';
import { join, resolve, basename } from 'node:path';
import { ensureDir, loopDir, readState, writeState } from './lib/state.mjs';

const projectRoot = resolve(process.argv[2] || process.env.CLAUDE_PROJECT_DIR || process.cwd());

// 厂商前缀 → 厂商名（按芯片型号前缀匹配）
const VENDOR_BY_PREFIX = [
  [/^N32[GLW]/i, 'Nations 国民技术'],
  [/^STM32/i, 'STMicroelectronics'],
  [/^GD32/i, 'GigaDevice 兆易创新'],
  [/^ESP(32|8266)/i, 'Espressif'],
  [/^nRF5/i, 'Nordic'],
  [/^AT32/i, 'Artery 雅特力'],
  [/^MM32/i, 'MindMotion 灵动'],
  [/^HK32/i, 'HKMicro 航顺'],
  [/^CH32/i, 'WCH 沁恒'],
  [/^APM32/i, 'Geehy 极海'],
  [/^TLSR/i, 'Telink 泰凌']
];
// 识别芯片型号的正则（取匹配到的最长者）。用 lookbehind/lookahead 让下划线/点也算分隔，
// 这样 "Nations.N32G003_DFP" 里的 N32G003 也能被识别。
const CHIP_RX = /(?<![A-Za-z0-9])(N32[GLW]\d{2,4}[A-Z0-9]*|STM32[A-Z]\d[A-Z0-9]+|GD32[A-Z0-9]+|ESP32[A-Z0-9-]*|ESP8266|nRF5\d{4}|AT32[A-Z0-9]+|MM32[A-Z0-9]+|HK32[A-Z0-9]+|CH32[A-Z0-9]+|APM32[A-Z0-9]+|TLSR\d{4}[A-Z]?)(?![A-Za-z0-9])/i;

const found = { names: [], packs: [], uvprojx: [], jlink: false, openocd: false };
const SKIP = new Set(['.git', 'node_modules', '.embedded-loop', '.vscode']);
let visited = 0;

function walk(dir, depth) {
  if (depth > 6 || visited > 8000) return;
  let entries;
  try { entries = readdirSync(dir, { withFileTypes: true }); } catch { return; }
  for (const e of entries) {
    visited++;
    const name = e.name;
    found.names.push(name);
    const low = name.toLowerCase();
    if (low.endsWith('.pack')) found.packs.push(name);
    if (low.endsWith('.uvprojx') || low.endsWith('.uvproj')) found.uvprojx.push(join(dir, name));
    if (low === 'jlink' || low.endsWith('.jlink') || low.startsWith('jlinksettings')) found.jlink = true;
    if (low.includes('openocd')) found.openocd = true;
    if (e.isDirectory() && !SKIP.has(low)) walk(join(dir, name), depth + 1);
  }
}
walk(projectRoot, 0);

// 推断芯片：优先从 .pack / *_Library / *_DFP 名里找，其次全体名字
function detectChip() {
  const priority = found.packs.concat(
    found.names.filter((n) => /_(Library|DFP|StdPeriph|SDK)/i.test(n))
  );
  for (const n of priority.concat(found.names)) {
    const m = n.match(CHIP_RX);
    if (m) return m[1].toUpperCase();
  }
  return null;
}
const chip = detectChip();
const vendor = chip ? (VENDOR_BY_PREFIX.find(([rx]) => rx.test(chip)) || [, null])[1] : null;
const ide = found.uvprojx.length ? 'Keil MDK' : (found.packs.length ? 'Keil MDK (DFP)' : null);
const flasher = found.jlink ? 'J-Link' : (found.openocd ? 'OpenOCD' : null);
const os = process.platform === 'win32' ? 'Windows' : process.platform === 'darwin' ? 'macOS' : 'Linux';
const uvprojx = found.uvprojx[0] || null;

// 写 state.env（只填检测到的；toolchainResolved 保持 false，待 run 确认命令）
const st = readState(projectRoot);
st.env.chip = chip || st.env.chip;
st.env.os = os;
if (ide) st.env.ide = ide;
st.env.toolchainResolved = false;
writeState(st, projectRoot);

// 写 board profile 草稿（命令是最佳猜测，含占位符）
let boardWritten = null;
if (chip) {
  const loop = ensureDir(join(loopDir(projectRoot), 'boards'));
  const boardName = chip.toLowerCase();
  const boardFile = join(loop, `${boardName}.json`);
  const uvRel = uvprojx ? uvprojx.replace(projectRoot + '/', '').replace(projectRoot + '\\', '') : '<你的.uvprojx路径>';
  const profile = {
    name: boardName,
    mcu: chip,
    vendor: vendor || '未知（请确认）',
    package: '<封装，待确认>',
    defines: ['<编译宏在 Keil 工程里，本字段仅信息用>'],
    build: {
      command: `"<Keil安装路径>\\UV4\\UV4.exe" -j0 -b ${uvRel} -o .embedded-loop\\logs\\keil_build.log`,
      artifact: '<编译产物 .hex/.bin 路径>',
      cwd: '.',
      note: 'UV4 -b 命令行编译；退出码非0=有错。把 Keil 路径与 .uvprojx 改成实际值。'
    },
    flash: {
      command: found.jlink
        ? `"<Keil安装路径>\\UV4\\UV4.exe" -f ${uvRel} -o .embedded-loop\\logs\\keil_flash.log`
        : '<填你的烧录命令>',
      note: found.jlink
        ? '检测到 J-Link：优先用 Keil 自带下载(UV4 -f，靠工程里配的 J-Link + DFP flash 算法)；也可用 JLink.exe CLI。'
        : '未检测到烧录器，请填写。'
    },
    monitor: { port: '<COMx，设备管理器查>', baud: 115200 },
    host_test: { command: '', note: '外设逻辑无法在 PC 跑，留空' }
  };
  if (!existsSync(boardFile)) {
    writeFileSync(boardFile, JSON.stringify(profile, null, 2));
    boardWritten = boardFile;
  } else {
    boardWritten = boardFile + '（已存在，未覆盖）';
  }
}

// 报告
console.log('=== 项目环境识别结果 ===');
console.log(`工程根: ${projectRoot}`);
console.log(`芯片  : ${chip || '未识别（run 时请在需求文档里写明）'}`);
console.log(`厂商  : ${vendor || '未知'}`);
console.log(`IDE   : ${ide || '未识别'}`);
console.log(`烧录器: ${flasher || '未识别'}`);
console.log(`系统  : ${os}`);
if (found.packs.length) console.log(`DFP包 : ${found.packs.join(', ')}`);
if (uvprojx) console.log(`Keil工程: ${uvprojx}`);
console.log(boardWritten ? `已写 board 草稿: ${boardWritten}` : 'board 草稿: 未写（芯片未识别）');
console.log('\n注意：编译/烧录命令是“最佳猜测+占位符”，请在 /run 时（或现在手动）确认 Keil 路径、.uvprojx、产物路径、COM 口。toolchainResolved 仍为 false。');
console.log('下一步：把需求写进 requirements/REQUIREMENT.md，再运行 /embedded-loop:run。');
