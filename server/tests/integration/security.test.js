import test from "node:test";
import assert from "node:assert/strict";
import { fixture, customer } from "../helpers.js";

test("límite real devuelve 429 sin crear cuentas inválidas", async () => {
  const f = await fixture({ testing: false });
  try {
    const c = f.client();
    for (let i = 0; i < 5; i++) {
      const r = await c.post("/auth/register", { email: "limited@example.test", role: "ADMIN" });
      assert.equal(r.status, 422);
    }
    assert.equal((await c.post("/auth/register", { email: "limited@example.test", role: "ADMIN" })).status, 429);
    assert.equal(f.db.prepare("SELECT COUNT(*) n FROM users").get().n, 0);
  } finally { await f.cleanup(); }
});
test("origen, sesión expirada, validación de rol y direcciones", async () => {
  const f = await fixture();
  try {
    const { c, address } = await customer(f);
    assert.equal(
      (
        await c.request(
          "PATCH",
          "/me",
          { name: "Invasor" },
          { Origin: "https://attacker.example" },
        )
      ).status,
      403,
    );
    assert.equal(
      (await c.request("PATCH", "/me", { name: "Nombre", role: "ADMIN" }))
        .status,
      422,
    );
    assert.equal(
      (
        await c.post("/me/addresses", {
          recipient: "A",
          phone: "1",
          region: "L",
          province: "L",
          district: "L",
          street: "a",
        })
      ).status,
      422,
    );
    const id = (await c.get("/me")).data.id;
    f.db
      .prepare(
        "UPDATE sessions SET expires_at='2000-01-01T00:00:00.000Z' WHERE user_id=?",
      )
      .run(id);
    assert.equal((await c.get("/me")).status, 401);
  } finally {
    await f.cleanup();
  }
});
