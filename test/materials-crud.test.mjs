import { test, mock } from 'node:test';
import assert from 'node:assert/strict';
const rows = new Map();
const userA = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa';
const userB = 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb';
mock.module('../src/verify-login.mjs', { namedExports: {
  createLoginVerifier: () => async token => token === 'Bearer test-A' ? { userId: userA } : token === 'Bearer test-B' ? { userId: userB } : null,
} });
mock.module('@supabase/supabase-js', { namedExports: { createClient: () => ({
  from() {
    let mode = 'get', values, key, value;
    const q = {
      select() { return q; },
      async insert(row) { rows.set(row.id, { ...row }); return { error: null }; },
      update(row) { mode = 'put'; values = row; return q; },
      delete() { mode = 'delete'; return q; },
      eq(k, v) { key = k; value = v; return q; },
      async order() { return { data: [...rows.values()].filter(row => row[key] === value), error: null }; },
      async maybeSingle() {
        const row = rows.get(value);
        if (!row) return { data: null, error: null };
        if (mode === 'put') Object.assign(row, values);
        if (mode === 'delete') rows.delete(value);
        return { data: row, error: null };
      },
    }; return q;
  },
}) } });
const { default: handler } = await import('../api/materials.js');
test('CRUD mapping, server owner, own list, missing rows, and documented cross-owner gap', async () => {
  const oldUrl = process.env.SUPABASE_URL, oldKey = process.env.SUPABASE_SECRET_KEY;
  process.env.SUPABASE_URL = 'https://ozapzbiuvusywjlstfrv.supabase.co';
  process.env.SUPABASE_SECRET_KEY = 'local-test-only';
  const call = async (method, token, id, body) => {
    const response = { setHeader() {}, status(code) { this.code = code; return this; }, json(body) { this.body = body; return this; }, end() { return this; } };
    await handler({ method, headers: { authorization: token }, query: id ? { id } : {}, body }, response);
    return response;
  };
  try {
    const created = await call('POST', 'Bearer test-A', null, { title: 'test-title', body: 'test-content', owner_id: userB });
    assert.equal(created.code, 201);
    const id = created.body.id;
    assert.equal(rows.get(id).owner_id, userA);
    assert.equal(rows.get(id).content, 'test-content');
    assert.equal((await call('GET', 'Bearer test-B')).body.length, 0);
    assert.equal((await call('GET', 'Bearer test-A')).body.length, 1);
    assert.deepEqual((await call('GET', 'Bearer test-A', id)).body, { id, title: 'test-title', body: 'test-content' });
    assert.equal((await call('PUT', 'Bearer test-B', id, { title: 'changed', body: 'changed' })).code, 200);
    assert.equal(rows.get(id).owner_id, userA);
    assert.equal((await call('DELETE', 'Bearer test-A', id)).code, 204);
    assert.equal((await call('GET', 'Bearer test-A', id)).code, 404);
    for (const method of ['GET', 'POST', 'PUT', 'DELETE']) assert.equal((await call(method, undefined, method === 'POST' ? null : id)).code, 401);
  } finally {
    if (oldUrl === undefined) delete process.env.SUPABASE_URL; else process.env.SUPABASE_URL = oldUrl;
    if (oldKey === undefined) delete process.env.SUPABASE_SECRET_KEY; else process.env.SUPABASE_SECRET_KEY = oldKey;
  }
});
