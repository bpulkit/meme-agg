import express from "express";
import http from "http";
import { Server as IOServer } from "socket.io";
import dotenv from "dotenv";
import { getAggregatedTokens } from "./aggregator";
import { redis } from "./cache";
import { applyFiltersAndSort, tokenMatchesFilters } from "./query";
import { startScheduler } from "./scheduler";

dotenv.config();

const app = express();
app.use(express.json());

app.get("/health", (_req, res) => res.json({ status: "ok" }));

app.get("/tokens", async (req, res) => {
  try {
    const limit = Math.min(100, parseInt(String(req.query.limit || "20"), 10));
    const cursor = String(req.query.cursor || "0");
    const sortBy = String(req.query.sortBy || "volume");
    const period = String(req.query.period || "24h");
    const minVolume = req.query.minVolume ? Number(req.query.minVolume) : undefined;
    const protocol = req.query.protocol ? String(req.query.protocol) : undefined;
    const q = req.query.q ? String(req.query.q) : undefined;

    const tokens = await getAggregatedTokens();
    const result = applyFiltersAndSort(tokens, { filters: { period, minVolume, protocol, q }, sortBy, limit, cursor });
    res.json(result);
  } catch (e: any) {
    console.error("tokens err", e);
    res.status(500).json({ error: "failed" });
  }
});

// debug fetch
import { fetchFromGeckoTerminal, fetchFromDexScreener } from "./fetchers";
app.get("/debug/fetch", async (_req, res) => {
  try {
    const g = await fetchFromGeckoTerminal().catch((e) => ({ error: String(e) }));
    const d = await fetchFromDexScreener("solana").catch((e) => ({ error: String(e) }));
    res.json({ gecko: Array.isArray(g) ? { len: g.length, sample: g.slice(0,3) } : g, dexscreener: d });
  } catch (e: any) {
    res.status(500).json({ error: String(e) });
  }
});

const server = http.createServer(app);
const io = new IOServer(server, {
  cors: { origin: "*" },
});

// subscriptions map: socketId -> { filters, limit, sortBy, period, cursor }
const subscriptions = new Map<string, any>();

io.on("connection", (socket) => {
  console.log("ws connected:", socket.id);

  socket.on("subscribe", async (payload = {}) => {
    // payload may contain { filters: { period, minVolume, protocol, q }, limit, sortBy, cursor }
    const filters = payload.filters || {};
    const sortBy = payload.sortBy || "volume";
    const limit = Number(payload.limit || 30);
    const cursor = String(payload.cursor || "0");

    subscriptions.set(socket.id, { filters, sortBy, limit, cursor });
    socket.join("public");

    try {
      const tokens = await getAggregatedTokens();
      const result = applyFiltersAndSort(tokens, { filters: { ...filters }, sortBy, limit, cursor });
      socket.emit("initial_data", result);
      socket.emit("subscribed", { ok: true });
    } catch (e) {
      socket.emit("error", { message: "failed to load tokens" });
    }
  });

  socket.on("update_subscription", (payload = {}) => {
    const existing = subscriptions.get(socket.id) || {};
    const newSub = { ...existing, ...payload };
    subscriptions.set(socket.id, newSub);
  });

  socket.on("disconnect", () => {
    console.log("ws disconnected:", socket.id);
    subscriptions.delete(socket.id);
  });
});

// start scheduler and pass subscriptions map for per-socket filtering
startScheduler(io, subscriptions);

const PORT = process.env.PORT || 3000;
server.listen(PORT, () => {
  console.log(`Server listening on http://localhost:${PORT}`);
});
