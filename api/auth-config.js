import { readFileSync } from 'node:fs';
const config = JSON.parse(readFileSync(new URL('../aleph.config.json', import.meta.url), 'utf8'));
export default function handler(request, response) {
  response.setHeader('Cache-Control', 'no-store');
  if (request.method !== 'GET') {
    response.setHeader('Allow', 'GET');
    return response.status(405).json({ error: 'METHOD_NOT_ALLOWED' });
  }
  const publishableKey = process.env.SUPABASE_PUBLISHABLE_KEY;
  // Accept only modern browser-safe keys; never fall back to a secret/service key.
  if (!/^sb_publishable_[A-Za-z0-9_-]+$/.test(publishableKey ?? '') || !config.identityProvider?.issuer) {
    return response.status(503).json({ error: 'LOGIN_CONFIG_UNAVAILABLE' });
  }
  return response.status(200).json({ url: new URL(config.identityProvider.issuer).origin, publishableKey });
}
