import { mkdir, readFile, writeFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import { spawnSync } from "node:child_process";
import { randomUUID } from "node:crypto";
import { join } from "node:path";
import { categories, demoProducts } from "../../shared/domain/demo-catalog.js";
import { checkTarget } from "./targets.js";

const args = process.argv.slice(2);
const target = await checkTarget(args);
if (target.environment !== "staging")
  throw Error("El seed remoto solo admite --target staging.");

const root = fileURLToPath(new URL("../", import.meta.url));
const configPath = join(root, "wrangler.staging.jsonc");
const config = JSON.parse(await readFile(configPath, "utf8"));
const identity = `${config.d1_databases?.[0]?.database_name}:${target.databaseId}`;
if (
  target.worker !== config.name ||
  target.accountId !== config.account_id ||
  target.databaseId !== config.d1_databases?.[0]?.database_id ||
  target.origin !== config.vars?.APP_ORIGIN ||
  config.vars?.ENVIRONMENT !== "staging" ||
  config.vars?.DATABASE_IDENTITY !== identity ||
  config.vars?.REMOTE_ENABLED !== "true" ||
  config.d1_databases?.length !== 1 ||
  config.d1_databases[0].database_name !== "jm-store-ecommerce-d1-staging"
)
  throw Error("La allowlist no coincide con la configuración exacta de staging.");

const cli = fileURLToPath(
  new URL("../../node_modules/wrangler/bin/wrangler.js", import.meta.url),
);
function execute(argv, parseJson = true) {
  const result = spawnSync(process.execPath, [cli, ...argv], {
    cwd: root,
    encoding: "utf8",
    env: { ...process.env, WRANGLER_SEND_METRICS: "false" },
    maxBuffer: 2 * 1024 * 1024,
  });
  if (result.status !== 0) throw Error("La operación D1 de staging falló.");
  if (!parseJson) return result.stdout;
  try {
    return JSON.parse(result.stdout.trim());
  } catch {
    throw Error("Respuesta D1 inesperada; no se continúa con el seed.");
  }
}

const query = (sql) =>
  execute([
    "d1",
    "execute",
    "DB",
    "--remote",
    "--config",
    configPath,
    "--command",
    sql,
    "--json",
  ]);
const preflight = query(
  "SELECT environment_id,database_identity,schema_version,source_digest,mode FROM deployment_state WHERE id=1; SELECT (SELECT count(*) FROM roles) roles,(SELECT count(*) FROM categories) categories,(SELECT count(*) FROM products) products,(SELECT count(*) FROM product_images) images,(SELECT count(*) FROM inventory) inventory,(SELECT count(*) FROM inventory_movements) movements,(SELECT count(*) FROM users) users,(SELECT count(*) FROM sessions) sessions,(SELECT count(*) FROM addresses) addresses,(SELECT count(*) FROM carts) carts,(SELECT count(*) FROM cart_items) cart_items,(SELECT count(*) FROM orders) orders,(SELECT count(*) FROM order_items) order_items,(SELECT count(*) FROM simulated_payments) payments,(SELECT count(*) FROM order_status_history) history,(SELECT count(*) FROM idempotency_records) idempotency,(SELECT count(*) FROM migration_runs) migration_runs,(SELECT count(*) FROM migration_chunks) migration_chunks,(SELECT count(*) FROM security_events) security_events,(SELECT count(*) FROM rate_limit_buckets) rate_limits;",
);
const state = preflight?.[0]?.results?.[0];
const counts = preflight?.[1]?.results?.[0];
const emptyTarget =
  state?.environment_id === "unconfigured" &&
  state.database_identity === "" &&
  state.schema_version === 2 &&
  state.source_digest === null &&
  state.mode === "CLOSED" &&
  counts &&
  Object.values(counts).every((value) => value === 0);
const sameSeededTarget =
  state?.environment_id === "staging-synthetic" &&
  state.database_identity === identity &&
  state.schema_version === 2 &&
  state.source_digest === null &&
  state.mode === "OPEN" &&
  counts?.categories === categories.length &&
  counts?.products === demoProducts.length &&
  counts?.images === demoProducts.length &&
  counts?.inventory === demoProducts.length &&
  counts?.migration_runs === 0;
if (!emptyTarget && !sameSeededTarget)
  throw Error("Staging no está vacía/cerrada o no coincide con el seed aprobado.");

const q = (value) => `'${String(value).replaceAll("'", "''")}'`;
const timestamp = new Date().toISOString();
const sql = [
  "INSERT OR IGNORE INTO roles(id,code) VALUES(1,'CUSTOMER'),(2,'ADMIN');",
  ...categories.map(
    ([name, slug]) =>
      `INSERT OR IGNORE INTO categories(name,slug) VALUES(${q(name)},${q(slug)});`,
  ),
];
for (const [index, [name, category, price, image, stock]] of
  demoProducts.entries()) {
  const sku = `JM-${String(index + 1).padStart(3, "0")}`;
  const slug = name
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/-$/, "");
  const asset = `/images/demo/${image}${image.includes(".") ? "" : ".jpg"}`;
  sql.push(
    `INSERT OR IGNORE INTO products(category_id,sku,slug,name,description,base_price_cents,is_featured) SELECT id,${q(sku)},${q(slug)},${q(name)},${q(`${name}. Producto de demostración; imagen referencial.`)},${price},${Number(index < 8)} FROM categories WHERE slug=${q(categories[category - 1][1])};`,
    `INSERT OR IGNORE INTO inventory(product_id,quantity,updated_at) SELECT id,${stock},${q(timestamp)} FROM products WHERE sku=${q(sku)};`,
    `INSERT OR IGNORE INTO product_images(product_id,asset_path,alt_text,position) SELECT id,${q(asset)},${q(`${name}; imagen referencial`)},0 FROM products WHERE sku=${q(sku)};`,
    `INSERT INTO inventory_movements(product_id,kind,delta,quantity_after,reason,created_at) SELECT p.id,'SEED',${stock},${stock},'Seed sintético de staging',${q(timestamp)} FROM products p WHERE p.sku=${q(sku)} AND NOT EXISTS(SELECT 1 FROM inventory_movements m WHERE m.product_id=p.id AND m.kind='SEED' AND m.reason='Seed sintético de staging');`,
  );
}
sql.push(
  `UPDATE deployment_state SET environment_id='staging-synthetic',database_identity=${q(identity)},mode='OPEN',verified_at=${q(timestamp)} WHERE id=1 AND environment_id='unconfigured' AND database_identity='' AND source_digest IS NULL AND schema_version=2 AND mode='CLOSED';`,
);

