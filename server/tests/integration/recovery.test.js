import test from "node:test";
import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { fixture, customer, cartQuote } from "../helpers.js";
import { seed } from "../../src/modules/catalog/seed-data.js";
test("rollback por fallo después de descontar no deja pedido, pago ni stock parcial", async () => {
  const f = await fixture();
  try {
    const { c, address } = await customer(f);
    const { p, quote } = await cartQuote(f, c, address, 2);
    const before = f.db
      .prepare("SELECT quantity FROM inventory WHERE product_id=?")
      .get(p.id).quantity;
    f.db.exec(
      "CREATE TRIGGER fail_sale BEFORE INSERT ON inventory_movements WHEN NEW.kind='SALE' BEGIN SELECT RAISE(ABORT,'injected test fault'); END",
    );
    const result = await c.post(
      "/orders",
      { quoteToken: quote.quoteToken, simulationOutcome: "APPROVED" },
      { "Idempotency-Key": randomUUID() },
    );
    assert.equal(result.status, 500);
    assert.equal(
      f.db
        .prepare("SELECT quantity FROM inventory WHERE product_id=?")
        .get(p.id).quantity,
      before,
    );
    for (const table of [
      "orders",
      "order_items",
      "simulated_payments",
      "idempotency_records",
    ])
      assert.equal(f.db.prepare("SELECT COUNT(*) n FROM " + table).get().n, 0);
    assert.equal(
      f.db
        .prepare("SELECT COUNT(*) n FROM inventory_movements WHERE kind='SALE'")
        .get().n,
      0,
    );
  } finally {
    await f.cleanup();
  }
});
test("pedido rechazado conserva precio y requiere nueva compra si cambia", async () => {
  const f = await fixture();
  try {
    const { c, address } = await customer(f);
    const { p, quote } = await cartQuote(f, c, address);
    const rejected = (
      await c.post(
        "/orders",
        { quoteToken: quote.quoteToken, simulationOutcome: "REJECTED" },
        { "Idempotency-Key": randomUUID() },
      )
    ).data;
    f.db
      .prepare("UPDATE promotions SET is_active=0 WHERE product_id=?")
      .run(p.id);
    f.db
      .prepare(
        "UPDATE products SET base_price_cents=base_price_cents+100,version=version+1 WHERE id=?",
      )
      .run(p.id);
    assert.equal(
      (await c.post("/orders/" + rejected.publicId + "/payment-quote", {}))
        .error.code,
      "NEW_CHECKOUT_REQUIRED",
    );
    const record = (await c.get("/orders/" + rejected.publicId)).data;
    assert.equal(record.total_cents, rejected.total_cents);
    assert.equal(record.payments.length, 1);
  } finally {
    await f.cleanup();
  }
});
test("carrito persiste al login y seed respeta stock editado", async () => {
  const f = await fixture();
  try {
    const c = f.client(),
      u = await c.register();
    const p = (await c.get("/products")).data[0],
      cart = (await c.get("/cart")).data;
    await c.request("PUT", "/cart/items/" + p.id, {
      quantity: 3,
      cartVersion: cart.version,
    });
    await c.post("/auth/logout", {});
    await c.post("/auth/login", { email: u.email, password: u.password });
    assert.equal((await c.get("/cart")).data.items[0].quantity, 3);
    f.db
      .prepare("UPDATE inventory SET quantity=7 WHERE product_id=?")
      .run(p.id);
    seed(f.db);
    assert.equal(
      f.db
        .prepare("SELECT quantity FROM inventory WHERE product_id=?")
        .get(p.id).quantity,
      7,
    );
    assert.equal(f.db.prepare("SELECT COUNT(*) n FROM products").get().n, 20);
  } finally {
    await f.cleanup();
  }
});
