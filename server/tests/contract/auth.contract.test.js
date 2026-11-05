import test from "node:test";
import assert from "node:assert/strict";
import { fixture } from "../helpers.js";
test("autenticación: CSRF, registro seguro, duplicado y logout", async () => {
  const f = await fixture();
  try {
    const c = f.client();
    assert.equal(Object.hasOwn((await c.get("/auth/session")).data, "capabilities"), false);
    assert.equal(
      (
        await c.post("/auth/register", {
          name: "Prueba",
          email: "a@example.test",
          password: "dummy-password",
          role: "ADMIN",
        })
      ).status,
      422,
    );
    const u = await c.register();
    assert.equal(u.status, 201);
    assert.equal(u.data.user.role, "CUSTOMER");
    assert.ok(!JSON.stringify(u).includes("password_hash"));
    assert.equal(
      (
        await c.post("/auth/register", {
          name: "Prueba",
          email: u.email,
          password: u.password,
        })
      ).status,
      409,
    );
    assert.equal((await c.post("/auth/logout", {})).status, 204);
    assert.equal((await c.get("/me")).status, 401);
    assert.equal(
      (await c.post("/auth/login", { email: u.email, password: u.password }))
        .status,
      200,
    );
    assert.equal(
      (await c.request("POST", "/auth/logout", {}, { "X-CSRF-Token": "wrong" }))
        .status,
      403,
    );
  } finally {
    await f.cleanup();
  }
});
