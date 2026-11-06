import { test, expect } from "@playwright/test";
import { register, address } from "./fixtures/helpers.js";

const delay = ms => new Promise(resolve => setTimeout(resolve, ms));
async function openProduct(page, minimum = 3) {
  const catalog = await (await page.request.get("/api/products")).json();
  const product = catalog.data.find(p => p.is_available && p.available_quantity >= minimum);
  if (!product) throw Error("Synthetic catalogue product required");
  const loaded = page.waitForResponse(response => new URL(response.url()).pathname === "/api/cart" && response.status() === 200);
  await page.goto("/productos/" + product.slug); await (await loaded).finished();
  return product;
}
async function cartPage(page) {
  await page.getByRole("button", { name: "Abrir carrito", exact: true }).click();
  await page.getByRole("link", { name: "Ver mi carrito", exact: true }).click();
}
async function feedback(page, locator, kind, value) {
  await page.evaluate(({ kind, value }) => {
    window.__feedbackMs = null;
    document.addEventListener("click", () => {
      const start = performance.now();
      function poll() {
        const count = Number(document.querySelector(".cart-button span")?.textContent || 0);
        const quantity = Number(document.querySelector(".cart-line .quantity span")?.textContent || 0);
        const matches = kind === "count" ? count === value : kind === "quantity" ? quantity === value : !document.querySelector(".cart-line") && count === 0;
        if (matches) window.__feedbackMs = performance.now() - start;
        else if (performance.now() - start < 10000) requestAnimationFrame(poll);
      }
      requestAnimationFrame(poll);
    }, { once: true, capture: true });
  }, { kind, value });
  await locator.click();
  await expect.poll(() => page.evaluate(() => window.__feedbackMs)).not.toBeNull();
  const elapsed = await page.evaluate(() => window.__feedbackMs);
  expect(elapsed).toBeLessThanOrEqual(100);
  return elapsed;
}
const settled = page => expect(page.getByRole("button", { name: "Abrir carrito", exact: true })).toHaveAttribute("data-cart-pending", "false", { timeout: 20000 });

