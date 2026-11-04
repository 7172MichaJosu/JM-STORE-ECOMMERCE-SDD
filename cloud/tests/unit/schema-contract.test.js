import { test, expect } from "vitest";
import { env } from "cloudflare:workers";
import { seedOrder, seedMinimal } from "../fixtures/database.js";
const q = (s, ...v) => env.DB.prepare(s).bind(...v);
test("roles, usuarios y constraints de identidad", async () => {
  await q("INSERT INTO roles(code) VALUES('CUSTOMER')").run();
  await expect(
    q("INSERT INTO roles(code) VALUES('OTHER')").run(),
  ).rejects.toThrow();
  await expect(
    q(
      "INSERT INTO users(role_id,email,name,password_hash,created_at,updated_at) VALUES(99,'a@example.test','AB','hash','now','now')",
    ).run(),
  ).rejects.toThrow();
  await expect(
    q(
      "INSERT INTO users(role_id,email,name,password_hash,created_at,updated_at) VALUES(1,'UPPER@example.test','AB','hash','now','now')",
    ).run(),
  ).rejects.toThrow();
});
test("catálogo, stock, carritos y dinero mantienen límites", async () => {
  await q(
    "INSERT INTO categories(id,name,slug) VALUES(1,'Prueba','prueba')",
  ).run();
  await q(
    "INSERT INTO products(id,category_id,sku,slug,name,description,base_price_cents) VALUES(1,1,'TEST','test','Producto','Prueba',100)",
  ).run();
  await expect(
    q("INSERT INTO inventory VALUES(1,-1,1,'now')").run(),
  ).rejects.toThrow();
  await expect(
    q(
      "INSERT INTO product_images(product_id,asset_path,alt_text,position) VALUES(1,'a','',0)",
    ).run(),
  ).rejects.toThrow();
  await expect(
    q(
      "INSERT INTO products(category_id,sku,slug,name,description,base_price_cents) VALUES(1,'OTHER','other','Producto','Prueba',0)",
    ).run(),
  ).rejects.toThrow();
});
test("tablas comerciales y operativas existen sin abrir deployment", async () => {
  const { results } = await q(
    "SELECT name FROM sqlite_master WHERE type='table'",
  ).all();
  for (const name of [
    "orders",
    "order_items",
    "simulated_payments",
    "inventory_movements",
    "order_status_history",
    "idempotency_records",
    "migration_runs",
    "migration_chunks",
    "security_events",
    "rate_limit_buckets",
    "mutation_contexts",
  ])
    expect(results.map((x) => x.name)).toContain(name);
  expect(
    await q("SELECT mode FROM deployment_state WHERE id=1").first("mode"),
  ).toBe("CLOSED");
});
test("carrito cien líneas y cantidades, propietario exclusivo", async () => {
  await seedMinimal(env.DB);
  await q("INSERT INTO carts(id,user_id,updated_at) VALUES(1,1,'now')").run();
  await expect(
    q("INSERT INTO cart_items VALUES(1,1,100)").run(),
  ).rejects.toThrow();
  await q(
    "WITH RECURSIVE seq(x) AS(SELECT 2 UNION ALL SELECT x+1 FROM seq WHERE x<101) INSERT INTO products(id,category_id,sku,slug,name,description,base_price_cents) SELECT x,1,'sku-'||x,'p-'||x,'Producto','Prueba',100 FROM seq",
  ).run();
  await q(
    "INSERT INTO cart_items SELECT 1,id,1 FROM products WHERE id<=100",
  ).run();
  await expect(
    q("INSERT INTO cart_items VALUES(1,101,1)").run(),
  ).rejects.toThrow();
  await expect(
    q(
      "INSERT INTO carts(user_id,guest_session_id,updated_at) VALUES(NULL,NULL,'now')",
    ).run(),
  ).rejects.toThrow();
});
test("pedido, pagos y movimientos no admiten duplicados o importes erróneos", async () => {
  await seedOrder(env.DB);
  await expect(
    q(
      "INSERT INTO simulated_payments(order_id,outcome,amount_cents,currency,created_at) VALUES(1,'APPROVED',499,'PEN','now')",
    ).run(),
  ).rejects.toThrow();
  await q(
    "INSERT INTO simulated_payments(order_id,outcome,amount_cents,currency,created_at) VALUES(1,'APPROVED',500,'PEN','now')",
  ).run();
  await expect(
    q(
      "INSERT INTO simulated_payments(order_id,outcome,amount_cents,currency,created_at) VALUES(1,'APPROVED',500,'PEN','now')",
    ).run(),
  ).rejects.toThrow();
  await expect(
    q(
      "INSERT INTO order_items(order_id,product_id,sku_snapshot,name_snapshot,unit_price_cents,quantity,line_total_cents) VALUES(1,1,'A','B',500,2,999)",
    ).run(),
  ).rejects.toThrow();
  await q(
    "INSERT INTO inventory_movements(product_id,order_id,kind,delta,quantity_after,reason,created_at) VALUES(1,1,'SALE',-1,7,'Prueba','now')",
  ).run();
  await expect(
    q(
      "INSERT INTO inventory_movements(product_id,order_id,kind,delta,quantity_after,reason,created_at) VALUES(1,1,'SALE',-1,6,'Prueba','now')",
    ).run(),
  ).rejects.toThrow();
  await q(
    "INSERT INTO idempotency_records(user_id,operation,key,request_hash,response_status,response_json,created_at) VALUES(1,'test','same','hash',201,'{}','now')",
  ).run();
  await expect(
    q(
      "INSERT INTO idempotency_records(user_id,operation,key,request_hash,response_status,response_json,created_at) VALUES(1,'test','same','hash',201,'{}','now')",
    ).run(),
  ).rejects.toThrow();
});
