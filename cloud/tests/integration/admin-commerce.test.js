import { test, expect } from "vitest";
import { env } from "cloudflare:workers";
import { adminClient } from "../fixtures/admin.js";
import { client } from "../fixtures/client.js";

test("admin cloud: catalog, images, prices and inventory are persistent and version guarded", async () => {
  const { c } = await adminClient();
  expect((await c.request("GET", "/admin/summary")).status).toBe(200);
  const category = await c.request("POST", "/admin/categories", { name: "Categoria synthetic", slug: "categoria-synthetic", isActive: true });
  expect(category.status).toBe(201);
  const library = (await c.request("GET", "/admin/image-library")).data;
  expect(library.length).toBeGreaterThan(0);
  const created = await c.request("POST", "/admin/products", { categoryId: category.data.id, sku: "JM-SYNTHETIC", slug: "jm-synthetic", name: "Producto synthetic", description: "Datos sinteticos", basePriceCents: 12000, isActive: true, isFeatured: false, initialStock: 7, images: [{ ...library[0], position: 0 }] });
  expect(created.status).toBe(201);
  const p = created.data;
  expect(p.quantity).toBe(7);
  expect((await c.request("PATCH", `/admin/products/${p.id}`, { version: p.version, basePriceCents: 13000 })).status).toBe(200);
  expect((await c.request("PATCH", `/admin/products/${p.id}`, { version: p.version, basePriceCents: 999 })).status).toBe(409);
  const edits = await Promise.all([c.request("PATCH", `/admin/products/${p.id}`, { version: 2, basePriceCents: 14000 }), c.request("PATCH", `/admin/products/${p.id}`, { version: 2, basePriceCents: 15000 })]);
  expect(edits.map(response => response.status).sort()).toEqual([200, 409]);
  const result = await Promise.all([c.request("POST", `/admin/inventory/${p.id}/adjustments`, { expectedVersion: 1, newQuantity: 10, reason: "Synthetic adjustment" }), c.request("POST", `/admin/inventory/${p.id}/adjustments`, { expectedVersion: 1, newQuantity: 11, reason: "Concurrent adjustment" })]);
  expect(result.map(r => r.status).sort()).toEqual([201, 409]);
  expect((await c.request("GET", `/admin/inventory/${p.id}/movements`)).data).toHaveLength(2);
  expect([14000, 15000]).toContain((await c.request("GET", "/products/jm-synthetic")).data.base_price_cents);
});

test("admin cloud: promotion overlap, images and customer privileges are enforced", async () => {
  const { c } = await adminClient();
  const body = { productId: 1, kind: "FINAL_PRICE", value: 80000, startsAt: "2026-01-01T00:00:00Z", endsAt: "2099-01-01T00:00:00Z", terms: "Synthetic configured terms", isActive: true };
  expect((await c.request("POST", "/admin/promotions", body)).status).toBe(201);
  expect((await c.request("POST", "/admin/promotions", body)).status).toBe(409);
  expect((await c.request("PATCH", "/admin/products/1", { version: 1, basePriceCents: 70000 })).status).toBe(422);
  expect((await c.request("PUT", "/admin/products/1/images", { version: 1, images: [{ path: "https://untrusted.invalid/image.png", alt: "invalid", position: 0 }] })).status).toBe(422);
  const customer = client(); await customer.register();
  const user = (await customer.request("GET", "/auth/session")).data.user;
  expect((await customer.request("GET", "/admin/summary")).status).toBe(403);
  expect((await c.request("PATCH", `/admin/customers/${user.id}`, { version: user.version, role: "ADMIN" })).status).toBe(422);
  expect((await c.request("PATCH", `/admin/customers/${user.id}`, { version: user.version, isActive: false })).status).toBe(200);
  expect((await customer.request("GET", "/me")).status).toBe(401);
  expect(JSON.stringify((await c.request("GET", "/admin/customers")).data)).not.toMatch(/password_hash|firebase_id_token|refresh_token/);
});

test("admin cloud: order transitions and history use an atomic version guard", async () => {
  const { c } = await adminClient();
  const customer = client(); const { quote } = await customer.prepare();
  const paid = await customer.request("POST", "/orders", { quoteToken: quote.quoteToken, simulationOutcome: "APPROVED" }, crypto.randomUUID());
  const o = paid.data;
  const status = await c.request("PATCH", `/admin/orders/${o.publicId}/status`, { expectedVersion: o.version, status: "PREPARING" });
  expect(status.status).toBe(200);
  expect(status.data.history.at(-1).toStatus).toBe("PREPARING");
  expect((await c.request("PATCH", `/admin/orders/${o.publicId}/status`, { expectedVersion: o.version, status: "SHIPPED" })).status).toBe(409);
  expect((await c.request("PATCH", `/admin/orders/${o.publicId}/status`, { expectedVersion: status.data.version, status: "DELIVERED" })).status).toBe(409);
  expect((await env.DB.prepare("SELECT COUNT(*) n FROM order_status_history WHERE order_id=(SELECT id FROM orders WHERE public_id=?)").bind(o.publicId).first()).n).toBeGreaterThan(0);
});

test("admin cloud: a batch failure rolls back product, inventory and audit movement together", async () => {
  const { c } = await adminClient();
  await env.DB.prepare("CREATE TRIGGER synthetic_inventory_failure BEFORE INSERT ON product_images WHEN NEW.product_id>1 BEGIN SELECT RAISE(ABORT,'synthetic batch failure'); END").run();
  try {
    const image = (await c.request("GET", "/admin/image-library")).data[0];
    const result = await c.request("POST", "/admin/products", { categoryId: 1, sku: "ROLLBACK", slug: "rollback", name: "Rollback product", description: "Synthetic rollback", basePriceCents: 1200, isActive: true, isFeatured: false, initialStock: 3, images: [{ ...image, position: 0 }] });
    expect(result.status).toBeGreaterThanOrEqual(500);
    expect((await env.DB.prepare("SELECT COUNT(*) n FROM products WHERE sku='ROLLBACK'").first()).n).toBe(0);
    expect((await env.DB.prepare("SELECT COUNT(*) n FROM mutation_contexts").first()).n).toBe(0);
    expect((await env.DB.prepare("SELECT COUNT(*) n FROM inventory WHERE product_id>1").first()).n).toBe(0);
    expect((await env.DB.prepare("SELECT COUNT(*) n FROM inventory_movements WHERE product_id>1").first()).n).toBe(0);
  } finally { await env.DB.prepare("DROP TRIGGER synthetic_inventory_failure").run(); }
});
