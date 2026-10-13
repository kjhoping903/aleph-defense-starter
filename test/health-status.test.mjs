import assert from 'node:assert/strict';
import { test } from 'node:test';
import { bindHealthCheck } from '../public/health-status.js';
function screen(fetchFn, timeoutMs = 1000) {
  const button = { disabled: false, addEventListener(name, callback) { assert.equal(name, 'click'); this.click = callback; } };
  const status = { textContent: '' };
  bindHealthCheck(button, status, { fetchFn, timeoutMs });
  return { button, status };
}
const healthy = () => ({ status: 200, async json() { return { status: 'ok', service: 'notes' }; } });
test('button shows pending, prevents duplicate requests, then reports success', async () => {
  let complete, calls = 0;
  const ui = screen((url, options) => {
    calls++; assert.equal(url, '/api/health'); assert.equal(options.credentials, 'omit');
    assert.equal(options.cache, 'no-store'); assert.equal(options.headers, undefined);
    return new Promise(resolve => { complete = resolve; });
  });
  const pending = ui.button.click();
  assert.equal(ui.button.disabled, true); assert.match(ui.status.textContent, /확인하는 중/);
  await ui.button.click(); assert.equal(calls, 1);
  complete(healthy()); await pending;
  assert.equal(ui.status.textContent, '서버 응답 정상'); assert.equal(ui.button.disabled, false);
});
test('HTTP error allows retry and successful retry updates status', async () => {
  let calls = 0;
  const ui = screen(async () => ++calls === 1 ? { status: 503 } : healthy());
  await ui.button.click(); assert.match(ui.status.textContent, /확인하지 못/); assert.equal(ui.button.disabled, false);
  await ui.button.click(); assert.equal(ui.status.textContent, '서버 응답 정상');
});
test('invalid JSON and unexpected bodies are never displayed as healthy', async () => {
  for (const response of [
    { status: 200, async json() { throw new SyntaxError('invalid JSON'); } },
    { status: 200, async json() { return { status: 'ok', service: 'other' }; } },
    { status: 200, async json() { return { status: 'ok', service: 'notes', extra: true }; } },
  ]) {
    const ui = screen(async () => response); await ui.button.click();
    assert.match(ui.status.textContent, /확인하지 못/); assert.equal(ui.button.disabled, false);
  }
});
test('network error is recoverable and does not display internal error text', async () => {
  const ui = screen(async () => { throw new Error('internal diagnostic'); });
  await ui.button.click(); assert.match(ui.status.textContent, /다시 시도/);
  assert.ok(!ui.status.textContent.includes('internal diagnostic')); assert.equal(ui.button.disabled, false);
});
test('timeout aborts request and restores button for retry', async () => {
  const ui = screen((_url, { signal }) => new Promise((_resolve, reject) => {
    signal.addEventListener('abort', () => reject(new Error('aborted')), { once: true });
  }), 5);
  await ui.button.click(); assert.match(ui.status.textContent, /시간 초과/); assert.equal(ui.button.disabled, false);
});
