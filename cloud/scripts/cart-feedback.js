import { chromium } from "@playwright/test";
import { readFile, writeFile } from "node:fs/promises";
import { randomUUID, randomBytes } from "node:crypto";
import { checkTarget } from "./targets.js";

const target = await checkTarget(["--target", "staging"]);
const phase = process.argv.includes("--after") ? "after" : "before";
const browser = await chromium.launch({ headless: true });
const samples = [], requests = [];
const p95 = values => [...values].sort((a,b) => a-b)[Math.max(0, Math.ceil(values.length * .95) - 1)];
try {
  for (const width of [1280, 360]) {
    const context = await browser.newContext({ baseURL: target.origin, viewport: { width, height: 900 }, isMobile: width === 360, hasTouch: width === 360 });
    const page = await context.newPage();
    const session = await (await context.request.get("/api/auth/session")).json();
    const registration = await context.request.post("/api/auth/register", { headers: { origin: target.origin, "x-csrf-token": session.data.csrfToken }, data: { name: "Cart feedback synthetic", email: `cart-feedback-${randomUUID()}@example.test`, password: "T!" + randomBytes(24).toString("base64url") + "a8" } });
    if (registration.status() !== 201) throw Error("SYNTHETIC_REGISTRATION_FAILED");
    const catalog = await (await context.request.get("/api/products")).json();
    let product = catalog.data.find(p => p.is_available && p.quantity >= 3);
    if (phase === "after") {
      const before = await readFile(new URL("../private/cart-feedback-before.json", import.meta.url), "utf8").then(JSON.parse).catch(() => null);
      const saved = before?.productSlug && await (await context.request.get("/api/products/" + before.productSlug)).json();
      if (saved?.data?.is_available && saved.data.quantity >= 3) product = saved.data;
    }
    if (!product) throw Error("AVAILABLE_DEMO_PRODUCT_REQUIRED");
    const starts = new Map(); let inflight = 0, activeAction = null;
    page.on("request", request => {
      if (new URL(request.url()).pathname.startsWith("/api/cart")) { starts.set(request, { time: performance.now(), action: activeAction }); inflight++; }
    });
    page.on("requestfinished", async request => {
      if (!starts.has(request)) return;
      inflight--;
      const response = await request.response();
      requests.push({ width, action: starts.get(request).action, method: request.method(), path: new URL(request.url()).pathname, durationMs: +(performance.now() - starts.get(request).time).toFixed(1), status: response.status() });
    });
    page.on("requestfailed", request => { if (starts.has(request)) inflight--; });
    async function action(name, locator, condition) {
      const tag = `${width}-${samples.length}-${name}`; activeAction = tag;
      await page.evaluate(condition => {
        window.__cartFeedback = null;
        document.addEventListener("click", () => {
          const start = performance.now(); let visualMs = null;
          const poll = () => {
            const count = Number(document.querySelector(".cart-button span")?.textContent || 0);
            const line = document.querySelector(".cart-line");
            const quantity = Number(line?.querySelector(".quantity span")?.textContent || 0);
            const matches = condition.kind === "count" ? count === condition.value : condition.kind === "quantity" ? quantity === condition.value : !line && count === 0;
            if (matches && visualMs === null) visualMs = performance.now() - start;
            if (visualMs !== null && document.querySelector(".cart-button")?.dataset.cartPending !== "true")
              window.__cartFeedback = { visualMs, confirmedMs: performance.now() - start };
            else if (performance.now() - start < 45000) requestAnimationFrame(poll);
          };
          requestAnimationFrame(poll);
        }, { once: true, capture: true });
      }, condition);
      await locator.click();
      await page.waitForFunction(() => window.__cartFeedback !== null, null, { timeout: 50000 });
      const timing = await page.evaluate(() => window.__cartFeedback);
      for (let i=0; i<200 && inflight; i++) await page.waitForTimeout(25);
      await page.waitForTimeout(30);
      activeAction = null;
      const network = requests.filter(request => request.action === tag);
      samples.push({ width, action: name, visualMs: +timing.visualMs.toFixed(1), confirmedMs: +timing.confirmedMs.toFixed(1), requests: network });
    }
    for (let run = 0; run < 3; run++) {
      const loaded = page.waitForResponse(response => new URL(response.url()).pathname === "/api/cart" && response.status() === 200);
      await page.goto("/productos/" + product.slug); await (await loaded).finished();
      await action("add", page.getByRole("button", { name: "Agregar al carrito", exact: true }), { kind: "count", value: 1 });
      await page.getByRole("button", { name: "Abrir carrito", exact: true }).click();
      await page.getByRole("link", { name: "Ver mi carrito", exact: true }).click();
      await action("increase", page.getByRole("button", { name: "Aumentar cantidad de " + product.name, exact: true }), { kind: "quantity", value: 2 });
      await action("decrease", page.getByRole("button", { name: "Reducir cantidad de " + product.name, exact: true }), { kind: "quantity", value: 1 });
      await action("remove", page.getByRole("button", { name: "Quitar", exact: true }), { kind: "empty", value: 0 });
      const persisted = await (await context.request.get("/api/cart")).json();
      if (persisted.data.items.length) throw Error("CART_DID_NOT_PERSIST_EMPTY");
    }
    const own = samples.filter(sample => sample.width === width);
    console.log(JSON.stringify({ phase, width, samples: own.length, visualP95Ms: p95(own.map(s => s.visualMs)), confirmedP95Ms: p95(own.map(s => s.confirmedMs)), requestsPerAction: Object.fromEntries(["add","increase","decrease","remove"].map(action => [action, own.filter(s => s.action === action).map(s => s.requests.length)])) }));
    if (phase === "after" && (p95(own.map(s => s.visualMs)) > 100 || own.some(s => s.requests.length !== 1 || s.requests[0].status !== 200))) throw Error("CART_ACCEPTANCE_FAILED");
    await context.close();
    await writeFile(new URL(`../private/cart-feedback-${phase}.json`, import.meta.url), JSON.stringify({ phase, measuredAt: new Date().toISOString(), productSlug: product.slug, samples, requests, syntheticOnly: true, credentialsRecorded: false }, null, 2), { mode: 0o600 });
  }
} catch (error) { console.error(JSON.stringify({ failed: true, phase, error: error.name, privateValuesWithheld: true })); process.exitCode = 1; }
finally { await browser.close(); }
