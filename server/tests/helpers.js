import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, relative, isAbsolute, resolve } from "node:path";
import { randomUUID } from "node:crypto";
import { createApp } from "../src/app.js";
import { seed } from "../src/modules/catalog/seed-data.js";
export async function fixture(options = {}) {
  if (options.databasePath) {
    const rel = relative(tmpdir(), resolve(options.databasePath));
    if (rel.startsWith("..") || isAbsolute(rel)) throw Error("Las pruebas solo admiten DB temporal.");
  }
  const dir = mkdtempSync(join(tmpdir(), "jm-test-"));
  const ctx = createApp({
    databasePath: join(dir, "test.sqlite"),
    quoteSecret: randomUUID(),
    origin: "http://localhost:5173",
    testing: true,
    ...options,
  });
  seed(ctx.db);
  ctx.finish();
  const server = ctx.app.listen(0, "127.0.0.1");
  await new Promise((r) => server.once("listening", r));
  const base = `http://127.0.0.1:${server.address().port}/api`;
  return {
    ...ctx,
    client() {
      let cookie = "",
        csrf = "";
      return {
        async request(method, url, body, headers = {}) {
          if (!cookie && url != "/auth/session")
            await this.request("GET", "/auth/session");
          const res = await fetch(base + url, {
            method,
            headers: {
              Origin: "http://localhost:5173",
              Cookie: cookie,
              "Content-Type": "application/json",
              "X-CSRF-Token": csrf,
              ...headers,
            },
            body: body === undefined ? undefined : JSON.stringify(body),
          });
          if (res.headers.get("set-cookie"))
            cookie = res.headers.get("set-cookie").split(";")[0];
          if (cookie === "jm.sid=") cookie = "";
          const json = res.status === 204 ? {} : await res.json();
          if (json.data?.csrfToken) csrf = json.data.csrfToken;
          return { status: res.status, ...json };
        },
        get(url) {
          return this.request("GET", url);
        },
        post(url, body, headers) {
          return this.request("POST", url, body, headers);
        },
        async register() {
          const password = randomUUID();
          const email = `${randomUUID()}@example.test`;
          const result = await this.post("/auth/register", {
            name: "Cliente prueba",
            email,
            password,
          });
          return { email, password, ...result };
        },
      };
    },
    async stop() {
      if (server.listening) await new Promise((r) => server.close(r));
      if (ctx.db.isOpen) ctx.close();
    },
    async cleanup() {
      if (server.listening) await new Promise((r) => server.close(r));
      if (ctx.db.isOpen) ctx.close();
      rmSync(dir, { recursive: true });
    },
  };
}
export async function customer(f) {
  const c = f.client();
  const credentials = await c.register();
  const a = await c.post("/me/addresses", {
    recipient: "Cliente prueba",
    phone: "999111222",
    region: "Lima",
    province: "Lima",
    district: "Miraflores",
    street: "Avenida Demo 123",
  });
  return { c, address: a.data, credentials };
}
export async function cartQuote(f, c, address, quantity = 1) {
  const p = (await c.get("/products")).data.find(
    (p) => p.available_quantity >= quantity,
  );
  let cart = (await c.get("/cart")).data;
  cart = (
    await c.request("PUT", `/cart/items/${p.id}`, {
      quantity,
      cartVersion: cart.version,
    })
  ).data;
  const quote = (
    await c.post("/checkout/quote", {
      addressId: address.id,
      cartVersion: cart.version,
    })
  ).data;
  return { p, cart, quote };
}
