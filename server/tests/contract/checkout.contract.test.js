import test from "node:test";
import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { fixture, customer, cartQuote } from "../helpers.js";
test("rechazo, reintento aprobado e idempotencia con stock una vez", async () => {
  const f = await fixture();
  try {
    const { c, address } = await customer(f);
    const { p, quote } = await cartQuote(f, c, address, 2);
    const before = f.db
      .prepare("SELECT quantity FROM inventory WHERE product_id=?")
      .get(p.id).quantity;
    const key = randomUUID(),
      body = { quoteToken: quote.quoteToken, simulationOutcome: "REJECTED" };
    const rejected = await c.post("/orders", body, { "Idempotency-Key": key });
    assert.equal(rejected.status, 201);
    assert.equal(rejected.data.status, "AWAITING_PAYMENT");
    assert.equal(
      f.db
        .prepare("SELECT quantity FROM inventory WHERE product_id=?")
        .get(p.id).quantity,
      before,
    );
    assert.deepEqual(
      (await c.post("/orders", body, { "Idempotency-Key": key })).data,
      rejected.data,
    );
    assert.equal(
      (
        await c.post(
          "/orders",
          { ...body, simulationOutcome: "APPROVED" },
          { "Idempotency-Key": key },
        )
      ).status,
      409,
    );
    const id = rejected.data.publicId;
    const retry = (await c.post("/orders/" + id + "/payment-quote", {})).data;
    const paid = await c.post(
      "/orders/" + id + "/simulated-payments",
      { quoteToken: retry.quoteToken, simulationOutcome: "APPROVED" },
      { "Idempotency-Key": randomUUID() },
    );
    assert.equal(paid.data.status, "CONFIRMED");
    assert.equal(
      f.db
        .prepare("SELECT quantity FROM inventory WHERE product_id=?")
        .get(p.id).quantity,
      before - 2,
    );
    assert.equal((await c.get("/orders/" + id)).data.payments.length, 2);
    assert.equal(
      (await c.post("/orders/" + id + "/payment-quote", {})).status,
      409,
    );
  } finally {
    await f.cleanup();
  }
});
