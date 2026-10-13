import { readFileSync, readdirSync } from 'node:fs';
import { join } from 'node:path';
const paths = ['handover.md', 'package.json', 'package-lock.json', ...readdirSync('docs').filter(p => /[.](?:md|json)$/u.test(p)).map(p => join('docs', p)),
  ...readdirSync('evidence').filter(p => /[.](?:md|json)$/u.test(p)).map(p => join('evidence', p))];
for (const path of paths) {
  const bytes = readFileSync(path);
  if (bytes[0] === 0xef && bytes[1] === 0xbb && bytes[2] === 0xbf) throw new Error(path + ': UTF-8 BOM');
  const text = new TextDecoder('utf-8', { fatal: true }).decode(bytes);
  if (text.includes(String.fromCharCode(0xfffd)) || /[?]{2,}/u.test(text)) throw new Error(path + ': damaged text');
  if (path.endsWith('.json')) JSON.parse(text);
}
console.log('UTF-8 without BOM, no damaged text, JSON parsed: ' + paths.length + ' files');
