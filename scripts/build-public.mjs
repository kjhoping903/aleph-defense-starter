import { mkdir, readFile, writeFile, rm } from 'node:fs/promises';
import { resolve } from 'node:path';
import { deploymentIdentity } from './deployment-identity.mjs';
const root = resolve(import.meta.dirname, '..');
const config = JSON.parse(await readFile(resolve(root, 'aleph.config.json'), 'utf8'));
const data = JSON.parse(await readFile(resolve(root, 'data.json'), 'utf8'));
if (![1, 2, 3].includes(config.step) || !Array.isArray(data.notes)) throw new Error('지원 단계와 자료 형식을 확인하세요.');
if (config.step >= 2 && data.notes.length !== 0) throw new Error('원본 data.json에 메모를 남기지 마세요.');
await mkdir(resolve(root, 'public'), { recursive: true });
const publicData = config.step >= 2 ? { notes: [] } : data;
await writeFile(resolve(root, 'public/data.json'), `${JSON.stringify(publicData, null, 2)}\n`, 'utf8');
if (process.argv.includes('--local')) {
  await rm(resolve(root, 'public/aleph.json'), { force: true });
  console.log('로컬 정적 파일 생성 완료. 배포 또는 DB 실행 증빙은 아닙니다.');
} else {
  const identity = deploymentIdentity(process.env, config);
  if (config.step >= 2 && identity.repoUrl !== config.repoUrl) throw new Error('배포 저장소와 설정 저장소가 다릅니다.');
  await writeFile(resolve(root, 'public/aleph.json'), `${JSON.stringify(identity, null, 2)}\n`, 'utf8');
  console.log('공개 자료와 실제 Vercel 배포 식별 정보 생성 완료.');
}
