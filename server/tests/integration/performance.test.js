import test from "node:test";
import assert from "node:assert/strict";
import { fixture } from "../helpers.js";
test("referencia local: 100 productos y 20 sesiones, p95 de búsqueda <=2 s", async () => {
  const f = await fixture();
  try {
    for (let i = 21; i <= 100; i++) {
      const row = f.db
        .prepare(
          "INSERT INTO products(category_id,sku,slug,name,description,base_price_cents) VALUES(1,?,?,?,?,1000)",
        )
        .run(
          "LOAD-" + i,
          "carga-" + i,
          "Producto carga " + i,
          "Datos de referencia para carga local.",
        );
      f.db
        .prepare(
          "INSERT INTO inventory(product_id,quantity,updated_at) VALUES(?,100,?)",
        )
        .run(Number(row.lastInsertRowid), new Date().toISOString());
    }
    const clients = Array.from({ length: 20 }, () => f.client());
    await Promise.all(clients.map((c) => c.get("/auth/session")));
    const durations = await Promise.all(
      clients.map(async (c) => {
        const start = performance.now();
        const result = await c.get("/products?q=Producto&pageSize=20");
        assert.equal(result.status, 200);
        return performance.now() - start;
      }),
    );
    durations.sort((a, b) => a - b);
    const p95 = durations[18];
    console.log(
      "Carga local 100 productos/20 sesiones, p95=" + Math.round(p95) + " ms",
    );
    assert.ok(p95 <= 2000);
  } finally {
    await f.cleanup();
  }
});
