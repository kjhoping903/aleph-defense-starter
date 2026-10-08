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
    let mode = 'get', values;
    const filters = [];
    const matches = row => filters.every(([key, value]) => row[key] === value);
    const q = {
      select() { return q; },
      async insert(row) { if (rows.has(row.id)) return { error: { code: '23505' } }; rows.set(row.id, { ...row }); return { error: null }; },
      update(row) { mode = 'put'; values = row; return q; },
      delete() { mode = 'delete'; return q; },
      eq(k, v) { filters.push([k, v]); return q; },
      async order() { return { data: [...rows.values()].filter(matches), error: null }; },
      async maybeSingle() {
        const row = [...rows.values()].find(matches);
        if (!row) return { data: null, error: null };
        if (mode === 'put') Object.assign(row, values);
        if (mode === 'delete') rows.delete(row.id);
        return { data: row, error: null };
      },
    }; return q;
  },
}) } });
const { default: handler } = await import('../api/materials.js');
test('A/B own CRUD, cross-owner denial, immutable owners, and unauthenticated denial', async () => {
  const oldUrl = process.env.SUPABASE_URL, oldKey = process.env.SUPABASE_SECRET_KEY;
  process.env.SUPABASE_URL = 'https://ozapzbiuvusywjlstfrv.supabase.co';
  process.env.SUPABASE_SECRET_KEY = 'local-test-only';
  const call = async (method, token, id, body) => {
    const response = { setHeader() {}, status(code) { this.code = code; return this; }, json(body) { this.body = body; return this; }, end() { return this; } };
    await handler({ method, headers: { authorization: token }, query: typeof id === 'object' && id !== null ? id : id ? { id } : {}, body }, response);
    return response;
  };
  try {
    rows.clear();
    const accounts = [['Bearer test-A', userA, 'Bearer test-B', userB], ['Bearer test-B', userB, 'Bearer test-A', userA]];
    for (const [token, owner, otherToken, otherOwner] of accounts) {
      const input = { title: 'test-title', body: 'test-content' };
      assert.equal((await call('POST', token, null, { ...input, owner_id: otherOwner })).code, 400);
      const created = await call('POST', token, null, input);
      assert.equal(created.code, 201);
      const id = created.body.id;
      assert.equal(rows.get(id).owner_id, owner);
      assert.equal(rows.get(id).content, input.body);
      assert.equal((await call('GET', otherToken)).body.length, 0);
      assert.deepEqual((await call('GET', token)).body, [{ id, ...input }]);
      assert.deepEqual((await call('GET', token, id)).body, { id, ...input });
      const before = { ...rows.get(id) };
      for (const method of ['GET', 'PUT', 'DELETE']) {
        assert.equal((await call(method, otherToken, id, { title: 'changed', body: 'changed' })).code, 404);
        assert.deepEqual(rows.get(id), before);
      }
      assert.equal((await call('PUT', token, id, { ...input, owner_id: otherOwner })).code, 400);
      assert.deepEqual(rows.get(id), before);
      for (const method of ['GET', 'PUT', 'DELETE']) {
        assert.equal((await call(method, otherToken, { id, owner_id: owner }, input)).code, 400);
        assert.deepEqual(rows.get(id), before);
      }
      const updated = { title: 'updated-title', body: 'updated-content' };
      assert.deepEqual((await call('PUT', token, id, updated)).body, { id, ...updated });
      assert.equal(rows.get(id).owner_id, owner);
      assert.equal((await call('POST', otherToken, null, { id, ...input })).code, 409);
      assert.equal(rows.get(id).owner_id, owner);
      assert.equal((await call('DELETE', token, id)).code, 204);
      for (const method of ['GET', 'PUT', 'DELETE']) {
        assert.equal((await call(method, token, id, input)).code, 404);
      }
    }
    const id = 'cccccccc-cccc-4ccc-8ccc-cccccccccccc';
    for (const method of ['GET', 'POST', 'PUT', 'DELETE']) assert.equal((await call(method, undefined, method === 'POST' ? null : id)).code, 401);
  } finally {
    if (oldUrl === undefined) delete process.env.SUPABASE_URL; else process.env.SUPABASE_URL = oldUrl;
    if (oldKey === undefined) delete process.env.SUPABASE_SECRET_KEY; else process.env.SUPABASE_SECRET_KEY = oldKey;
  }
});
