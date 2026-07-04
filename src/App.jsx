import { useState, useEffect, useMemo } from "react";
import {
  PieChart, Pie, Cell, ResponsiveContainer, Tooltip,
  BarChart, Bar, XAxis, YAxis, ReferenceLine, LabelList,
} from "recharts";
import { supabase, supabaseEnabled } from "./supabase";
import * as XLSX from "xlsx";

// ─── 색상 (한국식: 상승 빨강 / 하락 파랑) ───
const C = {
  bg: "#0d1220",
  card: "#161d31",
  cardSoft: "#1c2440",
  line: "#273052",
  text: "#e8ecf7",
  sub: "#8a94b8",
  up: "#ff5d6c",
  down: "#4d8dff",
  accent: "#ffd166",
};
const PIE_COLORS = ["#ffd166", "#4d8dff", "#ff5d6c", "#6ee7b7", "#c084fc", "#f97316", "#38bdf8", "#facc15", "#fb7185", "#a3e635"];

const fmt = (n, digits = 0) =>
  n === null || n === undefined || isNaN(n)
    ? "-"
    : n.toLocaleString("ko-KR", { minimumFractionDigits: digits, maximumFractionDigits: digits });
const pnlColor = (v) => (v > 0 ? C.up : v < 0 ? C.down : C.sub);
const sign = (v) => (v > 0 ? "+" : "");
const cur = (c) => (c === "USD" ? "$" : "₩");
const priceDigits = (c) => (c === "USD" ? 2 : 0);

const STORAGE_KEY = "portfolio-v2";
const emptyForm = { name: "", symbol: "", account: "", currency: "KRW", buyPrice: "", quantity: "", currentPrice: "", dividend: "" };

// ─── 로그인 / 회원가입 화면 ───
const authInput = {
  width: "100%", padding: "12px 14px", background: C.bg, border: `1px solid ${C.line}`,
  borderRadius: 10, color: C.text, fontSize: 15, outline: "none", boxSizing: "border-box",
};
const authWrap = {
  minHeight: "100vh", background: C.bg, color: C.text,
  fontFamily: "'Pretendard','Apple SD Gothic Neo','Noto Sans KR',sans-serif",
  display: "flex", alignItems: "center", justifyContent: "center", padding: 20,
};

