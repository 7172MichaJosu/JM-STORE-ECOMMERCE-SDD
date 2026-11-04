import { test, expect } from "vitest";
import { env } from "cloudflare:workers";
import { seedStaging } from "../../scripts/seed-staging.js";
test("seed sintético20/5 es repetible y no pisa stock editado", async () => {
  await seedStaging(env.DB, { localOnly: true });
  expect(
    await env.DB.prepare("SELECT count(*) n FROM products").first("n"),
  ).toBe(20);
  expect(
    await env.DB.prepare("SELECT count(*) n FROM categories").first("n"),
  ).toBe(5);
  await env.DB.prepare(
    "UPDATE inventory SET quantity=1 WHERE product_id=1",
  ).run();
  await seedStaging(env.DB, { localOnly: true });
  expect(
    await env.DB.prepare(
      "SELECT quantity FROM inventory WHERE product_id=1",
    ).first("quantity"),
  ).toBe(1);
});
test("seed rechaza cualquier import o ambiente no sintético", async () => {
  await expect(seedStaging(env.DB)).rejects.toThrow();
  await env.DB.prepare(
    "UPDATE deployment_state SET source_digest='source-copy' WHERE id=1",
  ).run();
  await expect(seedStaging(env.DB, { localOnly: true })).rejects.toThrow();
  expect(
    await env.DB.prepare("SELECT count(*) n FROM products").first("n"),
  ).toBe(0);
});
