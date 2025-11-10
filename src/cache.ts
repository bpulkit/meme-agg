import IORedis from "ioredis";
import dotenv from "dotenv";
dotenv.config();

const redisUrl = process.env.REDIS_URL || "redis://127.0.0.1:6379";

// Use lazyConnect so we don't immediately spam connection attempts.
// We'll try to connect on-demand in cache methods.
const redisClient = new IORedis(redisUrl, { lazyConnect: true, maxRetriesPerRequest: 0 });

// attach a safe error handler to avoid unhandled error events
redisClient.on("error", (err: Error) => {
  // only warn once per distinct message to reduce noisy logs
  console.warn("[ioredis] error:", err.message);
});

// expose redis client (may not be connected)
export const redis = redisClient;

// in-memory fallback store
const memStore = new Map<string, string>();

async function tryConnectIfNeeded() {
  try {
    if (!redisClient.status || redisClient.status === "end") {
      await redisClient.connect().catch(() => {/* ignore connect errors */});
    }
  } catch {
    // ignore
  }
}

export const cacheGet = async (key: string) => {
  try {
    await tryConnectIfNeeded();
    if (redisClient.status === "ready") {
      const v = await redisClient.get(key);
      if (!v) return null;
      try { return JSON.parse(v); } catch { return null; }
    }
  } catch (e) {
    // fall through to mem fallback
  }

  // fallback
  const v = memStore.get(key);
  if (!v) return null;
  try { return JSON.parse(v); } catch { return null; }
};

export const cacheSet = async (key: string, value: any, ttlSeconds = 30) => {
  const s = JSON.stringify(value);
  try {
    await tryConnectIfNeeded();
    if (redisClient.status === "ready") {
      if (ttlSeconds > 0) {
        await redisClient.set(key, s, "EX", ttlSeconds);
      } else {
        await redisClient.set(key, s);
      }
      return;
    }
  } catch (e) {
    // ignore and fallback to memory store
  }

  // fallback
  memStore.set(key, s);
  if (ttlSeconds > 0) {
    setTimeout(() => memStore.delete(key), ttlSeconds * 1000).unref();
  }
};
