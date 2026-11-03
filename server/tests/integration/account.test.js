import test from "node:test";
import assert from "node:assert/strict";
import { fixture, customer } from "../helpers.js";
test("titularidad, direcciones, roles y revocación", async () => {
  const f = await fixture();
  try {
    const { c, address } = await customer(f);
    const other = f.client();
    await other.register();
    assert.equal(
      (
        await other.request("PATCH", "/me/addresses/" + address.id, {
          recipient: "Intruso",
          version: address.version,
        })
      ).status,
      404,
    );
    assert.equal((await c.get("/admin/summary")).status, 403);
    const me = (await c.get("/me")).data;
    f.db.prepare("UPDATE users SET is_active=0 WHERE id=?").run(me.id);
    assert.equal((await c.get("/me")).status, 401);
  } finally {
    await f.cleanup();
  }
});
