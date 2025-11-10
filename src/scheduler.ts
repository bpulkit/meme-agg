import { Server as IOServer } from "socket.io";
import { getAggregatedTokens } from "./aggregator";
import { applyFiltersAndSort, tokenMatchesFilters } from "./query";

type Token = any;
type SubscriptionsMap = Map<string, any>;

/**
 * Compute diffs between old and new lists.
 * Emit price updates and volume spikes.
 */
function toMapByAddress(list: Token[]) {
  const m = new Map<string, Token>();
  for (const t of list || []) {
    const k = String(t.token_address || t.token_ticker || t.token_name || "").toLowerCase();
    if (k) m.set(k, t);
  }
  return m;
}

function computeDiffs(oldList: Token[], newList: Token[]) {
  const oldMap = toMapByAddress(oldList);
  const newMap = toMapByAddress(newList);
  const priceUpdates: any[] = [];
  const volumeSpikes: any[] = [];

  for (const [k, newT] of newMap.entries()) {
    const oldT = oldMap.get(k);
    if (!oldT) {
      priceUpdates.push({
        token_address: newT.token_address,
        price_sol: newT.price_sol,
        price_change_pct: null,
        volume_sol: newT.volume_sol,
        kind: "new",
        ts: Date.now(),
      });
      continue;
    }
    const oldPrice = Number(oldT.price_sol ?? 0);
    const newPrice = Number(newT.price_sol ?? 0);
    if (oldPrice !== 0 && newPrice !== oldPrice) {
      const pct = ((newPrice - oldPrice) / Math.abs(oldPrice)) * 100;
      if (Math.abs(pct) >= 0.1 || oldPrice === 0) {
        priceUpdates.push({
          token_address: newT.token_address,
          price_sol: newPrice,
          price_change_pct: Number(pct.toFixed(4)),
          volume_sol: newT.volume_sol,
          kind: "price",
          ts: Date.now(),
        });
      }
    }
    const oldVol = Number(oldT.volume_sol ?? 0);
    const newVol = Number(newT.volume_sol ?? 0);
    if (oldVol > 0 && newVol / oldVol >= 2) {
      volumeSpikes.push({
        token_address: newT.token_address,
        old_volume: oldVol,
        volume_sol: newVol,
        multiplier: Number((newVol / oldVol).toFixed(2)),
        ts: Date.now(),
      });
    }
  }

  return { priceUpdates, volumeSpikes };
}

/**
 * Start scheduler:
 * - io: socket.io server
 * - subscriptions: Map socketId -> { filters, sortBy, limit, cursor }
 */
export function startScheduler(io: IOServer, subscriptions: SubscriptionsMap, intervalMs = Number(process.env.SCHED_INTERVAL_MS || "5000")) {
  let prevTokens: Token[] = [];

  (async () => {
    try {
      prevTokens = await getAggregatedTokens({ forceRefresh: true });
    } catch {
      prevTokens = [];
    }
  })();

  setInterval(async () => {
    try {
      const fresh = await getAggregatedTokens({ forceRefresh: true });
      const diffs = computeDiffs(prevTokens, fresh);

      // For each subscriber, filter diffs according to their filters and emit
      for (const [socketId, sub] of subscriptions.entries()) {
        const socket = io.sockets.sockets.get(socketId);
        if (!socket) continue;
        const filters = sub.filters || {};
        const limit = sub.limit || 30;
        const sortBy = sub.sortBy || "volume";

        // price updates: only emit those that match subscriber filters
        const matchedPriceUpdates = diffs.priceUpdates.filter((u: any) => {
          // find token in fresh snapshot
          const tok = fresh.find((t: any) => String(t.token_address) === String(u.token_address));
          if (!tok) return false;
          return tokenMatchesFilters(tok, filters);
        });

        if (matchedPriceUpdates.length > 0) {
          socket.emit("price_update_batch", matchedPriceUpdates);
        }

        const matchedVolumeSpikes = diffs.volumeSpikes.filter((u: any) => {
          const tok = fresh.find((t: any) => String(t.token_address) === String(u.token_address));
          if (!tok) return false;
          return tokenMatchesFilters(tok, filters);
        });

        if (matchedVolumeSpikes.length > 0) {
          socket.emit("volume_spike_batch", matchedVolumeSpikes);
        }
      }

      prevTokens = fresh;
    } catch (err) {
      console.warn("scheduler fetch error:", err);
    }
  }, intervalMs).unref();
}
