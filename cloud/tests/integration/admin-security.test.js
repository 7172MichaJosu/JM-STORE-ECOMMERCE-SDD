import { test, expect } from "vitest";
import { env } from "cloudflare:workers";
import { adminClient } from "../fixtures/admin.js";
import { client } from "../fixtures/client.js";
import { connect } from "../../src/db/connection.js";
import { createSession } from "../../src/security/sessions.js";
import { changeSecurity } from "../../src/repositories/admin-security.js";

test("correo inmediato conserva sesiones y no cambia hash; duplicado revierte", async () => {
  const { c, credentials } = await adminClient();
  const before = await env.DB.prepare("SELECT * FROM users WHERE email=?").bind(credentials.email).first();
  const duplicate = await c.request("PATCH", "/admin/me/security", { currentPassword: credentials.password, version: 1, email: "synthetic@example.test" });
  expect(duplicate.status).toBe(409);
  expect(duplicate.error.code).toBe("EMAIL_UNAVAILABLE");
  const r = await c.request("PATCH", "/admin/me/security", { currentPassword: credentials.password, version: 1, email: "  NEW@example.test " });
  expect(r.data.requiresLogin).toBe(false);
  expect(r.data.user.email).toBe("new@example.test");
  const after = await env.DB.prepare("SELECT * FROM users WHERE id=?").bind(before.id).first();
  expect(after.password_hash).toBe(before.password_hash);
  expect(after.auth_version).toBe(before.auth_version);
  expect(after.version).toBe(2);
  expect((await c.request("GET", "/auth/session")).data.user.email).toBe("new@example.test");
  const login = client();
  await login.request("GET", "/auth/session");
  expect((await login.request("POST", "/auth/login", { email: credentials.email, password: credentials.password })).status).toBe(401);
  expect((await login.request("POST", "/auth/login", { email: "new@example.test", password: credentials.password })).status).toBe(200);
});

test("unicidad concurrente de correo mantiene cuenta y auditoría intactas", async () => {
  const { credentials } = await adminClient();
  const user = await env.DB.prepare("SELECT * FROM users WHERE email=?").bind(credentials.email).first();
  const session = await env.DB.prepare("SELECT * FROM sessions WHERE user_id=?").bind(user.id).first();
  const db = connect(env.DB), originalBatch = db.batch;
  db.batch = async statements => {
    await env.DB.prepare("UPDATE users SET email='race@example.test' WHERE id=1").run();
    return originalBatch(statements);
  };
  await expect(changeSecurity({ db, user, session, config: { namespace: env.SESSION_NAMESPACE }, requestId: crypto.randomUUID(), body: { version: 1, currentPassword: credentials.password, email: "race@example.test" } })).rejects.toMatchObject({ status: 409, code: "EMAIL_UNAVAILABLE" });
  expect(await env.DB.prepare("SELECT email FROM users WHERE id=?").bind(user.id).first("email")).toBe(credentials.email);
  expect(await env.DB.prepare("SELECT count(*) n FROM security_events").first("n")).toBe(0);
});

test("dos cambios de password con la misma versión confirman exactamente uno", async () => {
  const { credentials } = await adminClient();
  const user = await env.DB.prepare("SELECT * FROM users WHERE email=?").bind(credentials.email).first();
  const session = await env.DB.prepare("SELECT * FROM sessions WHERE user_id=?").bind(user.id).first();
  const outcomes = await Promise.allSettled(Array.from({ length: 2 }, () => {
    const next = crypto.randomUUID();
    return changeSecurity({ db: connect(env.DB), user, session, config: { namespace: env.SESSION_NAMESPACE }, requestId: crypto.randomUUID(), body: { version: 1, currentPassword: credentials.password, newPassword: next, confirmNewPassword: next } });
  }));
  expect(outcomes.filter(r => r.status === "fulfilled")).toHaveLength(1);
  const rejected = outcomes.find(r => r.status === "rejected");
  expect(rejected.reason).toMatchObject({ status: 409, code: "ACCOUNT_CHANGED" });
  expect(await env.DB.prepare("SELECT auth_version FROM users WHERE id=?").bind(user.id).first("auth_version")).toBe(1);
  expect(await env.DB.prepare("SELECT count(*) n FROM security_events").first("n")).toBe(1);
});

