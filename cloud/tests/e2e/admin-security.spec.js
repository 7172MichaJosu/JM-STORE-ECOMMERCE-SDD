import { test, expect } from "@playwright/test";
import AxeBuilder from "@axe-core/playwright";

const admins = JSON.parse(process.env.JM_TEST_ADMINS || "[]");
async function login(page, admin) {
  await page.goto("/admin/ingresar");
  await page.getByLabel("Correo electrónico").fill(admin.email);
  await page.getByLabel("Contraseña", { exact: true }).fill(admin.password);
  await page.getByRole("button", { name: "Ingresar al panel" }).click();
  await expect(page).toHaveURL(/\/admin$/);
}

test("email action GET is inert, removes the code from the address bar, and waits for explicit POST", async ({ page }) => {
  let confirmPosts = 0;
  page.on("request", request => {
    if (request.url().includes("/api/auth/email-change/confirm") && request.method() === "POST") confirmPosts++;
  });
  const operation = crypto.randomUUID(), code = "synthetic-oob-code-for-browser";
  const query = new URLSearchParams({ mode: "verifyAndChangeEmail", operation, oobCode: code });
  await page.goto("/admin/mi-cuenta/seguridad/confirmar-correo?" + query.toString());
  await expect(page.getByRole("heading", { name: "Confirmar nuevo correo" })).toBeVisible();
  await expect(page.getByRole("button", { name: "Confirmar cambio de correo" })).toBeVisible();
  await expect.poll(() => new URL(page.url()).search).toBe("");
  expect(confirmPosts).toBe(0);
  await page.route("**/api/auth/email-change/confirm", route => route.fulfill({ status: 503, contentType: "application/json", body: JSON.stringify({ error: { code: "EMAIL_ACTION_PENDING_RETRY", message: "No se pudo confirmar. Intenta de nuevo." } }) }));
  await page.getByRole("button", { name: "Confirmar cambio de correo" }).click();
  await expect(page.getByRole("alert")).toContainText("Intenta de nuevo");
  expect(confirmPosts).toBe(1);
  await expect(page.getByRole("heading", { name: "Confirmar nuevo correo" })).toBeVisible();
  const axe = await new AxeBuilder({ page }).include("#contenido").withTags(["wcag2a", "wcag2aa", "wcag21aa"]).analyze();
  expect(axe.violations).toEqual([]);
  for (const width of [360, 1280]) {
    await page.setViewportSize({ width, height: 900 });
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
  }
});

test("security form rejects combined email and password changes before sending a request", async ({ page }) => {
  await login(page, admins[4]);
  await page.goto("/admin/mi-cuenta/seguridad");
  let patches = 0;
  page.on("request", request => { if (request.url().includes("/api/admin/me/security") && request.method() === "PATCH") patches++; });
  await page.locator("input[name=email]").fill("separate-change@example.test");
  await page.locator("input[name=currentPassword]").fill(admins[4].password);
  await page.locator("input[name=newPassword]").fill("synthetic-new-password-long");
  await page.locator("input[name=confirmNewPassword]").fill("synthetic-new-password-long");
  await page.getByRole("button", { name: "Guardar cambios" }).click();
  await expect(page.getByRole("alert")).toContainText("operaciones separadas");
  expect(patches).toBe(0);
});

