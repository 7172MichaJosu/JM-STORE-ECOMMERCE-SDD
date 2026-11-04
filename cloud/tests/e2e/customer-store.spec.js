import { test, expect } from "@playwright/test";
import { register, address } from "../../../tests/e2e/fixtures/helpers.js";
test("Workers: assets, deep links y API404 mantienen diseño en desktop y móvil", async ({
  page,
  request,
}) => {
  for (const width of [1280, 360]) {
    await page.setViewportSize({ width, height: 900 });
    await page.goto("/catalogo");
    await expect(page.locator(".product-card").first()).toBeVisible();
    expect(
      await page.evaluate(
        () => document.documentElement.scrollWidth <= innerWidth,
      ),
    ).toBeTruthy();
  }
  const image = await request.get("/images/demo/monitor-jm.png");
  expect(image.status()).toBe(200);
  expect(image.headers()["content-type"]).toContain("image/");
  expect(image.headers()["content-security-policy"]).toContain(
    "default-src 'self'",
  );
  const missing = await request.get("/api/not-present");
  expect(missing.status()).toBe(404);
  expect(missing.headers()["content-type"]).toContain("application/json");
  const deep = await request.get("/cuenta/pedidos");
  expect(deep.status()).toBe(200);
  expect(deep.headers()["content-type"]).toContain("text/html");
});
test("Workers/D1: compra rechazada, reintento aprobado y persistencia sin Node local", async ({
  page,
}) => {
  await register(page);
  await address(page);
  await page.goto("/catalogo");
  await page
    .getByRole("button", { name: "Agregar", exact: true })
    .first()
    .click();
  await expect(page.getByText("Producto agregado a tu carrito")).toBeVisible();
  await page.goto("/carrito");
  await page.getByRole("link", { name: "Continuar compra" }).click();
  await page.getByRole("button", { name: "Revisar mi pedido" }).click();
  await page.getByLabel("Rechazar pago simulado").check();
  await page.getByRole("button", { name: "Confirmar simulación" }).click();
  await expect(
    page.getByText("Pago simulado rechazado", { exact: true }),
  ).toBeVisible();
  const url = page.url();
  await page.getByRole("button", { name: "Reintentar pago simulado" }).click();
  await page.getByLabel("Aprobar pago simulado").check();
  await page.getByRole("button", { name: "Confirmar simulación" }).click();
  await expect(
    page.getByText("Pago simulado aprobado", { exact: true }),
  ).toBeVisible();
  expect(page.url()).toBe(url);
  await page.reload();
  await expect(
    page.getByText("Pago simulado aprobado", { exact: true }),
  ).toBeVisible();
  await page.goto("/cuenta/pedidos");
  await expect(page.locator(".order-card").first()).toBeVisible();
});
