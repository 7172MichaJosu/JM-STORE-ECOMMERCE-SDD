import { test, expect } from "@playwright/test";
import { adminLogin } from "./fixtures/helpers.js";
test("administrador: producto real, stock y categorías", async ({ page }) => {
  await adminLogin(page);
  await page.getByRole("link", { name: "Productos", exact: true }).click();
  await page.getByRole("link", { name: "Nuevo producto" }).click();
  const stamp = Date.now();
  await page.getByLabel("Nombre del producto").fill("Producto examen " + stamp);
  await page.getByLabel("SKU").fill("EX-" + stamp);
  await page.getByLabel("Slug").fill("examen-" + stamp);
  await page
    .getByLabel("Descripción")
    .fill("Producto genérico de demostración para verificar el panel.");
  await page.getByLabel("Precio (S/)").fill("49.90");
  await page.getByLabel("Stock inicial").fill("5");
  await page.getByRole("button", { name: "Guardar producto" }).click();
  await expect(page.getByText("Producto guardado")).toBeVisible();
  await page.goto("/catalogo?q=examen-" + stamp);
  await expect(page.getByText("No encontramos productos")).toBeVisible();
  await page.goto("/catalogo?q=Producto%20examen");
  await expect(
    page.getByRole("heading", {
      name: "Producto examen " + stamp,
      exact: true,
    }),
  ).toBeVisible();
  await page.goto("/admin/inventario");
  await expect(
    page.getByRole("heading", { name: "Inventario", exact: true }),
  ).toBeVisible();
});
