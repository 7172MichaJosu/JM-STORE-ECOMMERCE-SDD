import test from "node:test";
import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { fixture, customer, cartQuote } from "../helpers.js";
test("cambio de precio, token manipulado y rollback no crean pedido", async () => {
  const f = await fixture();
  try {
    const { c, address } = await customer(f);
    const { p, quote } = await cartQuote(f, c, address);
    assert.equal(
      (
        await c.post(
          "/orders",
          { quoteToken: quote.quoteToken + "x", simulationOutcome: "APPROVED" },
          { "Idempotency-Key": randomUUID() },
        )
      ).status,
      409,
    );
    f.db
      .prepare(
        "UPDATE products SET base_price_cents=base_price_cents+100,version=version+1 WHERE id=?",
      )
      .run(p.id);
    assert.equal(
      (
        await c.post(
          "/orders",
          { quoteToken: quote.quoteToken, simulationOutcome: "APPROVED" },
          { "Idempotency-Key": randomUUID() },
        )
      ).status,
      409,
    );
    assert.equal(f.db.prepare("SELECT COUNT(*) n FROM orders").get().n, 0);
  } finally {
    await f.cleanup();
  }
});
test("dos compradores y una unidad: solo una compra, sin sobreventa", async () => {
  const f = await fixture();
  try {
    const one = await customer(f),
      two = await customer(f);
    const product = (await one.c.get("/products")).data.find(
      (p) => p.available_quantity > 0,
    );
    f.db
      .prepare(
        "UPDATE inventory SET quantity=1,version=version+1 WHERE product_id=?",
      )
      .run(product.id);
    async function quoteFor(x) {
      const cart = (await x.c.get("/cart")).data;
      await x.c.request("PUT", "/cart/items/" + product.id, {
        quantity: 1,
        cartVersion: cart.version,
      });
      return (
        await x.c.post("/checkout/quote", {
          addressId: x.address.id,
          cartVersion: (await x.c.get("/cart")).data.version,
        })
      ).data;
    }
    const q1 = await quoteFor(one),
      q2 = await quoteFor(two);
    const results = await Promise.all([
      one.c.post(
        "/orders",
        { quoteToken: q1.quoteToken, simulationOutcome: "APPROVED" },
        { "Idempotency-Key": randomUUID() },
      ),
      two.c.post(
        "/orders",
        { quoteToken: q2.quoteToken, simulationOutcome: "APPROVED" },
        { "Idempotency-Key": randomUUID() },
      ),
    ]);
    assert.deepEqual(results.map((r) => r.status).sort(), [201, 409]);
    assert.equal(
      f.db
        .prepare("SELECT quantity FROM inventory WHERE product_id=?")
        .get(product.id).quantity,
      0,
    );
  } finally {
    await f.cleanup();
  }
});
