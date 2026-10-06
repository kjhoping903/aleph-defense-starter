# BYTE BACK 방어전 시작 틀 R5 — 2단계 저장점

## 현재 기능과 단계 상태
공개 정적 파일에서 가상 메모를 제거하고 자료 이전 안내 화면을 제공합니다. 원본과 public/data.json의 notes는 빈 배열입니다. 2단계 빌드는 원본에 메모가 다시 들어오면 실패하며 메모를 복사하지 않습니다. Vercel에서는 실제 시스템 환경변수로 2단계 aleph.json을 생성합니다.

**SQL 준비 상태이며 Supabase 실행·검증은 미실행입니다.** 로그인, 사용자별 조회, 자료 조회 API는 미구현입니다. 기존 판정기·탐지기·다른 패키지는 보존합니다. starter.deny는 기존 거부 규칙이며 DB 보호 증빙이 아닙니다.

| 항목 | 상태 |
| --- | --- |
| 로컬 설정 | 2단계, 실제 배포 저장소와 서비스 주소 |
| 로컬 구현 | 공개 메모 제거, 이전 안내, 비공개 SQL 준비 |
| GitHub 푸시·Vercel 재배포 | 미실행 |
| Supabase SQL 실행 | 미실행 |
| 이전 저장점 2ab12ea | README만 저장했으며 2단계 구현 완료가 아님 |
| 배포 소스 기준 | 8a0927400ec0d0a8ff08146db773fec80fb6d216 |

이 기록은 로컬 2단계 저장점에 포함됩니다. git log -1 --oneline과 대조하세요. origin은 kjhoping903/aleph-defense-starter이며 원래 원격은 previous-origin으로 보존했습니다. 실제 서비스는 https://choi-bujang-secret-vault-7zk7.vercel.app 입니다.

## 실행 방법
Node.js 22 이상에서 `npm run build -- --local`로 정적 파일을 생성합니다. 이 환경에는 공식 Node.js v22.20.0 ZIP을 SHA256 검증 후 .local/runtime에 준비했습니다.

```powershell
$env:Path = "$PWD\.local\runtime\node-v22.20.0-win-x64;$env:Path"
npm.cmd run build -- --local
```

Vercel 서비스 주소를 열면 정적 이전 안내와 `/api/materials`가 반환한 상태 카드가 표시됩니다. 이 함수는 DB 메모를 읽거나 반환하지 않습니다. 정상 결과는 안내 카드와 빈 notes입니다. 정적 응답의 1단계 확인 표시는 제거합니다. API가 실패하면 오류 안내를 표시하며 기존 안내는 남습니다. 파일을 직접 열거나 정적 서버만 사용하면 Vercel 함수는 실행되지 않습니다. 원본에 메모를 다시 넣은 2단계 빌드는 거부되어야 합니다. `npm run bundle`은 커밋 후 실행합니다. 현재 배포가 이전 상태면 자기 점검에 그 사실을 그대로 기록하며 심판 판정으로 보고하지 않습니다.

## Supabase 실행과 확인
로컬 전달 파일은 .local/step2-learning-notes.sql 하나입니다. 선택한 세 건만 담고 나머지 한 건은 이전하지 않습니다. .local은 Git에서 제외되고 정적 배포 폴더 public 밖에 있습니다. 기존 README 사본은 .local/README.before-step2.md이며 기존 커밋도 보존했습니다. 이 폴더를 공개 업로드하지 마세요. 실제 키는 필요하지 않습니다.

Supabase 프로젝트의 **SQL Editor → New query**에서 SQL을 붙여 넣고 **Run**을 누릅니다. learning_notes가 이미 있으면 생성이 실패하고 트랜잭션이 롤백되어 기존 DB 작업을 보존합니다. 기존 테이블을 삭제하지 마세요.

SQL 끝의 확인 쿼리에서 owner_id가 uuid, 외래키 0건, relrowsecurity가 true, 행 수 3건, 읽기 정책 0건인지 확인합니다. anon_read와 authenticated_read는 false여야 합니다. 파일의 역할별 SELECT 시험은 각각 permission denied가 나야 합니다. 오류 후 열린 트랜잭션은 rollback 하세요. 실제 실행 후에만 실행 시각과 결과를 기록하며, 실행 전에는 DB 이전 완료라고 쓰지 않습니다.

