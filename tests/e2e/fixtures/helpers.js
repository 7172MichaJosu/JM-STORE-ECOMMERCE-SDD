import { expect } from "@playwright/test";
import { randomUUID } from "node:crypto";
export async function register(page) {
  const email = randomUUID() + "@example.test",
    password = randomUUID();
  await page.goto("/registro");
  await page.getByLabel("Nombre completo").fill("Cliente de examen");
  await page.getByLabel("Correo electrónico").fill(email);
  await page.getByLabel("Contraseña", { exact: true }).fill(password);
  await page.getByRole("button", { name: "Crear mi cuenta" }).click();
  await expect(page).toHaveURL(/cuenta/);
  return { email, password };
}
export async function address(page) {
  await page.goto("/cuenta/direcciones");
  await page.getByLabel("Destinatario").fill("Cliente de examen");
  await page.getByLabel("Teléfono").fill("999111222");
  await page.getByLabel("Departamento").fill("Lima");
  await page.getByLabel("Provincia").fill("Lima");
  await page.getByLabel("Distrito").fill("Miraflores");
  await page
    .getByLabel("Dirección", { exact: true })
    .fill("Avenida de prueba 123");
  await page.getByRole("button", { name: "Guardar dirección" }).click();
  await expect(
    page.getByText("Avenida de prueba 123", { exact: false }),
  ).toBeVisible();
}
export async function adminLogin(page) {
  await page.goto("/admin/ingresar");
  await page
    .getByLabel("Correo electrónico")
    .fill(process.env.TEST_ADMIN_EMAIL);
  await page
    .getByLabel("Contraseña", { exact: true })
    .fill(process.env.TEST_ADMIN_PASSWORD);
  await page.getByRole("button", { name: "Ingresar al panel" }).click();
  await expect(page).toHaveURL(/\/admin$/);
}
