import { test, expect } from "@playwright/test";
import { adminLogin, register, address } from "./fixtures/helpers.js";
test("panel completo y cliente: categoría, foto, promoción, stock y seguimiento", async ({
  page,
  browser,
}) => {
  await adminLogin(page);
  const stamp = Date.now(),
    name = "Artículo completo " + stamp,
    slug = "articulo-" + stamp;
  await page.goto("/admin/categorias");
  await page.getByLabel("Nombre de categoría").fill("Examen " + stamp);
  await page.getByLabel("Slug de categoría").fill("examen-" + stamp);
  await page.getByRole("button", { name: "Guardar categoría" }).click();
  await expect(page.getByText("Categoría guardada")).toBeVisible();
  await page.goto("/admin/productos/nuevo");
  await page.getByLabel("Nombre del producto").fill(name);
  await page
    .getByLabel("Categoría", { exact: true })
    .selectOption({ label: "Examen " + stamp });
  await page.getByLabel("SKU").fill("FULL-" + stamp);
  await page.getByLabel("Slug", { exact: true }).fill(slug);
  await page
    .getByLabel("Descripción")
    .fill("Producto de prueba para el recorrido completo.");
  await page.getByLabel("Precio (S/)").fill("50");
  await page.getByLabel("Stock inicial").fill("5");
  await page.getByRole("button", { name: "Seleccionar headphones" }).click();
  await page.getByRole("button", { name: "Guardar producto" }).click();
  await expect(page.getByText("Producto guardado")).toBeVisible();
  await page.goto("/admin/inventario");
  await page
    .getByRole("row")
    .filter({ hasText: name })
    .getByRole("button", { name: "Ajustar / Historial" })
    .click();
  await page.getByLabel("Nueva cantidad").fill("8");
  await page.getByLabel("Motivo del ajuste").fill("Preparación del examen");
  await page.getByRole("button", { name: "Guardar ajuste" }).click();
  await expect(page.getByText("Inventario actualizado")).toBeVisible();
  await page.goto("/admin/promociones");
  await page
    .getByLabel("Objetivo", { exact: true })
    .selectOption({ label: name });
  await page.getByLabel("Precio final (S/)").fill("40");
  await page.getByRole("button", { name: "Guardar promoción" }).click();
  await expect(page.getByText("Promoción guardada")).toBeVisible();
  const context = await browser.newContext({ baseURL: "http://localhost:3101" });
  const client = await context.newPage();
  const customer = await register(client);
  await address(client);
  await client.goto("/productos/" + slug);
  await expect(client.locator(".detail-price .price")).toHaveText("S/ 40.00");
  await client.getByRole("button", { name: "Agregar al carrito" }).click();
  await expect(
    client.getByText("Producto agregado a tu carrito"),
  ).toBeVisible();
  await client.goto("/checkout");
  await client.getByRole("button", { name: "Revisar mi pedido" }).click();
  await client.getByLabel("Aprobar pago simulado").check();
  await client.getByRole("button", { name: "Confirmar simulación" }).click();
  await expect(
    client.getByText("Pago simulado aprobado", { exact: true }),
  ).toBeVisible();
  const publicId = client.url().split("/").pop();
  await page.goto("/admin/pedidos/" + publicId);
  await page.getByRole("button", { name: "Marcar Preparando" }).click();
  await expect(page.getByText("Estado del pedido actualizado")).toBeVisible();
  await client.reload();
  await expect(client.locator(".order-result .badge")).toHaveText("Preparando");
  await page.goto("/admin/clientes");
  await page.getByLabel("Buscar clientes").fill(customer.email);
  await page
    .getByRole("row")
    .filter({ hasText: customer.email })
    .getByRole("button", { name: "Ver / Editar" })
    .click();
  await page.getByLabel("Nombre del cliente").fill("Cliente actualizado");
  await page.getByRole("button", { name: "Guardar cliente" }).click();
  await expect(
    page.getByText("Cliente actualizado", { exact: true }),
  ).toBeVisible();
  await context.close();
});
