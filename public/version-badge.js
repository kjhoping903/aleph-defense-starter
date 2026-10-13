const environments = new Set(['production', 'preview', 'development', 'local']);
export async function loadVersionBadge(element, { fetchFn = globalThis.fetch, timeoutMs = 5000 } = {}) {
  element.textContent = '버전 정보를 불러오는 중입니다.';
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const response = await fetchFn('/api/version', {
      method: 'GET', cache: 'no-store', credentials: 'omit', signal: controller.signal,
    });
    if (response.status !== 200) throw new Error('unexpected_status');
    const data = await response.json();
    if (!data || Array.isArray(data)
      || Object.keys(data).sort().join(',') !== 'app,checkedAt,commit,env,ok,version'
      || data.ok !== true || typeof data.app !== 'string' || !data.app
      || typeof data.version !== 'string' || !/^[0-9]+[.][0-9]+[.][0-9]+(?:[-+][a-z0-9.-]+)?$/iu.test(data.version)
      || typeof data.commit !== 'string' || !/^(?:[a-f0-9]{7}|local)$/u.test(data.commit)
      || !environments.has(data.env) || typeof data.checkedAt !== 'string'
      || !Number.isFinite(Date.parse(data.checkedAt))) throw new Error('invalid_response');
    element.textContent = '버전 v' + data.version + ' · 커밋 ' + data.commit + ' · ' + data.env;
  } catch {
    element.textContent = '버전 정보를 불러오지 못했습니다';
  } finally {
    clearTimeout(timer);
  }
}
if (typeof document !== 'undefined') {
  const badge = document.querySelector('#version-badge');
  if (badge) void loadVersionBadge(badge);
}

