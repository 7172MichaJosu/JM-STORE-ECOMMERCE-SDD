import { accessibilityViolations } from "./fixtures/accessibility.js";
import { test, expect } from "@playwright/test";
import { register, address, adminLogin } from "./fixtures/helpers.js";
test("360 y 1280: tema, teclado, movimiento reducido y sin overflow", async ({
  page,
}) => {
  for (const width of [360, 1280]) {
    await page.setViewportSize({ width, height: 900 });
    await page.emulateMedia({ reducedMotion: "reduce" });
    await page.goto("/");
    await expect(page.getByRole("searchbox")).toBeVisible();
    expect(
      await page.evaluate(
        () => document.documentElement.scrollWidth <= window.innerWidth,
      ),
    ).toBe(true);
    await page.getByRole("button", { name: "Cambiar tema" }).click();
    await expect(page.locator("html")).toHaveAttribute("data-theme", "dark");
    expect(await accessibilityViolations(page)).toEqual([]);
    await page.reload();
    await expect(page.locator("html")).toHaveAttribute("data-theme", "dark");
    await page.getByRole("button", { name: "Cambiar tema" }).click();
    expect(await accessibilityViolations(page)).toEqual([]);
    await page.keyboard.press("Tab");
    expect(
      await page.evaluate(() => document.activeElement !== document.body),
    ).toBe(true);
  }
});

async function checkRoutes(page, routes) {
  for (const width of [360, 1280]) {
    await page.setViewportSize({ width, height: 900 });
    await page.emulateMedia({ reducedMotion: "reduce" });
    for (const theme of ["light", "dark"]) {
      for (const route of routes) {
        await page.goto(route);
        await expect(page.locator(".loading")).toHaveCount(0);
        if ((await page.locator("html").getAttribute("data-theme")) !== theme) {
          await page.getByRole("button", { name: "Cambiar tema" }).click();
        }
        expect(
          await page.evaluate(
            () => document.documentElement.scrollWidth <= innerWidth,
          ),
          route + " " + width,
        ).toBe(true);
        expect(
          await accessibilityViolations(page),
          route + " " + width + " " + theme,
        ).toEqual([]);
      }
    }
  }
}

test("cuenta: contraste y reflow de perfil, direcciones, carrito e historial", async ({
  page,
}) => {
  test.setTimeout(90000);
  await register(page);
  await address(page);
  await checkRoutes(page, [
    "/cuenta",
    "/cuenta/direcciones",
    "/carrito",
    "/cuenta/pedidos",
  ]);
});

test("panel: contraste y reflow de todas las secciones administrativas", async ({
  page,
}) => {
  test.setTimeout(120000);
  await adminLogin(page);
  await checkRoutes(page, [
    "/admin",
    "/admin/productos",
    "/admin/categorias",
    "/admin/promociones",
    "/admin/inventario",
    "/admin/clientes",
    "/admin/pedidos",
  ]);
});
