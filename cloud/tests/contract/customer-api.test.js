import { test, expect } from "vitest";
import { env } from "cloudflare:workers";
import { client } from "../fixtures/client.js";
import { seedMinimal } from "../fixtures/database.js";
import { address } from "../fixtures/commerce.js";
test("catálogo mantiene imágenes, precios, búsqueda y validaciones", async () => {
  await seedMinimal(env.DB);
  const c = client();
  const r = await c.request("GET", "/products?q=prueba");
  expect(r.status).toBe(200);
  expect(r.data[0]).toMatchObject({
    slug: "producto-prueba",
    effective_price_cents: 89900,
    currency: "PEN",
  });
  expect(r.data[0].images[0].path).toContain("/images/demo/");
  expect((await c.request("GET", "/products?unknown=1")).status).toBe(422);
  expect((await c.request("GET", "/products/producto-prueba")).data.name).toBe(
    "Producto de prueba",
  );
  expect((await c.request("GET", "/products?maxPriceCents=1")).data).toEqual(
    [],
  );
  expect((await c.request("GET", "/no-such-api")).status).toBe(404);
});
test("cliente conserva cuenta/direcciones y no puede acceder a admin o datos ajenos", async () => {
  await seedMinimal(env.DB);
  const c = client();
  const credentials = await c.register();
  expect((await c.request("GET", "/me")).data.role).toBe("CUSTOMER");
  const edited = await c.request("PATCH", "/me", {
    name: "Cliente editado",
    phone: "999000222",
  });
  expect(edited.data.name).toBe("Cliente editado");
  expect(JSON.stringify(edited.data)).not.toContain("password_hash");
  expect(
    (await c.request("POST", "/me/addresses", { ...address, street: "x" }))
      .status,
  ).toBe(422);
  let r = await c.request("POST", "/me/addresses", address);
  expect(r.status).toBe(201);
  const a = r.data;
  r = await c.request("PATCH", "/me/addresses/" + a.id, {
    ...address,
    street: "Calle actualizada 456",
    version: a.version,
  });
  expect(r.data.version).toBe(a.version + 1);
  expect((await c.request("GET", "/me/addresses")).data).toHaveLength(1);
  const other = client();
  await other.register();
  expect(
    (
      await other.request("PATCH", "/me/addresses/" + a.id, {
        ...address,
        version: r.data.version,
      })
    ).status,
  ).toBe(404);
  expect((await c.request("GET", "/admin/summary")).status).toBe(403);
  expect(
    (
      await c.request("DELETE", "/me/addresses/" + a.id, {
        version: r.data.version,
      })
    ).status,
  ).toBe(204);
  expect((await c.request("GET", "/me/addresses")).data).toEqual([]);
  await c.request("POST", "/auth/logout", {});
  expect((await c.request("GET", "/me")).status).toBe(401);
  await c.request("GET", "/auth/session");
  expect(
    (
      await c.request("POST", "/auth/login", {
        email: credentials.email,
        password: credentials.password,
      })
    ).data.user.name,
  ).toBe("Cliente editado");
});
