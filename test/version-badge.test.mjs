import assert from 'node:assert/strict';
import { test } from 'node:test';
import { loadVersionBadge } from '../public/version-badge.js';
import { bindHealthCheck } from '../public/health-status.js';
const payload = { ok: true, app: 'aleph-defense-starter', version: '1.0.0', commit: 'abc1234', env: 'production', checkedAt: '2026-10-13T00:00:00.000Z' };
test('badge loads without authentication and shows only validated public fields', async () => {
  const element = { textContent: '' };
  let resolve;
  const pending = loadVersionBadge(element, { fetchFn: (path, options) => {
    assert.equal(path, '/api/version'); assert.equal(options.credentials, 'omit'); assert.equal(options.headers, undefined);
    return new Promise(done => { resolve = done; });
  } });
  assert.match(element.textContent, /불러오는 중/);
  resolve({ status: 200, async json() { return payload; } }); await pending;
  assert.equal(element.textContent, '버전 v1.0.0 · 커밋 abc1234 · production');
});
test('badge rejects HTTP failure, malformed JSON and unexpected response shape', async () => {
  for (const response of [ { status: 503 },
    { status: 200, async json() { throw new Error('internal'); } },
    { status: 200, async json() { return { ...payload, commit: 'unsafe-placeholder' }; } },
    { status: 200, async json() { return { ...payload, secret: 'test-only-placeholder' }; } } ]) {
    const element = { textContent: '' }; await loadVersionBadge(element, { fetchFn: async () => response });
    assert.equal(element.textContent, '버전 정보를 불러오지 못했습니다');
  }
});
test('version timeout does not affect the existing health button', async () => {
  const element = { textContent: '' };
  await loadVersionBadge(element, { timeoutMs: 5, fetchFn: (_url, { signal }) => new Promise((_resolve, reject) => {
    signal.addEventListener('abort', () => reject(new Error('abort')), { once: true });
  }) });
  assert.equal(element.textContent, '버전 정보를 불러오지 못했습니다');
  const button = { disabled: false, addEventListener(_event, fn) { this.click = fn; } };
  const status = { textContent: '' };
  bindHealthCheck(button, status, { fetchFn: async () => ({ status: 200, async json() { return { status: 'ok', service: 'notes' }; } }) });
  await button.click(); assert.equal(status.textContent, '서버 응답 정상'); assert.equal(button.disabled, false);
});
