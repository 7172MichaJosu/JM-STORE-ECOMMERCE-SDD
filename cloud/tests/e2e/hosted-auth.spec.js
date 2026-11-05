import { test, expect } from "@playwright/test";
import { randomUUID } from "node:crypto";

test("staging alojado: registro y login Firebase con cookies seguras", async ({
  page,
  context,
}) => {
  const email = `${randomUUID()}@example.test`;
  const password = "T!" + randomUUID() + "Aa8";
  const timings = {};

  await page.goto("/registro");
  await page.getByLabel("Nombre completo").fill("Cliente sintético de staging");
  await page.getByLabel("Correo electrónico").fill(email);
  await page.getByLabel("Contraseña", { exact: true }).fill(password);
  let started = Date.now();
  const registerResponse = page.waitForResponse(
    (r) => new URL(r.url()).pathname === "/api/auth/register",
  );
  await page.getByRole("button", { name: "Crear mi cuenta" }).click();
  const registerResult = await registerResponse;
  timings.registerWallMs = Date.now() - started;
  expect(registerResult.status()).toBe(201);
  await expect(page).toHaveURL(/cuenta/);

  const sessionCookie = (await context.cookies()).find((c) =>
    c.name.startsWith("__Host-jm-sdd.sid"),
  );
  expect(sessionCookie?.httpOnly).toBe(true);
  expect(sessionCookie?.secure).toBe(true);
  await page.getByRole("button", { name: "Cerrar sesión" }).click();
  await expect(page).toHaveURL(/ingresar/);

  await page.getByLabel("Correo electrónico").fill(email);
  await page.getByLabel("Contraseña", { exact: true }).fill(password);
  started = Date.now();
  const loginResponse = page.waitForResponse(
    (r) => new URL(r.url()).pathname === "/api/auth/login",
  );
  await page.getByRole("button", { name: "Ingresar a mi cuenta" }).click();
  const loginResult = await loginResponse;
  timings.loginWallMs = Date.now() - started;
  expect(loginResult.status()).toBe(200);
  await expect(page).toHaveURL(/cuenta/);

  // Only aggregate timings are logged; synthetic identifiers are never emitted.
  console.log(`R-AUTH staging wall time: ${JSON.stringify(timings)}`);
});
