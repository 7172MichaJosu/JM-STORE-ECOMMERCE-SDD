import { test, expect } from "@playwright/test";
import { register, address } from "./fixtures/helpers.js";
test("compra: rechazo, mismo pedido aprobado e historial", async ({ page }) => {
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