test.each([false, true])("password cambia atómicamente, revoca todas las sesiones (correo=%s)", async (changeEmail) => {
  const { c, credentials } = await adminClient();
  const second = client();
  await second.request("GET", "/auth/session");
  await second.request("POST", "/auth/login", { email: credentials.email, password: credentials.password });
  const old = await env.DB.prepare("SELECT * FROM users WHERE email=?").bind(credentials.email).first();
  const password = crypto.randomUUID();
  const r = await c.request("PATCH", "/admin/me/security", { currentPassword: credentials.password, version: 1, newPassword: password, confirmNewPassword: password, ...(changeEmail ? { email: "final@example.test" } : {}) });
  expect(r.status).toBe(200);
  expect(r.data).toEqual({ user: null, requiresLogin: true });
  expect(r.headers.get("set-cookie")).toContain("Expires=Thu, 01 Jan 1970");
  expect((await second.request("GET", "/auth/session")).data.user).toBeNull();
  expect(await env.DB.prepare("SELECT count(*) n FROM sessions WHERE user_id=?").bind(old.id).first("n")).toBe(0);
  const email = changeEmail ? "final@example.test" : credentials.email;
  await c.request("GET", "/auth/session");
  expect((await c.request("POST", "/auth/login", { email, password: credentials.password })).status).toBe(401);
  expect((await c.request("POST", "/auth/login", { email, password })).status).toBe(200);
  // A login that finished verifying the old hash cannot create a session after the change.
  await expect(createSession({ db: connect(env.DB), config: { namespace: "test", origin: "http://localhost" } }, { cookie() {} }, old.id, old)).rejects.toThrow();
  const audit = await env.DB.prepare("SELECT * FROM security_events").first();
  expect(audit.changed_password).toBe(1);
  expect(JSON.stringify(audit)).not.toContain(password);
  expect(JSON.stringify(audit)).not.toContain(credentials.email);
});

test("fallo de auditoría revierte email, password, versión y sesiones", async () => {
  const { c, credentials } = await adminClient();
  const old = await env.DB.prepare("SELECT * FROM users WHERE email=?").bind(credentials.email).first();
  const password = crypto.randomUUID();
  await env.DB.exec("CREATE TRIGGER reject_security_event BEFORE INSERT ON security_events BEGIN SELECT RAISE(ABORT,'AUDIT_FAILURE'); END;");
  try {
    const r = await c.request("PATCH", "/admin/me/security", { currentPassword: credentials.password, version: 1, email: "rollback@example.test", newPassword: password, confirmNewPassword: password });
    expect(r.status).toBe(503);
    expect(await env.DB.prepare("SELECT * FROM users WHERE id=?").bind(old.id).first()).toEqual(old);
    expect((await c.request("GET", "/auth/session")).data.user.id).toBe(old.id);
    expect(await env.DB.prepare("SELECT count(*) n FROM security_events").first("n")).toBe(0);
  } finally { await env.DB.exec("DROP TRIGGER reject_security_event;"); }
});

test.each(["version", "session", "active"])("CAS rechaza cambio concurrente: %s", async (race) => {
  const { credentials } = await adminClient();
  const user = await env.DB.prepare("SELECT * FROM users WHERE email=?").bind(credentials.email).first();
  const session = await env.DB.prepare("SELECT * FROM sessions WHERE user_id=?").bind(user.id).first();
  const db = connect(env.DB), originalBatch = db.batch;
  db.batch = async statements => {
    if (race === "session") await env.DB.prepare("DELETE FROM sessions WHERE user_id=?").bind(user.id).run();
    if (race === "version") await env.DB.prepare("UPDATE users SET version=version+1 WHERE id=?").bind(user.id).run();
    if (race === "active") await env.DB.prepare("UPDATE users SET is_active=0 WHERE id=?").bind(user.id).run();
    return originalBatch(statements);
  };
  await expect(changeSecurity({ db, user, session, config: { namespace: env.SESSION_NAMESPACE }, requestId: crypto.randomUUID(), body: { version: 1, currentPassword: credentials.password, email: "race@example.test" } })).rejects.toMatchObject({ status: 409, code: "ACCOUNT_CHANGED" });
  expect(await env.DB.prepare("SELECT email FROM users WHERE id=?").bind(user.id).first("email")).toBe(credentials.email);
  expect(await env.DB.prepare("SELECT count(*) n FROM security_events").first("n")).toBe(0);
});
