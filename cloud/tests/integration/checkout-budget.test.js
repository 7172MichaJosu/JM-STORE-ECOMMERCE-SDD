import { test, expect } from "vitest";
import { env } from "cloudflare:workers";
import { client } from "../fixtures/client.js";
import { seedMinimal } from "../fixtures/database.js";
import { connect } from "../../src/db/connection.js";
import { configuration } from "../../src/config.js";
import { pay } from "../../src/repositories/checkout.js";
async function requestFor(c, q) {
  const user = (await c.request("GET", "/me")).data,
    db = connect(env.DB),
    session = await db.first("SELECT * FROM sessions WHERE user_id=?", user.id);
  return {
    db,
    user,
    session,
    authVersion: session.auth_version,
    config: configuration(env),
    body: { quoteToken: q.quoteToken, simulationOutcome: "APPROVED" },
    get: () => crypto.randomUUID(),
  };
}
test("100 líneas se compran por conjuntos dentro del presupuesto de30 sentencias", async () => {
  await seedMinimal(env.DB);
  const c = client(),
    { cart, address } = await c.prepare();
  await env.DB.prepare(
    "WITH RECURSIVE seq(x) AS(SELECT 2 UNION ALL SELECT x+1 FROM seq WHERE x<100) INSERT INTO products(id,category_id,sku,slug,name,description,base_price_cents) SELECT x,1,'sku-'||x,'p-'||x,'Producto','Prueba',100 FROM seq",
  ).run();
  await env.DB.batch([
    env.DB.prepare(
      "INSERT INTO inventory SELECT id,10,1,'now' FROM products WHERE id>1",
    ),
    env.DB.prepare(
      "INSERT INTO cart_items SELECT ?,id,1 FROM products WHERE id>1",
    ).bind(cart.cartId),
    env.DB.prepare("UPDATE carts SET version=version+1 WHERE id=?").bind(
      cart.cartId,
    ),
  ]);
  const full = (await c.request("GET", "/cart")).data;
  expect(full.items).toHaveLength(100);
  const edited = await c.request("PUT", "/cart/items/1", {
    quantity: 2,
    cartVersion: full.version,
  });
  expect(edited.status).toBe(200);
  const q = (
      await c.request("POST", "/checkout/quote", {
        addressId: address.id,
        cartVersion: edited.data.version,
      })
    ).data,
    req = await requestFor(c, q),
    before = req.db.preparedCount;
  const result = await pay(req);
  expect(result.items).toHaveLength(100);
  expect(result.status).toBe("CONFIRMED");
  // +8 includes lookup/user/touch, global/checkout limits and both bounded cleanup statements.
  expect(req.db.preparedCount - before + 8).toBeLessThanOrEqual(30);
});
test("cambio DESPUÉS de releer resumen se detecta dentro del batch y revierte", async () => {
  await seedMinimal(env.DB);
  const c = client(),
    { quote } = await c.prepare(),
    req = await requestFor(c, quote),
    batch = req.db.batch;
  req.db.batch = async (statements) => {
    await env.DB.prepare(
      "UPDATE inventory SET quantity=0,version=version+1 WHERE product_id=1",
    ).run();
    return batch(statements);
  };
  await expect(pay(req)).rejects.toThrow("MUTATION_CONFLICT");
  expect(await env.DB.prepare("SELECT count(*) n FROM orders").first("n")).toBe(
    0,
  );
});
