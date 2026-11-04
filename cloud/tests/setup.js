import { beforeAll, beforeEach } from "vitest";
import { env } from "cloudflare:workers";
import { applyD1Migrations } from "cloudflare:test";
beforeAll(async () => {
  await applyD1Migrations(env.DB, env.TEST_MIGRATIONS);
});
beforeEach(async () => {
  const tables = [
    "security_events",
    "mutation_contexts",
    "migration_chunks",
    "migration_runs",
    "idempotency_records",
    "order_status_history",
    "inventory_movements",
    "simulated_payments",
    "order_items",
    "orders",
    "cart_items",
    "carts",
    "addresses",
    "sessions",
    "users",
    "promotions",
    "product_images",
    "inventory",
    "products",
    "categories",
    "roles",
    "rate_limit_buckets",
  ];
  await env.DB.batch(tables.map((t) => env.DB.prepare(`DELETE FROM ${t}`)));
  await env.DB.prepare(
    "UPDATE deployment_state SET mode='CLOSED',database_identity='',environment_id='unconfigured' WHERE id=1",
  ).run();
});
