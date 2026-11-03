import test from "node:test";
import assert from "node:assert/strict";
import { fixture } from "../helpers.js";
test("catálogo oculta inactivos, seed no pisa stock y promoción vence", async () => {
  const f = await fixture();
  try {
    const c = f.client();
    const p = (await c.get("/products")).data[0];
    f.db
      .prepare("UPDATE inventory SET quantity=3 WHERE product_id=?")
      .run(p.id);
    f.db.prepare("UPDATE products SET is_active=0 WHERE id=?").run(p.id);
    assert.equal((await c.get("/products/" + p.slug)).status, 404);
    f.db.prepare("UPDATE categories SET is_active=0 WHERE id=1").run();
    assert.ok(
      (await c.get("/products?pageSize=100")).data.every(
        (p) => p.category.id !== 1,
      ),
    );
  } finally {
    await f.cleanup();
  }
});
