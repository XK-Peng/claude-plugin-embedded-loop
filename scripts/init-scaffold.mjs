// 确定性脚手架。由 /embedded-loop:init 调用（也可手动 node 运行）。
// 在工程根下创建：
//   requirements/   ← 你写需求文档的地方（输入）
//   materials/      ← 需求资料：datasheet PDF / 原理图 / 网址清单（输入）
//   .embedded-loop/{tests,boards,detectors,protocols,memory,logs}  ← 框架工作区
// 并把面向用户的输入模板拷过去（已存在则不覆盖），初始化 state.json。
//
// 用法：node init-scaffold.mjs [projectRoot]
import { existsSync, mkdirSync, copyFileSync, readFileSync, writeFileSync } from 'node:fs';
import { join, dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { ensureDir, loopDir, readState, writeState } from './lib/state.mjs';

const here = dirname(fileURLToPath(import.meta.url));
const pluginRoot = process.env.CLAUDE_PLUGIN_ROOT || resolve(here, '..');
const tpl = (name) => join(pluginRoot, 'templates', name);

const projectRoot = resolve(process.argv[2] || process.env.CLAUDE_PROJECT_DIR || process.cwd());

const dirs = [
  join(projectRoot, 'requirements'),
  join(projectRoot, 'materials'),
];
const loop = loopDir(projectRoot);
['', 'tests', 'boards', 'detectors', 'protocols', 'memory', 'logs'].forEach((d) =>
  dirs.push(d ? join(loop, d) : loop)
);
dirs.forEach(ensureDir);

// 拷贝输入模板（不覆盖已存在文件）
function seed(srcTplName, dstPath) {
  if (!existsSync(dstPath) && existsSync(tpl(srcTplName))) copyFileSync(tpl(srcTplName), dstPath);
}
seed('REQUIREMENT-DOC.template.md', join(projectRoot, 'requirements', 'REQUIREMENT.md'));
seed('materials-README.template.md', join(projectRoot, 'materials', 'README.md'));
seed('SPEC.template.md', join(loop, 'SPEC.md'));
seed('longterm.template.md', join(loop, 'memory', 'longterm.md'));

// 初始化 state.json（含需求夹/资料夹路径）
const st = readState(projectRoot);
st.env.requirementsDir = 'requirements';
st.env.materialsDir = 'materials';
if (!st.env.docsDir) st.env.docsDir = 'materials';
writeState(st, projectRoot);

console.log('embedded-loop 脚手架已创建于: ' + projectRoot);
console.log('  requirements/REQUIREMENT.md  ← 在这里写需求（已放模板）');
console.log('  materials/README.md          ← 在这里放资料 / 列资料位置（PDF/网址）');
console.log('  .embedded-loop/              ← 框架工作区（SPEC/state/tests/boards/...）');
console.log('下一步：填好 requirements/ 与 materials/ 后运行 /embedded-loop:run');
