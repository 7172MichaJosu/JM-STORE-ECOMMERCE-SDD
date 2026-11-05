import { test, expect } from "vitest";
import { adminClient } from "../fixtures/admin.js";
import { client } from "../fixtures/client.js";

test("administration contract: protected routes and validation preserve public response shapes", async () => {
  const { c } = await adminClient(); const guest = client(); const customer = client(); await customer.register();
  for (const path of ["summary", "products", "categories", "image-library", "promotions", "inventory", "customers", "orders"]) {
    expect((await guest.request("GET", "/admin/" + path)).status).toBe(401);
    expect((await customer.request("GET", "/admin/" + path)).status).toBe(403);
    const response = await c.request("GET", "/admin/" + path);
    expect(response.status).toBe(200);
    expect(response).toHaveProperty("data");
  }
  expect((await c.request("POST", "/admin/categories", { name: "Category", slug: "category", isActive: true, injected: true })).status).toBe(422);
  expect((await c.request("POST", "/admin/products", { categoryId: 1, sku: "BOUND", slug: "bound", name: "Product", description: "Synthetic", basePriceCents: 100000001, isActive: true, isFeatured: false, initialStock: 1 })).status).toBe(422);
  expect((await c.request("POST", "/admin/inventory/1/adjustments", { expectedVersion: 1, newQuantity: 1000001, reason: "Out of bounds" })).status).toBe(422);
});
