import { test, expect } from "@playwright/test";
import { register, address } from "./fixtures/helpers.js";
test("cuenta: registro, perfil, dirección y login posterior", async ({
  page,
}) => {
  const credentials = await register(page);
  await page.getByLabel("Nombre completo").fill("Cliente editado");
  await page.getByRole("button", { name: "Guardar cambios" }).click();
  await expect(page.getByText("Perfil actualizado")).toBeVisible();
  await address(page);
  await page.getByRole("button", { name: "Editar dirección" }).click();
  await page
    .getByLabel("Dirección", { exact: true })
    .fill("Avenida actualizada 456");
  await page.getByRole("button", { name: "Guardar dirección" }).click();
  await expect(
    page.getByText("Avenida actualizada 456", { exact: false }),
  ).toBeVisible();
  await page.getByRole("button", { name: "Cerrar sesión" }).click();
  await page.goto("/ingresar");
  await page.getByLabel("Correo electrónico").fill(credentials.email);
  await page
    .getByLabel("Contraseña", { exact: true })
    .fill(credentials.password);
  await page.getByRole("button", { name: "Ingresar a mi cuenta" }).click();
  await expect(page).toHaveURL(/cuenta/);
  await page.goto("/cuenta/direcciones");
  await expect(
    page.getByText("Avenida actualizada 456", { exact: false }),
  ).toBeVisible();
});
