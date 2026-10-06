import { readFileSync } from 'node:fs';
import { createClient } from '@supabase/supabase-js';
import { createLoginVerifier } from '../src/verify-login.mjs';

const config = JSON.parse(readFileSync(new URL('../aleph.config.json', import.meta.url), 'utf8'));
let verifyLogin;

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
  return response.status(200).json({
    cards: [{
      title: '자료 이전 준비',
      content: '공개 정적 메모는 제거했습니다. Supabase SQL 실행과 검증은 별도로 필요합니다. 현재 API는 메모 본문을 제공하지 않습니다.',
    }],
  });
}
