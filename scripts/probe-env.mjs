// 工程环境探测（厂商无关）。/embedded-loop:init 与资料变化时调用。
//
// 设计原则：本脚本【不认识任何芯片型号】，没有厂商前缀表。它只读"标准文件格式"里
// 已经写明的信息，汇总成证据，交给模型（env-resolver 技能）去判断和确认：
//   - CMSIS .pack / .pdsc   → <device Dname> <processor Dcore Dfpu> <memory> svd 路径
//   - Keil .uvprojx/.uvproj → <Device> <Vendor> <Cpu>CPUTYPE(..) <OutputDirectory> <OutputName>
//   - IAR .ewp              → OGChipSelectEditMenu
//   - ESP-IDF sdkconfig     → CONFIG_IDF_TARGET
//   - CubeMX .ioc           → Mcu.Name
//   - CMake/Make/*.mk       → -mcpu= -march= 以及交叉编译器前缀
//   - platformio.ini        → board / platform
//   - 启动文件、链接脚本、烧录器配置的文件名
// 输出：.embedded-loop/evidence.json + state.env.identity（候选，confirmed=false）
//      + boards/<name>.json 草稿（按"构建系统"生成命令，构建系统是通用的，不是芯片）
//
// 用法：node probe-env.mjs [projectRoot] [--quiet]
import { existsSync, readdirSync, readFileSync, statSync, writeFileSync } from 'node:fs';
import { join, resolve, relative, extname, basename, dirname, posix } from 'node:path';
import { ensureDir, loopDir, readState, writeState } from './lib/state.mjs';
import { listZip, readZipEntry } from './lib/zip.mjs';

const args = process.argv.slice(2);
const quiet = args.includes('--quiet');
const projectRoot = resolve(args.find((a) => !a.startsWith('--')) || process.env.CLAUDE_PROJECT_DIR || process.cwd());
const loop = loopDir(projectRoot);
const rel = (p) => relative(projectRoot, p).split('\\').join('/');

// ---------- 1. 遍历工程 ----------
const SKIP = new Set(['.git', 'node_modules', '.embedded-loop', '.vscode', '.idea', 'build', 'Objects', 'Listings', 'DebugConfig']);
const files = [];
const dirs = [];
let visited = 0;
(function walk(dir, depth) {
  if (depth > 7 || visited > 20000) return;
  let ents; try { ents = readdirSync(dir, { withFileTypes: true }); } catch { return; }
  for (const e of ents) {
    visited++;
    const p = join(dir, e.name);
    if (e.isDirectory()) { if (!SKIP.has(e.name)) { dirs.push(p); walk(p, depth + 1); } }
    else files.push(p);
  }
})(projectRoot, 0);

const byExt = (...exts) => files.filter((f) => exts.includes(extname(f).toLowerCase()));
const byName = (rx) => files.filter((f) => rx.test(basename(f)));
const readText = (f, max = 2_000_000) => { try { return statSync(f).size > max ? '' : readFileSync(f, 'utf8'); } catch { return ''; } };
const attr = (tag, name) => { const m = tag.match(new RegExp(name + '="([^"]*)"')); return m ? m[1] : null; };
const uniq = (a) => [...new Set(a.filter(Boolean))];

const ev = { projectRoot, probedAt: new Date().toISOString(), packs: [], keil: [], iar: [], idf: [], ioc: [],
  mcpu: [], march: [], compilers: [], platformio: [], zephyr: false, startup: [], linker: [], flasherHints: [],
  buildSystems: [], materials: [], links: [] };

