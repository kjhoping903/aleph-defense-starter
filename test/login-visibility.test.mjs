import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { test } from 'node:test';
import vm from 'node:vm';

const source = (await readFile(new URL('../public/login.js', import.meta.url), 'utf8'))
  .replace(/^import .*;\n/, '');

async function screen(session, response) {
  const elements = new Map();
  const element = () => ({ hidden: false, textContent: '', disabled: false,
    addEventListener() {}, replaceChildren(...children) { this.children = children; },
    append(...children) { this.children = [...(this.children ?? []), ...children]; } });
  let requests = 0;
  const context = vm.createContext({
    document: { querySelector(id) { if (!elements.has(id)) elements.set(id, element()); return elements.get(id); },
      createElement: element },
    createClient: () => ({ auth: { onAuthStateChange() {},
      async getSession() { return { data: { session } }; } } }),
    fetch: async () => { requests++; return response; },
    setTimeout, Error,
  });
  await vm.runInContext('(async () => {' + source + '})()', context);
  return { elements, requests };
}

test('signed-out screen hides notes and never requests the DB', async () => {
  const { elements, requests } = await screen(null);
  assert.equal(requests, 0);
  assert.equal(elements.get('#cards').hidden, true);
  assert.equal(elements.get('#note-form').hidden, true);
});

test('DB configuration failure hides editor; successful list enables CRUD controls', async () => {
  const session = { access_token: 'local-test-only' };
  const failed = await screen(session, { ok: false, status: 503,
    async json() { return { error: 'DATABASE_CONFIG_UNAVAILABLE' }; } });
  assert.equal(failed.elements.get('#cards').hidden, true);
  assert.equal(failed.elements.get('#note-form').hidden, true);
  assert.match(failed.elements.get('#auth-status').textContent, /HTTP 503, DATABASE_CONFIG_UNAVAILABLE/);
  const ready = await screen(session, { ok: true, status: 200,
    async json() { return [{ id: 'local-fixture', title: 'test-title', body: 'test-content' }]; } });
  assert.equal(ready.elements.get('#cards').hidden, false);
  assert.equal(ready.elements.get('#note-form').hidden, false);
  const buttons = ready.elements.get('#cards').children[0].children.slice(2);
  assert.deepEqual(buttons.map(button => button.textContent), ['수정', '삭제']);
});