for (const width of [1280, 360]) {
  test(`carrito: respuesta inmediata con red lenta en ${width}px`, async ({ page }) => {
    await page.setViewportSize({ width, height: 900 });
    const p = await openProduct(page), active = new Set(); let maximum = 0;
    page.on("request", req => { if (/\/api\/cart\/items\//.test(req.url())) { active.add(req); maximum = Math.max(maximum, active.size); } });
    page.on("requestfinished", req => active.delete(req)); page.on("requestfailed", req => active.delete(req));
    await page.route("**/api/cart/items/*", async route => { await delay(1500); await route.continue(); });
    await feedback(page, page.getByRole("button", { name: "Agregar al carrito", exact: true }), "count", 1);
    await cartPage(page);
    await feedback(page, page.getByRole("button", { name: "Aumentar cantidad de " + p.name, exact: true }), "quantity", 2);
    expect(Number((await page.locator(".summary-total .price").textContent()).replace(/\D/g,""))).toBe(p.effective_price_cents * 2);
    await feedback(page, page.getByRole("button", { name: "Reducir cantidad de " + p.name, exact: true }), "quantity", 1);
    await feedback(page, page.getByRole("button", { name: "Quitar", exact: true }), "empty", 0);
    await settled(page);expect(maximum).toBe(1);
    await page.reload();await expect(page.getByRole("heading", { name: "Tu carrito está esperando" })).toBeVisible();
    expect((await (await page.request.get("/api/cart")).json()).data.items).toEqual([]);
  });
}

test("carrito: ráfagas no duplican líneas ni pierden cantidades", async ({ page }) => {
  const p=await openProduct(page,10);let mutations=0;
  await page.route("**/api/cart/items/*",async route=>{mutations++;await delay(500);await route.continue();});
  await page.getByRole("button",{name:"Agregar al carrito",exact:true}).evaluate(button=>{for(let i=0;i<8;i++)button.click();});
  await expect(page.locator(".cart-button span")).toHaveText("8");await cartPage(page);
  await page.getByRole("button",{name:"Reducir cantidad de "+p.name,exact:true}).evaluate(button=>{for(let i=0;i<3;i++)button.click();});
  await expect(page.locator(".cart-line .quantity span")).toHaveText("5");await settled(page);
  const saved=(await (await page.request.get("/api/cart")).json()).data;
  expect(saved.items).toHaveLength(1);expect(saved.items[0].quantity).toBe(5);expect(mutations).toBeLessThanOrEqual(2);
  await page.reload();await expect(page.locator(".cart-line .quantity span")).toHaveText("5");
});

test("carrito: error revierte, avisa y exige revisión antes de checkout",async({page})=>{
  const p=await openProduct(page);await page.getByRole("button",{name:"Agregar al carrito",exact:true}).click();
  await expect(page.locator(".cart-button span")).toHaveText("1");await settled(page);await cartPage(page);
  await page.route("**/api/cart/items/*",async route=>{await delay(800);await route.fulfill({status:500,contentType:"application/json",body:JSON.stringify({error:{code:"INTERNAL",message:"Fallo sintético de carrito."}})});},{times:1});
  await feedback(page,page.getByRole("button",{name:"Aumentar cantidad de "+p.name,exact:true}),"quantity",2);
  await expect(page.locator(".cart-sync-error")).toBeVisible();await expect(page.locator(".cart-line .quantity span")).toHaveText("1");
  await expect(page.getByRole("button",{name:"Continuar compra",exact:true})).toBeDisabled();
  await page.getByRole("button",{name:"Reintentar sincronización",exact:true}).click();await settled(page);
  await expect(page.locator(".cart-sync-error")).toHaveCount(0);
  expect((await (await page.request.get("/api/cart")).json()).data.items[0].quantity).toBe(1);
});

test("carrito: respuesta perdida después de guardar no repite el incremento",async({page})=>{
  const p=await openProduct(page);await page.getByRole("button",{name:"Agregar al carrito",exact:true}).click();
  await expect(page.locator(".cart-button span")).toHaveText("1");await settled(page);await cartPage(page);
  let writes=0;
  await page.route("**/api/cart/items/*",async route=>{writes++;await route.fetch();await route.abort("failed");},{times:1});
  await page.getByRole("button",{name:"Aumentar cantidad de "+p.name,exact:true}).click();
  await expect(page.locator(".cart-sync-error")).toBeVisible();await settled(page);
  await expect(page.locator(".cart-line .quantity span")).toHaveText("2");
  expect(writes).toBe(1);expect((await (await page.request.get("/api/cart")).json()).data.items[0].quantity).toBe(2);
});

test("carrito: checkout espera la persistencia y conserva compra simulada",async({page})=>{
  await register(page);await address(page);
  const catalog=await(await page.request.get("/api/products")).json();const p=catalog.data.find(p=>p.is_available&&p.available_quantity>=2);
  await page.goto("/productos/"+p.slug);await expect(page.getByRole("button",{name:"Agregar al carrito",exact:true})).toBeEnabled();
  await page.route("**/api/cart/items/*",async route=>{await delay(1500);await route.continue();});
  await feedback(page,page.getByRole("button",{name:"Agregar al carrito",exact:true}),"count",1);await cartPage(page);
  await expect(page.getByRole("button",{name:"Continuar compra",exact:true})).toBeDisabled();await settled(page);
  await page.getByRole("link",{name:"Continuar compra",exact:true}).click();await page.getByRole("button",{name:"Revisar mi pedido",exact:true}).click();
  await page.getByLabel("Aprobar pago simulado").check();await page.getByRole("button",{name:"Confirmar simulación",exact:true}).click();
  await expect(page.getByText("Pago simulado aprobado",{exact:true})).toBeVisible();
});
