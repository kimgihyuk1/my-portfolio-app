// Netlify Function: /.netlify/functions/quotes?symbols=NVDA,005930.KS,BTC-USD
// 야후 파이낸스 v8 chart 엔드포인트를 서버에서 중계 (브라우저 CORS 회피, API 키 불필요)

const YHEADERS = {
  "User-Agent":
    "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120 Safari/537.36",
  Accept: "application/json,text/plain,*/*",
};

// 심볼 하나의 현재가/통화/최근12개월 배당 합계를 조회 (단일 심볼)
async function fetchOne(symbol) {
  const hosts = ["query1.finance.yahoo.com", "query2.finance.yahoo.com"];
  for (const host of hosts) {
    try {
      const url =
        `https://${host}/v8/finance/chart/${encodeURIComponent(symbol)}` +
        `?interval=1d&range=1y&events=div`;
      const r = await fetch(url, { headers: YHEADERS });
      if (!r.ok) continue;
      const j = await r.json();
      const result = j?.chart?.result?.[0];
      if (!result) continue;

      const meta = result.meta || {};
      const price = meta.regularMarketPrice ?? meta.previousClose ?? null;
      const currency = meta.currency ?? null;

      // 최근 12개월 배당 합계 = 연간 주당 배당금(근사)
      let dividend = 0;
      const divs = result.events?.dividends;
      if (divs) {
        const cutoff = Date.now() / 1000 - 365 * 24 * 3600;
        for (const k of Object.keys(divs)) {
          const ev = divs[k];
          if (ev && typeof ev.amount === "number" && ev.date >= cutoff) {
            dividend += ev.amount;
          }
        }
      }
      if (price !== null) return { price, currency, dividend: Number(dividend.toFixed(6)) };
    } catch (e) {
      /* 다음 호스트 시도 */
    }
  }
  return null;
}

// 국내 6자리 숫자 코드는 .KS(코스피) → .KQ(코스닥) 순으로 자동 시도
async function fetchSymbol(symbol) {
  const s = (symbol || "").trim();
  let candidates;
  if (/^\d{6}$/.test(s)) {
    candidates = [`${s}.KS`, `${s}.KQ`];
  } else {
    candidates = [s];
  }
  for (const cand of candidates) {
    const res = await fetchOne(cand);
    if (res) return res;
  }
  return { price: null, currency: null, dividend: 0 };
}

export async function handler(event) {
  const cors = {
    "Access-Control-Allow-Origin": "*",
    "Content-Type": "application/json",
  };

  const symbolsParam = event.queryStringParameters?.symbols || "";
  const symbols = [
    ...new Set(
      symbolsParam
        .split(",")
        .map((s) => s.trim())
        .filter(Boolean)
    ),
  ].slice(0, 60); // 과도한 요청 방지

  if (symbols.length === 0) {
    return { statusCode: 400, headers: cors, body: JSON.stringify({ error: "symbols 파라미터가 비어 있습니다." }) };
  }

  try {
    // 종목 병렬 조회
    const entries = await Promise.all(
      symbols.map(async (sym) => [sym, await fetchSymbol(sym)])
    );
    const quotes = Object.fromEntries(entries);

    // USD/KRW 환율 (KRW=X)
    let usdkrw = null;
    try {
      const fx = await fetchSymbol("KRW=X");
      if (fx.price && !isNaN(fx.price)) usdkrw = fx.price;
    } catch (e) {
      /* 환율 실패는 무시 */
    }

    return {
      statusCode: 200,
      headers: cors,
      body: JSON.stringify({ quotes, usdkrw, updatedAt: new Date().toISOString() }),
    };
  } catch (e) {
    return { statusCode: 500, headers: cors, body: JSON.stringify({ error: String(e) }) };
  }
}
