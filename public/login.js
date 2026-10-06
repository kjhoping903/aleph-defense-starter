import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.117.2';
const form = document.querySelector('#login-form');
const login = document.querySelector('#login');
const signup = document.querySelector('#signup');
const logout = document.querySelector('#logout');
const status = document.querySelector('#auth-status');
const cards = document.querySelector('#cards');
let client;
let generation = 0;

async function showSession(session) {
  const current = ++generation;
  cards.replaceChildren();
  cards.hidden = true;
  form.hidden = Boolean(session);
  logout.hidden = !session;
  if (!session) { status.textContent = '이메일과 비밀번호로 로그인하세요.'; return; }
  status.textContent = '로그인되었습니다. 자료 접근 권한을 확인하는 중입니다.';
  try {
    const response = await fetch('/api/materials', {
      cache: 'no-store', credentials: 'omit',
      headers: { Authorization: `Bearer ${session.access_token}` },
    });
    if (current !== generation) return;
    if (!response.ok) {
      let errorBody; try { errorBody = await response.json(); } catch {}
      const messages = {
        DATABASE_CONFIG_UNAVAILABLE: '서버 DB 연결 설정이 필요합니다.',
        MATERIALS_READ_FAILED: 'DB 자료를 읽지 못했습니다. 테이블 생성과 서버 읽기 권한을 확인하세요.',
      };
      throw new Error(response.status === 401 ? '로그인이 만료됐습니다. 다시 로그인하세요.' : messages[errorBody?.error] ?? '자료 서버를 사용할 수 없습니다.');
    }
    const data = await response.json();
    if (current !== generation) return;
    if (!Array.isArray(data.cards)) throw new Error('자료 응답 형식이 맞지 않습니다.');
    cards.replaceChildren(...data.cards.map(card => {
      const item = document.createElement('li');
      const title = document.createElement('strong');
      const text = document.createElement('span');
      title.textContent = card.title;
      text.textContent = card.content;
      item.append(title, text);
      return item;
    }));
    cards.hidden = false;
    status.textContent = data.cards.length ? '로그인 완료. DB 자료를 불러왔습니다.' : '로그인 완료. DB에 저장된 메모가 없습니다.';
  } catch (error) { if (current === generation) status.textContent = `로그인 상태입니다. ${error.message}`; }
}

try {
  client = createClient('https://ozapzbiuvusywjlstfrv.supabase.co',
    'sb_publishable_AHnLVsVSJoz3xIxl0OfTCA_tqEKaKIG');
  client.auth.onAuthStateChange((_event, session) => {
    // Avoid awaiting Supabase calls inside the auth callback.
    setTimeout(() => { void showSession(session); }, 0);
  });
  const { data, error } = await client.auth.getSession();
  if (error) throw new Error('로그인 세션을 확인할 수 없습니다.');
  await showSession(data.session);
  login.disabled = false;
  signup.disabled = false;
} catch { status.textContent = '로그인 설정을 불러오지 못했습니다. 관리자 설정을 확인하세요.'; }

form.addEventListener('submit', async event => {
  event.preventDefault();
  if (!client) return;
  login.disabled = true;
  signup.disabled = true;
  const registering = event.submitter === signup;
  status.textContent = registering ? '회원가입하는 중입니다.' : '로그인하는 중입니다.';
  try {
    const credentials = {
      email: document.querySelector('#email').value.trim(),
      password: document.querySelector('#password').value,
    };
    const { data, error } = registering
      ? await client.auth.signUp(credentials)
      : await client.auth.signInWithPassword(credentials);
    document.querySelector('#password').value = '';
    if (error) throw error;
    if (registering && !data.session) {
      status.textContent = '가입 요청을 접수했습니다. 인증 메일을 확인하고 인증 후 로그인하세요. 이미 가입했다면 로그인을 이용하세요.';
      return;
    }
    if (!data.session) throw new Error('로그인 세션을 받지 못했습니다.');
    await showSession(data.session);
  } catch (error) {
    const reasons = {
      invalid_credentials: '이메일 또는 비밀번호가 올바르지 않습니다.',
      email_not_confirmed: '이메일 인증을 먼저 완료하세요.',
      over_request_rate_limit: '요청이 너무 많습니다. 잠시 후 다시 시도하세요.',
      user_banned: '사용이 제한된 계정입니다.',
      signup_disabled: '현재 회원가입이 비활성화되어 있습니다. 관리자에게 문의하세요.',
      weak_password: '비밀번호가 보안 조건을 충족하지 않습니다. 더 긴 비밀번호를 사용하세요.',
      over_email_send_rate_limit: '인증 메일 요청이 너무 많습니다. 잠시 후 다시 시도하세요.',
    };
    status.textContent = `${registering ? '회원가입' : '로그인'} 실패: ${reasons[error.code] ?? error.message ?? '네트워크 연결을 확인하세요.'}`;
  }
  finally { document.querySelector('#password').value = ''; login.disabled = false; signup.disabled = false; }
});

logout.addEventListener('click', async () => {
  logout.disabled = true;
  ++generation;
  cards.replaceChildren();
  cards.hidden = true;
  try {
    const { error } = await client.auth.signOut({ scope: 'local' });
    if (error) throw error;
    await showSession(null);
    status.textContent = '로그아웃되었습니다. 다시 로그인할 수 있습니다.';
  } catch (error) { status.textContent = `로그아웃 실패: ${error.message ?? '네트워크 연결을 확인하세요.'}`; }
  finally { logout.disabled = false; }
});