function AuthScreen() {
  const [mode, setMode] = useState("login"); // login | signup | reset
  const [email, setEmail] = useState("");
  const [pw, setPw] = useState("");
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState(null);
  const [ok, setOk] = useState(null);

  const submit = async () => {
    setMsg(null); setOk(null);
    if (mode === "reset") {
      if (!email.trim()) { setMsg("이메일을 입력하세요."); return; }
      setBusy(true);
      try {
        const { error } = await supabase.auth.resetPasswordForEmail(email.trim(), {
          redirectTo: window.location.origin,
        });
        if (error) throw error;
        setOk("재설정 메일을 보냈습니다. 메일함에서 링크를 눌러 새 비밀번호를 정하세요.");
      } catch (e) {
        setMsg(e?.message || "메일 전송에 실패했습니다.");
      }
      setBusy(false);
      return;
    }

    if (!email.trim() || !pw) { setMsg("이메일과 비밀번호를 입력하세요."); return; }
    setBusy(true);
    try {
      if (mode === "login") {
        const { error } = await supabase.auth.signInWithPassword({ email: email.trim(), password: pw });
        if (error) throw error;
      } else {
        const { data, error } = await supabase.auth.signUp({ email: email.trim(), password: pw });
        if (error) throw error;
        if (!data.session) setOk("가입 완료! 이메일 인증이 켜져 있으면 메일함을 확인한 뒤 로그인하세요.");
      }
    } catch (e) {
      setMsg(e?.message || "실패했습니다.");
    }
    setBusy(false);
  };

  const switchMode = (m) => { setMode(m); setMsg(null); setOk(null); };

  return (
    <div style={authWrap}>
      <div style={{ width: "100%", maxWidth: 360 }}>
        <div style={{ fontSize: 13, letterSpacing: 2, color: C.sub, textAlign: "center" }}>MY PORTFOLIO</div>
        <h1 style={{ fontSize: 24, fontWeight: 800, textAlign: "center", margin: "6px 0 24px" }}>내 주식 현황</h1>
        <div style={{ background: C.card, border: `1px solid ${C.line}`, borderRadius: 16, padding: 24 }}>
          {mode !== "reset" ? (
            <div style={{ display: "flex", gap: 8, marginBottom: 18 }}>
              {[["login", "로그인"], ["signup", "회원가입"]].map(([m, label]) => (
                <button key={m} onClick={() => switchMode(m)}
                  style={{
                    flex: 1, padding: "9px 0", borderRadius: 10, cursor: "pointer", fontWeight: 700, fontSize: 14,
                    border: `1px solid ${mode === m ? C.accent : C.line}`,
                    background: mode === m ? "rgba(255,209,102,0.12)" : "transparent",
                    color: mode === m ? C.accent : C.sub,
                  }}>{label}</button>
              ))}
            </div>
          ) : (
            <div style={{ fontSize: 15, fontWeight: 700, marginBottom: 16 }}>비밀번호 찾기</div>
          )}

          <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
            <input style={authInput} type="email" placeholder="이메일" value={email}
              onChange={(e) => setEmail(e.target.value)} autoCapitalize="none"
              onKeyDown={(e) => e.key === "Enter" && submit()} />
            {mode !== "reset" && (
              <input style={authInput} type="password" placeholder="비밀번호 (6자 이상)" value={pw}
                onChange={(e) => setPw(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && submit()} />
            )}
            <button onClick={submit} disabled={busy}
              style={{
                padding: "12px 0", borderRadius: 10, border: "none", background: C.accent,
                color: "#1a1a1a", fontSize: 15, fontWeight: 700, cursor: busy ? "wait" : "pointer",
              }}>
              {busy ? "처리 중…" : mode === "login" ? "로그인" : mode === "signup" ? "가입하기" : "재설정 메일 보내기"}
            </button>
          </div>

          {mode === "login" && (
            <div style={{ marginTop: 14, textAlign: "center" }}>
              <button onClick={() => switchMode("reset")}
                style={{ background: "transparent", border: "none", color: C.sub, cursor: "pointer", fontSize: 13, textDecoration: "underline" }}>
                비밀번호를 잊으셨나요?
              </button>
            </div>
          )}
          {mode === "reset" && (
            <div style={{ marginTop: 14, textAlign: "center" }}>
              <button onClick={() => switchMode("login")}
                style={{ background: "transparent", border: "none", color: C.sub, cursor: "pointer", fontSize: 13, textDecoration: "underline" }}>
                ← 로그인으로 돌아가기
              </button>
            </div>
          )}

          {msg && <div style={{ marginTop: 12, fontSize: 13, color: C.up }}>{msg}</div>}
          {ok && <div style={{ marginTop: 12, fontSize: 13, color: "#6ee7b7", lineHeight: 1.5 }}>{ok}</div>}
        </div>
        <div style={{ marginTop: 16, fontSize: 12, color: C.sub, textAlign: "center", lineHeight: 1.6 }}>
          같은 계정으로 로그인하면 컴퓨터·폰에서 포트폴리오가 동기화됩니다.
        </div>
      </div>
    </div>
  );
}

// 재설정 메일 링크로 돌아왔을 때 새 비밀번호를 정하는 화면
function NewPasswordScreen({ onDone }) {
  const [pw, setPw] = useState("");
  const [pw2, setPw2] = useState("");
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState(null);

  const save = async () => {
    setMsg(null);
    if (pw.length < 6) { setMsg("비밀번호는 6자 이상이어야 합니다."); return; }
    if (pw !== pw2) { setMsg("두 비밀번호가 일치하지 않습니다."); return; }
    setBusy(true);
    try {
      const { error } = await supabase.auth.updateUser({ password: pw });
      if (error) throw error;
      onDone();
    } catch (e) {
      setMsg(e?.message || "변경에 실패했습니다.");
      setBusy(false);
    }
  };

  return (
    <div style={authWrap}>
      <div style={{ width: "100%", maxWidth: 360 }}>
        <div style={{ fontSize: 13, letterSpacing: 2, color: C.sub, textAlign: "center" }}>MY PORTFOLIO</div>
        <h1 style={{ fontSize: 24, fontWeight: 800, textAlign: "center", margin: "6px 0 24px" }}>새 비밀번호 설정</h1>
        <div style={{ background: C.card, border: `1px solid ${C.line}`, borderRadius: 16, padding: 24 }}>
          <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
            <input style={authInput} type="password" placeholder="새 비밀번호 (6자 이상)" value={pw}
              onChange={(e) => setPw(e.target.value)} />
            <input style={authInput} type="password" placeholder="새 비밀번호 확인" value={pw2}
              onChange={(e) => setPw2(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && save()} />
            <button onClick={save} disabled={busy}
              style={{
                padding: "12px 0", borderRadius: 10, border: "none", background: C.accent,
                color: "#1a1a1a", fontSize: 15, fontWeight: 700, cursor: busy ? "wait" : "pointer",
              }}>
              {busy ? "변경 중…" : "비밀번호 변경"}
            </button>
          </div>
          {msg && <div style={{ marginTop: 12, fontSize: 13, color: C.up }}>{msg}</div>}
        </div>
      </div>
    </div>
  );
}

export default function App() {
  const [holdings, setHoldings] = useState([]);
  const [exchangeRate, setExchangeRate] = useState(1380);
  const [lastUpdated, setLastUpdated] = useState(null);
  const [loaded, setLoaded] = useState(false);
  const [activeTab, setActiveTab] = useState("전체");
  const [form, setForm] = useState(emptyForm);
  const [showForm, setShowForm] = useState(false);
  const [editingId, setEditingId] = useState(null);
  const [refreshing, setRefreshing] = useState(false);
  const [refreshError, setRefreshError] = useState(null);
  const [session, setSession] = useState(null);
  const [authReady, setAuthReady] = useState(false);
  const [syncing, setSyncing] = useState(false);
  const [recovery, setRecovery] = useState(false);

  // ─── 세션 초기화 ───
  useEffect(() => {
    if (!supabaseEnabled) {
      // 로그인 없이 localStorage 전용 모드
      try {
        const raw = localStorage.getItem(STORAGE_KEY);
        if (raw) {
          const d = JSON.parse(raw);
          setHoldings(d.holdings || []);
          if (d.exchangeRate) setExchangeRate(d.exchangeRate);
          if (d.lastUpdated) setLastUpdated(d.lastUpdated);
        }
      } catch (e) { /* 초기 상태 */ }
      setLoaded(true);
      setAuthReady(true);
      return;
    }
    supabase.auth.getSession().then(({ data }) => {
      setSession(data.session);
      setAuthReady(true);
    });
    const { data: sub } = supabase.auth.onAuthStateChange((event, s) => {
      setSession(s);
      if (event === "PASSWORD_RECOVERY") setRecovery(true);
    });
    return () => sub.subscription.unsubscribe();
  }, []);

  // ─── 로그인 시 클라우드에서 불러오기 (없으면 로컬 데이터 이전) ───
  useEffect(() => {
    if (!supabaseEnabled) return;
    if (!session) { setLoaded(false); return; }
    let cancelled = false;
    (async () => {
      setLoaded(false);
      const applyLocal = () => {
        try {
          const raw = localStorage.getItem(STORAGE_KEY);
          if (raw) {
            const d = JSON.parse(raw);
            setHoldings(d.holdings || []);
            if (d.exchangeRate) setExchangeRate(d.exchangeRate);
            if (d.lastUpdated) setLastUpdated(d.lastUpdated);
          }
        } catch (e) { /* noop */ }
      };
      try {
        const { data, error } = await supabase
          .from("portfolios")
          .select("data")
          .eq("user_id", session.user.id)
          .maybeSingle();
        if (error) throw error;
        if (cancelled) return;
        if (data?.data) {
          const d = data.data;
          setHoldings(d.holdings || []);
          setExchangeRate(d.exchangeRate || 1380);
          setLastUpdated(d.lastUpdated || null);
        } else {
          // 클라우드가 비어있으면 이 기기 로컬 데이터를 올려서 시작
          applyLocal();
        }
      } catch (e) {
        // 오프라인 등: 로컬로 대체
        if (!cancelled) applyLocal();
      }
      if (!cancelled) setLoaded(true);
    })();
    return () => { cancelled = true; };
  }, [session]);

  // ─── 변경 저장 (로컬 캐시 + 클라우드 동기화, 디바운스) ───
  useEffect(() => {
    if (!loaded) return;
    const payload = { holdings, exchangeRate, lastUpdated };
    try { localStorage.setItem(STORAGE_KEY, JSON.stringify(payload)); } catch (e) { /* noop */ }

    if (!supabaseEnabled || !session) return;
    setSyncing(true);
    const t = setTimeout(async () => {
      try {
        await supabase.from("portfolios").upsert({
          user_id: session.user.id,
          data: payload,
          updated_at: new Date().toISOString(),
        });
      } catch (e) {
        console.error("동기화 실패", e);
      }
      setSyncing(false);
    }, 800);
    return () => clearTimeout(t);
  }, [holdings, exchangeRate, lastUpdated, loaded, session]);

  const logout = async () => {
    if (supabaseEnabled) await supabase.auth.signOut();
    setHoldings([]); setLastUpdated(null);
  };

  // ─── 자동 시세 조회 (Claude + 웹검색) ───
  const refreshPrices = async () => {
    if (holdings.length === 0 || refreshing) return;
    setRefreshing(true);
    setRefreshError(null);
    try {
      // 조회할 심볼: symbol 우선, 없으면 name 사용
      const targets = holdings
        .map((h) => ({ id: h.id, sym: (h.symbol || h.name || "").trim() }))
        .filter((t) => t.sym);
      const uniqueSyms = [...new Set(targets.map((t) => t.sym))];
      if (uniqueSyms.length === 0) {
        throw new Error("조회할 티커가 없습니다. 종목 수정에서 '티커/심볼'을 입력하세요.");
      }

      const url = `/.netlify/functions/quotes?symbols=${encodeURIComponent(uniqueSyms.join(","))}`;
      const response = await fetch(url);
      if (!response.ok) {
        let detail = "";
        try { detail = (await response.json())?.error || ""; } catch { detail = await response.text(); }
        throw new Error(`서버 오류 (HTTP ${response.status}) ${detail}`.trim());
      }
      const data = await response.json();
      // data: { quotes: { SYM: {price, currency, dividend} }, usdkrw }
      if (data?.error) throw new Error(data.error);

      if (data.usdkrw && !isNaN(data.usdkrw)) setExchangeRate(data.usdkrw);

      let updated = 0;
      const missing = [];
      setHoldings((hs) =>
        hs.map((h) => {
          const sym = (h.symbol || h.name || "").trim();
          const q = data.quotes?.[sym];
          if (!q) return h;
          let next = h;
          if (q.price !== null && q.price !== undefined && !isNaN(q.price)) {
            next = { ...next, currentPrice: q.price };
            updated++;
          } else {
            missing.push(sym);
          }
          if (q.dividend !== null && q.dividend !== undefined && !isNaN(q.dividend)) {
            next = { ...next, dividendPerShare: q.dividend };
          }
          return next;
        })
      );

      if (updated === 0) {
        throw new Error("시세를 찾지 못했습니다. 티커 형식을 확인하세요. (미국: NVDA / 국내: 005930.KS / 코스닥: .KQ / 비트코인: BTC-USD)");
      }
      const okMsg = missing.length > 0 ? ` (일부 실패: ${[...new Set(missing)].join(", ")})` : "";
      setLastUpdated(new Date().toLocaleString("ko-KR") + okMsg);
    } catch (e) {
      console.error(e);
      setRefreshError(e?.message || "시세 조회에 실패했습니다.");
    }
    setRefreshing(false);
  };

  // ─── 계좌 탭 ───
  const accounts = useMemo(() => {
    const set = [...new Set(holdings.map((h) => h.account || "기본 계좌"))];
    return ["전체", ...set];
  }, [holdings]);

  useEffect(() => {
    if (!accounts.includes(activeTab)) setActiveTab("전체");
  }, [accounts, activeTab]);

  // ─── 계산 ───
  const allRows = useMemo(
    () =>
      holdings.map((h) => {
        const account = h.account || "기본 계좌";
        const cost = h.buyPrice * h.quantity;
        const value = h.currentPrice * h.quantity;
        const pnl = value - cost;
        const rate = cost > 0 ? (pnl / cost) * 100 : 0;
        const toKRW = h.currency === "USD" ? exchangeRate : 1;
        const dps = h.dividendPerShare || 0;
        const annualDiv = dps * h.quantity;
        return {
          ...h, account, cost, value, pnl, rate, dps, annualDiv,
          valueKRW: value * toKRW, costKRW: cost * toKRW, divKRW: annualDiv * toKRW,
        };
      }),
    [holdings, exchangeRate]
  );

  const rows = useMemo(
    () => (activeTab === "전체" ? allRows : allRows.filter((r) => r.account === activeTab)),
    [allRows, activeTab]
  );

  const total = useMemo(() => {
    const cost = rows.reduce((s, r) => s + r.costKRW, 0);
    const value = rows.reduce((s, r) => s + r.valueKRW, 0);
    const dividend = rows.reduce((s, r) => s + r.divKRW, 0);
    const pnl = value - cost;
    return {
      cost, value, pnl, dividend,
      rate: cost > 0 ? (pnl / cost) * 100 : 0,
      divYield: value > 0 ? (dividend / value) * 100 : 0,
      divYieldOnCost: cost > 0 ? (dividend / cost) * 100 : 0,
    };
  }, [rows]);

  const pieData = useMemo(
    () => rows.filter((r) => r.valueKRW > 0).map((r) => ({ name: r.name, value: Math.round(r.valueKRW) })),
    [rows]
  );
  const barData = useMemo(
    () => rows.map((r) => ({ name: r.name, rate: Number(r.rate.toFixed(2)) })),
    [rows]
  );
  const divBarData = useMemo(
    () =>
      rows
        .filter((r) => r.divKRW > 0)
        .map((r) => ({ name: r.name, div: Math.round(r.divKRW) }))
        .sort((a, b) => b.div - a.div),
    [rows]
  );

  // ─── 폼 ───
  const openAdd = () => {
    setForm({ ...emptyForm, account: activeTab !== "전체" ? activeTab : "" });
    setEditingId(null);
    setShowForm(true);
  };
  const openEdit = (h) => {
    setForm({
      name: h.name, symbol: h.symbol || "", account: h.account || "", currency: h.currency,
      buyPrice: String(h.buyPrice), quantity: String(h.quantity), currentPrice: String(h.currentPrice),
      dividend: h.dividendPerShare ? String(h.dividendPerShare) : "",
    });
    setEditingId(h.id);
    setShowForm(true);
  };
  const saveForm = () => {
    const buyPrice = parseFloat(form.buyPrice);
    const quantity = parseFloat(form.quantity);
    const currentPrice = parseFloat(form.currentPrice) || 0;
    const dividendPerShare = parseFloat(form.dividend) || 0;
    if (!form.name.trim() || isNaN(buyPrice) || isNaN(quantity)) return;
    const account = form.account.trim() || "기본 계좌";
    const symbol = form.symbol.trim();
    if (editingId) {
      setHoldings((hs) =>
        hs.map((h) => (h.id === editingId ? { ...h, name: form.name.trim(), symbol, account, currency: form.currency, buyPrice, quantity, currentPrice, dividendPerShare } : h))
      );
    } else {
      setHoldings((hs) => [
        ...hs,
        { id: Date.now().toString(), name: form.name.trim(), symbol, account, currency: form.currency, buyPrice, quantity, currentPrice, dividendPerShare },
      ]);
    }
    setShowForm(false);
  };
  const remove = (id) => setHoldings((hs) => hs.filter((h) => h.id !== id));

  // ─── 엑셀/CSV 일괄 등록 ───
  const [importMsg, setImportMsg] = useState(null);

  const pick = (row, keys) => {
    for (const k of Object.keys(row)) {
      const norm = String(k).trim().toLowerCase().replace(/\s|\(.*?\)/g, "");
      if (keys.some((t) => norm === t)) return row[k];
    }
    return undefined;
  };
  const normCurrency = (v) => {
    const s = String(v ?? "").trim().toUpperCase();
    if (s.includes("USD") || s.includes("$") || s.includes("달러")) return "USD";
    return "KRW";
  };

  const handleImportFile = async (e) => {
    const file = e.target.files?.[0];
    e.target.value = ""; // 같은 파일 재선택 허용
    if (!file) return;
    setImportMsg(null);
    try {
      const buf = await file.arrayBuffer();
      const wb = XLSX.read(buf, { type: "array" });
      const ws = wb.Sheets[wb.SheetNames[0]];
      const rows = XLSX.utils.sheet_to_json(ws, { defval: "" });

      const parsed = [];
      let skipped = 0;
      for (const row of rows) {
        const name = pick(row, ["종목명", "종목", "name", "이름"]);
        const buyPrice = parseFloat(pick(row, ["매수가", "평단", "매입가", "buyprice", "price"]));
        const quantity = parseFloat(pick(row, ["수량", "주수", "quantity", "qty"]));
        if (!name || String(name).trim() === "" || isNaN(buyPrice) || isNaN(quantity)) {
          skipped++;
          continue;
        }
        const symbol = pick(row, ["티커", "심볼", "symbol", "ticker", "코드"]);
        const account = pick(row, ["계좌", "account"]);
        const currency = normCurrency(pick(row, ["통화", "currency"]));
        const dividend = parseFloat(pick(row, ["배당", "주당배당금", "배당금", "dividend"]));
        parsed.push({
          id: Date.now().toString() + Math.random().toString(36).slice(2, 7),
          name: String(name).trim(),
          symbol: symbol ? String(symbol).trim() : "",
          account: account ? String(account).trim() : "기본 계좌",
          currency,
          buyPrice,
          quantity,
          currentPrice: 0,
          dividendPerShare: isNaN(dividend) ? 0 : dividend,
        });
      }

      if (parsed.length === 0) {
        setImportMsg("등록할 종목을 찾지 못했습니다. 양식(종목명·매수가·수량)을 확인하세요.");
        return;
      }
      setHoldings((hs) => [...hs, ...parsed]);
      setImportMsg(`${parsed.length}개 종목을 등록했습니다.${skipped ? ` (${skipped}개 행은 건너뜀)` : ""} 시세 새로고침을 눌러 현재가를 채우세요.`);
    } catch (err) {
      console.error(err);
      setImportMsg("파일을 읽지 못했습니다. .xlsx 또는 .csv 파일인지 확인하세요.");
    }
  };

  const inputStyle = {
    width: "100%", padding: "10px 12px", background: C.bg, border: `1px solid ${C.line}`,
    borderRadius: 10, color: C.text, fontSize: 15, outline: "none", boxSizing: "border-box",
  };
  const labelStyle = { fontSize: 12, color: C.sub, marginBottom: 6, display: "block" };

  // 로그인/동기화 게이트
  if (supabaseEnabled && !authReady) {
    return (
      <div style={{ minHeight: "100vh", background: C.bg, color: C.sub, display: "flex", alignItems: "center", justifyContent: "center", fontFamily: "sans-serif" }}>
        불러오는 중…
      </div>
    );
  }
  if (supabaseEnabled && recovery) {
    return <NewPasswordScreen onDone={() => setRecovery(false)} />;
  }
  if (supabaseEnabled && !session) {
    return <AuthScreen />;
  }

  return (
    <div
      style={{
        minHeight: "100vh", background: C.bg, color: C.text,
        fontFamily: "'Pretendard','IBM Plex Sans KR','Apple SD Gothic Neo','Noto Sans KR',sans-serif",
        padding: "24px 16px 60px",
      }}
    >
      <div style={{ maxWidth: 820, margin: "0 auto" }}>
        {/* ─── 헤더 ─── */}
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 16, gap: 8, flexWrap: "wrap" }}>
          <div>
            <div style={{ fontSize: 13, letterSpacing: 2, color: C.sub }}>MY PORTFOLIO</div>
            <h1 style={{ fontSize: 22, fontWeight: 700, margin: "4px 0 0" }}>내 주식 현황</h1>
            {supabaseEnabled && session && (
              <div style={{ fontSize: 11, color: C.sub, marginTop: 4, display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
                <span>{session.user.email}</span>
                <span style={{ color: syncing ? C.accent : "#6ee7b7" }}>
                  {syncing ? "동기화 중…" : "● 동기화됨"}
                </span>
                <button onClick={logout}
                  style={{ background: "transparent", border: "none", color: C.sub, cursor: "pointer", textDecoration: "underline", fontSize: 11, padding: 0 }}>
                  로그아웃
                </button>
              </div>
            )}
          </div>
          <div style={{ display: "flex", gap: 8 }}>
            <label
              style={{
                background: "transparent", color: C.sub, border: `1px solid ${C.line}`,
                borderRadius: 10, padding: "10px 14px", fontSize: 14, fontWeight: 700,
                cursor: "pointer", display: "inline-flex", alignItems: "center",
              }}
            >
              ⇪ 파일 등록
              <input
                type="file"
                accept=".xlsx,.xls,.csv"
                onChange={handleImportFile}
                style={{ display: "none" }}
              />
            </label>
            <button
              onClick={refreshPrices}
              disabled={refreshing || holdings.length === 0}
              style={{
                background: refreshing ? C.cardSoft : "transparent",
                color: refreshing ? C.sub : C.accent,
                border: `1px solid ${C.accent}`,
                borderRadius: 10, padding: "10px 14px", fontSize: 14, fontWeight: 700,
                cursor: refreshing ? "wait" : "pointer",
              }}
            >
              {refreshing ? "시세 조회 중…" : "⟳ 시세 새로고침"}
            </button>
            <button
              onClick={openAdd}
              style={{
                background: C.accent, color: "#1a1a1a", border: "none", borderRadius: 10,
                padding: "10px 16px", fontSize: 14, fontWeight: 700, cursor: "pointer",
              }}
            >
              + 종목 추가
            </button>
          </div>
        </div>

        {/* 갱신 정보 */}
        <div style={{ fontSize: 12, color: C.sub, marginBottom: 14, display: "flex", gap: 14, flexWrap: "wrap" }}>
          <span>적용 환율: ₩{fmt(exchangeRate, 1)}/USD</span>
          {lastUpdated && <span>마지막 시세 갱신: {lastUpdated}</span>}
        </div>

        {importMsg && (
          <div
            style={{
              background: "rgba(255,209,102,0.1)", border: `1px solid ${C.accent}`, borderRadius: 12,
              padding: "12px 16px", marginBottom: 14, fontSize: 13, color: C.text, lineHeight: 1.5,
              display: "flex", justifyContent: "space-between", alignItems: "center", gap: 10,
            }}
          >
            <span>{importMsg}</span>
            <button onClick={() => setImportMsg(null)}
              style={{ background: "transparent", border: "none", color: C.sub, cursor: "pointer", fontSize: 16 }}>×</button>
          </div>
        )}

        {refreshError && (
          <div
            style={{
              background: "rgba(255,93,108,0.1)", border: `1px solid ${C.up}`, borderRadius: 12,
              padding: "12px 16px", marginBottom: 14, fontSize: 13, color: C.text, lineHeight: 1.5,
            }}
          >
            <b style={{ color: C.up }}>시세 조회 실패</b>
            <div style={{ marginTop: 4, wordBreak: "break-word" }}>{refreshError}</div>
          </div>
        )}

        {/* ─── 계좌 탭 ─── */}
        <div style={{ display: "flex", gap: 8, marginBottom: 16, flexWrap: "wrap" }}>
          {accounts.map((a) => (
            <button
              key={a}
              onClick={() => setActiveTab(a)}
              style={{
                padding: "8px 16px", borderRadius: 20, fontSize: 13, fontWeight: 600, cursor: "pointer",
                border: `1px solid ${activeTab === a ? C.accent : C.line}`,
                background: activeTab === a ? "rgba(255,209,102,0.12)" : "transparent",
                color: activeTab === a ? C.accent : C.sub,
              }}
            >
              {a}
            </button>
          ))}
        </div>

        {/* ─── 총 평가 요약 ─── */}
        <div
          style={{
            background: `linear-gradient(135deg, ${C.card}, ${C.cardSoft})`,
            border: `1px solid ${C.line}`, borderRadius: 16, padding: "22px 24px", marginBottom: 16,
          }}
        >
          <div style={{ fontSize: 13, color: C.sub }}>
            {activeTab === "전체" ? "총 평가액" : `${activeTab} 평가액`} (원화 환산 · 현재 환율 반영)
          </div>
          <div style={{ fontSize: 34, fontWeight: 800, fontVariantNumeric: "tabular-nums", margin: "4px 0 10px" }}>
            ₩{fmt(total.value)}
          </div>
          <div style={{ display: "flex", gap: 20, flexWrap: "wrap", fontVariantNumeric: "tabular-nums" }}>
            <div>
              <span style={{ fontSize: 12, color: C.sub, marginRight: 6 }}>평가손익</span>
              <span style={{ fontSize: 16, fontWeight: 700, color: pnlColor(total.pnl) }}>
                {sign(total.pnl)}₩{fmt(total.pnl)}
              </span>
            </div>
            <div>
              <span style={{ fontSize: 12, color: C.sub, marginRight: 6 }}>수익률</span>
              <span style={{ fontSize: 16, fontWeight: 700, color: pnlColor(total.pnl) }}>
                {sign(total.rate)}{fmt(total.rate, 2)}%
              </span>
            </div>
            <div>
              <span style={{ fontSize: 12, color: C.sub, marginRight: 6 }}>총 매수금액</span>
              <span style={{ fontSize: 16, fontWeight: 600 }}>₩{fmt(total.cost)}</span>
            </div>
          </div>
          {total.dividend > 0 && (
            <div
              style={{
                marginTop: 14, paddingTop: 14, borderTop: `1px solid ${C.line}`,
                display: "flex", gap: 20, flexWrap: "wrap", fontVariantNumeric: "tabular-nums",
              }}
            >
              <div>
                <span style={{ fontSize: 12, color: C.sub, marginRight: 6 }}>연간 예상 배당금</span>
                <span style={{ fontSize: 16, fontWeight: 700, color: C.accent }}>₩{fmt(total.dividend)}</span>
              </div>
              <div>
                <span style={{ fontSize: 12, color: C.sub, marginRight: 6 }}>시가 배당률</span>
                <span style={{ fontSize: 15, fontWeight: 600 }}>{fmt(total.divYield, 2)}%</span>
              </div>
              <div>
                <span style={{ fontSize: 12, color: C.sub, marginRight: 6 }}>투자원금 대비</span>
                <span style={{ fontSize: 15, fontWeight: 600 }}>{fmt(total.divYieldOnCost, 2)}%</span>
              </div>
              <div>
                <span style={{ fontSize: 12, color: C.sub, marginRight: 6 }}>월 환산</span>
                <span style={{ fontSize: 15, fontWeight: 600 }}>약 ₩{fmt(total.dividend / 12)}</span>
              </div>
            </div>
          )}
        </div>

        {/* ─── 차트 ─── */}
        {rows.length > 0 && (
          <div
            style={{
              display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(280px, 1fr))",
              gap: 12, marginBottom: 16,
            }}
          >
            {/* 종목별 비중 도넛 */}
            <div style={{ background: C.card, border: `1px solid ${C.line}`, borderRadius: 16, padding: 16 }}>
              <div style={{ fontSize: 13, fontWeight: 700, marginBottom: 4 }}>종목별 비중</div>
              <div style={{ fontSize: 11, color: C.sub, marginBottom: 8 }}>원화 환산 평가액 기준</div>
              <div style={{ height: 220 }}>
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                    <Pie data={pieData} dataKey="value" nameKey="name" innerRadius={50} outerRadius={80} paddingAngle={2}>
                      {pieData.map((_, i) => (
                        <Cell key={i} fill={PIE_COLORS[i % PIE_COLORS.length]} stroke={C.bg} />
                      ))}
                    </Pie>
                    <Tooltip
                      formatter={(v) => `₩${fmt(v)}`}
                      contentStyle={{ background: C.cardSoft, border: `1px solid ${C.line}`, borderRadius: 10, color: C.text }}
                    />
                  </PieChart>
                </ResponsiveContainer>
              </div>
              <div style={{ display: "flex", flexWrap: "wrap", gap: "4px 12px", marginTop: 4 }}>
                {pieData.map((d, i) => (
                  <span key={d.name} style={{ fontSize: 11, color: C.sub, display: "flex", alignItems: "center", gap: 4 }}>
                    <span style={{ width: 8, height: 8, borderRadius: 2, background: PIE_COLORS[i % PIE_COLORS.length], display: "inline-block" }} />
                    {d.name} {total.value > 0 ? `${((d.value / total.value) * 100).toFixed(1)}%` : ""}
                  </span>
                ))}
              </div>
            </div>

            {/* 종목별 수익률 바 */}
            <div style={{ background: C.card, border: `1px solid ${C.line}`, borderRadius: 16, padding: 16 }}>
              <div style={{ fontSize: 13, fontWeight: 700, marginBottom: 4 }}>종목별 수익률</div>
              <div style={{ fontSize: 11, color: C.sub, marginBottom: 8 }}>매수가 대비 (%)</div>
              <div style={{ height: Math.max(220, barData.length * 42) }}>
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={barData} layout="vertical" margin={{ left: 8, right: 40, top: 4, bottom: 4 }}>
                    <XAxis type="number" hide domain={["auto", "auto"]} />
                    <YAxis
                      type="category" dataKey="name" width={80}
                      tick={{ fill: C.sub, fontSize: 11 }} axisLine={false} tickLine={false}
                    />
                    <ReferenceLine x={0} stroke={C.line} />
                    <Tooltip
                      formatter={(v) => `${sign(v)}${fmt(v, 2)}%`}
                      cursor={{ fill: "rgba(255,255,255,0.04)" }}
                      contentStyle={{ background: C.cardSoft, border: `1px solid ${C.line}`, borderRadius: 10, color: C.text }}
                    />
                    <Bar dataKey="rate" radius={[0, 6, 6, 0]} barSize={18}>
                      {barData.map((d, i) => (
                        <Cell key={i} fill={d.rate >= 0 ? C.up : C.down} />
                      ))}
                      <LabelList
                        dataKey="rate" position="right"
                        formatter={(v) => `${sign(v)}${v}%`}
                        style={{ fill: C.text, fontSize: 11 }}
                      />
                    </Bar>
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </div>

            {/* 종목별 연간 배당금 바 */}
            {divBarData.length > 0 && (
              <div style={{ background: C.card, border: `1px solid ${C.line}`, borderRadius: 16, padding: 16 }}>
                <div style={{ fontSize: 13, fontWeight: 700, marginBottom: 4 }}>종목별 연간 배당금</div>
                <div style={{ fontSize: 11, color: C.sub, marginBottom: 8 }}>
                  원화 환산 · 연 합계 ₩{fmt(total.dividend)}
                </div>
                <div style={{ height: Math.max(220, divBarData.length * 42) }}>
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={divBarData} layout="vertical" margin={{ left: 8, right: 70, top: 4, bottom: 4 }}>
                      <XAxis type="number" hide />
                      <YAxis
                        type="category" dataKey="name" width={80}
                        tick={{ fill: C.sub, fontSize: 11 }} axisLine={false} tickLine={false}
                      />
                      <Tooltip
                        formatter={(v) => `₩${fmt(v)}/년`}
                        cursor={{ fill: "rgba(255,255,255,0.04)" }}
                        contentStyle={{ background: C.cardSoft, border: `1px solid ${C.line}`, borderRadius: 10, color: C.text }}
                      />
                      <Bar dataKey="div" radius={[0, 6, 6, 0]} barSize={18} fill={C.accent}>
                        <LabelList
                          dataKey="div" position="right"
                          formatter={(v) => `₩${fmt(v)}`}
                          style={{ fill: C.text, fontSize: 11 }}
                        />
                      </Bar>
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              </div>
            )}
          </div>
        )}

        {/* ─── 배당 현황 표 (항상 표시) ─── */}
        {rows.length > 0 && (
          <div
            style={{
              background: C.card, border: `1px solid ${C.line}`, borderRadius: 16,
              padding: "18px 20px", marginBottom: 16,
            }}
          >
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", marginBottom: 4 }}>
              <div style={{ fontSize: 15, fontWeight: 700 }}>연간 배당금 현황</div>
              <div style={{ fontSize: 11, color: C.sub }}>원화 환산 · 연 기준</div>
            </div>
            {total.dividend === 0 && (
              <div style={{ fontSize: 12, color: C.sub, marginBottom: 10 }}>
                배당 데이터가 없습니다. <b style={{ color: C.accent }}>⟳ 시세 새로고침</b>으로 자동 조회하거나, 종목 수정에서 직접 입력하세요.
              </div>
            )}
            <div style={{ overflowX: "auto" }}>
              <table style={{ width: "100%", borderCollapse: "collapse", fontVariantNumeric: "tabular-nums", fontSize: 13 }}>
                <thead>
                  <tr style={{ color: C.sub, textAlign: "right" }}>
                    <th style={{ textAlign: "left", padding: "8px 6px", fontWeight: 600 }}>종목</th>
                    <th style={{ padding: "8px 6px", fontWeight: 600 }}>주당 배당</th>
                    <th style={{ padding: "8px 6px", fontWeight: 600 }}>수량</th>
                    <th style={{ padding: "8px 6px", fontWeight: 600 }}>연간 배당금</th>
                    <th style={{ padding: "8px 6px", fontWeight: 600 }}>배당률</th>
                    <th style={{ padding: "8px 6px", fontWeight: 600 }}>원화 환산</th>
                  </tr>
                </thead>
                <tbody>
                  {rows
                    .slice()
                    .sort((a, b) => b.divKRW - a.divKRW)
                    .map((r) => (
                      <tr key={r.id} style={{ borderTop: `1px solid ${C.line}`, textAlign: "right" }}>
                        <td style={{ textAlign: "left", padding: "9px 6px", fontWeight: 600 }}>
                          {r.name}
                          <span style={{ fontSize: 10, color: C.sub, marginLeft: 5 }}>{r.currency === "USD" ? "$" : "₩"}</span>
                        </td>
                        <td style={{ padding: "9px 6px", color: r.dps > 0 ? C.text : C.sub }}>
                          {r.dps > 0 ? `${cur(r.currency)}${fmt(r.dps, r.currency === "USD" ? 2 : 0)}` : "-"}
                        </td>
                        <td style={{ padding: "9px 6px", color: C.sub }}>{fmt(r.quantity, r.quantity % 1 ? 4 : 0)}</td>
                        <td style={{ padding: "9px 6px", fontWeight: 700, color: r.annualDiv > 0 ? C.accent : C.sub }}>
                          {r.annualDiv > 0 ? `${cur(r.currency)}${fmt(r.annualDiv, priceDigits(r.currency))}` : "-"}
                        </td>
                        <td style={{ padding: "9px 6px", color: C.sub }}>
                          {r.dps > 0 && r.value > 0 ? `${fmt((r.annualDiv / r.value) * 100, 2)}%` : "-"}
                        </td>
                        <td style={{ padding: "9px 6px" }}>
                          {r.divKRW > 0 ? `₩${fmt(r.divKRW)}` : "-"}
                        </td>
                      </tr>
                    ))}
                </tbody>
                <tfoot>
                  <tr style={{ borderTop: `2px solid ${C.line}`, textAlign: "right" }}>
                    <td style={{ textAlign: "left", padding: "11px 6px", fontWeight: 700 }}>
                      합계{activeTab !== "전체" ? ` · ${activeTab}` : ""}
                    </td>
                    <td colSpan={4} style={{ padding: "11px 6px", color: C.sub, fontSize: 12 }}>
                      시가배당 {fmt(total.divYield, 2)}% · 원금대비 {fmt(total.divYieldOnCost, 2)}% · 월 약 ₩{fmt(total.dividend / 12)}
                    </td>
                    <td style={{ padding: "11px 6px", fontWeight: 800, color: C.accent, fontSize: 15 }}>
                      ₩{fmt(total.dividend)}
                    </td>
                  </tr>
                </tfoot>
              </table>
            </div>
          </div>
        )}

        {/* ─── 빈 상태 ─── */}
        {rows.length === 0 && loaded && (
          <div style={{ textAlign: "center", padding: "60px 20px", color: C.sub, border: `1px dashed ${C.line}`, borderRadius: 16 }}>
            {activeTab === "전체" ? (
              <>아직 등록된 종목이 없습니다.<br /><b style={{ color: C.accent }}>+ 종목 추가</b> 버튼으로 시작하세요.</>
            ) : (
              <>이 계좌에 등록된 종목이 없습니다.</>
            )}
          </div>
        )}

        {/* ─── 종목 카드 (전체 탭은 계좌별 그룹) ─── */}
        {(activeTab === "전체" ? accounts.slice(1) : [activeTab]).map((acct) => {
          const group = rows.filter((r) => r.account === acct);
          if (group.length === 0) return null;
          const gValue = group.reduce((s, r) => s + r.valueKRW, 0);
          return (
            <div key={acct} style={{ marginBottom: 20 }}>
              {activeTab === "전체" && (
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", margin: "0 4px 8px" }}>
                  <div style={{ fontSize: 14, fontWeight: 700, color: C.accent }}>{acct}</div>
                  <div style={{ fontSize: 12, color: C.sub, fontVariantNumeric: "tabular-nums" }}>₩{fmt(gValue)}</div>
                </div>
              )}
              <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
                {group.map((r) => (
                  <div
                    key={r.id}
                    style={{
                      background: C.card, border: `1px solid ${C.line}`,
                      borderLeft: `4px solid ${pnlColor(r.pnl)}`, borderRadius: 14, padding: "16px 18px",
                    }}
                  >
                    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 12 }}>
                      <div style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
                        <span style={{ fontSize: 17, fontWeight: 700 }}>{r.name}</span>
                        <span style={{ fontSize: 11, color: C.sub, border: `1px solid ${C.line}`, borderRadius: 6, padding: "2px 6px" }}>
                          {r.currency === "USD" ? "$ 미국" : "₩ 국내"}
                        </span>
                      </div>
                      <div style={{ textAlign: "right", fontVariantNumeric: "tabular-nums" }}>
                        <div style={{ fontSize: 18, fontWeight: 800, color: pnlColor(r.pnl) }}>
                          {sign(r.rate)}{fmt(r.rate, 2)}%
                        </div>
                        <div style={{ fontSize: 12, color: pnlColor(r.pnl) }}>
                          {sign(r.pnl)}{cur(r.currency)}{fmt(r.pnl, priceDigits(r.currency))}
                        </div>
                      </div>
                    </div>

                    <div
                      style={{
                        display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(120px, 1fr))",
                        gap: "10px 14px", fontVariantNumeric: "tabular-nums",
                      }}
                    >
                      <div>
                        <div style={{ fontSize: 11, color: C.sub, marginBottom: 2 }}>현재가</div>
                        <div style={{ fontSize: 15, fontWeight: 700 }}>
                          {r.currentPrice > 0 ? `${cur(r.currency)}${fmt(r.currentPrice, priceDigits(r.currency))}` : "시세 갱신 필요"}
                        </div>
                      </div>
                      <div>
                        <div style={{ fontSize: 11, color: C.sub, marginBottom: 2 }}>매수가</div>
                        <div style={{ fontSize: 15 }}>{cur(r.currency)}{fmt(r.buyPrice, priceDigits(r.currency))}</div>
                      </div>
                      <div>
                        <div style={{ fontSize: 11, color: C.sub, marginBottom: 2 }}>수량</div>
                        <div style={{ fontSize: 15 }}>{fmt(r.quantity, r.quantity % 1 ? 4 : 0)}주</div>
                      </div>
                      <div>
                        <div style={{ fontSize: 11, color: C.sub, marginBottom: 2 }}>총 평가액</div>
                        <div style={{ fontSize: 15, fontWeight: 700 }}>
                          {cur(r.currency)}{fmt(r.value, priceDigits(r.currency))}
                          {r.currency === "USD" && (
                            <span style={{ fontSize: 11, color: C.sub, marginLeft: 6 }}>≈₩{fmt(r.valueKRW)}</span>
                          )}
                        </div>
                      </div>
                      <div>
                        <div style={{ fontSize: 11, color: C.sub, marginBottom: 2 }}>연간 배당금</div>
                        {r.dps > 0 ? (
                          <div style={{ fontSize: 15, fontWeight: 700, color: C.accent }}>
                            {cur(r.currency)}{fmt(r.annualDiv, priceDigits(r.currency))}
                            <span style={{ fontSize: 11, color: C.sub, marginLeft: 6 }}>
                              주당 {cur(r.currency)}{fmt(r.dps, r.currency === "USD" ? 2 : 0)}
                              {r.value > 0 ? ` · ${fmt((r.annualDiv / r.value) * 100, 2)}%` : ""}
                            </span>
                          </div>
                        ) : (
                          <div style={{ fontSize: 15, color: C.sub }}>-</div>
                        )}
                      </div>
                    </div>

                    <div style={{ display: "flex", gap: 8, justifyContent: "flex-end", marginTop: 12 }}>
                      <button
                        onClick={() => openEdit(r)}
                        style={{ background: "transparent", border: `1px solid ${C.line}`, color: C.sub, borderRadius: 8, padding: "5px 12px", fontSize: 12, cursor: "pointer" }}
                      >
                        수정
                      </button>
                      <button
                        onClick={() => remove(r.id)}
                        style={{ background: "transparent", border: `1px solid ${C.line}`, color: C.sub, borderRadius: 8, padding: "5px 12px", fontSize: 12, cursor: "pointer" }}
                      >
                        삭제
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          );
        })}

        {/* ─── 추가/수정 폼 ─── */}
        {showForm && (
          <div
            style={{
              position: "fixed", inset: 0, background: "rgba(0,0,0,0.6)",
              display: "flex", alignItems: "center", justifyContent: "center", padding: 16, zIndex: 50,
            }}
            onClick={() => setShowForm(false)}
          >
            <div
              onClick={(e) => e.stopPropagation()}
              style={{
                background: C.card, border: `1px solid ${C.line}`, borderRadius: 16,
                padding: 24, width: "100%", maxWidth: 400, maxHeight: "90vh", overflowY: "auto",
              }}
            >
              <h2 style={{ fontSize: 18, fontWeight: 700, margin: "0 0 18px" }}>
                {editingId ? "종목 수정" : "종목 추가"}
              </h2>
              <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
                <div>
                  <label style={labelStyle}>종목명 (표시용)</label>
                  <input
                    style={inputStyle} value={form.name}
                    onChange={(e) => setForm({ ...form, name: e.target.value })}
                    placeholder="예: 삼성전자, 엔비디아, 비트코인"
                  />
                </div>
                <div>
                  <label style={labelStyle}>티커 / 심볼 (자동 시세 조회용)</label>
                  <input
                    style={inputStyle} value={form.symbol}
                    onChange={(e) => setForm({ ...form, symbol: e.target.value })}
                    placeholder="미국:NVDA / 국내:005930.KS / 코스닥:.KQ / 비트:BTC-USD"
                  />
                  <div style={{ fontSize: 11, color: C.sub, marginTop: 5, lineHeight: 1.5 }}>
                    삼성전자→<b>005930.KS</b>, SK하이닉스→<b>000660.KS</b>, 엔비디아→<b>NVDA</b>, 애플→<b>AAPL</b>, 비트코인→<b>BTC-USD</b>
                  </div>
                </div>
                <div>
                  <label style={labelStyle}>계좌</label>
                  <input
                    style={inputStyle} value={form.account} list="account-list"
                    onChange={(e) => setForm({ ...form, account: e.target.value })}
                    placeholder="예: 키움 국내, 토스 미국, ISA"
                  />
                  <datalist id="account-list">
                    {accounts.slice(1).map((a) => <option key={a} value={a} />)}
                  </datalist>
                </div>
                <div>
                  <label style={labelStyle}>통화</label>
                  <div style={{ display: "flex", gap: 8 }}>
                    {["KRW", "USD"].map((c) => (
                      <button
                        key={c}
                        onClick={() => setForm({ ...form, currency: c })}
                        style={{
                          flex: 1, padding: "9px 0", borderRadius: 10,
                          border: `1px solid ${form.currency === c ? C.accent : C.line}`,
                          background: form.currency === c ? "rgba(255,209,102,0.12)" : "transparent",
                          color: form.currency === c ? C.accent : C.sub, fontWeight: 700, cursor: "pointer",
                        }}
                      >
                        {c === "KRW" ? "₩ 원화" : "$ 달러"}
                      </button>
                    ))}
                  </div>
                </div>
                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
                  <div>
                    <label style={labelStyle}>매수가 (평단)</label>
                    <input
                      style={inputStyle} type="number" value={form.buyPrice}
                      onChange={(e) => setForm({ ...form, buyPrice: e.target.value })}
                      placeholder="70000"
                    />
                  </div>
                  <div>
                    <label style={labelStyle}>수량</label>
                    <input
                      style={inputStyle} type="number" value={form.quantity}
                      onChange={(e) => setForm({ ...form, quantity: e.target.value })}
                      placeholder="10"
                    />
                  </div>
                </div>
                <div>
                  <label style={labelStyle}>현재가 (비워두면 시세 새로고침으로 자동 입력)</label>
                  <input
                    style={inputStyle} type="number" value={form.currentPrice}
                    onChange={(e) => setForm({ ...form, currentPrice: e.target.value })}
                    placeholder="자동 조회 가능"
                  />
                </div>
                <div>
                  <label style={labelStyle}>연간 주당 배당금 (선택 · 비워두면 자동 조회)</label>
                  <input
                    style={inputStyle} type="number" value={form.dividend}
                    onChange={(e) => setForm({ ...form, dividend: e.target.value })}
                    placeholder="예: 1444 (삼성전자) / 1.04 (NVDA)"
                  />
                </div>
                <div style={{ display: "flex", gap: 8, marginTop: 4 }}>
                  <button
                    onClick={() => setShowForm(false)}
                    style={{ flex: 1, padding: "11px 0", borderRadius: 10, border: `1px solid ${C.line}`, background: "transparent", color: C.sub, fontSize: 14, cursor: "pointer" }}
                  >
                    취소
                  </button>
                  <button
                    onClick={saveForm}
                    style={{ flex: 2, padding: "11px 0", borderRadius: 10, border: "none", background: C.accent, color: "#1a1a1a", fontSize: 14, fontWeight: 700, cursor: "pointer" }}
                  >
                    {editingId ? "저장" : "추가"}
                  </button>
                </div>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
