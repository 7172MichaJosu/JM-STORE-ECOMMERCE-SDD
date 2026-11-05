import { fields, integer, text, flag, version, fail } from "../../../shared/domain/index.js";
import library from "../assets/library.json" with { type: "json" };
import { adminMutation, row, slug, id } from "./admin-common.js";
import { product, catalogIndex } from "./catalog.js";
export const imageLibrary = () => library;
export function imageInput(images) {
  if (!Array.isArray(images) || images.length > 4) fail(422, "VALIDATION", "Selecciona hasta cuatro imágenes.");
  const allowed = new Set(library.map(image => image.path));
  const result = images.map((image, index) => {
    if (!allowed.has(image.path)) fail(422, "VALIDATION", "Usa una imagen de la biblioteca.");
    return { path: image.path, alt: text(image.alt, "alt", 1, 200), position: integer(image.position ?? index, "position", 0, 3) };
  });
  if (new Set(result.map(image => image.position)).size !== result.length) fail(422, "VALIDATION", "Posiciones repetidas.");
  return result;
}
async function input(db, body) {
  const category = await row(db, "categories", body.categoryId), active = flag(body.isActive, "isActive");
  if (active && !category.is_active) fail(422, "VALIDATION", "Activa la categoría antes de publicar.");
  return { category, values: [category.id, text(body.sku, "sku", 1, 64), slug(body.slug), text(body.name, "name", 2, 120), text(body.description, "description", 1, 4000), integer(body.basePriceCents, "basePriceCents", 1, 100000000), active, flag(body.isFeatured, "isFeatured")] };
}
export async function listProducts(req) {
  let rows = (await catalogIndex(req.db)).sort((a, b) => b.id - a.id);
  if (req.query.q) rows = rows.filter(p => (p.name + p.sku).toLowerCase().includes(req.query.q.toLowerCase()));
  if (req.query.status) rows = rows.filter(p => p.is_active === Number(req.query.status === "active"));
  if (req.query.category) rows = rows.filter(p => String(p.category_id) === req.query.category);
  return rows;
}
export async function createProduct(req) {
  fields(req.body, ["categoryId", "sku", "slug", "name", "description", "basePriceCents", "isActive", "isFeatured", "initialStock", "images"]);
  const { category, values } = await input(req.db, req.body), stock = integer(req.body.initialStock, "initialStock", 0, 1000000), images = imageInput(req.body.images || []), date = new Date().toISOString();
  const result = await adminMutation(req, "ADMIN_PRODUCT", "EXISTS(SELECT 1 FROM categories WHERE id=? AND version=?)", [category.id, category.version], [
    req.db.stmt("INSERT INTO products(category_id,sku,slug,name,description,base_price_cents,is_active,is_featured) VALUES(?,?,?,?,?,?,?,?) RETURNING id", ...values),
    req.db.stmt("INSERT INTO inventory(product_id,quantity,updated_at) SELECT id,?,? FROM products WHERE sku=?", stock, date, values[1]),
    req.db.stmt("INSERT INTO inventory_movements(product_id,actor_user_id,kind,delta,quantity_after,reason,created_at) SELECT id,?,'SEED',?,?,'Alta administrativa',? FROM products WHERE sku=?", req.user.id, stock, stock, date, values[1]),
    ...images.map(image => req.db.stmt("INSERT INTO product_images(product_id,asset_path,alt_text,position) SELECT id,?,?,? FROM products WHERE sku=?", image.path, image.alt, image.position, values[1])),
  ]);
  return product(req.db, result[1].results[0].id, true);
}
export async function changeProduct(req, remove = false) {
  fields(req.body, remove ? ["version"] : ["version", "categoryId", "sku", "slug", "name", "description", "basePriceCents", "isActive", "isFeatured"]);
  const current = await product(req.db, id(req.params.id), true); version(req.body.version, current.version);
  if (remove) {
    await adminMutation(req, "ADMIN_PRODUCT", "EXISTS(SELECT 1 FROM products WHERE id=? AND version=?)", [current.id, current.version], [req.db.stmt("UPDATE products SET is_active=0,version=version+1 WHERE id=?", current.id)]); return;
  }
  const body = { categoryId: current.category_id, sku: current.sku, slug: current.slug, name: current.name, description: current.description, basePriceCents: current.base_price_cents, isActive: !!current.is_active, isFeatured: !!current.is_featured, ...req.body };
  const { category, values } = await input(req.db, body);
  if (await req.db.first("SELECT id FROM promotions WHERE product_id=? AND kind='FINAL_PRICE' AND is_active=1 AND value>=?", current.id, body.basePriceCents)) fail(422, "VALIDATION", "Desactiva la promoción incompatible antes de bajar el precio.");
  await adminMutation(req, "ADMIN_PRODUCT", "EXISTS(SELECT 1 FROM products WHERE id=? AND version=?) AND EXISTS(SELECT 1 FROM categories WHERE id=? AND version=?) AND NOT EXISTS(SELECT 1 FROM promotions WHERE product_id=? AND kind='FINAL_PRICE' AND is_active=1 AND value>=?)", [current.id, current.version, category.id, category.version, current.id, body.basePriceCents], [req.db.stmt("UPDATE products SET category_id=?,sku=?,slug=?,name=?,description=?,base_price_cents=?,is_active=?,is_featured=?,version=version+1 WHERE id=?", ...values, current.id)]);
  return product(req.db, current.id, true);
}
export async function changeImages(req) {
  fields(req.body, ["version", "images"]);
  const p = await row(req.db, "products", req.params.id); version(req.body.version, p.version);
  const images = imageInput(req.body.images);
  await adminMutation(req, "ADMIN_IMAGES", "EXISTS(SELECT 1 FROM products WHERE id=? AND version=?)", [p.id, p.version], [req.db.stmt("DELETE FROM product_images WHERE product_id=?", p.id), ...images.map(image => req.db.stmt("INSERT INTO product_images(product_id,asset_path,alt_text,position) VALUES(?,?,?,?)", p.id, image.path, image.alt, image.position)), req.db.stmt("UPDATE products SET version=version+1 WHERE id=?", p.id)]);
  return product(req.db, p.id, true);
}
