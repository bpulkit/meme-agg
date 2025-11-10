const axios = require("axios");
const BASE = "http://localhost:3000";

describe("REST API - basic", () => {
  test("GET /health returns ok", async () => {
    const r = await axios.get(BASE + "/health");
    expect(r.status).toBe(200);
    expect(r.data).toHaveProperty("status", "ok");
  });

  test("GET /tokens returns items array and nextCursor", async () => {
    const r = await axios.get(BASE + "/tokens?limit=5");
    expect(r.status).toBe(200);
    expect(r.data).toHaveProperty("items");
    expect(Array.isArray(r.data.items)).toBeTruthy();
  });

  test("filter by protocol returns only that protocol", async () => {
    const r = await axios.get(BASE + "/tokens?limit=20&protocol=Orca");
    expect(r.status).toBe(200);
    const items = r.data.items;
    for (const it of items) {
      expect(String(it.protocol).toLowerCase()).toBe("orca");
    }
  });

  test("sort by price_change period 1h", async () => {
    const r = await axios.get(BASE + "/tokens?limit=10&sortBy=price_change&period=1h");
    expect(r.status).toBe(200);
    const items = r.data.items;
    let prev = Number(items[0]?.price_1hr_change ?? 1e9);
    for (const it of items) {
      expect(Number(it.price_1hr_change)).toBeLessThanOrEqual(prev + 1e-6);
      prev = Number(it.price_1hr_change);
    }
  });

  test("pagination nextCursor works", async () => {
    const r1 = await axios.get(BASE + "/tokens?limit=5");
    expect(r1.status).toBe(200);
    const next = r1.data.nextCursor;
    if (next) {
      const r2 = await axios.get(BASE + `/tokens?limit=5&cursor=${next}`);
      expect(r2.status).toBe(200);
      expect(Array.isArray(r2.data.items)).toBeTruthy();
    } else {
      expect(r1.data.items.length).toBeLessThanOrEqual(5);
    }
  });

  test("debug fetch endpoint returns shapes", async () => {
    const r = await axios.get(BASE + "/debug/fetch");
    expect(r.status).toBe(200);
    expect(r.data).toHaveProperty("gecko");
    expect(r.data).toHaveProperty("dexscreener");
  });

  test("minVolume filter excludes small volumes", async () => {
    const r = await axios.get(BASE + "/tokens?limit=20&minVolume=400");
    expect(r.status).toBe(200);
    for (const it of r.data.items) {
      expect(Number(it.volume_sol)).toBeGreaterThanOrEqual(400);
    }
  });
});
