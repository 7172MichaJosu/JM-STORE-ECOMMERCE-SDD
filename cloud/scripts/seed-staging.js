import { categories, demoProducts } from "../../shared/domain/demo-catalog.js";
export async function seedStaging(db, { localOnly = false } = {}) {
  if (!localOnly)
    throw Error("Este seed solo está autorizado para D1 emulada local.");
  const state = await db
    .prepare("SELECT * FROM deployment_state WHERE id=1")
    .first();
  if (
    !state ||
    !["unconfigured", "local-synthetic"].includes(state.environment_id) ||
    state.source_digest ||
    !["", "local-only"].includes(state.database_identity)
  )
    throw Error("Seed rechazado para datos importados o ambiente desconocido.");
  if (await db.prepare("SELECT id FROM migration_runs LIMIT 1").first())
    throw Error("No sembrar una importación.");
  await db.batch([
    db.prepare(
      "INSERT OR IGNORE INTO roles(id,code) VALUES(1,'CUSTOMER'),(2,'ADMIN')",
    ),
    ...categories.map(([name, slug]) =>
      db
        .prepare("INSERT OR IGNORE INTO categories(name,slug) VALUES(?,?)")
        .bind(name, slug),
    ),
  ]);
  const date = new Date().toISOString();
  for (const [
    i,
    [name, category, price, image, stock],
  ] of demoProducts.entries()) {
    const sku = `JM-${String(i + 1).padStart(3, "0")}`;
    if (
      await db.prepare("SELECT id FROM products WHERE sku=?").bind(sku).first()
    )
      continue;
    const slug = name
      .normalize("NFD")
      .replace(/[\u0300-\u036f]/g, "")
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/-$/, "");
    await db.batch([
      db
        .prepare(
          "INSERT INTO products(category_id,sku,slug,name,description,base_price_cents,is_featured) SELECT id,?,?,?,?,?,? FROM categories WHERE slug=?",
        )
        .bind(
          sku,
          slug,
          name,
          `${name}. Producto de demostración; imagen referencial.`,
          price,
          Number(i < 8),
          categories[category - 1][1],
        ),
      db
        .prepare(
          "INSERT INTO inventory(product_id,quantity,updated_at) SELECT id,?,? FROM products WHERE sku=?",
        )
        .bind(stock, date, sku),
      db
        .prepare(
          "INSERT INTO product_images(product_id,asset_path,alt_text,position) SELECT id,?,?,0 FROM products WHERE sku=?",
        )
        .bind(
          "/images/demo/" + image + (image.includes(".") ? "" : ".jpg"),
          name + "; imagen referencial",
          sku,
        ),
      db
        .prepare(
          "INSERT INTO inventory_movements(product_id,kind,delta,quantity_after,reason,created_at) SELECT id,'SEED',?,?,'Seed sintético local',? FROM products WHERE sku=?",
        )
        .bind(stock, stock, date, sku),
    ]);
  }
  await db
    .prepare(
      "UPDATE deployment_state SET environment_id='local-synthetic',database_identity='local-only',mode='OPEN' WHERE id=1",
    )
    .run();
}