RLS와 역할 권한 회수는 [Supabase 공식 문서](https://supabase.com/docs/guides/database/postgres/row-level-security)를 참고했습니다. 서비스 역할은 RLS를 우회할 수 있으므로 향후 서버 조회 API의 인증·인가도 별도로 검증해야 합니다.

## 공개 파일 검색 절차와 결과
README나 검사 코드에 메모 원문을 넣지 않습니다. 제외된 네 번째까지 검사하기 위해 이전 Git 커밋의 data.json을 로컬에서 읽어 네 문장을 검색 패턴으로 사용합니다. 원문은 출력하지 않고 일치 경로·줄 번호·건수만 기록합니다.

1. 한국 시간 점검 시각과 SHA를 기록합니다. 쿠키·Authorization 없이 /, /data.json, /aleph.json을 GET하고 HTTP 상태·최종 URL·JSON 형식을 확인합니다. 오류와 리다이렉트는 제거 성공이 아닙니다.
2. HTML과 참조하는 JS·JSON·정적 파일의 응답을 검색합니다. JSON은 파싱하여 이스케이프된 값도 검사합니다. 화면에 안 보이는 것만으로 제거됐다고 판단하지 않습니다.
3. aleph.json의 저장소·커밋을 실제 GitHub와 대조합니다. 최신 기본 브랜치와 배포 SHA가 다르면 각각 검사합니다. 최신 공개 파일 전체와 public을 검색하며 README·SQL도 예외로 숨기지 않습니다.
4. `git check-ignore`로 로컬 SQL과 이전 README가 제외됐는지 확인합니다. 새 정적 결과는 메모 일치 0건이어야 합니다.

| 대상 | 결과 및 한계 |
| --- | --- |
| 로컬 추적 대상·정적 결과 | 저장점 전 검증 기록 참조. GitHub 최신 검사와 구분 |
| 직전 실제 배포 /data.json | HTTP 200, 네 건 공개. 재배포 전 노출 지속 |
| 직전 GitHub 최신 커밋 | 8a092740…; 원본·공개 데이터 파일에서 네 문장 발견. 이번 변경은 미푸시 |

새 기록 형식: 한국 시간 / URL·경로 / 최신 SHA·배포 SHA / HTTP 상태 / 일치 경로·건수 / 미확인 범위. 로컬·GitHub·실제 배포를 각각 기록합니다.

## 공개 API의 남은 약점
- 현재 배포는 재배포 전이므로 공개 메모 노출이 남아 있습니다.
- Supabase SQL은 미실행이며 실제 RLS·권한·행 수 검증은 없습니다.
- api/ai.js와 api/threat-intel.js는 HTTP 501 시작 틀입니다. 자료 조회·로그인·사용자별 접근 제어는 미구현입니다. 실제 응답은 자기 점검 결과를 확인합니다.
- 옛 공개 커밋과 옛 배포가 남는 한 과거 노출이 해소됐다고 쓰지 않습니다. 최신 파일 제거는 과거 이력 삭제가 아니며 내려받은 사본 회수도 보장하지 못합니다. 기존 README 커밋에도 검색용 문장이 남아 있습니다.

bundle-notes.json, artifacts/submission.json, .local은 커밋하지 않습니다. 제출 묶음에 메모 본문·실명·키·토큰을 넣지 않습니다.

## 저장점 전 검증 기록

이번 저장점은 정적 확인 표시 제거와 `/api/materials` 서버 안내 카드 연결을 포함합니다. 관련 테스트 6개와 로컬 빌드가 통과했고, 정적 파일에서 확인 표시가 검색되지 않았습니다. 최신 추적 대상 45개에서 이전 메모 문장 및 비밀값 패턴 일치 0건을 확인했습니다. Supabase 실행·GitHub 푸시·Vercel 재배포는 미실행이며 서버 카드는 DB 자료 조회가 아닙니다.

2026-10-06T12:08:40+09:00 (한국 시간): 로컬 추적 대상 44개와 public 정적 파일에서 이전 네 문장 일치 0건. 비밀값 패턴 일치 0건. 관련 테스트 5개 및 로컬 빌드 통과. SQL은 Git 제외 확인, DB 실행은 미실행. 실제 서비스 데이터는 HTTP 200이며 네 문장 일치 4건으로 재배포 전 노출 지속. 실제 API 두 경로는 HTTP 501. GitHub 최신 파일은 기존 배포 커밋이며 로컬 변경 미푸시. 브라우저 시각 검증은 미실행; 새 화면은 DB 요청 없이 정적 안내를 표시함.
