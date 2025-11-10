import axios, { AxiosRequestConfig } from "axios";
import https from "https";
import dotenv from "dotenv";
dotenv.config();

const defaultTimeout = 10_000;
const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));
const disableTls = process.env.DISABLE_TLS_VERIFY === "1";
const httpsAgent = new https.Agent({ rejectUnauthorized: !disableTls });

async function httpGetWithRetry<T>(url: string, cfg: AxiosRequestConfig = {}, maxRetries = 3): Promise<T> {
  let attempt = 0;
  let lastErr: any = null;
  while (attempt <= maxRetries) {
    try {
      const res = await axios.get<T>(url, { timeout: defaultTimeout, httpsAgent, ...cfg });
      return res.data;
    } catch (err: any) {
      lastErr = err;
      attempt++;
      const backoff = Math.pow(2, attempt) * 200 + Math.floor(Math.random() * 100);
      if (attempt > maxRetries) break;
      await sleep(backoff);
    }
  }
  throw lastErr;
}

// Mock generator with extra change periods
function makeMockTokens(n = 30) {
  const now = Date.now();
  const arr: any[] = [];
  for (let i = 0; i < n; i++) {
    const pct1 = (Math.random() - 0.5) * 50;
    const pct24 = (Math.random() - 0.5) * 100;
    const pct7 = (Math.random() - 0.5) * 300;
    arr.push({
      token_address: `MOCK${i}`,
      token_name: `Mock Token ${i}`,
      token_ticker: `MCK${i}`,
      price_sol: Number((Math.random() * 0.001).toFixed(12)),
      market_cap_sol: Number((Math.random() * 1000).toFixed(4)),
      volume_sol: Number((Math.random() * 500).toFixed(4)),
      liquidity_sol: Number((Math.random() * 200).toFixed(4)),
      transaction_count: Math.floor(Math.random() * 10000),
      price_1hr_change: Number(pct1.toFixed(4)),
      price_24h_change: Number(pct24.toFixed(4)),
      price_7d_change: Number(pct7.toFixed(4)),
      protocol: i % 2 === 0 ? "Raydium CLMM" : "Orca",
      _mock_ts: now
    });
  }
  return arr;
}

export async function fetchFromDexScreener(tokenAddressOrQuery: string) {
  if (process.env.MOCK_API === "1") return makeMockTokens(25);
  const asAddr = /^0x/i.test(tokenAddressOrQuery) ? tokenAddressOrQuery : null;
  if (asAddr) {
    const url = `https://api.dexscreener.com/latest/dex/tokens/${asAddr}`;
    return await httpGetWithRetry<any>(url, {}, 3);
  } else {
    const url = `https://api.dexscreener.com/latest/dex/search?q=${encodeURIComponent(tokenAddressOrQuery)}`;
    return await httpGetWithRetry<any>(url, {}, 2);
  }
}

export async function fetchFromGeckoTerminal() {
  if (process.env.MOCK_API === "1") return makeMockTokens(30);
  const url = `https://api.geckoterminal.com/api/v2/networks/solana/tokens`;
  return await httpGetWithRetry<any>(url, {}, 3);
}
