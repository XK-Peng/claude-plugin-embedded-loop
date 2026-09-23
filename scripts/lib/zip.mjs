// 零依赖 zip 读取器（只读）。用途：从 CMSIS .pack（本质是 zip）里取出 .pdsc / .svd 文本。
// 只支持 store(0) 与 deflate(8) 两种压缩方式，足够覆盖 .pack。
import { readFileSync } from 'node:fs';
import { inflateRawSync } from 'node:zlib';

function findEOCD(buf) {
  // End Of Central Directory 签名 0x06054b50，位于文件尾部（最多 64KB 注释）
  const min = Math.max(0, buf.length - 65557);
  for (let i = buf.length - 22; i >= min; i--) {
    if (buf.readUInt32LE(i) === 0x06054b50) return i;
  }
  return -1;
}

export function listZip(path) {
  const buf = readFileSync(path);
  const eocd = findEOCD(buf);
  if (eocd < 0) throw new Error('not a zip: ' + path);
  const count = buf.readUInt16LE(eocd + 10);
  let p = buf.readUInt32LE(eocd + 16);
  const entries = [];
  for (let i = 0; i < count; i++) {
    if (buf.readUInt32LE(p) !== 0x02014b50) break;
    const method = buf.readUInt16LE(p + 10);
    const csize = buf.readUInt32LE(p + 20);
    const nlen = buf.readUInt16LE(p + 28);
    const elen = buf.readUInt16LE(p + 30);
    const clen = buf.readUInt16LE(p + 32);
    const local = buf.readUInt32LE(p + 42);
    const name = buf.slice(p + 46, p + 46 + nlen).toString('utf8');
    entries.push({ name, method, csize, local });
    p += 46 + nlen + elen + clen;
  }
  return { buf, entries };
}

export function readZipEntry(zip, entry) {
  const { buf } = zip;
  const lp = entry.local;
  if (buf.readUInt32LE(lp) !== 0x04034b50) throw new Error('bad local header');
  const nlen = buf.readUInt16LE(lp + 26);
  const elen = buf.readUInt16LE(lp + 28);
  const start = lp + 30 + nlen + elen;
  const data = buf.slice(start, start + entry.csize);
  if (entry.method === 0) return data;
  if (entry.method === 8) return inflateRawSync(data);
  throw new Error('unsupported zip method ' + entry.method);
}

// 便捷：取第一个匹配后缀的条目文本
export function readFirstText(path, suffixRx) {
  const zip = listZip(path);
  const e = zip.entries.find((x) => suffixRx.test(x.name));
  if (!e) return null;
  return { name: e.name, text: readZipEntry(zip, e).toString('utf8') };
}
