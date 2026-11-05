import { test, expect } from "vitest";
import { client } from "../fixtures/client.js";
import { adminClient } from "../fixtures/admin.js";
import { SELF } from "cloudflare:test";
import { env } from "cloudflare:workers";

test("seguridad admin: permisos, capacidad y lectura sin secretos", async () => {
  const { c } = await adminClient();
  const guest = client();
  expect((await guest.request("GET", "/admin/me/security")).status).toBe(401);
  await guest.register();
  expect((await guest.request("GET", "/admin/me/security")).status).toBe(403);
  expect((await c.request("GET", "/auth/session")).data.capabilities.adminSecurity).toBe(true);
  const r = await c.request("GET", "/admin/me/security");
  expect(r.status).toBe(200);
  expect(Object.keys(r.data).sort()).toEqual(["email", "id", "version"]);
});

test("seguridad admin: CSRF y expiración bloquean cambios; rate limit devuelve429", async () => {
  const { c } = await adminClient();
  const session = await c.request("GET", "/auth/session");
  const denied = await SELF.fetch(env.APP_ORIGIN + "/api/admin/me/security", { method: "PATCH", headers: { origin: env.APP_ORIGIN, "content-type": "application/json" }, body: "{}" });
  expect(denied.status).toBe(403);
  for (let i = 0; i < 20; i++) expect((await c.request("PATCH", "/admin/me/security", {})).status).toBe(422);
  expect((await c.request("PATCH", "/admin/me/security", {})).status).toBe(429);
  await env.DB.prepare("UPDATE sessions SET expires_at='2000-01-01T00:00:00Z' WHERE user_id=?").bind(session.data.user.id).run();
  expect((await c.request("GET", "/admin/me/security")).status).toBe(401);
});

test("seguridad admin: contrato de validación, contraseña actual y versión", async () => {
  const { c, credentials } = await adminClient();
  const base = { currentPassword: credentials.password, version: 1, email: "new@example.test" };
  for (const invalid of [
    { ...base, role: "ADMIN" }, { ...base, currentPassword: "short" },
    { ...base, version: 0 }, { ...base, email: "invalid" },
    { ...base, email: "a".repeat(255) },
    { ...base, newPassword: "short", confirmNewPassword: "short" },
    { ...base, newPassword: "x".repeat(129), confirmNewPassword: "x".repeat(129) },
    { ...base, newPassword: crypto.randomUUID(), confirmNewPassword: "different" },
    { currentPassword: credentials.password, version: 1 },
  ]) expect((await c.request("PATCH", "/admin/me/security", invalid)).status).toBe(422);
  expect((await c.request("PATCH", "/admin/me/security", { ...base, currentPassword: crypto.randomUUID() })).error.code).toBe("CURRENT_PASSWORD_INVALID");
  const stale = await c.request("PATCH", "/admin/me/security", { ...base, version: 2 });
  expect(stale.status).toBe(409);
  expect(stale.error.code).toBe("ACCOUNT_CHANGED");
});
