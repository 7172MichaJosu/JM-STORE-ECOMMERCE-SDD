import { fields, text, flag, version, integer, discounted, fail } from "../../../shared/domain/index.js";
import { adminMutation, row, slug } from "./admin-common.js";
export async function saveCategory(req, remove = false) {
  const current = req.params.id ? await row(req.db, "categories", req.params.id) : null;
  fields(req.body, remove ? ["version"] : ["name", "slug", "isActive", ...(current ? ["version"] : [])]);
  if (current) version(req.body.version, current.version);
  const values = remove ? [current.name, current.slug, 0] : [text(req.body.name ?? current?.name, "name", 2, 80), slug(req.body.slug ?? current?.slug, 100), req.body.isActive === undefined && current ? current.is_active : flag(req.body.isActive, "isActive")];
  const result = await adminMutation(req, "ADMIN_CATEGORY", current ? "EXISTS(SELECT 1 FROM categories WHERE id=? AND version=?)" : "1", current ? [current.id, current.version] : [], [current ? req.db.stmt("UPDATE categories SET name=?,slug=?,is_active=?,version=version+1 WHERE id=? RETURNING *", ...values, current.id) : req.db.stmt("INSERT INTO categories(name,slug,is_active) VALUES(?,?,?) RETURNING *", ...values)]);
  return result[1].results[0];
}
export async function savePromotion(req, remove = false) {
  const current = req.params.id ? await row(req.db, "promotions", req.params.id) : null;
  fields(req.body, remove ? ["version"] : ["productId", "categoryId", "kind", "value", "startsAt", "endsAt", "terms", "isActive", ...(current ? ["version"] : [])]);
  if (current) version(req.body.version, current.version);
  const b = { ...(current ? { productId: current.product_id, categoryId: current.category_id, kind: current.kind, value: current.value, startsAt: current.starts_at, endsAt: current.ends_at, terms: current.terms, isActive: !!current.is_active } : {}), ...req.body, ...(remove ? { isActive: false } : {}) };
  const p = b.productId || null, c = b.categoryId || null;
  if (Number(!!p) + Number(!!c) !== 1 || (p && b.kind !== "FINAL_PRICE") || (c && b.kind !== "PERCENT_BPS")) fail(422, "VALIDATION", "Elige un objetivo y una regla compatibles.");
  if (p) integer(p, "productId", 1); if (c) integer(c, "categoryId", 1);
  const value = integer(b.value, "value", 1, c ? 9999 : 100000000), active = flag(b.isActive, "isActive"), starts = new Date(text(b.startsAt, "startsAt", 1, 50)), ends = new Date(text(b.endsAt, "endsAt", 1, 50));
  if (![b.startsAt, b.endsAt].every(v => /T.+(Z|[+-]\d\d:\d\d)$/.test(v)) || !Number.isFinite(+starts) || !Number.isFinite(+ends) || +starts >= +ends) fail(422, "VALIDATION", "Fechas no válidas.");
  const target = await row(req.db, p ? "products" : "categories", p || c);
  if (p && value >= target.base_price_cents) fail(422, "VALIDATION", "El precio promocional debe ser menor al base.");
  if (c && (await req.db.all("SELECT base_price_cents FROM products WHERE category_id=?", c)).some(product => discounted(product.base_price_cents, value) < 1)) fail(422, "VALIDATION", "La promoción produciría precio cero.");
  const overlapSql = "NOT EXISTS(SELECT 1 FROM promotions WHERE id!=? AND is_active=1 AND (product_id=? OR category_id=?) AND starts_at<? AND ends_at>?)";
  const overlapValues = [current?.id || 0, p, c, ends.toISOString(), starts.toISOString()];
  if (active && !(await req.db.first(`SELECT ${overlapSql} valid`, ...overlapValues)).valid) fail(409, "PROMOTION_OVERLAP", "Promoción solapada.");
  const values = [p, c, b.kind, value, starts.toISOString(), ends.toISOString(), text(b.terms, "terms", 1, 500), active];
  const condition = `${current ? "EXISTS(SELECT 1 FROM promotions WHERE id=? AND version=?) AND " : ""}EXISTS(SELECT 1 FROM ${p ? "products" : "categories"} WHERE id=? AND version=?) AND (?=0 OR ${overlapSql})${p ? " AND EXISTS(SELECT 1 FROM products WHERE id=? AND base_price_cents>?)" : " AND NOT EXISTS(SELECT 1 FROM products WHERE category_id=? AND CAST((base_price_cents*(10000-?)+5000)/10000 AS INTEGER)<1)"}`;
  const params = [...(current ? [current.id, current.version] : []), target.id, target.version, active, ...overlapValues, p || c, value];
  const result = await adminMutation(req, "ADMIN_PROMOTION", condition, params, [current ? req.db.stmt("UPDATE promotions SET product_id=?,category_id=?,kind=?,value=?,starts_at=?,ends_at=?,terms=?,is_active=?,version=version+1 WHERE id=? RETURNING *", ...values, current.id) : req.db.stmt("INSERT INTO promotions(product_id,category_id,kind,value,starts_at,ends_at,terms,is_active) VALUES(?,?,?,?,?,?,?,?) RETURNING *", ...values)]);
  return result[1].results[0];
}
