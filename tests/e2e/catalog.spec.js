import { test, expect } from "@playwright/test";
test("catálogo público: fotos, navegación, filtros y vacío", async ({
  page,
}) => {
  await page.goto("/");
  await expect(
    page.getByRole("heading", { name: "Tus próximos favoritos" }),
  ).toBeVisible();
  await expect(page.locator(".product-card").first()).toBeVisible();
  await expect(page.locator(".product-card img").first()).toHaveJSProperty(
    "complete",
    true,
  );
  await page.getByRole("searchbox").fill("Auriculares");
  await page.getByRole("searchbox").press("Enter");
  await expect(
    page.getByRole("heading", {
      name: "Auriculares inalámbricos",
      exact: true,
    }),
  ).toBeVisible();
  await page.getByRole("searchbox").fill("NoExisteProductoJM");
  await page.getByRole("searchbox").press("Enter");
  await expect(page.getByText("No encontramos productos")).toBeVisible();
});
