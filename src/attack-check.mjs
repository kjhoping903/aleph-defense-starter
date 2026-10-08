// The student changes this check as each stage adds an attack to the same app.
// Never return tokens, private keys, real names, or note bodies.
export async function runAttackChecks(config) {
  if (![1, 2, 3, 4].includes(config.step)) throw new Error('이 단계의 공격 점검을 src/attack-check.mjs에 구현해 주세요.');
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
  if (config.step === 3 || config.step === 4) {
    const attempts = [];
    for (const [method, path] of [['GET', '/api/notes'], ['POST', '/api/notes'],
      ['GET', '/api/notes/00000000-0000-4000-8000-000000000000'],
      ['PUT', '/api/notes/00000000-0000-4000-8000-000000000000'],
      ['DELETE', '/api/notes/00000000-0000-4000-8000-000000000000'],
      ...(config.step === 4 ? [['GET', '/api/materials'], ['POST', '/api/materials'],
        ['GET', '/api/materials/00000000-0000-4000-8000-000000000000'],
        ['PUT', '/api/materials/00000000-0000-4000-8000-000000000000'],
        ['DELETE', '/api/materials/00000000-0000-4000-8000-000000000000']] : [])]) {
      let observed;
      try {
        const response = await fetch(new URL(path, app), { method, redirect: 'error', credentials: 'omit', signal: AbortSignal.timeout(10000) });
        let data; try { data = await response.json(); } catch {}
        const jsonError = data && !Array.isArray(data) && typeof data.error === 'string' && data.error.length > 0;
        const noMaterials = jsonError && Object.keys(data).every(key => key === 'error');
        observed = '실제 비로그인 요청 HTTP ' + response.status + '; JSON 오류 ' + (jsonError ? '있음' : '없음') + '; 오류만 반환 ' + (noMaterials ? '예' : '아니오');
      } catch { observed = '요청 실패: 차단 성공으로 판단하지 않음'; }
      attempts.push({ attackId: `anonymous_${method.toLowerCase()}_${path.includes('/materials') ? 'materials_' : ''}${path.includes('00000000') ? 'single' : 'list'}`, expected: 'HTTP 401 또는 403, JSON 오류만 반환', observed });
    }
    for (const path of ['/', '/aleph.json', ...(config.step === 4 ? ['/data.json'] : [])]) {
      let observed;
      try {
        const response = await fetch(new URL(path, app), { redirect: 'error', credentials: 'omit', signal: AbortSignal.timeout(10000) });
        if (path === '/') {
          observed = 'HTTP ' + response.status + '; nosniff ' + (response.headers.get('x-content-type-options') === 'nosniff' ? '있음' : '없음') + '; CSP ' + (response.headers.has('content-security-policy') ? '있음' : '없음');
        } else if (path === '/data.json') {
          let data; try { data = await response.json(); } catch {}
          observed = 'HTTP ' + response.status + '; 공개 메모 건수 ' + (Array.isArray(data?.notes) ? data.notes.length : '형식 오류');
        } else {
          let data; try { data = await response.json(); } catch {}
          observed = 'HTTP ' + response.status + '; 단계 ' + (data?.step === config.step ? '일치' : '불일치') + '; 커밋 ' + (data?.commit === config.expectedCommit ? '일치' : '불일치') + '; 발급자 ' + (JSON.stringify(data?.identityProvider) === JSON.stringify(config.identityProvider) ? '일치' : '불일치') + '; 경로 ' + (JSON.stringify(data?.allowedRoutes) === JSON.stringify(config.allowedRoutes) ? '일치' : '불일치');
        }
      } catch { observed = '요청 실패: 성공으로 판단하지 않음'; }
      attempts.push({ attackId: path === '/' ? 'public_security_headers' : path === '/data.json' ? 'public_notes_empty' : 'deployment_manifest', expected: path === '/' ? 'HTTP 200, nosniff 또는 CSP 헤더' : path === '/data.json' ? 'HTTP 200 JSON, notes 빈 배열' : 'HTTP 200 JSON, 현재 단계·커밋·발급자·경로 일치', observed });
    }
    return attempts;
  }
  if (config.step === 2) {
    const results = [];
    for (const path of ['/', '/data.json', '/aleph.json', '/api/materials', '/api/ai', '/api/threat-intel']) {
      const expected = path === '/' ? 'HTTP 200 및 자료 이전 안내 화면' : path === '/data.json'
        ? 'HTTP 200 JSON이며 notes가 빈 배열' : path === '/aleph.json'
        ? '현재 커밋과 일치하는2단계 배포 정보, 정적 확인 표시 없음' : path === '/api/materials'
        ? 'HTTP 200, 서버 안내 카드이며 메모 본문 없음' : '미구현 API는 HTTP 501로 자료를 반환하지 않음';
      let observed;
      try {
        const response = await fetch(new URL(path, app), { redirect: 'error', credentials: 'omit', signal: AbortSignal.timeout(10000) });
        const text = await response.text();
        if (path === '/') observed = `HTTP ${response.status}; 이전 안내 ${text.includes('Supabase SQL Editor') ? '있음' : '없음'}`;
        else if (path === '/data.json') {
          let data; try { data = JSON.parse(text); } catch {}
          observed = `HTTP ${response.status}; 메모 건수 ${Array.isArray(data?.notes) ? data.notes.length : '형식 오류'}; 확인 표시 ${text.includes(config.sampleMarker) ? '남음' : '없음'}`;
        } else if (path === '/aleph.json') {
          let data; try { data = JSON.parse(text); } catch {}
          observed = `HTTP ${response.status}; 단계 ${data?.step ?? '없음'}; 저장소 ${data?.repoUrl === config.repoUrl ? '일치' : '불일치'}; 현재 커밋 ${data?.commit === config.expectedCommit ? '일치' : '불일치'}; 확인 표시 ${text.includes(config.sampleMarker) ? '남음' : '없음'}`;
        } else if (path === '/api/materials') {
          let data; try { data = JSON.parse(text); } catch {}
          observed = `HTTP ${response.status}; 안내 카드 ${Array.isArray(data?.cards) ? data.cards.length : '형식 오류'}`;
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
