import { expect, test } from "vitest";
import { Router, responseContext } from "../../src/http/router.js";

const req = path => ({ path, method: "GET", params: {} });
test("native middleware waits async next, restores mounted paths and isolates prefixes", async () => {
  const outer = Router(), inner = Router(), calls = [];
  inner.use(async (_req, _res, next) => { await Promise.resolve(); next(); });
  inner.get("/items/:id", async (request, response) => { await Promise.resolve(); response.json({ id: request.params.id, path: request.path }); });
  outer.use("/admin", inner);
  outer.use((request, response) => { calls.push(request.path); response.status(404).end(); });
  const response = responseContext(); await outer(req("/admin/items/a%20b"), response);
  expect(await response.finish().json()).toEqual({ id: "a b", path: "/items/a%20b" });
  const missing = responseContext(); await outer(req("/administrator/items/1"), missing);
  expect(missing.finish().status).toBe(404); expect(calls).toEqual(["/administrator/items/1"]);
});
test("native middleware propagates downstream asynchronous failures", async () => {
  const router = Router(); router.use((_req, _res, next) => { next(); });
  router.get("/fail", async () => { await Promise.resolve(); throw Error("expected failure"); });
  await expect(router(req("/fail"), responseContext())).rejects.toThrow("expected failure");
});
test("native cookies preserve rotation, secure attributes, clearing and HEAD", async () => {
  const response = responseContext();
  response.cookie("__Host-jm-sdd.sid", "safe-token", { path: "/", httpOnly: true, secure: true, sameSite: "lax", maxAge: 3600000 });
  response.clearCookie("__Host-old", { path: "/", httpOnly: true, secure: true, sameSite: "lax" });
  response.json({ ok: true });
  const result = response.finish("HEAD");
  expect(await result.text()).toBe("");
  expect(result.headers.getSetCookie()).toHaveLength(2);
  expect(result.headers.getSetCookie()[0]).toMatch(/Max-Age=3600/);
  expect(result.headers.getSetCookie()[0]).toMatch(/HttpOnly; Secure; SameSite=Lax/);
  expect(result.headers.getSetCookie()[1]).toMatch(/Max-Age=0/);
});
