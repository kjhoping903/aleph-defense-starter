export function bindHealthCheck(button, status, { fetchFn = globalThis.fetch, timeoutMs = 5000 } = {}) {
  button.addEventListener('click', async () => {
    if (button.disabled) return;
    button.disabled = true;
    status.textContent = '서버 응답을 확인하는 중입니다.';
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), timeoutMs);
    try {
      const response = await fetchFn('/api/health', {
        method: 'GET', cache: 'no-store', credentials: 'omit', signal: controller.signal,
      });
      if (response.status !== 200) throw new Error('unexpected_status');
      const data = await response.json();
      if (!data || Array.isArray(data) || data.status !== 'ok' || data.service !== 'notes'
        || Object.keys(data).sort().join(',') !== 'service,status') throw new Error('invalid_response');
      status.textContent = '서버 응답 정상';
    } catch {
      status.textContent = controller.signal.aborted
        ? '서버 확인 시간 초과. 다시 시도하세요.'
        : '서버 응답을 확인하지 못했습니다. 다시 시도하세요.';
    } finally {
      clearTimeout(timer);
      button.disabled = false;
    }
  });
}

if (typeof document !== 'undefined') {
  const button = document.querySelector('#health-check');
  const status = document.querySelector('#health-status');
  if (button && status) bindHealthCheck(button, status);
}
