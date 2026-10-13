import assert from 'node:assert/strict';
import { test } from 'node:test';
import { readFileSync } from 'node:fs';
import { buildVersionInfo } from '../src/version-info.mjs';
import handler from '../api/version.js';
const now = new Date('2026-10-13T00:00:00.000Z'); // Deterministic fixture clock, not an execution timestamp.
const keys = ['app','checkedAt','commit','env','ok','version'];
test('V1 Vercel public fields shorten commit and select environment', () => {
  for (const env of ['production','preview','development']) {
    const info = buildVersionInfo({ VERCEL_GIT_COMMIT_SHA: 'abcdef0123456789'.repeat(2) + 'abcdef01', VERCEL_ENV: env }, now);
    assert.equal(info.commit, 'abcdef0'); assert.equal(info.env, env);
  }
});
test('V2 absent or invalid public fields fall back to local', () => {
  for (const env of [{}, { VERCEL_GIT_COMMIT_SHA: 'unsafe-placeholder', VERCEL_ENV: 'unsafe-placeholder' }]) {
    const info = buildVersionInfo(env, now); assert.equal(info.commit, 'local'); assert.equal(info.env, 'local');
  }
});
test('V3 exact allowlist excludes injected sensitive fields and values', () => {
  const env = { SUPABASE_SECRET_KEY: 'private-test-placeholder', DATABASE_URL: 'private-db-placeholder' };
  Object.defineProperty(env, 'UNLISTED_SECRET', { get() { throw new Error('unlisted field accessed'); } });
  const info = buildVersionInfo(env, now);
  assert.deepEqual(Object.keys(info).sort(), keys);
  const json = JSON.stringify(info); assert.ok(!json.includes('private-test-placeholder'));
  assert.ok(!json.includes('private-db-placeholder')); assert.ok(!json.includes('SUPABASE_SECRET_KEY'));
  assert.ok(!json.includes('DATABASE_URL'));
});
test('V4 payload identifies package and uses a deterministic valid ISO timestamp', () => {
  const pkg = JSON.parse(readFileSync(new URL('../package.json', import.meta.url), 'utf8'));
  const info = buildVersionInfo({}, now);
  assert.equal(info.ok, true); assert.equal(info.app, pkg.name); assert.equal(info.version, pkg.version);
  assert.equal(info.checkedAt, now.toISOString()); assert.equal(new Date(info.checkedAt).toISOString(), info.checkedAt);
  const response = { setHeader() {}, status(code) { this.code=code; return this; }, json(body) { this.body=body; return this; } };
  handler({ method: 'GET' }, response); assert.equal(response.code, 200); assert.deepEqual(Object.keys(response.body).sort(), keys);
});
test('V5 non-GET requests return 405 without version payload', () => {
  for (const method of ['POST','PUT','DELETE','PATCH','HEAD','OPTIONS']) {
    const response = { headers: {}, setHeader(k,v) { this.headers[k]=v; }, status(code) { this.code=code; return this; }, json(body) { this.body=body; return this; } };
    handler({ method }, response); assert.equal(response.code, 405);
    assert.equal(response.headers.Allow, 'GET'); assert.deepEqual(response.body, { error: 'METHOD_NOT_ALLOWED' });
  }
});

