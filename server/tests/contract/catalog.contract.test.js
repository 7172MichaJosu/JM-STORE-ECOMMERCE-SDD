import test from "node:test";
import assert from "node:assert/strict";
import { fixture } from "../helpers.js";
test("contrato público: categorías, filtros, precios y detalle", async () => {
  const f = await fixture();
  try {
    const c = f.client();
    const cats = await c.get("/categories");
    assert.equal(cats.status, 200);
    assert.equal(cats.data.length, 5);
    const list = await c.get("/products?q=&pageSize=100");
    assert.equal(list.data.length, 20);
    const p = list.data[0];
    assert.equal(p.currency, "PEN");
    assert.ok(Number.isInteger(p.effective_price_cents));
    assert.equal((await c.get("/products/" + p.slug)).data.id, p.id);
    assert.equal(
      (await c.get("/products?minPriceCents=200&maxPriceCents=100")).status,
      422,
    );
    assert.equal((await c.get("/products?invalid=1")).status, 422);
    assert.equal((await c.get("/products?q=noexistejmstore")).data.length, 0);
  } finally {
    await f.cleanup();
  }
});
