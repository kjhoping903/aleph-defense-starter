import assert from 'node:assert/strict';
import { test } from 'node:test';
import authConfig from '../api/auth-config.js';

test('browser configuration excludes secret key and refuses secret-shaped publishable key', () => {
  const old = process.env.SUPABASE_PUBLISHABLE_KEY;
  const oldSecret = process.env.SUPABASE_SECRET_KEY;
  const response = { setHeader() {}, status(code) { this.code = code; return this; }, json(body) { this.body = body; return this; } };
  try {
    process.env.SUPABASE_SECRET_KEY = 'test-server-only-value';
    delete process.env.SUPABASE_PUBLISHABLE_KEY;
    authConfig({ method: 'GET' }, response);
    assert.equal(response.code, 503);
    process.env.SUPABASE_PUBLISHABLE_KEY = 'sb_secret_test';
    authConfig({ method: 'GET' }, response);
    assert.equal(response.code, 503);
    process.env.SUPABASE_PUBLISHABLE_KEY = 'sb_publishable_test';
    authConfig({ method: 'GET' }, response);
    assert.equal(response.code, 200);
    assert.equal(response.body.url, 'https://ozapzbiuvusywjlstfrv.supabase.co');
    assert.ok(!JSON.stringify(response.body).includes('test-server-only-value'));
    authConfig({ method: 'POST' }, response);
    assert.equal(response.code, 405);
  } finally {
    if (old === undefined) delete process.env.SUPABASE_PUBLISHABLE_KEY;
    else process.env.SUPABASE_PUBLISHABLE_KEY = old;
    if (oldSecret === undefined) delete process.env.SUPABASE_SECRET_KEY;
    else process.env.SUPABASE_SECRET_KEY = oldSecret;
  }
});
