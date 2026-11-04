import { test, expect } from "vitest";
import { env } from "cloudflare:workers";
import { SELF } from "cloudflare:test";
import { client } from "../fixtures/client.js";
import { seedMinimal } from "../fixtures/database.js";
import { connect } from "../../src/db/connection.js";
import { cleanupExpired } from "../../src/security/sessions.js";
import { cookieName, cookieOptions } from "../../src/security/sessions.js";
import { createHash } from "node:crypto";

test("cookie privada y token hasheado, sin reutilizar la cookie local original", async () => {
  await seedMinimal(env.DB);
  const c = client();
  const bootstrap = await c.request("GET", "/auth/session");
  const cookie = bootstrap.headers.get("set-cookie");
  expect(cookie).toContain("HttpOnly");
  expect(cookie).toContain("SameSite=Lax");
  const raw = cookie.split(";")[0].split("=")[1];
  const stored = await env.DB.prepare("SELECT token_hash FROM sessions").first("token_hash");
  expect(stored).not.toBe(raw);
  expect(stored).toBe(createHash("sha256").update(raw).digest("hex"));
  const https = { origin: "https://new-shop.example" };
  expect(cookieName(https)).toBe("__Host-jm-sdd.sid");
  expect(cookieOptions(https)).toMatchObject({ secure: true, httpOnly: true, sameSite: "lax", path: "/" });
});
test("Origin/CSRF, rol, namespace y expiración se protegen en servidor", async () => {
  await seedMinimal(env.DB);
  const c = client();
  const credentials = await c.register();
  let r = await SELF.fetch(env.APP_ORIGIN + "/api/auth/login", {
    method: "POST",
    headers: {
      "content-type": "application/json",
      origin: "https://attacker.example",
    },
    body: JSON.stringify(credentials),
  });
  expect(r.status).toBe(403);
  expect(
    (
      await c.request("POST", "/auth/register", {
        ...credentials,
        role: "ADMIN",
      })
    ).status,
  ).toBe(422);
  await env.DB.prepare(
    "UPDATE sessions SET namespace='imported-source' WHERE user_id IS NOT NULL",
  ).run();
  expect((await c.request("GET", "/me")).status).toBe(401);
  await c.request("GET", "/auth/session");
  expect(
    (
      await c.request("POST", "/auth/login", {
        email: credentials.email,
        password: credentials.password,
      })
    ).status,
  ).toBe(200);
  await env.DB.prepare(
    "UPDATE sessions SET expires_at='2000-01-01T00:00:00Z' WHERE user_id IS NOT NULL",
  ).run();
  expect((await c.request("GET", "/me")).status).toBe(401);
});
test("rate limit persiste y no guarda correo/IP en claro; errores no exponen SQL", async () => {
  await seedMinimal(env.DB);
  const c = client();
  await c.request("GET", "/auth/session");
  let last;
  for (let i = 0; i < 11; i++)
    last = await c.request("POST", "/auth/login", {
      email: "limit@example.test",
      password: "x",
    });
  expect(last.status).toBe(429);
  expect(last.headers.get("retry-after")).toBeTruthy();
  const buckets = await env.DB.prepare(
    "SELECT bucket_key FROM rate_limit_buckets",
  ).all();
  for (const b of buckets.results)
    expect(b.bucket_key).toMatch(/^[a-f0-9]{64}$/);
  const unavailable = await SELF.fetch(
    "https://unconfigured.example/api/health",
  );
  expect(unavailable.status).toBe(503);
  expect(await unavailable.text()).not.toContain("database");
});
test("cleanup de24h elimina carrito invitado expirado por cascada y CLOSED rechaza negocio", async () => {
  await seedMinimal(env.DB);
  await env.DB.batch([
    env.DB.prepare(
      "INSERT INTO sessions(id,token_hash,csrf_token,namespace,created_at,last_seen_at,expires_at) VALUES(99,'unusable','unusable','old','2000','2000','2000')",
    ),
    env.DB.prepare(
      "INSERT INTO carts(guest_session_id,updated_at) VALUES(99,'2000')",
    ),
  ]);
  await cleanupExpired(connect(env.DB));
  expect(await env.DB.prepare("SELECT count(*) n FROM carts").first("n")).toBe(
    0,
  );
  await env.DB.prepare(
    "UPDATE deployment_state SET mode='CLOSED' WHERE id=1",
  ).run();
  const c = client();
  expect((await c.request("GET", "/products")).status).toBe(503);
  expect((await c.request("GET", "/health")).status).toBe(200);
});
