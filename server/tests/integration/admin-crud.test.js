import test from "node:test";
import assert from "node:assert/strict";
import { fixture } from "../helpers.js";
test("administración completa: catálogo, imágenes, promociones, clientes y límites", async () => {
  const f = await fixture();
  try {
    const c = f.client();
    await c.register();
    const admin = (await c.get("/me")).data;
    f.db
      .prepare(
        "UPDATE users SET role_id=(SELECT id FROM roles WHERE code='ADMIN') WHERE id=?",
      )
      .run(admin.id);
    let cat = (
      await c.post("/admin/categories", {
        name: "Categoría prueba",
        slug: "categoria-prueba",
        isActive: true,
      })
    ).data;
    const image = (await c.get("/admin/image-library")).data[0];
    assert.ok(image);
    let p = (
      await c.post("/admin/products", {
        categoryId: cat.id,
        sku: "TEST-001",
        slug: "producto-prueba",
        name: "Producto prueba",
        description: "Artículo genérico de demostración.",
        basePriceCents: 5000,
        isActive: true,
        isFeatured: false,
        initialStock: 5,
        images: [
          { path: image.path, alt: "Foto genérica de prueba", position: 0 },
        ],
      })
    ).data;
    assert.equal(p.available_quantity, 5);
    assert.equal(
      (
        await c.request("PATCH", "/admin/products/" + p.id, {
          version: p.version,
          basePriceCents: -1,
        })
      ).status,
      422,
    );
    p = (
      await c.request("PUT", "/admin/products/" + p.id + "/images", {
        version: p.version,
        images: [],
      })
    ).data;
    assert.equal(p.images.length, 0);
    assert.equal(
      (
        await c.request("PUT", "/admin/products/" + p.id + "/images", {
          version: p.version,
          images: [{ path: "../../secret", alt: "No", position: 0 }],
        })
      ).status,
      422,
    );
    const body = {
      productId: p.id,
      kind: "FINAL_PRICE",
      value: 4000,
      startsAt: "2026-01-01T00:00:00Z",
      endsAt: "2027-12-31T00:00:00Z",
      terms: "Oferta de demostración verificada",
      isActive: true,
    };
    let promo = await c.post("/admin/promotions", body);
    assert.equal(promo.status, 201);
    assert.equal((await c.post("/admin/promotions", body)).status, 409);
    assert.equal(
      (await c.get("/products/" + p.slug)).data.effective_price_cents,
      4000,
    );
    assert.equal(
      (
        await c.request("DELETE", "/admin/promotions/" + promo.data.id, {
          version: promo.data.version,
        })
      ).status,
      204,
    );
    assert.equal(
      (await c.get("/products/" + p.slug)).data.effective_price_cents,
      5000,
    );
    assert.equal(
      (
        await c.request("DELETE", "/admin/categories/" + cat.id, {
          version: cat.version,
        })
      ).status,
      204,
    );
    assert.equal((await c.get("/products/" + p.slug)).status, 404);
    const user = f.client();
    await user.register();
    const u = (await user.get("/me")).data;
    let edited = await c.request("PATCH", "/admin/customers/" + u.id, {
      version: u.version,
      name: "Cliente editado",
      phone: "999555777",
      isActive: false,
    });
    assert.equal(edited.status, 200);
    assert.equal((await user.get("/me")).status, 401);
    assert.ok(!(await c.get("/admin/customers/" + u.id)).data.password_hash);
  } finally {
    await f.cleanup();
  }
});
