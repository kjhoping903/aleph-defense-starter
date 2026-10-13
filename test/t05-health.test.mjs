import assert from 'node:assert/strict';
import { test } from 'node:test';
import handler from '../api/health.js';
function call(method = 'GET', extra = {}) {
  const response = { headers: {}, setHeader(k, v) { this.headers[k] = v; },
    status(code) { this.code = code; return this; }, json(body) { this.body = body; return this; } };
  handler({ ...extra, method }, response);
  return response;
}
const expected = { status: 'ok', service: 'notes' };
test('T05-01 GET returns 200 and exact public liveness body', () => {
  const r = call(); assert.equal(r.code, 200); assert.deepEqual(r.body, expected);
});
test('T05-02 GET is not cached', () => assert.equal(call().headers['Cache-Control'], 'no-store'));
test('T05-03 GET prevents content sniffing', () => assert.equal(call().headers['X-Content-Type-Options'], 'nosniff'));
for (const [id, method] of [['04','POST'], ['05','PUT'], ['06','DELETE'], ['07','PATCH']]) {
  test('T05-' + id + ' ' + method + ' is rejected with 405 and only an error', () => {
    const r = call(method); assert.equal(r.code, 405); assert.deepEqual(r.body, { error: 'METHOD_NOT_ALLOWED' });
  });
}
test('T05-08 unsupported methods advertise GET and retain protective headers', () => {
  for (const method of ['POST','PUT','DELETE','PATCH','HEAD','OPTIONS']) {
    const r = call(method); assert.equal(r.code, 405); assert.equal(r.headers.Allow, 'GET');
    assert.equal(r.headers['Cache-Control'], 'no-store'); assert.equal(r.headers['X-Content-Type-Options'], 'nosniff');
  }
});
test('T05-09 untrusted query body and authorization do not change or enter response', () => {
  const r = call('GET', { query: { service: 'injected' }, body: { status: 'injected' },
    headers: { authorization: 'test-only-placeholder' } });
  assert.equal(r.code, 200); assert.deepEqual(r.body, expected);
});
test('T05-10 server environment value is never returned', () => {
  const old = process.env.SUPABASE_SECRET_KEY;
  try {
    process.env.SUPABASE_SECRET_KEY = 'test-only-placeholder';
    assert.deepEqual(call().body, expected);
  } finally {
    if (old === undefined) delete process.env.SUPABASE_SECRET_KEY;
    else process.env.SUPABASE_SECRET_KEY = old;
  }
});

