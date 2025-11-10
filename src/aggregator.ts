import { cacheGet, cacheSet } from "./cache";
import { fetchFromDexScreener, fetchFromGeckoTerminal } from "./fetchers";

const DEFAULT_TTL = parseInt(process.env.CACHE_TTL || "30", 10);

function normalizeToken(raw: any) {
  return {
    token_address: raw.address || raw.token_address || raw.id || (raw.token && raw.token.address),
    token_name: raw.name || (raw.token && raw.token.name),
    token_ticker: raw.symbol || (raw.token && raw.token.symbol),
    price_sol: raw.price || raw.token?.price || raw.price_sol || raw.quote || raw.priceUsd,
    market_cap_sol: raw.marketCap || raw.market_cap || raw.market_cap_sol,
    volume_sol: raw.volume_24h || raw.volume || raw.volume_sol,
    liquidity_sol: raw.liquidity || raw.liquidity_sol,
    transaction_count: raw.tx_count || raw.transaction_count,
    price_1hr_change: raw.priceChange1h || raw.price_1hr_change,
    protocol: raw.protocol || raw.dex?.name,
    raw_source: raw,
  };
}

export function mergeTokenLists(lists: any[][]) {
  const map = new Map<string, any>();
  for (const list of lists) {
    for (const raw of list || []) {
      const norm = normalizeToken(raw);
      const key = String(norm.token_address || norm.token_ticker || (norm.token_name || "")).toLowerCase();
      if (!key) continue;
      const existing = map.get(key) || {};
      const merged = { ...existing, ...Object.fromEntries(Object.entries(norm).filter(([_, v]) => v !== undefined && v !== null)) };
      map.set(key, merged);
    }
  }
  return Array.from(map.values());
}

export async function getAggregatedTokens(opts?: { forceRefresh?: boolean }) {
  const cacheKey = "agg:tokens:v1";
  if (!opts?.forceRefresh) {
    const cached = await cacheGet(cacheKey);
    if (cached) return cached;
  }

  const results: any[] = [];
  try {
    const [geckoResp, dexsResp] = await Promise.allSettled([fetchFromGeckoTerminal(), fetchFromDexScreener("solana")]);
    if (geckoResp.status === "fulfilled") {
      const data = geckoResp.value?.data || geckoResp.value?.results || geckoResp.value?.tokens || geckoResp.value;
      if (Array.isArray(data)) results.push(data);
      else if (data && data.tokens) results.push(data.tokens);
    }
    if (dexsResp.status === "fulfilled") {
      const d = dexsResp.value?.pairs || dexsResp.value;
      if (Array.isArray(d)) results.push(d);
      else if (dexsResp.value?.pairs) results.push(dexsResp.value.pairs);
    }
  } catch (e) {
    console.warn("fetch errors", e);
  }

  const merged = mergeTokenLists(results);
  await cacheSet(cacheKey, merged, DEFAULT_TTL);
  return merged;
}