test("seguridad: navegación, validaciones, guardado lento y correo inmediato", async ({ page }, testInfo) => {
  await login(page, admins[0]);
  await page.getByRole("link", { name: "Mi cuenta → Seguridad" }).click();
  await expect(page.getByRole("heading", { name: "Seguridad de mi cuenta" })).toBeVisible();
  await page.getByLabel("Contraseña actual", { exact: true }).focus();
  await page.keyboard.press("Tab");
  await expect(page.getByRole("button", { name: "Mostrar contraseña actual", exact: true })).toBeFocused();
  const email = `${crypto.randomUUID()}@example.test`;
  await page.locator("input[name=email]").fill(email);
  await page.getByLabel("Contraseña actual", { exact: true }).fill(crypto.randomUUID());
  await page.getByRole("button", { name: "Guardar cambios" }).click();
  await expect(page.getByRole("alert")).toContainText("contraseña actual");
  await page.locator("input[name=email]").fill(email);
  await page.getByLabel("Contraseña actual", { exact: true }).fill(admins[0].password);
  await page.route("**/api/admin/me/security", async route => {
    if (route.request().method() === "PATCH") await new Promise(resolve => setTimeout(resolve, 400));
    await route.continue();
  });
  await page.getByRole("button", { name: "Guardar cambios" }).click();
  await expect(page.getByRole("button", { name: "Guardando…" })).toBeDisabled();
  await expect(page.getByRole("status").filter({ hasText: "Correo actualizado." })).toBeVisible();
  await expect(page.getByLabel("Correo actual", { exact: true })).toHaveValue(email);
  await expect(page.getByLabel("Contraseña actual", { exact: true })).toHaveValue("");
  for (const width of [360, 1280]) {
    await page.setViewportSize({ width, height: 900 });
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
    for (const theme of ["light", "dark"]) {
      await page.evaluate(theme => { document.documentElement.dataset.theme = theme; }, theme);
      await expect(page.getByRole("button", { name: "Mostrar contraseña actual", exact: true })).toHaveCSS("background-color", theme === "dark" ? "rgb(35, 48, 75)" : "rgb(238, 243, 252)");
      const result = await new AxeBuilder({ page }).include(".admin-security").withTags(["wcag2a", "wcag2aa", "wcag21aa"]).analyze();
      expect(result.violations).toEqual([]);
    }
  }
  await page.screenshot({ path: testInfo.outputPath("admin-security.png"), fullPage: true });
});

test("password revoca otras sesiones y exige login con nueva contraseña", async ({ page, browser }) => {
  const admin = admins[1], nextPassword = crypto.randomUUID();
  await login(page, admin);
  const other = await browser.newContext();
  const otherPage = await other.newPage();
  await login(otherPage, admin);
  await page.goto("/admin/mi-cuenta/seguridad");
  await page.getByLabel("Contraseña actual", { exact: true }).fill(admin.password);
  await page.getByLabel("Nueva contraseña", { exact: true }).fill(nextPassword);
  await page.getByLabel("Confirmar nueva contraseña", { exact: true }).fill("no-coincide-1234");
  await page.getByRole("button", { name: "Guardar cambios" }).click();
  await expect(page.getByRole("alert")).toContainText("coincidir");
  await page.getByLabel("Confirmar nueva contraseña", { exact: true }).fill(nextPassword);
  await page.getByRole("button", { name: "Guardar cambios" }).click();
  await expect(page).toHaveURL(/admin\/ingresar/);
  expect((await otherPage.request.get("/api/auth/session")).ok()).toBe(true);
  const session = await (await otherPage.request.get("/api/auth/session")).json();
  expect(session.data.user).toBeNull();
  await login(page, { ...admin, password: nextPassword });
  await other.close();
});

test("respuesta perdida después de commit reconcilia logout sin reenviar password", async ({ page }) => {
  const admin = admins[2], password = crypto.randomUUID();
  await login(page, admin);
  await page.goto("/admin/mi-cuenta/seguridad");
  let patches = 0;
  await page.route("**/api/admin/me/security", async route => {
    if (route.request().method() !== "PATCH") return route.continue();
    patches++;
    await route.fetch();
    await route.abort();
  });
  await page.getByLabel("Contraseña actual", { exact: true }).fill(admin.password);
  await page.getByLabel("Nueva contraseña", { exact: true }).fill(password);
  await page.getByLabel("Confirmar nueva contraseña", { exact: true }).fill(password);
  await page.getByRole("button", { name: "Guardar cambios" }).click();
  await expect(page).toHaveURL(/admin\/ingresar/);
  expect(patches).toBe(1);
  await login(page, { ...admin, password });
});

test("sin capacidad el backend local mantiene navegación y ruta no disponible", async ({ page }) => {
  await page.route("**/api/auth/**", async route => {
    const response = await route.fetch();
    const data = await response.json();
    if (data.data) delete data.data.capabilities;
    await route.fulfill({ response, json: data });
  });
  await login(page, admins[3]);
  await expect(page.getByRole("link", { name: "Mi cuenta → Seguridad" })).toHaveCount(0);
  let calls = 0;
  page.on("request", request => { if (request.url().includes("/api/admin/me/security")) calls++; });
  await page.goto("/admin/mi-cuenta/seguridad");
  await expect(page.getByRole("heading", { name: "Esta página no está disponible" })).toBeVisible();
  expect(calls).toBe(0);
});
