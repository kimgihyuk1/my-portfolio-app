# 내 주식 현황 (Portfolio PWA)

보유 주식을 계좌별로 관리하고, 현재가·수익률·배당을 자동으로 갱신하는 스마트폰 설치형 웹앱입니다.

- 현재가/환율/배당 자동 조회 (야후 파이낸스, API 키 불필요)
- 국내(₩)·미국($) 혼합, 현재 환율로 원화 환산 합산
- 종목별 비중 도넛 / 수익률 막대 / 배당 차트
- 계좌별 구분 탭
- 데이터는 브라우저(localStorage)에 저장 — 기기별로 유지
- PWA: 폰 홈화면에 앱처럼 설치 가능

---

## 배포 방법 (Netlify)

가장 쉬운 방법은 GitHub에 올린 뒤 Netlify에 연결하는 것입니다.

### 1) GitHub에 올리기
```bash
cd my-portfolio-app
git init
git add .
git commit -m "portfolio app"
git branch -M main
git remote add origin https://github.com/<본인계정>/<저장소이름>.git
git push -u origin main
```

### 2) Netlify에 연결
1. https://app.netlify.com → **Add new site → Import an existing project**
2. GitHub 저장소 선택
3. 빌드 설정은 `netlify.toml`에 이미 있으므로 그대로 **Deploy**
   - Build command: `npm run build`
   - Publish directory: `dist`
   - Functions directory: `netlify/functions`
4. 몇 분 뒤 `https://<사이트이름>.netlify.app` 주소가 생성됩니다.

> 시세 조회는 `/.netlify/functions/quotes` 함수가 처리합니다. Netlify가 자동으로 인식하므로 별도 설정이 필요 없습니다.

### 3) 폰에 설치
- **아이폰(Safari)**: 사이트 접속 → 공유 버튼 → "홈 화면에 추가"
- **안드로이드(Chrome)**: 사이트 접속 → 메뉴(⋮) → "앱 설치" 또는 "홈 화면에 추가"

---

## 로컬에서 실행 (선택)
```bash
npm install
npm run dev      # 개발 서버
```
로컬 개발 서버(`vite`)에서는 Netlify 함수가 뜨지 않으므로 시세 자동조회가 동작하지 않습니다.
함수까지 로컬에서 테스트하려면:
```bash
npm i -g netlify-cli
netlify dev
```

---

## 티커(심볼) 입력 규칙

자동 시세는 종목의 **티커/심볼**로 조회합니다. 종목 추가 시 "티커/심볼" 칸에 입력하세요.

| 종류 | 예시 |
|------|------|
| 미국 주식 | `NVDA`, `AAPL`, `PLTR`, `BTI` |
| 국내 코스피 | `005930.KS`(삼성전자), `000660.KS`(SK하이닉스) |
| 국내 코스닥 | `247540.KQ`(에코프로비엠) 처럼 `.KQ` |
| 비트코인 | `BTC-USD` (달러 기준) |

국내 종목코드는 6자리 숫자 + `.KS`(코스피) 또는 `.KQ`(코스닥) 입니다.

---

## 참고
- 시세/배당은 야후 파이낸스 기준이며 실시간 호가가 아니라 약간 지연될 수 있습니다.
- 배당금은 최근 12개월 지급액 합계로 계산한 근사치입니다. 정확한 값은 종목 수정에서 직접 보정할 수 있습니다.
