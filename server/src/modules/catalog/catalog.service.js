import { discounted } from "../../lib/money.js";
import { notFound } from "../../lib/errors.js";
export function product(db, id, includeInactive = false) {
  const p = db
    .prepare(
      "SELECT p.*,c.name category_name,c.slug category_slug,c.is_active category_active,i.quantity,i.version inventory_version FROM products p JOIN categories c ON c.id=p.category_id JOIN inventory i ON i.product_id=p.id WHERE p.id=?",
    )
    .get(id);
  if (!p || (!includeInactive && (!p.is_active || !p.category_active)))
    notFound();
  const now = new Date().toISOString();
  const promo = db
    .prepare(
      "SELECT * FROM promotions WHERE is_active=1 AND starts_at<=? AND ends_at>? AND (product_id=? OR category_id=?) ORDER BY product_id IS NOT NULL DESC LIMIT 1",
    )
    .get(now, now, id, p.category_id);
  const effective = promo
    ? promo.kind === "FINAL_PRICE"
      ? promo.value
      : discounted(p.base_price_cents, promo.value)
    : p.base_price_cents;
  return {
    ...p,
    category: {
      id: p.category_id,
      name: p.category_name,
      slug: p.category_slug,
    },
    images: db
      .prepare(
        "SELECT id,asset_path path,alt_text alt,position FROM product_images WHERE product_id=? ORDER BY position",
      )
      .all(id),
    effective_price_cents: effective,
    currency: "PEN",
    available_quantity: p.quantity,
    is_available: !!(p.is_active && p.category_active && p.quantity > 0),
    promotion: promo || null,
  };
}
