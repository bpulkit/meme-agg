const { io: Client } = require("socket.io-client");

const WS = process.env.WS_URL || "http://localhost:3000";
jest.setTimeout(20000);

describe("WebSocket tests", () => {
  let clientA;
  let clientB;

  afterEach(() => {
    if (clientA && clientA.connected) clientA.disconnect();
    if (clientB && clientB.connected) clientB.disconnect();
  });

  test("socket subscribe receives initial_data", (done) => {
    clientA = Client(WS, { transports: ["websocket"] });
    clientA.on("connect", () => {
      clientA.emit("subscribe", { filters: { protocol: "Orca" }, limit: 10 });
    });
    clientA.on("initial_data", (data) => {
      try {
        expect(data).toHaveProperty("items");
        expect(Array.isArray(data.items)).toBeTruthy();
        done();
      } catch (err) {
        done(err);
      }
    });
  });

  test("socket receives price_update_batch events", (done) => {
    clientB = Client(WS, { transports: ["websocket"] });
    clientB.on("connect", () => {
      clientB.emit("subscribe", { filters: {}, limit: 30 });
    });
    clientB.on("initial_data", () => {
      clientB.on("price_update_batch", (batch) => {
        try {
          expect(Array.isArray(batch)).toBeTruthy();
          if (batch.length > 0) expect(batch[0]).toHaveProperty("token_address");
          done();
        } catch (err) {
          done(err);
        }
      });
    });
  });
});
