import { readFile, writeFile } from "node:fs/promises";
import { randomUUID, randomBytes } from "node:crypto";
import { checkTarget } from "./targets.js";
const target = await checkTarget(["--target", "staging"]);
const release = JSON.parse(await readFile(new URL("../private/staging-current-session.json", import.meta.url), "utf8"));
if (release.resourceGate?.blocked) throw Error("R-AUTH blocked: staging tests stopped pending operator decision.");
const results = [];
function client() {
  let cookie = "", csrf = "";
  return { async request(label, method, path, body, expected) {
    const started = Date.now();
    const response = await fetch(target.origin + "/api" + path, { method, headers: { origin: target.origin, cookie, "content-type": "application/json", "x-csrf-token": csrf }, ...(body ? { body: JSON.stringify(body) } : {}) });
    const next = response.headers.getSetCookie().find(value => value.startsWith("__Host-jm-sdd.sid="));
    if (next) cookie = next.split(";")[0];
    const text = await response.text();
    if (/1102|exceeded resource limits/i.test(text)) throw Error("FREE_RESOURCE_LIMIT_EXCEEDED");
    const json = text ? JSON.parse(text) : null;
    if (json?.data?.csrfToken) csrf = json.data.csrfToken;
    results.push({ label, status: response.status, expected, wallMs: Date.now() - started, passed: response.status === expected });
    if (response.status !== expected) throw Error(`${label}:${response.status}:${json?.error?.code || "FAILED"}`);
    return json?.data;
  } };
}
try {
  const c = client();
  const session = await c.request("firebase-session", "GET", "/auth/session", null, 200);
  if (!session.capabilities?.emailVerification) throw Error("FIREBASE_VERSION_NOT_ACTIVE");
  const customer = { name: "Synthetic staging customer", email: `jm-sdd-customer-${randomUUID()}@example.test`, password: "T!" + randomBytes(24).toString("base64url") + "a8" };
  await writeFile(new URL("../private/staging-smoke-customer.json", import.meta.url), JSON.stringify(customer), { mode: 0o600 });
  const registered = await c.request("customer-register", "POST", "/auth/register", customer, 201);
  if (registered.user?.role !== "CUSTOMER") throw Error("CUSTOMER_ROLE_MISMATCH");
  await c.request("firebase-private-session", "GET", "/me", null, 200);
  await c.request("logout", "POST", "/auth/logout", {}, 204);
  await c.request("guest-session", "GET", "/auth/session", null, 200);
  await c.request("wrong-password", "POST", "/auth/login", { email: customer.email, password: "T!" + randomUUID() + "a8" }, 401);
  await c.request("customer-login", "POST", "/auth/login", { email: customer.email, password: customer.password }, 200);
  const admin = JSON.parse(await readFile(new URL("../private/staging-synthetic-admin.json", import.meta.url), "utf8"));
  const a = client(); await a.request("admin-guest-session", "GET", "/auth/session", null, 200);
  const login = await a.request("admin-login", "POST", "/auth/login", { email: admin.email, password: admin.password }, 200);
  if (login.user?.role !== "ADMIN") throw Error("ADMIN_ROLE_MISMATCH");
  await a.request("admin-security", "GET", "/admin/me/security", null, 200);
  await a.request("admin-summary", "GET", "/admin/summary", null, 200);
  await writeFile(new URL("../private/staging-smoke-results.json", import.meta.url), JSON.stringify({ results, passed: true, finishedAt: new Date().toISOString() }), { mode: 0o600 });
  console.log(JSON.stringify({ passed: true, checks: results, cpuNotWallTime: true, syntheticOnly: true, credentialsPrinted: false }, null, 2));
} catch (error) {
  await writeFile(new URL("../private/staging-smoke-results.json", import.meta.url), JSON.stringify({ results, passed: false, error: error.message, finishedAt: new Date().toISOString() }), { mode: 0o600 });
  console.error(JSON.stringify({ passed: false, results, reason: error.message, credentialsPrinted: false })); process.exitCode = 1;
}
