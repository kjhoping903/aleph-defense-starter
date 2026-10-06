import assert from 'node:assert/strict';
import { test } from 'node:test';
import { mkdtemp, mkdir, writeFile, readFile, cp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { execFileSync } from 'node:child_process';
import { deploymentIdentity } from '../scripts/deployment-identity.mjs';
import { runAttackChecks } from '../src/attack-check.mjs';

test('step 2 clears stale output and rejects reintroduced source notes', async () => {
  const root = await mkdtemp(join(tmpdir(), 'step2-'));
  try {
    await cp(resolve('scripts'), join(root, 'scripts'), { recursive: true });
    await mkdir(join(root, 'public'));
    await writeFile(join(root, 'aleph.config.json'), JSON.stringify({ step: 2, sampleMarker: 'SAMPLE_NOTE_1' }));
    await writeFile(join(root, 'data.json'), JSON.stringify({ notes: [] }));
    await writeFile(join(root, 'public/data.json'), JSON.stringify({ notes: [{ content: 'stale-test-value' }] }));
    execFileSync(process.execPath, [join(root, 'scripts/build-public.mjs'), '--local'], { windowsHide: true });
    assert.deepEqual(JSON.parse(await readFile(join(root, 'public/data.json'), 'utf8')).notes, []);
    await writeFile(join(root, 'data.json'), JSON.stringify({ notes: [{ content: 'test-value' }] }));
    assert.throws(() => execFileSync(process.execPath, [join(root, 'scripts/build-public.mjs'), '--local'], { windowsHide: true, stdio: 'pipe' }));
  } finally { await rm(root, { recursive: true, force: true }); }
});

test('step 2 identity retains actual deployment metadata', () => {
  const config = { step: 2, judgeIssuer: 'https://aleph-judge-production.up.railway.app/defense/judge', sampleMarker: 'SAMPLE_NOTE_1' };
  assert.equal(deploymentIdentity({ VERCEL_GIT_PROVIDER: 'github', VERCEL_GIT_REPO_OWNER: 'student', VERCEL_GIT_REPO_SLUG: 'vault', VERCEL_GIT_COMMIT_SHA: 'a'.repeat(40), VERCEL_URL: 'vault.vercel.app' }, config).step, 2);
});

test('self-check reports old deployment and request failures', async () => {
  const saved = globalThis.fetch;
  try {
    globalThis.fetch = async () => new Response(JSON.stringify({ notes: [{}], step: 1 }), { status: 200 });
    const config = { step: 2, publicAppUrl: 'https://vault.vercel.app' };
    const results = await runAttackChecks(config);
    assert.match(results.find(x => x.attackId === 'data_json').observed, /메모 건수 1/u);
    assert.match(results.find(x => x.attackId === 'aleph_json').observed, /단계 1/u);
    globalThis.fetch = async () => { throw new Error('offline'); };
    assert.ok((await runAttackChecks(config)).every(x => x.observed.includes('요청 실패')));
  } finally { globalThis.fetch = saved; }
});
