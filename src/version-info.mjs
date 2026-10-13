import { readFileSync } from 'node:fs';
const { name, version } = JSON.parse(readFileSync(new URL('../package.json', import.meta.url), 'utf8'));
const environments = new Set(['production', 'preview', 'development']);

// Only these two public build fields are read; caller supplies the clock.
export function buildVersionInfo(env, now) {
  const sha = env?.VERCEL_GIT_COMMIT_SHA;
  const environment = env?.VERCEL_ENV;
  return {
    ok: true,
    app: name,
    version,
    commit: typeof sha === 'string' && /^[a-f0-9]{7,64}$/iu.test(sha) ? sha.slice(0, 7).toLowerCase() : 'local',
    env: environments.has(environment) ? environment : 'local',
    checkedAt: new Date(now).toISOString(),
  };
}

