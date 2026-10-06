import { readFileSync } from 'node:fs';
import { randomUUID } from 'node:crypto';
import { createClient } from '@supabase/supabase-js';
import { createLoginVerifier } from '../src/verify-login.mjs';

const config = JSON.parse(readFileSync(new URL('../aleph.config.json', import.meta.url), 'utf8'));
let verifyLogin;
let database;

// Only the unchanged starter verifier establishes identity. Query/body claims are ignored.
export default async function handler(request, response) {
  response.setHeader('Cache-Control', 'no-store');
  const id = request.query?.id;
  const methods = id === undefined ? ['GET', 'POST'] : ['GET', 'PUT', 'DELETE'];
  if (!methods.includes(request.method)) {
    response.setHeader('Allow', methods.join(', '));
    return response.status(405).json({ error: 'METHOD_NOT_ALLOWED' });
  }
  const authorization = request.headers?.authorization;
  if (typeof authorization !== 'string' || !authorization) {
    return response.status(401).json({ error: 'UNAUTHORIZED' });
  }
  let identity;
  try {
    if (!verifyLogin) {
      const supabaseClient = createClient(new URL(config.identityProvider.issuer).origin,
        'sb_publishable_AHnLVsVSJoz3xIxl0OfTCA_tqEKaKIG', {
          auth: { autoRefreshToken: false, persistSession: false, detectSessionInUrl: false },
        });
      verifyLogin = createLoginVerifier({ config, supabaseClient });
    }
    identity = await verifyLogin(authorization);
  } catch {
    // Configuration failures must not expose cards or server secrets.
    return response.status(503).json({ error: 'LOGIN_VERIFIER_UNAVAILABLE' });
  }
  if (!identity) return response.status(401).json({ error: 'UNAUTHORIZED' });
  const uuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
  if (id !== undefined && (typeof id !== 'string' || !uuid.test(id))) return response.status(400).json({ error: 'INVALID_ID' });
  let input;
  if (['POST', 'PUT'].includes(request.method)) {
    try { input = typeof request.body === 'string' ? JSON.parse(request.body) : request.body; } catch {}
    if (!input || typeof input.title !== 'string' || !input.title.trim() || input.title.length > 200
      || typeof input.body !== 'string' || !input.body.trim() || input.body.length > 10000
      || (request.method === 'POST' && input.id !== undefined && (typeof input.id !== 'string' || !uuid.test(input.id)))) {
      return response.status(400).json({ error: 'INVALID_NOTE' });
    }
  }
  try {
    if (!database) {
      const url = process.env.SUPABASE_URL;
      const secret = process.env.SUPABASE_SECRET_KEY;
      if (url !== new URL(config.identityProvider.issuer).origin || !secret) {
        return response.status(503).json({ error: 'DATABASE_CONFIG_UNAVAILABLE' });
      }
      database = createClient(url, secret, {
        auth: { autoRefreshToken: false, persistSession: false, detectSessionInUrl: false },
      });
    }
    const table = () => database.from('learning_notes');
    const note = row => ({ id: row.id, title: row.title, body: row.content });
    if (request.method === 'POST') {
      const newId = input.id ?? randomUUID();
      const { error } = await table().insert({ id: newId, title: input.title, content: input.body, owner_id: identity.userId });
      if (error) return response.status(error.code === '23505' ? 409 : 503).json({ error: 'NOTE_CREATE_FAILED' });
      return response.status(201).json({ id: newId });
    }
    // Stage 4 will add owner checks to single-note operations.
    if (id !== undefined) {
      let query = request.method === 'GET' ? table().select('id,title,content')
        : request.method === 'PUT' ? table().update({ title: input.title, content: input.body }).select('id,title,content')
        : table().delete().select('id');
      const { data, error } = await query.eq('id', id).maybeSingle();
      if (error) return response.status(503).json({ error: 'NOTE_OPERATION_FAILED' });
      if (!data) return response.status(404).json({ error: 'NOT_FOUND' });
      if (request.method === 'DELETE') return response.status(204).end();
      return response.status(200).json(note(data));
    }
    const { data, error } = await table().select('id,title,content')
      .eq('owner_id', identity.userId).order('created_at', { ascending: true });
    if (error || !Array.isArray(data)) return response.status(503).json({ error: 'MATERIALS_READ_FAILED' });
    return response.status(200).json(data.map(note));
  } catch {
    return response.status(503).json({ error: 'MATERIALS_READ_FAILED' });
  }
}
