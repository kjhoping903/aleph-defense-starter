// The student changes this check as each stage adds an attack to the same app.
// Never return tokens, private keys, real names, or note bodies.
export async function runAttackChecks(config) {
  if (![1, 2].includes(config.step)) throw new Error('이 단계의 공격 점검을 src/attack-check.mjs에 구현해 주세요.');
  let app;
  try {
    app = new URL(config.publicAppUrl);
  } catch {
    throw new Error('aleph.config.json의 실제 배포 주소를 먼저 넣어 주세요.');
  }
  if (app.protocol !== 'https:' || app.username || app.password || app.search || app.hash
      || app.pathname !== '/' || app.hostname.endsWith('.example')) {
    throw new Error('aleph.config.json의 실제 배포 주소를 먼저 넣어 주세요.');
  }
  if (config.step === 2) {
    const results = [];
    for (const path of ['/', '/data.json', '/aleph.json', '/api/ai', '/api/threat-intel']) {
      const expected = path === '/' ? 'HTTP 200 및 자료 이전 안내 화면' : path === '/data.json'
        ? 'HTTP 200 JSON이며 notes가 빈 배열' : path === '/aleph.json'
        ? '실제 저장소 및 현재 커밋과 일치하는 2단계 배포 정보' : '미구현 API는 HTTP 501로 자료를 반환하지 않음';
      let observed;
      try {
        const response = await fetch(new URL(path, app), { redirect: 'error', credentials: 'omit', signal: AbortSignal.timeout(10000) });
        const text = await response.text();
        if (path === '/') observed = `HTTP ${response.status}; 이전 안내 ${text.includes('Supabase SQL Editor') ? '있음' : '없음'}`;
        else if (path === '/data.json') {
          let data; try { data = JSON.parse(text); } catch {}
          observed = `HTTP ${response.status}; 메모 건수 ${Array.isArray(data?.notes) ? data.notes.length : '형식 오류'}`;
        } else if (path === '/aleph.json') {
          let data; try { data = JSON.parse(text); } catch {}
          observed = `HTTP ${response.status}; 단계 ${data?.step ?? '없음'}; 저장소 ${data?.repoUrl === config.repoUrl ? '일치' : '불일치'}; 현재 커밋 ${data?.commit === config.expectedCommit ? '일치' : '불일치'}`;
        } else observed = `HTTP ${response.status}; 미구현 응답 ${response.status === 501 ? '확인' : '미확인'}`;
      } catch { observed = '요청 실패: 접근 제어 성공으로 판단하지 않음'; }
      results.push({ attackId: path === '/' ? 'public_page' : path.slice(1).replaceAll('/', '_').replaceAll('.', '_'), expected, observed });
    }
    return results;
  }
  if (typeof config.sampleMarker !== 'string' || !config.sampleMarker) throw new Error('가상 메모의 확인 표시를 넣어 주세요.');
  const response = await fetch(new URL('/data.json', app), {
    redirect: 'error', signal: AbortSignal.timeout(10000),
  });
  let visible = false;
  if (response.ok) {
    try {
      const data = await response.json();
      visible = data?.sampleMarker === config.sampleMarker && Array.isArray(data.notes)
        && data.notes.length > 0;
    } catch {
      // A non-JSON response is a failed check, not a successful deployment.
    }
  }
  return [{ attackId: 'anonymous_note_read', expected: '비로그인 화면에서 가상 메모를 확인',
    observed: visible ? '비로그인 요청에서 공개 가상 메모 확인 표시가 보임' : `비로그인 요청에서 확인 표시가 보이지 않음 (HTTP ${response.status})` }];
}
