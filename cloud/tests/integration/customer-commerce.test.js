import { test, expect, vi } from "vitest";
import { env } from "cloudflare:workers";
import { client } from "../fixtures/client.js";
import { seedMinimal } from "../fixtures/database.js";
test("rechazo, reintento y aprobación idempotente conservan snapshots y stock", async () => {
  await seedMinimal(env.DB);
  const c = client(),
    { quote } = await c.prepare();
  const key = crypto.randomUUID();
  const body = { quoteToken: quote.quoteToken, simulationOutcome: "REJECTED" };
  let r = await c.request("POST", "/orders", body, key);
  expect(r.status).toBe(201);
  const order = r.data;
  expect(order.status).toBe("AWAITING_PAYMENT");
  expect(
    await env.DB.prepare(
      "SELECT quantity FROM inventory WHERE product_id=1",
    ).first("quantity"),
  ).toBe(8);
  expect((await c.request("POST", "/orders", body, key)).data).toEqual(order);
  const time = vi.spyOn(Date, "now").mockReturnValue(Date.now() + 360000);
  try {
    expect((await c.request("POST", "/orders", body, key)).data).toEqual(order);
  } finally {
    time.mockRestore();
  }
  expect(
    (
      await c.request(
        "POST",
        "/orders",
        { ...body, simulationOutcome: "APPROVED" },
        key,
      )
    ).status,
  ).toBe(409);
  const retry = (
    await c.request("POST", "/orders/" + order.publicId + "/payment-quote", {})
  ).data;
  const paid = await c.request(
    "POST",
    "/orders/" + order.publicId + "/simulated-payments",
    { quoteToken: retry.quoteToken, simulationOutcome: "APPROVED" },
    crypto.randomUUID(),
  );
  expect(paid.status).toBe(201);
  expect(paid.data.status).toBe("CONFIRMED");
  expect(paid.data.payments).toHaveLength(2);
  expect(
    await env.DB.prepare(
      "SELECT quantity FROM inventory WHERE product_id=1",
    ).first("quantity"),
  ).toBe(7);
  expect(
    (await c.request("GET", "/orders/" + order.publicId)).data.total_cents,
  ).toBe(89900);
  expect((await c.request("GET", "/cart")).data.items).toEqual([]);
});
test("cotización obsoleta o manipulada no crea pedido", async () => {
  await seedMinimal(env.DB);
  const c = client(),
    { quote } = await c.prepare();
  await env.DB.prepare(
    "UPDATE products SET base_price_cents=99900,version=version+1 WHERE id=1",
  ).run();
  expect(
    (
      await c.request(
        "POST",
        "/orders",
        { quoteToken: quote.quoteToken, simulationOutcome: "APPROVED" },
        crypto.randomUUID(),
      )
    ).status,
  ).toBe(409);
  expect(
    (
      await c.request(
        "POST",
        "/orders",
        { quoteToken: quote.quoteToken + "x", simulationOutcome: "APPROVED" },
        crypto.randomUUID(),
      )
    ).status,
  ).toBe(409);
  expect(await env.DB.prepare("SELECT count(*) n FROM orders").first("n")).toBe(
    0,
  );
});
test("dos compradores por última unidad no generan sobreventa", async () => {
  await seedMinimal(env.DB, { quantity: 1 });
  const a = client(),
    b = client();
  const qa = await a.prepare(),
    qb = await b.prepare();
  const results = await Promise.all(
    [
      [a, qa],
      [b, qb],
    ].map(([c, q]) =>
      c.request(
        "POST",
        "/orders",
        { quoteToken: q.quote.quoteToken, simulationOutcome: "APPROVED" },
        crypto.randomUUID(),
      ),
    ),
  );
  expect(results.map((r) => r.status).sort()).toEqual([201, 409]);
  expect(
    await env.DB.prepare(
      "SELECT quantity FROM inventory WHERE product_id=1",
    ).first("quantity"),
  ).toBe(0);
  expect(
    await env.DB.prepare(
      "SELECT count(*) n FROM simulated_payments WHERE outcome='APPROVED'",
    ).first("n"),
  ).toBe(1);
});
test("fallo SQL después del descuento revierte pedido, pago, movimiento y stock", async () => {
  await seedMinimal(env.DB);
  const c = client(),
    { quote } = await c.prepare();
  await env.DB.prepare(
    "CREATE TRIGGER injected_failure BEFORE INSERT ON inventory_movements WHEN NEW.kind='SALE' BEGIN SELECT RAISE(ABORT,'INJECTED_FAILURE'); END",
  ).run();
  try {
    const r = await c.request(
      "POST",
      "/orders",
      { quoteToken: quote.quoteToken, simulationOutcome: "APPROVED" },
      crypto.randomUUID(),
    );
    expect(r.status).toBe(503);
    expect(
      await env.DB.prepare("SELECT count(*) n FROM orders").first("n"),
    ).toBe(0);
    expect(
      await env.DB.prepare(
        "SELECT quantity FROM inventory WHERE product_id=1",
      ).first("quantity"),
    ).toBe(8);
  } finally {
    await env.DB.prepare("DROP TRIGGER injected_failure").run();
  }
});
