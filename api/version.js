import { buildVersionInfo } from '../src/version-info.mjs';
export default function handler(request, response) {
  response.setHeader('Cache-Control', 'no-store');
  response.setHeader('X-Content-Type-Options', 'nosniff');
  if (request.method !== 'GET') {
    response.setHeader('Allow', 'GET');
    return response.status(405).json({ error: 'METHOD_NOT_ALLOWED' });
  }
  const env = {
    VERCEL_GIT_COMMIT_SHA: process.env.VERCEL_GIT_COMMIT_SHA,
    VERCEL_ENV: process.env.VERCEL_ENV,
  };
  return response.status(200).json(buildVersionInfo(env, new Date()));
}