const privateDir = join(root, "private");
await mkdir(privateDir, { recursive: true });
const seedFile = join(privateDir, `staging-seed-${randomUUID()}.sql`);
try {
  await writeFile(seedFile, sql.join("\n"), { flag: "wx", mode: 0o600 });
  execute([
    "d1",
    "execute",
    "DB",
    "--remote",
    "--config",
    configPath,
    "--file",
    seedFile,
    "--yes",
    "--json",
  ], false);
} finally {
  // SQL contains only the public synthetic catalog; retain no generated file.
  const { unlink } = await import("node:fs/promises");
  await unlink(seedFile).catch(() => {});
}

const verification = query(
  `SELECT environment_id,database_identity,mode FROM deployment_state WHERE id=1; SELECT (SELECT count(*) FROM categories) categories,(SELECT count(*) FROM products) products,(SELECT count(*) FROM product_images) images,(SELECT count(*) FROM inventory) inventory,(SELECT count(*) FROM users) users,(SELECT count(*) FROM orders) orders;`,
);
const finalState = verification?.[0]?.results?.[0];
const finalCounts = verification?.[1]?.results?.[0];
if (
  finalState?.environment_id !== "staging-synthetic" ||
  finalState?.database_identity !== identity ||
  finalState?.mode !== "OPEN" ||
  finalCounts?.categories !== categories.length ||
  finalCounts?.products !== demoProducts.length ||
  finalCounts?.images !== demoProducts.length ||
  finalCounts?.inventory !== demoProducts.length ||
  finalCounts?.users !== 0 ||
  finalCounts?.orders !== 0
)
  throw Error("Verificación de seed de staging no coincide; revisar sin abrir producción.");

console.log(
  JSON.stringify({
    target: target.environment,
    worker: target.worker,
    databaseId: target.databaseId,
    syntheticCategories: finalCounts.categories,
    syntheticProducts: finalCounts.products,
    users: finalCounts.users,
    orders: finalCounts.orders,
    mode: finalState.mode,
  }),
);