// ---------- 2. CMSIS pack / pdsc ----------
function parsePdsc(text, origin) {
  const devices = [];
  const rx = /<device\s[^>]*Dname="([^"]+)"[^>]*>/g;
  let m;
  while ((m = rx.exec(text)) && devices.length < 80) {
    const idx = m.index;
    const end = text.indexOf('</device>', idx);
    const block = text.slice(idx, end > 0 ? end : idx + 4000);
    const before = text.slice(0, idx);
    const lastAttr = (name) => { const all = [...before.matchAll(new RegExp(name + '="([^"]*)"', 'g'))]; return all.length ? all[all.length - 1][1] : null; };
    const inBlock = (name) => attr(block, name);
    const mems = [...block.matchAll(/<memory\s[^>]*>/g)].map((x) => ({
      id: attr(x[0], 'id') || attr(x[0], 'name'), start: attr(x[0], 'start'), size: attr(x[0], 'size') }));
    const svd = (block.match(/svd="([^"]+)"/) || before.match(/svd="([^"]+)"(?![\s\S]*svd=")/) || [])[1] || null;
    devices.push({
      name: m[1],
      vendor: (inBlock('Dvendor') || lastAttr('Dvendor') || '').replace(/:\d+$/, '') || null,
      family: lastAttr('Dfamily'),
      core: inBlock('Dcore') || lastAttr('Dcore'),
      fpu: inBlock('Dfpu') || lastAttr('Dfpu'),
      clock: inBlock('Dclock') || lastAttr('Dclock'),
      memory: mems,
      svd,
      algorithms: [...block.matchAll(/<algorithm\s[^>]*name="([^"]+)"/g)].map((x) => x[1])
    });
  }
  return { origin, packName: (text.match(/<name>([^<]+)<\/name>/) || [])[1] || null,
    packVendor: (text.match(/<vendor>([^<]+)<\/vendor>/) || [])[1] || null, devices };
}
for (const f of byExt('.pack')) {
  try {
    const zip = listZip(f);
    const e = zip.entries.find((x) => /\.pdsc$/i.test(x.name));
    if (e) ev.packs.push({ ...parsePdsc(readZipEntry(zip, e).toString('utf8'), rel(f)), _zip: f });
  } catch (err) { ev.packs.push({ origin: rel(f), error: String(err.message || err) }); }
}
for (const f of byExt('.pdsc')) ev.packs.push(parsePdsc(readText(f), rel(f)));

// ---------- 3. IDE 工程 ----------
for (const f of byExt('.uvprojx', '.uvproj')) {
  const t = readText(f);
  const tag = (n) => (t.match(new RegExp('<' + n + '>([^<]*)</' + n + '>')) || [])[1] || null;
  const cpu = tag('Cpu') || '';
  ev.keil.push({ file: rel(f), device: tag('Device'), vendor: tag('Vendor'), packId: tag('PackID'),
    core: (cpu.match(/CPUTYPE\("([^"]+)"\)/) || [])[1] || null,
    target: tag('TargetName'), outputDir: tag('OutputDirectory'), outputName: tag('OutputName'),
    hex: tag('CreateHexFile') === '1', uAC6: tag('uAC6') === '1' });
}
for (const f of byExt('.ewp')) {
  const t = readText(f);
  ev.iar.push({ file: rel(f), device: (t.match(/OGChipSelectEditMenu<\/name>\s*<state>([^<]+)/) || [])[1] || null });
}
for (const f of byName(/^sdkconfig(\.defaults)?$/)) {
  const t = readText(f);
  ev.idf.push({ file: rel(f), target: (t.match(/CONFIG_IDF_TARGET="([^"]+)"/) || [])[1] || null });
}
for (const f of byExt('.ioc')) {
  const t = readText(f);
  ev.ioc.push({ file: rel(f), mcu: (t.match(/^Mcu\.Name=(.+)$/m) || [])[1] || null });
}
for (const f of byName(/^platformio\.ini$/)) {
  const t = readText(f);
  ev.platformio.push({ file: rel(f), boards: uniq([...t.matchAll(/^\s*board\s*=\s*(.+)$/gm)].map((x) => x[1].trim())),
    platforms: uniq([...t.matchAll(/^\s*platform\s*=\s*(.+)$/gm)].map((x) => x[1].trim())) });
}
ev.zephyr = byName(/^(west\.yml|prj\.conf)$/).length > 0;

// ---------- 4. 构建脚本里的内核/编译器线索 ----------
const buildFiles = files.filter((f) => /^(CMakeLists\.txt|Makefile|makefile|GNUmakefile)$/.test(basename(f)) || /\.(mk|cmake)$/i.test(f)).slice(0, 200);
for (const f of buildFiles) {
  const t = readText(f, 500_000);
  ev.mcpu.push(...[...t.matchAll(/-mcpu=([\w+.\-]+)/g)].map((x) => x[1]));
  ev.march.push(...[...t.matchAll(/-march=([\w+.\-]+)/g)].map((x) => x[1]));
  ev.compilers.push(...[...t.matchAll(/\b([A-Za-z0-9_]+(?:-[A-Za-z0-9_]+)+-)(?:gcc|g\+\+|as)\b/g)].map((x) => x[1]));
}
ev.mcpu = uniq(ev.mcpu); ev.march = uniq(ev.march); ev.compilers = uniq(ev.compilers);

// ---------- 5. 文件名线索 ----------
ev.startup = uniq(byName(/^startup[_\-].*\.(s|S|asm|c)$/).map(rel)).slice(0, 20);
ev.linker = uniq(files.filter((f) => /\.(ld|lds|sct|icf)$/i.test(f)).map(rel)).slice(0, 20);
ev.flasherHints = uniq([...dirs, ...files].filter((f) => /jlink|openocd|pyocd|\.jflash$|\.cfg$|flash_download|download_tool|burn/i.test(rel(f))).map(rel)).slice(0, 30);

// ---------- 6. 构建系统（通用分类，不涉及芯片） ----------
if (ev.keil.length) ev.buildSystems.push('keil-uvision');
if (ev.iar.length) ev.buildSystems.push('iar-ewarm');
if (ev.idf.length) ev.buildSystems.push('esp-idf');
if (ev.zephyr) ev.buildSystems.push('zephyr-west');
if (ev.platformio.length) ev.buildSystems.push('platformio');
if (byName(/^\.cproject$/).length) ev.buildSystems.push('eclipse-cdt');
if (buildFiles.some((f) => basename(f) === 'CMakeLists.txt') && !ev.idf.length && !ev.zephyr) ev.buildSystems.push('cmake');
if (buildFiles.some((f) => /akefile$/.test(basename(f)) || /\.mk$/.test(f))) ev.buildSystems.push('make');

// ---------- 7. 资料清单 + 链接 ----------
const st = readState(projectRoot);
const matDirName = st.env.materialsDir || 'materials';
const matDirs = uniq([matDirName, 'materials', 'material', 'docs', 'doc']).map((d) => join(projectRoot, d)).filter(existsSync);
for (const f of files.filter((f) => matDirs.some((d) => f.startsWith(d)))) {
  ev.materials.push({ file: rel(f), ext: extname(f).toLowerCase().slice(1), kb: Math.round(statSync(f).size / 1024) });
}
const reqDir = join(projectRoot, st.env.requirementsDir || 'requirements');
for (const f of files.filter((f) => (matDirs.some((d) => f.startsWith(d)) || f.startsWith(reqDir)) && /\.(md|txt)$/i.test(f))) {
  for (const m of readText(f, 300_000).matchAll(/https?:\/\/[^\s)>\]"']+/g)) ev.links.push({ url: m[0], from: rel(f) });
}
ev.links = ev.links.filter((l, i, a) => /^https?:\/\/[^/\s]+\.[a-z]{2,}/i.test(l.url) && !l.url.includes('...') && a.findIndex((x) => x.url === l.url) === i).slice(0, 50);

// ---------- 8. 候选身份：只按"证据强度"排序，不做型号判断 ----------
const allDevices = ev.packs.flatMap((p) => (p.devices || []).map((d) => ({ ...d, pack: p.origin })));
const findDev = (name) => name && allDevices.find((d) => d.name.toLowerCase() === name.toLowerCase());
const cand = { chip: null, core: null, arch: null, vendor: null, family: null, sdk: null,
  buildSystem: ev.buildSystems[0] || null, flasher: null, sources: {}, confirmed: false };
const set = (k, v, src) => { if (v && !cand[k]) { cand[k] = v; cand.sources[k] = src; } };

for (const k of ev.keil) { set('chip', k.device, k.file + ' <Device>'); set('core', k.core, k.file + ' <Cpu>'); set('vendor', k.vendor, k.file + ' <Vendor>'); }
for (const i of ev.iar) set('chip', i.device, i.file);
for (const i of ev.ioc) set('chip', i.mcu, i.file);
for (const i of ev.idf) set('chip', i.target, i.file + ' CONFIG_IDF_TARGET');
const dev = findDev(cand.chip) || (allDevices.length === 1 ? allDevices[0] : null);
if (dev) {
  set('chip', dev.name, dev.pack + ' Dname');
  set('core', dev.core, dev.pack + ' Dcore');
  set('vendor', dev.vendor, dev.pack + ' Dvendor');
  set('family', dev.family, dev.pack + ' Dfamily');
}
set('core', ev.mcpu[0], 'build flags -mcpu');
set('arch', ev.march[0], 'build flags -march');
if (ev.flasherHints.some((h) => /jlink/i.test(h))) set('flasher', 'J-Link', 'file names');
else if (ev.flasherHints.some((h) => /openocd/i.test(h))) set('flasher', 'OpenOCD', 'file names');
else if (ev.flasherHints.some((h) => /pyocd/i.test(h))) set('flasher', 'pyOCD', 'file names');
const sdkDir = files.map((f) => relative(projectRoot, f).split(/[\\/]/)[0]).find((d) => /(_|\b)(library|sdk|firmware|stdperiph|hal)(_|\b|\.)/i.test(d));
set('sdk', sdkDir, 'top-level folder name');

// ---------- 9. SVD：从 pack 里抽出来，给寄存器核对用 ----------
if (dev && dev.svd) {
  const p = ev.packs.find((x) => x.origin === dev.pack);
  try {
    if (p && p._zip) {
      const zip = listZip(p._zip);
      const e = zip.entries.find((x) => x.name.replace(/\\/g, '/').toLowerCase() === dev.svd.replace(/\\/g, '/').toLowerCase());
      if (e) {
        const out = join(ensureDir(join(loop, 'cache')), basename(dev.svd));
        writeFileSync(out, readZipEntry(zip, e));
        ev.svdExtracted = rel(out);
      }
    }
  } catch {}
}

// ---------- 10. board 草稿（按构建系统） ----------
const keilExe = [process.env.KEIL_UV4, 'C:\\Keil_v5\\UV4\\UV4.exe', 'D:\\Keil_v5\\UV4\\UV4.exe', '/mnt/c/Keil_v5/UV4/UV4.exe', '/mnt/d/Keil_v5/UV4/UV4.exe']
  .find((p) => p && existsSync(p)) || '<Keil安装路径>\\UV4\\UV4.exe';
function draftFor(bs) {
  const k = ev.keil[0];
  switch (bs) {
    case 'keil-uvision': {
      const proj = k.file;
      const out = k.outputDir && k.outputName ? posix.normalize(posix.join(posix.dirname(k.file), k.outputDir.split('\\').join('/'), k.outputName + (k.hex ? '.hex' : '.axf'))) : '<产物路径>';
      return { build: `"${keilExe}" -j0 -b ${proj} -o ${rel(join(loop, 'logs'))}/build.log`, artifact: out,
        flash: `"${keilExe}" -f ${proj} -o ${rel(join(loop, 'logs'))}/flash.log`,
        note: 'Keil 命令行：-b 编译、-f 用工程内配置的调试器+flash 算法下载。退出码 0/1 视为成功（1=有警告）。' };
    }
    case 'iar-ewarm': return { build: `iarbuild ${ev.iar[0].file} -build <配置名>`, artifact: '<产物路径>', flash: '<填烧录命令>' };
    case 'esp-idf': return { build: 'idf.py build', artifact: 'build/<项目>.bin', flash: 'idf.py -p <端口> flash' };
    case 'zephyr-west': return { build: 'west build -b <board>', artifact: 'build/zephyr/zephyr.hex', flash: 'west flash' };
    case 'platformio': return { build: 'pio run', artifact: '.pio/build/<env>/firmware.bin', flash: 'pio run -t upload' };
    case 'cmake': return { build: 'cmake -S . -B build && cmake --build build', artifact: '<产物路径>', flash: '<填烧录命令>' };
    case 'make': return { build: 'make', artifact: '<产物路径>', flash: '<填烧录命令>' };
    default: return { build: '<填编译命令>', artifact: '<产物路径>', flash: '<填烧录命令>' };
  }
}
const boardName = (cand.chip || 'board').toLowerCase().replace(/[^a-z0-9_-]/g, '-');
const boardFile = join(ensureDir(join(loop, 'boards')), boardName + '.json');
let boardNote;
if (!existsSync(boardFile)) {
  const d = draftFor(cand.buildSystem);
  writeFileSync(boardFile, JSON.stringify({
    name: boardName, mcu: cand.chip || '<待确认>', core: cand.core || '<待确认>',
    build: { command: d.build, artifact: d.artifact, cwd: '.', note: d.note || '' },
    flash: { command: d.flash },
    monitor: { port: '<串口>', baud: 115200 },
    host_test: { command: '' },
    _draft: true
  }, null, 2));
  boardNote = '已生成草稿 ' + rel(boardFile);
} else boardNote = rel(boardFile) + ' 已存在，未覆盖';

// ---------- 11. 落盘 ----------
for (const p of ev.packs) delete p._zip;
writeFileSync(join(ensureDir(loop), 'evidence.json'), JSON.stringify(ev, null, 2));
const prev = st.env.identity || {};
st.env.identity = prev.confirmed ? prev : cand;     // 已确认的身份不被覆盖
st.env.chip = st.env.identity.chip || st.env.chip;
st.env.os = process.platform === 'win32' ? 'Windows' : (existsSync('/proc/sys/fs/binfmt_misc/WSLInterop') ? 'WSL' : process.platform);
if (!st.activeBoard && cand.chip) st.activeBoard = boardName;
writeState(st, projectRoot);

if (!quiet) {
  const show = (k) => `${cand[k] || '—'}${cand.sources[k] ? `   ← ${cand.sources[k]}` : ''}`;
  console.log('=== 工程探测（只读格式，不猜型号）===');
  console.log('器件  : ' + show('chip'));
  console.log('内核  : ' + show('core'));
  console.log('厂商  : ' + show('vendor'));
  console.log('SDK   : ' + show('sdk'));
  console.log('构建  : ' + (ev.buildSystems.join(', ') || '—'));
  console.log('烧录器: ' + show('flasher'));
  if (allDevices.length > 1 && !findDev(cand.chip)) console.log(`pack 内含 ${allDevices.length} 个器件，需确认用哪一个：${allDevices.slice(0, 8).map((d) => d.name).join(', ')}…`);
  if (ev.svdExtracted) console.log('SVD   : 已抽取 ' + ev.svdExtracted);
  console.log(`资料  : ${ev.materials.length} 个文件，${ev.links.length} 个链接`);
  console.log('board : ' + boardNote);
  console.log(prev.confirmed ? '身份已确认过，保持不变。' : '以上为候选，未确认；由 env-resolver 结合资料确认并补全 arch。');
  console.log('完整证据：' + rel(join(loop, 'evidence.json')));
}
