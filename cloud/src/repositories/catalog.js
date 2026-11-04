import {
  fields,
  pagination,
  integer,
  fail,
  notFound,
} from "../../../shared/domain/index.js";
export async function catalogIndex(db) {
  const [rows, images] = await Promise.all([
    db.all("SELECT * FROM catalog_products ORDER BY id"),
    db.all(
      "SELECT id,product_id,asset_path path,alt_text alt,position FROM product_images ORDER BY product_id,position",
    ),
  ]);
  const grouped = new Map();
  for (const i of images) {
    if (!grouped.has(i.product_id)) grouped.set(i.product_id, []);
    const { product_id, ...image } = i;
    grouped.get(product_id).push(image);
  }
  return rows.map(
    ({ promotion_json, promotion_id, promotion_version, ...p }) => ({
      ...p,
      category: {
        id: p.category_id,
        name: p.category_name,
        slug: p.category_slug,
      },
      images: grouped.get(p.id) || [],
      currency: "PEN",
      available_quantity: p.quantity,
      is_available: !!(p.is_active && p.category_active && p.quantity > 0),
      promotion: promotion_json ? JSON.parse(promotion_json) : null,
    }),
  );
}
export async function product(db, id, includeInactive = false) {
  const p = (await catalogIndex(db)).find(
    (p) => p.id === Number(id) || p.slug === id,
  );
  if (!p || (!includeInactive && (!p.is_active || !p.category_active)))
    notFound();
  return p;
}
export async function categories(db, query) {
  fields(query, ["page", "pageSize"]);
  const { page, pageSize } = pagination(query),
    rows = await db.all(
      "SELECT id,name,slug FROM categories WHERE is_active=1 ORDER BY id",
    );
  return {
    data: rows.slice((page - 1) * pageSize, page * pageSize),
    meta: { page, pageSize, total: rows.length },
  };
}
export async function list(db, q) {
  fields(q, [
    "q",
    "category",
    "minPriceCents",
    "maxPriceCents",
    "inStock",
    "featured",
    "page",
    "pageSize",
    "sort",
  ]);
  const { page, pageSize } = pagination(q),
    min = Number(q.minPriceCents || 0),
    max = Number(q.maxPriceCents || 100000000);
  integer(min, "minPriceCents", 0, 100000000);
  integer(max, "maxPriceCents", 0, 100000000);
  if (min > max || (q.q || "").length > 100)
    fail(422, "VALIDATION", "Revisa la búsqueda o el rango de precios.");
  if (
    q.sort &&
    !["relevance", "price_asc", "price_desc", "name"].includes(q.sort)
  )
    fail(422, "VALIDATION", "Orden no permitido.");
  for (const key of ["inStock", "featured"])
    if (q[key] && !["true", "false"].includes(q[key]))
      fail(422, "VALIDATION", "Filtro no permitido.");
  const term = (q.q || "").trim().toLocaleLowerCase("es");
  let rows = (await catalogIndex(db)).filter(
    (p) =>
      p.is_active &&
      p.category_active &&
      (!term ||
        (p.name + " " + p.description)
          .toLocaleLowerCase("es")
          .includes(term)) &&
      (!q.category ||
        p.category.slug === q.category ||
        String(p.category.id) === q.category) &&
      p.effective_price_cents >= min &&
      p.effective_price_cents <= max &&
      (q.inStock !== "true" || p.is_available) &&
      (q.featured !== "true" || p.is_featured),
  );
  if (q.sort === "price_asc")
    rows.sort((a, b) => a.effective_price_cents - b.effective_price_cents);
  if (q.sort === "price_desc")
    rows.sort((a, b) => b.effective_price_cents - a.effective_price_cents);
  if (q.sort === "name")
    rows.sort((a, b) => a.name.localeCompare(b.name, "es"));
  return {
    data: rows.slice((page - 1) * pageSize, page * pageSize),
    meta: { page, pageSize, total: rows.length },
  };
}
