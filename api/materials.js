import { readFileSync } from 'node:fs';
import { createClient } from '@supabase/supabase-js';
import { createLoginVerifier } from '../src/verify-login.mjs';

const config = JSON.parse(readFileSync(new URL('../aleph.config.json', import.meta.url), 'utf8'));
let verifyLogin;
let database;

// Only the unchanged starter verifier establishes identity. Query/body claims are ignored.
export default async function handler(request, response) {
  response.setHeader('Cache-Control', 'no-store');
  if (request.method !== 'GET') {
    response.setHeader('Allow', 'GET');
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
    // This stage allows any verified login to read learning notes.
    // Per-owner authorization is a later stage; never trust request userId/role.
    const { data, error } = await database.from('learning_notes')
      .select('title,content').order('created_at', { ascending: true }).limit(100);
    if (error || !Array.isArray(data)) return response.status(503).json({ error: 'MATERIALS_READ_FAILED' });
    return response.status(200).json({ cards: data });
  } catch {
    return response.status(503).json({ error: 'MATERIALS_READ_FAILED' });
  }
}
