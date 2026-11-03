import test from "node:test";
import assert from "node:assert/strict";
import { fixture } from "../helpers.js";
test("admin deniega visitante/cliente y permite rol provisionado", async () => {
  const f = await fixture();
  try {
    const c = f.client();
    assert.equal((await c.get("/admin/products")).status, 401);
    await c.register();
    assert.equal((await c.get("/admin/products")).status, 403);
    const id = (await c.get("/me")).data.id;
    f.db
      .prepare(
        "UPDATE users SET role_id=(SELECT id FROM roles WHERE code='ADMIN') WHERE id=?",
      )
      .run(id);
    assert.equal((await c.get("/admin/products")).status, 200);
    assert.equal((await c.get("/admin/image-library")).status, 200);
  } finally {
    await f.cleanup();
  }
});
