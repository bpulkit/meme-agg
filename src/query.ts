/**
 * Helpers for filtering, sorting and cursor pagination.
 *
 * - filters: { period: '1h'|'24h'|'7d', minVolume?: number }
 * - sortBy: 'volume' | 'price_change' | 'market_cap' (prefix '-' for desc, default desc)
 * - cursor: stringified offset (we use number offset)
 */

type Token = any;

function getPriceChangeField(period?: string) {
  if (period === "1h") return "price_1hr_change";
  if (period === "24h") return "price_24h_change";
  if (period === "7d") return "price_7d_change";
  return "price_24h_change";
}

export function applyFiltersAndSort(tokens: Token[], opts?: {
  filters?: { period?: string; minVolume?: number; protocol?: string; q?: string },
  sortBy?: string,
  limit?: number,
  cursor?: string
}) {
  const filters = opts?.filters || {};
  const sortBy = opts?.sortBy || "volume";
  const limit = Number(opts?.limit || 20);
  const cursor = Number(opts?.cursor || 0);

  // filter
  let list = tokens.filter((t: Token) => {
    if (!t) return false;
    if (filters.minVolume && Number(t.volume_sol || 0) < Number(filters.minVolume)) return false;
    if (filters.protocol && String(t.protocol || "").toLowerCase() !== String(filters.protocol).toLowerCase()) return false;
    if (filters.q) {
      const q = String(filters.q).toLowerCase();
      const found = String(t.token_name || "").toLowerCase().includes(q) || String(t.token_ticker || "").toLowerCase().includes(q);
      if (!found) return false;
    }
    return true;
  });

  // sort
  const priceField = getPriceChangeField(filters.period);
  list.sort((a: Token, b: Token) => {
    if (sortBy === "market_cap") {
      return Number(b.market_cap_sol || 0) - Number(a.market_cap_sol || 0);
    }
    if (sortBy === "price_change") {
      return Number(b[priceField] || 0) - Number(a[priceField] || 0);
    }
    // default volume
    return Number(b.volume_sol || 0) - Number(a.volume_sol || 0);
  });

  // cursor pagination (offset)
  const slice = list.slice(cursor, cursor + limit);
  const nextCursor = cursor + slice.length < list.length ? String(cursor + slice.length) : null;

  return { items: slice, nextCursor, total: list.length };
}

export function tokenMatchesFilters(token: Token, filters?: any) {
  if (!token) return false;
  if (!filters) return true;
  if (filters.minVolume && Number(token.volume_sol || 0) < Number(filters.minVolume)) return false;
  if (filters.protocol && String(token.protocol || "").toLowerCase() !== String(filters.protocol).toLowerCase()) return false;
  if (filters.q) {
    const q = String(filters.q).toLowerCase();
    const found = String(token.token_name || "").toLowerCase().includes(q) || String(token.token_ticker || "").toLowerCase().includes(q);
    if (!found) return false;
  }
  return true;
}
