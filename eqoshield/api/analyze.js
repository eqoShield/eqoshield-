export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const { text, isUrl } = req.body;

  if (!text || text.length < 5) {
    return res.status(400).json({ error: '분석할 내용이 없습니다' });
  }

  const SYSTEM_PROMPT = `당신은 한국 사이버 사기 전문가입니다. 텍스트나 URL이 스미싱·피싱·과대광고인지 분석합니다.
반드시 순수 JSON만 반환하세요. 마크다운이나 코드블록 없이:
{"score":숫자,"verdict":"위험또는주의또는정상","findings":[{"type":"red또는amber또는green","text":"설명 40자이내"}],"summary":"2~3문장 요약"}
score: 0~100, verdict: 위험(70+)/주의(40~69)/정상(0~39), findings 최대 4개`;

  const prefix = isUrl
    ? '다음 URL이 피싱·스미싱 사기 사이트인지 분석해줘. 직접 접속하지 말고 URL 문자열만 분석:\n'
    : '다음 문자/글이 스미싱·피싱·과대광고인지 분석해줘:\n';

  try {
    const response = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': process.env.ANTHROPIC_API_KEY,
        'anthropic-version': '2023-06-01'
      },
      body: JSON.stringify({
        model: 'claude-haiku-4-5-20251001',
        max_tokens: 800,
        system: SYSTEM_PROMPT,
        messages: [{ role: 'user', content: prefix + text.slice(0, 2000) }]
      })
    });

    if (!response.ok) {
      const err = await response.json().catch(() => ({}));
      throw new Error(err.error?.message || 'Anthropic API 오류');
    }

    const data = await response.json();
    const raw = data.content.map(c => c.text || '').join('').replace(/```[a-z]*|```/g, '').trim();

    let result;
    try {
      result = JSON.parse(raw);
    } catch {
      const match = raw.match(/\{[\s\S]*\}/);
      if (match) result = JSON.parse(match[0]);
      else throw new Error('JSON 파싱 실패');
    }

    return res.status(200).json(result);

  } catch (e) {
    return res.status(500).json({ error: e.message });
  }
}
