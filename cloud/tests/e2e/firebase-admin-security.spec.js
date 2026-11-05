import { test, expect } from "@playwright/test";
import AxeBuilder from "@axe-core/playwright";
import { readFile, writeFile } from "node:fs/promises";
import { randomUUID } from "node:crypto";
import { register } from "../../../tests/e2e/fixtures/helpers.js";

const admins = JSON.parse(process.env.JM_TEST_ADMINS || "[]");
async function signIn(page, account, admin = true) {
  await page.goto(admin ? "/admin/ingresar" : "/ingresar");
  await page.locator("input[name=email]").fill(account.email);
  await page.locator("input[name=password]").fill(account.password);
  await page.getByRole("button", { name: admin ? "Ingresar al panel" : "Ingresar a mi cuenta" }).click();
}
async function login(page, account, admin = true) {
  await signIn(page, account, admin);
  await expect(page).toHaveURL(admin ? /\/admin$/ : /\/cuenta$/);
}
async function requestEmail(page, account, email) {
  await page.goto("/admin/mi-cuenta/seguridad");
  await page.locator("input[name=email]").fill(email);
  await page.locator("input[name=currentPassword]").fill(account.password);
  await page.getByRole("button", { name: "Guardar cambios" }).click();
  await expect(page.getByRole("status").filter({ hasText: email }).first()).toBeVisible();
}
async function actionFor(email) {
  let found;
  await expect.poll(async () => {
    try { found = JSON.parse(await readFile(process.env.JM_FIREBASE_ACTIONS_FILE, "utf8")).filter(action => action.newEmail === email).at(-1); return Boolean(found); } catch { return false; }
  }).toBe(true);
  return found;
}
const actionUrl = action => "/admin/mi-cuenta/seguridad/confirmar-correo?" + new URLSearchParams({ operation: action.operationId, oobCode: action.oobCode, mode: "verifyAndChangeEmail" });

test("Firebase REST local: registration, login and D1 roles", async ({ page, browser }) => {
  const account = await register(page);
  const session = await (await page.request.get("/api/auth/session")).json();
  expect(session.data.user.role).toBe("CUSTOMER");
  expect(session.data.capabilities.emailVerification).toBe(true);
  expect((await page.request.get("/api/admin/me/security")).status()).toBe(403);
  const other = await browser.newContext();
  const otherPage = await other.newPage();
  await login(otherPage, account, false);
  expect(JSON.stringify(await (await otherPage.request.get("/api/auth/session")).json())).not.toMatch(/idToken|refreshToken|password_hash/);
  await other.close();
});

test("Firebase password: current credential, separate change, revoke both sessions and require new login", async ({ page, browser }) => {
  await page.route("**/api/auth/**", async route => {
    const response = await route.fetch();
    const data = await response.json();
    if (data.data?.capabilities) data.data.capabilities.emailChangeReady = false;
    await route.fulfill({ response, json: data });
  });
  const account = admins[0], nextPassword = randomUUID();
  await login(page, account);
  const other = await browser.newContext(); const otherPage = await other.newPage();
  await login(otherPage, account);
  await page.goto("/admin/mi-cuenta/seguridad");
  await expect(page.locator("input[name=email]")).toBeDisabled();
  await page.locator("input[name=currentPassword]").fill(randomUUID());
  await page.locator("input[name=newPassword]").fill(nextPassword);
  await page.locator("input[name=confirmNewPassword]").fill(nextPassword);
  await page.getByRole("button", { name: "Guardar cambios" }).click();
  await expect(page.getByRole("alert")).toContainText("actual");
  await page.locator("input[name=currentPassword]").fill(account.password);
  await page.locator("input[name=newPassword]").fill(nextPassword);
  await page.locator("input[name=confirmNewPassword]").fill(nextPassword);
  await page.getByRole("button", { name: "Guardar cambios" }).click();
  await expect(page).toHaveURL(/\/admin\/ingresar$/);
  expect((await (await otherPage.request.get("/api/auth/session")).json()).data.user).toBeNull();
  await signIn(page, account);
  await expect(page.getByRole("alert")).toContainText("incorrectos");
  await login(page, { ...account, password: nextPassword });
  await other.close();
});

test("Firebase email: reserve, cancel immediately, confirm from another browser and revoke sessions", async ({ page, browser }) => {
  const account = admins[1], email = `${randomUUID()}@example.test`;
  await login(page, account);
  await requestEmail(page, account, email);
  await expect(page.getByLabel("Correo actual", { exact: true })).toHaveValue(account.email);
  await expect(page.getByRole("button", { name: "Cancelar solicitud" })).toBeVisible();
  await page.locator("#cancelCurrentPassword").fill(account.password);
  await page.getByRole("button", { name: "Cancelar solicitud" }).click();
  await expect(page.getByRole("button", { name: "Cancelar solicitud" })).toHaveCount(0);
  await requestEmail(page, account, email);
  const action = await actionFor(email);
  const other = await browser.newContext(); const otherPage = await other.newPage();
  await otherPage.goto(actionUrl(action));
  await expect(otherPage.getByRole("heading", { name: "Confirmar nuevo correo" })).toBeVisible();
  expect((await (await page.request.get("/api/auth/session")).json()).data.user.email).toBe(account.email);
  await expect.poll(() => new URL(otherPage.url()).search).toBe("");
  await otherPage.getByRole("button", { name: "Confirmar cambio de correo" }).click();
  await expect(otherPage).toHaveURL(/\/admin\/ingresar$/);
  expect((await (await page.request.get("/api/auth/session")).json()).data.user).toBeNull();
  await signIn(otherPage, account);
  await expect(otherPage.getByRole("alert")).toContainText("incorrectos");
  await login(otherPage, { ...account, email });
  await other.close();
});

test("Firebase email: expired provider code fails without changing the address or showing success", async ({ page, browser }) => {
  const account = admins[2], email = `${randomUUID()}@example.test`;
  await login(page, account);
  await requestEmail(page, account, email);
  const action = await actionFor(email);
  const controls = JSON.parse(await readFile(process.env.JM_FIREBASE_ACTIONS_FILE, "utf8"));
  controls.find(item => item.oobCode === action.oobCode).expired = true;
  await writeFile(process.env.JM_FIREBASE_ACTIONS_FILE, JSON.stringify(controls));
  const other = await browser.newContext(); const otherPage = await other.newPage();
  await otherPage.goto(actionUrl(action));
  await otherPage.getByRole("button", { name: "Confirmar cambio de correo" }).click();
  await expect(otherPage.getByRole("alert")).toBeVisible();
  await expect(otherPage.getByRole("heading", { name: "Confirmar nuevo correo" })).toBeVisible();
  expect((await (await page.request.get("/api/auth/session")).json()).data.user.email).toBe(account.email);
  const axe = await new AxeBuilder({ page: otherPage }).include("#contenido").withTags(["wcag2a", "wcag2aa", "wcag21aa"]).analyze();
  expect(axe.violations).toEqual([]);
  await other.close();
});
