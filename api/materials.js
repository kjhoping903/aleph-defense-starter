// Status cards only: do not expose private database rows through an anonymous API.
export default function handler(request, response) {
  response.setHeader('Cache-Control', 'no-store');
  if (request.method !== 'GET') {
    response.setHeader('Allow', 'GET');
    return response.status(405).json({ error: 'METHOD_NOT_ALLOWED' });
  }
  return response.status(200).json({
    cards: [{
      title: '자료 이전 준비',
      content: '공개 정적 메모는 제거했습니다. Supabase SQL 실행과 검증은 별도로 필요합니다. 현재 API는 메모 본문을 제공하지 않습니다.',
    }],
  });
}
