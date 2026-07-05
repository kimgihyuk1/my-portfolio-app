// Netlify Function: /.netlify/functions/advisor
// 보유 종목 + 사용자 질문을 받아 Anthropic API로 리밸런싱 의견을 생성 (키는 서버에 숨김)

export async function handler(event) {
  const cors = {
    "Access-Control-Allow-Origin": "*",
    "Content-Type": "application/json",
  };

  if (event.httpMethod !== "POST") {
    return { statusCode: 405, headers: cors, body: JSON.stringify({ error: "POST만 허용됩니다." }) };
  }

  const key = process.env.ANTHROPIC_API_KEY;
  if (!key) {
    return {
      statusCode: 500,
      headers: cors,
      body: JSON.stringify({ error: "서버에 ANTHROPIC_API_KEY가 설정되지 않았습니다. Netlify 환경 변수를 확인하세요." }),
    };
  }

  let body;
  try {
    body = JSON.parse(event.body || "{}");
  } catch {
    return { statusCode: 400, headers: cors, body: JSON.stringify({ error: "요청 형식 오류" }) };
  }

  const question = String(body.question || "").slice(0, 4000);
  const holdings = String(body.holdings || "").slice(0, 12000);
  if (!holdings.trim()) {
    return { statusCode: 400, headers: cors, body: JSON.stringify({ error: "보유 종목 정보가 비어 있습니다." }) };
  }

  const system =
    "당신은 개인 투자자의 포트폴리오를 분석하는 노련한 자산배분 애널리스트입니다. " +
    "다만 라이선스가 있는 투자자문가가 아니며, 특정 매수·매도 지시가 아니라 판단에 참고할 분석을 제공합니다. " +
    "항상 한국어로, 간결하고 구조적으로 답하세요. " +
    "성장성(시세차익)과 배당의 균형을 목표로, (1) 정리(축소·매도) 후보와 이유, (2) 추가·보강 후보와 이유, (3) 대략적 방향을 제시하세요. " +
    "가능하면 web_search로 최신 주가 흐름·실적·배당 동향을 반영하되, 고배당 함정(배당만 높고 성장·안정성 낮은 종목)을 경계하고 배당성장 관점을 우선하세요. " +
    "마지막에 '이 내용은 투자 자문이 아니라 참고용이며 최종 판단은 본인 책임'이라는 취지의 한 줄 고지를 붙이세요.";

  const userContent =
    `아래는 제 현재 보유 종목입니다.\n\n${holdings}\n\n` +
    (question ? `제 의견/질문:\n${question}\n\n` : "") +
    "성장성과 배당을 함께 높이는 방향으로 리밸런싱 의견을 주세요.";

  try {
    const resp = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: {
        "content-type": "application/json",
        "x-api-key": key,
        "anthropic-version": "2023-06-01",
      },
      body: JSON.stringify({
        model: "claude-sonnet-5",
        max_tokens: 2500,
        system,
        messages: [{ role: "user", content: userContent }],
        tools: [{ type: "web_search_20250305", name: "web_search" }],
      }),
    });

    const data = await resp.json();
    if (!resp.ok) {
      return {
        statusCode: resp.status,
        headers: cors,
        body: JSON.stringify({ error: data?.error?.message || "API 호출 실패" }),
      };
    }

    const answer = (data.content || [])
      .filter((b) => b.type === "text")
      .map((b) => b.text)
      .join("\n")
      .trim();

    return { statusCode: 200, headers: cors, body: JSON.stringify({ answer }) };
  } catch (e) {
    return { statusCode: 500, headers: cors, body: JSON.stringify({ error: String(e) }) };
  }
}
