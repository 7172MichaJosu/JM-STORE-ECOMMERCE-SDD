import test from "node:test";
import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { fixture, customer, cartQuote } from "../helpers.js";
test("inventario versionado, transición y desactivación preservan historial", async () => {
  const f = await fixture();
  try {
    const { c, address } = await customer(f);
    const { p, quote } = await cartQuote(f, c, address);
    const order = (
      await c.post(
        "/orders",
        { quoteToken: quote.quoteToken, simulationOutcome: "APPROVED" },
        { "Idempotency-Key": randomUUID() },
      )
    ).data;
    const id = (await c.get("/me")).data.id;
    f.db
      .prepare(
        "UPDATE users SET role_id=(SELECT id FROM roles WHERE code='ADMIN') WHERE id=?",
      )
      .run(id);
    const inv = (await c.get("/admin/inventory")).data.find(
      (i) => i.product_id === p.id,
    );
    assert.equal(
      (
        await c.post("/admin/inventory/" + p.id + "/adjustments", {
          expectedVersion: inv.version,
          newQuantity: 10,
          reason: "Ajuste de examen",
        })
      ).status,
      201,
    );
    assert.equal(
      (
        await c.post("/admin/inventory/" + p.id + "/adjustments", {
          expectedVersion: inv.version,
          newQuantity: 20,
          reason: "Obsoleto",
        })
      ).status,
      409,
    );
    assert.equal(
      (
        await c.request(
          "PATCH",
          "/admin/orders/" + order.publicId + "/status",
          { expectedVersion: order.version, status: "DELIVERED" },
        )
      ).status,
      409,
    );
    const changed = await c.request(
      "PATCH",
      "/admin/orders/" + order.publicId + "/status",
      { expectedVersion: order.version, status: "PREPARING" },
    );
    assert.equal(changed.data.status, "PREPARING");
  } finally {
    await f.cleanup();
  }
});
